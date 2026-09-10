import { useQuery } from '@tanstack/react-query'
import { Users, UserCheck, UserX } from 'lucide-react'
import { listAll } from '../../lib/api'
import type { Patient } from '../../lib/types'

export default function ClinicianPatients() {
  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['patients', 'all'],
    queryFn: () => listAll<Patient>('/api/v1/participants/patients'),
  })

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">CLINICAL PORTAL</span>
        <h1>Patients</h1>
        <p>Review patients available to your account.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load patients.
        </p>
      )}

      <section className="surface" aria-labelledby="patients-title">
        <div className="section-title">
          <Users size={18} aria-hidden="true" />
          <h2 id="patients-title">Patient roster</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading patients…</p>
        ) : !error && (
          !patients?.length ? (
            <p className="empty-state">No patients found. Patients will appear here once enrolled.</p>
          ) : (
            <div className="data-table">
              {patients.map((patient) => (
                <div key={patient.id} className="data-table-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="icon-tile">
                      {patient.is_active ? <UserCheck size={16} aria-hidden="true" /> : <UserX size={16} aria-hidden="true" />}
                    </span>
                    <div>
                      <p style={{ fontWeight: 600, color: '#0b1c30', margin: 0, fontSize: '0.92rem' }}>Patient ID</p>
                      <p className="muted" style={{ marginTop: 2 }}>{patient.id}</p>
                    </div>
                  </div>
                  <span
                    className="status-badge"
                    style={patient.is_active
                      ? { background: 'rgba(0,118,80,0.1)', color: '#007650' }
                      : { background: '#eff4ff', color: '#727785' }}
                  >
                    {patient.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  )
}
