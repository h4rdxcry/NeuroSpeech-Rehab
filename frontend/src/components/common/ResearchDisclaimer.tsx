import React from 'react';
import { Info } from 'lucide-react';

interface ResearchDisclaimerProps {
  compact?: boolean;
  className?: string;
  customText?: string;
}

export const ResearchDisclaimer: React.FC<ResearchDisclaimerProps> = ({
  compact = false,
  className = '',
  customText
}) => {
  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100/90 border border-slate-200/80 text-xs text-[#526175] ${className}`}
        role="note"
      >
        <Info className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
        <span>Research software — not a medical diagnosis or clinical score.</span>
      </div>
    );
  }

  return (
    <aside 
      className={`flex items-start gap-3 p-4 rounded-xl bg-[#EAF2FF]/60 border border-[#2563EB]/20 text-xs sm:text-sm text-[#10213A] ${className}`}
      role="note"
      aria-label="Research Software Notice"
    >
      <div className="w-6 h-6 rounded-md bg-[#2563EB]/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#2563EB]">
        <Info className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-[#174EA6]">Research Prototype Notice</span>
        <p className="text-[#526175] leading-relaxed">
          {customText || 'NeuroSpeech Rehab is an AI-assisted research platform. Output metrics, acoustic formants, and speech transcripts are experimental research records and do not constitute clinical diagnoses, medical device measurements, or therapeutic efficacy evaluations.'}
        </p>
      </div>
    </aside>
  );
};
