import { AudioLines, Sparkles, UserCheck, Stethoscope, FlaskConical, ArrowRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'

export default function Login() {
  const [email, setEmail] = useState('patient@example.com')
  const [password, setPassword] = useState('secret123')
  const [error, setError] = useState('')
  const [backendOffline, setBackendOffline] = useState(false)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const { login, loginAsDemo } = useAuth()
  const navigate = useNavigate()

  const handleDemoAccess = (role: UserRole) => {
    loginAsDemo(role)
    if (role === 'PATIENT') {
      navigate('/patient/session', { replace: true })
    } else if (role === 'CLINICIAN') {
      navigate('/clinician', { replace: true })
    } else {
      navigate('/research', { replace: true })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    setBackendOffline(false)
    try {
      const user = await login(email, password)
      navigate(user.role === 'PATIENT' ? '/patient/session' : user.role === 'CLINICIAN' ? '/clinician' : '/research', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      // Check if it was a connection or server error
      if (msg.includes('Failed to fetch') || msg.includes('404') || msg.includes('NetworkError') || msg.includes('Network request failed')) {
        setBackendOffline(true)
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-intro">
          <div className="brand">
            <span className="brand-mark"><AudioLines aria-hidden="true" /></span>
            <span>NeuroSpeech<span className="brand-subtitle">REHAB</span></span>
          </div>
          <div>
            <h2>AI Multimodal Speech Rehabilitation</h2>
            <p>Real-time visual articulation tracking, acoustic biofeedback, and neuromuscular motor speech support.</p>
          </div>
          
          <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-sky-200">
              <Sparkles size={14} />
              <span>Instant Clinical & Research Demo</span>
            </div>
            <p className="text-white/80 leading-relaxed">
              Explore the complete 60 FPS face mesh mirror, 3D articulatory avatar, biofeedback game, and AI diagnostics without entering passwords.
            </p>
          </div>

          <p className="login-note">PC Web Workstation · Audio & Visual Kinematics Research Prototype</p>
        </section>

        <section className="login-form">
          <div className="border-b border-slate-200 pb-5 mb-5">
            <h1 className="text-2xl font-bold text-slate-900">Explore NeuroSpeech</h1>
            <p className="mt-1 text-sm text-slate-500">Choose a workstation portal or sign in with your account credentials.</p>

            {/* 1-Click Instant Demo Launchers */}
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => handleDemoAccess('PATIENT')}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-xl bg-white/20"><UserCheck size={18} /></span>
                  <div className="text-left">
                    <span className="block font-bold">1-Click Patient Rehabilitation Session</span>
                    <span className="block text-[11px] text-white/80 font-normal">Launch live camera tracking, audio analyzer, and biofeedback</span>
                  </div>
                </div>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoAccess('CLINICIAN')}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200/80 transition-all flex items-center justify-center gap-1.5"
                >
                  <Stethoscope size={14} className="text-sky-600" />
                  <span>Clinician Portal</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoAccess('RESEARCHER')}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200/80 transition-all flex items-center justify-center gap-1.5"
                >
                  <FlaskConical size={14} className="text-indigo-600" />
                  <span>Research Station</span>
                </button>
              </div>
            </div>
          </div>

          {/* Account Login Form */}
          <form onSubmit={handleSubmit} aria-busy={pending} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Backend Sign In</h2>
              <span className="text-[11px] text-slate-400">Optional for local server</span>
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 space-y-2 border border-red-200">
                <p className="font-semibold">{error}</p>
                {backendOffline && (
                  <button
                    type="button"
                    onClick={() => handleDemoAccess('PATIENT')}
                    className="w-full py-1.5 px-3 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors"
                  >
                    Backend offline — Enter in Demo Mode Instead →
                  </button>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">Account Email</label>
              <input
                id="email"
                name="email"
                autoComplete="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 p-3 text-sm font-bold text-white disabled:opacity-60 transition-colors shadow-sm"
            >
              {pending ? 'Connecting to Workstation…' : 'Sign In with Live Backend'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
