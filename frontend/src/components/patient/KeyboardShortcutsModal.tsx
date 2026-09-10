import React, { useEffect, useRef } from 'react';
import { 
  Keyboard, 
  X, 
  Mic, 
  ChevronRight, 
  RotateCcw, 
  Volume2, 
  Map, 
  ArrowLeft, 
  ArrowRight, 
  HelpCircle,
  Accessibility,
  Check,
  Flame
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  label: string;
  description: string;
  icon: typeof Mic;
  badge?: string;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus & listen to Escape inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const coreShortcuts: ShortcutItem[] = [
    {
      keys: ['Space'],
      label: 'Start / Stop Microphone',
      description: 'Activates microphone when ready; stops speaking and submits attempt when listening.',
      icon: Mic,
      badge: 'Primary Action'
    },
    {
      keys: ['Enter ↵'],
      label: 'Continue to Next Level',
      description: 'Advances immediately to the next rehabilitation level after a successful pronunciation attempt.',
      icon: ChevronRight,
      badge: 'Next Step'
    },
    {
      keys: ['R'],
      label: 'Re-practice Level',
      description: 'Clears the current result and resets the speech microphone to practice the level again.',
      icon: RotateCcw
    },
    {
      keys: ['L'],
      label: 'Listen to Reference Audio',
      description: 'Plays the deliberate native articulatory pronunciation sample.',
      icon: Volume2
    },
    {
      keys: ['V'],
      label: 'Toggle Calm Verbal Confirmation',
      description: 'Enables or disables gentle spoken audio affirmations after successful pronunciation so you can maintain screen focus.',
      icon: Volume2,
      badge: 'Accessibility'
    }
  ];

  const navigationShortcuts: ShortcutItem[] = [
    {
      keys: ['S'],
      label: 'Practice Streak Counter',
      description: 'Displays your consecutive days of practice, weekly activity log, and habit tracking details.',
      icon: Flame,
      badge: 'Habit Tracker'
    },
    {
      keys: ['M'],
      label: '100-Level Journey Map',
      description: 'Opens the complete 100-level bilingual speech curriculum map.',
      icon: Map
    },
    {
      keys: ['←'],
      label: 'Previous Level',
      description: 'Steps backward to review previously completed therapy levels.',
      icon: ArrowLeft
    },
    {
      keys: ['→'],
      label: 'Next Unlocked Level',
      description: 'Steps forward to the next unlocked level in the curriculum.',
      icon: ArrowRight
    },
    {
      keys: ['?'],
      label: 'Toggle Shortcuts Help',
      description: 'Opens or dismisses this keyboard shortcuts reference sheet.',
      icon: HelpCircle
    },
    {
      keys: ['Esc'],
      label: 'Close / Dismiss Modal',
      description: 'Dismisses open dialogs, milestone celebrations, or journey map overlays.',
      icon: X
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      ref={modalRef}
    >
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#111C3D] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh]"
        role="document"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-800/60 text-[#2563EB] dark:text-blue-400 flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Therapy Keyboard Shortcuts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accessible hands-free controls designed for efficient, motor-friendly practice
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts guide"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          
          {/* Core Practice Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] dark:text-blue-400">
                Core Speech Practice
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Universal Keybinds
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {coreShortcuts.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={index}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#152244]/70 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#1E2C52] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#2563EB] dark:text-blue-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100/70 dark:bg-blue-900/50 text-[#2563EB] dark:text-blue-300">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kidx) => (
                        <kbd 
                          key={kidx}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 shadow-2xs font-mono font-bold text-xs tracking-wide"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation & Exploration Section */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Navigation & Exploration
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {navigationShortcuts.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={index}
                    className="p-3 rounded-2xl bg-slate-50/60 dark:bg-[#152244]/50 border border-slate-200/70 dark:border-slate-700/50 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#1E2C52] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.label}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.description}
                        </span>
                      </div>
                    </div>

                    <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-2xs font-mono font-bold text-xs shrink-0">
                      {item.keys[0]}
                    </kbd>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accessibility Note */}
          <div className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 flex items-start gap-3">
            <Accessibility className="w-5 h-5 text-[#0F9F94] dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-teal-950 dark:text-teal-200">
                Built for Motor & Vision Accessibility
              </span>
              <p className="text-teal-800/90 dark:text-teal-300/80 leading-relaxed">
                Shortcuts operate with live speech feedback (<code className="font-mono bg-teal-100/60 dark:bg-teal-900/60 px-1 py-0.2 rounded">aria-live="polite"</code>) and are safely bypassed when typing into search fields or configuration forms.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-[#0E1733] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-[10px]">Esc</kbd>
            <span>to close</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold shadow-xs transition-colors"
          >
            Got it, return to practice
          </button>
        </div>
      </div>
    </div>
  );
};
