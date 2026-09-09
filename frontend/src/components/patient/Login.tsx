import { AudioLines } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      const user = await login(email, password)
      navigate(user.role === 'PATIENT' ? '/patient' : user.role === 'CLINICIAN' ? '/clinician' : '/research', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <main className="login-page"><div className="login-shell"><section className="login-intro"><div className="brand"><span className="brand-mark"><AudioLines aria-hidden="true" /></span><span>NeuroSpeech<span className="brand-subtitle">REHAB</span></span></div><div><h2>A little practice.<br />A voice that is yours.</h2><p>Your space for guided speech practice, at your own pace.</p></div><p className="login-note">Research prototype · No clinical assessment</p></section>
      <form onSubmit={handleSubmit} aria-busy={pending} className="login-form">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-slate-500">Use your assigned account email and password.</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              name="email"
              autoComplete="username"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              name="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              required
            />
          </div>
          <button type="submit" disabled={pending} className="w-full rounded-xl bg-sky-600 p-3 text-lg font-semibold text-white disabled:opacity-60">
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div></main>
  )
}
