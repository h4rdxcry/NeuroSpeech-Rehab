import React from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { ResearchDisclaimer } from '../common/ResearchDisclaimer';
import { 
  Database, 
  Volume2, 
  Users, 
  History, 
  FileText, 
  CheckSquare, 
  Cpu, 
  ArrowRight, 
  ShieldCheck, 
  GitBranch, 
  Layers 
} from 'lucide-react';

export const ResearchOverview: React.FC = () => {
  const { setActiveTab, datasets, recordings, evaluations, models, participants } = useApp();

  const navCards = [
    {
      id: 'datasets',
      title: 'Datasets & Provenance',
      description: 'Audit registered corpora, training splits, licensing, and QC pass/fail states.',
      count: `${datasets.length} Datasets`,
      icon: Database,
      color: 'from-blue-50 to-indigo-50/50 text-[#2563EB]'
    },
    {
      id: 'recordings',
      title: 'Recordings & Signals',
      description: 'Inspect PCM acoustic captures, computed formants, pitch tracks, and SHA-256 hashes.',
      count: `${recordings.length} Recordings`,
      icon: Volume2,
      color: 'from-teal-50 to-emerald-50/50 text-[#0F9F94]'
    },
    {
      id: 'participants',
      title: 'Participants Registry',
      description: 'Pseudonymous participant cohort data, consent dates, and linked session logs.',
      count: `${participants.length} Cohort profiles`,
      icon: Users,
      color: 'from-sky-50 to-blue-50/50 text-sky-600'
    },
    {
      id: 'sessions',
      title: 'Sessions Lineage',
      description: 'Review structured practice trials, duration logs, and multimodal recordings links.',
      count: 'Lineage mapped',
      icon: History,
      color: 'from-slate-50 to-zinc-50 text-slate-700'
    },
    {
      id: 'annotations',
      title: 'Annotations Archive',
      description: 'Phonetic boundaries, articulatory notes, and acoustic signal quality records.',
      count: '3 Verified tags',
      icon: FileText,
      color: 'from-amber-50 to-orange-50/50 text-amber-700'
    },
    {
      id: 'evaluation',
      title: 'Evaluation Runs',
      description: 'Empirical Character Error Rate (CER), Word Error Rate (WER), and protocol limitations.',
      count: `${evaluations.length} Evaluation runs`,
      icon: CheckSquare,
      color: 'from-emerald-50 to-teal-50/50 text-emerald-700'
    },
    {
      id: 'models',
      title: 'Model Registry',
      description: 'Inspect Conformer & Whisper checkpoints, parameters, and Tamil acoustic adaptation.',
      count: `${models.length} Model checkpoints`,
      icon: Cpu,
      color: 'from-indigo-50 to-violet-50/50 text-indigo-700'
    }
  ];

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Hero: Research Evidence Workspace (Mandate #35) */}
      <GlassCard 
        padding="lg" 
        className="bg-gradient-to-br from-white/95 via-[#F8FAFC] to-[#EAF2FF]/50 border-slate-200/90 shadow-sm"
      >
        <div className="flex flex-col gap-2 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-xs font-bold uppercase tracking-wider w-fit">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Traceability First</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#10213A] tracking-tight">
            Research Evidence Workspace
          </h1>

          <p className="text-base text-[#526175] leading-relaxed">
            Follow each result back to its source. Inspect registered datasets, acoustic feature extraction algorithms, model checkpoint architectures, and empirical evaluation metrics under strict scientific provenance.
          </p>
        </div>
      </GlassCard>

      {/* 7 Large Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {navCards.map(card => {
          const Icon = card.icon;
          return (
            <GlassCard
              key={card.id}
              padding="md"
              onClick={() => setActiveTab(card.id)}
              className="flex flex-col justify-between gap-4 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {card.count}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-bold text-[#10213A] group-hover:text-[#2563EB] transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-xs text-[#526175] leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2563EB] pt-2 border-t border-slate-100">
                <span>Open module</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </GlassCard>
          );
        })}
      </div>

      <ResearchDisclaimer />
    </div>
  );
};
