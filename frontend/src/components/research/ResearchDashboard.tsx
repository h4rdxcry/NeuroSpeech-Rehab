import { Link } from 'react-router-dom'
import { ArrowUpRight, Database, FolderOpen, Users, ClipboardList, Layers, FlaskConical } from 'lucide-react'
const sections = [
  { path: 'datasets', title: 'Datasets & provenance', text: 'Sources, registered splits and access details.', icon: Database },
  { path: 'recordings', title: 'Recordings & signals', text: 'Saved recordings, computed features, quality and predictions.', icon: FolderOpen },
  { path: 'participants', title: 'Participants', text: 'Pseudonymous enrollment and consent records.', icon: Users },
  { path: 'sessions', title: 'Sessions', text: 'Recorded session activity and status.', icon: ClipboardList },
  { path: 'evaluation', title: 'Evaluation runs', text: 'Recorded evaluation protocols and measured outputs.', icon: FlaskConical },
  { path: 'models', title: 'Model versions', text: 'Registered checkpoints and training metadata.', icon: Layers },
]
export default function ResearchDashboard() {
  return <div className="page-stack"><div className="page-heading"><span className="eyebrow">RESEARCH WORKSPACE</span><h1>Explore the evidence.</h1><p>Follow each result back to its source.</p></div><section className="surface"><ul className="session-list">{sections.map(({ path, title, text, icon: Icon }) => <li key={path}><Link to={'/research/' + path}><span className="icon-tile"><Icon aria-hidden="true" /></span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight aria-hidden="true" /></Link></li>)}</ul></section><p className="muted">Model outputs and signal features are research records. They do not establish clinical improvement.</p></div>
}
