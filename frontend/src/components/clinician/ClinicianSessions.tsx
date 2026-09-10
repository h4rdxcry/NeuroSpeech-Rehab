import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { SessionStatusBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { SessionRecord } from '../../types';

export const ClinicianSessions: React.FC = () => {
  const { sessions } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const filtered = sessions.filter(session => {
    const matchesSearch = session.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          session.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `#${session.sessionNumber}`.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Clinical Practice Sessions
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Searchable audit of scheduled, in-progress, and completed therapy sessions.
        </p>
      </div>

      {/* Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by session # or patient..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-64"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Showing {paginated.length} of {filtered.length} sessions
        </span>
      </div>

      {/* Table */}
      <GlassCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Session #</th>
                <th className="px-5 py-3.5">Patient / Participant</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Exercises Done</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No sessions found.
                  </td>
                </tr>
              ) : (
                paginated.map(sess => (
                  <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      #{sess.sessionNumber}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{sess.patientName}</span>
                        <span className="font-mono text-[11px] text-slate-400">{sess.participantId}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {sess.date} at {sess.time}
                    </td>
                    <td className="px-5 py-4">
                      <SessionStatusBadge status={sess.status} />
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {sess.completedExercisesCount} / {sess.totalExercisesCount}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {sess.durationMinutes} min
                    </td>
                    <td className="px-5 py-4 text-slate-500 max-w-xs truncate">
                      {sess.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Mandate #54: Backend pagination style) */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </GlassCard>

      <ResearchDisclaimer />
    </div>
  );
};
