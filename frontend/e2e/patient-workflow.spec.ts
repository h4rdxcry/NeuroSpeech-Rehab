import { test, expect, chromium, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
type Account = { email: string; kind: string }
type Fixture = { password: string; patients: Account[]; clinician: Account; researcher: Account; exercise_id: string; target_phrase: string }
const fixture = JSON.parse(readFileSync(new URL('./browser-fixture.json', import.meta.url), 'utf8')) as Fixture
const out = resolve('../work/verification-20260909')
const sizes = [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 1000 }]
async function login(page: Page, account: Account) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(fixture.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).not.toHaveURL(/login/)
}
async function get(page: Page, path: string) {
  return page.evaluate(async path => {
    const r = await fetch('http://127.0.0.1:8001' + path, { headers: { Authorization: 'Bearer ' + localStorage.getItem('access_token') } })
    if (!r.ok) throw new Error(r.status + ': ' + path)
    return r.json()
  }, path)
}
async function layout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  for (const control of await page.locator('main button:visible, main select:visible, nav a:visible').all()) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44)
}
async function accessible(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
  writeFileSync(resolve(out, 'axe-' + name + '.json'), JSON.stringify({ url: page.url(), violations: r.violations, passes: r.passes.map(i => i.id), incomplete: r.incomplete.map(i => i.id) }, null, 2))
  expect(r.violations).toEqual([])
}
async function createSession(page: Page) {
  await page.getByRole('link', { name: 'Therapy', exact: true }).click()
  await page.getByRole('button', { name: 'Create session', exact: true }).click()
  await expect(page).toHaveURL(/sessionId=/)
  const id = new URL(page.url()).searchParams.get('sessionId')!
  await page.getByLabel('Choose an exercise').selectOption(fixture.exercise_id)
  await page.getByRole('button', { name: 'Add exercise to session' }).click()
  await expect(page.locator('blockquote')).toHaveText(fixture.target_phrase)
  return id
}
for (const size of sizes) test(size.name + ': real patient session, PCM stream, persistence and history', async ({ page }) => {
  await page.setViewportSize(size)
  const errors: string[] = [], controls: Record<string, unknown>[] = [], incoming: Record<string, unknown>[] = [], frames: Buffer[] = []
  let socketPath = ''
  page.on('pageerror', e => errors.push(e.message))
  page.on('websocket', socket => {
    const url = new URL(socket.url()); expect(url.searchParams.get('token')).toBeTruthy(); socketPath = url.pathname
    socket.on('framesent', e => { if (typeof e.payload === 'string') controls.push(JSON.parse(e.payload)); else frames.push(e.payload) })
    socket.on('framereceived', e => { if (typeof e.payload === 'string') incoming.push(JSON.parse(e.payload)) })
  })
  await login(page, fixture.patients.find(i => i.kind === size.name)!)
  await accessible(page, size.name + '-home'); await layout(page)
  if (size.name === 'mobile') {
    const nav = await page.getByRole('navigation').boundingBox()
    expect(nav!.y).toBeGreaterThan(size.height - 110)
  }
  await page.evaluate(() => { window.scrollTo(0, 0); (document.activeElement as HTMLElement)?.blur() })
  await page.screenshot({ path: resolve(out, size.name + '-home.png'), fullPage: true })
  const id = await createSession(page)
  await accessible(page, size.name + '-therapy'); await layout(page)
  await page.getByRole('button', { name: 'Enable camera and microphone' }).click()
  await expect(page.getByRole('button', { name: 'Permissions enabled' })).toBeVisible()
  await expect.poll(() => page.locator('video').evaluate(v => v.videoWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Start attempt', exact: true }).click()
  await expect(page.getByText(/Connection: streaming/)).toBeVisible()
  await expect.poll(() => frames.length).toBeGreaterThanOrEqual(5)
  await expect(page.locator('[aria-current="step"]')).toContainText('Listening')
  await page.evaluate(() => { window.scrollTo(0, 0); (document.activeElement as HTMLElement)?.blur() })
  await page.screenshot({ path: resolve(out, size.name + '-therapy.png'), fullPage: true })
  await page.getByRole('button', { name: 'Stop attempt' }).click()
  await expect(page.getByText(/Attempt saved\./)).toBeVisible({ timeout: 45000 })
  await expect(page.locator('[aria-current="step"]')).toContainText('Result')
  expect(socketPath).toBe('/ws/sessions/' + id)
  expect(controls[0]).toMatchObject({ type: 'stream_start', session_id: id, modality: 'AUDIO', sample_rate: 16000, channels: 1, sample_width_bytes: 2, encoding: 'pcm16' })
  expect(controls[controls.length - 1]).toEqual({ type: 'stream_stop' })
  expect(incoming.some(i => i.type === 'stream_started')).toBe(true)
  expect(incoming.some(i => i.type === 'stream_stopped')).toBe(true)
  expect(frames.every(f => f.length > 0 && f.length % 2 === 0)).toBe(true)
  const recordings = await get(page, '/api/v1/recordings/recordings?session_id=' + id)
  expect(recordings).toHaveLength(1)
  const recording = recordings[0]
  expect(recording.attempt_id).toBe(controls[0].attempt_id)
  expect(recording.sampling_rate_hz).toBe(16000); expect(recording.channel_count).toBe(1); expect(recording.duration_seconds).toBeGreaterThan(0)
  const quality = await get(page, '/api/v1/signal-quality/signal-quality/' + recording.id)
  const predictions = await get(page, '/api/v1/predictions/predictions?attempt_id=' + recording.attempt_id)
  expect(predictions).toEqual([])
  await expect(page.getByText('Waiting for live analysis', { exact: true })).toBeVisible()
  const attempt = await get(page, '/api/v1/attempts/attempts/' + recording.attempt_id)
  expect(attempt.ended_at).toBeTruthy()
  await page.getByRole('button', { name: 'Finish session' }).click()
  await expect(page.getByText('Session saved · completed')).toBeVisible()
  expect((await get(page, '/api/v1/sessions/sessions/' + id)).status).toBe('completed')
  await page.getByRole('link', { name: 'View progress and history', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Progress and history' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Session 1', exact: true })).toBeVisible()
  await accessible(page, size.name + '-history'); await layout(page)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Session 1', exact: true })).toBeVisible()
  expect(errors).toEqual([])
  writeFileSync(resolve(out, size.name + '-workflow.json'), JSON.stringify({ viewport: size, sessionId: id, controls, incoming, binaryFrames: frames.length, bytes: frames.reduce((n,f) => n+f.length, 0), recording, quality, predictions, attempt, errors }, null, 2))
})
test('settings persist, keyboard focus, reduced motion and 200% text reflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, fixture.patients.find(i => i.kind === 'navigation')!)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  for (const name of ['Larger text','Higher contrast','Reduce motion']) await page.getByRole('switch', { name }).check()
  await expect(page.getByRole('status')).toContainText('Preferences saved')
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Larger text' })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true')
  await accessible(page, 'settings-large-contrast'); await layout(page)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none')
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await layout(page)
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  await page.getByRole('switch', { name: 'Larger text' }).uncheck()
  await page.setViewportSize({ width: 320, height: 740 }); await layout(page)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.nav-item').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
  await layout(page)
})
test('permission denial never sends audio and explains recovery', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Automated test denial', 'NotAllowedError') } })
  await login(page, fixture.patients.find(i => i.kind === 'denied')!)
  const id = await createSession(page)
  let sockets = 0; page.on('websocket', () => sockets++)
  await page.getByRole('button', { name: 'Start attempt', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('permission is required')
  await expect(page.getByRole('button', { name: 'Start attempt', exact: true })).toBeEnabled()
  expect(sockets).toBe(0)
  expect(await get(page, '/api/v1/recordings/recordings?session_id=' + id)).toEqual([])
})
test('unenrolled patient cannot create a session or open staff pages', async ({ page }) => {
  await login(page, fixture.patients.find(i => i.kind === 'unlinked')!)
  await page.getByRole('link', { name: 'Therapy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create session', exact: true })).toBeDisabled()
  await expect(page.getByText(/clinician must link/)).toBeVisible()
  await page.goto('/research/models'); await expect(page).toHaveURL(/\/patient$/)
})
for (const role of ['clinician','researcher'] as const) test(role + ': authorized navigation and real API reads', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  const failures: string[] = []
  page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400) failures.push(r.status() + ' ' + r.url()) })
  await login(page, fixture[role])
  const names = role === 'clinician' ? ['Patients','Sessions','Recordings','Annotations'] : ['Participants','Sessions','Datasets','Recordings','Annotations','Evaluation','Models']
  for (const name of names) {
    await page.getByRole('navigation', { name: role === 'clinician' ? 'Clinician navigation' : 'Research navigation' }).getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/^Loading/)).toHaveCount(0)
    await layout(page); await accessible(page, role + '-' + name.toLowerCase())
  }
  expect(failures).toEqual([])
})

