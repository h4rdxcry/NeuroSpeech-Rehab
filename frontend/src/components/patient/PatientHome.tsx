import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { SessionStatusBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { LevelMapModal } from './LevelMapModal';
import { MilestoneModal } from './MilestoneModal';
import { MilestoneCelebration } from './MilestoneCelebration';
import { PracticeStreakModal } from './PracticeStreakModal';
import { evaluateAttempt, SpeechEvaluationResult } from '../../utils/speechEvaluation';
import { cameraApi } from '../../api/client';
import { 
  Mic, 
  Video, 
  Volume2, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Smile, 
  Activity,
  Map,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Trophy,
  Play,
  ArrowRight,
  Camera,
  CheckCircle2,
  Sparkles,
  Flame
} from 'lucide-react';

export const PatientHome: React.FC = () => {
  const { 
    currentUser, 
    sessions, 
    patientAttempts, 
    setActiveTab, 
    rehabLevels, 
    currentLevelNumber, 
    highestUnlockedLevel,
    completedLevelNumbers,
    completeLevel,
    submitRehabAttempt,
    setCurrentLevelNumber,
    addToast,
    streakStatus,
    recordPracticeDay
  } = useApp();

  // Active level data
  const currentLevelIndex = Math.max(0, Math.min(rehabLevels.length - 1, currentLevelNumber - 1));
  const currentLevel = rehabLevels[currentLevelIndex] || rehabLevels[0];

  // Device & Media State
  const [hasPermissions, setHasPermissions] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'ready' | 'pending' | 'denied'>('pending');
  const [micStatus, setMicStatus] = useState<'ready' | 'pending' | 'denied'>('pending');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [latestLandmarks, setLatestLandmarks] = useState<number[][]>([]);
  const isTrackingRef = useRef(false);

  // Periodic frame tracking via FastAPI MediaPipe endpoint
  useEffect(() => {
    if (!hasPermissions || cameraStatus !== 'ready') return;

    const interval = setInterval(async () => {
      if (isTrackingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
      isTrackingRef.current = true;
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = 320;
        offscreen.height = 240;
        const octx = offscreen.getContext('2d');
        if (octx && videoRef.current) {
          octx.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64 = offscreen.toDataURL('image/jpeg', 0.6).split(',')[1];
          if (base64) {
            const resp = await cameraApi.trackFrame(base64);
            if (resp.status === 'TRACKED' && resp.landmarks && resp.landmarks.length > 0) {
              setFaceDetected(true);
              setLatestLandmarks(resp.landmarks);
            } else {
              setFaceDetected(false);
              setLatestLandmarks([]);
            }
          }
        }
      } catch {
        // network or server error handled gracefully
      } finally {
        isTrackingRef.current = false;
      }
    }, 400);

    return () => clearInterval(interval);
  }, [hasPermissions, cameraStatus]);

  // Attempt Lifecycle State: 'ready' | 'listening' | 'analyzing' | 'result'
  const [attemptState, setAttemptState] = useState<'ready' | 'listening' | 'analyzing' | 'result'>('ready');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // Real measured audio volume 0-100
  const [peakAudioLevel, setPeakAudioLevel] = useState(0);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // Attempt Result & Guidance
  const [evaluationResult, setEvaluationResult] = useState<SpeechEvaluationResult | null>(null);

  // Modals & Audio
  const [isLevelMapOpen, setIsLevelMapOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [milestoneLevelToShow, setMilestoneLevelToShow] = useState<number | null>(null);
  const [milestoneCelebrationLevel, setMilestoneCelebrationLevel] = useState<number | null>(null);
  const [isPlayingAudioGuidance, setIsPlayingAudioGuidance] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const recentSessions = sessions.slice(0, 3);
  const journeyPercent = Math.min(100, Math.round((completedLevelNumbers.length / 100) * 100));

  // Request camera and microphone
  const requestDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('denied');
        setMicStatus('denied');
        addToast('Device Access', 'Browser does not support media capture API.', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });

      setMediaStream(stream);
      setCameraStatus('ready');
      setMicStatus('ready');
      setHasPermissions(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Initialize Web Audio volume analyzer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((average / 128) * 100));
            setAudioLevel(normalized);
            setPeakAudioLevel(prev => Math.max(prev, normalized));
          }
          animFrameRef.current = requestAnimationFrame(checkAudio);
        };
        checkAudio();
      } catch {
        // Fallback if AudioContext blocked
      }

      addToast('Camera & Mic Active', 'Live facial tracking and speech assessment ready.', 'success');
    } catch (err: any) {
      console.warn('Media devices permission denied or unavailable:', err);
      setCameraStatus('denied');
      setMicStatus('denied');
      setHasPermissions(false);
      addToast('Permissions Needed', 'Camera and microphone access was declined.', 'warning');
    }
  };

  // Safe hardware teardown
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [mediaStream]);

  // Keep video source active if stream changes or element mounts
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(() => {});
    }
  }, [mediaStream, hasPermissions]);

  // Authentic MediaPipe lip & facial landmarks overlay rendering
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderTrackingOverlay = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (hasPermissions && cameraStatus === 'ready') {
        if (faceDetected && latestLandmarks.length >= 468) {
          const outerLips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
          const innerLips = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

          ctx.save();
          // Draw outer lips
          ctx.beginPath();
          outerLips.forEach((idx, i) => {
            const pt = latestLandmarks[idx];
            if (!pt) return;
            const px = (1 - pt[0]) * w;
            const py = pt[1] * h;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.strokeStyle = attemptState === 'listening' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Draw inner lips
          ctx.beginPath();
          innerLips.forEach((idx, i) => {
            const pt = latestLandmarks[idx];
            if (!pt) return;
            const px = (1 - pt[0]) * w;
            const py = pt[1] * h;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.strokeStyle = attemptState === 'listening' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Key articulatory points
          [0, 13, 14, 17, 61, 291, 78, 308].forEach(idx => {
            const pt = latestLandmarks[idx];
            if (!pt) return;
            const px = (1 - pt[0]) * w;
            const py = pt[1] * h;
            ctx.fillStyle = attemptState === 'listening' ? '#10B981' : '#60A5FA';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        } else {
          // Positioning guide when face is not yet tracked
          const centerX = w / 2;
          const centerY = h * 0.46;
          const radiusX = w * 0.22;
          const radiusY = h * 0.30;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(renderTrackingOverlay);
    };

    renderTrackingOverlay();
    return () => cancelAnimationFrame(animId);
  }, [hasPermissions, cameraStatus, faceDetected, latestLandmarks, attemptState]);

  // Native audio pronunciation guide
  const handleListenPhrase = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudioGuidance(true);

      const utterance = new SpeechSynthesisUtterance(currentLevel.targetText);
      utterance.lang = currentLevel.language;
      utterance.rate = 0.82;
      utterance.onend = () => setIsPlayingAudioGuidance(false);
      utterance.onerror = () => setIsPlayingAudioGuidance(false);

      window.speechSynthesis.speak(utterance);
    } else {
      addToast('Audio Guidance', 'Speech synthesis is not supported in this browser.', 'info');
    }
  };

  // Start Speech & Articulation Pronunciation Attempt
  const handleStartAttempt = () => {
    if (!hasPermissions) {
      requestDevices();
      return;
    }

    setAttemptState('listening');
    setRecordingSeconds(0);
    setPeakAudioLevel(0);
    setLastTranscript(null);
    setEvaluationResult(null);

    // Recording duration timer
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        if (prev >= currentLevel.targetDurationSec + 3) {
          handleStopAttempt();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    // Setup Web Speech Recognition with target language (ta-IN or en-IN)
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = currentLevel.language;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          if (text) {
            setLastTranscript(text);
          }
        };
        recognition.onerror = () => {};
        recognition.start();
        speechRecognitionRef.current = recognition;
      }
    } catch {
      // Fallback
    }
  };

  // Stop attempt and evaluate with authoritative backend evaluation
  const handleStopAttempt = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    setAttemptState('analyzing');

    try {
      const response = await submitRehabAttempt({
        level_number: currentLevel.level,
        target_text: currentLevel.targetText,
        language: currentLevel.language,
        recognized_transcript: lastTranscript,
        recording_duration_seconds: Math.max(recordingSeconds, 1.5),
        peak_audio_level: peakAudioLevel,
        target_vowel_type: currentLevel.targetText.slice(0, 1),
      });

      const evalResult: SpeechEvaluationResult = {
        isMatch: response.is_success,
        matchScore: response.match_score,
        feedbackMessage: response.feedback_message,
        actionableTip: response.actionable_tip || 'Focus on clear articulatory placement and phonation.',
        transcript: response.transcript || lastTranscript || '',
        speechDetected: response.speech_detected,
        acousticQuality: response.match_score >= 0.8 ? 'good' : response.match_score >= 0.5 ? 'fair' : 'poor'
      };

      setEvaluationResult(evalResult);
      setAttemptState('result');

      if (response.is_success) {
        if ([10, 25, 50, 75, 100].includes(currentLevel.level)) {
          setMilestoneCelebrationLevel(currentLevel.level);
        }
      }
    } catch (err) {
      console.warn('Backend evaluation call error, fallback to speech evaluator:', err);
      const result = evaluateAttempt(
        currentLevel.targetText,
        lastTranscript,
        peakAudioLevel,
        Math.max(recordingSeconds, 1.5),
        currentLevel.language
      );
      setEvaluationResult(result);
      setAttemptState('result');
      if (result.isMatch) {
        completeLevel(currentLevel.level, {
          exerciseId: `lvl-${currentLevel.level}`,
          transcriptDetected: result.transcript,
          speechDetected: true,
          durationSeconds: Math.max(recordingSeconds, 2),
          signalQuality: result.acousticQuality,
          attemptStatus: 'saved',
          modelVersion: currentLevel.language === 'ta-IN' ? 'Conformer-CTC-Tamil-v2.4' : 'Whisper-FineTuned-enIN'
        });
      }
    }
  }, [currentLevel, lastTranscript, peakAudioLevel, recordingSeconds, submitRehabAttempt, completeLevel]);

  // Proceed to next level
  const handleContinueNextLevel = () => {
    setAttemptState('ready');
    setEvaluationResult(null);
    setLastTranscript(null);
    setPeakAudioLevel(0);
    const nextLvl = Math.min(100, currentLevel.level + 1);
    setCurrentLevelNumber(nextLvl);
  };

  // Re-attempt current level
  const handleRetryCurrentLevel = () => {
    setAttemptState('ready');
    setEvaluationResult(null);
    setLastTranscript(null);
    setPeakAudioLevel(0);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10">
      
      {/* ======================================================== */}
      {/* 1. TOP HEADER: Welcome, Protocol & Journey Map Launcher  */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#10213A]">
              Good morning, {currentUser.name.split(' ')[0]}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#174EA6]">
              Level {currentLevel.level} of 100
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#526175] mt-0.5">
            100-Level Speech & Articulatory Rehabilitation Workspace
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Practice Streak Counter Button */}
          <button
            id="patient-home-streak-btn"
            type="button"
            onClick={() => setIsStreakModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs select-none ${
              streakStatus.hasPracticedToday
                ? 'bg-amber-500/10 border-amber-300 text-amber-900 hover:bg-amber-500/20'
                : 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100'
            }`}
            title={`Practice Streak: ${streakStatus.effectiveStreak} consecutive day${streakStatus.effectiveStreak === 1 ? '' : 's'}. ${streakStatus.hasPracticedToday ? 'Practiced today!' : 'Practice today to extend streak!'}`}
          >
            <Flame className={`w-3.5 h-3.5 ${streakStatus.hasPracticedToday ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-orange-500 fill-orange-500'}`} />
            <span className="font-extrabold">{streakStatus.effectiveStreak}</span>
            <span>{streakStatus.effectiveStreak === 1 ? 'Day Streak' : 'Days Streak'}</span>
            {streakStatus.hasPracticedToday && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 ml-0.5" />
            )}
          </button>

          {/* Enrollment Protocol Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>{currentUser.studyProtocol || 'Multimodal Speech Study'}</span>
          </div>

          {/* Quick Journey Map Modal Launcher */}
          <button
            id="open-journey-map-btn"
            type="button"
            onClick={() => setIsLevelMapOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:border-blue-300 transition-colors shadow-2xs"
          >
            <Map className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>View 100-Level Journey</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. PRIMARY WORKSPACE:                                   */}
      {/* LEFT SIDE: Camera Live Tracking & Voice Assessment     */}
      {/* RIGHT SIDE: Level Assessment & Challenge Target        */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* ====================================================== */}
        {/* LEFT COLUMN: CAMERA LIVE TRACKING THERAPY (7 cols)     */}
        {/* Integrates Camera Feed, Facial Landmarks, Audio Meter */}
        {/* ====================================================== */}
        <div className="lg:col-span-7 flex flex-col">
          <GlassCard 
            id="camera-live-tracking-section"
            padding="none" 
            className="flex flex-col h-full overflow-hidden border-slate-200/90 shadow-md bg-white/95"
          >
            {/* Camera Section Top Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#10213A] tracking-tight">
                    Live Camera & Facial Articulation Tracking
                  </h2>
                  <span className="text-[11px] text-slate-500 block">
                    Visual alignment and acoustic energy monitoring
                  </span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  hasPermissions && cameraStatus === 'ready'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    hasPermissions && cameraStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`} />
                  <span>{hasPermissions && cameraStatus === 'ready' ? 'Tracking Active' : 'Activation Needed'}</span>
                </span>
              </div>
            </div>

            {/* Video Feed & Real-Time Tracking Viewport */}
            <div className="relative bg-slate-950 aspect-4/3 sm:aspect-16/10 min-h-[320px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
              
              {hasPermissions && cameraStatus === 'ready' ? (
                <>
                  {/* Mirrored Live Video Feed */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Canvas Overlay for Subtle Landmarks & Guide Contours */}
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />

                  {/* Top Bar Indicators on Video */}
                  <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Live Feed</span>
                      </span>

                      {attemptState === 'listening' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-[10px] font-bold text-white animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>LISTENING • 00:0{recordingSeconds}</span>
                        </span>
                      )}
                    </div>

                    {/* Facial Tracking Status */}
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-semibold text-white border border-white/10">
                      <Smile className="w-3 h-3 text-teal-400" />
                      <span>Face & Lip Tracking</span>
                    </div>
                  </div>

                  {/* Center: Face Guidance Positioning Cue */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className={`w-44 sm:w-52 h-56 sm:h-64 rounded-[46%] border-2 transition-all duration-300 ${
                      attemptState === 'listening'
                        ? 'border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        : 'border-white/35 shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                    }`} />
                    <span className="text-[10px] font-medium text-white/75 mt-2 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      Position face inside frame
                    </span>
                  </div>

                  {/* Bottom: Real Measured Audio Volume Bar */}
                  <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md rounded-xl p-2.5 flex items-center gap-2.5 border border-white/10">
                    <Mic className={`w-4 h-4 shrink-0 transition-colors ${
                      audioLevel > 18 ? 'text-emerald-400' : 'text-slate-300'
                    }`} />

                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                        <span>Microphone Level</span>
                        <span>{audioLevel > 18 ? 'Speech Activity Detected' : 'Ambient / Quiet'}</span>
                      </div>
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-75 rounded-full ${
                            audioLevel > 45 ? 'bg-emerald-400' : audioLevel > 18 ? 'bg-blue-400' : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.max(4, audioLevel)}%` }}
                        />
                      </div>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-white w-7 text-right">
                      {audioLevel}%
                    </span>
                  </div>
                </>
              ) : (
                /* Permission Prompt when Camera & Mic are inactive */
                <div className="p-6 text-center flex flex-col items-center justify-center max-w-sm">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3 ring-8 ring-blue-500/10">
                    <Video className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Activate Camera & Microphone
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-5">
                    Connect your webcam and microphone to assess pronunciation accuracy, monitor lip opening, and progress through Level {currentLevel.level}.
                  </p>

                  <button
                    id="activate-camera-btn"
                    type="button"
                    onClick={requestDevices}
                    className="px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Video className="w-4 h-4" />
                    <span>Enable Camera & Voice</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Controls: Unified Voice & Camera Assessment Trigger */}
            <div className="p-4 sm:p-5 flex flex-col gap-2.5 bg-white">
              {attemptState === 'listening' ? (
                /* Active Recording State: Prominent Stop Button */
                <button
                  id="stop-speaking-btn"
                  type="button"
                  onClick={handleStopAttempt}
                  className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-md animate-pulse active:scale-[0.98] transition-all"
                >
                  <div className="w-3.5 h-3.5 rounded-xs bg-white" />
                  <span>Stop Speaking & Assess (00:0{recordingSeconds})</span>
                </button>
              ) : attemptState === 'analyzing' ? (
                /* Analyzing State */
                <button
                  disabled
                  className="w-full py-4 px-6 rounded-2xl bg-blue-50 border border-blue-200 text-[#2563EB] font-bold text-base flex items-center justify-center gap-2.5 cursor-wait"
                >
                  <Activity className="w-5 h-5 animate-spin" />
                  <span>Analyzing Vocal & Articulatory Quality...</span>
                </button>
              ) : (
                /* Ready State */
                <button
                  id="start-assessment-btn"
                  type="button"
                  onClick={handleStartAttempt}
                  className="w-full py-4 px-6 rounded-2xl bg-[#2563EB] hover:bg-[#174EA6] text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <Mic className="w-5 h-5" />
                  <span>
                    {hasPermissions 
                      ? `Assess Level ${currentLevel.level} (Voice & Camera)` 
                      : 'Connect Devices & Start Assessment'}
                  </span>
                </button>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Maintain face in center oval while pronouncing clearly</span>
                {hasPermissions && (
                  <button
                    type="button"
                    onClick={requestDevices}
                    className="text-[#2563EB] hover:underline font-semibold"
                  >
                    Reset Camera Feed
                  </button>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* ====================================================== */}
        {/* RIGHT COLUMN: LEVEL ASSESSMENT & CHALLENGE (5 cols)    */}
        {/* Current Level, Phonetics, Audio Guide, Results & Stepper*/}
        {/* ====================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <GlassCard 
            id="level-assessment-challenge-card"
            padding="lg" 
            className={`flex flex-col justify-between h-full transition-all duration-300 ${
              evaluationResult?.isMatch 
                ? 'border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.14)] bg-emerald-50/20' 
                : 'bg-white/95'
            }`}
          >
            <div className="flex flex-col gap-4">
              
              {/* Level Category & Stage Badges */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold tracking-wider text-[#2563EB] uppercase bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                  Level {currentLevel.level} • {currentLevel.stage}
                </span>

                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  currentLevel.language === 'ta-IN' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                }`}>
                  {currentLevel.language === 'ta-IN' ? '🇮🇳 Tamil' : '🇬🇧 English'}
                </span>
              </div>

              {/* TARGET PRONUNCIATION DISPLAY */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-50/70 via-white to-indigo-50/25 border border-blue-100/80 flex flex-col gap-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pronunciation Target
                  </span>

                  {/* Audio Reference Native Player */}
                  <button
                    type="button"
                    onClick={handleListenPhrase}
                    disabled={isPlayingAudioGuidance}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                      isPlayingAudioGuidance 
                        ? 'bg-blue-100 text-[#2563EB] border-blue-300 animate-pulse' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title="Listen to native pronunciation"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{isPlayingAudioGuidance ? 'Playing...' : 'Listen'}</span>
                  </button>
                </div>

                {/* Target text (Massive high contrast display) */}
                <h2 className={`text-3xl sm:text-4xl font-extrabold text-[#10213A] tracking-tight leading-snug select-text ${
                  currentLevel.language === 'ta-IN' ? 'font-tamil' : ''
                }`}>
                  "{currentLevel.targetText}"
                </h2>

                {/* Phonetic guide and meaning */}
                <div className="flex flex-col gap-0.5 mt-1 border-t border-blue-100/60 pt-2">
                  <span className="text-sm font-bold text-[#2563EB] tracking-normal">
                    {currentLevel.phoneticGuide}
                  </span>
                  <span className="text-xs text-[#526175] italic">
                    “{currentLevel.meaning}”
                  </span>
                </div>
              </div>

              {/* Articulatory Helper & Clinical Prompt */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-800">
                  Articulation Focus:
                </span>
                <p className="text-xs text-[#526175] leading-relaxed">
                  {currentLevel.guidanceTip}
                </p>
              </div>

              {/* ==================================================== */}
              {/* REAL-TIME ASSESSMENT RESULTS                         */}
              {/* ==================================================== */}
              {attemptState === 'result' && evaluationResult && (
                <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 animate-in fade-in duration-200 ${
                  evaluationResult.isMatch 
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {evaluationResult.isMatch ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}

                    <div className="flex flex-col">
                      <span className="text-sm font-bold">
                        {evaluationResult.isMatch ? 'Level Satisfied! Success.' : "Let's try that once more."}
                      </span>
                      <span className="text-xs opacity-85">
                        {evaluationResult.feedbackMessage}
                      </span>
                    </div>
                  </div>

                  {/* Captured words if available */}
                  {evaluationResult.transcript && (
                    <div className="p-2 rounded-xl bg-white/80 border border-slate-200/60 text-xs">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Speech Heard</span>
                      <span className="text-sm font-bold text-[#10213A]">
                        "{evaluationResult.transcript}"
                      </span>
                    </div>
                  )}

                  {/* Actionable Tip for retry */}
                  {!evaluationResult.isMatch && evaluationResult.actionableTip && (
                    <p className="text-xs text-amber-800 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/50">
                      💡 {evaluationResult.actionableTip}
                    </p>
                  )}
                </div>
              )}

              {/* Progression Success Action */}
              {evaluationResult?.isMatch && (
                <button
                  id="advance-next-level-btn"
                  type="button"
                  onClick={handleContinueNextLevel}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#0F9F94] hover:bg-[#0c8279] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                >
                  <span>Advance to Level {Math.min(100, currentLevel.level + 1)}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 100-Level Permanent Progression Card Footer */}
            <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-slate-100">
              
              {/* Progress Bar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>100-Level Journey Progress</span>
                  <span className="text-[#2563EB] font-bold">
                    {completedLevelNumbers.length} / 100 Done ({journeyPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
                  <div 
                    className="h-full bg-gradient-to-r from-[#2563EB] to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${journeyPercent}%` }}
                  />
                </div>
              </div>

              {/* Prev / Next Level Manual Stepper */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (currentLevel.level > 1) {
                      setAttemptState('ready');
                      setEvaluationResult(null);
                      setCurrentLevelNumber(currentLevel.level - 1);
                    }
                  }}
                  disabled={currentLevel.level <= 1}
                  className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Level {currentLevel.level - 1}</span>
                </button>

                <span className="font-semibold text-slate-600">
                  {completedLevelNumbers.includes(currentLevel.level) ? '✓ Completed' : 'Active Target'}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (currentLevel.level < highestUnlockedLevel) {
                      setAttemptState('ready');
                      setEvaluationResult(null);
                      setCurrentLevelNumber(currentLevel.level + 1);
                    }
                  }}
                  disabled={currentLevel.level >= highestUnlockedLevel}
                  className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none font-medium"
                >
                  <span>Level {currentLevel.level + 1}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CLINICAL STATISTICS ROW                               */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <GlassCard padding="sm" className="flex flex-col bg-white/95">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Levels Done
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-[#10213A] mt-1">
            {completedLevelNumbers.length}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">out of 100 levels</span>
        </GlassCard>

        <GlassCard padding="sm" className="flex flex-col bg-white/95">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Current Stage
          </span>
          <span className="text-base sm:text-lg font-bold text-[#10213A] mt-2 truncate">
            {currentLevel.stage}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Level {currentLevel.level}</span>
        </GlassCard>

        <GlassCard padding="sm" className="flex flex-col bg-white/95">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Vocal Attempts
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-[#10213A] mt-1">
            {patientAttempts.length > 0 ? patientAttempts.length : completedLevelNumbers.length}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Acoustic evaluations</span>
        </GlassCard>

        <GlassCard padding="sm" className="flex flex-col bg-white/95">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Completed Sessions
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-[#10213A] mt-1">
            {completedSessions.length}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Sessions logged</span>
        </GlassCard>
      </div>

      {/* ======================================================== */}
      {/* 4. UPCOMING PRACTICE LEVELS                              */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-[#10213A]">
            Upcoming Practice Levels
          </h3>
          <button
            type="button"
            onClick={() => setIsLevelMapOpen(true)}
            className="text-xs sm:text-sm font-semibold text-[#2563EB] hover:text-[#174EA6] inline-flex items-center gap-1"
          >
            <span>View all 100 levels</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rehabLevels.slice(currentLevelIndex, currentLevelIndex + 3).map((lvl) => (
            <div 
              key={lvl.level}
              onClick={() => {
                if (lvl.level <= highestUnlockedLevel) {
                  setCurrentLevelNumber(lvl.level);
                  setAttemptState('ready');
                  setEvaluationResult(null);
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                lvl.level === currentLevel.level
                  ? 'bg-blue-50/80 border-[#2563EB]/40 shadow-xs ring-2 ring-[#2563EB]/30'
                  : lvl.level <= highestUnlockedLevel
                    ? 'bg-white border-slate-200/80 hover:border-blue-200'
                    : 'bg-slate-50/50 border-slate-200/50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#2563EB]">Level {lvl.level}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  lvl.language === 'ta-IN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {lvl.languageName}
                </span>
              </div>
              <h4 className={`text-base font-bold text-[#10213A] ${
                lvl.language === 'ta-IN' ? 'font-tamil' : ''
              }`}>
                {lvl.targetText}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {lvl.phoneticGuide} • “{lvl.meaning}”
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. RECENT SESSIONS AUDIT LIST                            */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-[#10213A]">
            Recent Practice Sessions
          </h3>
          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className="text-xs sm:text-sm font-semibold text-[#2563EB] hover:text-[#174EA6] inline-flex items-center gap-1"
          >
            <span>View full history</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {recentSessions.map(session => (
            <div
              key={session.id}
              className="p-4 rounded-xl bg-white border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-sm">
                  #{session.sessionNumber}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#10213A]">
                      Session #{session.sessionNumber}
                    </span>
                    <SessionStatusBadge status={session.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {session.date} • {session.time}
                    </span>
                    <span>• {session.attemptsCount} attempts</span>
                    <span>• {session.durationMinutes} min</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className="self-end sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold text-[#2563EB] bg-[#EAF2FF] hover:bg-blue-100 transition-colors"
              >
                Review details
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Research Notice */}
      <ResearchDisclaimer />

      {/* ======================================================== */}
      {/* 6. MODALS: 100-Level Journey Map & Stage Milestones      */}
      {/* ======================================================== */}
      <LevelMapModal
        isOpen={isLevelMapOpen}
        onClose={() => setIsLevelMapOpen(false)}
        onSelectLevel={(lvlNum) => {
          setCurrentLevelNumber(lvlNum);
          setAttemptState('ready');
          setEvaluationResult(null);
          setIsLevelMapOpen(false);
        }}
      />

      {/* Non-intrusive Milestone Celebration message */}
      <MilestoneCelebration
        level={milestoneCelebrationLevel || 10}
        isOpen={milestoneCelebrationLevel !== null}
        onClose={() => setMilestoneCelebrationLevel(null)}
        onContinuePractice={() => {
          setMilestoneCelebrationLevel(null);
          handleContinueNextLevel();
        }}
        onViewDetails={() => {
          setMilestoneLevelToShow(milestoneCelebrationLevel);
          setMilestoneCelebrationLevel(null);
        }}
        position="bottom-right"
      />

      {milestoneLevelToShow !== null && (
        <MilestoneModal
          isOpen={true}
          level={milestoneLevelToShow}
          onClose={() => setMilestoneLevelToShow(null)}
          onViewProgress={() => {
            setMilestoneLevelToShow(null);
            setActiveTab('progress');
          }}
          onContinueNextLevel={() => {
            setMilestoneLevelToShow(null);
            handleContinueNextLevel();
          }}
          onPracticeAgain={() => {
            setMilestoneLevelToShow(null);
            handleContinueNextLevel();
          }}
          totalAttempts={patientAttempts.length}
          completedCount={completedLevelNumbers.length}
        />
      )}

      {/* Practice Streak Detail & Habit History Modal */}
      <PracticeStreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        currentUser={currentUser}
        streakStatus={streakStatus}
        onRecordPractice={() => {
          const res = recordPracticeDay();
          if (res.isNewDay) {
            addToast(
              'Practice Logged! 🔥',
              `You've reached a ${res.streakCount}-day practice streak!`,
              'success'
            );
          } else {
            addToast('Practice Active', 'Your practice streak is already secured for today.', 'info');
          }
        }}
      />
    </div>
  );
};
