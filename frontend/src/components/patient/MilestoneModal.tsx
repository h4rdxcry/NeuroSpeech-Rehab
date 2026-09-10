import React, { useState, useEffect } from 'react';
import { 
  Award, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  Wind, 
  HeartPulse, 
  ShieldCheck, 
  Check, 
  X,
  Sparkles,
  Volume2,
  Calendar,
  Activity
} from 'lucide-react';

export interface MilestoneModalProps {
  level: number;
  isOpen: boolean;
  onClose: () => void;
  onViewProgress?: () => void;
  onPracticeAgain?: () => void;
  totalAttempts?: number;
  completedCount?: number;
}

interface MilestoneContent {
  stageBadge: string;
  stageName: string;
  title: string;
  subtitle: string;
  message: string;
  skillsAcquired: string[];
  nextStageTitle: string;
  nextStageFocus: string;
  pacingNote: string;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  level,
  isOpen,
  onClose,
  onViewProgress,
  onPracticeAgain,
  totalAttempts,
  completedCount,
}) => {
  // Mindful breathing pacer state
  const [isBreathingPauseActive, setIsBreathingPauseActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Rest'>('Inhale');
  const [breathSecondsLeft, setBreathSecondsLeft] = useState(60);

  // Reset breathing timer when modal opens or level changes
  useEffect(() => {
    setIsBreathingPauseActive(false);
    setBreathSecondsLeft(60);
    setBreathPhase('Inhale');
  }, [level, isOpen]);

  // Gentle 4-2-4-2 box breathing cycle
  useEffect(() => {
    if (!isBreathingPauseActive || !isOpen) return;

    const interval = setInterval(() => {
      setBreathSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsBreathingPauseActive(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isBreathingPauseActive, isOpen]);

  useEffect(() => {
    if (!isBreathingPauseActive || !isOpen) return;

    // Cycle breathing guidance every 12 seconds: 4s inhale, 2s hold, 4s exhale, 2s rest
    const cycle = (60 - breathSecondsLeft) % 12;
    if (cycle < 4) {
      setBreathPhase('Inhale');
    } else if (cycle < 6) {
      setBreathPhase('Hold');
    } else if (cycle < 10) {
      setBreathPhase('Exhale');
    } else {
      setBreathPhase('Rest');
    }
  }, [breathSecondsLeft, isBreathingPauseActive, isOpen]);

  if (!isOpen) return null;

  const isFinal100 = level === 100;
  const nextLevel = Math.min(100, level + 1);
  const effectiveCompletedCount = completedCount ?? level;
  const effectiveTotalAttempts = totalAttempts ?? (level + 8);

  const getMilestoneData = (lvl: number): MilestoneContent => {
    switch (lvl) {
      case 10:
        return {
          stageBadge: 'Stage 1 Complete • Level 10 of 100',
          stageName: 'Beginner Stage',
          title: 'Foundational Articulation Established',
          subtitle: '10 of 100 Rehabilitation Levels Mastered (10%)',
          message:
            'You have successfully built regular articulatory and vocal habits across your first 10 exercises. Consistent repetition of foundational sounds forms the essential base for natural speech recovery.',
          skillsAcquired: [
            'Diaphragmatic breath support and sustained phonation',
            'Bilabial consonant stops (/m/, /p/, /b/) and lip closure',
            'Clear open vowel shaping across Tamil and English basics',
          ],
          nextStageTitle: 'Stage 2: Foundation',
          nextStageFocus: 'Lingual retroflex consonants, tongue placement, and rhythmic sound blending (Levels 11–25).',
          pacingNote: 'Take a gentle pause to relax your jaw muscles before continuing to retroflex sounds.',
        };
      case 25:
        return {
          stageBadge: 'Stage 2 Complete • Level 25 of 100',
          stageName: 'Foundation Stage',
          title: 'Lingual Precision & Motor Control Formed',
          subtitle: '25 of 100 Rehabilitation Levels Mastered (25%)',
          message:
            'You are making steady, dedicated progress. Navigating both Tamil retroflex articulation and English alveolar stops demonstrates neuromuscular adaptation and tongue precision.',
          skillsAcquired: [
            'Tongue-tip elevation and retroflex accuracy (Tamil ட, ண, ழ sounds)',
            'Smooth vowel-to-consonant phonetic transitions',
            'Consistent vocal intensity and acoustic clarity',
          ],
          nextStageTitle: 'Stage 3: Intermediate',
          nextStageFocus: 'Polysyllabic daily vocabulary, syllable pacing, and functional communication words (Levels 26–50).',
          pacingNote: 'Pacing is key. Rest your vocal tract and drink a sip of water to stay comfortable.',
        };
      case 50:
        return {
          stageBadge: 'Stage 3 Complete • Halfway Milestone',
          stageName: 'Intermediate Stage',
          title: 'Halfway Rehabilitation Milestone Reached',
          subtitle: '50 of 100 Rehabilitation Levels Mastered (50%)',
          message:
            'Fifty pronunciation challenges completed. You have advanced from single syllables into multi-syllable vocabulary, expressing everyday practical words in both Tamil and English with growing ease.',
          skillsAcquired: [
            'Complex multi-syllable word cadence and stress timing',
            'Functional daily vocabulary in practical conversation contexts',
            'Acoustic resonance control and reduced articulatory fatigue',
          ],
          nextStageTitle: 'Stage 4: Advanced Practice',
          nextStageFocus: 'Connected sentences, breath pacing, and conversational speech stamina (Levels 51–75).',
          pacingNote: 'Reaching the halfway mark is a notable accomplishment of steady discipline and perseverance.',
        };
      case 75:
        return {
          stageBadge: 'Stage 4 Complete • Level 75 of 100',
          stageName: 'Advanced Practice Stage',
          title: 'Connected Sentence Fluency Achieved',
          subtitle: '75 of 100 Rehabilitation Levels Mastered (75%)',
          message:
            'You have sustained breath support and intelligibility across full phrases. Entering the final Mastery Practice stage demonstrates strong speech stamina and coordination.',
          skillsAcquired: [
            'Longer connected phrase production with stable breath pacing',
            'Expressive sentence intonation and pitch inflection',
            'High articulatory intelligibility across conversational Tamil and English',
          ],
          nextStageTitle: 'Stage 5: Mastery Practice',
          nextStageFocus: 'Complex bilingual discourse, natural conversational cadence, and speech independence (Levels 76–100).',
          pacingNote: 'Only 25 levels remain to fulfill the complete 100-level rehabilitation journey.',
        };
      case 100:
        return {
          stageBadge: 'Journey Accomplished • All 100 Levels Complete',
          stageName: 'Full Curriculum Completed',
          title: 'Complete 100-Level Journey Accomplished',
          subtitle: '100 of 100 Rehabilitation Levels Completed (100%)',
          message:
            'You have completed the entire 100-level bilingual speech and articulatory rehabilitation curriculum with sustained perseverance, focus, and quiet dedication.',
          skillsAcquired: [
            'Fluent bilingual articulation across vowels, consonants, and retroflexes',
            'Natural prosody, breath management, and sentence cadence',
            'Independent speech self-monitoring and vocal endurance',
          ],
          nextStageTitle: 'Continuing Maintenance',
          nextStageFocus: 'Ongoing daily vocal maintenance, conversational practice, and continued collaboration with your care team.',
          pacingNote: 'Completion reflects patient dedication to speech recovery. Continue practicing daily habits.',
        };
      default:
        return {
          stageBadge: `Milestone Accomplished • Level ${lvl}`,
          stageName: 'Rehabilitation Milestone',
          title: `${lvl} Levels Completed`,
          subtitle: `${lvl} of 100 Rehabilitation Levels Completed`,
          message:
            "You are making steady, measurable progress through your 100-level speech rehabilitation curriculum.",
          skillsAcquired: [
            'Consistent vocal attempt monitoring and acoustic evaluation',
            'Systematic progression through configured articulatory targets',
            'Regular practice discipline and motor skill reinforcement',
          ],
          nextStageTitle: 'Next Practice Level',
          nextStageFocus: `Advancing to Level ${lvl + 1} with sustained attention and vocal ease.`,
          pacingNote: 'Take a quiet moment to breathe comfortably before moving forward.',
        };
    }
  };

  const data = getMilestoneData(level);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-celebration-title"
      aria-describedby="milestone-celebration-desc"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white/95 rounded-3xl shadow-2xl border border-slate-200/90 p-5 sm:p-8 flex flex-col items-center text-center gap-5 backdrop-blur-md">
        
        {/* Subtle, serene ambient glow (No flashy fireworks or confetti) */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-36 bg-gradient-to-b from-blue-500/10 via-teal-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close milestone summary"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Calm, Dignified Emblem */}
        <div className="relative mt-2">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-tr from-blue-600/10 via-teal-500/10 to-indigo-600/15 text-[#2563EB] flex items-center justify-center border border-blue-200/80 shadow-xs">
            {isFinal100 ? (
              <Award className="w-8 h-8 sm:w-9 sm:h-9 text-[#2563EB]" />
            ) : (
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-teal-600" />
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-[10px] font-bold text-slate-700">
            ★
          </span>
        </div>

        {/* Header & Stage Badge */}
        <div className="flex flex-col items-center gap-1.5 max-w-lg">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider text-[#174EA6] bg-blue-50 border border-blue-200/80 uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>{data.stageBadge}</span>
          </span>

          <h2
            id="milestone-celebration-title"
            className="text-2xl sm:text-3xl font-extrabold text-[#10213A] tracking-tight mt-1"
          >
            {data.title}
          </h2>

          <p className="text-xs sm:text-sm font-semibold text-[#2563EB]">
            {data.subtitle}
          </p>
        </div>

        {/* Encouraging, clinical narrative */}
        <p
          id="milestone-celebration-desc"
          className="text-xs sm:text-sm text-[#526175] leading-relaxed max-w-md"
        >
          {data.message}
        </p>

        {/* ====================================================== */}
        {/* CALM PROGRESS METRICS SUMMARY CARD                     */}
        {/* ====================================================== */}
        <div className="w-full p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col gap-3 text-left">
          
          {/* Top Row: Core Numbers */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 text-center py-1">
            <div className="px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Levels Done
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-[#10213A]">
                {effectiveCompletedCount} / 100
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Evaluations
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-[#10213A]">
                {effectiveTotalAttempts}
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Curriculum
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-700 mt-1 block">
                Tamil & English
              </span>
            </div>
          </div>

          {/* Middle: Clinical Skills Reinforced */}
          <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Articulatory Skills Developed
            </span>
            <ul className="flex flex-col gap-1 text-xs text-slate-700">
              {data.skillsAcquired.map((skill, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                  <span>{skill}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: Next Stage Opening */}
          {!isFinal100 && (
            <div className="pt-2.5 border-t border-slate-200/80 flex flex-col gap-0.5 text-xs">
              <span className="font-bold text-[#10213A]">
                Opening {data.nextStageTitle}:
              </span>
              <span className="text-slate-600 text-[11px] leading-relaxed">
                {data.nextStageFocus}
              </span>
            </div>
          )}
        </div>

        {/* ====================================================== */}
        {/* MINDFUL VOCAL REST & BREATH PAUSE SECTION              */}
        {/* ====================================================== */}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 flex flex-col items-center gap-2.5">
          {!isBreathingPauseActive ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#10213A] block">
                    Vocal Cord & Jaw Relaxation
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {data.pacingNote}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsBreathingPauseActive(true)}
                className="shrink-0 px-3.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                <span>Take a 1-Min Pause</span>
              </button>
            </div>
          ) : (
            /* Active Guided Breathing Pacer */
            <div className="w-full flex flex-col items-center gap-3 py-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between w-full text-xs text-slate-500">
                <span className="font-bold text-teal-700 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 animate-pulse text-teal-600" />
                  <span>Guided Vocal Tract Rest Pacer</span>
                </span>
                <span className="font-mono font-bold text-slate-700">
                  {breathSecondsLeft}s remaining
                </span>
              </div>

              {/* Gentle Expanding Pacer Ring */}
              <div className="relative w-24 h-24 flex items-center justify-center my-1">
                <div
                  className={`w-24 h-24 rounded-full border-2 border-teal-400/40 transition-all duration-1000 flex items-center justify-center ${
                    breathPhase === 'Inhale'
                      ? 'scale-110 bg-teal-100/50 border-teal-500'
                      : breathPhase === 'Hold'
                        ? 'scale-110 bg-teal-200/40 border-teal-600'
                        : breathPhase === 'Exhale'
                          ? 'scale-90 bg-teal-50/50 border-teal-300'
                          : 'scale-90 bg-slate-50 border-slate-300'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">
                      {breathPhase}
                    </span>
                    <span className="text-[10px] text-teal-700 font-medium">
                      {breathPhase === 'Inhale'
                        ? 'Gentle breath in'
                        : breathPhase === 'Hold'
                          ? 'Relax shoulders'
                          : breathPhase === 'Exhale'
                            ? 'Slow release'
                            : 'Rest comfortably'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsBreathingPauseActive(false)}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                Skip pause and proceed
              </button>
            </div>
          )}
        </div>

        {/* Clinical Disclaimer / Reassurance Note */}
        <p className="text-[11px] text-slate-400 max-w-md leading-normal">
          {isFinal100
            ? 'Curriculum completion signifies successful participation across all 100 clinical practice targets. Continue regular vocal maintenance with your care team.'
            : 'Progress is saved automatically. You may continue or take a break whenever comfortable.'}
        </p>

        {/* ====================================================== */}
        {/* ACTION CONTROLS                                        */}
        {/* ====================================================== */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center pt-1">
          {isFinal100 ? (
            <>
              {onViewProgress && (
                <button
                  id="milestone-view-progress-btn"
                  type="button"
                  onClick={onViewProgress}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-xs sm:text-sm font-bold transition-all shadow-sm"
                >
                  Review Full Clinical Progress
                </button>
              )}
              {onPracticeAgain && (
                <button
                  id="milestone-practice-again-btn"
                  type="button"
                  onClick={onPracticeAgain}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Repeat Completed Journey</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                id="milestone-continue-btn"
                type="button"
                onClick={() => {
                  if (onPracticeAgain) {
                    onPracticeAgain();
                  } else {
                    onClose();
                  }
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <span>Continue to Level {nextLevel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onViewProgress && (
                <button
                  type="button"
                  onClick={onViewProgress}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
                >
                  View Progress Report
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