test('validation audio: real ASR response, model metadata and persisted transcript survive reload', async () => {
  const manifest = JSON.parse(readFileSync(resolve(out, 'asr-validation-20260909T054856Z/manifest.json'), 'utf8')) as { audio_path: string; recording_id: string }[]
  // Prerecorded validation speech is injected only into the isolated test database.
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${manifest[0].audio_path}`] })
  try {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', permissions: ['camera','microphone'] })
    const page = await context.newPage()
    let bytes = 0
    const incoming: Record<string, unknown>[] = []
    page.on('websocket', socket => {
      socket.on('framesent', e => { if (typeof e.payload !== 'string') bytes += e.payload.length })
      socket.on('framereceived', e => { if (typeof e.payload === 'string') incoming.push(JSON.parse(e.payload)) })
    })
    await login(page, fixture.patients.find(i => i.kind === 'speech')!)
    const sessionId = await createSession(page)
    await page.getByRole('button', { name: 'Start attempt', exact: true }).click()
    await expect.poll(() => bytes, { timeout: 20000 }).toBeGreaterThanOrEqual(256000)
    await page.getByRole('button', { name: 'Stop attempt', exact: true }).click()
    // An earlier VAD segment may already have a result; wait for the final
    // stream acknowledgement and lifecycle save before comparing readback.
    await expect(page.getByText(/Connection: stopped/)).toBeVisible({ timeout: 60000 })
    await expect(page.getByText(/Attempt saved\./)).toBeVisible()
    await expect(page.getByText('Saved speech result', { exact: true })).toBeVisible({ timeout: 60000 })
    const recordings = await get(page, '/api/v1/recordings/recordings?session_id=' + sessionId)
    const predictions = await get(page, '/api/v1/predictions/predictions?attempt_id=' + recordings[0].attempt_id)
    expect(predictions.length).toBeGreaterThan(0)
    const displayed = [...predictions].sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0]
    expect(displayed.predicted_label.length).toBeGreaterThan(0)
    expect(displayed.model_id).toBeTruthy()
    expect(displayed.recording_id).toBe(recordings[0].id)
    expect(incoming.some(i => i.type === 'prediction')).toBe(true)
    await expect(page.locator('.transcript')).toHaveText(displayed.predicted_label)
    await page.reload()
    await expect(page.locator('.transcript')).toHaveText(displayed.predicted_label)
    await accessible(page, 'persisted-speech-result')
    writeFileSync(resolve(out, 'speech-workflow.json'), JSON.stringify({ sourceValidationRecordingId: manifest[0].recording_id, sessionId, bytes, incoming, recordings, predictions, syntheticMediaOnlyInTestDatabase: true }, null, 2))
  } finally { await browser.close() }
})
