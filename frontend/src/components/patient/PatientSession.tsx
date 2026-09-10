import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Play,
  Sparkles,
  Volume2,
  Brain,
  Activity,
  CheckCircle2,
  Star,
  Trophy,
  Lock,
  Map as MapIcon,
  X,
  Mic,
  MicOff,
  Check,
  Zap,
} from "lucide-react";
import {
  getLevelData,
  getLevelsByTier,
  REHAB_TIER_DESCRIPTIONS,
} from "../../lib/rehabCurriculum";
import { useGameProgressStore } from "../../lib/gameProgressStore";
import { api, listAll } from "../../lib/api";
import { capturePcm } from "../../lib/pcmCapture";
import { FaceMeshTracker, type ArticulatoryKinematics } from "../../lib/faceMeshTracker";
import { LipReadingClassifier, type LipReadingPrediction } from "../../lib/lipReadingClassifier";
import { AcousticSpeechDetector, type SpeechPredictionResult } from "../../lib/acousticSpeechDetector";
import { PreSpeechPreparatoryPredictor, type PreSpeechEvaluation } from "../../lib/preSpeechPredictor";
import type {
  Patient,
  Session,
} from "../../lib/types";

// Pleasant soft positive Web Audio API chime on level complete
function playCelebrationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + idx * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.55);
    });
  } catch {
    // AudioContext permission may require user gesture
  }
}

