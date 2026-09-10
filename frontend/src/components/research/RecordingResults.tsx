import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, listAll } from '../../lib/api'
import type { Prediction, Recording, SignalQuality } from '../../lib/types'

export default function RecordingResults({ recording }: { recording: Recording }) {
  const [open, setOpen] = useState(false)
  const quality = useQuery({ queryKey: ['recording-quality', recording.id], enabled: open, queryFn: async () => {
    try { return await api.get<SignalQuality>(`/api/v1/signal-quality/signal-quality/${recording.id}`) }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  } })
  const predictions = useQuery({ queryKey: ['recording-predictions', recording.attempt_id], enabled: open && Boolean(recording.attempt_id), queryFn: () => listAll<Prediction>(`/api/v1/predictions/predictions?attempt_id=${recording.attempt_id}`) })
  const results = predictions.data?.filter(item => item.recording_id === recording.id)
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>View signal quality and predictions</summary><p className="muted">Recorded: {new Date(recording.start_timestamp).toLocaleString()}</p>
    {quality.isLoading ? <p role="status">Loading signal quality…</p> : quality.error ? <p role="alert">Signal quality could not be loaded.</p> : quality.data ? <><p>Signal quality: {quality.data.quality_state}</p><pre>{JSON.stringify(quality.data, null, 2)}</pre></> : <p>No signal quality data is available.</p>}
    {predictions.isLoading && recording.attempt_id ? <p role="status">Loading predictions…</p> : predictions.error ? <p role="alert">Predictions could not be loaded.</p> : results?.length ? results.map(item => <article key={item.id}><h3>{item.prediction_type}</h3><p>{item.predicted_label || 'Empty transcript'}</p><p className="muted">Model {item.model_version} · Pipeline {item.feature_pipeline_version} · Dataset {item.training_dataset_version}</p></article>) : <p>No saved predictions for this recording.</p>}
  </details>
}
