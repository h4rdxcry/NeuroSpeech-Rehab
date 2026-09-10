import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ProvenanceBadge, QcBadge } from '../common/StatusBadges';
import { RawMetadataViewer } from '../common/RawMetadataViewer';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Database, Search, ChevronRight, ChevronDown, ShieldCheck, Layers, GitFork } from 'lucide-react';
import { DatasetRecord } from '../../types';

export const ResearchDatasets: React.FC = () => {
  const { datasets } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [qcFilter, setQcFilter] = useState('all');
  const [selectedDataset, setSelectedDataset] = useState<DatasetRecord | null>(datasets[0] || null);

  const filtered = datasets.filter(ds => {
    const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ds.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ds.sourceOrganization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClassification = classificationFilter === 'all' || ds.dataClassification === classificationFilter;
    const matchesQc = qcFilter === 'all' || ds.qcState === qcFilter;
    return matchesSearch && matchesClassification && matchesQc;
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Datasets & Provenance
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Registered research corpora, institutional lineage, data splits, and scientific QC status.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dataset, source, or modality..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-64"
            />
          </div>

          <select
            value={classificationFilter}
            onChange={e => setClassificationFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">All Classifications</option>
            <option value="REAL">REAL</option>
            <option value="SYNTHETIC">SYNTHETIC</option>
            <option value="DEMO">DEMO</option>
          </select>

          <select
            value={qcFilter}
            onChange={e => setQcFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="all">All QC States</option>
            <option value="QC_PASS">QC PASS</option>
            <option value="QC_WARNING">QC WARNING</option>
            <option value="QC_FAIL">QC FAIL</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Showing {filtered.length} datasets
        </span>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Datasets List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {filtered.length === 0 ? (
            <GlassCard padding="lg" className="text-center py-10 text-xs text-slate-500">
              No datasets found matching the current filter.
            </GlassCard>
          ) : filtered.map(ds => {
            const isSelected = selectedDataset?.id === ds.id;
            return (
              <GlassCard
                key={ds.id}
                padding="md"
                onClick={() => setSelectedDataset(ds)}
                className={`cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-[#2563EB] bg-white shadow-sm ring-2 ring-[#2563EB]/15' 
                    : 'border-slate-200/80 bg-white/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{ds.name}</span>
                      <span className="text-xs font-mono text-slate-400">v{ds.version}</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5">{ds.sourceOrganization}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <ProvenanceBadge classification={ds.dataClassification} />
                  <QcBadge status={ds.qcState} />
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {ds.accessType}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                  <span>{ds.participantCount} subjects</span>
                  <span>• {ds.recordingCount} files</span>
                  <span>• {ds.durationHours} hrs</span>
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Right Column: Dataset Detail (7 cols, Mandate #37) */}
        <div className="lg:col-span-7 flex flex-col gap-5 sticky top-24">
          {selectedDataset ? (
            <GlassCard padding="lg" className="flex flex-col gap-5 bg-white border-slate-200 shadow-sm">
              {/* Dataset Title & Badges */}
              <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xl font-bold text-[#10213A]">
                    {selectedDataset.name}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                    v{selectedDataset.version}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <ProvenanceBadge classification={selectedDataset.dataClassification} />
                  <QcBadge status={selectedDataset.qcState} />
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedDataset.accessType}
                  </span>
                  <span className="text-xs text-slate-400">• License: {selectedDataset.license}</span>
                </div>
              </div>

              {/* Section 1: Overview & Provenance */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Description & Scientific Purpose
                </span>
                <p className="text-xs sm:text-sm text-[#10213A] leading-relaxed">
                  {selectedDataset.description}
                </p>
              </div>

              {/* Section 2: Dataset Composition */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Dataset Composition & Modality
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Participants</span>
                    <span className="text-base font-bold text-slate-900">{selectedDataset.participantCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Recordings</span>
                    <span className="text-base font-bold text-slate-900">{selectedDataset.recordingCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Audio</span>
                    <span className="text-base font-bold text-slate-900">{selectedDataset.durationHours} hrs</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Modality</span>
                    <span className="text-xs font-bold text-slate-900 truncate block mt-0.5">{selectedDataset.modality.split('(')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Split Definition Diagram (Mandate #37: Train / Val / Test split cards) */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Partition Splits Breakdown
                </span>
                <div className="w-full bg-slate-100 rounded-xl p-1.5 flex gap-1.5 text-xs font-semibold">
                  <div 
                    className="bg-[#2563EB] text-white py-2 px-3 rounded-lg text-center flex flex-col justify-center"
                    style={{ width: `${selectedDataset.splits.train}%` }}
                  >
                    <span>Train</span>
                    <span className="text-[10px] opacity-80">{selectedDataset.splits.train}%</span>
                  </div>
                  <div 
                    className="bg-teal-600 text-white py-2 px-2 rounded-lg text-center flex flex-col justify-center"
                    style={{ width: `${selectedDataset.splits.val}%` }}
                  >
                    <span>Val</span>
                    <span className="text-[10px] opacity-80">{selectedDataset.splits.val}%</span>
                  </div>
                  <div 
                    className="bg-indigo-600 text-white py-2 px-2 rounded-lg text-center flex flex-col justify-center"
                    style={{ width: `${selectedDataset.splits.test}%` }}
                  >
                    <span>Test</span>
                    <span className="text-[10px] opacity-80">{selectedDataset.splits.test}%</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Lineage */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-[#526175] flex items-start gap-2.5">
                <GitFork className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 block mb-0.5">Pipeline Processing Lineage:</span>
                  <p>{selectedDataset.lineage}</p>
                </div>
              </div>

              {/* Section 5: Raw JSON Metadata Disclosure (Mandate #37 & #89: Raw structured data disclosure) */}
              {selectedDataset.rawJsonMetadata && (
                <RawMetadataViewer 
                  data={selectedDataset.rawJsonMetadata}
                  title="View raw dataset manifest metadata (JSON)" 
                />
              )}
            </GlassCard>
          ) : (
            <GlassCard padding="lg" className="text-center py-16 text-slate-400">
              Select a dataset to view its provenance and split definition.
            </GlassCard>
          )}
        </div>
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
