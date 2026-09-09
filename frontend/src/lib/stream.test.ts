import { describe, it, expect, vi, afterEach } from 'vitest'
import { pcm16 } from './pcmCapture'
import { api, getWebSocketUrl, listAll } from './api'
import { SessionStream } from './sessionStream'
import type { StreamStartMessage } from './types'

const metadata: StreamStartMessage = { type: 'stream_start', session_id: 'real-session', attempt_id: 'real-attempt', modality: 'AUDIO', sample_rate: 16000, channels: 1, sample_width_bytes: 2, encoding: 'pcm16' }
class Socket {
  static OPEN = 1
  static last: Socket
  readyState = 1
  bufferedAmount = 0
  binaryType = ''
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  send = vi.fn()
  close = vi.fn(() => this.onclose?.())
  constructor(public url: string) { Socket.last = this }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })
describe('audio and persistence boundaries', () => {
  it('encodes signed little-endian PCM16 with clamping', () => {
    const bytes = new Uint8Array(pcm16(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2])))
    expect([...bytes]).toEqual([0,128,0,128,0,192,0,0,255,63,255,127,255,127])
  })
  it('requires authentication before opening a stream', () => {
    expect(() => getWebSocketUrl('s')).toThrow('sign in')
  })
  it('sends metadata before PCM and waits for stop acknowledgement and close', async () => {
    vi.stubGlobal('WebSocket', Socket); localStorage.setItem('access_token', 'test')
    const update = vi.fn(), stream = new SessionStream(update)
    const start = stream.start(metadata), socket = Socket.last
    socket.onopen?.(); expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual(metadata)
    socket.message({ type: 'stream_started', recording_id: 'persisted-recording', message: 'Ready' }); await start
    const chunk = pcm16(new Float32Array([0, 0.5])); stream.sendAudio(chunk)
    expect(socket.send).toHaveBeenLastCalledWith(chunk)
    expect(() => stream.sendAudio(new ArrayBuffer(3))).toThrow('invalid PCM')
    let resolved = false; const stopped = stream.stop().then(() => { resolved = true })
    expect(JSON.parse(socket.send.mock.calls.slice(-1)[0][0])).toEqual({ type: 'stream_stop' })
    socket.message({ type: 'stream_stopped', message: 'Saved' }); await Promise.resolve(); expect(resolved).toBe(false)
    socket.onclose?.(); await stopped; expect(update.mock.calls.slice(-1)[0][0].connectionState).toBe('stopped')
    stream.dispose()
  })
  it('rejects results for a different attempt without displaying prediction IDs', async () => {
    vi.stubGlobal('WebSocket', Socket); localStorage.setItem('access_token', 'test')
    const update = vi.fn(), stream = new SessionStream(update), start = stream.start(metadata), socket = Socket.last
    socket.onopen?.(); socket.message({ type: 'stream_started', recording_id: 'r', message: '' }); await start
    socket.message({ type: 'prediction', attempt_id: 'another-attempt', prediction_id: 'bad' })
    expect(update.mock.calls.slice(-1)[0][0]).toMatchObject({ connectionState: 'error', predictionIds: [] })
    stream.dispose()
  })
  it('stops on backpressure instead of silently losing PCM', async () => {
    vi.stubGlobal('WebSocket', Socket); localStorage.setItem('access_token', 'test')
    const stream = new SessionStream(vi.fn()), start = stream.start(metadata), socket = Socket.last
    socket.message({ type: 'stream_started', recording_id: 'r', message: '' }); await start
    socket.bufferedAmount = 262145
    expect(() => stream.sendAudio(new ArrayBuffer(2))).toThrow('buffer')
    stream.dispose()
  })
  it('loads all history pages without hiding the 101st result', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id }))), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify([{ id: 100 }]), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await listAll('/history?session_id=s')).toHaveLength(101)
    expect(fetcher.mock.calls[1][0]).toContain('session_id=s&skip=100&limit=100')
  })
  it('expires authentication on 401 rather than treating the response as empty data', async () => {
    localStorage.setItem('access_token', 'expired'); localStorage.setItem('refresh_token', 'expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    await expect(api.get('/history')).rejects.toThrow('expired')
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
