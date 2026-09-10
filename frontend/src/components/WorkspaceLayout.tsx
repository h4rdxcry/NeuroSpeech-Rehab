import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AudioLines, Home, Mic, History, Settings2, Database, FolderOpen, Users, ClipboardList, FlaskConical, Layers, Sparkles, HeartHandshake, ShieldCheck, Stethoscope } from 'lucide-react'
import { applyPreferences, readPreferences } from '../lib/preferences'

const navigation = {
  patient: [
    ['/home', 'Home', Home],
    ['/session', 'Live Therapy', Mic],
    ['/progress', 'Progress', History],
    ['/settings', 'Settings', Settings2],
  ],
  clinician: [
    ['', 'Overview', Home],
    ['/patients', 'Patients', Users],
    ['/sessions', 'Sessions', ClipboardList],
    ['/recordings', 'Recordings', FolderOpen],
    ['/annotations', 'Annotations', Layers],
  ],
  research: [
    ['', 'Overview', Home],
    ['/participants', 'Participants', Users],
    ['/sessions', 'Sessions', ClipboardList],
    ['/datasets', 'Datasets', Database],
    ['/recordings', 'Recordings', FolderOpen],
    ['/annotations', 'Annotations', Layers],
    ['/evaluation', 'Evaluation', FlaskConical],
    ['/models', 'Models', Layers],
  ],
} as const;

export default function WorkspaceLayout({ mode, children }: { mode: keyof typeof navigation; children?: React.ReactNode }) {
  const location = useLocation();
  const [calmMode, setCalmMode] = useState(false);

  useEffect(() => {
    applyPreferences(readPreferences());
  }, []);

  useEffect(() => {
    const active = navigation[mode].find(([path]) => (path === '' ? `/${mode}` : `/${mode}${path}`) === location.pathname);
    document.title = `${active?.[1] ?? 'Studio'} · NeuroSpeech Gemini Neural v2.4`;
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname, mode]);

  return (
    <div className={`workspace ${mode}-workspace font-manrope ${calmMode ? 'bg-[#f4f7fa]' : ''}`}>
      {/* Google Stitch Ambient Luminous Blobs */}
      <div className="ambient-glow-tl" />
      <div className="ambient-glow-tr" />
      <div className="ambient-glow-b" />

      <a className="skip-link" href="#main-content">Skip to main content</a>

      {/* Stitch Frosted Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="flex items-center gap-6">
            <NavLink to={`/${mode}${mode === 'patient' ? '/session' : ''}`} className="brand" aria-label="NeuroSpeech Rehabilitation">
              <span className="brand-mark">
                <AudioLines size={22} className="text-white" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-outfit text-xl font-bold tracking-tight text-on-surface">NeuroSpeech</span>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-primary-fixed text-primary text-[10px] font-bold tracking-wider uppercase border border-primary-fixed-dim/60">
                    Research PC Workstation
                  </span>
                </div>
                <span className="brand-subtitle font-manrope">AI-Based Multimodal Speech Rehabilitation · EEG + sEMG + Facial Tracking</span>
              </div>
            </NavLink>

            {/* AI Neural Engine Online Status Pill */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary-fixed/40 text-on-tertiary-fixed border border-tertiary-fixed-dim/50 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary-container"></span>
              </span>
              <span className="text-[11px] font-semibold tracking-wide">Research Engine Synchronized (EEG / EMG / 3D Kinematics)</span>
            </div>
          </div>

          {/* Navigation Pill */}
          <nav aria-label={`${mode === 'patient' ? 'Patient' : mode === 'clinician' ? 'Clinician' : 'Research'} navigation`} className="nav-pill">
            {navigation[mode].map(([path, label, Icon]) => {
              const to = `/${mode}${path}`;
              const isLive = path === '/session';
              return (
                <NavLink
                  end
                  key={path}
                  to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                  {isLive && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] leading-tight font-bold bg-secondary-fixed text-on-secondary-fixed">
                      Live
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCalmMode((prev) => !prev)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                calmMode
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/30'
              }`}
              title="Calm Sensory Mode"
            >
              <HeartHandshake size={14} />
              <span>{calmMode ? 'Calm Mode Active' : 'Calm Mode'}</span>
            </button>

            {mode === 'patient' ? (
              <NavLink
                to="/clinician"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs font-semibold border border-outline-variant/30 transition-all"
              >
                <Stethoscope size={14} className="text-primary" />
                <span>Clinician Portal</span>
              </NavLink>
            ) : (
              <NavLink
                to="/patient/session"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-xs font-semibold border border-outline-variant/30 transition-all"
              >
                <Mic size={14} className="text-secondary" />
                <span>Patient Session</span>
              </NavLink>
            )}

            {/* Patient Profile Pill */}
            <div className="flex items-center gap-2 pl-2 py-1 pr-1 rounded-full bg-surface-container-low border border-outline-variant/30">
              <div className="text-right hidden sm:block pl-1">
                <div className="text-xs font-bold text-on-surface leading-tight">Research Station</div>
                <div className="text-[10px] text-on-surface-variant font-medium">Multimodal Biofeedback</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                <Sparkles size={14} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="main-content" tabIndex={-1} className="main-content">
        {children ?? <Outlet />}
      </main>

      {/* Stitch Serene Footer */}
      <footer className="relative z-10 max-w-[1440px] mx-auto px-6 py-6 text-xs text-on-surface-variant flex flex-wrap items-center justify-between gap-4 border-t border-on-surface/[0.06] mt-12 bg-surface-container-lowest/60 backdrop-blur-md rounded-t-3xl">
        <div className="flex items-center gap-2 text-on-surface-variant font-medium">
          <AudioLines size={16} className="text-primary" aria-hidden="true" />
          <span>NeuroSpeech Rehab Studio · AI-Based Multimodal Speech Rehabilitation Using EEG, Facial EMG, and Real-Time Facial Tracking</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-on-surface-variant font-semibold">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-fixed/50 text-on-tertiary-fixed">
            <span className="h-1.5 w-1.5 rounded-full bg-tertiary-container animate-pulse"></span>
            PC Web Workstation (Synchronized)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed/50 text-on-primary-fixed">
            <ShieldCheck size={12} className="text-primary" />
            Clinical Multimodal Engine
          </span>
          <span className="text-outline">High-Resolution Desktop Mode</span>
        </div>
      </footer>
    </div>
  );
}


