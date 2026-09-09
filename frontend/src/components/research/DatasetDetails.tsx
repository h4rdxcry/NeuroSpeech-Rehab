import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, listAll } from '../../lib/api'
import type { DatasetProvenance, DatasetSplit } from '../../lib/types'

export default function DatasetDetails({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const provenance = useQuery({ queryKey: ['provenance', id], enabled: open, queryFn: async () => {
    try { return await api.get<DatasetProvenance>(`/api/v1/datasets/datasets/${id}/provenance`) }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  } })
  const splits = useQuery({ queryKey: ['splits', id], enabled: open, queryFn: () => listAll<DatasetSplit>(`/api/v1/datasets/datasets/${id}/splits`) })
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>View provenance and splits</summary>
    {provenance.isLoading || splits.isLoading ? <p role="status">Loading dataset details…</p> : <>
      {provenance.error ? <p role="alert">Provenance could not be loaded.</p> : !provenance.data ? <p>No provenance record is available.</p> : <dl className="metadata"><div><dt>Original source</dt><dd>{provenance.data.original_source}</dd></div><div><dt>License / access</dt><dd>{provenance.data.license_access_info || 'Not recorded'}</dd></div><div><dt>Checksum</dt><dd>{provenance.data.checksum || 'Not recorded'}</dd></div><div><dt>Transformations</dt><dd>{provenance.data.transformations_performed || 'Not recorded'}</dd></div></dl>}
      {splits.error ? <p role="alert">Splits could not be loaded.</p> : !splits.data?.length ? <p>No participant splits are recorded.</p> : <ul className="mt-4">{Object.entries(splits.data.reduce<Record<string, number>>((counts, item) => { counts[item.split_type] = (counts[item.split_type] || 0) + 1; return counts }, {})).map(([name, count]) => <li key={name}>{name}: {count} participant split records</li>)}<li>{splits.data.filter(item => item.is_locked).length} locked split records</li></ul>}
    </>}
  </details>
}
