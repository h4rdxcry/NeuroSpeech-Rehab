import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ProvenanceBadge, QcBadge } from '../common/StatusBadges';
import { HashViewer } from '../common/RawMetadataViewer';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Volume2, ChevronDown, ChevronRight, Search, Activity, Cpu } from 'lucide-react';
import { RecordingRecord } from '../../types';

export const ClinicianRecordings: React.FC = () => {
  const { recordings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(recordings[0]?.id || null);

  const filtered = recordings.filter(r => 
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.modality.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Clinical Speech Recordings
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Acoustic captures, hardware provenance, and calculated phonetic features.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search recording ID, device or participant..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-72"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} recordings indexed
        </span>
      </div>

      {/* Recordings List with Expandable Evidence Panels */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <GlassCard padding="lg" className="text-center text-xs text-slate-500 py-10">
            No acoustic recordings found matching the query. Practice sessions with audio capture will populate here.
          </GlassCard>
        ) : filtered.map(rec => {
          const isExpanded = expandedRecId === rec.id;
          return (
            <GlassCard key={rec.id} padding="none" className="overflow-hidden border border-slate-200/90">
              <div 
                onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{rec.id}</span>
                      <ProvenanceBadge classification={rec.dataClassification} />
                      <QcBadge status={rec.qcStatus} />
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5">
                      {rec.participantId} • {rec.modality} • {rec.deviceName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>{rec.samplingRate}</span>
                  <span>• {rec.durationSec}s</span>
                  <span>• {rec.createdAt}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Expandable Evidence Panel */}
              {isExpanded && (
                <div className="p-5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Calculated Acoustic & Articulatory Features
                    </span>
                    <HashViewer hash={rec.sourceHashSha256} />
                  </div>

                  {rec.features ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">Mean Pitch (F0)</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {rec.features.f0MeanHz.toFixed(1)} Hz
                        </span>
                        <span className="text-[10px] text-slate-500">Std: ±{rec.features.f0StdHz.toFixed(1)} Hz</span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">Formants F1 / F2</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {rec.features.f1FormantHz} / {rec.features.f2FormantHz} Hz
                        </span>
                        <span className="text-[10px] text-slate-500">Acoustic resonance</span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">Jitter & Shimmer</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {rec.features.jitterPercent}% / {rec.features.shimmerPercent}%
                        </span>
                        <span className="text-[10px] text-slate-500">Perturbation values</span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">Mouth Aspect Ratio</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {rec.features.mouthAspectRatioMean.toFixed(2)} MAR
                        </span>
                        <span className="text-[10px] text-slate-500">Lip closure: {rec.features.lipClosureDurationMs}ms</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-3">Feature calculation pending for this recording.</p>
                  )}

                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-[#174EA6]">
                    <span className="font-semibold block mb-0.5">Research Lineage Disclaimer</span>
                    Acoustic formants and mouth aspect ratios are computational signal features for research tracking, not direct clinical or neurological diagnosis scores.
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
