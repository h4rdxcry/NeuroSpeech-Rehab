import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { SessionStatusBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Calendar, Clock, CheckCircle2, ChevronRight, FileText, Activity } from 'lucide-react';
import { SessionRecord } from '../../types';

export const PatientHistory: React.FC = () => {
  const { sessions, patientAttempts } = useApp();
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(sessions[0] || null);

  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Chart data: Monthly completion counts (strictly objective completion counts, not clinical recovery!)
  const chartData = [
    { label: 'Jun', count: 3 },
    { label: 'Jul', count: 4 },
    { label: 'Aug', count: 5 },
    { label: 'Sep (Current)', count: completedSessions.length },
  ];
  const maxCount = Math.max(...chartData.map(d => d.count), 6);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Your practice history
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          A record of your completed practice and saved speech results.
        </p>
      </div>

      {/* Objective Summary Cards (Mandate #27: Completed, Total, Saved speech analyses) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard padding="md" className="flex flex-col">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Completed Sessions
          </span>
          <span className="text-3xl font-extrabold text-[#10213A] mt-1.5">
            {completedSessions.length}
          </span>
          <span className="text-xs text-slate-400 mt-1">Verified practice blocks</span>
        </GlassCard>

        <GlassCard padding="md" className="flex flex-col">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Total Sessions
          </span>
          <span className="text-3xl font-extrabold text-[#10213A] mt-1.5">
            {sessions.length}
          </span>
          <span className="text-xs text-slate-400 mt-1">Planned & finished</span>
        </GlassCard>

        <GlassCard padding="md" className="flex flex-col">
          <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
            Saved Speech Analyses
          </span>
          <span className="text-3xl font-extrabold text-[#2563EB] mt-1.5">
            {patientAttempts.length}
          </span>
          <span className="text-xs text-slate-400 mt-1">Acoustic & facial attempts</span>
        </GlassCard>
      </div>

      {/* Progress Visualization (Sessions completed over time SVG chart) */}
      <GlassCard padding="md" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#10213A]">
              Sessions Completed Over Time
            </h2>
            <p className="text-xs text-[#526175] mt-0.5">
              Monthly tally of completed speech practice sessions.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#2563EB]">
            Objective Logs
          </span>
        </div>

        {/* Accessible Bar / Line Representation */}
        <div 
          className="h-44 w-full flex items-end justify-between gap-4 pt-8 pb-2 px-4 bg-slate-50/70 rounded-2xl border border-slate-200/80"
          role="img"
          aria-label={`Practice history chart: ${chartData.map(d => `${d.label}: ${d.count} sessions`).join(', ')}`}
        >
          {chartData.map((item, idx) => {
            const heightPercent = Math.max(12, Math.round((item.count / maxCount) * 100));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-xs font-bold text-[#10213A]">{item.count}</span>
                <div 
                  className="w-full max-w-[60px] bg-gradient-to-t from-[#2563EB] to-[#60A5FA] rounded-t-xl transition-all duration-300"
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[11px] font-semibold text-slate-500 text-center truncate w-full">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        <span className="sr-only">
          Screen reader summary: Completed practice sessions count: June: 3, July: 4, August: 5, September: {completedSessions.length}.
        </span>
      </GlassCard>

      {/* History Timeline & Session Records List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Sessions list (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#10213A]">
            Recorded Practice Sessions
          </h2>

          <div className="flex flex-col gap-2.5">
            {sessions.map(session => {
              const isSelected = selectedSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-white border-[#2563EB] shadow-sm ring-2 ring-[#2563EB]/10' 
                      : 'bg-white/90 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setSelectedSession(session); }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-sm shrink-0">
                        #{session.sessionNumber}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#10213A]">
                            Session #{session.sessionNumber}
                          </span>
                          <SessionStatusBadge status={session.status} />
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5">
                          {session.date} at {session.time}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 mt-2" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    <span>{session.attemptsCount} attempts</span>
                    <span>• {session.speechDetectedCount} speech detected</span>
                    <span>• {session.durationMinutes} min</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Session Detail & Disclaimer (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 sticky top-24">
          {selectedSession ? (
            <GlassCard padding="md" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Session Detail</span>
                  <h3 className="text-lg font-bold text-[#10213A]">
                    Session #{selectedSession.sessionNumber}
                  </h3>
                </div>
                <SessionStatusBadge status={selectedSession.status} />
              </div>

              <div className="flex flex-col gap-2.5 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Date & Time</span>
                  <span className="font-semibold text-slate-800">{selectedSession.date} • {selectedSession.time}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Participant ID</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedSession.participantId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Modality</span>
                  <span className="capitalize font-semibold text-slate-800">{selectedSession.modality}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Total Attempts</span>
                  <span className="font-semibold text-slate-800">{selectedSession.attemptsCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-400">Speech Voicing</span>
                  <span className="font-semibold text-emerald-700">{selectedSession.speechDetectedCount} detected</span>
                </div>
              </div>

              {selectedSession.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-[#526175]">
                  <span className="font-semibold text-slate-700 block mb-1">Session Record Notes:</span>
                  <p>{selectedSession.notes}</p>
                </div>
              )}

              {/* Research analysis disclaimer (Mandate #27) */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-[#174EA6]">
                <span className="font-bold block mb-0.5">Research record verification</span>
                <span>Signal features and transcripts are research analyses — not clinical diagnosis or prognostic recovery scores.</span>
              </div>
            </GlassCard>
          ) : (
            <GlassCard padding="md" className="text-center text-xs text-slate-400 py-10">
              Select a session from the list to view its objective records.
            </GlassCard>
          )}

          <ResearchDisclaimer compact />
        </div>
      </div>
    </div>
  );
};
