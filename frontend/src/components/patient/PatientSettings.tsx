import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { EnrollmentBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { PracticeStreakModal } from './PracticeStreakModal';
import { UserSettings } from '../settings/UserSettings';
import { 
  Eye, 
  User, 
  Server, 
  Check, 
  RotateCcw, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  Layers,
  Sun,
  Moon,
  Monitor,
  Flame
} from 'lucide-react';

export const PatientSettings: React.FC = () => {
  const { 
    currentUser, 
    accessibility, 
    updateAccessibility, 
    theme,
    setTheme,
    resolvedTheme,
    connection, 
    testConnection, 
    updateConnectionUrl, 
    resetConnection,
    streakStatus,
    recordPracticeDay,
    addToast
  } = useApp();

  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [endpointInput, setEndpointInput] = useState(connection.endpointUrl);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    updateConnectionUrl(endpointInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    resetConnection();
    setEndpointInput('https://api.neurospeech-rehab.internal/v2');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Settings & Preferences
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Configure display accessibility, view your study account, or adjust advanced connection endpoints.
        </p>
      </div>

      {/* GROUP 1: User Display Settings (Default vs High-Contrast Modes & Accessibility) */}
      <UserSettings variant="card" />

      {/* GROUP 2: Account & Study Information (Mandate #28) */}
      <GlassCard padding="lg" className="flex flex-col gap-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#10213A]">
              Account & Study Status
            </h2>
            <p className="text-xs text-[#526175]">
              Details of your practice profile and study enrollment status.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase">Participant Name</span>
            <span className="text-sm font-bold text-[#10213A] mt-1">{currentUser.name}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase">Account Email</span>
            <span className="text-sm font-semibold text-[#10213A] mt-1 truncate">{currentUser.email}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase">Participant ID</span>
            <span className="text-sm font-mono font-bold text-[#10213A] mt-1">
              {currentUser.participantId || 'PT-LOCAL-PRACTICE'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-400 uppercase mb-1">Study Enrollment</span>
            <EnrollmentBadge status={currentUser.enrollmentStatus} />
          </div>

          {/* Practice Streak Overview */}
          <div className="sm:col-span-2 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300/70 dark:border-amber-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Practice Streak: {streakStatus.effectiveStreak} Day{streakStatus.effectiveStreak === 1 ? '' : 's'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    Best: {currentUser.longestStreak || streakStatus.effectiveStreak} days
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {streakStatus.hasPracticedToday
                    ? 'Practice session recorded for today. Your consecutive streak is secured!'
                    : 'Practice any rehabilitation level today to extend your streak.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsStreakModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold transition-colors self-start sm:self-auto border border-amber-300/60 shadow-2xs"
            >
              <span>View Streak History</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {currentUser.enrollmentStatus === 'local_practice' ? (
          <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-600">
            <span className="font-semibold block mb-0.5">Local practice mode</span>
            <span>You are practicing in standalone mode. Recordings remain local to your session and are not enrolled in a formal institutional clinical study.</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#EAF2FF]/60 border border-[#2563EB]/20 text-xs text-[#174EA6]">
            <span className="font-semibold block mb-0.5">Enrolled Clinical Cohort</span>
            <span>Assigned Clinician: {currentUser.assignedClinician || 'Dr. V. Sundaram, SLP'} • Protocol IEC-MMC-2025-084</span>
          </div>
        )}
      </GlassCard>

      {/* GROUP 3: Advanced / Research Workstation Connection (Mandate #28) */}
      <GlassCard padding="lg" className="flex flex-col gap-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#10213A]">
              Advanced / Research Workstation Connection
            </h2>
            <p className="text-xs text-[#526175]">
              Target backend speech recognition endpoint configuration for clinical research carts.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEndpoint} className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Backend API Endpoint URL
              </label>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  connection.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <span className="text-xs font-medium text-slate-500 capitalize">
                  {connection.status} {connection.lastPingMs ? `(${connection.lastPingMs}ms)` : ''}
                </span>
              </div>
            </div>

            <input
              type="url"
              value={endpointInput}
              onChange={e => setEndpointInput(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-800 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{isSaved ? 'Endpoint Saved' : 'Save Endpoint'}</span>
            </button>

            <button
              type="button"
              onClick={testConnection}
              disabled={connection.status === 'testing'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{connection.status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5 ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>
        </form>
      </GlassCard>

      <ResearchDisclaimer />

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
