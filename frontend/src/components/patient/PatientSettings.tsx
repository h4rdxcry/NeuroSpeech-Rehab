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

    {/* Research Server & Live Backend Connection */}
    <ServerConnectionCard />
  </div>
}

function ServerConnectionCard() {
  const [currentUrl, setCurrentUrl] = useState(() => {
    try {
      return localStorage.getItem('neurospeech_api_url') || '';
    } catch {
      return '';
    }
  });
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    const trimmed = inputUrl.trim().replace(/\/$/, '');
    if (trimmed) {
      localStorage.setItem('neurospeech_api_url', trimmed);
      setCurrentUrl(trimmed);
      setStatusMessage(`Connected to: ${trimmed}`);
    } else {
      localStorage.removeItem('neurospeech_api_url');
      setCurrentUrl('');
      setStatusMessage('Reset to default backend.');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    const target = (inputUrl.trim() || currentUrl).replace(/\/$/, '');
    try {
      await fetch(`${target}/docs`, { method: 'HEAD', mode: 'no-cors' });
      setStatusMessage('✓ Server reachable! Backend is live and accepting connections.');
    } catch {
      setStatusMessage('✗ Unable to reach server at this address. Check if your backend and tunnel are running.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('neurospeech_api_url');
    setCurrentUrl('');
    setInputUrl('');
    setStatusMessage('Reset to default auto-detected backend.');
  };

  return (
    <section className="surface" aria-labelledby="server-title">
      <div className="section-title">
        <h2 id="server-title">Research Server & Live Backend Connection</h2>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Connect this web app to your local PC backend (via Cloudflare Tunnel or local IP). Any changes you make in Python on your PC immediately reflect live for anyone accessing this URL.
      </p>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-on-surface">
          Active Backend Endpoint:
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="e.g. https://your-tunnel.trycloudflare.com or http://localhost:8000"
            className="mt-1.5 w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:brightness-110 shadow-sm"
          >
            Save Endpoint
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-1.5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest border border-outline-variant"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Reset to Default
          </button>
        </div>

        {statusMessage && (
          <p className={`text-xs font-medium mt-1 ${statusMessage.startsWith('✓') ? 'text-emerald-600' : statusMessage.startsWith('✗') ? 'text-red-500' : 'text-primary'}`}>
            {statusMessage}
          </p>
        )}

        <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] text-on-surface-variant">
          <span className="font-bold text-on-surface">💡 Pro Tip for Sharing:</span>
          <p className="mt-0.5">
            You can share your Vercel link with the parameter <code className="px-1 py-0.5 rounded bg-surface-container font-mono text-[10px]">?apiUrl=https://your-tunnel.trycloudflare.com</code>. Anyone opening that link will automatically connect to your PC's live backend!
          </p>
        </div>
      </div>
    </section>
  );
}
