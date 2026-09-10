import React from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { Cpu, CheckCircle2, AlertTriangle, Layers, GitBranch, Calendar } from 'lucide-react';

export const ResearchModels: React.FC = () => {
  const { models } = useApp();

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header (Mandate #46) */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Model Registry & Checkpoint Lineage
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Registered acoustic neural architectures, parameter counts, checkpoint hashes, and Tamil phonetic weights.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {models.length === 0 ? (
          <GlassCard padding="lg" className="text-center py-10 text-xs text-slate-500">
            No neural acoustic models registered yet.
          </GlassCard>
        ) : models.map(model => (
          <GlassCard key={model.id} padding="lg" className="flex flex-col gap-4 bg-white border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900">{model.versionName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      model.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {model.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 mt-0.5">{model.checkpointFile}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Registered: {model.registeredAt}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Neural Architecture</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{model.architecture}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Trainable Parameters</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">{model.parameters}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Training Corpora</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block truncate">{model.trainingDataset}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#526175] flex flex-col gap-1">
              <span className="font-bold text-slate-800">Tamil Acoustic Adaptation & Phonetic Tuning:</span>
              <p className="leading-relaxed">{model.notes}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
