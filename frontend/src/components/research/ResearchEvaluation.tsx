import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { listAll } from '../../lib/api'
import type { EvaluationRun } from '../../lib/types'

export default function ResearchEvaluation() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['evaluation-runs', 'all'],
    queryFn: () => listAll<EvaluationRun>('/api/v1/evaluation-runs/evaluation-runs'),
  })

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">RESEARCH WORKSPACE</span>
        <h1>Evaluation runs</h1>
        <p>Review evaluation runs, metrics, and ablation comparisons.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load evaluations.
        </p>
      )}

      <section className="surface" aria-labelledby="eval-title">
        <div className="section-title">
          <FlaskConical size={18} aria-hidden="true" />
          <h2 id="eval-title">Evaluation log</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading evaluations…</p>
        ) : !error && (
          !runs?.length ? (
            <p className="empty-state">No evaluation runs found. Results appear here after a run is recorded.</p>
          ) : (
            <div className="data-table">
              {runs.map((run) => (
                <div key={run.id} style={{ padding: '14px 0', borderBottom: '1px solid rgba(11,28,48,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: '#0b1c30', margin: 0, fontSize: '0.95rem' }}>{run.name}</p>
                      <p className="muted" style={{ marginTop: 3 }}>
                        {run.dataset_split} split · Dataset {run.dataset_version} · {new Date(run.started_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="status-badge"
                      style={{ background: 'rgba(0,88,189,0.1)', color: '#0058bd' }}
                    >
                      Model {run.model_version_id.slice(0, 8)}
                    </span>
                  </div>

                  {run.metrics && (
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {Object.entries(run.metrics).map(([key, value]) => (
                        <div
                          key={key}
                          style={{ background: '#eff4ff', borderRadius: '12px', padding: '10px 12px' }}
                        >
                          <p className="muted" style={{ fontSize: '0.72rem', textTransform: 'capitalize', marginBottom: 2 }}>
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p style={{ fontWeight: 700, color: '#0b1c30', fontSize: '0.92rem', margin: 0, wordBreak: 'break-word' }}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  )
}
