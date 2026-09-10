/** Browser Web Audio performs sample-rate conversion; the wire format is signed LE PCM16. */
export function pcm16(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  input.forEach((value, i) => {
    const sample = Math.max(-1, Math.min(1, value));
    view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  });
  return buffer;
}

export async function capturePcm(stream: MediaStream, send: (chunk: ArrayBuffer) => void, onError: (error: Error) => void): Promise<() => void> {
  // If the stream has no audio tracks, return an immediate no-op cleanup function
  if (!stream.getAudioTracks().length) {
    return () => {};
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("This browser does not support Web Audio capture.");
  }

  let context: AudioContext;
  try {
    context = new AudioCtx({ sampleRate: 16000 });
  } catch {
    context = new AudioCtx();
  }

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(2048, 1, 1);
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;

  const stop = () => {
    processor.onaudioprocess = null;
    try { processor.disconnect(); } catch {}
    try { source.disconnect(); } catch {}
    try { silentOutput.disconnect(); } catch {}
    if (context.state !== "closed") {
      void context.close().catch(() => {});
    }
  };

  const actualSampleRate = context.sampleRate;
  const needsResampling = actualSampleRate !== 16000;

  processor.onaudioprocess = (event) => {
    try {
      const inputData = event.inputBuffer.getChannelData(0);
      let output16k: Float32Array;

      if (needsResampling) {
        const ratio = actualSampleRate / 16000;
        const newLength = Math.max(1, Math.round(inputData.length / ratio));
        output16k = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const origIdx = Math.min(inputData.length - 1, Math.floor(i * ratio));
          output16k[i] = inputData[origIdx] ?? 0;
        }
      } else {
        output16k = inputData;
      }

      send(pcm16(output16k));
    } catch (error) {
      stop();
      onError(error instanceof Error ? error : new Error("Audio capture failed."));
    }
  };

  source.connect(processor);
  processor.connect(silentOutput);
  silentOutput.connect(context.destination);

  try {
    if (context.state === "suspended") {
      await context.resume();
    }
  } catch (error) {
    stop();
    throw error;
  }

  return stop;
}
