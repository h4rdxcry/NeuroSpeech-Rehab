import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Type, Contrast, Feather, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { applyPreferences, readPreferences, type Preferences } from '../../lib/preferences'
import type { Patient } from '../../lib/types'

export default function PatientSettings() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [saveMessage, setSaveMessage] = useState('')
  const { user } = useAuth()
  const profile = useQuery({ queryKey: ['patient-profile'], queryFn: () => api.get<Patient>('/api/v1/participants/me') })
  const update = (key: keyof Preferences, checked: boolean) => {
    const next = { ...preferences, [key]: checked }
    setPreferences(next); applyPreferences(next)
    try { localStorage.setItem('neurospeech-preferences', JSON.stringify(next)); setSaveMessage('Preferences saved on this device.') }
    catch { setSaveMessage('Preferences applied for now. This browser could not save them.') }
  }
  return <div className="page-stack">
    <div className="page-heading"><span className="eyebrow">MAKE YOURSELF COMFORTABLE</span><h1>Settings & accessibility</h1><p>A reading experience that works for you.</p></div>
    <section className="surface settings-panel" aria-labelledby="reading-title"><h2 id="reading-title">Reading & motion</h2>
      {([
        { key: 'largeText', name: 'Larger text', text: 'Increase text size throughout your workspace.', icon: Type },
        { key: 'highContrast', name: 'Higher contrast', text: 'Stronger text and outlines with solid backgrounds.', icon: Contrast },
        { key: 'reduceMotion', name: 'Reduce motion', text: 'Turn off decorative movement. Your system preference is also respected.', icon: Feather },
      ] as const).map(({ key, name, text, icon: Icon }) => <label className="preference-row" key={key}><span className="icon-tile"><Icon aria-hidden="true" /></span><span className="preference-copy"><strong>{name}</strong><span>{text}</span></span><input type="checkbox" role="switch" checked={preferences[key]} onChange={event => update(key, event.target.checked)} aria-label={name} /></label>)}
      <p role="status" className="muted">{saveMessage || 'These preferences stay on this device.'}</p>
    </section>
    <section className="surface"><div className="section-title"><UserRound aria-hidden="true" /><h2>Your account</h2></div><dl className="metadata"><div><dt>Email</dt><dd>{user?.email}</dd></div><div><dt>Enrollment</dt><dd>{profile.isLoading ? 'Loading enrollment…' : profile.error ? 'Enrollment could not be loaded.' : profile.data?.notes?.startsWith('LOCAL PRACTICE:') ? 'Local practice profile (not a study)' : profile.data?.participant_id ? 'Linked to an enrolled participant' : 'Your clinician needs to link your enrollment.'}</dd></div>{profile.data?.id && <div><dt>Patient ID</dt><dd>{profile.data.id}</dd></div>}</dl></section>
  </div>
}
