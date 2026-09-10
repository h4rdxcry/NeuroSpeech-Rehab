import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { SessionStatusBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Users, History, CheckCircle2, Search, Filter, Calendar, ChevronRight } from 'lucide-react';
import { SessionRecord, SessionStatus } from '../../types';

export const ClinicianOverview: React.FC = () => {
  const { participants, sessions, setActiveTab } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);

  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Filtered recent sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          session.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `#${session.sessionNumber}`.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Clinician Overview
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Patients, sessions and saved rehabilitation records.
        </p>
      </div>

      {/* Summary KPI Cards (Mandate #29: Patients, Total sessions, Completed sessions using real state counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard 
          padding="md" 
          className="flex items-center justify-between cursor-pointer hover:border-slate-300"
          onClick={() => setActiveTab('patients')}
        >
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
              Enrolled Patients
            </span>
            <span className="text-3xl font-extrabold text-[#10213A] mt-1">
              {participants.length}
            </span>
            <span className="text-xs text-slate-400 mt-1">Cohort participants</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </GlassCard>

        <GlassCard 
          padding="md" 
          className="flex items-center justify-between cursor-pointer hover:border-slate-300"
          onClick={() => setActiveTab('sessions')}
        >
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
              Total Sessions
            </span>
            <span className="text-3xl font-extrabold text-[#10213A] mt-1">
              {sessions.length}
            </span>
            <span className="text-xs text-slate-400 mt-1">Planned & logged</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
        </GlassCard>

        <GlassCard padding="md" className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#526175] uppercase tracking-wider">
              Completed Sessions
            </span>
            <span className="text-3xl font-extrabold text-emerald-700 mt-1">
              {completedSessions.length}
            </span>
            <span className="text-xs text-slate-400 mt-1">Verified practice logs</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </GlassCard>
      </div>

      {/* Recent Sessions Workspace */}
      <GlassCard padding="none" className="flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70">
          <div>
            <h2 className="text-base font-bold text-[#10213A]">Recent Practice Sessions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Showing {filteredSessions.length} practice records</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient or session #..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-[#2563EB] w-52 sm:w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-[#2563EB]"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Session #</th>
                <th className="px-5 py-3.5">Patient / Participant</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5">Voicing Count</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No sessions match the current search or filter.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      #{session.sessionNumber}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#10213A]">{session.patientName}</span>
                        <span className="font-mono text-[11px] text-slate-400">{session.participantId}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {session.date} • {session.time}
                    </td>
                    <td className="px-5 py-4">
                      <SessionStatusBadge status={session.status} />
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {session.attemptsCount} attempts
                    </td>
                    <td className="px-5 py-4 font-medium text-emerald-700">
                      {session.speechDetectedCount} detected
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Selected Session Detail Modal if inspected */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Clinical Inspection</span>
                <h3 className="text-lg font-bold text-[#10213A]">
                  Session #{selectedSession.sessionNumber} — {selectedSession.patientName}
                </h3>
              </div>
              <SessionStatusBadge status={selectedSession.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block">Date</span>
                <span className="font-semibold text-slate-800">{selectedSession.date} at {selectedSession.time}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block">Pseudonym ID</span>
                <span className="font-mono font-semibold text-slate-800">{selectedSession.participantId}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block">Captured Attempts</span>
                <span className="font-semibold text-slate-800">{selectedSession.attemptsCount} items</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-400 block">Session Duration</span>
                <span className="font-semibold text-slate-800">{selectedSession.durationMinutes} minutes</span>
              </div>
            </div>

            {selectedSession.notes && (
              <div className="p-3 rounded-xl bg-slate-50 text-xs text-[#526175]">
                <span className="font-semibold text-slate-700 block mb-1">Clinical Session Notes:</span>
                <p>{selectedSession.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ResearchDisclaimer />
    </div>
  );
};
