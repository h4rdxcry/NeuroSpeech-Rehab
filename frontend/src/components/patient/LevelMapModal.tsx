import React from 'react';
import { ViewJourney } from './ViewJourney';
import { X } from 'lucide-react';

interface LevelMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLevel: (levelNum: number) => void;
}

export const LevelMapModal: React.FC<LevelMapModalProps> = ({
  isOpen,
  onClose,
  onSelectLevel,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-map-modal-title"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#F8FAFC] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <span id="journey-map-modal-title" className="text-sm font-bold text-[#10213A] tracking-tight">
            100-Level Rehabilitation Journey Map
          </span>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close Journey Map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ViewJourney
            isModal={true}
            onSelectLevel={(lvl) => {
              onSelectLevel(lvl);
              onClose();
            }}
          />
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 bg-white border-t border-slate-200/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
