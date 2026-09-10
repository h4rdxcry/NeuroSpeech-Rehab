import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  Award, 
  ArrowRight, 
  X, 
  TrendingUp, 
  HeartHandshake, 
  Zap, 
  Volume2, 
  Flame,
  Layers,
  ChevronRight
} from 'lucide-react';

export interface MilestoneCelebrationProps {
  level: number;
  isOpen: boolean;
  onClose: () => void;
  onViewDetails?: () => void;
  onContinuePractice?: () => void;
  autoDismissDuration?: number; // In milliseconds, default 10000 (10s), 0 to disable
  position?: 'bottom-right' | 'bottom-center' | 'top-right';
}

interface MilestoneFeedbackData {
  stageNumber: number;
  stageName: string;
  percent: number;
  title: string;
  encouragement: string;
  clinicalImpact: string;
  nextStep: string;
  accentGradient: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MILESTONE_DATA: Record<number, MilestoneFeedbackData> = {
  10: {
    stageNumber: 1,
    stageName: 'Beginner Stage',
    percent: 10,
    title: 'Foundational Articulation Established!',
    encouragement: 'Outstanding dedication! You have successfully mastered your first 10 rehabilitation exercises across Tamil and English phonetics.',
    clinicalImpact: 'Consistent repetition of foundational stops (/m/, /p/, /b/) and open vowels forms the critical bedrock for neuroplastic speech recovery.',
    nextStep: 'Stage 2 begins: Retroflex consonant tongue placement and motor precision.',
    accentGradient: 'from-blue-600 to-teal-600',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    badgeText: 'text-blue-700 dark:text-blue-300',
    icon: Sparkles
  },
  25: {
    stageNumber: 2,
    stageName: 'Foundation Stage',
    percent: 25,
    title: 'Lingual Precision Formed • 25 Levels Complete!',
    encouragement: 'One quarter of your entire 100-level journey is accomplished! Navigating Tamil retroflex consonants and English alveolar transitions shows steady motor adaptation.',
    clinicalImpact: 'Your tongue-tip elevation and vowel-to-consonant transitions are becoming smoother and more acoustically distinct with each daily effort.',
    nextStep: 'Stage 3 begins: Polysyllabic daily vocabulary and communicative pacing.',
    accentGradient: 'from-indigo-600 to-blue-600',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    icon: Zap
  },
  50: {
    stageNumber: 3,
    stageName: 'Intermediate Stage',
    percent: 50,
    title: 'Halfway Rehabilitation Milestone Reached!',
    encouragement: 'Fifty levels conquered! Reaching the halfway mark is a profound milestone of patience, routine discipline, and articulatory recovery.',
    clinicalImpact: 'You have transitioned from single syllables to multi-syllable functional daily vocabulary. Breath resonance control has noticeably stabilized.',
    nextStep: 'Stage 4 begins: Connected sentence production and conversational stamina.',
    accentGradient: 'from-amber-600 to-orange-600',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    badgeText: 'text-amber-800 dark:text-amber-300',
    icon: Award
  },
  75: {
    stageNumber: 4,
    stageName: 'Advanced Practice Stage',
    percent: 75,
    title: 'Connected Sentence Fluency Achieved!',
    encouragement: 'Three quarters of the curriculum complete! You are now sustaining breath pacing and clear intelligibility across full conversational phrases.',
    clinicalImpact: 'Strong articulatory stamina and natural inflection across bilingual sentences demonstrate advanced neuromuscular integration.',
    nextStep: 'Stage 5 begins: Final 25 levels toward comprehensive bilingual speech independence.',
    accentGradient: 'from-violet-600 to-purple-600',
    badgeBg: 'bg-violet-50 dark:bg-violet-950/60',
    badgeBorder: 'border-violet-200 dark:border-violet-800',
    badgeText: 'text-violet-700 dark:text-violet-300',
    icon: TrendingUp
  },
  100: {
    stageNumber: 5,
    stageName: 'Full Curriculum Completed',
    percent: 100,
    title: '100-Level Curriculum Mastered!',
    encouragement: 'Extraordinary accomplishment! You have completed all 100 levels of the bilingual speech and motor rehabilitation curriculum.',
    clinicalImpact: 'Your quiet daily persistence has built resilient speech motor coordination, bilingual clarity, and lasting communicative confidence.',
    nextStep: 'Continuing maintenance: Ongoing conversational practice and daily vocal wellness.',
    accentGradient: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    icon: CheckCircle2
  }
};

/**
 * Reusable MilestoneCelebration component that renders a non-intrusive,
 * encouraging notification message after a user completes levels 10, 25, 50, 75, or 100.
 */
export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  level,
  isOpen,
  onClose,
  onViewDetails,
  onContinuePractice,
  autoDismissDuration = 10000,
  position = 'bottom-right'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const audioPlayedRef = useRef(false);

