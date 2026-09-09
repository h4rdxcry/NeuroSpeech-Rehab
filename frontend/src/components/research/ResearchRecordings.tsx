import PageControls from '../PageControls'
import { usePagedRecords } from '../../lib/usePagedRecords'
import RecordingResults from './RecordingResults'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { FolderOpen } from 'lucide-react'
import type { Recording } from '../../lib/types'

function ComputedFeatures({ recordingId }: { recordingId: string }) {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['recording-features', recordingId],
    queryFn: () => api.get<{ id: string; source_sha256: string; result: Record<string, unknown> }[]>(
      `/api/v1/research-signals/recordings/${recordingId}/features`
    ),
    enabled: expanded,
  })
  const panelId = `features-${recordingId}`
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(!expanded)}
        className="text-button"
        style={{ fontSize: '0.82rem', marginTop: 0 }}
      >
        {expanded ? 'Hide computed features' : 'View computed features'}
      </button>
      {expanded && (
        <div id={panelId} style={{ marginTop: 10, background: '#eff4ff', borderRadius: '12px', padding: '12px', fontSize: '0.82rem' }}>
          {isLoading ? (
            <p className="empty-state" role="status">Loading…</p>
          ) : error ? (
            <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>Features could not be loaded.</p>
          ) : !data?.length ? (
            <p className="empty-state">No computed features stored.</p>
          ) : data.map((feature) => (
            <div key={feature.id}>
              <p className="muted" style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>SHA-256: {feature.source_sha256}</p>
              <pre style={{ marginTop: 6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}>
                {JSON.stringify(feature.result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResearchRecordings() {
  const { data: recordings, isLoading, error, page, setPage } = usePagedRecords<Recording>('recordings', '/api/v1/recordings/recordings')

  return (
    <div className="page-stack">
      <div className="page-heading">
        <span className="eyebrow">RESEARCH WORKSPACE</span>
        <h1>Recordings &amp; signals</h1>
        <p>Saved recordings, computed features, quality and predictions. Feature values are not clinical assessments.</p>
      </div>

      {error && (
        <p className="notice" role="alert" style={{ borderColor: 'rgba(185,28,28,0.2)', color: '#b91c1c', background: '#fff1f1' }}>
          Failed to load recordings.
        </p>
      )}

      <section className="surface" aria-labelledby="recordings-title">
        <div className="section-title">
          <FolderOpen size={18} aria-hidden="true" />
          <h2 id="recordings-title">Recording archive</h2>
        </div>

        {isLoading ? (
          <p className="empty-state" role="status">Loading recordings…</p>
        ) : !error && (
          !recordings?.length ? (
            <p className="empty-state">No recordings found on this page.</p>
          ) : (
            <div className="data-table">
              {recordings.map((recording) => (
                <div key={recording.id} style={{ padding: '14px 0', borderBottom: '1px solid rgba(11,28,48,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: '#0b1c30', margin: 0, fontSize: '0.95rem' }}>
                        {recording.device_name || recording.device_id}
                      </p>
                      <p className="muted" style={{ marginTop: 3 }}>{recording.modality} · {recording.file_format}</p>
                    </div>
                    <span
                      className="status-badge"
                      style={recording.data_classification === 'REAL'
                        ? { background: 'rgba(0,118,80,0.1)', color: '#007650' }
                        : { background: 'rgba(202,138,4,0.1)', color: '#b45309' }}
                    >
                      {recording.data_classification ?? (recording.is_synthetic ? 'SYNTHETIC' : 'UNCLASSIFIED')}
                    </span>
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                    {recording.sampling_rate_hz && <span className="muted">{recording.sampling_rate_hz} Hz</span>}
                    {recording.channel_count && <span className="muted">{recording.channel_count} channels</span>}
                    {recording.duration_seconds && <span className="muted">{Math.round(recording.duration_seconds)}s</span>}
                    <span className="muted" style={{ textTransform: 'capitalize' }}>{recording.processing_status}</span>
                  </div>

                  <RecordingResults recording={recording} />
                  <ComputedFeatures recordingId={recording.id} />
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <PageControls page={page} count={recordings?.length ?? 0} setPage={setPage} />
    </div>
  )
}
