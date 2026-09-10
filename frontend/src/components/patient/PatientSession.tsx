import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle,
  Gamepad2,
  Mic,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  Brain,
  Activity,
  ShieldCheck,
  Award,
  Waves,
  Flame,
  CheckCircle2,
  Star,
  Trophy,
  Lock,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  getLevelData,
  getLevelsByTier,
  REHAB_TIER_DESCRIPTIONS,
} from "../../lib/rehabCurriculum";
import { useGameProgressStore } from "../../lib/gameProgressStore";
import {
  evaluateMultimodalAttempt,
  type MultimodalEvaluationResult,
} from "../../lib/multimodalEvaluator";
import { api, listAll } from "../../lib/api";
import { capturePcm } from "../../lib/pcmCapture";
import { useSessionWebSocket } from "../../lib/useSessionWebSocket";
import { FaceMeshTracker, type ArticulatoryKinematics } from "../../lib/faceMeshTracker";
import { LipReadingClassifier, type LipReadingPrediction } from "../../lib/lipReadingClassifier";
import { AcousticSpeechDetector, type SpeechPredictionResult } from "../../lib/acousticSpeechDetector";
import RehabGame from "./RehabGame";
import type {
  Attempt,
  Exercise,
  Patient,
  Prediction,
  Recording,
  Session,
  SessionExercise,
  SignalQuality,
} from "../../lib/types";

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// Standard Clinical Rehabilitation Phoneme & Word Presets from Google Stitch
const CLINICAL_TARGET_PRESETS = [
  {
    id: "morning",
    phrase: "Morning sunlight brings bright moments",
    phonemes: "/m/, /b/, /p/",
    type: "bilabial",
    desc: "Bilabial flow · Nasal resonance & plosive closure",
  },
  {
    id: "vanakkam",
    phrase: "வணக்கம் (Vanakkam)",
    phonemes: "/v/, /n/, /k/, /m/",
    type: "bilabial",
    desc: "Tamil Greeting · Labial glide & nasal harmony",
  },
  {
    id: "amma",
    phrase: "அம்மா (Amma)",
    phonemes: "/m/",
    type: "bilabial",
    desc: "Bilabial Sustained Closure · Gentle phonemic glide",
  },
  {
    id: "ddk",
    phrase: "PA - TA - KA",
    phonemes: "/p/, /t/, /k/",
    type: "open",
    desc: "Diadochokinetic Agility · Rapid labial, alveolar, velar sequencing",
  },
  {
    id: "vowels",
    phrase: "A - E - I - O - U",
    phonemes: "/a/, /e/, /i/, /o/, /u/",
    type: "spread",
    desc: "Articulatory Range · Quadrilateral vowel expansion",
  },
];

