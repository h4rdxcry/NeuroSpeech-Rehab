import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { SessionStatusBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { History, Search, Calendar } from 'lucide-react';

export const ResearchSessions: React.FC = () => {
  const { sessions, recordings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = sessions.filter(s => 
    s.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `#${s.sessionNumber}`.includes(searchTerm) ||
    s.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
            Research Sessions Lineage
          </h1>
          <p className="text-sm sm:text-base text-[#526175] mt-1">
            Historical practice sessions mapped to participant cohorts and synchronized multimodal recordings.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search session # or participant..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-72"
          />
        </div>
      </div>

      <GlassCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Session ID / #</th>
                <th className="px-5 py-3.5">Participant Linkage</th>
                <th className="px-5 py-3.5">Practice Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Attempts Logged</th>
                <th className="px-5 py-3.5">Linked Recordings</th>
                <th className="px-5 py-3.5">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {filtered.map(s => {
                const linkedCount = recordings.filter(r => r.sessionId === s.id || r.participantId === s.participantId).length;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      #{s.sessionNumber} ({s.id})
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-slate-800">
                      {s.participantId}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {s.date} at {s.time}
                    </td>
                    <td className="px-5 py-4">
                      <SessionStatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {s.attemptsCount} attempts ({s.speechDetectedCount} voiced)
                    </td>
                    <td className="px-5 py-4 text-[#2563EB] font-bold">
                      {linkedCount > 0 ? `${linkedCount} files` : '1 file (Live)'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {s.durationMinutes} min
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <ResearchDisclaimer />
    </div>
  );
};
