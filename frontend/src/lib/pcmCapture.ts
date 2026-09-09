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
  const context = new AudioContext({ sampleRate: 16000 });
  if (context.sampleRate !== 16000) {
    await context.close();
    throw new Error("This browser cannot provide the required 16 kHz audio. Please use a supported browser.");
  }
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(2048, 1, 1);
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  const stop = () => {
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    silentOutput.disconnect();
    void context.close();
  };
  processor.onaudioprocess = (event) => {
    try { send(pcm16(event.inputBuffer.getChannelData(0))); }
    catch (error) {
      stop();
      onError(error instanceof Error ? error : new Error("Audio capture failed."));
    }
  };
  source.connect(processor);
  processor.connect(silentOutput);
  silentOutput.connect(context.destination);
  try { await context.resume(); }
  catch (error) { stop(); throw error; }
  return stop;
}
