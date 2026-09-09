import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, CalendarDays, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react'
import { listAll } from '../../lib/api'
import type { Session, Patient } from '../../lib/types'

function statusClass(status: string) {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'in-progress'
  return 'default'
}

export default function ClinicianDashboard() {
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => listAll<Session>('/api/v1/sessions/sessions'),
  })
  const { data: patients, isLoading: patientsLoading, error: patientsError } = useQuery({
    queryKey: ['patients', 'all'],
    queryFn: () => listAll<Patient>('/api/v1/participants/patients'),
  })

  const recentSessions = [...(sessions ?? [])].sort((a, b) => b.session_date.localeCompare(a.session_date)).slice(0, 8)
  const totalPatients = patients?.length ?? 0
  const totalSessions = sessions?.length ?? 0
  const completedSessions = sessions?.filter((s) => s.status === 'completed').length ?? 0

  return (
    <div className="page-stack">
      {/* Page heading */}
      <div className="page-heading">
        <span className="eyebrow">CLINICAL PORTAL</span>
        <h1>Clinician Dashboard</h1>
        <p>Overview of patients and sessions available to your account.</p>
      </div>

      {(sessionsError || patientsError) && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Some patient or session data could not be loaded.
        </p>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <Link to="/clinician/patients" className="stat-card">
          <span className="stat-card-label"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Patients</span>
          <span className="stat-card-value">{patientsError ? '—' : patientsLoading ? '·' : totalPatients}</span>
          <span className="stat-card-sub">enrolled patients →</span>
        </Link>
        <div className="stat-card">
          <span className="stat-card-label"><CalendarDays size={13} style={{ display: 'inline', marginRight: 4 }} />Sessions</span>
          <span className="stat-card-value">{sessionsError ? '—' : sessionsLoading ? '·' : totalSessions}</span>
          <span className="stat-card-sub">total recorded</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label"><CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />Completed</span>
          <span className="stat-card-value">{sessionsError ? '—' : sessionsLoading ? '·' : completedSessions}</span>
          <span className="stat-card-sub">finished sessions</span>
        </div>
      </div>

      {/* Recent sessions */}
      <section className="surface" aria-labelledby="recent-title">
        <div className="section-title">
          <ClipboardList size={18} aria-hidden="true" />
          <h2 id="recent-title">Recent sessions</h2>
          <Link to="/clinician/sessions" className="text-button" style={{ marginTop: 0, marginLeft: 'auto', fontSize: '0.85rem' }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {sessionsError ? (
          <p className="empty-state" role="alert">Session history is unavailable.</p>
        ) : sessionsLoading ? (
          <p className="empty-state" role="status">Loading…</p>
        ) : recentSessions.length === 0 ? (
          <p className="empty-state">No sessions yet. Sessions will appear here once created.</p>
        ) : (
          <div className="data-table">
            {recentSessions.map((session) => (
              <div key={session.id} className="data-table-row">
                <div>
                  <p style={{ fontWeight: 600, color: '#0b1c30', margin: 0 }}>Session #{session.session_number}</p>
                  <p className="muted" style={{ marginTop: 2 }}>{session.session_date}</p>
                </div>
                <span className={`status-badge ${statusClass(session.status)}`}>
                  {session.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
