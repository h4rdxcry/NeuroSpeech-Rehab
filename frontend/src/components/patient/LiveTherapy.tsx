import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ConfirmModal } from '../common/ConfirmModal';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { LevelMapModal } from './LevelMapModal';
import { MilestoneModal } from './MilestoneModal';
import { MilestoneCelebration } from './MilestoneCelebration';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { PracticeStreakModal } from './PracticeStreakModal';
import { evaluateAttempt, SpeechEvaluationResult } from '../../utils/speechEvaluation';
import { cameraApi } from '../../api/client';
import { 
  Mic, 
  Video, 
  Volume2, 
  VolumeX,
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  ArrowLeft, 
  Smile, 
  Activity,
  Map,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  HelpCircle,
  Flame
} from 'lucide-react';

export const LiveTherapy: React.FC = () => {
  const { 
    rehabLevels, 
    currentLevelNumber, 
    highestUnlockedLevel, 
    completedLevelNumbers, 
    completeLevel,
    submitRehabAttempt, 
    setCurrentLevelNumber,
    resetLevelProgress,
    finishCurrentSession,
    setActiveTab,
    addToast,
    accessibility,
    updateAccessibility,
    currentUser,
    streakStatus,
    recordPracticeDay
  } = useApp();

  // Active level data (1-indexed, so level 1 is index 0)
  const currentLevelIndex = Math.max(0, Math.min(rehabLevels.length - 1, currentLevelNumber - 1));
  const currentLevel = rehabLevels[currentLevelIndex] || rehabLevels[0];

  // Device & Media State
  const [hasPermissions, setHasPermissions] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'ready' | 'pending' | 'denied'>('pending');
  const [micStatus, setMicStatus] = useState<'ready' | 'pending' | 'denied'>('pending');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  
  // Attempt Lifecycle State: 'ready' | 'listening' | 'analyzing' | 'result'
  const [attemptState, setAttemptState] = useState<'ready' | 'listening' | 'analyzing' | 'result'>('ready');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // Real measured audio volume 0-100
  const [peakAudioLevel, setPeakAudioLevel] = useState(0);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // Attempt Result & Guidance
  const [evaluationResult, setEvaluationResult] = useState<SpeechEvaluationResult | null>(null);

  // Modals & Navigation
  const [isLevelMapOpen, setIsLevelMapOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [milestoneLevelToShow, setMilestoneLevelToShow] = useState<number | null>(null);
  const [milestoneCelebrationLevel, setMilestoneCelebrationLevel] = useState<number | null>(null);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isPlayingAudioGuidance, setIsPlayingAudioGuidance] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');

  // Real Face Detection & MediaPipe Articulatory Tracking
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

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Overall journey percentage
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

      addToast('Devices Active', 'Camera and microphone connected.', 'success');
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

  // Audio Guidance (Listen to native pronunciation)
  const handleListenPhrase = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudioGuidance(true);

      const utterance = new SpeechSynthesisUtterance(currentLevel.targetText);
      utterance.lang = currentLevel.language;
      utterance.rate = 0.82; // Deliberate articulatory tempo
      utterance.onend = () => setIsPlayingAudioGuidance(false);
      utterance.onerror = () => setIsPlayingAudioGuidance(false);

      window.speechSynthesis.speak(utterance);
    } else {
      addToast('Audio Guidance', 'Speech synthesis is not supported in this browser.', 'info');
    }
  };

  // Simple, calm verbal confirmation after a successful pronunciation attempt
  const speakCalmSuccessConfirmation = useCallback((lang: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();

      // Simple, calm affirming phrases tailored to language for motor speech practice
      const isTamil = lang === 'ta-IN';
      const phrases = isTamil
        ? ['மிக நன்று.', 'அற்புதம்.', 'சிறப்பான உச்சரிப்பு.', 'நன்று.']
        : ['Well done.', 'Great pronunciation.', 'Nicely done.', 'Very good.', 'Excellent.'];

      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = lang;
      utterance.rate = 0.85; // Calm, gentle, unhurried tempo
      utterance.pitch = 1.0;
      utterance.volume = 0.85;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchingVoice = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
      setSrAnnouncement(`Calm verbal confirmation: ${phrase}`);
    } catch {
      // Graceful fallback
    }
  }, []);

  // Toggle optional calm verbal confirmation accessibility setting
  const toggleVerbalConfirmation = useCallback(() => {
    const nextVal = !accessibility.verbalConfirmation;
    updateAccessibility({ verbalConfirmation: nextVal });
    if (nextVal) {
      addToast('Accessibility', 'Calm verbal confirmation enabled. Gentle spoken affirmations will play after each successful attempt.', 'success');
      setSrAnnouncement('Calm verbal confirmation enabled.');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const testMsg = new SpeechSynthesisUtterance('Voice confirmation enabled.');
          testMsg.rate = 0.88;
          window.speechSynthesis.speak(testMsg);
        } catch {}
      }
    } else {
      addToast('Accessibility', 'Calm verbal confirmation disabled.', 'info');
      setSrAnnouncement('Calm verbal confirmation disabled.');
    }
  }, [accessibility.verbalConfirmation, updateAccessibility, addToast]);

  // Start Speech Pronunciation Attempt
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
          // Bounded max duration
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
      // Speech recognition fallback
    }
  };

  // Stop attempt and evaluate with authentic criteria
  const handleStopAttempt = useCallback(() => {
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

    // Run real evaluation using measured audio level, transcript, and target text
    setTimeout(() => {
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
        // Legitimate completion: mark level completed in persistent state and unlock next level
        completeLevel(currentLevel.level, {
          exerciseId: `lvl-${currentLevel.level}`,
          transcriptDetected: result.transcript,
          speechDetected: true,
          durationSeconds: Math.max(recordingSeconds, 2),
          signalQuality: result.acousticQuality,
          attemptStatus: 'saved',
          modelVersion: currentLevel.language === 'ta-IN' ? 'Conformer-CTC-Tamil-v2.4' : 'Whisper-FineTuned-enIN'
        });

        // If optional verbal confirmation accessibility setting is enabled, provide calm spoken affirmation
        if (verbalConfirmationRef.current) {
          speakCalmSuccessConfirmation(currentLevel.language);
        }

        // Check if this level is a milestone (10, 25, 50, 75, 100)
        if ([10, 25, 50, 75, 100].includes(currentLevel.level)) {
          setMilestoneCelebrationLevel(currentLevel.level);
        }
      } else {
        // Record non-passing attempt for research/clinician record
        completeLevel(currentLevel.level, {
          exerciseId: `lvl-${currentLevel.level}`,
          transcriptDetected: result.transcript || '',
          speechDetected: result.speechDetected,
          durationSeconds: Math.max(recordingSeconds, 1),
          signalQuality: result.acousticQuality,
          attemptStatus: result.speechDetected ? 'saved' : 'no_speech'
        });
      }
    }, 1100);
  }, [currentLevel, lastTranscript, peakAudioLevel, recordingSeconds, completeLevel,
    submitRehabAttempt, speakCalmSuccessConfirmation]);

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

  // Navigate to previous unlocked level
  const handlePrevLevel = () => {
    if (currentLevel.level > 1) {
      setAttemptState('ready');
      setEvaluationResult(null);
      setLastTranscript(null);
      setCurrentLevelNumber(currentLevel.level - 1);
    }
  };

  // Exit practice confirmation
  const handleExitPractice = () => {
    setIsExitConfirmOpen(true);
  };

  const handleConfirmExit = () => {
    finishCurrentSession();
    setIsExitConfirmOpen(false);
    setActiveTab('home');
  };

  // Fresh references to prevent stale closures in global keyboard event listener
  const attemptStateRef = useRef(attemptState);
  attemptStateRef.current = attemptState;

  const evaluationResultRef = useRef(evaluationResult);
  evaluationResultRef.current = evaluationResult;

  const hasPermissionsRef = useRef(hasPermissions);
  hasPermissionsRef.current = hasPermissions;

  const isLevelMapOpenRef = useRef(isLevelMapOpen);
  isLevelMapOpenRef.current = isLevelMapOpen;

  const milestoneLevelToShowRef = useRef(milestoneLevelToShow);
  milestoneLevelToShowRef.current = milestoneLevelToShow;

  const milestoneCelebrationLevelRef = useRef(milestoneCelebrationLevel);
  milestoneCelebrationLevelRef.current = milestoneCelebrationLevel;

  const isExitConfirmOpenRef = useRef(isExitConfirmOpen);
  isExitConfirmOpenRef.current = isExitConfirmOpen;

  const isShortcutsModalOpenRef = useRef(isShortcutsModalOpen);
  isShortcutsModalOpenRef.current = isShortcutsModalOpen;

  const isStreakModalOpenRef = useRef(isStreakModalOpen);
  isStreakModalOpenRef.current = isStreakModalOpen;

  const currentLevelRef = useRef(currentLevel);
  currentLevelRef.current = currentLevel;

  const highestUnlockedLevelRef = useRef(highestUnlockedLevel);
  highestUnlockedLevelRef.current = highestUnlockedLevel;

  const handleStartAttemptRef = useRef(handleStartAttempt);
  handleStartAttemptRef.current = handleStartAttempt;

  const handleStopAttemptRef = useRef(handleStopAttempt);
  handleStopAttemptRef.current = handleStopAttempt;

  const handleContinueNextLevelRef = useRef(handleContinueNextLevel);
  handleContinueNextLevelRef.current = handleContinueNextLevel;

  const handleRetryCurrentLevelRef = useRef(handleRetryCurrentLevel);
  handleRetryCurrentLevelRef.current = handleRetryCurrentLevel;

  const handlePrevLevelRef = useRef(handlePrevLevel);
  handlePrevLevelRef.current = handlePrevLevel;

  const handleListenPhraseRef = useRef(handleListenPhrase);
  handleListenPhraseRef.current = handleListenPhrase;

  const requestDevicesRef = useRef(requestDevices);
  requestDevicesRef.current = requestDevices;

  const verbalConfirmationRef = useRef(accessibility.verbalConfirmation);
  verbalConfirmationRef.current = accessibility.verbalConfirmation;

  const toggleVerbalConfirmationRef = useRef(toggleVerbalConfirmation);
  toggleVerbalConfirmationRef.current = toggleVerbalConfirmation;

  // Global Keyboard Shortcuts Event Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Accessibility guard: do not interfere when user is typing in a form input
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (
          tag === 'input' || 
          tag === 'textarea' || 
          tag === 'select' || 
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      // Avoid blocking standard OS/browser shortcuts (Cmd/Ctrl/Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // 2. SPACEBAR: Toggle Microphone (Start / Stop)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent default page scrolling

        // Modal guards
        if (isShortcutsModalOpenRef.current) return;
        if (isLevelMapOpenRef.current) return;
        if (isStreakModalOpenRef.current) return;
        if (isExitConfirmOpenRef.current) return;

        // If milestone modal is open, Space advances
        if (milestoneLevelToShowRef.current !== null) {
          setMilestoneLevelToShow(null);
          handleContinueNextLevelRef.current();
          setSrAnnouncement('Continuing to next level.');
          return;
        }

        // If devices are not enabled yet, activate them
        if (!hasPermissionsRef.current) {
          requestDevicesRef.current();
          setSrAnnouncement('Activating camera and microphone.');
          return;
        }

        if (attemptStateRef.current === 'listening') {
          handleStopAttemptRef.current();
          setSrAnnouncement('Microphone stopped. Evaluating speech attempt.');
        } else if (attemptStateRef.current === 'ready') {
          handleStartAttemptRef.current();
          setSrAnnouncement('Microphone listening. Speak clearly into the microphone.');
        } else if (attemptStateRef.current === 'result') {
          if (evaluationResultRef.current?.isMatch) {
            handleContinueNextLevelRef.current();
            setSrAnnouncement(`Advancing to Level ${Math.min(100, currentLevelRef.current.level + 1)}.`);
          } else {
            handleRetryCurrentLevelRef.current();
            setSrAnnouncement(`Ready to re-practice Level ${currentLevelRef.current.level}.`);
          }
        }
        return;
      }

      // 3. ENTER: Proceed to next level / Primary Confirmation
      if (e.code === 'Enter' || e.key === 'Enter') {
        // If shortcuts modal is open, dismiss it
        if (isShortcutsModalOpenRef.current) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
          setSrAnnouncement('Keyboard shortcuts guide closed.');
          return;
        }

        // If milestone celebration modal is open, advance
        if (milestoneLevelToShowRef.current !== null) {
          e.preventDefault();
          setMilestoneLevelToShow(null);
          handleContinueNextLevelRef.current();
          setSrAnnouncement('Advancing to next level.');
          return;
        }

        // If result is shown and user passed the level, advance to next level
        if (attemptStateRef.current === 'result' && evaluationResultRef.current?.isMatch) {
          e.preventDefault();
          handleContinueNextLevelRef.current();
          setSrAnnouncement(`Advancing to Level ${Math.min(100, currentLevelRef.current.level + 1)}.`);
          return;
        }

        // If devices are not enabled yet, activate them
        if (!hasPermissionsRef.current) {
          e.preventDefault();
          requestDevicesRef.current();
          setSrAnnouncement('Activating camera and microphone.');
          return;
        }

        // In ready state, Enter also triggers speech attempt
        if (attemptStateRef.current === 'ready') {
          e.preventDefault();
          handleStartAttemptRef.current();
          setSrAnnouncement('Microphone listening. Speak clearly into the microphone.');
          return;
        }

        // In result state that didn't pass, Enter allows quick retry
        if (attemptStateRef.current === 'result' && !evaluationResultRef.current?.isMatch) {
          e.preventDefault();
          handleRetryCurrentLevelRef.current();
          setSrAnnouncement(`Ready to re-practice Level ${currentLevelRef.current.level}.`);
          return;
        }
        return;
      }

      // 4. 'R' / 'r': Retry / Re-practice level
      if (e.key === 'r' || e.key === 'R') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        e.preventDefault();
        handleRetryCurrentLevelRef.current();
        setSrAnnouncement(`Ready to re-practice Level ${currentLevelRef.current.level}.`);
        return;
      }

      // 5. 'L' / 'l': Listen to audio pronunciation example
      if (e.key === 'l' || e.key === 'L') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        e.preventDefault();
        handleListenPhraseRef.current();
        setSrAnnouncement(`Playing audio pronunciation guide for ${currentLevelRef.current.targetText}.`);
        return;
      }

      // 6. 'V' / 'v': Toggle Optional Calm Verbal Confirmation
      if (e.key === 'v' || e.key === 'V') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        e.preventDefault();
        toggleVerbalConfirmationRef.current();
        return;
      }

      // 7. 'S' / 's': Toggle Practice Streak modal
      if (e.key === 's' || e.key === 'S') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        e.preventDefault();
        setIsStreakModalOpen(prev => !prev);
        setSrAnnouncement('Toggled practice streak habit tracker.');
        return;
      }

      // 8. 'M' / 'm': Toggle 100-Level Journey Map
      if (e.key === 'm' || e.key === 'M') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current || isStreakModalOpenRef.current) return;
        e.preventDefault();
        setIsLevelMapOpen(prev => !prev);
        setSrAnnouncement('Toggled 100-level journey map.');
        return;
      }

      // 7. '?' or Shift + '/': Toggle Keyboard Shortcuts Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
        setSrAnnouncement('Toggled keyboard shortcuts guide.');
        return;
      }

      // 8. ArrowLeft: Previous Level
      if (e.key === 'ArrowLeft') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        if (currentLevelRef.current.level > 1 && attemptStateRef.current !== 'listening') {
          e.preventDefault();
          handlePrevLevelRef.current();
          setSrAnnouncement(`Navigated to Level ${currentLevelRef.current.level - 1}.`);
        }
        return;
      }

      // 9. ArrowRight: Next Level (if unlocked)
      if (e.key === 'ArrowRight') {
        if (isShortcutsModalOpenRef.current || isLevelMapOpenRef.current || isExitConfirmOpenRef.current) return;
        if (currentLevelRef.current.level < highestUnlockedLevelRef.current && attemptStateRef.current !== 'listening') {
          e.preventDefault();
          setAttemptState('ready');
          setEvaluationResult(null);
          setLastTranscript(null);
          setCurrentLevelNumber(currentLevelRef.current.level + 1);
          setSrAnnouncement(`Navigated to Level ${currentLevelRef.current.level + 1}.`);
        }
        return;
      }

      // 10. ESCAPE: Close active modal
      if (e.key === 'Escape') {
        if (isStreakModalOpenRef.current) {
          e.preventDefault();
          setIsStreakModalOpen(false);
          setSrAnnouncement('Practice streak details dismissed.');
        } else if (isShortcutsModalOpenRef.current) {
          e.preventDefault();
          setIsShortcutsModalOpen(false);
          setSrAnnouncement('Shortcuts guide dismissed.');
        } else if (isLevelMapOpenRef.current) {
          e.preventDefault();
          setIsLevelMapOpen(false);
          setSrAnnouncement('Journey map dismissed.');
        } else if (milestoneCelebrationLevelRef.current !== null) {
          e.preventDefault();
          setMilestoneCelebrationLevel(null);
          setSrAnnouncement('Milestone celebration message dismissed.');
        } else if (milestoneLevelToShowRef.current !== null) {
          e.preventDefault();
          setMilestoneLevelToShow(null);
          setSrAnnouncement('Milestone dialog dismissed.');
        } else if (isExitConfirmOpenRef.current) {
          e.preventDefault();
          setIsExitConfirmOpen(false);
          setSrAnnouncement('Exit dialogue cancelled.');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setCurrentLevelNumber]);

  // If devices not permitted yet, show accessible permission prompt
  if (!hasPermissions) {
    return (
      <div className="max-w-2xl mx-auto w-full py-8 flex flex-col gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#2563EB] bg-blue-50 px-3 py-1 rounded-full">
            Rehabilitation Readiness Check
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#10213A] mt-2">
            Let's activate your practice devices
          </h1>
          <p className="text-sm sm:text-base text-[#526175] mt-1">
            The 100-level pronunciation journey requires camera positioning for facial tracking and microphone access for speech capture.
          </p>
        </div>

        <GlassCard padding="lg" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#10213A] block">Camera</span>
                  <span className="text-xs text-slate-500">Lip movement & alignment</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                cameraStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {cameraStatus === 'ready' ? 'Ready' : 'Access Needed'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#10213A] block">Microphone</span>
                  <span className="text-xs text-slate-500">Speech & volume analysis</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                micStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {micStatus === 'ready' ? 'Ready' : 'Access Needed'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Your live camera and audio feeds are processed locally inside your browser session for rehabilitation feedback.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                id="enable-devices-btn"
                type="button"
                onClick={requestDevices}
                aria-keyshortcuts="Enter Space"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Video className="w-4 h-4" />
                <span>Allow Camera & Microphone</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white/20 text-white rounded-md ml-1">
                  Enter ↵
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Back to Home
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="View Keyboard Shortcuts"
              aria-keyshortcuts="?"
            >
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              <span>Shortcuts</span>
              <kbd className="px-1 py-0.2 text-[10px] font-mono bg-slate-100 rounded text-slate-500">?</kbd>
            </button>
          </div>
        </GlassCard>

        <ResearchDisclaimer />

        <KeyboardShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
        />

        {/* Accessible live region for screen readers */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {srAnnouncement}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto w-full pb-8">
      {/* ======================================================== */}
      {/* 1. THERAPY TOP HUD: Minimal, Focused, 100-Level Progress */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white/90 backdrop-blur-md px-4 sm:px-5 py-3 rounded-2xl border border-slate-200/80 shadow-2xs gap-3">
        {/* Left: Exit control */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExitPractice}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Practice</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {currentLevel.stage}
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-sm font-extrabold text-[#10213A]">
              Level {currentLevel.level} of 100
            </span>
          </div>
        </div>

        {/* Center: 100-Level Permanent Progress Bar */}
        <div className="flex-1 max-w-xs sm:max-w-sm mx-auto flex flex-col gap-1 w-full">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Progress: {completedLevelNumbers.length} / 100 Completed</span>
            <span className="text-[#2563EB] font-bold">{journeyPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
            <div 
              className="h-full bg-gradient-to-r from-[#2563EB] to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${journeyPercent}%` }}
            />
          </div>
        </div>

        {/* Right: Active Language + Practice Streak + Voice Confirmation + View Journey Map + Keyboard Shortcuts */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap sm:flex-nowrap">
          {/* Active Language Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#174EA6]">
            <span>{currentLevel.language === 'ta-IN' ? '🇮🇳' : '🇬🇧'}</span>
            <span>{currentLevel.languageName}</span>
          </div>

          {/* Practice Streak Counter in Therapy HUD */}
          <button
            id="therapy-hud-streak-btn"
            type="button"
            onClick={() => setIsStreakModalOpen(true)}
            aria-keyshortcuts="S"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs select-none ${
              streakStatus.hasPracticedToday
                ? 'bg-amber-500/10 border-amber-300 text-amber-900 hover:bg-amber-500/20 dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-300'
                : 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100/80 dark:bg-orange-950/30 dark:border-orange-800/50 dark:text-orange-300'
            }`}
            title={`Practice Streak: ${streakStatus.effectiveStreak} consecutive day${streakStatus.effectiveStreak === 1 ? '' : 's'}. ${streakStatus.hasPracticedToday ? 'Practiced today!' : 'Practice today to extend your streak!'} Press S or click to view details.`}
          >
            <Flame className={`w-3.5 h-3.5 ${streakStatus.hasPracticedToday ? 'text-amber-500 fill-amber-500 animate-pulse' : 'text-orange-500 fill-orange-500'}`} />
            <span className="font-extrabold text-amber-950 dark:text-amber-200">{streakStatus.effectiveStreak}</span>
            <span className="hidden sm:inline font-semibold text-amber-800 dark:text-amber-300">
              {streakStatus.effectiveStreak === 1 ? 'Day Streak' : 'Days Streak'}
            </span>
            <span className="sm:hidden font-semibold text-amber-800 dark:text-amber-300">d</span>
            {streakStatus.hasPracticedToday ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 ml-0.5" title="Practiced today" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" title="Ready to extend today" />
            )}
            <kbd className="hidden lg:inline-block px-1 py-0.2 text-[10px] font-mono bg-amber-100/80 dark:bg-amber-900/60 rounded text-amber-700 dark:text-amber-300">S</kbd>
          </button>

          {/* Optional Accessibility Setting: Calm Verbal Confirmation Toggle */}
          <button
            id="live-therapy-voice-confirm-btn"
            type="button"
            onClick={toggleVerbalConfirmation}
            aria-pressed={!!accessibility.verbalConfirmation}
            aria-keyshortcuts="V"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
              accessibility.verbalConfirmation
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title={`Calm Verbal Confirmation: ${accessibility.verbalConfirmation ? 'Enabled (spoken affirmations will play after successful pronunciation)' : 'Disabled'}. Press V to toggle.`}
          >
            {accessibility.verbalConfirmation ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">Voice Confirm</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
              accessibility.verbalConfirmation ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-500'
            }`}>
              {accessibility.verbalConfirmation ? 'ON' : 'OFF'}
            </span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 text-[10px] font-mono bg-slate-100/90 rounded text-slate-400">V</kbd>
          </button>

          {/* Level Map Button */}
          <button
            type="button"
            onClick={() => setIsLevelMapOpen(true)}
            aria-keyshortcuts="M"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="View 100-Level Journey Map (M)"
          >
            <Map className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">View Journey</span>
            <span className="sm:hidden">Map</span>
          </button>

          {/* Keyboard Shortcuts Guide Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            aria-keyshortcuts="?"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Keyboard Shortcuts Guide (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden md:inline">Shortcuts</span>
            <kbd className="px-1 py-0.2 text-[10px] font-mono bg-slate-100 rounded text-slate-500">?</kbd>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. PRIMARY TWO-COLUMN WORKSPACE: Live Camera + Challenge */}
      {/* Desktop: ~58% LEFT (Camera Feed) | ~42% RIGHT (Challenge)*/}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* ==================================================== */}
        {/* LEFT COLUMN: LIVE TRACKING CAMERA FEED (7 cols)      */}
        {/* ==================================================== */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-4/3 sm:aspect-16/10 lg:h-full min-h-[380px] sm:min-h-[440px] shadow-xl border-2 border-slate-200/80 flex items-center justify-center">
            
            {/* Live Camera Video (Mirrored) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror-mode"
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
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/65 backdrop-blur-md text-[11px] font-bold text-white border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Live Camera</span>
                </span>

                {attemptState === 'listening' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-[11px] font-bold text-white animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>LISTENING • 00:0{recordingSeconds}</span>
                  </span>
                )}
              </div>

              {/* Facial Tracking Status Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/65 backdrop-blur-md text-[11px] font-semibold text-white border border-white/10">
                <Smile className="w-3.5 h-3.5 text-teal-400" />
                <span>Face & Lip Tracking Active</span>
              </div>
            </div>

            {/* Center: Face Guidance Positioning Cue */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`w-52 sm:w-60 h-64 sm:h-72 rounded-[46%] border-2 transition-all duration-300 ${
                attemptState === 'listening'
                  ? 'border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                  : 'border-white/35 shadow-[0_0_15px_rgba(255,255,255,0.15)]'
              }`} />
              <span className="text-[11px] font-medium text-white/75 mt-2 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                Position face inside frame
              </span>
            </div>

            {/* Bottom: Real Measured Audio Volume Bar */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3 border border-white/10">
              <Mic className={`w-4 h-4 shrink-0 transition-colors ${
                audioLevel > 18 ? 'text-emerald-400' : 'text-slate-300'
              }`} />

              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                  <span>Microphone Audio Level</span>
                  <span>{audioLevel > 18 ? 'Speech Activity Detected' : 'Ambient / Waiting'}</span>
                </div>
                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-75 rounded-full ${
                      audioLevel > 45 ? 'bg-emerald-400' : audioLevel > 18 ? 'bg-blue-400' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.max(4, audioLevel)}%` }}
                  />
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-white w-8 text-right">
                {audioLevel}%
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: PRONUNCIATION CHALLENGE CARD (5 cols)  */}
        {/* ==================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <GlassCard padding="lg" className={`flex flex-col justify-between h-full transition-all duration-300 ${
            evaluationResult?.isMatch 
              ? 'border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.12)] bg-emerald-50/20' 
              : ''
          }`}>
            <div className="flex flex-col gap-4">
              {/* Level Category & Number Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-[#2563EB] uppercase bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-100">
                  Level {currentLevel.level} • {currentLevel.exerciseType}
                </span>

                <span className="text-xs font-semibold text-slate-500">
                  {currentLevel.languageName} Practice
                </span>
              </div>

              {/* TARGET PRONUNCIATION DISPLAY (Mandate: One of the largest elements) */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-50/80 via-white to-indigo-50/30 border border-blue-100/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Target Pronunciation
                  </span>

                  {/* Audio Reference Button (Listen to Example) */}
                  <button
                    type="button"
                    onClick={handleListenPhrase}
                    disabled={isPlayingAudioGuidance}
                    aria-keyshortcuts="L"
                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                      isPlayingAudioGuidance 
                        ? 'bg-blue-100 text-[#2563EB] border-blue-300 animate-pulse' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title="Listen to native pronunciation (L)"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{isPlayingAudioGuidance ? 'Playing...' : 'Listen'}</span>
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[10px] font-mono bg-slate-100/90 rounded text-slate-500 border border-slate-200/80">L</kbd>
                  </button>
                </div>

                {/* Target text (Massive, high contrast) */}
                <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#10213A] tracking-tight leading-tight select-text ${
                  currentLevel.language === 'ta-IN' ? 'font-tamil' : ''
                }`}>
                  {currentLevel.targetText}
                </h1>

                {/* Phonetic guide & meaning */}
                <div className="flex flex-col gap-0.5 mt-1 border-t border-blue-100/60 pt-2">
                  <span className="text-sm font-bold text-[#2563EB] tracking-normal">
                    {currentLevel.phoneticGuide}
                  </span>
                  <span className="text-xs text-[#526175] italic">
                    “{currentLevel.meaning}”
                  </span>
                </div>
              </div>

              {/* Speech Prompt & Articulatory Helper */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-800">
                  Say the word clearly.
                </span>
                <p className="text-xs text-[#526175] leading-relaxed">
                  {currentLevel.guidanceTip}
                </p>
              </div>

              {/* ==================================================== */}
              {/* ATTEMPT RESULTS & SUCCESS STATES                     */}
              {/* ==================================================== */}
              {attemptState === 'analyzing' && (
                <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center gap-3 animate-pulse">
                  <Activity className="w-5 h-5 text-[#2563EB] animate-spin shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-[#174EA6] block">Checking your attempt...</span>
                    <span className="text-[11px] text-slate-500">Analyzing acoustic energy and speech recognition</span>
                  </div>
                </div>
              )}

              {attemptState === 'result' && evaluationResult && (
                <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 animate-in fade-in duration-200 ${
                  evaluationResult.isMatch 
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {evaluationResult.isMatch ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}

                    <div className="flex flex-col">
                      <span className="text-sm font-bold">
                        {evaluationResult.isMatch ? 'Great work! Level complete.' : "Let's try that once more."}
                      </span>
                      <span className="text-xs opacity-80">
                        {evaluationResult.feedbackMessage}
                      </span>
                    </div>
                  </div>

                  {/* Captured words if available */}
                  {evaluationResult.transcript && (
                    <div className="p-2 rounded-xl bg-white/70 border border-slate-200/60 text-xs">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Speech Heard</span>
                      <span className="text-sm font-bold text-[#10213A]">
                        "{evaluationResult.transcript}"
                      </span>
                    </div>
                  )}

                  {/* Actionable Tip for retry */}
                  {!evaluationResult.isMatch && evaluationResult.actionableTip && (
                    <p className="text-xs text-amber-800 bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/50">
                      💡 {evaluationResult.actionableTip}
                    </p>
                  )}

                  {/* Spoken Verbal Confirmation Status Indicator */}
                  {evaluationResult.isMatch && (
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200/70 text-xs">
                      {accessibility.verbalConfirmation ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Spoken confirmation played</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={toggleVerbalConfirmation}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 underline text-[11px] font-medium"
                          title="Click to enable spoken voice confirmation so you don't need to read results text"
                        >
                          <Volume2 className="w-3 h-3 text-emerald-600" />
                          <span>Enable calm spoken confirmation (V)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions: Dominant Microphone / Start Speaking / Next Level */}
            <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-slate-100">
              {evaluationResult?.isMatch ? (
                /* Success Navigation to Next Level */
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    id="next-level-btn"
                    type="button"
                    onClick={handleContinueNextLevel}
                    aria-keyshortcuts="Enter"
                    className="w-full py-4 px-6 rounded-2xl bg-[#0F9F94] hover:bg-[#0c8279] text-white font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                  >
                    <span>Continue to Level {Math.min(100, currentLevel.level + 1)}</span>
                    <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-white/20 text-white rounded-md">
                      Enter ↵
                    </kbd>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRetryCurrentLevel}
                    aria-keyshortcuts="R"
                    className="w-full sm:w-auto px-4 py-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    title="Practice this level again (R)"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Re-practice</span>
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 rounded text-slate-600 border border-slate-200">
                      R
                    </kbd>
                  </button>
                </div>
              ) : attemptState === 'listening' ? (
                /* Active Recording State: Prominent Stop Button */
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="stop-speaking-btn"
                    type="button"
                    onClick={handleStopAttempt}
                    aria-keyshortcuts="Space"
                    className="w-full py-4 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-3 shadow-md animate-pulse active:scale-[0.98] transition-all"
                  >
                    <div className="w-4 h-4 rounded-xs bg-white" />
                    <span>Stop Speaking (00:0{recordingSeconds})</span>
                    <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-white/20 text-white rounded-md">
                      Space
                    </kbd>
                  </button>
                  <span className="text-xs text-slate-500">
                    Listening... Speak clearly. Press <kbd className="px-1 py-0.2 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">Space</kbd> when finished.
                  </span>
                </div>
              ) : (
                /* Idle State: Dominant 🎙 Start Speaking Control */
                <div className="flex flex-col items-center gap-2">
                  <button
                    id="start-speaking-btn"
                    type="button"
                    onClick={handleStartAttempt}
                    disabled={attemptState === 'analyzing'}
                    aria-keyshortcuts="Space"
                    className="w-full py-4 px-8 rounded-2xl bg-[#2563EB] hover:bg-[#174EA6] text-white font-bold text-base sm:text-lg flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Mic className="w-5 h-5" />
                    <span>Start Speaking</span>
                    <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold bg-white/20 text-white rounded-md">
                      Space
                    </kbd>
                  </button>

                  <span className="text-xs text-slate-500 text-center">
                    Press <kbd className="px-1 py-0.2 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">Space</kbd> to begin. Take your time.
                  </span>
                </div>
              )}

              {/* Prev / Next Level Manual Step (For reviewing completed levels) */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={handlePrevLevel}
                  disabled={currentLevel.level <= 1}
                  aria-keyshortcuts="ArrowLeft"
                  title="Previous Level (←)"
                  className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Level {currentLevel.level - 1}</span>
                  <kbd className="hidden sm:inline-block px-1 text-[10px] font-mono bg-slate-100 rounded text-slate-400">←</kbd>
                </button>

                <span className="text-[11px] font-medium">
                  {completedLevelNumbers.includes(currentLevel.level) ? '✓ Completed' : 'In Progress'}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentLevelNumber(currentLevel.level + 1)}
                  disabled={currentLevel.level >= highestUnlockedLevel}
                  aria-keyshortcuts="ArrowRight"
                  title="Next Level (→)"
                  className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <kbd className="hidden sm:inline-block px-1 text-[10px] font-mono bg-slate-100 rounded text-slate-400">→</kbd>
                  <span>Level {currentLevel.level + 1}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Accessible Keyboard Shortcut Helper Strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2.5 text-[11px] text-slate-500 border-t border-slate-100/90">
                <span className="font-semibold text-slate-400">Shortcuts:</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">Space</kbd>
                  <span>Mic Start/Stop</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">Enter</kbd>
                  <span>Next Level</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">L</kbd>
                  <span>Listen</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">V</kbd>
                  <span>Voice Confirm</span>
                </span>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setIsStreakModalOpen(true)}
                  className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline font-semibold"
                >
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 font-bold">S</kbd>
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    <span>Streak</span>
                  </span>
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setIsShortcutsModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-semibold"
                >
                  <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-blue-50 border border-blue-200 rounded text-[#2563EB] font-bold">?</kbd>
                  <span>All keys</span>
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. 100-LEVEL JOURNEY MAP MODAL                           */}
      {/* ======================================================== */}
      <LevelMapModal
        isOpen={isLevelMapOpen}
        onClose={() => setIsLevelMapOpen(false)}
        onSelectLevel={(selectedLevel) => {
          setAttemptState('ready');
          setEvaluationResult(null);
          setLastTranscript(null);
          setCurrentLevelNumber(selectedLevel);
        }}
      />

      {/* ======================================================== */}
      {/* 4. NON-INTRUSIVE MILESTONE CELEBRATION (10, 25, 50, 75, 100) */}
      {/* ======================================================== */}
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

      {/* ======================================================== */}
      {/* 4b. OPTIONAL IN-DEPTH MILESTONE MODAL & BREATHING PACER  */}
      {/* ======================================================== */}
      <MilestoneModal
        level={milestoneLevelToShow || 10}
        isOpen={milestoneLevelToShow !== null}
        onClose={() => setMilestoneLevelToShow(null)}
        completedCount={completedLevelNumbers.length}
        totalAttempts={completedLevelNumbers.length + 4}
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
          resetLevelProgress();
        }}
      />

      {/* Exit Practice Confirmation Dialog */}
      <ConfirmModal
        isOpen={isExitConfirmOpen}
        title="Exit Practice Session?"
        description="Your practice milestones and highest unlocked level are securely saved. You can resume anytime."
        confirmLabel="Exit & Save"
        cancelLabel="Continue Practice"
        onConfirm={handleConfirmExit}
        onCancel={() => setIsExitConfirmOpen(false)}
      />

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
            addToast('Practice Secured', 'Your practice streak is already active and up to date for today.', 'info');
          }
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Screen reader announcements for keyboard actions */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      {/* Strategic Research Disclaimer */}
      <ResearchDisclaimer compact />
    </div>
  );
};
