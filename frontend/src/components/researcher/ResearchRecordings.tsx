import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ProvenanceBadge, QcBadge } from '../common/StatusBadges';
import { HashViewer, RawMetadataViewer } from '../common/RawMetadataViewer';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Volume2, Search, ChevronDown, ChevronRight, Activity, Cpu, Filter } from 'lucide-react';

export const ResearchRecordings: React.FC = () => {
  const { recordings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(recordings[0]?.id || null);

  const filtered = recordings.filter(r => {
    const matchesSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.participantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.deviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classificationFilter === 'all' || r.dataClassification === classificationFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header (Mandate #38) */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Recordings & Signals
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Saved recordings, computed features, quality and predictions. Feature values are research outputs, not clinical assessments.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recording ID, participant, device..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:outline-none focus:border-[#2563EB] w-72"
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
        </div>

        <span className="text-xs text-slate-500">
          Showing {filtered.length} signal records
        </span>
      </div>

      {/* Recordings List */}
      <div className="flex flex-col gap-3">
        {filtered.map(rec => {
          const isExpanded = expandedRecId === rec.id;
          return (
            <GlassCard key={rec.id} padding="none" className="overflow-hidden border border-slate-200">
              <div
                onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{rec.id}</span>
                      <ProvenanceBadge classification={rec.dataClassification} />
                      <QcBadge status={rec.qcStatus} />
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5">
                      Participant: {rec.participantId} • {rec.modality} • {rec.fileFormat}
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

              {/* Expandable Technical Features & Lineage (Mandate #39 & #40) */}
              {isExpanded && (
                <div className="p-5 bg-slate-50/80 border-t border-slate-200 flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Feature Extraction & Acoustic Signal Lineage
                    </span>
                    <HashViewer hash={rec.sourceHashSha256} />
                  </div>

                  {rec.features ? (
                    <div className="flex flex-col gap-3">
                      {/* Metric cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mean Pitch F0</span>
                          <span className="text-base font-bold text-slate-900 mt-0.5 block">{rec.features.f0MeanHz.toFixed(1)} Hz</span>
                          <span className="text-[10px] text-slate-500">Acoustic fundamental</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">F1 / F2 Formants</span>
                          <span className="text-base font-bold text-slate-900 mt-0.5 block">{rec.features.f1FormantHz} / {rec.features.f2FormantHz} Hz</span>
                          <span className="text-[10px] text-slate-500">Vocal tract resonance</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Jitter / Shimmer</span>
                          <span className="text-base font-bold text-slate-900 mt-0.5 block">{rec.features.jitterPercent}% / {rec.features.shimmerPercent}%</span>
                          <span className="text-[10px] text-slate-500">Perturbation variance</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mouth Aspect Ratio (MAR)</span>
                          <span className="text-base font-bold text-slate-900 mt-0.5 block">{rec.features.mouthAspectRatioMean.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500">Closure: {rec.features.lipClosureDurationMs}ms</span>
                        </div>
                      </div>

                      {/* 13-Dimensional MFCC Feature Vector */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700 block mb-2">
                          Mel-Frequency Cepstral Coefficients (13-dim MFCC)
                        </span>
                        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                          {rec.features.mfccCoefficients.map((coef, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              c{i}: {coef.toFixed(1)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Raw JSON Feature Viewer */}
                      <RawMetadataViewer 
                        data={rec.features} 
                        title="View computed feature extraction schema (JSON)"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-2">No computed feature set attached to this recording.</p>
                  )}
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
