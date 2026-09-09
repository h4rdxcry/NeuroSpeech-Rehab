import PageControls from '../PageControls'
import { usePagedRecords } from '../../lib/usePagedRecords'
import { Tag } from 'lucide-react'
import type { Annotation } from '../../lib/types'

export default function ResearchAnnotations() {
  const { data: annotations, isLoading, error, page, setPage } = usePagedRecords<Annotation>('annotations', '/api/v1/annotations/annotations')

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">RESEARCH WORKSPACE</span>
        <h1>Annotations</h1>
        <p>Review annotation labels and recorded ground truth.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load annotations.
        </p>
      )}

      <section className="surface" aria-labelledby="annotations-title">
        <div className="section-title">
          <Tag size={18} aria-hidden="true" />
          <h2 id="annotations-title">Annotation records</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading annotations…</p>
        ) : !error && (
          !annotations?.length ? (
            <p className="empty-state">No annotations found on this page.</p>
          ) : (
            <div className="data-table">
              {annotations.map((annotation) => (
                <div key={annotation.id} className="data-table-row">
                  <div>
                    <p style={{ fontWeight: 600, color: '#0b1c30', margin: 0, fontSize: '0.95rem' }}>{annotation.label}</p>
                    <p className="muted" style={{ marginTop: 2, textTransform: 'capitalize' }}>{annotation.annotation_type}</p>
                    {annotation.notes && <p className="muted" style={{ marginTop: 4 }}>{annotation.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {annotation.is_ground_truth && (
                      <span className="status-badge" style={{ background: 'rgba(0,118,80,0.1)', color: '#007650' }}>
                        Ground Truth
                      </span>
                    )}
                    {annotation.confidence != null && (
                      <span className="status-badge" style={{ background: '#eff4ff', color: '#4a4455' }}>
                        {Math.round(annotation.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <PageControls page={page} count={annotations?.length ?? 0} setPage={setPage} />
    </div>
  )
}
