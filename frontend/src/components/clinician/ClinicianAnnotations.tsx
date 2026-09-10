import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { CheckSquare, Calendar, User, FileText, Search, Tag } from 'lucide-react';

export const ClinicianAnnotations: React.FC = () => {
  const { annotations } = useApp();
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = annotations.filter(ann => {
    const matchesType = typeFilter === 'all' || ann.type === typeFilter;
    const matchesSearch = ann.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ann.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ann.recordingId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Clinical & Phonetic Annotations
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Specialist observations, articulatory notes, and acoustic boundary tags.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search annotation text or author..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-64"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">All Types</option>
            <option value="phonetic_boundary">Phonetic Boundary</option>
            <option value="articulatory_note">Articulatory Note</option>
            <option value="signal_quality">Signal Quality</option>
            <option value="clinical_observation">Clinical Observation</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          {filtered.length} annotations logged
        </span>
      </div>

      {/* Annotations List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <GlassCard padding="lg" className="text-center py-12 text-slate-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <span className="font-semibold text-sm text-slate-600 block">No annotations found</span>
            <span className="text-xs text-slate-400">No records match the current filter or search criteria.</span>
          </GlassCard>
        ) : (
          filtered.map(ann => (
            <GlassCard key={ann.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] font-bold text-xs uppercase tracking-wider">
                    {ann.type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Recording: {ann.recordingId}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Session: {ann.sessionId}
                  </span>
                </div>

                <span className="text-xs text-slate-400">
                  {ann.timestamp}
                </span>
              </div>

              <p className="text-sm font-medium text-[#10213A] leading-relaxed">
                “{ann.value}”
              </p>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">{ann.author}</span>
                <span>• {ann.role}</span>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
