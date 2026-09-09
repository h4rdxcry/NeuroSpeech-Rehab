import { useQuery } from '@tanstack/react-query'
import { listAll } from '../../lib/api'
import type { ResearchParticipant } from '../../lib/types'

export default function ResearchParticipants() {
  const query = useQuery({ queryKey: ['research-participants'], queryFn: () => listAll<ResearchParticipant>('/api/v1/participants/research-participants') })
  return <div className="page-stack"><div className="page-heading"><span className="eyebrow">RESEARCH WORKSPACE</span><h1>Participants</h1><p>Enrolled participant records available to your account.</p></div><section className="surface">{query.isLoading ? <p role="status">Loading participants…</p> : query.error ? <p role="alert">Participants could not be loaded.</p> : !query.data?.length ? <p className="empty-state">No participants are available.</p> : <ul className="divide-y divide-slate-100">{query.data.map(participant => <li key={participant.id} className="py-4"><h2>{participant.pseudonym_id}</h2><p className="muted mb-0">Consent: {participant.consent_status}</p><details><summary>View participant metadata</summary><pre>{JSON.stringify({ id: participant.id, demographics: participant.demographic_summary, inclusion: participant.inclusion_criteria, exclusion: participant.exclusion_criteria }, null, 2)}</pre></details></li>)}</ul>}</section></div>
}
