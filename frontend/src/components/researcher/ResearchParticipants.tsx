import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { EnrollmentBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Users, Search, Shield, Calendar } from 'lucide-react';

export const ResearchParticipants: React.FC = () => {
  const { participants } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = participants.filter(p => 
    p.pseudonymId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cohort.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header (Mandate #41) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
            Participants Registry
          </h1>
          <p className="text-sm sm:text-base text-[#526175] mt-1">
            Pseudonymous participant registry under ethical research protocols.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search participant ID or cohort..."
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
                <th className="px-5 py-3.5">Pseudonym Identifier</th>
                <th className="px-5 py-3.5">Consent Date</th>
                <th className="px-5 py-3.5">Research Cohort</th>
                <th className="px-5 py-3.5">Enrollment Status</th>
                <th className="px-5 py-3.5">Total Practice Sessions</th>
                <th className="px-5 py-3.5">Assigned Clinician</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-4 font-mono font-bold text-slate-900">
                    {p.pseudonymId}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {p.consentDate}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-800">
                    {p.cohort}
                  </td>
                  <td className="px-5 py-4">
                    <EnrollmentBadge status={p.enrollmentStatus} />
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {p.completedSessions} completed ({p.totalSessions} total)
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {p.assignedClinician}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <ResearchDisclaimer />
    </div>
  );
};
