/**
 * Offline, first-party audio: every sound is synthesised on-device into a
 * 16-bit PCM WAV. No downloads, no bundled samples, works in airplane mode.
 *
 * All generators are deterministic (seeded PRNG) so a loop sounds the same on
 * every launch and the output is testable.
 */

export const SAMPLE_RATE = 22_050;

export type Stereo = [Float32Array, Float32Array];

/** Mulberry32: tiny, fast, good enough for audio noise. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(buf: Float32Array, peak: number) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/**
 * Makes a buffer loop seamlessly: renders `fade` extra samples and
 * equal-power crossfades that tail into the head.
 */
function seamless(render: (n: number) => Float32Array, length: number, fade: number): Float32Array {
  const raw = render(length + fade);
  const out = raw.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const x = i / fade;
    out[i] = raw[length + i] * Math.cos((x * Math.PI) / 2) + raw[i] * Math.sin((x * Math.PI) / 2);
  }
  return out;
}

export function whiteNoise(n: number, seed = 1): Float32Array {
  const r = prng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Paul Kellet's pink filter: -3 dB/oct, reads as steady rain. */
export function pinkNoise(n: number, seed = 2): Float32Array {
  const r = prng(seed);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  return out;
}

/** Leaky-integrated noise: -6 dB/oct, a low hearth rumble. */
export function brownNoise(n: number, seed = 3): Float32Array {
  const r = prng(seed);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (r() * 2 - 1)) / 1.02;
    out[i] = last;
  }
  return out;
}

/**
 * Binaural beat: slightly different sine per ear. The loop length must hold
 * a whole number of cycles of both tones or the seam clicks.
 */
export function binaural(seconds: number, carrierHz = 200, beatHz = 40): Stereo {
  const n = Math.round(seconds * SAMPLE_RATE);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    l[i] = 0.5 * Math.sin(2 * Math.PI * carrierHz * t);
    r[i] = 0.5 * Math.sin(2 * Math.PI * (carrierHz + beatHz) * t);
  }
  return [l, r];
}

export type AmbientId = "white-noise" | "rain" | "hearth" | "waves";

export function renderAmbient(id: AmbientId, seconds = 6): Stereo {
  const n = Math.round(seconds * SAMPLE_RATE);
  const fade = Math.round(0.5 * SAMPLE_RATE);
  const mono = (gen: (len: number, seed: number) => Float32Array, peak: number, seedL: number, seedR: number): Stereo => [
    normalize(seamless((len) => gen(len, seedL), n, fade), peak),
    // Decorrelated channels sound wide instead of "inside your head".
    normalize(seamless((len) => gen(len, seedR), n, fade), peak),
  ];
  switch (id) {
    case "white-noise":
      return mono(whiteNoise, 0.35, 11, 12);
    case "rain":
      return mono(pinkNoise, 0.55, 21, 22);
    case "hearth":
      return mono(brownNoise, 0.8, 31, 32);
    case "waves":
      // 5 s = 1000 and 1200 whole cycles of 200/240 Hz → click-free loop.
      return binaural(5);
  }
}

/** Exponential decay envelope with a short attack (no click on onset). */
function env(i: number, attack: number, decay: number) {
  const t = i / SAMPLE_RATE;
  const a = Math.min(1, t / attack);
  return a * Math.exp(-t / decay);
}

/** Damped resonator excited by a noise burst ≈ struck wood. */
function woodHit(n: number, offset: number, freq: number, decay: number, seed: number, into: Float32Array, gain = 1) {
  const r = prng(seed);
  const w = 2 * Math.PI * freq / SAMPLE_RATE;
  for (let i = 0; i < n && offset + i < into.length; i++) {
    const excite = i < SAMPLE_RATE * 0.004 ? r() * 2 - 1 : 0;
    const body = Math.sin(w * i) * env(i, 0.0015, decay);
    const overtone = 0.4 * Math.sin(w * 2.76 * i) * env(i, 0.001, decay * 0.4);
    into[offset + i] += gain * (0.6 * body + 0.3 * overtone + 0.5 * excite * env(i, 0.0005, 0.01));
  }
}

export type SfxId = "latch" | "picket" | "knock" | "panel" | "release";

/** The brand palette is wood and mechanism: clicks, catches, knocks. */
export function renderSfx(id: SfxId): Float32Array {
  const len = (s: number) => Math.round(s * SAMPLE_RATE);
  switch (id) {
    case "latch": {
      // Bolt slides (soft), then catches (sharp, higher).
      const out = new Float32Array(len(0.35));
      woodHit(len(0.2), 0, 420, 0.035, 41, out, 0.5);
      woodHit(len(0.25), len(0.08), 1250, 0.03, 42, out, 1);
      woodHit(len(0.25), len(0.085), 180, 0.06, 43, out, 0.6);
      return normalize(out, 0.9);
    }
    case "picket": {
      const out = new Float32Array(len(0.18));
      woodHit(out.length, 0, 900, 0.025, 51, out);
      return normalize(out, 0.55);
    }
    case "knock": {
      // "You bumped into something": two soft, low, muted knocks.
      const out = new Float32Array(len(0.4));
      woodHit(len(0.2), 0, 210, 0.05, 61, out);
      woodHit(len(0.2), len(0.16), 190, 0.05, 62, out, 0.8);
      return normalize(out, 0.6);
    }
    case "panel": {
      // Warm two-note resolve on a wooden body (a fifth, then the root).
      const out = new Float32Array(len(1.1));
      woodHit(len(0.6), 0, 392, 0.18, 71, out, 0.8);
      woodHit(len(0.9), len(0.16), 523.25, 0.3, 72, out, 1);
      return normalize(out, 0.7);
    }
    case "release": {
      // Latch lifts and doesn't resolve: one dull tick, no second note.
      const out = new Float32Array(len(0.25));
      woodHit(out.length, 0, 330, 0.04, 81, out);
      return normalize(out, 0.45);
    }
  }
}

/** Interleaved 16-bit PCM WAV. Mono when `right` is omitted. */
export function encodeWav(left: Float32Array, right?: Float32Array): Uint8Array {
  const channels = right ? 2 : 1;
  const frames = left.length;
  const dataBytes = frames * channels * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, (c === 0 ? left : right!)[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}