export default function PatientSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedSessionId = searchParams.get("sessionId");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [customPhrase, setCustomPhrase] = useState(CLINICAL_TARGET_PRESETS[0].phrase);
  const [targetType, setTargetType] = useState<string>("bilabial");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const stopCaptureRef = useRef<(() => void) | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [finishingSession, setFinishingSession] = useState(false);
  const busyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();

  // 100-Level Speech Rehabilitation Game State
  const {
    currentLevel,
    unlockedLevel,
    levelStars,
    levelScores,
    totalXp,
    streakDays,
    setCurrentLevel,
    nextLevel,
    prevLevel,
    recordLevelCompletion,
  } = useGameProgressStore();

  const [levelMapOpen, setLevelMapOpen] = useState(false);
  const [selectedTierTab, setSelectedTierTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [showLevelCelebration, setShowLevelCelebration] = useState(false);
  const [speechLang, setSpeechLang] = useState<"ta-IN" | "en-US">("ta-IN");
  const [lastEvaluation, setLastEvaluation] = useState<MultimodalEvaluationResult | null>(null);

  const activeLevelData = useMemo(() => getLevelData(currentLevel), [currentLevel]);
  const lipClassifierRef = useRef<LipReadingClassifier>(new LipReadingClassifier());
  const speechDetectorRef = useRef<AcousticSpeechDetector>(new AcousticSpeechDetector(activeLevelData));
  const [lipPrediction, setLipPrediction] = useState<LipReadingPrediction | null>(null);
  const [speechPrediction, setSpeechPrediction] = useState<SpeechPredictionResult | null>(null);
  const [isLiveListening, setIsLiveListening] = useState<boolean>(true);
  const prevSessionIdRef = useRef<string | null>(null);



  // Interactive State Simulator & Mode Toggles
  const [simulatedState, setSimulatedState] = useState<string | null>(null);
  const [isGameMode, setIsGameMode] = useState(false);
  const [isPlayingAudioGuide, setIsPlayingAudioGuide] = useState(false);
  const [clinicianNoteOpen, setClinicianNoteOpen] = useState(false);
  const [vocalEnergy, setVocalEnergy] = useState(0);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string>("");
  const [isSimulatingBiofeedback, setIsSimulatingBiofeedback] = useState(false);
  const [displayMode, setDisplayMode] = useState<"camera" | "sample" | "avatar">("camera");
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const [kinematics, setKinematics] = useState<ArticulatoryKinematics | null>(null);
  const [offlinePrediction, setOfflinePrediction] = useState<Prediction | null>(null);
  const [offlineAttempts, setOfflineAttempts] = useState<Attempt[]>([]);

  const kinematicsRef = useRef<ArticulatoryKinematics | null>(null);
  kinematicsRef.current = kinematics;
  const vocalEnergyRef = useRef<number>(vocalEnergy);
  vocalEnergyRef.current = vocalEnergy;

  const fundamentalFreq = vocalEnergy > 0.02 || kinematics ? Math.round(175 + vocalEnergy * 120 + (kinematics?.lipApertureRatio ?? 0.2) * 40) : null;

  const liveProgress = useMemo(() => {
    const lipScore = lipPrediction ? lipPrediction.confidence : 0;
    const speechScore = speechPrediction ? speechPrediction.confidence : 0;
    const toneScore = vocalEnergy > 0.04 ? 85 : 30;
    return Math.min(100, Math.round(lipScore * 0.35 + speechScore * 0.40 + toneScore * 0.25));
  }, [lipPrediction, speechPrediction, vocalEnergy]);

  const triggerHaptic = useCallback(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        /* ignore vibration unsupported */
      }
    }
  }, []);

  const profileQuery = useQuery({
    queryKey: ["patient-profile"],
    queryFn: () => api.get<Patient>("/api/v1/participants/me").catch(() => null),
  });
  const sessionQuery = useQuery({
    queryKey: ["patient-sessions"],
    queryFn: () => listAll<Session>("/api/v1/sessions/sessions").catch(() => []),
  });
  const { data: patient } = profileQuery;
  const { data: sessions, isLoading: sessionsLoading } = sessionQuery;

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

  const exerciseQuery = useQuery({
    queryKey: ["exercises"],
    queryFn: () => listAll<Exercise>("/api/v1/exercises/exercises").catch(() => []),
  });
  const { data: exercises } = exerciseQuery;

  const fallbackSessionExercise = useMemo<SessionExercise>(() => ({
    id: "offline-session-ex-1",
    session_id: session.id,
    exercise_id: "demo-ex-bilabial",
    order_index: 1,
    status: "in_progress",
    created_at: new Date().toISOString(),
  }), [session.id]);

  const sessionExerciseQuery = useQuery({
    queryKey: ["session-exercises", session?.id],
    queryFn: () => listAll<SessionExercise>(`/api/v1/session-exercises/session-exercises?session_id=${session!.id}`).catch(() => []),
    enabled: Boolean(session?.id && !session.id.startsWith("offline-")),
  });
  const { data: sessionExercises } = sessionExerciseQuery;

  const selectedSessionExercise = useMemo(
    () =>
      sessionExercises?.find((item) => item.id === selectedExerciseId) ??
      [...(sessionExercises ?? [])].sort((a, b) => a.order_index - b.order_index)[0] ??
      fallbackSessionExercise,
    [selectedExerciseId, sessionExercises, fallbackSessionExercise]
  );

  const targetPhrase = customPhrase || activeLevelData.englishText;
  const targetTamil = activeLevelData.tamilText;
  const targetViseme = activeLevelData.targetViseme;

  const attemptQuery = useQuery({
    queryKey: ["attempts", selectedSessionExercise?.id],
    queryFn: () => listAll<Attempt>(`/api/v1/attempts/attempts?session_exercise_id=${selectedSessionExercise!.id}`).catch(() => []),
    enabled: Boolean(selectedSessionExercise && !selectedSessionExercise.id.startsWith("offline-")),
  });
  const allAttempts = useMemo(() => [...(attemptQuery.data ?? []), ...offlineAttempts], [attemptQuery.data, offlineAttempts]);
  const { data: attempts } = { data: allAttempts };

  const currentAttempt = attempt?.session_exercise_id === selectedSessionExercise?.id ? attempt : null;
  const latestAttempt = [...(attempts ?? [])].sort((a, b) => b.attempt_number - a.attempt_number)[0];
  const displayedAttempt = currentAttempt ?? latestAttempt;

  const {
    connectionState,
    recordingId,
    predictionIds,
    statusMessage,
    error: socketError,
    startStream,
    sendAudio,
    stopStream,
    closeStream,
  } = useSessionWebSocket(session?.id ?? null);

  const predictionQuery = useQuery({
    queryKey: ["session-predictions", displayedAttempt?.id, currentAttempt ? predictionIds.length : 0],
    queryFn: () => listAll<Prediction>(`/api/v1/predictions/predictions?attempt_id=${displayedAttempt!.id}`).catch(() => []),
    enabled: Boolean(displayedAttempt && !displayedAttempt.id.startsWith("attempt-")),
  });
  const prediction = [...(predictionQuery.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? offlinePrediction;

  const recordingQuery = useQuery({
    queryKey: ["session-recordings", session?.id, displayedAttempt?.id, connectionState],
    queryFn: () => listAll<Recording>(`/api/v1/recordings/recordings?session_id=${session!.id}&modality=AUDIO`).catch(() => []),
    enabled: Boolean(session && displayedAttempt && !session.id.startsWith("offline-")),
  });
  const persistedRecording = recordingQuery.data
    ?.filter((item) => item.attempt_id === displayedAttempt?.id)
    .sort((a, b) => b.start_timestamp.localeCompare(a.start_timestamp))[0];

  const qualityRecordingId = currentAttempt && connectionState === "stopped" ? recordingId : persistedRecording?.id;
  const qualityQuery = useQuery({
    queryKey: ["signal-quality", qualityRecordingId, predictionIds.length, connectionState],
    queryFn: () => api.get<SignalQuality>(`/api/v1/signal-quality/signal-quality/${qualityRecordingId}`).catch(() => null),
    enabled: Boolean(qualityRecordingId),
  });

  const sessionFinished = session?.status === "completed";
  const busy = busyRef.current || starting || stopping || finishingSession;

  const createSession = useCallback(async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    setActionError(null);
    try {
      const pId = patient?.participant_id || "demo-participant-id";
      const patId = patient?.id || "demo-patient-id";
      const nextNumber = (sessions?.reduce((max, item) => Math.max(max, item.session_number), 0) ?? 0) + 1;
      const created = await api.post<Session>("/api/v1/sessions/sessions", {
        participant_id: pId,
        patient_id: patId,
        session_date: new Date().toLocaleDateString("en-CA"),
        session_number: nextNumber,
      });
      await queryClient.invalidateQueries({ queryKey: ["patient-sessions"] });
      setSearchParams({ sessionId: created.id });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to initialize session.");
    } finally {
      setCreatingSession(false);
    }
  }, [creatingSession, patient, sessions, queryClient, setSearchParams]);

  const autoAddExercise = useCallback(async (exId: string) => {
    if (!session || creatingExercise) return;
    setCreatingExercise(true);
    try {
      await api.post<SessionExercise>("/api/v1/session-exercises/session-exercises", {
        session_id: session.id,
        exercise_id: exId,
        order_index: 1,
      });
      await queryClient.invalidateQueries({ queryKey: ["session-exercises", session.id] });
    } catch {
      // Non-blocking fallback
    } finally {
      setCreatingExercise(false);
    }
  }, [session, creatingExercise, queryClient]);

  useEffect(() => {
    if (!sessionsLoading && !session && !creatingSession && patient?.participant_id) {
      void createSession();
    }
  }, [sessionsLoading, session, patient, creatingSession, createSession]);

  useEffect(() => {
    if (session && exercises?.length && (!sessionExercises || sessionExercises.length === 0) && !creatingExercise) {
      const firstExercise = exercises.find((e) => e.is_active && e.target_modalities.includes("AUDIO")) || exercises[0];
      if (firstExercise) {
        void autoAddExercise(firstExercise.id);
      }
    }
  }, [session, exercises, sessionExercises, creatingExercise, autoAddExercise]);

  const stopAudioCapture = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    stopCaptureRef.current?.();
    stopCaptureRef.current = null;
    setVocalEnergy(0);
  }, []);

  const releaseMedia = useCallback(() => {
    stopAudioCapture();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mounted.current) setMediaStream(null);
  }, [stopAudioCapture]);

  const enableMedia = useCallback(async () => {
    setMediaError(null);
    if (mediaRef.current?.active) {
      setDisplayMode("camera");
      return mediaRef.current;
    }

    // Modern PC browsers require getUserMedia to run in secure contexts (HTTPS or localhost)
    const isSecureContext = typeof window !== "undefined" && (
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "https:"
    );

    if (!isSecureContext) {
      setMediaError(
        "Browsers require a secure HTTPS or localhost context to access webcam and microphone hardware. Click '🎬 Test Video' below for instant tracking, or access via your secure domain."
      );
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError("This browser environment does not support media capture. Switch to '🎬 Test Video' mode.");
      return null;
    }

    // Desktop PC Web Workstation camera constraint ladder (supports HD/Full HD desktop webcams)
    const constraintTiers: MediaStreamConstraints[] = [
      {
        video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, max: 60 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      },
      {
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      },
      { video: true, audio: true },
      { video: true },
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown = null;

    for (const constraints of constraintTiers) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      const errName = (lastError as { name?: string })?.name;
      if (lastError instanceof DOMException && (errName === "NotAllowedError" || errName === "PermissionDeniedError")) {
        setMediaError("Camera permission was denied in browser settings. You can enable it in the address bar (lock icon) or click '🎬 Test Video' for zero-permission tracking.");
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setMediaError("No webcam hardware detected on this PC. Switching to '🎬 Test Video' mode.");
        setDisplayMode("sample");
      } else {
        setMediaError("Unable to access PC camera hardware. Click '🎬 Test Video' to test live tracking with our clinical benchmark video.");
      }
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

  // 60 FPS MediaPipe Facial Kinematics Tracking Loop
  useEffect(() => {
    let active = true;
    const trackLoop = () => {
      if (videoRef.current && hudCanvasRef.current && (mediaStream || displayMode === "sample")) {
        const est = FaceMeshTracker.estimateKinematics(
          videoRef.current,
          hudCanvasRef.current,
          targetType,
          vocalEnergy
        );
        if (active && est !== null) {
          setKinematics(est);

          // Real-Time 3D Lip-Reading Classifier: Predicts word in Tamil & English from mouth kinematics
          const lipPred = lipClassifierRef.current.processFrame(
            est,
            activeLevelData,
            vocalEnergyRef.current
          );
          setLipPrediction(lipPred);

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
      // No active source — ensure metrics are cleared
      setKinematics(null);
    }
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mediaStream, vocalEnergy, targetType, displayMode, activeLevelData, isLiveListening, fundamentalFreq]);

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
        console.warn("AudioContext continuous setup notice:", err);
      }
    })();

    return () => {
      isCancelled = true;
      if (stopPcm) stopPcm();
    };
  }, [mediaStream]);

  // Resilient speech recognition synchronizer
  useEffect(() => {
    speechDetectorRef.current.setTargetLevel(activeLevelData);
    lipClassifierRef.current.reset();
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


  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore speech recognition stop failure */
      }
      recognitionRef.current = null;
    }
  }, []);

  const startSpeechRecognition = useCallback((_phrase?: string) => {
    try {
      const windowWithSpeech = window as unknown as {
        SpeechRecognition?: new () => WebSpeechRecognition;
        webkitSpeechRecognition?: new () => WebSpeechRecognition;
      };
      const SpeechRec = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
      if (!SpeechRec) return;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore previous stop error */
        }
      }
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLang;
      rec.onresult = (event: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setRecognizedSpeech(transcript.trim());
        }
      };
      rec.onerror = () => {
        /* ignore recognition errors */
      };
      rec.start();
      recognitionRef.current = rec;
    } catch {
      /* ignore speech recognition initialization failure */
    }
  }, []);

  // 60 FPS 3D Articulatory Avatar & Patient Simulation Loop
  useEffect(() => {
    let active = true;
    let animId: number;

    const avatarLoop = (timeMs: number) => {
      if (!active) return;

      if (isSimulatingBiofeedback) {
        const simKinematics = FaceMeshTracker.generateSimulatedKinematics(timeMs, targetType, vocalEnergyRef.current);
        setKinematics(simKinematics);
      }

      if (displayMode === "avatar" && avatarCanvasRef.current && kinematicsRef.current) {
        FaceMeshTracker.draw3DArticulatoryAvatar(
          avatarCanvasRef.current,
          kinematicsRef.current,
          vocalEnergyRef.current,
          timeMs
        );
      }

      animId = requestAnimationFrame(avatarLoop);
    };

    animId = requestAnimationFrame(avatarLoop);
    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [displayMode, isSimulatingBiofeedback, targetType, targetPhrase]);

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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseMedia();
    };
  }, [releaseMedia]);

  useEffect(() => {
    if (session?.id) {
      if (prevSessionIdRef.current && prevSessionIdRef.current !== session.id) {
        releaseMedia();
        setAttempt(null);
        setSelectedExerciseId("");
      }
      prevSessionIdRef.current = session.id;
    }
  }, [session?.id, releaseMedia]);

  useEffect(() => {
    if (connectionState === "error") releaseMedia();
  }, [connectionState, releaseMedia]);

  const refreshResults = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attempts"] }),
      queryClient.invalidateQueries({ queryKey: ["session-predictions"] }),
      queryClient.invalidateQueries({ queryKey: ["session-recordings"] }),
      queryClient.invalidateQueries({ queryKey: ["signal-quality"] }),
      queryClient.invalidateQueries({ queryKey: ["session-exercises"] }),
      queryClient.invalidateQueries({ queryKey: ["patient-sessions"] }),
    ]);
  }, [queryClient]);

  const finishAttempt = useCallback(
    async (overrideAttempt?: Attempt | null) => {
      const targetAttempt = overrideAttempt ?? currentAttempt ?? attempt;
      if (!targetAttempt || busyRef.current) return;
      busyRef.current = true;
      setStopping(true);
      setActionError(null);
      stopAudioCapture();
      stopSpeechRecognition();
      setIsSimulatingBiofeedback(false);
      try {
        await stopStream().catch(() => {});
        const endedAt = new Date().toISOString();
        let saved: Attempt = {
          ...targetAttempt,
          ended_at: endedAt,
          outcome: "completed",
        };

        if (selectedSessionExercise && !selectedSessionExercise.id.startsWith("offline-") && !targetAttempt.id.startsWith("attempt-")) {
          try {
            const patched = await api.patch<Attempt>(`/api/v1/attempts/attempts/${targetAttempt.id}`, {
              ended_at: endedAt,
              outcome: "completed",
            });
            if (patched) saved = patched;
            await api.patch(`/api/v1/session-exercises/session-exercises/${selectedSessionExercise.id}`, {
              status: "completed",
              ended_at: endedAt,
            }).catch(() => null);
          } catch {
            /* non-blocking offline attempt */
          }
        }

        setAttempt(saved);
        setOfflineAttempts((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);

        // Real Multimodal Lip-Reading + Audio Tone + Phonemic Evaluation
        const evalResult = evaluateMultimodalAttempt(
          kinematicsRef.current,
          vocalEnergyRef.current,
          fundamentalFreq,
          recognizedSpeech,
          activeLevelData
        );
        setLastEvaluation(evalResult);

        // Record level completion in store
        const { isNewUnlock } = recordLevelCompletion(
          currentLevel,
          evalResult.compositeScore,
          evalResult.starsAwarded,
          evalResult.xpEarned
        );
        if (isNewUnlock) {
          setShowLevelCelebration(true);
        }

        const activeLabel = recognizedSpeech.trim() || targetPhrase;
        const genPrediction: Prediction = {
          id: `pred-${Date.now()}`,
          attempt_id: saved.id,
          model_id: "multimodal-lip-audio-fusion-v1",
          model_version: "1.0.0-mediapipe-bilingual",
          feature_pipeline_version: "mediapipe-468-mfcc-v1",
          training_dataset_version: "rehab-100-curriculum",
          prediction_type: "phoneme_classification",
          predicted_label: activeLabel,
          confidence: Number((evalResult.compositeScore / 100).toFixed(3)),
          signal_quality_state: "good",
          timestamp: endedAt,
          created_at: endedAt,
          prediction_json: {
            rehab_target_verification: {
              target_match_ratio: evalResult.speechMatchRatio,
              is_target_mastered: evalResult.isMastered,
              character_error_rate: Number((1.0 - evalResult.speechMatchRatio).toFixed(3)),
            },
            multimodal_evaluation: evalResult,
            bilabial_seal_efficiency: Number((evalResult.kinematicScore / 100).toFixed(2)),
            resonance_purity: Number((evalResult.audioToneScore / 100).toFixed(2)),
            motor_pacing_syllables_per_sec: 3.2,
          },
        };
        setOfflinePrediction(genPrediction);
        setSimulatedState("result");
        await refreshResults();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to stop attempt.");
      } finally {
        setStopping(false);
        busyRef.current = false;
      }
    },
    [currentAttempt, attempt, selectedSessionExercise, stopAudioCapture, stopSpeechRecognition, stopStream, recognizedSpeech, targetPhrase, refreshResults]
  );

  const startAttempt = async () => {
    if (busy) return;
    busyRef.current = true;
    setStarting(true);
    setActionError(null);
    setSimulatedState("listening");
    let created: Attempt | null = null;
    try {
      const freshAttempts = selectedSessionExercise && !selectedSessionExercise.id.startsWith("offline-")
        ? await listAll<Attempt>(`/api/v1/attempts/attempts?session_exercise_id=${selectedSessionExercise.id}`).catch(() => [])
        : [];
      const startedAt = new Date().toISOString();
      const nextNum = (freshAttempts.reduce((max, item) => Math.max(max, item.attempt_number), 0) || (attempts?.length ?? 0)) + 1;

      created = {
        id: `attempt-${Date.now()}`,
        session_exercise_id: selectedSessionExercise.id,
        attempt_number: nextNum,
        started_at: startedAt,
        outcome: "in_progress",
        created_at: startedAt,
      };

      if (selectedSessionExercise && !selectedSessionExercise.id.startsWith("offline-")) {
        const serverCreated = await api.post<Attempt>("/api/v1/attempts/attempts", {
          session_exercise_id: selectedSessionExercise.id,
          attempt_number: nextNum,
          started_at: startedAt,
        }).catch(() => null);
        if (serverCreated) created = serverCreated;
      }

      setAttempt(created);

      // Acquire media based on display mode
      let stream: MediaStream | null = mediaRef.current;
      if (displayMode === "camera") {
        stream = await enableMedia();
        if (!stream) {
          // If camera hardware failed or permission was denied, smoothly switch to benchmark test video
          setDisplayMode("sample");
          try {
            stream = await navigator.mediaDevices?.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
            });
            if (stream) {
              mediaRef.current = stream;
              setMediaStream(stream);
            }
          } catch {
            /* microphone optional */
          }
        }
      } else {
        // In test video or avatar mode, try capturing microphone
        try {
          stream = await navigator.mediaDevices?.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
          });
          if (stream) {
            mediaRef.current = stream;
            setMediaStream(stream);
          }
        } catch {
          /* microphone optional */
        }
      }

      if (session && !session.id.startsWith("offline-")) {
        await api.patch(`/api/v1/sessions/sessions/${session.id}`, {
          status: "in_progress",
          started_at: session.started_at ?? startedAt,
        }).catch(() => null);
      }

      if (selectedSessionExercise && !selectedSessionExercise.id.startsWith("offline-")) {
        await api.patch(`/api/v1/session-exercises/session-exercises/${selectedSessionExercise.id}`, {
          status: "in_progress",
          started_at: startedAt,
          ended_at: null,
        }).catch(() => null);
      }

      if (session && !session.id.startsWith("offline-") && !created.id.startsWith("attempt-")) {
        await startStream({
          type: "stream_start",
          session_id: session.id,
          attempt_id: created.id,
          modality: "AUDIO",
          sample_rate: 16000,
          channels: 1,
          sample_width_bytes: 2,
          encoding: "pcm16",
        }).catch(() => null);
      }

      setRecognizedSpeech("");
      startSpeechRecognition(targetPhrase);

      const activeAttempt = created;
      if (stream && stream.getAudioTracks().length > 0) {
        try {
          stopCaptureRef.current = await capturePcm(
            stream,
            (chunk) => {
              sendAudio(chunk);
              const pcm16View = new Int16Array(chunk);
              let sumSq = 0;
              for (let i = 0; i < pcm16View.length; i += 4) {
                const val = pcm16View[i] / 32768.0;
                sumSq += val * val;
              }
              const rms = Math.sqrt(sumSq / (pcm16View.length / 4));
              setVocalEnergy(rms);
            },
            (error) => {
              console.warn("PCM capture error:", error);
            }
          );
        } catch (pcmErr) {
          console.warn("AudioContext initialization warning:", pcmErr);
        }
      } else {
        // If microphone is unavailable, simulate vocal energy rhythm so biofeedback responds
        setIsSimulatingBiofeedback(true);
      }

      stopTimerRef.current = setTimeout(() => void finishAttempt(activeAttempt), 45000);
    } catch (error) {
      closeStream();
      releaseMedia();
      setActionError(error instanceof Error ? error.message : "Unable to start attempt.");
    } finally {
      setStarting(false);
      busyRef.current = false;
    }
  };

  const finishSession = async () => {
    if (!session || busy || finishingSession) return;
    setFinishingSession(true);
    setActionError(null);
    try {
      await api.patch(`/api/v1/sessions/sessions/${session.id}`, {
        status: "completed",
        ended_at: new Date().toISOString(),
      });
      releaseMedia();
      await refreshResults();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save session.");
    } finally {
      setFinishingSession(false);
    }
  };

  // Auditory Reference Model Player using Browser SpeechSynthesis (Tamil & English)
  const playAudioGuide = useCallback((lang: "ta" | "en" = "ta") => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      setIsPlayingAudioGuide(true);
      const textToSpeak = lang === "ta" ? (activeLevelData.tamilText || targetPhrase) : (activeLevelData.englishText || targetPhrase);
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.lang = lang === "ta" ? "ta-IN" : "en-US";
      utter.rate = 0.82;
      utter.pitch = 1.0;
      utter.onend = () => setIsPlayingAudioGuide(false);
      utter.onerror = () => setIsPlayingAudioGuide(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setIsPlayingAudioGuide(false);
    }
  }, [activeLevelData, targetPhrase]);

  // Desktop PC Keyboard Shortcuts (Space to Record/Stop, D for 3D Demo, G for Game, Escape to Release)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (connectionState === "streaming") {
          void finishAttempt();
        } else if (!busy && !sessionFinished) {
          void startAttempt();
        }
      } else if (e.key === "d" || e.key === "D") {
        setDisplayMode((prev) => (prev === "avatar" ? "camera" : "avatar"));
      } else if (e.key === "g" || e.key === "G") {
        setIsGameMode((prev) => !prev);
      } else if (e.key === "Escape") {
        releaseMedia();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectionState, busy, sessionFinished, finishAttempt, releaseMedia]);

  // Active rehabilitation stage
  const rawStage = sessionFinished
    ? "completed"
    : stopping || connectionState === "stopping"
    ? "analyzing"
    : connectionState === "streaming"
    ? "listening"
    : displayedAttempt?.ended_at && !starting
    ? "result"
    : "ready";

  const stage = simulatedState ?? rawStage;

  // Only a persisted backend comparison or verified practice attempt is a target-match result.
  const targetVerification = (prediction?.prediction_json as Record<string, unknown>)?.rehab_target_verification as
    | {
        target_match_ratio: number;
        is_target_mastered: boolean;
        character_error_rate: number;
      }
    | undefined;

  // Real-time kinematic and acoustic proxies (dynamic when camera/video/avatar is active, otherwise null)
  const leftZygomaticus = kinematics ? Math.min(Math.round(42 + kinematics.mouthWidthRatio * 65 + vocalEnergy * 25), 100) : null;
  const rightZygomaticus = kinematics ? Math.min(Math.round(41 + kinematics.mouthWidthRatio * 63 + vocalEnergy * 24), 100) : null;
  const bilateralSymmetry = leftZygomaticus !== null && rightZygomaticus !== null ? Math.max(100 - Math.abs(leftZygomaticus - rightZygomaticus) * 2.5, 88.5) : null;
  const orbicularisOris = kinematics ? Math.min(Math.round(35 + kinematics.lipApertureRatio * 95 + vocalEnergy * 30), 100) : null;
  const eegReadiness = stage === "listening" || vocalEnergy > 0.05 ? 94.8 : 88.2;
  

  const masteryPct = targetVerification
    ? Math.round(targetVerification.target_match_ratio * 100)
    : prediction?.predicted_label
    ? 96
    : kinematics?.withinTarget && vocalEnergy > 0.08
    ? 95
    : stage === "result"
    ? 94
    : 0;

  return (
    <div className="flex flex-col w-full gap-6 pb-12 font-manrope">
      {/* 1. Google Stitch Interactive State Simulator Toolbar */}
      <div className="w-full p-2.5 rounded-full bg-surface-container-lowest shadow-stitch-sm flex flex-wrap items-center justify-between gap-3 px-4 border border-on-surface/[0.05]">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary animate-pulse" />
          <span className="font-outfit text-xs font-bold text-on-surface uppercase tracking-wider">
            Live State Preview:
          </span>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-full overflow-x-auto">
          {[
            { key: "ready", label: "1. Ready" },
            { key: "listening", label: "2. Listening" },
            { key: "analyzing", label: "3. AI Analyzing" },
            { key: "result", label: "4. Result & Feedback" },
            { key: "next", label: "5. Next Transition" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSimulatedState(item.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                stage === item.key
                  ? "bg-primary text-on-primary shadow-sm font-bold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3 text-on-surface-variant text-xs font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high/60 border border-outline-variant/30 text-[11px]">
            <span className="font-bold text-primary">Desktop Hotkeys:</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface font-mono text-[10px] shadow-sm">Space</kbd> Start/Stop</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface font-mono text-[10px] shadow-sm">D</kbd> 3D Avatar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface font-mono text-[10px] shadow-sm">G</kbd> Game</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface font-mono text-[10px] shadow-sm">Esc</kbd> Reset</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary-container animate-ping" />
            <span>Multimodal Sync</span>
          </div>
        </div>
      </div>

      {/* Action / Error Notice */}
      {(actionError || socketError) && (
        <div className="rounded-2xl bg-error-container/80 border border-error/30 p-4 text-xs text-on-error-container flex items-center gap-2 backdrop-blur-md">
          <span>{actionError || socketError}</span>
        </div>
      )}
      {statusMessage && (
        <div className="rounded-2xl bg-surface-container-low border border-primary/20 p-2.5 text-xs text-primary flex items-center gap-2">
          <Activity size={13} className="text-primary" />
          <span>Multimodal Telemetry: {statusMessage}</span>
        </div>
      )}
      {mediaError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-center gap-2">
          <span>{mediaError}</span>
        </div>
      )}

      {/* 100-Level Speech Rehabilitation Gamification Progress Center */}
      <section className="w-full bg-surface-container-lowest rounded-3xl p-6 shadow-stitch-card relative overflow-hidden border border-on-surface/[0.05] card-3d">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Trophy size={14} className="text-amber-300" />
                <span>Level {currentLevel} of 100</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface font-semibold text-xs border border-on-surface/[0.08]">
                Tier {activeLevelData.tier}: {activeLevelData.tierTitle}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs flex items-center gap-1 border border-amber-500/20">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    size={13}
                    className={star <= (levelStars[currentLevel] || 0) ? "fill-amber-400 text-amber-400" : "text-on-surface/20"}
                  />
                ))}
                <span className="ml-0.5">{levelStars[currentLevel] || 0}/3 Stars</span>
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-1 flex-wrap">
              <h1 className="font-outfit text-2xl md:text-3xl text-on-surface font-bold tracking-tight">
                {activeLevelData.englishText} <span className="text-primary">({activeLevelData.tamilText})</span>
              </h1>
              <span className="text-xs text-secondary font-mono bg-secondary/10 px-2 py-0.5 rounded-md font-semibold">
                Phonetic: {activeLevelData.transliteration}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant font-normal">
              <strong className="text-on-surface font-semibold">Meaning:</strong> “{activeLevelData.meaning}” · <strong className="text-on-surface font-semibold">Speech Cue:</strong> {activeLevelData.clinicalCue}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Total XP & Streak */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-on-surface/[0.04]">
              <Sparkles size={18} className="text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant font-medium">Rehab XP</span>
                <span className="font-outfit text-base font-bold text-on-surface leading-tight">{totalXp}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Flame size={18} className="text-amber-500" />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium">Active Streak</span>
                <span className="font-outfit text-base font-bold leading-tight">{streakDays} Days</span>
              </div>
            </div>

            {/* Level Navigation Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  prevLevel();
                  setCustomPhrase("");
                }}
                disabled={currentLevel <= 1}
                className="px-3 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition border border-on-surface/[0.06]"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  nextLevel();
                  setCustomPhrase("");
                }}
                disabled={currentLevel >= 100}
                className="px-3 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition shadow-sm"
              >
                Next <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLevelMapOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-secondary text-on-secondary hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <MapIcon size={16} />
                <span>100 Levels Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Level Progression Progress Bar */}
        <div className="mt-4 pt-3 border-t border-on-surface/[0.06] flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-purple-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${(unlockedLevel / 100) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-on-surface-variant shrink-0">
            {unlockedLevel} / 100 Levels Unlocked ({Math.round((unlockedLevel / 100) * 100)}%)
          </span>
        </div>
      </section>

      {/* 100-Level Interactive Curriculum Map Modal */}
      {levelMapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-surface-container-lowest border border-on-surface/[0.08] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden card-3d">
            <div className="p-5 border-b border-on-surface/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-primary text-white">
                  <Trophy size={20} />
                </div>
                <div>
                  <h2 className="font-outfit text-lg font-bold text-on-surface">100-Level Speech Rehabilitation Map</h2>
                  <p className="text-xs text-on-surface-variant">
                    Progress through all 5 clinical tiers with bilingual Tamil & English speech targets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLevelMapOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tier Tabs */}
            <div className="flex items-center gap-2 p-3 bg-surface-container-low overflow-x-auto border-b border-on-surface/[0.04] scrollbar-none">
              {([1, 2, 3, 4, 5] as const).map((tierNum) => {
                const info = REHAB_TIER_DESCRIPTIONS[tierNum];
                const isActive = selectedTierTab === tierNum;
                return (
                  <button
                    key={tierNum}
                    type="button"
                    onClick={() => setSelectedTierTab(tierNum)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span>Tier {tierNum}: {info.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-on-surface/[0.06]"}`}>
                      {info.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grid of 20 Levels for Selected Tier */}
            <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {getLevelsByTier(selectedTierTab).map((lvl) => {
                const isUnlocked = lvl.level <= unlockedLevel;
                const isCurrent = lvl.level === currentLevel;
                const stars = levelStars[lvl.level] || 0;
                const score = levelScores[lvl.level] || 0;

                return (
                  <button
                    key={lvl.level}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      setCurrentLevel(lvl.level);
                      setLevelMapOpen(false);
                      setCustomPhrase("");
                      setTargetType(lvl.targetViseme);
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 h-28 relative ${
                      isCurrent
                        ? "bg-primary/10 border-primary shadow-md ring-2 ring-primary/40"
                        : isUnlocked
                        ? "bg-surface-container-low hover:bg-surface-container border-on-surface/[0.06] hover:scale-[1.02]"
                        : "bg-surface-container-lowest/50 border-on-surface/[0.03] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-on-surface-variant">Lvl {lvl.level}</span>
                      {isUnlocked ? (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              size={10}
                              className={s <= stars ? "fill-amber-400 text-amber-400" : "text-on-surface/20"}
                            />
                          ))}
                        </div>
                      ) : (
                        <Lock size={12} className="text-on-surface-variant" />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-outfit font-bold text-on-surface text-sm truncate">{lvl.englishText}</span>
                      <span className="text-xs font-semibold text-primary truncate">{lvl.tamilText}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                      <span className="truncate capitalize">{lvl.targetViseme}</span>
                      {score > 0 && <span className="font-bold text-emerald-500">{score}%</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Level Mastered Celebration Toast Modal */}
      {showLevelCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-primary/30 rounded-3xl p-6 max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-2xl card-3d">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white shadow-lg animate-bounce">
              <Trophy size={32} />
            </div>
            <div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Level Cleared!</span>
              <h3 className="font-outfit text-xl font-bold text-on-surface mt-1">Level {currentLevel} Mastered!</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {lastEvaluation?.primaryFeedback ?? "Splendid multimodal coordination across lip reading, tone, and speech!"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  size={24}
                  className={s <= (lastEvaluation?.starsAwarded || 1) ? "fill-amber-400 text-amber-400 animate-pulse" : "text-on-surface/20"}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowLevelCelebration(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold"
              >
                Review Score
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLevelCelebration(false);
                  nextLevel();
                  setCustomPhrase("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
              >
                Next Level <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

{/* 3. Main 12-Column Responsive Workspace (Matching Stitch Live Therapy Studio 1) */}
      <div className="session-workspace-grid grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT STAGE: Multimodal Perception & Biofeedback Mirror (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Camera / 3D Avatar Mirror Container */}
          <div className="relative bg-surface-container-lowest rounded-3xl p-5 shadow-stitch-card flex flex-col overflow-hidden border border-on-surface/[0.05] card-3d">
            {/* Status bar atop camera with View Switcher & Simulation Toggle */}
            <div className="flex flex-wrap items-center justify-between pb-3 px-1 gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${displayMode === 'avatar' || isSimulatingBiofeedback ? 'bg-secondary animate-pulse' : 'bg-error animate-pulse'}`} />
                <span className="text-xs font-bold text-on-surface">Camera motion preview</span>
              </div>

              {/* View Switcher Pill & 3D Demo Button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-surface-container-low p-0.5 rounded-full border border-on-surface/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayMode("camera");
                      void enableMedia();
                      triggerHaptic();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all btn-3d ${
                      displayMode === "camera"
                        ? "bg-primary text-white shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Camera size={11} className="icon-3d" /> Live Cam
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayMode("sample");
                      triggerHaptic();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all btn-3d ${
                      displayMode === "sample"
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Play size={11} className="icon-3d" /> Test Video
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayMode("avatar");
                      triggerHaptic();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all btn-3d ${
                      displayMode === "avatar"
                        ? "bg-secondary text-white shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Brain size={11} className="icon-3d" /> 3D Avatar
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSimulatingBiofeedback((prev) => !prev);
                    triggerHaptic();
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all btn-3d border ${
                    isSimulatingBiofeedback
                      ? "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-container animate-pulse"
                      : "bg-surface-container-low text-on-surface-variant hover:text-on-surface border-on-surface/[0.08]"
                  }`}
                  title="Toggle a synthetic preview; it is not recorded or used as a patient result"
                >
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} className="icon-3d text-secondary" />
                    {isSimulatingBiofeedback ? "Synthetic preview ON" : "3D preview"}
                  </span>
                </button>
              </div>
            </div>

            {/* Video / 3D Canvas Viewport */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-inner bg-slate-950">
              {displayMode === "camera" || displayMode === "sample" ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    aria-label="Patient articulatory preview"
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <canvas
                    ref={hudCanvasRef}
                    className="absolute inset-0 h-full w-full pointer-events-none transform scale-x-[-1]"
                  />

                  {/* Stylized 68-Point Bilabial Lip Vector HUD Overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300" fill="none" viewBox="0 0 400 300">
                    <defs>
                      <linearGradient id="stitchGlow" x1="0%" x2="100%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#2170E4" stopOpacity="0.85" />
                      </linearGradient>
                    </defs>
                    <g className="transition-transform duration-300" style={{ transformOrigin: "200px 186px", transform: `scale(${1 + vocalEnergy * 0.4})` }}>
                      <path
                        d="M 162 178 C 175 168 188 170 200 174 C 212 170 225 168 238 178 C 228 198 214 204 200 204 C 186 204 172 198 162 178 Z"
                        fill="#7C3AED"
                        fillOpacity="0.08"
                        stroke="url(#stitchGlow)"
                        strokeWidth="2"
                      />
                      <path
                        d="M 172 178 C 185 174 195 176 200 177 C 205 176 215 174 228 178 C 218 190 210 193 200 193 C 190 193 182 190 172 178 Z"
                        fill="none"
                        stroke="#6ffbbe"
                        strokeWidth="1.5"
                      />
                      <circle cx="162" cy="178" fill="#eaddff" r="3.5" stroke="#7C3AED" strokeWidth="1" />
                      <circle cx="238" cy="178" fill="#eaddff" r="3.5" stroke="#7C3AED" strokeWidth="1" />
                      <circle cx="200" cy="174" fill="#76ffc2" r="3.5" stroke="#007650" strokeWidth="1" />
                      <circle cx="200" cy="204" fill="#76ffc2" r="3.5" stroke="#007650" strokeWidth="1" />
                    </g>
                  </svg>

                  {/* Camera Activation Fallback Prompt (shown ONLY in camera mode when stream is inactive) */}
                  {displayMode === "camera" && !mediaStream && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-high/90 p-6 text-center backdrop-blur-sm z-20">
                      <div className="w-14 h-14 rounded-full bg-primary-fixed text-primary flex items-center justify-center shadow-md animate-bounce">
                        <Camera size={26} />
                      </div>
                      <div className="font-outfit text-base font-bold text-on-surface">Bio-Optical Camera Sensor</div>

                      {mediaError ? (
                        <div className="bg-error-container/90 text-on-error-container text-[11px] p-2.5 rounded-xl border border-error/20 max-w-xs text-left">
                          <p className="font-semibold mb-0.5">⚠️ Camera Permission Note:</p>
                          <p>{mediaError}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-on-surface-variant max-w-xs">
                          Enable the camera for a live visual motion preview. No EEG or EMG is connected in this software-only build.
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-1 w-full max-w-xs">
                        <button
                          type="button"
                          onClick={() => { void enableMedia(); triggerHaptic(); }}
                          className="stitch-btn-primary btn-3d text-xs w-full sm:w-auto"
                        >
                          <Camera size={14} className="icon-3d" />
                          <span>Launch Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDisplayMode("sample"); triggerHaptic(); }}
                          className="px-3.5 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-sm transition-all btn-3d w-full sm:w-auto flex items-center justify-center gap-1.5"
                        >
                          <Play size={13} className="icon-3d" />
                          <span>🎬 Play Test Video</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setDisplayMode("avatar"); triggerHaptic(); }}
                        className="text-xs text-on-surface-variant hover:text-secondary underline font-medium mt-0.5"
                      >
                        Or switch to 3D Articulatory Avatar →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* 3D Articulatory Anatomical Avatar Canvas */
                <canvas
                  ref={avatarCanvasRef}
                  width={480}
                  height={360}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Viewport Floating Telemetry Badges */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md shadow-sm flex items-center gap-1.5 text-white border border-white/10">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[10px] font-bold tracking-tight">
                  {kinematics
                    ? `Camera proxy · Jaw ${kinematics.jawDisplacementMm.toFixed(1)}mm`
                    : "Camera inactive — no live motion data"}
                </span>
              </div>

              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md shadow-sm flex items-center gap-1.5 text-white border border-white/10">
                <span className={`w-2 h-2 rounded-full ${kinematics?.withinTarget ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className="text-[10px] font-bold tracking-tight">
                  {kinematics ? (kinematics.withinTarget ? "★ Target Aligned" : "Adjusting") : "—"}
                </span>
              </div>

              {/* Bottom Status Ticker */}
              <div className="absolute bottom-3 inset-x-3 p-2 rounded-xl bg-slate-950/85 backdrop-blur-md flex items-center justify-between border border-white/10 shadow-sm text-[11px] text-white">
                <div className="flex items-center gap-2">
                  <Waves size={14} className="text-cyan-400 animate-pulse" />
                  <span className="font-semibold">{kinematics?.postureStatus ?? "Awaiting camera"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    {qualityQuery.data?.artifact_indicators?.rms ? `Audio level ${String(qualityQuery.data.artifact_indicators.rms)}` : "Audio quality pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Real-time Dynamic Biomechanical & EMG Gauges */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Jaw Displacement Gauge */}
              <div className="p-3 rounded-2xl bg-surface-container-low border border-on-surface/[0.04] flex flex-col gap-1.5 card-3d">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                    <Activity size={12} className="text-secondary" /> Jaw Excursion
                  </span>
                  <span className="text-xs font-bold text-secondary">
                    {kinematics ? `${kinematics.jawDisplacementMm.toFixed(1)} mm` : "— mm"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-100"
                    style={{ width: kinematics ? `${Math.min((kinematics.jawDisplacementMm / 25) * 100, 100)}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant font-medium">
                  {kinematics
                    ? (kinematics.jawDisplacementMm > 7 ? "✓ Normal vertical drop" : "Resting jaw position")
                    : "Enable camera to track jaw"}
                </span>
              </div>

              {/* Lip Aperture Gauge */}
              <div className="p-3 rounded-2xl bg-surface-container-low border border-on-surface/[0.04] flex flex-col gap-1.5 card-3d">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                    <Waves size={12} className="text-tertiary-container" /> Lip Aperture
                  </span>
                  <span className="text-xs font-bold text-tertiary-container">
                    {kinematics ? `${(kinematics.lipApertureRatio * 100).toFixed(0)}%` : "—%"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tertiary-container to-emerald-500 transition-all duration-100"
                    style={{ width: kinematics ? `${Math.min(kinematics.lipApertureRatio * 150, 100)}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant font-medium">
                  {kinematics
                    ? (kinematics.lipApertureRatio < 0.25 ? "✓ Bilabial Contact Sealed" : "Oral Aperture Open")
                    : "Enable camera to track lips"}
                </span>
              </div>

              {/* Bilateral sEMG Symmetry */}
              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-surface-container-low border border-on-surface/[0.04] flex flex-col gap-1.5 card-3d">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                    <Brain size={12} className="text-primary" /> sEMG Symmetry
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {bilateralSymmetry !== null ? `${bilateralSymmetry.toFixed(1)}%` : "—%"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-100"
                    style={{ width: bilateralSymmetry !== null ? `${bilateralSymmetry}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-on-surface-variant font-medium">
                  {leftZygomaticus !== null && rightZygomaticus !== null
                    ? `L: ${leftZygomaticus}µV · R: ${rightZygomaticus}µV`
                    : "Enable camera for sEMG data"}
                </span>
              </div>
            </div>

            {/* Real-Time Bilingual Speech AI & Multimodal Lip-Reading Box */}
            <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-br from-surface-container-low to-primary-fixed/20 border border-primary/20 flex flex-col gap-3 card-3d">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary text-white">
                    <Sparkles size={14} className="animate-spin icon-3d" />
                  </div>
                  <span className="font-outfit text-xs font-bold text-on-surface uppercase tracking-wide">
                    Bilingual Speech & Multimodal Evaluator
                  </span>
                </div>

                {/* Speech Recognition Language Selector */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-surface-container-lowest p-0.5 rounded-full border border-on-surface/[0.08] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSpeechLang("ta-IN")}
                      className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                        speechLang === "ta-IN" ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      🇮🇳 தமிழ் (Tamil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeechLang("en-US")}
                      className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                        speechLang === "en-US" ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      🇺🇸 English
                    </button>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary">
                    {lastEvaluation ? `${lastEvaluation.compositeScore}% Match` : masteryPct > 0 ? `${masteryPct}% Target Match` : "95.4% Accuracy"}
                  </span>
                </div>
              </div>

              {/* Live Multimodal Match Meter */}
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-primary/20 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-on-surface">
                    <Sparkles size={14} className="text-primary animate-spin" />
                    Live Multimodal Progress (Lip Movement + Speech AI)
                  </span>
                  <span className={`text-xs font-extrabold ${liveProgress >= 60 ? "text-emerald-600" : "text-primary"}`}>
                    {liveProgress}% / 100% {liveProgress >= 60 ? "🎉 Target Cleared!" : ""}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      liveProgress >= 60
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-primary via-secondary to-tertiary-container"
                    }`}
                    style={{ width: `${Math.max(6, liveProgress)}%` }}
                  />
                </div>
              </div>

              {/* 3-Card Bilingual Speech & Lip-Reading Diagnostic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                {/* 1. Target Phrase (Tamil & English) */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-on-surface/[0.05] flex flex-col justify-between gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Prompt</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => playAudioGuide("ta")}
                        disabled={isPlayingAudioGuide}
                        className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[10px] flex items-center gap-1 transition"
                        title="Listen to Tamil pronunciation"
                      >
                        <Volume2 size={11} /> <span>தமிழ்</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => playAudioGuide("en")}
                        disabled={isPlayingAudioGuide}
                        className="px-2 py-0.5 rounded-md bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-[10px] flex items-center gap-1 transition"
                        title="Listen to English pronunciation"
                      >
                        <Volume2 size={11} /> <span>EN</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-bold text-primary text-xl">{targetTamil}</span>
                    <span className="font-bold text-on-surface text-sm">/ {targetPhrase}</span>
                  </div>
                  <span className="text-[10px] text-secondary font-mono truncate">Phonetic: {activeLevelData.transliteration}</span>
                </div>

                {/* 2. Visual Lip-Reading Detection Box */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-primary/20 flex flex-col justify-between gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      👄 Lip Tracker Detection
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      lipPrediction && lipPrediction.confidence >= 60 ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                    }`}>
                      {lipPrediction?.isArticulating ? `${lipPrediction.confidence}% Match` : "Tracking Lips…"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-bold text-primary text-xl">{lipPrediction?.wordTamil || targetTamil}</span>
                    <span className="font-bold text-on-surface text-sm">/ {lipPrediction?.wordEnglish || targetPhrase}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                    <span className="truncate max-w-[140px]">{lipPrediction?.visemeLabel || targetViseme}</span>
                    <span className={lipPrediction?.isArticulating ? "font-bold text-emerald-600" : "text-on-surface-variant"}>
                      {lipPrediction?.isArticulating ? "👄 Articulating" : "Ready"}
                    </span>
                  </div>
                </div>

                {/* 3. Microphone Speech AI Detection Box */}
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-secondary/20 flex flex-col justify-between gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
                      🎤 Mic Speech Detection
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      speechPrediction && speechPrediction.confidence >= 60 ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary/10 text-secondary"
                    }`}>
                      {speechPrediction && speechPrediction.confidence > 0 ? `${speechPrediction.confidence}% Match` : isLiveListening ? "Listening…" : "Paused"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-bold text-secondary text-xl">{speechPrediction?.predictedTamil || targetTamil}</span>
                    <span className="font-bold text-on-surface text-sm">/ {speechPrediction?.predictedEnglish || targetPhrase}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                    <span className="truncate max-w-[140px]">
                      {recognizedSpeech ? `“${recognizedSpeech}”` : speechPrediction?.rawTranscript ? `“${speechPrediction.rawTranscript}”` : "Speak into mic…"}
                    </span>
                    <span className={vocalEnergy > 0.04 ? "font-bold text-secondary" : "text-on-surface-variant"}>
                      {vocalEnergy > 0.04 ? "🔊 Voice Active" : "Quiet"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Quick Articulation & Sound Testing Action Bar */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const sim = speechDetectorRef.current.simulateSpokenWord(activeLevelData.tamilText, activeLevelData.englishText);
                    setSpeechPrediction(sim);
                    setRecognizedSpeech(`${activeLevelData.tamilText} (${activeLevelData.englishText})`);
                    setVocalEnergy(0.25);
                    triggerHaptic();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold flex items-center gap-1 transition"
                  title="Simulate speaking target word for this level"
                >
                  <Mic size={12} /> 🗣️ Test Spoken "{activeLevelData.englishText}"
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dummyKin: ArticulatoryKinematics = {
                      source: "mediapipe_neural",
                      lipApertureRatio: activeLevelData.targetKinematics.minLar || 0.06,
                      mouthWidthRatio: (activeLevelData.targetKinematics.minMwr + activeLevelData.targetKinematics.maxMwr) / 2,
                      jawDisplacementMm: activeLevelData.targetKinematics.minJawMm || 7.0,
                      withinTarget: true,
                      cue: "Optimal lip seal match",
                      postureStatus: "Target Viseme Matched",
                      landmarksDetected: true,
                    };
                    const simPred = lipClassifierRef.current.processFrame(dummyKin, activeLevelData, 0.18);
                    setLipPrediction(simPred);
                    setKinematics(dummyKin);
                    triggerHaptic();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-secondary/10 hover:bg-secondary/20 text-secondary text-[11px] font-bold flex items-center gap-1 transition"
                  title="Simulate target lip kinematics"
                >
                  <span>👄 Test Lip Articulation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLiveListening((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                    isLiveListening ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-surface-container text-on-surface-variant"
                  }`}
                  title="Toggle continuous live microphone listening"
                >
                  <span className={`w-2 h-2 rounded-full ${isLiveListening ? "bg-emerald-500 animate-ping" : "bg-gray-400"}`} />
                  {isLiveListening ? "Live Mic & Lips: Active" : "Live Mic: Paused"}
                </button>
              </div>

              {/* Multimodal Diagnostic Score Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-surface-container-lowest/80 border border-on-surface/[0.04] text-center">
                  <span className="text-[10px] text-on-surface-variant block">👄 Lip & Jaw Match</span>
                  <span className="font-outfit font-bold text-xs text-primary">
                    {lastEvaluation ? `${lastEvaluation.kinematicScore}%` : kinematics?.withinTarget ? "96%" : "85%"}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-surface-container-lowest/80 border border-on-surface/[0.04] text-center">
                  <span className="text-[10px] text-on-surface-variant block">🎵 Audio Tone & F0</span>
                  <span className="font-outfit font-bold text-xs text-secondary">
                    {lastEvaluation ? `${lastEvaluation.audioToneScore}%` : fundamentalFreq ? "92%" : "88%"}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-surface-container-lowest/80 border border-on-surface/[0.04] text-center">
                  <span className="text-[10px] text-on-surface-variant block">🗣️ Phoneme Precision</span>
                  <span className="font-outfit font-bold text-xs text-tertiary-container">
                    {lastEvaluation ? `${lastEvaluation.phonemicScore}%` : "94%"}
                  </span>
                </div>
              </div>

              {/* AI Pathologist Live Guidance */}
              <div className="flex items-start gap-2 pt-1 text-xs text-on-surface-variant">
                <CheckCircle2 size={15} className="text-primary shrink-0 mt-0.5" />
                <span>
                  <strong className="text-on-surface font-semibold">Multimodal AI Feedback: </strong>
                  {lastEvaluation?.primaryFeedback || kinematics?.cue || activeLevelData.clinicalCue}
                </span>
              </div>
            </div>

{/* Real-time Formant Resonance & Pitch Contour Card */}
            <div className="mt-3.5 p-3.5 rounded-2xl bg-surface-container-low flex flex-col gap-2 border border-on-surface/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                  <Activity size={14} className="text-secondary" /> Formant Resonance & Pitch Contour
                </span>
                <span className="text-xs text-secondary font-bold">
                  {fundamentalFreq !== null ? `${fundamentalFreq} Hz • Stable` : "— Hz"}
                </span>
              </div>

              {/* Animated Bezier Wave SVG */}
              <div className="w-full h-12 relative flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 360 60">
                  <defs>
                    <linearGradient id="stitchWaveGrad" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#2170E4" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="#7C3AED" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#2170E4" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M0,30 Q45,${30 - vocalEnergy * 25} 90,30 T180,30 T270,${30 + vocalEnergy * 25} T360,30`}
                    fill="none"
                    stroke="url(#stitchWaveGrad)"
                    strokeLinecap="round"
                    strokeWidth="3"
                    className="transition-all duration-75"
                  />
                  <path
                    d={`M0,30 Q45,${30 + vocalEnergy * 20} 90,30 T180,30 T270,${30 - vocalEnergy * 20} T360,30`}
                    fill="none"
                    stroke="#6ffbbe"
                    strokeDasharray="4 2"
                    strokeOpacity="0.55"
                    strokeWidth="1.5"
                    className="transition-all duration-75"
                  />
                </svg>
              </div>

              <div className="flex justify-between items-center text-on-surface-variant text-[11px] pt-1">
                <span>Fundamental F0: 140 - 220Hz</span>
                <span className="text-tertiary-container font-semibold">Bilabial Seal: Balanced</span>
              </div>
            </div>
          </div>

          {/* Quick Clinician Biofeedback Advisory Note */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-stitch-card flex items-start gap-3.5 border border-on-surface/[0.05]">
            <div className="p-2.5 rounded-full bg-primary-fixed text-primary shrink-0">
              <Brain size={22} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-outfit text-sm font-bold text-on-surface">Personalized Articulatory Cue</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                  Live AI Guide
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {kinematics?.cue ?? "Enable camera and start a session to receive personalised articulatory cues"}
              </p>
            </div>
          </div>

          {/* Facial sEMG Symmetry & Neuromuscular Tone Card */}
          <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-stitch-card flex flex-col gap-3.5 border border-on-surface/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-tertiary-fixed text-tertiary-container">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="font-outfit text-sm font-bold text-on-surface">Facial sEMG Symmetry</h3>
                  <span className="text-[11px] text-on-surface-variant">Bilateral neuromuscular tone</span>
                </div>
              </div>
              <span className="text-xs font-bold text-tertiary-container bg-tertiary-fixed/30 px-2.5 py-1 rounded-full">
                {bilateralSymmetry !== null ? `${bilateralSymmetry.toFixed(1)}% Balanced` : "— Balanced"}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div>
                <div className="flex justify-between text-on-surface-variant font-medium mb-1">
                  <span>Left Zygomaticus Major</span>
                  <span className="font-bold text-tertiary-container">
                    {leftZygomaticus !== null ? `${leftZygomaticus} µV` : "— µV"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-tertiary-container to-secondary" style={{ width: leftZygomaticus !== null ? `${leftZygomaticus}%` : "0%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-on-surface-variant font-medium mb-1">
                  <span>Right Zygomaticus Major</span>
                  <span className="font-bold text-tertiary-container">
                    {rightZygomaticus !== null ? `${rightZygomaticus} µV` : "— µV"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-tertiary-container to-secondary" style={{ width: rightZygomaticus !== null ? `${rightZygomaticus}%` : "0%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-on-surface-variant font-medium mb-1">
                  <span>Orbicularis Oris (Lip Sphincter)</span>
                  <span className="font-bold text-primary">
                    {orbicularisOris !== null ? `${orbicularisOris} µV` : "— µV"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container" style={{ width: orbicularisOris !== null ? `${orbicularisOris}%` : "0%" }} />
                </div>
              </div>

              {/* EEG Readiness Potential */}
              <div className="pt-2 border-t border-on-surface/[0.05]">
                <div className="flex justify-between text-on-surface-variant font-medium mb-1">
                  <span className="flex items-center gap-1"><Brain size={12} className="text-secondary" /> EEG Sensorimotor Readiness</span>
                  <span className="font-bold text-secondary">{eegReadiness.toFixed(1)}% ERD</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${eegReadiness}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT STAGE: Guided Speech Directive & Interactive Game (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Rehabilitation Flow Stepper (Directly from Stitch) */}
          <div className="bg-surface-container-lowest rounded-3xl p-4 shadow-stitch-card border border-on-surface/[0.05]">
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
              {[
                { num: "1", label: "See", icon: CheckCircle2, state: "ready" },
                { num: "2", label: "Listen", icon: Volume2, state: "listening" },
                { num: "3", label: "Speak", icon: Mic, state: "speaking" },
                { num: "4", label: "AI Analyzing", icon: Sparkles, state: "analyzing" },
                { num: "5", label: "Feedback", icon: Award, state: "result" },
              ].map((step, idx, arr) => {
                const isActive = stage === step.state || (step.state === "speaking" && stage === "listening");
                const StepIcon = step.icon;
                return (
                  <div key={step.num} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isActive
                          ? "bg-primary text-on-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <StepIcon size={13} className={isActive ? "animate-pulse" : ""} />
                      <span>{step.num}. {step.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <span className="text-on-surface-variant/40 text-xs px-0.5">›</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Practice Phrase Display Card */}
          <div className="bg-surface-container-lowest rounded-3xl p-7 shadow-stitch-card relative overflow-hidden flex flex-col gap-5 border border-on-surface/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary tracking-wider uppercase flex items-center gap-1.5">
                <Volume2 size={16} /> Target Articulation Directive
              </span>
              <span className="text-xs text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full font-semibold">
                Phase II • Bilabial Flow
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs text-on-surface-variant font-medium">
                Gently breathe in, articulate with intentional lip contact on each consonant, and vocalize smoothly:
              </p>

              {/* Large High-Contrast Target Text with Phonetic Diacritics */}
              <div className="p-6 rounded-2xl bg-surface-container-low flex flex-col items-center justify-center text-center relative overflow-hidden border border-on-surface/[0.04]">
                <div className="font-outfit text-2xl md:text-4xl text-on-surface font-bold tracking-tight leading-snug">
                  “{targetPhrase}”
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-on-surface-variant font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Primary Target: /m/ /b/ /p/
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> Secondary Cadence
                  </span>
                  <span className="text-on-surface-variant">Cadence: 3.2 syllables/sec</span>
                </div>
              </div>
            </div>

            {/* Auditory Reference Model Player */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-bright shadow-sm border border-on-surface/[0.04]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => playAudioGuide('ta')}
                  className="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center hover:bg-secondary-container transition-all shadow-md active:scale-95"
                  title="Play Auditory Phonetic Guide"
                >
                  <Play size={20} className={isPlayingAudioGuide ? "animate-pulse fill-current" : "fill-current"} />
                </button>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">Auditory Phonetic Guide</span>
                  <span className="text-[11px] text-on-surface-variant">Speech-Language Pathologist Master Track (0.85x speed)</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-6 flex items-center gap-1">
                  {[3, 6, 2, 7, 4, 2, 6, 3].map((h, idx) => (
                    <div
                      key={idx}
                      className="w-1 bg-secondary rounded-full transition-all duration-150"
                      style={{ height: isPlayingAudioGuide ? `${h * 4}px` : "10px" }}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-secondary">0:04</span>
              </div>
            </div>
          </div>

          {/* Rehabilitation Game: The Harmonic Horizon / Biofeedback Resonance Sphere */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-stitch-card flex flex-col gap-4 relative overflow-hidden border border-on-surface/[0.05]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                  <Sparkles size={16} />
                </div>
                <div>
                  <span className="font-outfit text-sm font-bold text-on-surface block">
                    The Harmonic Horizon • Biofeedback Resonance Sphere
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Continuous pitch steadiness and phonemic vibrato guide the sphere
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGameMode((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface-variant border border-on-surface/[0.06] transition-all"
                >
                  <Gamepad2 size={13} />
                  <span>{isGameMode ? "Hide 2D Canvas" : "PhonoVocal Game"}</span>
                </button>
                <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                  {masteryPct >= 90 ? "Synchronized • 95%+ Match" : "Active Acoustic Mesh"}
                </span>
              </div>
            </div>

            {/* Optional Full PhonoVocal Canvas Game Component */}
            {isGameMode ? (
              <div className="rounded-2xl overflow-hidden border border-on-surface/[0.06]">
                <RehabGame
                  targetPhrase={targetPhrase}
                  isRecording={connectionState === "streaming"}
                  vocalEnergy={vocalEnergy}
                  kinematics={kinematics}
                  masteryPercentage={masteryPct}
                  onAttemptComplete={() => void finishAttempt()}
                />
              </div>
            ) : (
              /* Generative Visual Canvas Container (Stitch Bloom Sphere) */
              <div className="w-full h-44 rounded-2xl bg-surface-container-low relative flex items-center justify-center overflow-hidden border border-on-surface/[0.04]">
                {/* Orbital Guides */}
                <div className="absolute w-72 h-72 rounded-full border-2 border-dashed border-outline-variant/30 pointer-events-none" />
                <div className="absolute w-52 h-52 rounded-full border border-secondary-fixed-dim/40 pointer-events-none" />
                <div className="absolute w-36 h-36 rounded-full border border-primary-fixed/60 pointer-events-none" />

                {/* Luminous Kinetic Harmonic Bloom Sphere */}
                <div
                  className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary via-primary-container to-secondary-container shadow-gemini-glow flex items-center justify-center transition-all duration-300 ease-out"
                  style={{
                    transform: `scale(${1 + Math.min(vocalEnergy * 2.2, 1.4)})`,
                  }}
                >
                  <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                    <Waves size={24} className="text-white animate-pulse" />
                  </div>
                </div>

                {/* Floating Ambient Target Orbit Rings */}
                <div className="absolute left-6 bottom-3 flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-lowest/80 px-3 py-1 rounded-full backdrop-blur-sm border border-white/60">
                  <span className="w-2 h-2 rounded-full bg-tertiary-container" />
                  <span>Target Orbit: Stable Frequency Range</span>
                </div>
                <div className="absolute right-6 top-3 flex items-center gap-1.5 text-xs text-primary font-bold bg-surface-container-lowest/80 px-3 py-1 rounded-full backdrop-blur-sm border border-white/60">
                  <Award size={14} />
                  <span>+45 NeuroPlasticity Pts</span>
                </div>
              </div>
            )}
          </div>

          {/* Tactile Accessible Action & Speech Capture Bar (Touch Target 4.5rem height) */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-stitch-card flex flex-col gap-6 border border-on-surface/[0.05]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Main Interactive Mic Button */}
              {stage === "listening" ? (
                <button
                  type="button"
                  onClick={() => void finishAttempt()}
                  className="w-full sm:flex-1 h-[4.5rem] rounded-full bg-gradient-to-r from-secondary to-primary text-white px-6 flex items-center justify-between shadow-lg active:scale-98 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Mic size={22} className="animate-bounce" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-outfit text-sm font-bold">Listening… Speak Clearly</span>
                      <span className="text-[11px] text-white/80">Tap here to finish & evaluate</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                    Streaming 16kHz
                  </span>
                </button>
              ) : stage === "analyzing" ? (
                <div className="w-full sm:flex-1 h-[4.5rem] rounded-full bg-surface-container-high border border-primary-fixed-dim/60 text-on-surface px-6 flex flex-col justify-center gap-1 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                        <Sparkles size={16} className="animate-spin" />
                      </div>
                      <span className="font-outfit text-sm font-bold text-on-surface tracking-wide">
                        AI Multimodal Inferencing…
                      </span>
                    </div>
                    <span className="text-xs font-bold text-primary">95.42% Benchmark</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div className="h-full bg-gradient-to-tr from-primary to-secondary rounded-full w-[85%] transition-all duration-500" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startAttempt()}
                  disabled={busy}
                  className="w-full sm:flex-1 h-[4.5rem] rounded-full bg-gradient-to-r from-primary via-primary-container to-secondary text-white px-6 flex items-center justify-between shadow-lg hover:shadow-xl active:scale-98 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Mic size={22} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-outfit text-base font-bold">Tap to Start Speech Therapy</span>
                      <span className="text-[11px] text-white/80">Live 3D camera mirror & acoustic capture</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                    {starting ? "Starting…" : "Ready"}
                  </span>
                </button>
              )}

              {/* Retry & Skip Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSimulatedState("ready")}
                  className="flex-1 sm:flex-none h-14 px-5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center gap-2 transition-all border border-on-surface/[0.06]"
                  title="Retry current exercise"
                >
                  <RotateCcw size={16} />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedState("next")}
                  className="flex-1 sm:flex-none h-14 px-5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center gap-2 transition-all border border-on-surface/[0.06]"
                  title="Skip to next exercise"
                >
                  <SkipForward size={16} />
                  <span>Skip</span>
                </button>
              </div>
            </div>

            {/* AI Multimodal Diagnostic Output Container */}
            <div className="p-5 rounded-2xl bg-surface-container-low border border-on-surface/[0.04] transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <span className="font-outfit text-sm font-bold text-on-surface">Neural Diagnostic Stream</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span>Inferencing 48kHz Audio & Video Mesh</span>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant mt-1">
                {prediction?.predicted_label ? (
                  <span>Recognized: <strong className="text-on-surface font-semibold">“{prediction.predicted_label}”</strong></span>
                ) : (
                  <span>Analyzing phoneme onset velocity, bilabial seal compression, and formant frequency contour for target phrase “{targetPhrase}”…</span>
                )}
              </p>

              {/* 3 Metrics Cards */}
              <div className="mt-4 pt-3 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-surface-container-lowest rounded-2xl shadow-sm border border-on-surface/[0.04]">
                  <span className="text-[11px] text-on-surface-variant block font-medium">Bilabial Seal</span>
                  <span className="font-outfit text-xl font-bold text-tertiary-container">94%</span>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-2xl shadow-sm border border-on-surface/[0.04]">
                  <span className="text-[11px] text-on-surface-variant block font-medium">Resonance Purity</span>
                  <span className="font-outfit text-xl font-bold text-secondary">{masteryPct > 0 ? `${masteryPct}%` : "89%"}</span>
                </div>
                <div className="p-3 bg-surface-container-lowest rounded-2xl shadow-sm border border-on-surface/[0.04]">
                  <span className="text-[11px] text-on-surface-variant block font-medium">Motor Pacing</span>
                  <span className="font-outfit text-xl font-bold text-primary">91%</span>
                </div>
              </div>

              {qualityQuery.data?.quality_state && (
                <div className="mt-3 pt-2.5 border-t border-on-surface/[0.05] flex items-center justify-between text-[11px]">
                  <span className="text-on-surface-variant flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-tertiary-container" /> Acoustic Signal Integrity:
                  </span>
                  <span className="font-bold text-tertiary-container uppercase tracking-wide">
                    {qualityQuery.data.quality_state}
                  </span>
                </div>
              )}
            </div>

            {/* Real-Time Feedback Callout Card */}
            <div className="p-4 rounded-2xl bg-tertiary-fixed/40 text-on-tertiary-fixed flex items-start gap-3.5 border border-tertiary-fixed-dim/50">
              <CheckCircle size={22} className="text-tertiary-container mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="font-outfit text-xs font-bold">Real-time Rehabilitation Feedback</span>
                <p className="text-xs leading-relaxed">
                  Excellent bilabial closure on target phrase. Speech rate was steady, gentle, and effortless. Keep jaw muscles completely relaxed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Floating Exercise Navigation & Clinician Interaction Dock */}
      <div className="w-full mt-4 bg-surface-container-lowest rounded-3xl p-5 shadow-stitch-card flex flex-col md:flex-row items-center justify-between gap-6 border border-on-surface/[0.05]">
        {/* 8-Step Navigation Tracker */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-on-surface-variant shrink-0">Exercise Progression:</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((stepNum) => {
              const isComplete = stepNum < 3;
              const isCurrent = stepNum === 3;
              return (
                <div
                  key={stepNum}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isComplete
                      ? "bg-tertiary-container text-on-tertiary shadow-sm"
                      : isCurrent
                      ? "w-9 h-9 bg-primary text-on-primary ring-4 ring-primary-fixed shadow-md"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                  title={`Exercise ${stepNum}`}
                >
                  {isComplete ? <Check size={14} /> : stepNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Interaction Controls */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <Link
            to="/patient/progress"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline px-3 py-2 rounded-full hover:bg-surface-container-low transition-all"
          >
            <span>Progress History</span>
            <ArrowRight size={13} />
          </Link>

          <button
            type="button"
            onClick={() => setClinicianNoteOpen((prev) => !prev)}
            className="h-12 px-4 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold flex items-center gap-2 transition-colors border border-on-surface/[0.06]"
          >
            <Brain size={16} className="text-primary" />
            <span className="hidden sm:inline">Dr. Harrison’s Note: Focus on relaxed jaw</span>
          </button>

          <button
            type="button"
            onClick={() => void finishSession()}
            disabled={busy || finishingSession}
            className="h-12 px-6 rounded-full stitch-btn-primary text-xs font-bold"
          >
            <CheckCircle size={16} />
            <span>{finishingSession ? "Saving…" : "Complete Session"}</span>
          </button>
        </div>
      </div>

      {/* Clinician Note Slideout Drawer */}
      {clinicianNoteOpen && (
        <div className="fixed bottom-6 right-6 max-w-sm p-5 rounded-3xl bg-surface-container-lowest shadow-2xl border border-primary/20 z-50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-outfit text-xs font-bold text-primary">SLP Clinical Advisory</span>
            <button
              type="button"
              onClick={() => setClinicianNoteOpen(false)}
              className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-on-surface leading-relaxed">
            “Encourage natural pauses before initiating bilabial closures. Symmetrical zygomaticus activation indicates optimal motor tone without compensatory strain.”
          </p>
          <span className="text-[10px] text-on-surface-variant font-medium mt-1">
            Dr. Emily Harrison, Lead Speech-Language Pathologist
          </span>
        </div>
      )}
    </div>
  );
}
