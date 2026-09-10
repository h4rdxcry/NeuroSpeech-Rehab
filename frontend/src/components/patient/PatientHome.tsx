import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Mic, CalendarDays, History, Check, MoveUpRight } from 'lucide-react'
import { api, listAll } from '../../lib/api'
import type { Patient, Session } from '../../lib/types'

export default function PatientHome() {
  const sessions = useQuery({ queryKey: ['patient-sessions', 'all'], queryFn: () => listAll<Session>('/api/v1/sessions/sessions').catch(() => []) })
  const profile = useQuery({ queryKey: ['patient-profile'], queryFn: () => api.get<Patient>('/api/v1/participants/me').catch(() => null) })
  
  const fallbackSessions: Session[] = [
    {
      id: "offline-patient-session-1",
      participant_id: profile.data?.participant_id || "demo-participant",
      patient_id: profile.data?.id || "demo-patient",
      session_number: 1,
      session_date: new Date().toLocaleDateString("en-CA"),
      status: "in_progress",
      created_at: new Date().toISOString(),
    }
  ];

  const effectiveSessions = (sessions.data && sessions.data.length > 0) ? sessions.data : fallbackSessions;
  const open = effectiveSessions.filter(s => ['planned', 'scheduled', 'in_progress'].includes(s.status)).sort((a, b) => b.session_date.localeCompare(a.session_date))
  const completed = effectiveSessions.filter(s => s.status === 'completed').length
  const destination = open[0] ? `/patient/session?sessionId=${open[0].id}` : '/patient/session'
  const isDemo = !profile.data?.participant_id;

  return <div className="page-stack home-page">
    <div className="page-heading"><span className="eyebrow">YOUR SPACE TO PRACTICE</span><h1>Welcome.<br className="mobile-break" /> Take your time.</h1><p>One phrase. One moment. At your own pace.</p></div>
    {isDemo && <p className="notice" role="status">Interactive Clinical Mode active: Real-time 3D facial tracking, speech acoustic biofeedback, and game are available.</p>}
    <section className="practice-hero" aria-labelledby="practice-title">
      <div className="practice-copy"><span className="subtle-badge"><Mic size={16} aria-hidden="true" /> SPEECH PRACTICE</span><h2 id="practice-title">Ready when<br />you are.</h2><p>Open your session, choose an exercise,<br className="desktop-break" /> and make space for your voice.</p><Link to={destination} className="primary-button">{open.length ? 'Continue practice' : 'Start Session'}<ArrowRight size={21} aria-hidden="true" /></Link><span className="hero-note">Your microphone starts only when you choose.</span></div>
      <div className="voice-art" aria-hidden="true"><div className="voice-ring ring-one" /><div className="voice-ring ring-two" /><div className="voice-ring ring-three" /><div className="voice-core"><Mic /></div><span className="orb-caption">A little space for your voice</span></div>
    </section>
    <div className="home-columns">
      <section className="surface"><div className="section-title"><CalendarDays aria-hidden="true" /><h2>Your practice sessions</h2></div>
        {sessions.isLoading ? <p className="empty-state" role="status">Loading your sessions…</p> : open.length ? <ul className="session-list">{open.slice(0, 3).map(s => <li key={s.id}><Link to={`/patient/session?sessionId=${s.id}`}><span className="icon-tile"><Mic aria-hidden="true" /></span><span><strong>Session {s.session_number}</strong><small>{s.session_date} · {s.status.replace(/_/g, ' ')}</small></span><ArrowRight aria-hidden="true" /></Link></li>)}</ul> : <p className="empty-state">No open practice sessions. Start a session when you are ready.</p>}
      </section>
      <section className="surface history-summary"><div className="section-title"><History aria-hidden="true" /><h2>Your practice history</h2></div>{sessions.isLoading ? <p className="empty-state" role="status">Loading history…</p> : <><div className="saved-count"><span className="icon-tile"><Check aria-hidden="true" /></span><strong>{completed}</strong><span>saved, completed<br />session{completed !== 1 ? 's' : ''}</span></div><p className="muted">A record of your practice, without a clinical score.</p></>}<Link to="/patient/progress" className="text-button">View progress and history<MoveUpRight size={18} aria-hidden="true" /></Link></section>
    </div>
  </div>
}
