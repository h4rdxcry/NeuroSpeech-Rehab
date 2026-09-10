import React, { useEffect } from 'react';
import { 
  Flame, 
  X, 
  CheckCircle2, 
  Calendar, 
  Trophy, 
  Sparkles, 
  Activity, 
  ArrowRight,
  RotateCcw,
  Zap
} from 'lucide-react';
import { UserProfile } from '../../types';
import { StreakStatus, getLocalDateString } from '../../context/AppContext';

export interface PracticeStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  streakStatus: StreakStatus;
  onRecordPractice?: () => void;
}

export const PracticeStreakModal: React.FC<PracticeStreakModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  streakStatus,
  onRecordPractice
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const todayStr = getLocalDateString();
  const practiceDates = Array.isArray(currentUser.practiceDates) ? currentUser.practiceDates : [];

  // Generate last 7 days array for rolling weekly calendar
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = getLocalDateString(d);
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    const dayNumber = d.getDate();
    const isToday = dateStr === todayStr;
    const isPracticed = practiceDates.includes(dateStr);

    return {
      dateStr,
      dayName,
      dayNumber,
      isToday,
      isPracticed
    };
  });

  return (
    <div 
      id="practice-streak-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-streak-modal-title"
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-5 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shadow-2xs">
              <Flame className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
            </div>
            <div>
              <h2 id="practice-streak-modal-title" className="text-xl font-extrabold text-[#10213A] dark:text-slate-100">
                Practice Streak
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily Motor Speech & Articulatory Habit Tracker
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close streak modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Streak Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 dark:border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
                <Flame className="w-10 h-10 fill-white" />
              </div>
              {streakStatus.hasPracticedToday && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs" title="Practiced Today">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-amber-950 dark:text-amber-200">
                  {streakStatus.effectiveStreak}
                </span>
                <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  {streakStatus.effectiveStreak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <p className="text-xs font-semibold text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                {streakStatus.hasPracticedToday 
                  ? 'Completed today • Streak active & secured!'
                  : streakStatus.canExtendToday
                    ? 'Target ready • Practice today to extend your streak!'
                    : 'Start your streak today with an exercise attempt.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full sm:w-auto shrink-0 border-t sm:border-t-0 sm:border-l border-amber-200/60 dark:border-amber-500/20 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Best Streak:</span>
              <span className="font-extrabold text-[#10213A] dark:text-slate-200 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                {currentUser.longestStreak || streakStatus.effectiveStreak} days
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Last Practice:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currentUser.lastPracticeDate === todayStr 
                  ? 'Today' 
                  : currentUser.lastPracticeDate || 'None yet'}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Profile Status:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Persisted
              </span>
            </div>
          </div>
        </div>

        {/* 7-Day Activity Strip */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Past 7 Days Practice Activity
            </span>
            <span className="text-[11px] text-slate-400">
              {practiceDates.filter(d => last7Days.some(day => day.dateStr === d)).length} of 7 days logged
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            {last7Days.map((day) => (
              <div 
                key={day.dateStr}
                className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                  day.isPracticed 
                    ? 'bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold'
                    : day.isToday
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                      : 'bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-slate-400'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold">{day.dayName}</span>
                <span className="text-xs my-0.5">{day.dayNumber}</span>
                <div className="mt-1">
                  {day.isPracticed ? (
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  ) : day.isToday ? (
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" title="Practice today" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Rationale Note */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
          <Activity className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold block mb-0.5">Clinical Neuroplasticity Principle:</span>
            Short, daily consecutive practice sessions (distributed learning) induce stronger neuromuscular adaptation and speech motor retention than sporadic practice blocks.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
          {onRecordPractice && (
            <button
              type="button"
              onClick={onRecordPractice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 transition-colors"
              title="Record a test practice day"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Log Practice Today</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <span>Continue Therapy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
