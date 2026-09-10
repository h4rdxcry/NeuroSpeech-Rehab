import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { ToastContainer } from '../common/ToastContainer';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserSettingsModal } from '../settings/UserSettingsModal';
import { UserRole } from '../../types';
import { 
  Home, 
  Mic, 
  History, 
  Settings, 
  Users, 
  Activity, 
  Database, 
  FileText, 
  CheckSquare, 
  Cpu, 
  Eye, 
  Layers, 
  Sliders, 
  LogOut, 
  ChevronDown, 
  Volume2, 
  SunMedium, 
  Sparkles,
  Menu,
  X,
  Compass,
  Contrast
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { 
    role, 
    setRole, 
    currentUser, 
    activeTab, 
    setActiveTab, 
    logout,
    accessibility,
    updateAccessibility,
    toggleContrastMode,
    connection 
  } = useApp();

  const [isA11yOpen, setIsA11yOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Global accessibility shortcut: Alt+C to toggle contrast mode
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        toggleContrastMode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleContrastMode]);

  // Patient Navigation items
  const patientNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'journey', label: '100-Level Journey', icon: Compass },
    { id: 'progress', label: 'Progress & History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Clinician Navigation items
  const clinicianNav = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'sessions', label: 'Sessions', icon: History },
    { id: 'recordings', label: 'Recordings', icon: Volume2 },
    { id: 'annotations', label: 'Annotations', icon: CheckSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Researcher Navigation items
  const researcherNav = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'datasets', label: 'Datasets & Provenance', icon: Database },
    { id: 'recordings', label: 'Recordings & Signals', icon: Volume2 },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'sessions', label: 'Sessions', icon: History },
    { id: 'annotations', label: 'Annotations', icon: FileText },
    { id: 'evaluation', label: 'Evaluation Runs', icon: CheckSquare },
    { id: 'models', label: 'Model Registry', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const currentNavItems = role === 'patient' 
    ? patientNav 
    : role === 'clinician' 
      ? clinicianNav 
      : researcherNav;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setIsRoleMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F8FC] dark:bg-[#0B132B] text-[#10213A] dark:text-[#F1F5F9] transition-colors duration-200 relative">
      <ToastContainer />

      {/* Top Header */}
      <header 
        id="app-header" 
        className="sticky top-0 z-40 w-full bg-white/85 dark:bg-[#111C3D]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-3 transition-colors"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-4">
            <BrandLogo size="md" />
            
            {/* Role Badge Indicator */}
            <div className="hidden sm:inline-flex items-center">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                role === 'patient' 
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60' 
                  : role === 'clinician'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F9F94] dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/60'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60'
              }`}>
                {role === 'patient' ? 'Patient Workspace' : role === 'clinician' ? 'Clinician Portal' : 'Research Evidence Workspace'}
              </span>
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* System Connection Dot (Clinician & Researcher only, as required by prompt) */}
            {role !== 'patient' && (
              <div 
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium"
                title={`API: ${connection.endpointUrl}`}
              >
                <span className={`w-2 h-2 rounded-full ${connection.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{connection.status === 'connected' ? 'Connected' : 'Unavailable'}</span>
              </div>
            )}

            {/* Theme Switcher: Light, Dark, System */}
            <ThemeSwitcher />

            {/* Contrast Mode Toggle Button (Default vs High-Contrast) */}
            <button
              id="header-contrast-toggle-btn"
              type="button"
              onClick={toggleContrastMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                accessibility.higherContrast
                  ? 'bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white shadow-xs'
                  : 'bg-white dark:bg-[#152244] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1C2C55]'
              }`}
              title={`Toggle Contrast Mode (Currently: ${accessibility.higherContrast ? 'High-Contrast' : 'Default'}) [Alt+C]`}
              aria-label={`Toggle contrast mode. Currently ${accessibility.higherContrast ? 'High Contrast' : 'Default mode'}`}
            >
              <Contrast className="w-4 h-4" />
              <span className="hidden xl:inline text-xs font-bold">
                {accessibility.higherContrast ? 'High Contrast' : 'Default'}
              </span>
            </button>

            {/* User Settings Modal Trigger */}
            <button
              id="header-user-settings-btn"
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl border bg-white dark:bg-[#152244] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1C2C55] transition-colors"
              title="User Settings & Display Calibration"
              aria-label="User Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Accessibility Quick Toggle */}
            <div className="relative">
              <button
                id="a11y-toggle-btn"
                type="button"
                onClick={() => setIsA11yOpen(!isA11yOpen)}
                className={`p-2 rounded-xl border transition-all ${
                  isA11yOpen 
                    ? 'bg-[#EAF2FF] dark:bg-blue-950/70 border-[#2563EB] dark:border-blue-500 text-[#2563EB] dark:text-blue-400' 
                    : 'bg-white dark:bg-[#152244] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1C2C55]'
                }`}
                title="Accessibility Preferences (Larger Text, High Contrast, Reduced Motion, Calm Mode)"
                aria-label="Accessibility options"
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* Accessibility Menu Dropdown */}
              {isA11yOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#152244] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
                  role="dialog"
                  aria-label="Accessibility Preferences"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Accessibility & Display
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setIsA11yOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3.5 mt-3">
                    {/* High Contrast Mode Quick Switch */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Contrast Mode</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          {accessibility.higherContrast ? 'High-Contrast Active' : 'Default Palette'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleContrastMode}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          accessibility.higherContrast
                            ? 'bg-black dark:bg-white text-white dark:text-black'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {accessibility.higherContrast ? 'High' : 'Default'}
                      </button>
                    </div>

                    {/* Larger Text */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Larger Text</span>
                      <input 
                        type="checkbox"
                        checked={accessibility.largerText}
                        onChange={e => updateAccessibility({ largerText: e.target.checked })}
                        className="w-5 h-5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>

                    {/* High Contrast */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Higher Contrast (AAA)</span>
                      <input 
                        type="checkbox"
                        checked={accessibility.higherContrast}
                        onChange={e => updateAccessibility({ higherContrast: e.target.checked })}
                        className="w-5 h-5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>

                    {/* Reduced Motion */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Reduce Motion</span>
                      <input 
                        type="checkbox"
                        checked={accessibility.reduceMotion}
                        onChange={e => updateAccessibility({ reduceMotion: e.target.checked })}
                        className="w-5 h-5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>

                    {/* Calm Mode */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">Calm Mode</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Reduces visual stimulation</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={accessibility.calmMode}
                        onChange={e => updateAccessibility({ calmMode: e.target.checked })}
                        className="w-5 h-5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>

                    {/* Calm Verbal Confirmation */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 block">Calm Verbal Confirmation</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Speaks audio affirmation on success</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={!!accessibility.verbalConfirmation}
                        onChange={e => updateAccessibility({ verbalConfirmation: e.target.checked })}
                        className="w-5 h-5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                      />
                    </label>

                    {/* Link to Full User Settings modal */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsA11yOpen(false);
                        setIsSettingsModalOpen(true);
                      }}
                      className="mt-2 w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#2563EB] dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Open User Settings</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Role Switcher Menu */}
            <div className="relative">
              <button
                id="role-switcher-btn"
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-xl bg-white dark:bg-[#152244] border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-[#10213A] dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-[#1C2C55] transition-colors shadow-2xs"
                aria-expanded={isRoleMenuOpen}
              >
                <span className="hidden sm:inline text-slate-400 dark:text-slate-400 font-normal">Role:</span>
                <span className="capitalize font-bold text-[#2563EB] dark:text-blue-400">{role}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isRoleMenuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#152244] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  role="menu"
                >
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Switch Workspace Role
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('patient')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                      role === 'patient' ? 'bg-[#EAF2FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>Patient Practice</span>
                    {role === 'patient' && <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-blue-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('clinician')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                      role === 'clinician' ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F9F94] dark:text-teal-400 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>Clinician Portal</span>
                    {role === 'clinician' && <span className="w-2 h-2 rounded-full bg-[#0F9F94] dark:bg-teal-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('researcher')}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                      role === 'researcher' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>Research Workspace</span>
                    {role === 'researcher' && <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out / Change account</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Nav Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152244] text-slate-600 dark:text-slate-300"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main App Canvas */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 gap-6">
        {/* Left Sidebar Navigation for Clinician and Researcher on Desktop */}
        {role !== 'patient' && (
          <aside 
            id="desktop-sidebar" 
            className="hidden md:flex flex-col w-64 shrink-0 gap-6"
            aria-label="Sidebar Navigation"
          >
            <div className="bg-white/90 dark:bg-[#111C3D]/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-sm flex flex-col gap-1 sticky top-24">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {role === 'clinician' ? 'Clinical Workspace' : 'Research Evidence'}
              </div>

              {currentNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-[#2563EB] text-white shadow-xs font-semibold' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* User Profile Snippet */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 px-3 flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{currentUser.email}</span>
              </div>
            </div>
          </aside>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Patient Desktop Navigation Bar (Gentle top pill nav for Patient) */}
          {role === 'patient' && (
            <div className="hidden md:flex w-full mb-6">
              <nav 
                id="patient-desktop-nav"
                className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-white/90 dark:bg-[#111C3D]/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-xs"
                aria-label="Patient Primary Navigation"
              >
                {patientNav.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`patient-nav-${item.id}`}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive 
                          ? 'bg-[#2563EB] text-white shadow-xs' 
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Main Content Viewport */}
          <main 
            id="main-content" 
            className="flex-1 min-w-0 flex flex-col focus:outline-none"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Drawer Navigation (When hamburger menu is opened) */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-72 bg-white dark:bg-[#111C3D] h-full p-6 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <BrandLogo size="sm" />
              <button 
                type="button" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
                Navigation
              </span>
              {currentNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      isActive ? 'bg-[#2563EB] text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">Signed in as {currentUser.name}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold py-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Bottom Navigation for Mobile */}
      {role === 'patient' && (
        <nav 
          id="patient-mobile-bottom-nav" 
          className="md:hidden sticky bottom-0 z-40 bg-white/95 dark:bg-[#111C3D]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-2 flex items-center justify-around"
          aria-label="Mobile Bottom Navigation"
        >
          {patientNav.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl min-w-[64px] min-h-[48px] transition-colors ${
                  isActive ? 'text-[#2563EB] dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-[#2563EB] dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      {/* Global User Settings Modal */}
      <UserSettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />
    </div>
  );
};
