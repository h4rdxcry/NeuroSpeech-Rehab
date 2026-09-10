import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { UserRole } from '../../types';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, Check } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>('patient');
  const [email, setEmail] = useState('patient@neurospeech.dev');
  const [password, setPassword] = useState('NeuroSpeechDemo123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleCredentials: Record<UserRole, { email: string; label: string; desc: string }> = {
    patient: {
      email: 'patient@neurospeech.dev',
      label: 'Patient Practice',
      desc: 'Guided speech practice with Tamil phrases, camera and audio analysis.'
    },
    clinician: {
      email: 'clinician@neurospeech.dev',
      label: 'Clinician Portal',
      desc: 'Review enrolled patients, practice sessions, and acoustic recordings.'
    },
    researcher: {
      email: 'researcher@neurospeech.dev',
      label: 'Research Evidence',
      desc: 'Access datasets, signal features, evaluation metrics, and model registry.'
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(roleCredentials[role].email);
    setPassword('NeuroSpeechDemo123!');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const success = await login(email, password, selectedRole);
      if (!success) {
        setError('Authentication failed. Please check your credentials or ensure the backend is running.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-10 bg-[#F4F8FC]">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white/85 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
        {/* Left Side: 45% Quiet Brand Story & Abstract Visual */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#174EA6] to-[#2563EB] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background abstract neural/acoustic wave motif */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
            <svg className="w-full h-full" viewBox="0 0 400 400" fill="none">
              <circle cx="200" cy="200" r="160" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
              <circle cx="200" cy="200" r="110" stroke="white" strokeWidth="2" />
              <circle cx="200" cy="200" r="60" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M40 200 C 120 120, 280 280, 360 200" stroke="white" strokeWidth="3" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold backdrop-blur-xs mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Research Software Prototype • 2026</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
              Evidence-Based Speech Rehabilitation Practice
            </h1>
            
            <p className="mt-4 text-blue-100/90 text-sm leading-relaxed">
              NeuroSpeech Rehab provides multimodal audio processing and facial articulatory guidance tailored for structured Tamil speech rehabilitation.
            </p>
          </div>

          <div className="relative z-10 mt-8 pt-8 border-t border-white/20 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>Transparent data provenance and scientific traceability</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>Dedicated cognitive-accessible patient practice interface</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-100">
              <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>Objective recording logs without speculative clinical scores</span>
            </div>
          </div>
        </div>

        {/* Right Side: 55% Authentication Card */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-white/90">
          <div className="max-w-md w-full mx-auto">
            <BrandLogo size="md" className="mb-6" />

            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-[#10213A] tracking-tight">
                Welcome to NeuroSpeech
              </h2>
              <p className="text-sm text-[#526175] mt-1">
                Select your workspace role to proceed into the system.
              </p>
            </div>

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-2xl mb-6">
              {(['patient', 'clinician', 'researcher'] as UserRole[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSelect(r)}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl capitalize transition-all ${
                    selectedRole === r
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-[#EAF2FF]/60 border border-[#2563EB]/20 mb-6 text-xs text-[#174EA6]">
              <span className="font-semibold block mb-0.5">{roleCredentials[selectedRole].label}</span>
              <p className="text-slate-600">{roleCredentials[selectedRole].desc}</p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium mb-4 animate-in fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 absolute right-3.5 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Enter {roleCredentials[selectedRole].label}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              <span>Encrypted Session • Institutional Protocol IEC-MMC-2025-084</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
