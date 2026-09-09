import DatasetDetails from './DatasetDetails'
import { useQuery } from '@tanstack/react-query'
import { Database } from 'lucide-react'
import { listAll } from '../../lib/api'
import type { Dataset } from '../../lib/types'

function DataBadge({ label, color }: { label: string; color: 'green' | 'amber' | 'blue' | 'slate' | 'red' | 'orange' }) {
  const styles: Record<typeof color, React.CSSProperties> = {
    green: { background: 'rgba(0,118,80,0.1)', color: '#007650' },
    amber: { background: 'rgba(202,138,4,0.1)', color: '#b45309' },
    blue: { background: 'rgba(0,88,189,0.1)', color: '#0058bd' },
    slate: { background: '#eff4ff', color: '#4a4455' },
    red: { background: 'rgba(185,28,28,0.1)', color: '#b91c1c' },
    orange: { background: 'rgba(234,88,12,0.1)', color: '#ea580c' },
  }
  return (
    <span className="status-badge" style={styles[color]}>{label}</span>
  )
}

function classificationBadge(classification?: string) {
  const c = (classification || 'UNCLASSIFIED').toUpperCase()
  if (c === 'REAL') return <DataBadge label="REAL" color="green" />
  if (c === 'SYNTHETIC') return <DataBadge label="Synthetic" color="amber" />
  if (c === 'DEMO') return <DataBadge label="Demo" color="slate" />
  return <DataBadge label={c} color="slate" />
}

function qcBadge(status?: string) {
  if (!status) return null
  const s = status.toUpperCase()
  if (s === 'PASS') return <DataBadge label="QC Pass" color="green" />
  if (s === 'WARNING') return <DataBadge label="QC Warning" color="amber" />
  if (s === 'FAIL') return <DataBadge label="QC Fail" color="red" />
  return <DataBadge label={`QC ${status}`} color="slate" />
}

export default function ResearchDatasets() {
  const { data: datasets, isLoading, error } = useQuery({
    queryKey: ['datasets', 'all'],
    queryFn: () => listAll<Dataset>('/api/v1/datasets/datasets'),
  })

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">RESEARCH WORKSPACE</span>
        <h1>Datasets &amp; provenance</h1>
        <p>View research datasets, provenance, and splits.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load datasets.
        </p>
      )}

      <section className="surface" aria-labelledby="datasets-title">
        <div className="section-title">
          <Database size={18} aria-hidden="true" />
          <h2 id="datasets-title">Dataset registry</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading datasets…</p>
        ) : !error && (
          !datasets?.length ? (
            <p className="empty-state">No datasets imported. Datasets appear here once registered.</p>
          ) : (
            <div className="data-table">
              {datasets.map((dataset) => (
                <div key={dataset.id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(11,28,48,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: '#0b1c30', margin: 0, fontSize: '0.95rem' }}>{dataset.name}</p>
                      <p className="muted" style={{ marginTop: 4 }}>
                        v{dataset.version} · {dataset.modality ?? 'Unknown modality'} · {dataset.participant_count ? `${dataset.participant_count} participants` : 'n/a'} · {dataset.recording_count ?? 'N/A'} recordings
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {classificationBadge(dataset.data_classification)}
                      {qcBadge(dataset.qc_status)}
                      {dataset.is_locked && <DataBadge label="Locked" color="red" />}
                      {dataset.is_final_test && <DataBadge label="Final Test" color="amber" />}
                      {dataset.is_restricted && <DataBadge label="Restricted" color="orange" />}
                      {dataset.imported_status === 'imported' && <DataBadge label="Imported" color="green" />}
                      {dataset.imported_status === 'metadata_only' && <DataBadge label="Metadata Only" color="slate" />}
                      {dataset.imported_status === 'registered' && <DataBadge label="Registered" color="blue" />}
                    </div>
                  </div>

                  {dataset.description && <p className="muted" style={{ marginTop: 8 }}>{dataset.description}</p>}

                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    {dataset.source_organization && <span className="muted">Source: {dataset.source_organization}</span>}
                    {dataset.license && <span className="muted">License: {dataset.license}</span>}
                    {dataset.access_type && <span className="muted">Access: {dataset.access_type}</span>}
                    {typeof dataset.total_duration === 'number' && dataset.total_duration > 0 && (
                      <span className="muted">Duration: {dataset.total_duration.toFixed(1)}s</span>
                    )}
                  </div>

                  {Object.keys(dataset.split_definition ?? {}).length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.82rem' }}>View split definition</summary>
                      <pre style={{ marginTop: 8, fontSize: '0.75rem', background: '#eff4ff', borderRadius: '12px', padding: '12px', overflowX: 'auto' }}>
                        {JSON.stringify(dataset.split_definition, null, 2)}
                      </pre>
                    </details>
                  )}

                  <DatasetDetails id={dataset.id} />
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  )
}
