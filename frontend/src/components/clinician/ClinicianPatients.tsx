import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { EnrollmentBadge } from '../common/StatusBadges';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Search, User, Calendar, History, ArrowUpRight, X } from 'lucide-react';
import { PatientParticipant } from '../../types';

export const ClinicianPatients: React.FC = () => {
  const { participants, sessions, recordings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientParticipant | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'sessions' | 'recordings'>('overview');

  const filtered = participants.filter(p => 
    p.pseudonymId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cohort.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assignedClinician.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const patientSessions = selectedPatient 
    ? sessions.filter(s => s.participantId === selectedPatient.pseudonymId) 
    : [];

  const patientRecordings = selectedPatient 
    ? recordings.filter(r => r.participantId === selectedPatient.pseudonymId) 
    : [];

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
            Enrolled Patient Directory
          </h1>
          <p className="text-sm sm:text-base text-[#526175] mt-1">
            Pseudonymous patient registry under clinical trial protocols.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pseudonym ID or cohort..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-full sm:w-72"
          />
        </div>
      </div>

      {/* Directory Table / Stacked Cards */}
      <GlassCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Pseudonym ID</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Research Cohort</th>
                <th className="px-5 py-3.5">Assigned Clinician</th>
                <th className="px-5 py-3.5">Completed Sessions</th>
                <th className="px-5 py-3.5">Last Practice</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500 text-xs">
                    No enrolled patients found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {patient.pseudonymId}
                    </td>
                    <td className="px-5 py-4">
                      <EnrollmentBadge status={patient.enrollmentStatus} />
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      {patient.cohort}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {patient.assignedClinician}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {patient.completedSessions} / {patient.totalSessions}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {patient.lastActiveDate}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setActiveDetailTab('overview');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 transition-colors"
                      >
                        <span>Inspect</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Patient Detail Modal (Mandate #31: Overview, Sessions, Recordings tabs) */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-lg font-bold text-[#10213A]">
                    {selectedPatient.pseudonymId}
                  </span>
                  <EnrollmentBadge status={selectedPatient.enrollmentStatus} />
                </div>
                <span className="text-xs text-slate-500">{selectedPatient.cohort}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              {(['overview', 'sessions', 'recordings'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveDetailTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                    activeDetailTab === tab 
                      ? 'bg-[#2563EB] text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {activeDetailTab === 'overview' && (
              <div className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Consent Date</span>
                    <span className="font-semibold text-slate-800">{selectedPatient.consentDate}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Assigned Clinician</span>
                    <span className="font-semibold text-slate-800">{selectedPatient.assignedClinician}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Practice Progress</span>
                    <span className="font-semibold text-slate-800">{selectedPatient.completedSessions} completed sessions</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <span className="text-slate-400 block">Last Recorded Practice</span>
                    <span className="font-semibold text-slate-800">{selectedPatient.lastActiveDate}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-[#174EA6] leading-relaxed">
                  <span className="font-bold block mb-1">Study Data Governance Notice</span>
                  Participant records are maintained under protocol IEC-MMC-2025-084. Acoustic features and session logs are retained for multimodal speech analysis without clinical diagnostic extrapolation.
                </div>
              </div>
            )}

            {/* Tab 2: Sessions */}
            {activeDetailTab === 'sessions' && (
              <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
                {patientSessions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No session logs found for this participant.</p>
                ) : (
                  patientSessions.map(sess => (
                    <div key={sess.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">Session #{sess.sessionNumber}</span>
                        <span className="text-slate-500">{sess.date} • {sess.attemptsCount} attempts</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                        {sess.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Recordings */}
            {activeDetailTab === 'recordings' && (
              <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
                {patientRecordings.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No acoustic recordings linked to this participant ID.</p>
                ) : (
                  patientRecordings.map(rec => (
                    <div key={rec.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{rec.id}</span>
                        <span className="text-slate-500 font-medium">{rec.modality}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">{rec.deviceName} • {rec.samplingRate} • {rec.durationSec}s</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
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
