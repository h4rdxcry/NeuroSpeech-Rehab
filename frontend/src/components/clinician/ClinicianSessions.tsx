import { CalendarDays } from 'lucide-react'
import PageControls from '../PageControls'
import { usePagedRecords } from '../../lib/usePagedRecords'
import type { Session } from '../../lib/types'

function statusClass(status: string) {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'in-progress'
  return 'default'
}

export default function ClinicianSessions() {
  const { data: sessions, isLoading, error, page, setPage } = usePagedRecords<Session>('sessions', '/api/v1/sessions/sessions')

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">CLINICAL PORTAL</span>
        <h1>Sessions</h1>
        <p>Review session history and status.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load sessions.
        </p>
      )}

      <section className="surface" aria-labelledby="sessions-title">
        <div className="section-title">
          <CalendarDays size={18} aria-hidden="true" />
          <h2 id="sessions-title">Session records</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading sessions…</p>
        ) : !error && (
          !sessions?.length ? (
            <p className="empty-state">No sessions found on this page.</p>
          ) : (
            <div className="data-table">
              {sessions.map((session) => (
                <div key={session.id} className="data-table-row">
                  <div>
                    <p style={{ fontWeight: 600, color: '#0b1c30', margin: 0, fontSize: '0.95rem' }}>
                      Session #{session.session_number}
                    </p>
                    <p className="muted" style={{ marginTop: 2 }}>{session.session_date}</p>
                    {session.notes && <p className="muted" style={{ marginTop: 4 }}>{session.notes}</p>}
                  </div>
                  <span className={`status-badge ${statusClass(session.status)}`}>
                    {session.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <PageControls page={page} count={sessions?.length ?? 0} setPage={setPage} />
    </div>
  )
}
