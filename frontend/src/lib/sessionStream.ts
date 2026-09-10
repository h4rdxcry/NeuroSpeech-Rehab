import { getWebSocketUrl } from "./api";
import type { StreamStartMessage, WSMessage } from "./types";

export interface StreamState {
  connectionState: "idle" | "connecting" | "streaming" | "stopping" | "stopped" | "error";
  recordingId: string | null;
  predictionIds: string[];
  statusMessage: string | null;
  error: string | null;
}

export const initialStreamState: StreamState = {
  connectionState: "idle", recordingId: null, predictionIds: [], statusMessage: null, error: null,
};

/** One authenticated, bounded audio attempt. Completion waits for database cleanup/socket close. */
export class SessionStream {
  private socket: WebSocket | null = null;
  private state: StreamState = { ...initialStreamState, predictionIds: [] };
  private bytes = 0;
  private stopped = false;
  private startResolve?: () => void;
  private startReject?: (error: Error) => void;
  private stopResolve?: () => void;
  private stopReject?: (error: Error) => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly update: (state: StreamState) => void) {}

  private publish(change: Partial<StreamState>) {
    this.state = { ...this.state, ...change };
    this.update(this.state);
  }

  private fail(message: string) {
    clearTimeout(this.timer);
    this.publish({ connectionState: "error", error: message });
    this.startReject?.(new Error(message));
    this.stopReject?.(new Error(message));
    this.startReject = undefined;
    this.stopReject = undefined;
    this.socket?.close();
  }

  start(metadata: StreamStartMessage): Promise<void> {
    if (this.socket) throw new Error("An audio stream is already open.");
    this.publish({ ...initialStreamState, predictionIds: [], connectionState: "connecting" });
    this.bytes = 0;
    this.stopped = false;
    return new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
      try {
        const socket = new WebSocket(getWebSocketUrl(metadata.session_id));
        this.socket = socket;
        socket.binaryType = "arraybuffer";
        this.timer = setTimeout(() => this.fail("Live analysis did not start. Please try again."), 20000);
        socket.onopen = () => socket.send(JSON.stringify(metadata));
        socket.onmessage = (event) => {
          let message: WSMessage;
          try { message = JSON.parse(String(event.data)) as WSMessage; }
          catch { this.fail("The backend returned an unreadable stream message."); return; }
          switch (message.type) {
            case "stream_started":
              clearTimeout(this.timer);
              this.publish({ connectionState: "streaming", recordingId: message.recording_id, statusMessage: message.message });
              this.startResolve?.();
              this.startResolve = undefined;
              this.startReject = undefined;
              break;
            case "prediction":
              if (message.attempt_id !== metadata.attempt_id) {
                this.fail("Live analysis returned a result for a different attempt.");
                return;
              }
              // Keep all result IDs, even if prediction and stop arrive in the same React render.
              this.publish({ predictionIds: [...new Set([...this.state.predictionIds, message.prediction_id])] });
              break;
            case "status":
              this.publish({ statusMessage: message.message });
              break;
            case "error":
              this.publish({ error: message.message });
              if (this.state.connectionState === "connecting") this.fail(message.message);
              break;
            case "stream_stopped":
              this.stopped = true;
              this.publish({ statusMessage: message.message });
              break;
            default:
              this.fail("The backend returned an unsupported stream message.");
          }
        };
        socket.onerror = () => this.fail("Unable to connect to live analysis.");
        socket.onclose = () => {
          this.socket = null;
          clearTimeout(this.timer);
          if (this.stopped) {
            this.publish({ connectionState: "stopped" });
            this.stopResolve?.();
            this.stopResolve = undefined;
            this.stopReject = undefined;
          } else if (this.state.connectionState !== "error") {
            this.fail("Live analysis disconnected before the attempt finished.");
          }
        };
      } catch (error) {
        this.fail(error instanceof Error ? error.message : "Unable to open live analysis.");
      }
    });
  }

  sendAudio(chunk: ArrayBuffer) {
    if (this.state.connectionState !== "streaming" || this.socket?.readyState !== WebSocket.OPEN) return;
    if (!chunk.byteLength || chunk.byteLength % 2 || chunk.byteLength > 262144) {
      throw new Error("The microphone produced an invalid PCM audio chunk.");
    }
    if (this.bytes + chunk.byteLength > 1920000 || this.socket.bufferedAmount > 262144) {
      throw new Error("The audio limit or connection buffer was reached. Please stop and try again.");
    }
    this.socket.send(chunk);
    this.bytes += chunk.byteLength;
  }

  stop(): Promise<void> {
    if (this.state.connectionState === "stopped") return Promise.resolve();
    if (this.state.connectionState !== "streaming" || this.socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("No live audio stream is available to finish."));
    }
    this.publish({ connectionState: "stopping" });
    return new Promise((resolve, reject) => {
      this.stopResolve = resolve;
      this.stopReject = reject;
      this.timer = setTimeout(() => this.fail("Live analysis took too long to finish. Reopen the session to check saved results."), 120000);
      this.socket!.send(JSON.stringify({ type: "stream_stop" }));
    });
  }

  dispose() {
    clearTimeout(this.timer);
    this.startReject?.(new Error("Audio attempt was cancelled."));
    this.stopReject?.(new Error("Audio attempt was cancelled."));
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
