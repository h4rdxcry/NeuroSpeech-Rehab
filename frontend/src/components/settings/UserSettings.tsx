import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Contrast, 
  Eye, 
  Sparkles, 
  Check, 
  Sun, 
  Moon, 
  Monitor, 
  Sliders, 
  ShieldCheck, 
  Volume2, 
  Keyboard, 
  Info,
  Layers,
  Activity
} from 'lucide-react';

export interface UserSettingsProps {
  variant?: 'card' | 'modal' | 'compact';
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  variant = 'card',
  onClose,
  showCloseButton = false,
  className = ''
}) => {
  const { 
    accessibility, 
    updateAccessibility, 
    toggleContrastMode, 
    theme, 
    setTheme, 
    resolvedTheme, 
    role, 
    currentUser 
  } = useApp();

  const isHighContrast = accessibility.higherContrast;

  const handleSelectMode = (highContrast: boolean) => {
    if (accessibility.higherContrast !== highContrast) {
      toggleContrastMode();
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Header section (if requested with close button or standalone) */}
      {showCloseButton && (
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isHighContrast 
                ? 'bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white' 
                : 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80'
            }`}>
              <Contrast className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#10213A] dark:text-[#F1F5F9]">
                User Display Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Contrast calibration and visual accessibility for {role === 'clinician' ? 'clinicians' : 'patients'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      )}

      {/* CORE FEATURE: Contrast Mode Switcher (Default vs High-Contrast) */}
      <section 
        aria-labelledby="contrast-mode-heading"
        className={`p-5 rounded-2xl border transition-all ${
          isHighContrast
            ? 'bg-white dark:bg-[#050A14] border-2 border-[#0F172A] dark:border-white shadow-none'
            : 'bg-white/80 dark:bg-[#121E3E]/70 border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="contrast-mode-heading" className="text-base font-bold text-[#10213A] dark:text-[#F1F5F9]">
                Visual Contrast Mode
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isHighContrast
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}>
                {isHighContrast ? 'High Contrast (WCAG AAA)' : 'Default Mode (WCAG AA)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select between the standard clinical palette or enhanced high-contrast mode for sharp edge visibility.
            </p>
          </div>

          {/* Quick Toggle Button */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 hidden sm:inline">
              {isHighContrast ? 'High Contrast Active' : 'Default Active'}
            </span>
            <button
              type="button"
              role="switch"
              id="contrast-mode-switch"
              aria-checked={isHighContrast}
              onClick={toggleContrastMode}
              className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 ${
                isHighContrast ? 'bg-[#1D4ED8] dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              title="Click or press Alt+C to toggle contrast mode"
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${
                isHighContrast ? 'translate-x-6' : 'translate-x-0'
              }`}>
                <Contrast className={`w-3.5 h-3.5 ${isHighContrast ? 'text-[#1D4ED8]' : 'text-slate-500'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Side-by-Side Archetype Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" role="radiogroup" aria-label="Contrast Mode Options">
          {/* OPTION 1: Default Mode */}
          <div
            role="radio"
            aria-checked={!isHighContrast}
            tabIndex={0}
            onClick={() => handleSelectMode(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectMode(false); } }}
            className={`p-4 rounded-xl cursor-pointer transition-all border text-left flex flex-col justify-between gap-3 ${
              !isHighContrast
                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#2563EB] dark:border-blue-500 ring-2 ring-[#2563EB]/20 shadow-xs'
                : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center border-slate-400">
                    {!isHighContrast && <div className="w-2 h-2 rounded-full bg-[#2563EB]" />}
                  </div>
                  <span className="text-sm font-bold text-[#10213A] dark:text-[#F1F5F9]">
                    Default Mode
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  WCAG AA (4.5:1)
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Refined clinical glassmorphism with subtle borders, smooth depth shadows, and balanced tones. Designed for standard lighting conditions and extended therapy sessions.
              </p>
            </div>

            {/* Visual Micro-Wireframe Preview */}
            <div className="p-3 rounded-lg bg-[#F4F8FC] dark:bg-[#0B132B] border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Standard Canvas</span>
                <span className="font-mono text-[9px] text-[#2563EB]">Soft Borders</span>
              </div>
              <div className="p-2 rounded bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-between">
                <span>Sample Element</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>

          {/* OPTION 2: High-Contrast Mode */}
          <div
            role="radio"
            aria-checked={isHighContrast}
            tabIndex={0}
            onClick={() => handleSelectMode(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectMode(true); } }}
            className={`p-4 rounded-xl cursor-pointer transition-all border text-left flex flex-col justify-between gap-3 ${
              isHighContrast
                ? 'bg-white dark:bg-[#080D1A] border-2 border-[#0F172A] dark:border-white ring-2 ring-[#0F172A]/20 dark:ring-white/20 shadow-xs'
                : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center border-slate-400">
                    {isHighContrast && <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />}
                  </div>
                  <span className="text-sm font-bold text-[#10213A] dark:text-[#F1F5F9]">
                    High-Contrast Mode
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  WCAG AAA (7:1+)
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Maximized edge sharpness, solid non-transparent cards, distinct 2px borders, and heightened typographic contrast. Recommended for low-vision patients and clinicians in bright sunlight.
              </p>
            </div>

            {/* Visual Micro-Wireframe Preview */}
            <div className="p-3 rounded-lg bg-white dark:bg-black border-2 border-black dark:border-white flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-black dark:text-white">
                <span>Stark Solid Canvas</span>
                <span className="font-mono text-[9px] underline">2px Solid Outline</span>
              </div>
              <div className="p-2 rounded bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-between">
                <span>High-Visibility Element</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black" />
              </div>
            </div>
          </div>
        </div>

        {/* Live Active Preview Demo Box */}
        <div className="mt-5 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Eye className="w-3.5 h-3.5" />
              <span>Real-Time Component Preview</span>
            </div>
            <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
              isHighContrast 
                ? 'bg-black text-white dark:bg-white dark:text-black' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {isHighContrast ? 'AAA 14.8:1' : 'AA 4.8:1'}
            </span>
          </div>

          {/* Dynamic sample card reflecting current mode */}
          <div className={`p-4 rounded-xl transition-all ${
            isHighContrast
              ? 'bg-white dark:bg-black border-2 border-black dark:border-white shadow-none'
              : 'bg-white dark:bg-[#152244] border border-slate-200 dark:border-slate-700 shadow-xs'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isHighContrast ? 'text-black dark:text-white underline' : 'text-[#2563EB] dark:text-blue-400'
              }`}>
                {role === 'clinician' ? 'Clinical Spectrogram Marker' : 'Target Speech Exercise'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                isHighContrast
                  ? 'bg-emerald-200 text-emerald-950 border border-black dark:border-white'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200'
              }`}>
                {role === 'clinician' ? 'QC PASS' : 'Level 25 Active'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`text-lg font-extrabold ${isHighContrast ? 'text-black dark:text-white' : 'text-[#10213A] dark:text-[#F1F5F9]'}`}>
                {role === 'clinician' ? 'Patient PT-TML-0104 • F0: 142 Hz (Normal)' : 'வணக்கம் • Vanakkam'}
              </span>
              <p className={`text-xs ${isHighContrast ? 'text-black dark:text-white font-medium' : 'text-[#526175] dark:text-slate-400'}`}>
                {role === 'clinician' 
                  ? 'High-contrast mode guarantees formant tracks and signal boundaries remain razor-sharp under clinical fluorescent lighting.'
                  : 'Enhanced contrast mode sharpens Tamil glyph boundaries and phoneme pronunciation guidance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Keyboard Quick Toggle:</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 shadow-2xs">Alt</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 shadow-2xs">C</kbd>
          </div>
        </div>
      </section>

      {/* COMPLEMENTARY DISPLAY CONTROLS */}
      <section 
        aria-labelledby="display-preferences-heading"
        className={`p-5 rounded-2xl border transition-all ${
          isHighContrast
            ? 'bg-white dark:bg-[#050A14] border-2 border-[#0F172A] dark:border-white'
            : 'bg-white/80 dark:bg-[#121E3E]/70 border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md'
        }`}
      >
        <h3 id="display-preferences-heading" className="text-base font-bold text-[#10213A] dark:text-[#F1F5F9] mb-1">
          Complementary Display Preferences
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Pair contrast mode with font sizing, motion reduction, and color temperature controls.
        </p>

        <div className="flex flex-col gap-3">
          {/* Color Theme (Light / Dark / System) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9]">Color Theme</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Light, dark, or automatic system appearance ({resolvedTheme === 'dark' ? 'currently Dark' : 'currently Light'}).
              </span>
            </div>
            <div 
              className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700"
              role="radiogroup"
              aria-label="Color Theme"
            >
              {[
                { mode: 'light', label: 'Light', icon: Sun },
                { mode: 'dark', label: 'Dark', icon: Moon },
                { mode: 'system', label: 'System', icon: Monitor }
              ].map(opt => {
                const Icon = opt.icon;
                const isSelected = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setTheme(opt.mode as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Larger Text Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9]">Larger Text</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Scales target text, instructions, and metrics by 112.5%.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={accessibility.largerText}
              onClick={() => updateAccessibility({ largerText: !accessibility.largerText })}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 ${
                accessibility.largerText ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                accessibility.largerText ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9]">Reduce Motion</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Disables animated transitions and waveform oscillations.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={accessibility.reduceMotion}
              onClick={() => updateAccessibility({ reduceMotion: !accessibility.reduceMotion })}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 ${
                accessibility.reduceMotion ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                accessibility.reduceMotion ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Calm Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9]">Calm Mode</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Removes visual gradients and bright pulse indicators for sensory comfort.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={accessibility.calmMode}
              onClick={() => updateAccessibility({ calmMode: !accessibility.calmMode })}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 ${
                accessibility.calmMode ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                accessibility.calmMode ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Audio Verbal Confirmation */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9]">Verbal Affirmation</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Speaks calm voice feedback upon successful speech practice completion.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!accessibility.verbalConfirmation}
              onClick={() => updateAccessibility({ verbalConfirmation: !accessibility.verbalConfirmation })}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 ${
                accessibility.verbalConfirmation ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                accessibility.verbalConfirmation ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </section>

      {/* Role-Specific Information Footnote */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Settings are automatically persisted to your browser storage and will remain active across practice sessions and clinical reviews.
        </span>
      </div>
    </div>
  );
};
