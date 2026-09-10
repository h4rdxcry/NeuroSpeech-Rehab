import React from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { CheckSquare, AlertCircle, Info, Activity, Cpu } from 'lucide-react';

export const ResearchEvaluation: React.FC = () => {
  const { evaluations } = useApp();

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Header (Mandate #44 & #45: Experiment results, not marketing accuracy) */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A]">
          Evaluation Runs & Benchmark Results
        </h1>
        <p className="text-sm sm:text-base text-[#526175] mt-1">
          Objective automatic speech recognition (ASR) error rates across validation and test partitions.
        </p>
      </div>

      {/* Metric Definitions Card (Mandate #45: Explicit definitions of CER and WER) */}
      <GlassCard padding="md" className="bg-slate-50/80 border-slate-200 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Acoustic & Phonetic Metric Definitions
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-[#10213A] block mb-1">
              Character Error Rate (CER)
            </span>
            <span>
              Calculated as (Substitutions + Deletions + Insertions) / Total Reference Characters. Lower is better. For Tamil agglutinative morphology, CER is the standard fidelity measure.
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="font-bold text-[#10213A] block mb-1">
              Word Error Rate (WER)
            </span>
            <span>
              Calculated as (Substitutions + Deletions + Insertions) / Total Reference Words. Lower is better. Evaluates whole lexical token recovery across phrase trials.
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Evaluation Runs Grid */}
      <div className="flex flex-col gap-4">
        {evaluations.map(run => (
          <GlassCard key={run.id} padding="lg" className="flex flex-col gap-4 bg-white border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-slate-900">{run.id}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-xs">
                  {run.modelVersion}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                  {run.split}
                </span>
              </div>

              <span className="text-xs text-slate-400">Run: {run.timestamp}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* CER */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Character Error Rate</span>
                <span className="text-2xl font-extrabold text-[#10213A] mt-1 block">
                  {(run.metrics.cer * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">CER (lower is better)</span>
              </div>

              {/* WER */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Word Error Rate</span>
                <span className="text-2xl font-extrabold text-[#10213A] mt-1 block">
                  {(run.metrics.wer * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">WER (lower is better)</span>
              </div>

              {/* Latency */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Mean Inference Latency</span>
                <span className="text-2xl font-extrabold text-[#10213A] mt-1 block">
                  {run.metrics.latencyMs}ms
                </span>
                <span className="text-[10px] text-slate-500">End-to-end token latency</span>
              </div>

              {/* Loss */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Validation Loss</span>
                <span className="text-2xl font-extrabold text-[#10213A] mt-1 block">
                  {run.metrics.sampleLoss.toFixed(3)}
                </span>
                <span className="text-[10px] text-slate-500">CTC loss on partition</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Evaluation Corpus:</span>
                <span>{run.datasetName} ({run.sampleCount} test utterances)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Protocol:</span>
                <span>{run.protocol}</span>
              </div>
            </div>

            {/* Limitations Box (Mandate #44: Stored protocol limitations) */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold block mb-0.5">Stated Scientific Limitations:</span>
                <p>{run.limitationsNote}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
