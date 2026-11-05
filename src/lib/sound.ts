import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Timer-done chime. To stay fully self-contained (no bundled audio asset), we
 * synthesize a short two-tone beep as a WAV in memory and play it from a base64
 * data URI. Cheap, offline, no files to ship.
 */

let cachedUri: string | null = null;

function makeBeepWavDataUri(): string {
  const sampleRate = 44100;
  const durationMs = 500;
  const total = Math.floor((sampleRate * durationMs) / 1000);

  // Two pleasant tones (a rising "ta-da").
  const tone1 = 880; // A5
  const tone2 = 1320; // E6
  const bytesPerSample = 2;
  const dataSize = total * bytesPerSample;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  // --- WAV header ---
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // --- samples ---
  const half = total / 2;
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const freq = i < half ? tone1 : tone2;
    // Simple envelope to avoid clicks.
    const env = Math.min(1, i / 800, (total - i) / 800);
    const s = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
  }

  return `data:audio/wav;base64,${base64FromBytes(buffer)}`;
}

function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64FromBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

/** Play the timer-done chime. Best-effort; never throws. */
export async function playTimerDone(): Promise<void> {
  try {
    if (!cachedUri) cachedUri = makeBeepWavDataUri();
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const player = createAudioPlayer({ uri: cachedUri });
    player.play();
    // Release shortly after it finishes.
    setTimeout(() => {
      try { player.remove(); } catch {}
    }, 1500);
  } catch {
    // Sound is a nice-to-have; ignore failures (haptics still fires).
  }
}
