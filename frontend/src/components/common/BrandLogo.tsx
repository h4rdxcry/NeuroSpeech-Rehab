import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  size = 'md', 
  showSubtitle = false, 
  className = '' 
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const titleSizes = {
    sm: 'text-base font-semibold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-extrabold'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 2026 NeuroSpeech Motif: Voice waveform arcs + neural node */}
      <div 
        className={`${iconSizes[size]} relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#174EA6] text-white shadow-sm flex-shrink-0`}
        aria-hidden="true"
      >
        <svg 
          viewBox="0 0 32 32" 
          fill="none" 
          stroke="currentColor" 
          className="w-3/5 h-3/5"
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* Left voice acoustic arc */}
          <path d="M7 11C8.2 13 8.2 19 7 21" strokeOpacity="0.8" />
          <path d="M11 8C13 11 13 21 11 24" />
          
          {/* Center neural articulatory node */}
          <circle cx="16" cy="16" r="3.2" fill="white" stroke="#2563EB" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="1.2" fill="#2563EB" />
          
          {/* Right speech wave arc */}
          <path d="M21 8C19 11 19 21 21 24" />
          <path d="M25 11C23.8 13 23.8 19 25 21" strokeOpacity="0.8" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`tracking-tight text-[#10213A] ${titleSizes[size]}`}>
            NeuroSpeech
          </span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-[#EAF2FF] text-[#2563EB] tracking-wide uppercase">
            Rehab
          </span>
        </div>
        {showSubtitle && (
          <span className="text-xs text-[#526175] font-medium tracking-normal mt-0.5">
            Multimodal Speech Rehabilitation Research Platform
          </span>
        )}
      </div>
    </div>
  );
};