  const feedback = MILESTONE_DATA[level] || {
    stageNumber: Math.floor(level / 20) + 1,
    stageName: `Rehabilitation Stage`,
    percent: level,
    title: `Level ${level} Milestone Mastered!`,
    encouragement: `Impressive progress! Every completed level reinforces neural speech coordination and acoustic clarity.`,
    clinicalImpact: `Consistent practice stimulates neuroplastic motor recovery across targeted phonemes.`,
    nextStep: `Advancing to Level ${Math.min(100, level + 1)}.`,
    accentGradient: 'from-blue-600 to-teal-600',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    badgeText: 'text-blue-700 dark:text-blue-300',
    icon: Sparkles
  };

  const IconComponent = feedback.icon;

  // Gentle, therapeutic chime via Web Audio API
  const playGentleChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      // Gentle ascending 3-note harmonic chord: Eb5, G5, Bb5 (warm, uplifting, non-jarring)
      const notes = [622.25, 783.99, 932.33];
      
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        
        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.1 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.8);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.9);
      });
      
      setTimeout(() => {
        try {
          ctx.close();
        } catch {
          // ignore
        }
      }, 1500);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }, []);

  // Trigger sound once when opened
  useEffect(() => {
    if (isOpen && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      playGentleChime();
    }
    if (!isOpen) {
      audioPlayedRef.current = false;
      setProgress(100);
    }
  }, [isOpen, playGentleChime]);

  // Handle auto-dismiss timer with pause-on-hover
  useEffect(() => {
    if (!isOpen || autoDismissDuration <= 0) return;

    const intervalMs = 100;
    const decrement = (intervalMs / autoDismissDuration) * 100;

    const interval = setInterval(() => {
      if (isHovered) return; // Pause timer when patient is reading / hovering

      setProgress((prev) => {
        if (prev <= decrement) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - decrement;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isOpen, autoDismissDuration, isHovered, onClose]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Placement class
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4 sm:bottom-6 sm:right-6',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6',
    'top-right': 'top-20 right-4 sm:top-24 sm:right-6'
  }[position];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      id={`milestone-celebration-level-${level}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed z-40 max-w-md w-[calc(100vw-2rem)] sm:w-[440px] pointer-events-auto transition-all duration-300 ease-out animate-in slide-in-from-bottom-5 fade-in ${positionClasses}`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 select-none ring-1 ring-black/5 dark:ring-white/10">
        
        {/* Ambient decorative top border accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${feedback.accentGradient}`} />

        {/* Header: Stage Badge, Level Number, Percent Pill & Dismiss Button */}
        <div className="flex items-start justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${feedback.badgeBg} ${feedback.badgeBorder} ${feedback.badgeText}`}>
              <IconComponent className="w-3 h-3" />
              <span>{feedback.stageName} • Level {level}</span>
            </span>

            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {feedback.percent}% Complete
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss milestone message"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content: Title and Encouraging Message */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${feedback.accentGradient} text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5`}>
            <IconComponent className="w-5 h-5" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
              {feedback.title}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {feedback.encouragement}
            </p>
          </div>
        </div>

        {/* Clinical Reinforcement Box */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
          <HeartHandshake className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Clinical Impact: </span>
            <span>{feedback.clinicalImpact}</span>
          </div>
        </div>

        {/* Action Controls & Non-intrusive Navigation */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
            {isHovered ? 'Timer paused' : feedback.nextStep}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onViewDetails && (
              <button
                type="button"
                onClick={() => {
                  onViewDetails();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="View in-depth stage summary and breathing pacer"
              >
                <span>Details</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {onContinuePractice ? (
              <button
                type="button"
                onClick={() => {
                  onContinuePractice();
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${feedback.accentGradient} hover:opacity-95 transition-opacity shadow-xs`}
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                <span>Dismiss</span>
              </button>
            )}
          </div>
        </div>

        {/* Subtle timer progress bar at bottom */}
        {autoDismissDuration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${feedback.accentGradient} transition-all duration-100`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
