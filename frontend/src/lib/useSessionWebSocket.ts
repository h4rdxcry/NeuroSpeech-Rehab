import { useCallback, useEffect, useRef, useState } from "react";
import { initialStreamState, SessionStream } from "./sessionStream";
import type { StreamStartMessage } from "./types";

export function useSessionWebSocket(sessionId: string | null) {
  const clientRef = useRef<SessionStream | null>(null);
  const [state, setState] = useState(initialStreamState);

  const startStream = useCallback(async (metadata: StreamStartMessage) => {
    if (!sessionId || metadata.session_id !== sessionId) throw new Error("A matching session is required.");
    clientRef.current?.dispose();
    const client = new SessionStream(setState);
    clientRef.current = client;
    await client.start(metadata);
  }, [sessionId]);

  const sendAudio = useCallback((chunk: ArrayBuffer) => clientRef.current?.sendAudio(chunk), []);
  const stopStream = useCallback(() => clientRef.current?.stop() ?? Promise.resolve(), []);
  const closeStream = useCallback(() => { clientRef.current?.dispose(); clientRef.current = null; }, []);
  useEffect(() => {
    setState(initialStreamState);
    return closeStream;
  }, [sessionId, closeStream]);

  return { ...state, startStream, sendAudio, stopStream, closeStream };
}
