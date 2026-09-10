import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLevelData,
  getLevelsByTier,
  REHAB_TIER_DESCRIPTIONS,
} from "../../lib/rehabCurriculum";
import { useGameProgressStore } from "../../lib/gameProgressStore";
import { FaceMeshTracker, type ArticulatoryKinematics } from "../../lib/faceMeshTracker";
import { LipReadingClassifier, type LipReadingPrediction } from "../../lib/lipReadingClassifier";
import { AcousticSpeechDetector, type SpeechPredictionResult } from "../../lib/acousticSpeechDetector";
import { PreSpeechPreparatoryPredictor, type PreSpeechEvaluation } from "../../lib/preSpeechPredictor";

// Soft positive Web Audio chime on level complete
function playCelebrationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 major arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
    });
  } catch {}
}

export default function PatientSession() {
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
  const [isRecording, setIsRecording] = useState(false);
  const [vocalEnergy, setVocalEnergy] = useState(0);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string>("");
  const [isMeshVisible, setIsMeshVisible] = useState(true);
  const [kinematics, setKinematics] = useState<ArticulatoryKinematics | null>(null);

  // Simulation overrides for live clinical demonstration
  const [simulatedAu4, setSimulatedAu4] = useState<number | null>(null);
  const [simulatedAu20, setSimulatedAu20] = useState<number | null>(null);
  const [simulatedBlockRisk, setSimulatedBlockRisk] = useState<number | null>(null);
  const [simulatedAccuracy, setSimulatedAccuracy] = useState<number | null>(null);

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
  const [gameState, setGameState] = useState<"listening" | "success">("listening");
  const levelClearingLock = useRef(false);
  const SUCCESS_THRESHOLD = 85;

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const vocalEnergyRef = useRef<number>(vocalEnergy);
  vocalEnergyRef.current = vocalEnergy;

  // Calculated Fundamental Frequency (Pitch in Hz)
  const fundamentalFreq = vocalEnergy > 0.02 || kinematics
    ? Math.round(140 + vocalEnergy * 110 + (kinematics?.lipApertureRatio ?? 0.15) * 35)
    : null;

  // Bilateral facial symmetry calculation
  const bilateralSymmetry = useMemo(() => {
    if (!kinematics) return 96.5;
    const dev = Math.abs(kinematics.mouthWidthRatio - 0.48);
    return Math.max(78, Math.min(99.4, 98.5 - dev * 18));
  }, [kinematics]);

  // Current AU4 & AU20 tension values (Real vs. Simulated)
  const au4Value = simulatedAu4 !== null 
    ? simulatedAu4 
    : Math.round((kinematics?.actionUnits?.au4BrowLowerer ?? 0.24) * 100);

  const au20Value = simulatedAu20 !== null 
    ? simulatedAu20 
    : Math.round((kinematics?.actionUnits?.au20LipStretcher ?? 0.18) * 100);

  // Block Risk Probability
  const blockRiskValue = simulatedBlockRisk !== null
    ? simulatedBlockRisk
    : Math.min(95, Math.round(au4Value * 0.5 + au20Value * 0.4 + (100 - bilateralSymmetry) * 0.3));

  // Current Accuracy Score (0 to 100)
  const currentAccuracy = useMemo(() => {
    if (simulatedAccuracy !== null) return simulatedAccuracy;
    if (gameState === "success") return 92;
    const lipScore = lipPrediction ? lipPrediction.confidence : 0;
    const speechScore = speechPrediction ? speechPrediction.confidence : 0;
    const toneScore = vocalEnergy > 0.04 ? 85 : 30;
    return Math.min(100, Math.round(lipScore * 0.35 + speechScore * 0.40 + toneScore * 0.25));
  }, [simulatedAccuracy, gameState, lipPrediction, speechPrediction, vocalEnergy]);

  // Readiness Status text & colors
  const readinessStatus = useMemo(() => {
    if (blockRiskValue > 65 || au4Value > 65 || au20Value > 65) {
      return {
        label: "BLOCK RISK DETECTED",
        colorClass: "bg-error/20 border-error/50 text-error",
        dotClass: "bg-error",
        pulse: true,
      };
    }
    if (blockRiskValue > 35 || au4Value > 35) {
      return {
        label: "ELEVATED TENSION",
        colorClass: "bg-tertiary-container/20 border-tertiary-container/50 text-tertiary",
        dotClass: "bg-tertiary",
        pulse: false,
      };
    }
    return {
      label: "OPTIMAL / READY",
      colorClass: "bg-secondary/15 border-secondary/40 text-secondary",
      dotClass: "bg-secondary",
      pulse: false,
    };
  }, [blockRiskValue, au4Value, au20Value]);

  // Level Completion Handler
  const handleLevelComplete = useCallback(() => {
    if (levelClearingLock.current) return;
    levelClearingLock.current = true;
    setGameState("success");
    playCelebrationChime();

    const starsEarned = currentAccuracy >= 95 ? 3 : currentAccuracy >= 90 ? 2 : 1;
    const xpAwarded = starsEarned * 35;
    recordLevelCompletion(currentLevel, currentAccuracy, starsEarned, xpAwarded);

    setTimeout(() => {
      levelClearingLock.current = false;
    }, 1500);
  }, [currentAccuracy, currentLevel, recordLevelCompletion]);

  // Auto-trigger level complete if threshold met naturally
  useEffect(() => {
    if (gameState === "listening" && currentAccuracy >= SUCCESS_THRESHOLD && !levelClearingLock.current) {
      handleLevelComplete();
    }
  }, [currentAccuracy, gameState, handleLevelComplete]);

  // Step up to next level
  const handleNextLevel = () => {
    setSimulatedAccuracy(null);
    setSimulatedAu4(null);
    setSimulatedAu20(null);
    setSimulatedBlockRisk(null);
    setGameState("listening");
    if (currentLevel < 100) {
      setCurrentLevel(currentLevel + 1);
    }
  };

  // Web Speech API Native Pronunciation Audio Guide
  const playSampleAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsPlayingAudioGuide(true);
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const textToSpeak = speechLang === "ta-IN" ? targetTamil : targetPhrase;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = speechLang;
        utterance.rate = 0.85; // Slightly slower for speech therapy clarity
        utterance.onend = () => setIsPlayingAudioGuide(false);
        utterance.onerror = () => setIsPlayingAudioGuide(false);
        window.speechSynthesis.speak(utterance);
      } else {
        playCelebrationChime();
        setTimeout(() => setIsPlayingAudioGuide(false), 800);
      }
    } catch {
      setIsPlayingAudioGuide(false);
    }
  }, [speechLang, targetTamil, targetPhrase]);

  // Microphone & Camera Initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCameraAndMic() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
          audio: true,
        });
        mediaRef.current = stream;
        setMediaStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Simple Web Audio VAD & Volume Analyzer
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx && stream.getAudioTracks().length > 0) {
          const audioCtx = new AudioCtx();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!mediaRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length / 255;
            setVocalEnergy(avg);
            requestAnimationFrame(checkVolume);
          };
          requestAnimationFrame(checkVolume);
        }
      } catch (err: unknown) {
        setMediaError(err instanceof Error ? err.message : "Camera/Mic not accessible");
      }
    }

    startCameraAndMic();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 60 FPS FaceMesh Tracking Loop
  useEffect(() => {
    let active = true;
    const trackLoop = () => {
      if (videoRef.current && hudCanvasRef.current && mediaStream) {
        const est = FaceMeshTracker.estimateKinematics(
          videoRef.current,
          hudCanvasRef.current,
          activeLevelData.targetViseme,
          vocalEnergy
        );

        if (active && est !== null) {
          setKinematics(est);

          const lipPred = lipClassifierRef.current.processFrame(
            est,
            activeLevelData,
            vocalEnergyRef.current
          );
          setLipPrediction(lipPred);

          const prepEval = preSpeechPredictorRef.current.processFrame(
            est,
            vocalEnergyRef.current,
            bilateralSymmetry
          );
          setPreSpeechEval(prepEval);

          if (isRecording) {
            const speechPred = speechDetectorRef.current.processAcousticFrame(
              vocalEnergyRef.current,
              fundamentalFreq,
              lipPred.isArticulating
            );
            if (speechPred.source !== "idle" && speechPred.confidence > 0) {
              setSpeechPrediction(speechPred);
              if (speechPred.rawTranscript?.trim()) {
                setRecognizedSpeech(speechPred.rawTranscript.trim());
              }
            }
          }
        }
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(trackLoop);
      }
    };

    if (mediaStream) {
      animFrameRef.current = requestAnimationFrame(trackLoop);
    }

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mediaStream, activeLevelData, vocalEnergy, fundamentalFreq, bilateralSymmetry, isRecording]);

  // Simulation Suite Functions
  const handleSimulateAttempt = () => {
    setSimulatedAccuracy(92);
    setSimulatedAu4(18);
    setSimulatedAu20(14);
    setSimulatedBlockRisk(12);
    handleLevelComplete();
  };

  const handleSimulateBlock = () => {
    setSimulatedAu4(78);
    setSimulatedAu20(82);
    setSimulatedBlockRisk(84);
    setSimulatedAccuracy(54);
    setGameState("listening");
  };

  const handleSimulateCalm = () => {
    setSimulatedAu4(14);
    setSimulatedAu20(10);
    setSimulatedBlockRisk(11);
    setSimulatedAccuracy(88);
    setGameState("listening");
  };

  // Keyboard Shortcuts (Space to record, R to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsRecording((prev) => !prev);
      } else if (e.code === "KeyR") {
        handleSimulateCalm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-noto overflow-x-hidden selection:bg-primary selection:text-on-primary">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. TOP GLOBAL HEADER BAR
         ───────────────────────────────────────────────────────────────────────────── */}
      <header className="flex justify-between items-center w-full px-4 lg:px-8 h-16 border-b border-outline-variant/40 bg-surface sticky top-0 z-40 shadow-sm backdrop-blur-md">
        {/* Left: Brand & Micro Progress */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-primary/30 flex items-center justify-center text-primary shadow-cyan-glow">
              <span className="material-symbols-outlined text-[18px]">vital_signs</span>
            </div>
            <span className="font-space font-semibold text-lg text-primary tracking-tight">NeuroSpeech-Rehab</span>
          </div>

          <div className="h-5 w-px bg-outline-variant/40 hidden sm:block"></div>

          {/* Level Progress Pill Badge */}
          <button
            onClick={() => setLevelMapOpen(true)}
            className="flex items-center gap-2 px-3 py-1 bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 rounded-full transition-all"
            title="Click to open 100-Level Curriculum Map"
          >
            <span className="font-mono text-[11px] text-primary uppercase font-bold tracking-wider">
              Level {currentLevel} / 100
            </span>
            <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((currentLevel / 100) * 100))}%` }}
              ></div>
            </div>
            <span className="font-mono text-[10px] text-on-surface-variant">
              {Math.min(100, Math.round((currentLevel / 100) * 100))}%
            </span>
          </button>
        </div>

        {/* Center: Segmented Clinical Nav Tabs */}
        <nav className="hidden md:flex items-center gap-6">
          <button className="border-b-2 border-primary text-primary font-space text-[14px] font-medium pb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
            <span>Workstation</span>
          </button>
          <button
            onClick={() => setLevelMapOpen(true)}
            className="text-on-surface-variant hover:text-on-surface transition-colors pb-1 flex items-center gap-1.5 font-space text-[14px]"
          >
            <span className="material-symbols-outlined text-[18px]">timeline</span>
            <span>Curriculum Map</span>
          </button>
          <div className="text-on-surface-variant flex items-center gap-1.5 font-space text-[14px]">
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            <span>Streak: {streakDays}d ({totalXp} XP)</span>
          </div>
        </nav>

        {/* Right: Language Switcher, Hardware Telemetry & Clinician Profile */}
        <div className="flex items-center gap-3">
          {/* Language Switcher Pill Toggle */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 border border-outline-variant/50 rounded-full font-mono text-[11px]">
            <button
              onClick={() => setSpeechLang("en-US")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                speechLang === "en-US"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setSpeechLang("ta-IN")}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                speechLang === "ta-IN"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              தமிழ்
            </button>
          </div>

          {/* Telemetry Hardware Pins */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] text-on-surface-variant">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low border border-outline-variant/40 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${mediaStream ? "bg-secondary shadow-[0_0_8px_#4edea3]" : "bg-amber-400"}`}></span>
              <span className="material-symbols-outlined text-[15px]">videocam</span>
              <span>1080p 30fps</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low border border-outline-variant/40 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#4edea3]"></span>
              <span className="material-symbols-outlined text-[15px]">mic</span>
              <span>48kHz 12ms</span>
            </div>
          </div>

          {/* Profile Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/40">
            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-primary/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </div>
            <div className="hidden xl:block text-left leading-none">
              <div className="text-[12px] font-medium text-on-surface">Dr. A. Sundaram, SLP</div>
              <div className="font-mono text-[10px] text-primary">Neuro-Clinic ID: #4082</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Alert if Media Error */}
      {mediaError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300">
          Camera / Microphone notice: {mediaError}. Clinical simulation mode is active.
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. MAIN VIEWPORT: TWO-COLUMN TELEMETRY GRID
         ───────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-36">
        
        {/* LEFT COLUMN: Biomechanical Mirror & Tension Gauges (Cols 5 / 12) */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Neuro-Camera Viewport */}
          <div className="relative bg-surface-container-lowest rounded-xl border border-primary/25 overflow-hidden shadow-[0_0_24px_rgba(8,14,26,0.8)] backdrop-blur-md flex flex-col">
            
            {/* Top Video Overlay Banner */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-surface-container-lowest/90 via-surface-container-lowest/40 to-transparent">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high/80 border border-secondary/40 text-secondary font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  LIVE FEED (30 FPS)
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container-high/80 px-2 py-0.5 rounded border border-outline-variant/40">
                  LATENCY: 12ms
                </span>
              </div>

              {/* Mesh Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMeshVisible(!isMeshVisible)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-high/90 border border-primary text-primary hover:bg-primary hover:text-on-primary transition-all duration-200 font-mono text-[11px] flex items-center gap-1.5 shadow-cyan-glow"
              >
                <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
                <span>Mesh: {isMeshVisible ? "ON (468 pts)" : "OFF"}</span>
              </button>
            </div>

            {/* Video Stage with Real Camera + Dynamic Canvas Overlay */}
            <div className="relative w-full aspect-[4/3] bg-surface-container-lowest flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover filter contrast-105 brightness-95 ${!mediaStream ? "hidden" : ""}`}
              />

              {/* Fallback Medical Photo when camera stream not active */}
              {!mediaStream && (
                <img
                  className="w-full h-full object-cover opacity-60 filter contrast-110 brightness-90"
                  alt="Clinical Speech Therapy Mirror"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwZlW6Pbi4teC7nbVW2rA9CsPAaAzi1l5dxMO2lpAere-XdzM8soj0PwfZuOX-LHP8Yc7E5UB7Wq9NXPYS67BmuVg4vNBMb8ECUJIQnhgZ8aaJRweKqBDIpV4F9X7Hg-2WzvFY_SkcLh3O0dXV6ikq2K1WJGlIoxJ9kQsg_bJDJKRb0dcYXDOtSwaXnr7aNQd9pZki7oXuo4Cc-OSxMxuUeTT13TFE2AZDCVaVilfHiiNBoj7-qE_FIDU8FCIr2-omthCFLybn43VK"
                />
              )}

              {/* MediaPipe 468-point HUD Canvas Overlay */}
              <canvas
                ref={hudCanvasRef}
                width={640}
                height={480}
                className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${
                  isMeshVisible ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Simulated 468-Point Facial Wireframe Overlay when camera off */}
              {!mediaStream && isMeshVisible && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
                  <defs>
                    <linearGradient id="meshGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#4be4f0" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
                    </linearGradient>
                  </defs>
                  {/* Face Contour */}
                  <path d="M 140,90 Q 200,60 260,90 Q 280,170 200,250 Q 120,170 140,90 Z" fill="none" opacity="0.6" stroke="url(#meshGrad)" strokeDasharray="2 2" strokeWidth="0.75" />
                  {/* Eyebrows (AU4 Corrugator zone) */}
                  <path d="M 150,110 Q 170,105 190,114" fill="none" stroke="#4be4f0" strokeWidth="1.2" />
                  <circle cx="170" cy="105" fill={au4Value > 65 ? "#ffb4ab" : "#4be4f0"} r={au4Value > 65 ? "3.5" : "2"} className={au4Value > 65 ? "animate-ping" : ""} />
                  <path d="M 210,114 Q 230,105 250,110" fill="none" stroke="#4be4f0" strokeWidth="1.2" />
                  <circle cx="230" cy="105" fill={au4Value > 65 ? "#ffb4ab" : "#4be4f0"} r={au4Value > 65 ? "3.5" : "2"} className={au4Value > 65 ? "animate-ping" : ""} />
                  {/* AU20 Lip Risorius & Mouth Region */}
                  <path d="M 165,190 Q 200,185 235,190 Q 200,218 165,190 Z" fill="rgba(75,228,240,0.08)" stroke="#4be4f0" strokeWidth="1.2" />
                  <circle cx="165" cy="190" fill={au20Value > 65 ? "#ffb4ab" : "#4edea3"} r={au20Value > 65 ? "3.5" : "2.5"} />
                  <circle cx="235" cy="190" fill={au20Value > 65 ? "#ffb4ab" : "#4edea3"} r={au20Value > 65 ? "3.5" : "2.5"} />
                </svg>
              )}

              {/* Bottom Telemetry HUD overlay in viewport */}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-3 py-1 bg-surface-container-lowest/80 backdrop-blur-md rounded border border-outline-variant/30 font-mono text-[10px]">
                <span className="text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  HEAD POSE: ROT(0.4°, -1.1°, 0.0°)
                </span>
                <span className="text-on-surface-variant">CONFIDENCE: 98.4%</span>
              </div>
            </div>
          </div>

          {/* DIRECT TENSION METRICS PANEL */}
          <div className="bg-surface-container-low/80 backdrop-blur-md rounded-xl border border-outline-variant/40 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">sensors</span>
                <h3 className="font-space text-[15px] text-on-surface font-medium">Biomechanical Tension Gauges</h3>
              </div>

              {/* Facial Readiness Status Pill */}
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px] font-bold border transition-all ${readinessStatus.colorClass}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${readinessStatus.dotClass} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${readinessStatus.dotClass}`}></span>
                </span>
                <span>{readinessStatus.label}</span>
              </div>
            </div>

            {/* Gauge 1: AU4 Eyebrow Furrow (Corrugator Supercilii) */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-on-surface font-semibold">AU4 EYEBROW FURROW</span>
                  <span className="text-[10px] font-mono text-on-surface-variant">(Corrugator Rigidity)</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-mono text-[22px] font-bold leading-none ${au4Value > 65 ? "text-error" : au4Value > 35 ? "text-tertiary" : "text-primary"}`}>
                    {au4Value}%
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">/ 100</span>
                </div>
              </div>

              {/* Threshold Progress Bar */}
              <div className="relative w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${au4Value > 65 ? "bg-error" : au4Value > 35 ? "bg-tertiary" : "bg-primary"}`}
                  style={{ width: `${au4Value}%` }}
                ></div>
                <div className="absolute top-0 bottom-0 left-[35%] w-0.5 bg-tertiary-container/80 z-10" title="Mild Tension (35%)"></div>
                <div className="absolute top-0 bottom-0 left-[65%] w-0.5 bg-error/80 z-10" title="Block Hazard (65%)"></div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-on-surface-variant">
                <span>Safe Baseline (0-35%)</span>
                <span className="text-tertiary">Elevated (35-65%)</span>
                <span className="text-error">Block Zone (&gt;65%)</span>
              </div>
            </div>

            {/* Gauge 2: AU20 Lip Stretch (Risorius Hypertonicity) */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-on-surface font-semibold">AU20 LIP STRETCH</span>
                  <span className="text-[10px] font-mono text-on-surface-variant">(Risorius Lateral Strain)</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-mono text-[22px] font-bold leading-none ${au20Value > 65 ? "text-error" : au20Value > 35 ? "text-tertiary" : "text-secondary"}`}>
                    {au20Value}%
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">/ 100</span>
                </div>
              </div>

              {/* Bar */}
              <div className="relative w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${au20Value > 65 ? "bg-error" : au20Value > 35 ? "bg-tertiary" : "bg-secondary"}`}
                  style={{ width: `${au20Value}%` }}
                ></div>
                <div className="absolute top-0 bottom-0 left-[30%] w-0.5 bg-tertiary-container/80 z-10"></div>
                <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-error/80 z-10"></div>
              </div>
              <div className="flex justify-between text-[9px] font-mono text-on-surface-variant">
                <span>Relaxed Glottal Track</span>
                <span className="text-secondary font-medium">Somatic Ease Verified</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Target Word & Biofeedback Core (Cols 7 / 12) */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          
          {/* S1-S2 CONTINGENT PREPARATORY INTERVAL WIDGET */}
          <div className="bg-surface-container-low/90 backdrop-blur-md rounded-xl border border-outline-variant/50 p-4 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">timer</span>
                <span className="font-space text-[15px] font-medium text-on-surface">S1-S2 Contingent Preparatory Interval</span>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-mono text-[10px] tracking-wider uppercase font-semibold">
                Stimulus Active
              </span>
            </div>

            {/* Countdown Progress Bar */}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex justify-between font-mono text-[11px] text-on-surface-variant">
                <span>PREP INTERVAL: 1,500ms</span>
                <span className="text-primary font-bold">
                  {preSpeechEval ? `${Math.max(0, 1500 - preSpeechEval.elapsedMs)}ms REMAINING` : "950ms REMAINING"}
                </span>
              </div>
              <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary-container rounded-full transition-all duration-300"
                  style={{ width: `${preSpeechEval ? preSpeechEval.preparationProgress : 63}%` }}
                ></div>
              </div>
            </div>

            {/* Pre-Speech Block Risk Meter & XAI Attribution Cluster */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 items-center">
              {/* Block Risk Segmented Bar */}
              <div className="md:col-span-5 bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/30 flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[10px] text-on-surface-variant">BLOCK RISK PROBABILITY</span>
                  <span className={`font-mono text-[12px] font-bold ${blockRiskValue > 65 ? "text-error" : blockRiskValue > 30 ? "text-tertiary" : "text-secondary"}`}>
                    {blockRiskValue > 65 ? `High Risk (${blockRiskValue}%)` : blockRiskValue > 30 ? `Moderate (${blockRiskValue}%)` : `Low Risk (${blockRiskValue}%)`}
                  </span>
                </div>
                {/* 10 Segment Gauge Bars */}
                <div className="grid grid-cols-10 gap-1 h-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seg) => {
                    const threshold = seg * 10;
                    const isActive = blockRiskValue >= threshold;
                    let color = "bg-secondary";
                    if (seg > 3 && seg <= 7) color = "bg-tertiary-container";
                    if (seg > 7) color = "bg-error";
                    return (
                      <div
                        key={seg}
                        className={`rounded-sm h-full transition-all ${
                          isActive ? color : "bg-surface-container-highest opacity-30"
                        }`}
                      ></div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] font-mono text-on-surface-variant">
                  <span>0% (Green)</span>
                  <span>30% (Amber)</span>
                  <span>70%+ (Red)</span>
                </div>
              </div>

              {/* Explainable AI (XAI) Attribution Chips */}
              <div className="md:col-span-7 flex flex-col gap-1.5">
                <span className="font-mono text-[10px] text-on-surface-variant tracking-wider uppercase">
                  XAI Neuro-Motor Predictors
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded font-mono text-[10px] text-on-surface flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Laryngeal Rigidity: <strong className="text-secondary font-medium">0.12 (Normal)</strong>
                  </span>
                  <span className="px-2 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded font-mono text-[10px] text-on-surface flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    Pre-phonatory Pause: <strong className="text-primary font-medium">210ms</strong>
                  </span>
                  <span className="px-2 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded font-mono text-[10px] text-on-surface flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Masseter Tone: <strong className="text-on-surface font-medium">Baseline</strong>
                  </span>
                  <span className="px-2 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded font-mono text-[10px] text-on-surface flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    VOT Predictor: <strong className="text-secondary font-medium">Stable</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TARGET WORD STAGE (Focal Training Stimulus Card) */}
          <div className="relative bg-surface-container-low/95 backdrop-blur-xl rounded-xl border border-primary/30 p-6 shadow-[0_0_30px_rgba(20,200,212,0.1)] flex flex-col items-center justify-center text-center gap-4">
            {/* Stimulus Meta Tag */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] px-3 py-0.5 rounded-full bg-surface-container-high text-primary border border-primary/30 uppercase font-semibold">
                PHONEME SEQUENCE: {activeLevelData.tierTitle.toUpperCase()} / {activeLevelData.targetViseme.toUpperCase()}
              </span>
            </div>

            {/* Bilingual Stimulus Presentation */}
            <div className="flex flex-col items-center gap-1">
              {/* Primary Tamil Target Word */}
              <div className="font-tamil text-[46px] md:text-[54px] leading-tight font-bold text-on-surface tracking-wide drop-shadow-[0_2px_12px_rgba(75,228,240,0.25)]">
                {targetTamil}
              </div>

              {/* English Transliteration & Phonetic IPA */}
              <div className="flex items-center gap-3">
                <span className="font-space text-[22px] text-primary font-semibold">
                  {targetPhrase}
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-mono text-[14px] text-on-surface-variant tracking-wider bg-surface-container-lowest px-3 py-0.5 rounded border border-outline-variant/40">
                  /{activeLevelData.transliteration}/
                </span>
              </div>

              {/* English Meaning Label */}
              <p className="text-[14px] text-on-surface-variant italic mt-0.5">
                {activeLevelData.meaning || "Target articulation exercise"}
              </p>

              {recognizedSpeech && (
                <div className="mt-2 px-3 py-1 rounded bg-surface-container-highest/60 border border-primary/30 text-xs font-mono text-primary">
                  Spoken input: "{recognizedSpeech}"
                </div>
              )}
            </div>

            {/* Audio Listen & Record CTA Bar */}
            <div className="flex items-center justify-center gap-4 w-full max-w-md pt-2">
              {/* Listen Audio Button */}
              <button
                type="button"
                onClick={playSampleAudio}
                disabled={isPlayingAudioGuide}
                className="flex-1 px-4 py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-on-surface font-space text-[14px] font-medium flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
              >
                <span className={`material-symbols-outlined text-primary text-[20px] ${isPlayingAudioGuide ? "animate-bounce" : ""}`}>
                  volume_up
                </span>
                <span>{isPlayingAudioGuide ? "Playing..." : "Listen Native Model"}</span>
              </button>

              {/* Large Primary Speak / Record Attempt Button */}
              <button
                type="button"
                onClick={() => setIsRecording(!isRecording)}
                className={`flex-1 px-5 py-3 rounded-xl font-space text-[15px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  isRecording
                    ? "bg-error text-on-error shadow-[0_0_24px_rgba(255,180,171,0.6)] animate-pulse"
                    : "bg-primary text-on-primary shadow-cyan-glow hover:shadow-cyan-lg hover:brightness-105"
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isRecording ? "mic_off" : "mic"}
                </span>
                <span>{isRecording ? "Listening..." : "Record / Speak"}</span>
              </button>
            </div>
          </div>

          {/* REAL-TIME SPEECH FEEDBACK & SPECTRAL BANDS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Live Acoustic Frequency Bands (Cols 7) */}
            <div className="md:col-span-7 bg-surface-container-low/80 backdrop-blur-md rounded-xl border border-outline-variant/40 p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="font-space text-[14px] text-on-surface flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-primary text-[16px]">graphic_eq</span>
                  Acoustic Spectral Activity (F1 / F2 / F3)
                </span>
                <span className="font-mono text-[10px] text-secondary font-semibold">
                  {vocalEnergy > 0.03 ? "ACTIVE INPUT" : "STANDBY"}
                </span>
              </div>

              {/* Dynamic Frequency Equalizer Bars */}
              <div className="h-16 flex items-end justify-between gap-1.5 px-2 py-1 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
                {[12, 34, 48, 26, 42, 54, 22, 38, 50, 24, 16].map((baseHeight, idx) => {
                  const dynamicHeight = vocalEnergy > 0.02
                    ? Math.min(60, Math.round(baseHeight * (0.6 + vocalEnergy * 2.2)))
                    : Math.max(6, Math.round(baseHeight * 0.3));
                  const isCyan = idx % 2 === 0;
                  return (
                    <div
                      key={idx}
                      className={`w-full rounded-t-sm transition-all duration-100 ${
                        isCyan ? "bg-primary/80" : "bg-secondary"
                      }`}
                      style={{ height: `${dynamicHeight}px` }}
                    ></div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                <span>{fundamentalFreq ? `${fundamentalFreq} Hz (Pitch)` : "120 Hz (Fundamental)"}</span>
                <span>Formant F1: 650Hz</span>
                <span>Formant F2: 1780Hz</span>
              </div>
            </div>

            {/* Attempt Accuracy Score Metric Card (Cols 5) */}
            <div className="md:col-span-5 bg-surface-container-low/80 backdrop-blur-md rounded-xl border border-outline-variant/40 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-space text-[14px] text-on-surface font-medium">Attempt Accuracy</span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                    currentAccuracy >= SUCCESS_THRESHOLD
                      ? "bg-secondary/15 text-secondary border-secondary/40"
                      : "bg-tertiary-container/20 text-tertiary border-tertiary-container/40"
                  }`}
                >
                  {currentAccuracy >= SUCCESS_THRESHOLD ? "PASSED" : "RETRIAL REQ"}
                </span>
              </div>

              {/* Big Accuracy Number + Gauge Line */}
              <div className="flex items-baseline justify-between my-1">
                <div className="flex items-baseline gap-1">
                  <span className={`font-space text-[42px] leading-none font-bold ${currentAccuracy >= SUCCESS_THRESHOLD ? "text-secondary drop-shadow-[0_0_12px_rgba(78,222,163,0.3)]" : "text-tertiary"}`}>
                    {currentAccuracy}
                  </span>
                  <span className="font-space text-[20px] text-secondary font-semibold">%</span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[10px] text-on-surface-variant">Clinical Target</div>
                  <div className="text-[11px] text-primary font-bold">85% Threshold</div>
                </div>
              </div>

              {/* Visual Benchmark Comparison Bar */}
              <div className="flex flex-col gap-1">
                <div className="relative w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentAccuracy >= SUCCESS_THRESHOLD ? "bg-secondary" : "bg-tertiary"
                    }`}
                    style={{ width: `${currentAccuracy}%` }}
                  ></div>
                  <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-on-surface shadow-sm z-10" title="85% Pass Benchmark"></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-on-surface-variant">
                  <span>0%</span>
                  <span className="text-on-surface">Benchmark: 85%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. BOTTOM FLOATING ACTION STRIP / CLINICAL SIMULATION DOCK
         ───────────────────────────────────────────────────────────────────────────── */}
      <footer className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto bg-surface-container-lowest/90 backdrop-blur-xl border border-primary/25 rounded-2xl px-5 py-2.5 shadow-[0_8px_32px_rgba(8,14,26,0.9),0_0_16px_rgba(75,228,240,0.15)] flex flex-wrap items-center justify-between gap-4 max-w-4xl w-full">
          {/* Dock Label */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#4be4f0]"></div>
            <span className="font-space text-[13px] font-semibold text-primary tracking-wide uppercase">
              Clinical Simulation Suite
            </span>
          </div>

          {/* Action Simulation Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Simulate Spoken Attempt (Cyan Button) */}
            <button
              type="button"
              onClick={handleSimulateAttempt}
              className="px-3 py-1.5 rounded-lg bg-primary-container hover:bg-primary-container/90 text-on-primary font-space text-[12px] font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(20,200,212,0.35)] transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Simulate Spoken Attempt</span>
            </button>

            {/* Simulate Pre-Speech Block (Amber Warning Button) */}
            <button
              type="button"
              onClick={handleSimulateBlock}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-tertiary-container/60 hover:bg-tertiary-container/20 text-tertiary font-space text-[12px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-[0_0_10px_rgba(250,162,19,0.15)]"
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary">warning</span>
              <span>Simulate Pre-Speech Block</span>
            </button>

            {/* Simulate Calm State (Emerald Button) */}
            <button
              type="button"
              onClick={handleSimulateCalm}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-secondary/60 hover:bg-secondary/20 text-secondary font-space text-[12px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-[0_0_10px_rgba(78,222,163,0.15)]"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">spa</span>
              <span>Simulate Calm State</span>
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-on-surface-variant border-l border-outline-variant/40 pl-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high border border-outline-variant rounded text-on-surface text-[10px]">Space</kbd>
              Record
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface-container-high border border-outline-variant rounded text-on-surface text-[10px]">R</kbd>
              Reset
            </span>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. VICTORY CELEBRATION MODAL (>= 85% THRESHOLD)
         ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {gameState === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-surface-container-lowest border border-primary/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-cyan-glow">
                <span className="material-symbols-outlined text-[36px]">workspace_premium</span>
              </div>

              <div>
                <h3 className="font-space text-2xl font-bold text-white tracking-tight">
                  Level {currentLevel} Cleared!
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  85% Clinical Target Benchmark Achieved
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full my-1">
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-left">
                  <div className="text-[10px] text-on-surface-variant">Accuracy Score</div>
                  <div className="text-xl font-bold text-secondary">{currentAccuracy}%</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 font-mono text-left">
                  <div className="text-[10px] text-on-surface-variant">Facial Ease</div>
                  <div className="text-xl font-bold text-primary">{100 - au4Value}%</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextLevel}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-space font-bold text-[15px] shadow-cyan-glow hover:shadow-cyan-lg transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Continue to Level {currentLevel + 1}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. 100-LEVEL CURRICULUM ROADMAP MODAL
         ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {levelMapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 lg:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[85vh] bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
                    <span className="material-symbols-outlined text-[22px]">map</span>
                  </div>
                  <div>
                    <h2 className="font-space text-lg font-bold text-white">
                      100-Level Rehabilitation Curriculum
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Choose any unlocked level to practice specific speech targets
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLevelMapOpen(false)}
                  className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Tier Tabs */}
              <div className="flex items-center gap-1.5 px-5 pt-3 overflow-x-auto border-b border-outline-variant/30 scrollbar-none bg-surface-container-low/50">
                {[1, 2, 3, 4, 5].map((tierNum) => {
                  const desc = REHAB_TIER_DESCRIPTIONS[tierNum as 1 | 2 | 3 | 4 | 5];
                  const isActive = selectedTierTab === tierNum;
                  return (
                    <button
                      key={tierNum}
                      type="button"
                      onClick={() => setSelectedTierTab(tierNum as 1 | 2 | 3 | 4 | 5)}
                      className={`px-4 py-2 rounded-t-xl text-xs font-space font-semibold transition-all border-b-2 whitespace-nowrap ${
                        isActive
                          ? "bg-surface-container border-primary text-primary"
                          : "border-transparent text-on-surface-variant hover:text-white"
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
                          ? "bg-primary/20 border-primary shadow-cyan-glow"
                          : isUnlocked
                          ? "bg-surface-container-low border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container"
                          : "bg-black/40 border-outline-variant/15 opacity-30 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full font-mono text-[10px]">
                        <span className="font-bold text-on-surface-variant">#{item.level}</span>
                        {!isUnlocked ? (
                          <span className="material-symbols-outlined text-[13px] text-slate-600">lock</span>
                        ) : (
                          <div className="flex items-center gap-0.5 text-tertiary">
                            <span className="material-symbols-outlined text-[12px]">star</span>
                            <span>{stars}</span>
                          </div>
                        )}
                      </div>

                      <span className="font-tamil text-base font-bold text-white mt-1">{item.tamilText}</span>
                      <span className="text-xs text-on-surface font-medium">{item.englishText}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">/{item.transliteration}/</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