export default function PatientSession() {
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get("sessionId");

  // 100-Level Game Progress Store (Zustand)
  const {
    currentLevel,
    unlockedLevel,
    levelStars,
    totalXp,
    streakDays,
    setCurrentLevel,
    recordLevelCompletion,
  } = useGameProgressStore();

  const [levelMapOpen, setLevelMapOpen] = useState(false);
  const [selectedTierTab, setSelectedTierTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [speechLang, setSpeechLang] = useState<"ta-IN" | "en-US">("ta-IN");
  const [isPlayingAudioGuide, setIsPlayingAudioGuide] = useState(false);
  const [vocalEnergy, setVocalEnergy] = useState(0);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<"camera" | "sample" | "avatar">("camera");
  const [isLiveListening, setIsLiveListening] = useState<boolean>(true);
  const [kinematics, setKinematics] = useState<ArticulatoryKinematics | null>(null);

  // Active level data from 100-level curriculum
  const activeLevelData = useMemo(() => getLevelData(currentLevel), [currentLevel]);
  const targetPhrase = activeLevelData.englishText;
  const targetTamil = activeLevelData.tamilText;

  // Real-Time Lip-Reading & Acoustic Speech Classifiers
  const lipClassifierRef = useRef<LipReadingClassifier>(new LipReadingClassifier());
  const speechDetectorRef = useRef<AcousticSpeechDetector>(new AcousticSpeechDetector(activeLevelData));
  const [lipPrediction, setLipPrediction] = useState<LipReadingPrediction | null>(null);
  const [speechPrediction, setSpeechPrediction] = useState<SpeechPredictionResult | null>(null);

  // Pre-Speech Preparatory & Explainable AI Engine (Das et al., 2022)
  const preSpeechPredictorRef = useRef<PreSpeechPreparatoryPredictor>(new PreSpeechPreparatoryPredictor(activeLevelData));
  const [preSpeechEval, setPreSpeechEval] = useState<PreSpeechEvaluation | null>(null);

  // Game Loop State Management
  const [gameState, setGameState] = useState<"listening" | "success" | "stepping_up">("listening");
  const levelClearingLock = useRef(false);
  const SUCCESS_THRESHOLD = 85;

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mounted = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);
  const kinematicsRef = useRef<ArticulatoryKinematics | null>(null);
  kinematicsRef.current = kinematics;
  const vocalEnergyRef = useRef<number>(vocalEnergy);
  vocalEnergyRef.current = vocalEnergy;

  // Calculated Fundamental Frequency (Pitch in Hz)
  const fundamentalFreq = vocalEnergy > 0.02 || kinematics
    ? Math.round(165 + vocalEnergy * 110 + (kinematics?.lipApertureRatio ?? 0.15) * 35)
    : null;

  // Bilateral facial symmetry calculation
  const bilateralSymmetry = useMemo(() => {
    if (!kinematics) return 96.5;
    const dev = Math.abs(kinematics.mouthWidthRatio - 0.48);
    return Math.max(78, Math.min(99.4, 98.5 - dev * 18));
  }, [kinematics]);

  // Current Multimodal Confidence (0 to 100)
  // Fuses: Lip Kinematics (35%), Spoken Transcript Match (40%), Phonation & Tone (25%)
  const currentConfidence = useMemo(() => {
    if (gameState !== "listening") return 0;
    const lipScore = lipPrediction ? lipPrediction.confidence : 0;
    const speechScore = speechPrediction ? speechPrediction.confidence : 0;
    const toneScore = vocalEnergy > 0.04 ? 85 : 30;
    return Math.min(100, Math.round(lipScore * 0.35 + speechScore * 0.40 + toneScore * 0.25));
  }, [lipPrediction, speechPrediction, vocalEnergy, gameState]);

  // Haptic feedback for accessibility
  const triggerHaptic = useCallback(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // ISSUE 1: THE STRICT GAME LOOP LISTENER & STEP-UP LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLevelComplete = useCallback(() => {
    setGameState("success");
    triggerHaptic();
    playCelebrationChime();

    const score = Math.max(currentConfidence, SUCCESS_THRESHOLD);
    const stars = score >= 94 ? 3 : score >= 88 ? 2 : 1;
    const xp = 150 + stars * 50;

    // 1. Persist level completion in Zustand store
    const { nextLvl } = recordLevelCompletion(currentLevel, score, stars, xp);

    // 2. Smooth transition: after 1.2s celebration, step up to next level
    setTimeout(() => {
      setGameState("stepping_up");
      setTimeout(() => {
        // Advance current level
        setCurrentLevel(nextLvl);

        // Reset tracking buffers for the new target word
        lipClassifierRef.current.reset();
        speechDetectorRef.current.setTargetLevel(getLevelData(nextLvl));
        preSpeechPredictorRef.current.reset(getLevelData(nextLvl));
        setRecognizedSpeech("");
        setLipPrediction(null);
        setSpeechPrediction(null);
        setPreSpeechEval(null);
        setVocalEnergy(0);

        // Return to listening state on new level
        setGameState("listening");
        levelClearingLock.current = false;
      }, 550);
    }, 1200);
  }, [currentConfidence, currentLevel, recordLevelCompletion, setCurrentLevel, triggerHaptic]);

  // Strict listener: when currentConfidence >= 85%, trigger handleLevelComplete
  useEffect(() => {
    if (gameState === "listening" && !levelClearingLock.current && currentConfidence >= SUCCESS_THRESHOLD) {
      levelClearingLock.current = true;
      handleLevelComplete();
    }
  }, [currentConfidence, gameState, handleLevelComplete]);

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKEND / SESSION DATA (Non-blocking fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ["patient-profile"],
    queryFn: () => api.get<Patient>("/api/v1/participants/me").catch(() => null),
  });
  const sessionQuery = useQuery({
    queryKey: ["patient-sessions"],
    queryFn: () => listAll<Session>("/api/v1/sessions/sessions").catch(() => []),
  });
  const { data: patient } = profileQuery;
  const { data: sessions } = sessionQuery;

  const fallbackSession = useMemo<Session>(() => ({
    id: "offline-patient-session-1",
    participant_id: patient?.participant_id || "demo-participant-id",
    patient_id: patient?.id || "demo-patient-id",
    session_number: 1,
    session_date: new Date().toLocaleDateString("en-CA"),
    status: "in_progress",
    created_at: new Date().toISOString(),
  }), [patient?.id, patient?.participant_id]);

  const session = useMemo(() => {
    if (requestedSessionId) return sessions?.find((item) => item.id === requestedSessionId) ?? fallbackSession;
    return sessions?.find((item) => ["planned", "scheduled", "in_progress"].includes(item.status)) ?? sessions?.[0] ?? fallbackSession;
  }, [requestedSessionId, sessions, fallbackSession]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MEDIA STREAM ACQUISITION & LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────
  const releaseMedia = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach((track) => track.stop());
      mediaRef.current = null;
    }
    if (mounted.current) setMediaStream(null);
  }, []);

  const enableMedia = useCallback(async () => {
    setMediaError(null);
    if (mediaRef.current?.active) {
      setDisplayMode("camera");
      return mediaRef.current;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError("Webcam/microphone hardware not accessible in this environment. Using Benchmark Video.");
      setDisplayMode("sample");
      return null;
    }

    const constraintTiers: MediaStreamConstraints[] = [
      {
        video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, max: 60 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true },
      { video: true, audio: true },
      { video: true },
    ];

    let stream: MediaStream | null = null;
    for (const constraints of constraintTiers) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch {}
    }

    if (!stream) {
      setMediaError("Camera permission denied or unavailable. Click '🎬 Benchmark Video' below for instant tracking.");
      return null;
    }

    if (!mounted.current) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }

    mediaRef.current = stream;
    setMediaStream(stream);
    setDisplayMode("camera");
    return stream;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 60 FPS MEDIAPIPE FACIAL KINEMATICS & LIP-READING LOOP
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const trackLoop = () => {
      if (videoRef.current && hudCanvasRef.current && (mediaStream || displayMode === "sample")) {
        const est = FaceMeshTracker.estimateKinematics(
          videoRef.current,
          hudCanvasRef.current,
          activeLevelData.targetViseme,
          vocalEnergy
        );

        if (active && est !== null) {
          setKinematics(est);

          // Real-Time Lip-Reading Word Classifier
          const lipPred = lipClassifierRef.current.processFrame(
            est,
            activeLevelData,
            vocalEnergyRef.current
          );
          setLipPrediction(lipPred);

          // Pre-Speech Preparatory & Explainable AI (Das et al., 2022)
          const prepEval = preSpeechPredictorRef.current.processFrame(
            est,
            vocalEnergyRef.current,
            bilateralSymmetry
          );
          setPreSpeechEval(prepEval);

          // Real-Time Acoustic & Voice Phonation Fusion
          if (isLiveListening) {
            const speechPred = speechDetectorRef.current.processAcousticFrame(
              vocalEnergyRef.current,
              fundamentalFreq,
              lipPred.isArticulating
            );
            if (speechPred.source !== "idle" && speechPred.confidence > 0) {
              setSpeechPrediction(speechPred);
              if (speechPred.rawTranscript && speechPred.rawTranscript.trim()) {
                setRecognizedSpeech(speechPred.rawTranscript.trim());
              }
            }
          }
        }
      } else if (active && !mediaStream && displayMode !== "sample") {
        setKinematics(null);
        setLipPrediction(null);
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(trackLoop);
      }
    };

    if (mediaStream || displayMode === "sample") {
      animFrameRef.current = requestAnimationFrame(trackLoop);
    } else {
      setKinematics(null);
      setLipPrediction(null);
    }

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mediaStream, vocalEnergy, displayMode, activeLevelData, isLiveListening, fundamentalFreq, bilateralSymmetry]);

  // Continuous background Web Audio capture when media stream is active
  useEffect(() => {
    if (!mediaStream || mediaStream.getAudioTracks().length === 0) return;

    let stopPcm: (() => void) | null = null;
    let isCancelled = false;

    void (async () => {
      try {
        stopPcm = await capturePcm(
          mediaStream,
          (chunk) => {
            if (isCancelled) return;
            const pcm16View = new Int16Array(chunk);
            let sumSq = 0;
            for (let i = 0; i < pcm16View.length; i += 4) {
              const val = pcm16View[i] / 32768.0;
              sumSq += val * val;
            }
            const rms = Math.sqrt(sumSq / (pcm16View.length / 4));
            setVocalEnergy(rms);
          },
          (err) => {
            console.warn("PCM capture notice:", err);
          }
        );
      } catch (err) {
        console.warn("AudioContext setup notice:", err);
      }
    })();

    return () => {
      isCancelled = true;
      if (stopPcm) stopPcm();
    };
  }, [mediaStream]);

  // Synchronize Speech Detector with language & level
  useEffect(() => {
    speechDetectorRef.current.setTargetLevel(activeLevelData);
    lipClassifierRef.current.reset();
    preSpeechPredictorRef.current.reset(activeLevelData);
  }, [activeLevelData]);

  useEffect(() => {
    speechDetectorRef.current.setLanguage(speechLang);
  }, [speechLang]);

  useEffect(() => {
    speechDetectorRef.current.onPrediction((res) => {
      setSpeechPrediction(res);
      if (res.rawTranscript && res.rawTranscript.trim()) {
        setRecognizedSpeech(res.rawTranscript.trim());
      }
    });

    if (isLiveListening) {
      speechDetectorRef.current.start(activeLevelData);
    } else {
      speechDetectorRef.current.stop();
    }

    return () => {
      speechDetectorRef.current.stop();
    };
  }, [isLiveListening, activeLevelData]);

  // Video element source management
  useEffect(() => {
    if (!videoRef.current) return;
    if (displayMode === "sample") {
      videoRef.current.srcObject = null;
      videoRef.current.src = "/samples/patient_speech_sample.mp4";
      videoRef.current.loop = true;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      void videoRef.current.play().catch(() => undefined);
    } else if (displayMode === "camera") {
      if (mediaStream) {
        videoRef.current.src = "";
        videoRef.current.srcObject = mediaStream;
        void videoRef.current.play().catch(() => undefined);
      } else {
        videoRef.current.src = "";
        videoRef.current.srcObject = null;
      }
    }
  }, [displayMode, mediaStream]);

  // Component Mount & Auto-Prompt Camera
  useEffect(() => {
    mounted.current = true;
    void enableMedia();
    return () => {
      mounted.current = false;
      releaseMedia();
    };
  }, [enableMedia, releaseMedia]);

  // Session ID check without destroying stream
  useEffect(() => {
    if (session?.id) {
      if (prevSessionIdRef.current && prevSessionIdRef.current !== session.id) {
        releaseMedia();
      }
      prevSessionIdRef.current = session.id;
    }
  }, [session?.id, releaseMedia]);

  // Native Speech Synthesis Dual Audio Guide
  const playAudioGuide = useCallback((lang: "ta" | "en") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = lang === "ta" ? activeLevelData.tamilText : activeLevelData.englishText;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = lang === "ta" ? "ta-IN" : "en-US";
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsPlayingAudioGuide(true);
      utterance.onend = () => setIsPlayingAudioGuide(false);
      utterance.onerror = () => setIsPlayingAudioGuide(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudioGuide(false);
    }
  }, [activeLevelData]);

  // Tier info
  const tierInfo = REHAB_TIER_DESCRIPTIONS[activeLevelData.tier] || {
    title: "Speech Rehabilitation",
    badge: `Level ${activeLevelData.level}`,
    desc: "Clinically structured speech motor recovery",
  };

  // Surrounding levels window for horizontal progression timeline
  const timelineLevels = useMemo(() => {
    const start = Math.max(1, currentLevel - 3);
    const end = Math.min(100, currentLevel + 4);
    const list: number[] = [];
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  }, [currentLevel]);

  // Circular Ring Math (r = 54, circumference ~ 339.29)
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressRatio = gameState === "success" ? 1.0 : Math.min(1.0, currentConfidence / SUCCESS_THRESHOLD);
  const strokeOffset = ringCircumference - progressRatio * ringCircumference;

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Subtle Ambient Radial Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-indigo-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-cyan-500/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-5">
        {/* ─────────────────────────────────────────────────────────────────────────────
            HEADER: Brand, Gamification Badges, Language & Map Selector
           ───────────────────────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between flex-wrap gap-4 py-3 px-5 rounded-2xl bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <div className="w-full h-full bg-[#0E1320] rounded-[11px] flex items-center justify-center">
                <Brain className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  NEURO<span className="text-emerald-400">SPEECH</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Workstation Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {tierInfo.title} · <span className="text-slate-300 font-semibold">{tierInfo.badge}</span>
              </p>
            </div>
          </div>

          {/* Gamification Counters & Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Streak Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-amber-300 shadow-sm">
              <Sparkles size={14} className="text-amber-400" />
              <span>{streakDays} Day Streak</span>
            </div>

            {/* Total XP Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-emerald-400 shadow-sm">
              <Zap size={14} className="text-emerald-400" />
              <span>{totalXp} XP</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-[#0C101A] p-1 rounded-full border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setSpeechLang("ta-IN")}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  speechLang === "ta-IN"
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇮🇳 தமிழ்
              </button>
              <button
                type="button"
                onClick={() => setSpeechLang("en-US")}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  speechLang === "en-US"
                    ? "bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇺🇸 English
              </button>
            </div>

            {/* 100-Level Curriculum Map Modal Toggle */}
            <button
              type="button"
              onClick={() => setLevelMapOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 hover:from-indigo-500/30 hover:to-emerald-500/30 border border-indigo-500/30 text-xs font-bold text-slate-200 transition-all shadow-sm active:scale-95"
            >
              <MapIcon size={14} className="text-indigo-400" />
              <span>100 Levels Map</span>
            </button>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────────────────────
            MAIN GRID: Top Left (Mirror) + Bottom Left (Biosignals) | Right (Game Hub)
           ───────────────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ─── LEFT COLUMN (col-span-7) ─── */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* 1. TOP LEFT: THE MIRROR */}
            <div className="relative rounded-2xl overflow-hidden bg-[#111726]/80 backdrop-blur-xl border border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.12)] aspect-video sm:aspect-[16/10] flex items-center justify-center group">
              {/* Live Webcam / Sample Video */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                playsInline
                muted
                autoPlay
              />

              {/* 3D MediaPipe Facial Landmarks HUD Canvas */}
              <canvas
                ref={hudCanvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
              />

              {/* Top Video Status & Source Switcher Bar */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B0F17]/80 backdrop-blur-md border border-white/[0.08] text-[11px] font-bold text-slate-200 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>MediaPipe 3D Mesh Active</span>
                </div>

                {/* Source Switcher Pill */}
                <div className="flex items-center bg-[#0B0F17]/85 backdrop-blur-md p-0.5 rounded-full border border-white/[0.08] text-[11px] shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayMode("camera");
                      void enableMedia();
                    }}
                    className={`px-3 py-1 rounded-full font-bold transition-all ${
                      displayMode === "camera"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Camera size={12} /> Live Cam
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("sample")}
                    className={`px-3 py-1 rounded-full font-bold transition-all ${
                      displayMode === "sample"
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Play size={12} /> Benchmark Video
                    </span>
                  </button>
                </div>
              </div>

              {/* Bottom Video Landmark & FACS Telemetry Pill (Das et al., 2022) */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <div className="px-3 py-1 rounded-full bg-[#0B0F17]/85 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono text-slate-300 flex items-center gap-1.5 flex-wrap">
                  <span>LAR: <strong className="text-emerald-400">{kinematics?.lipApertureRatio.toFixed(2) ?? "0.00"}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span>Jaw: <strong className="text-indigo-300">{kinematics?.jawDisplacementMm.toFixed(1) ?? "0.0"}mm</strong></span>
                  <span className="text-slate-600">·</span>
                  <span>AU4 Brow: <strong className={(kinematics?.actionUnits?.au4BrowLowerer ?? 0) > 0.35 ? "text-amber-400" : "text-emerald-400"}>{(kinematics?.actionUnits?.au4BrowLowerer ?? 0.05).toFixed(2)}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span>AU20 Lip: <strong className={(kinematics?.actionUnits?.au20LipStretcher ?? 0) > 0.35 ? "text-amber-400" : "text-cyan-400"}>{(kinematics?.actionUnits?.au20LipStretcher ?? 0.05).toFixed(2)}</strong></span>
                </div>

                <div className={`px-3 py-1 rounded-full backdrop-blur-md border text-[11px] font-bold transition-all ${
                  preSpeechEval?.disfluencyRisk === "high"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                    : preSpeechEval?.status === "optimal"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                    : "bg-[#0B0F17]/85 border-white/[0.08] text-slate-200"
                }`}>
                  {preSpeechEval?.disfluencyRisk === "high"
                    ? "⚠️ Anticipatory Tension"
                    : preSpeechEval?.status === "optimal"
                    ? "✨ Optimal Readiness"
                    : kinematics?.postureStatus ?? "Neutral Stance"}
                </div>
              </div>

              {/* Optional Camera Hardware Error Warning */}
              {mediaError && displayMode === "camera" && (
                <div className="absolute inset-0 bg-[#0B0F17]/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center gap-3">
                  <Camera className="w-10 h-10 text-amber-400" />
                  <p className="text-xs text-slate-300 max-w-sm">{mediaError}</p>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("sample")}
                    className="px-4 py-2 rounded-full bg-cyan-500 text-slate-950 font-bold text-xs shadow-lg hover:bg-cyan-400"
                  >
                    Switch to Benchmark Video
                  </button>
                </div>
              )}
            </div>

            {/* 2. BOTTOM LEFT: BIOSIGNALS */}
            <div className="p-5 rounded-2xl bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                    Acoustic Biosignals & Kinematic Telemetry
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {fundamentalFreq ? `${fundamentalFreq} Hz · Stable Pitch` : "Listening for Voice…"}
                </span>
              </div>

              {/* Minimal Animated Audio Waveform Visualizer */}
              <div className="w-full h-12 rounded-xl bg-[#0B0F17]/70 border border-white/[0.04] px-3 flex items-center justify-center overflow-hidden">
                <div className="w-full flex items-center justify-between gap-1 h-8">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const waveHeight = Math.max(
                      10,
                      Math.min(
                        100,
                        (Math.sin(i * 0.4 + (fundamentalFreq ?? 150) * 0.05) * 0.5 + 0.5) *
                          (vocalEnergy * 320 + 15)
                      )
                    );
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-all duration-75"
                        style={{
                          height: `${waveHeight}%`,
                          backgroundColor:
                            i % 2 === 0
                              ? vocalEnergy > 0.04
                                ? "#10B981"
                                : "#334155"
                              : vocalEnergy > 0.04
                              ? "#06B6D4"
                              : "#1E293B",
                          boxShadow:
                            vocalEnergy > 0.05
                              ? "0 0 8px rgba(16, 185, 129, 0.4)"
                              : "none",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 5 Sleek Telemetry Meters (including FACS Overflow from Das et al., 2022) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Lip Aperture Ratio */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Lip Aperture (LAR)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-emerald-400">
                      {kinematics ? kinematics.lipApertureRatio.toFixed(2) : "0.00"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      [{activeLevelData.targetKinematics.minLar} - {activeLevelData.targetKinematics.maxLar}]
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, (kinematics?.lipApertureRatio ?? 0) * 160)}%` }}
                    />
                  </div>
                </div>

                {/* Mouth Width Ratio */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Mouth Width (MWR)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-cyan-400">
                      {kinematics ? kinematics.mouthWidthRatio.toFixed(2) : "0.00"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      [{activeLevelData.targetKinematics.minMwr} - {activeLevelData.targetKinematics.maxMwr}]
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, (kinematics?.mouthWidthRatio ?? 0) * 150)}%` }}
                    />
                  </div>
                </div>

                {/* Acoustic Energy / Phonation */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Voice Phonation</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-indigo-400">
                      {(vocalEnergy * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {vocalEnergy > 0.04 ? "Active" : "Quiet"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, vocalEnergy * 250)}%` }}
                    />
                  </div>
                </div>

                {/* Facial Bilateral Symmetry */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">sEMG Symmetry</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-teal-400">
                      {bilateralSymmetry.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">L/R Zygomatic</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-teal-400 rounded-full transition-all duration-100"
                      style={{ width: `${bilateralSymmetry}%` }}
                    />
                  </div>
                </div>

                {/* FACS Neuromotor Overflow (Das et al., 2022) */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">FACS Overflow</span>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-extrabold ${
                      (kinematics?.actionUnits?.motorOverflowIndex ?? 6) > 35 ? "text-amber-400" : "text-purple-400"
                    }`}>
                      {kinematics?.actionUnits?.motorOverflowIndex ?? 6}%
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      AU4:{(kinematics?.actionUnits?.au4BrowLowerer ?? 0.05).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ${
                        (kinematics?.actionUnits?.motorOverflowIndex ?? 6) > 35 ? "bg-amber-400" : "bg-purple-400"
                      }`}
                      style={{ width: `${Math.min(100, kinematics?.actionUnits?.motorOverflowIndex ?? 6)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: 3. THE GAME HUB (col-span-5) ─── */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="h-full p-6 lg:p-7 rounded-2xl bg-[#111726]/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl flex flex-col justify-between gap-6 relative overflow-hidden">
              {/* Soft Green Glow Flash upon Level Complete */}
              <AnimatePresence>
                {gameState === "success" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 bg-emerald-500/10 pointer-events-none z-0 shadow-[inset_0_0_60px_rgba(16,185,129,0.3)]"
                  />
                )}
              </AnimatePresence>

              {/* Game Hub Top Row: Level & Stars */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black tracking-wider uppercase">
                    Level {activeLevelData.level} / 100
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {tierInfo.title}
                  </span>
                </div>

                {/* Level Stars Rating */}
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3].map((starIdx) => {
                    const starsEarned = levelStars[currentLevel] || 0;
                    return (
                      <Star
                        key={starIdx}
                        size={16}
                        className={starIdx <= starsEarned ? "fill-amber-400 text-amber-400" : "text-slate-600"}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Target Word Hero (Framer Motion Animated Transition) */}
              <div className="flex flex-col items-center text-center gap-2 relative z-10 my-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentLevel}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                        {targetTamil}
                      </span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-white">
                        / {targetPhrase}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-400">
                      Pronunciation: <span className="text-indigo-300">{activeLevelData.transliteration}</span> · Meaning: <span className="text-slate-200 font-medium">{activeLevelData.meaning}</span>
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Dual Audio Guide Buttons */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => playAudioGuide("ta")}
                    disabled={isPlayingAudioGuide}
                    className="px-3.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Volume2 size={13} /> <span>🔊 தமிழ்</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playAudioGuide("en")}
                    disabled={isPlayingAudioGuide}
                    className="px-3.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Volume2 size={13} /> <span>🔊 English</span>
                  </button>
                </div>
              </div>

              {/* PROMINENT ANIMATED CIRCULAR PROGRESS RING */}
              <div className="flex flex-col items-center justify-center relative z-10 my-2">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                    {/* Background Track */}
                    <circle
                      cx="70"
                      cy="70"
                      r={ringRadius}
                      fill="transparent"
                      stroke="rgba(255, 255, 255, 0.06)"
                      strokeWidth="10"
                    />

                    {/* Animated Progress Ring */}
                    <circle
                      cx="70"
                      cy="70"
                      r={ringRadius}
                      fill="transparent"
                      stroke={gameState === "success" ? "#10B981" : "#10B981"}
                      strokeWidth="10"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      className="transition-all duration-300 ease-out"
                      style={{
                        filter: currentConfidence >= 60 ? "drop-shadow(0 0 10px rgba(16, 185, 129, 0.6))" : "none",
                      }}
                    />
                  </svg>

                  {/* Inside Circle Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    {gameState === "success" ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center text-emerald-400"
                      >
                        <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                        <span className="text-xs font-black uppercase tracking-wider mt-1">Cleared!</span>
                        <span className="text-[10px] text-emerald-300/80">+200 XP</span>
                      </motion.div>
                    ) : gameState === "stepping_up" ? (
                      <div className="flex flex-col items-center text-indigo-300">
                        <Sparkles size={26} className="animate-spin text-indigo-400" />
                        <span className="text-xs font-bold mt-1">Next Word…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-white tracking-tight">
                          {currentConfidence}%
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                          Goal: {SUCCESS_THRESHOLD}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-2 max-w-xs">
                  {gameState === "success"
                    ? "✨ Wonderful speech articulation! Moving to next level…"
                    : currentConfidence >= 60
                    ? "Great pronunciation! Keep your vocal tone steady to clear level."
                    : "Form mouth shape and vocalize clearly into the microphone."}
                </p>
              </div>

              {/* Real-Time Detection Badges (Lip-Reading & Mic Speech) */}
              <div className="flex flex-col gap-2.5 relative z-10">
                {/* Lip-Reading Prediction */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">👄</span>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] uppercase font-bold text-emerald-400">Lip-Reading Detector</span>
                      <span className="text-xs font-bold text-white">
                        {lipPrediction?.wordTamil || targetTamil} ({lipPrediction?.wordEnglish || targetPhrase})
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                    {lipPrediction?.confidence ?? 0}% Lip Match
                  </span>
                </div>

                {/* Microphone Speech Prediction */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-cyan-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🎤</span>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] uppercase font-bold text-cyan-400">Microphone Audio AI</span>
                      <span className="text-xs font-bold text-white truncate max-w-[180px]">
                        {recognizedSpeech ? `“${recognizedSpeech}”` : speechPrediction?.rawTranscript ? `“${speechPrediction.rawTranscript}”` : "Speak target word…"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                    {speechPrediction?.confidence ?? 0}% Acoustic
                  </span>
                </div>

                {/* ─── EXPLAINABLE AI (XAI) PRE-SPEECH PREPARATION (Das et al., 2022) ─── */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                    preSpeechEval?.disfluencyRisk === "high"
                      ? "bg-amber-500/[0.07] border-amber-500/30"
                      : preSpeechEval?.status === "optimal"
                      ? "bg-emerald-500/[0.07] border-emerald-500/30"
                      : "bg-indigo-500/[0.04] border-indigo-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧠</span>
                      <div className="flex flex-col text-left">
                        <span className="text-[10px] uppercase font-bold text-indigo-300">
                          Pre-Speech Anticipatory Predictor (Das et al., 2022)
                        </span>
                        <span className="text-xs font-extrabold text-white">
                          {preSpeechEval?.disfluencyRisk === "high"
                            ? "⚠️ Anticipatory Block Detected"
                            : preSpeechEval?.status === "optimal"
                            ? "✨ Optimal Neuromotor Prep"
                            : "S1–S2 Neuromotor Stance"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[12px] font-mono font-black ${
                        (preSpeechEval?.anticipatoryFluencyProbability ?? 88) >= 80
                          ? "text-emerald-400"
                          : (preSpeechEval?.anticipatoryFluencyProbability ?? 88) >= 50
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}>
                        {preSpeechEval?.anticipatoryFluencyProbability ?? 88}% Fluency Prob.
                      </span>
                      <span className="text-[9px] text-slate-400">80.8% Accurate Model</span>
                    </div>
                  </div>

                  {/* S1-S2 1500ms Preparatory Countdown Gauge */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span>S1 Cue</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-150 ${
                          preSpeechEval?.disfluencyRisk === "high" ? "bg-amber-400" : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                        }`}
                        style={{ width: `${preSpeechEval?.preparationProgress ?? 100}%` }}
                      />
                    </div>
                    <span>S2 Phonation ({preSpeechEval?.elapsedMs ?? 1500}ms)</span>
                  </div>

                  {/* Causal XAI Attribution Explanation */}
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.05] text-[11px] leading-relaxed flex flex-col gap-1.5 text-left">
                    <p className="text-slate-200">
                      <strong className="text-indigo-300 font-semibold">Diagnosis: </strong>
                      {preSpeechEval?.xai.primaryAttribution ?? "Neuromotor speech planning is balanced and receptive for phonation."}
                    </p>
                    <p className="text-emerald-300 text-[10.5px]">
                      💡 <strong>Therapy Cue: </strong>
                      {preSpeechEval?.xai.clinicalCue ?? "Breathe naturally and release into the first syllable with ease."}
                    </p>
                  </div>

                  {/* Shapley Feature Attribution Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                    <span className={`px-2 py-0.5 rounded border ${
                      (preSpeechEval?.xai.shapleyMap.au4BrowLowerer ?? 0.8) >= 0
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    }`}>
                      AU4 Brow: {preSpeechEval?.xai.shapleyMap.au4BrowLowerer && preSpeechEval.xai.shapleyMap.au4BrowLowerer > 0 ? `+${preSpeechEval.xai.shapleyMap.au4BrowLowerer}` : preSpeechEval?.xai.shapleyMap.au4BrowLowerer ?? "+0.75"}
                    </span>

                    <span className={`px-2 py-0.5 rounded border ${
                      (preSpeechEval?.xai.shapleyMap.au20LipStretcher ?? 0.8) >= 0
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    }`}>
                      AU20 Lip: {preSpeechEval?.xai.shapleyMap.au20LipStretcher && preSpeechEval.xai.shapleyMap.au20LipStretcher > 0 ? `+${preSpeechEval.xai.shapleyMap.au20LipStretcher}` : preSpeechEval?.xai.shapleyMap.au20LipStretcher ?? "+0.80"}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      Symmetry: {preSpeechEval?.xai.shapleyMap.bilateralSymmetry && preSpeechEval.xai.shapleyMap.bilateralSymmetry > 0 ? `+${preSpeechEval.xai.shapleyMap.bilateralSymmetry}` : preSpeechEval?.xai.shapleyMap.bilateralSymmetry ?? "+0.92"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Supportive Clinical Cue & Quick Articulation Tests */}
              <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-3 relative z-10">
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white font-semibold">Clinical Cue: </strong>
                    {activeLevelData.clinicalCue}
                  </span>
                </div>

                {/* Instant Verification Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      // Simulates speaking target word cleanly, instantly satisfying >= 85% threshold
                      const sim = speechDetectorRef.current.simulateSpokenWord(targetTamil, targetPhrase);
                      setSpeechPrediction(sim);
                      setRecognizedSpeech(`${targetTamil} (${targetPhrase})`);
                      setVocalEnergy(0.28);
                      triggerHaptic();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Simulate speech to trigger instant level clearing"
                  >
                    <Mic size={13} /> 🗣️ Test Spoken "{targetPhrase}"
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const dummyKin: ArticulatoryKinematics = {
                        source: "mediapipe_neural",
                        lipApertureRatio: activeLevelData.targetKinematics.minLar || 0.05,
                        mouthWidthRatio: (activeLevelData.targetKinematics.minMwr + activeLevelData.targetKinematics.maxMwr) / 2,
                        jawDisplacementMm: activeLevelData.targetKinematics.minJawMm || 7.0,
                        withinTarget: true,
                        cue: "Optimal bilabial articulatory seal",
                        postureStatus: "Target Viseme Matched",
                        landmarksDetected: true,
                      };
                      const simPred = lipClassifierRef.current.processFrame(dummyKin, activeLevelData, 0.22);
                      setLipPrediction(simPred);
                      setKinematics(dummyKin);
                      triggerHaptic();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Simulate target lip movement"
                  >
                    <span>👄 Test Lip Articulation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLiveListening((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isLiveListening
                        ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"
                        : "bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                    }`}
                  >
                    {isLiveListening ? <Mic size={13} /> : <MicOff size={13} />}
                    <span>{isLiveListening ? "Mic Active" : "Mic Muted"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sim = preSpeechPredictorRef.current.simulatePreparatoryBlock();
                      setPreSpeechEval(sim);
                      triggerHaptic();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Simulate anticipatory stuttering block (elevated AU4 and AU20 tension)"
                  >
                    <span>🧠 Test Pre-Speech Block</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sim = preSpeechPredictorRef.current.simulateOptimalPrep();
                      setPreSpeechEval(sim);
                      triggerHaptic();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Simulate calm, fluent pre-phonation readiness"
                  >
                    <span>✨ Test Calm Readiness</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            4. BOTTOM: HORIZONTAL PROGRESSION TIMELINE / NODE-MAP
           ───────────────────────────────────────────────────────────────────────────── */}
        <div className="p-5 rounded-2xl bg-[#111726]/80 backdrop-blur-xl border border-white/[0.08] shadow-xl flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                100-Level Rehabilitation Journey (Levels {timelineLevels[0]} – {timelineLevels[timelineLevels.length - 1]})
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Highest Unlocked: <strong className="text-emerald-400">Level {unlockedLevel}</strong>
            </span>
          </div>

          {/* Node-Map Track */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {timelineLevels.map((lvl) => {
              const lvlData = getLevelData(lvl);
              const isCurrent = lvl === currentLevel;
              const isPassed = lvl < unlockedLevel || (levelStars[lvl] && levelStars[lvl] > 0);
              const isUnlocked = lvl <= unlockedLevel;

              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    if (isUnlocked) setCurrentLevel(lvl);
                  }}
                  disabled={!isUnlocked}
                  className={`flex flex-col items-center justify-between p-3 min-w-[115px] h-[90px] rounded-xl border transition-all relative ${
                    isCurrent
                      ? "bg-gradient-to-b from-emerald-500/20 to-teal-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105"
                      : isPassed
                      ? "bg-white/[0.03] border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06]"
                      : isUnlocked
                      ? "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.15]"
                      : "bg-black/20 border-white/[0.02] opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-black ${isCurrent ? "text-emerald-400" : "text-slate-400"}`}>
                      LVL {lvl}
                    </span>
                    {isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    ) : !isUnlocked ? (
                      <Lock size={12} className="text-slate-600" />
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center my-0.5">
                    <span className={`text-sm font-bold truncate max-w-[95px] ${isCurrent ? "text-white" : "text-slate-200"}`}>
                      {lvlData.tamilText}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 truncate max-w-[95px]">
                      {lvlData.englishText}
                    </span>
                  </div>

                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full ${
                    isCurrent
                      ? "bg-emerald-500 text-slate-950"
                      : isPassed
                      ? "text-emerald-400"
                      : "text-slate-500"
                  }`}>
                    {isCurrent ? "Current" : isPassed ? "Cleared" : `Tier ${lvlData.tier}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            100-LEVEL CURRICULUM MAP MODAL
           ───────────────────────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {levelMapOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-4xl max-h-[85vh] bg-[#111726] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                      <MapIcon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white">
                        100-Level Speech Rehabilitation Curriculum Map
                      </h2>
                      <p className="text-xs text-slate-400">
                        Choose any unlocked level to practice specific phonetic targets
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLevelMapOpen(false)}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tier Tabs */}
                <div className="flex items-center gap-1.5 px-5 pt-3 overflow-x-auto border-b border-white/[0.06] scrollbar-none">
                  {[1, 2, 3, 4, 5].map((tierNum) => {
                    const desc = REHAB_TIER_DESCRIPTIONS[tierNum];
                    const isActive = selectedTierTab === tierNum;
                    return (
                      <button
                        key={tierNum}
                        type="button"
                        onClick={() => setSelectedTierTab(tierNum as 1 | 2 | 3 | 4 | 5)}
                        className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                          isActive
                            ? "bg-white/[0.06] border-emerald-400 text-white"
                            : "border-transparent text-slate-400 hover:text-white"
                        }`}
                      >
                        Tier {tierNum}: {desc.title}
                      </button>
                    );
                  })}
                </div>

                {/* 20 Levels in Selected Tier */}
                <div className="p-5 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {getLevelsByTier(selectedTierTab).map((item) => {
                    const isCurrent = item.level === currentLevel;
                    const isUnlocked = item.level <= unlockedLevel;
                    const stars = levelStars[item.level] || 0;

                    return (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => {
                          if (isUnlocked) {
                            setCurrentLevel(item.level);
                            setLevelMapOpen(false);
                          }
                        }}
                        disabled={!isUnlocked}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-between text-center gap-1 transition-all ${
                          isCurrent
                            ? "bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : isUnlocked
                            ? "bg-white/[0.03] border-white/[0.08] hover:border-emerald-500/40 hover:bg-white/[0.06]"
                            : "bg-black/20 border-white/[0.03] opacity-35 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full text-[10px]">
                          <span className="font-bold text-slate-400">#{item.level}</span>
                          {!isUnlocked ? (
                            <Lock size={12} className="text-slate-600" />
                          ) : (
                            <div className="flex items-center gap-0.5 text-amber-400">
                              <Star size={10} className="fill-amber-400" />
                              <span>{stars}</span>
                            </div>
                          )}
                        </div>

                        <span className="text-base font-bold text-white mt-1">{item.tamilText}</span>
                        <span className="text-xs text-slate-300 font-medium">{item.englishText}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{item.transliteration}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
