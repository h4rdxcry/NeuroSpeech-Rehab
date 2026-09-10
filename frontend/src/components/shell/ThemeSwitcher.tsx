import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ThemeMode } from '../../types';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
    { 
      mode: 'light', 
      label: 'Light', 
      icon: Sun, 
      desc: 'Daylight clinical theme with high contrast' 
    },
    { 
      mode: 'dark', 
      label: 'Dark', 
      icon: Moon, 
      desc: 'Eye-comfortable midnight theme for low-glare sessions' 
    },
    { 
      mode: 'system', 
      label: 'System', 
      icon: Monitor, 
      desc: `Follows device setting (${resolvedTheme === 'dark' ? 'currently Dark' : 'currently Light'})` 
    },
  ];

  const currentOption = options.find(o => o.mode === theme) || options[2];
  const CurrentIcon = currentOption.icon;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Desktop Segmented Control (sm:flex) */}
      <div 
        className="hidden lg:inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs"
        role="radiogroup"
        aria-label="Color theme selection"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              id={`theme-option-${opt.mode}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.mode)}
              title={`${opt.label} mode: ${opt.desc}`}
              className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 shadow-xs ring-1 ring-slate-200/60 dark:ring-slate-700/60'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#2563EB] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{opt.label}</span>
              {opt.mode === 'system' && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  ({resolvedTheme === 'dark' ? 'Dark' : 'Light'})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact Header Button (Default for mobile / tablet < lg) */}
      <div className="lg:hidden">
        <button
          id="theme-switcher-btn"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 ${
            isOpen
              ? 'bg-[#EAF2FF] dark:bg-slate-800 border-[#2563EB] dark:border-blue-500 text-[#2563EB] dark:text-blue-400'
              : 'bg-white dark:bg-[#152244] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1C2C55]'
          }`}
          title={`Active theme: ${currentOption.label} (${theme === 'system' ? resolvedTheme : theme}). Click to change.`}
          aria-label={`Color theme switcher, currently ${currentOption.label}`}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-semibold capitalize">
            {theme === 'system' ? `Auto (${resolvedTheme})` : currentOption.label}
          </span>
        </button>

        {/* Dropdown Menu for Compact Screen Sizes */}
        {isOpen && (
          <div 
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#152244] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
            role="menu"
            aria-label="Theme mode selection menu"
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1">
              Color Theme
            </div>

            <div className="flex flex-col gap-1">
              {options.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setTheme(opt.mode);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#EAF2FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${
                        isSelected 
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-[#2563EB] dark:text-blue-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {opt.desc}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
