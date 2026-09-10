import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassCard } from '../common/GlassCard';
import { UserSettings } from '../settings/UserSettings';
import { 
  Sliders, 
  Database, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';

export const ClinicianSettings: React.FC = () => {
  const { 
    currentUser, 
    connection, 
    testConnection, 
    updateConnectionUrl, 
    resetConnection,
    accessibility 
  } = useApp();

  const [endpointInput, setEndpointInput] = useState(connection.endpointUrl);
  const [isSaved, setIsSaved] = useState(false);
  const isHighContrast = accessibility.higherContrast;

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    updateConnectionUrl(endpointInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    resetConnection();
    setEndpointInput('https://api.neurospeech-rehab.internal/v2');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#10213A] dark:text-[#F1F5F9]">
          Clinician Portal Settings
        </h1>
        <p className="text-sm sm:text-base text-[#526175] dark:text-slate-400 mt-1">
          Visual contrast calibration, clinician preferences, and backend clinical endpoints.
        </p>
      </div>

      {/* Embedded User Settings Component (Default vs High-Contrast modes & accessibility) */}
      <UserSettings variant="card" />

      {/* Clinical Workspace & Recording Telemetry */}
      <GlassCard padding="lg" className="flex flex-col gap-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-[#0F9F94] dark:text-teal-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#10213A] dark:text-[#F1F5F9]">
              Clinical Recording & Spectrogram Preferences
            </h2>
            <p className="text-xs text-[#526175] dark:text-slate-400">
              Acoustic capture telemetry and participant pseudonym display defaults.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border ${
            isHighContrast 
              ? 'bg-white dark:bg-black border-2 border-black dark:border-white' 
              : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Audio Telemetry Profile
            </span>
            <span className="text-sm font-bold text-[#10213A] dark:text-[#F1F5F9] block">
              Linear PCM 16kHz • 16-Bit Mono
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
              Calibrated for speech formant and vowel boundary extraction.
            </span>
          </div>

          <div className={`p-4 rounded-xl border ${
            isHighContrast 
              ? 'bg-white dark:bg-black border-2 border-black dark:border-white' 
              : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Active Clinician Session
            </span>
            <span className="text-sm font-bold text-[#10213A] dark:text-[#F1F5F9] block">
              {currentUser?.name || 'Dr. V. Sundaram, SLP'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
              IRB Protocol: IEC-MMC-2025-084 (Authorized)
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Advanced Connection Endpoints */}
      <GlassCard padding="lg" className="flex flex-col gap-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#10213A] dark:text-[#F1F5F9]">
              Clinical API Connection
            </h2>
            <p className="text-xs text-[#526175] dark:text-slate-400">
              Configured backend service for speech evaluation models and database persistence.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveEndpoint} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clinician-endpoint-url" className="text-xs font-bold text-[#10213A] dark:text-[#F1F5F9]">
              API Endpoint URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="clinician-endpoint-url"
                type="url"
                value={endpointInput}
                onChange={e => setEndpointInput(e.target.value)}
                placeholder="https://api.neurospeech-rehab.internal/v2"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono text-[#10213A] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Save URL
                </button>
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={connection.status === 'testing'}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                >
                  {connection.status === 'testing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-[#0F9F94]" />
                  )}
                  <span>Test Ping</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${connection.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {connection.status === 'connected' ? 'Connected to local/internal API' : 'Service currently simulated/offline'}
              </span>
              {connection.lastPingMs && (
                <span className="text-slate-400 font-mono">({connection.lastPingMs}ms)</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-red-600 underline"
            >
              Reset to internal default
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};
