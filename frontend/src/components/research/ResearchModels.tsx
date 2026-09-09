import { useQuery } from '@tanstack/react-query'
import { listAll } from '../../lib/api'
import type { ModelVersion } from '../../lib/types'

export default function ResearchModels() {
  const query = useQuery({ queryKey: ['models'], queryFn: () => listAll<ModelVersion>('/api/v1/model-versions/model-versions') })
  return <div className="page-stack"><div className="page-heading"><span className="eyebrow">RESEARCH LIBRARY</span><h1>Model versions</h1><p>Registered models and their recorded provenance.</p></div><section className="surface">
    {query.isLoading ? <p role="status">Loading models…</p> : query.error ? <p role="alert">Models could not be loaded.</p> : !query.data?.length ? <p className="empty-state">No model versions have been registered.</p> : query.data.map(model => <article key={model.id} className="py-4"><h2>{model.model_name} · {model.version}</h2><dl className="metadata"><div><dt>Model ID</dt><dd>{model.id}</dd></div><div><dt>Training dataset</dt><dd>{model.training_dataset_version}</dd></div><div><dt>Feature pipeline</dt><dd>{model.feature_pipeline_version}</dd></div><div><dt>Registered</dt><dd>{new Date(model.registered_at).toLocaleString()}</dd></div></dl><details><summary>View registered metadata</summary><pre>{JSON.stringify({ architecture: model.architecture_json, training: model.training_params, metrics: model.performance_metrics }, null, 2)}</pre><p className="muted">Registered metrics require their original evaluation protocol for interpretation.</p></details></article>)}
  </section></div>
}
