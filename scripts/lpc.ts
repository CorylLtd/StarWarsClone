/**
 * LPC analysis to TMS5220 frames: the offline half of the speech pipeline.
 * Frames are 25 ms at 8 kHz; each gets a quantised energy, pitch period (0
 * for unvoiced) and reflection coefficients from the chip's own tables, and
 * `packFrames` writes them in the chip's frame format, most significant bit
 * first, so the worklet parses what the chip would have.
 */
import { CHIRP, ENERGY, FRAME_SAMPLES, K_BITS, K_TABLES, PITCH } from '../src/audio/tms5220Tables.ts';

export interface Frame {
  /** Energy table index; 0 silence, 15 stop. */
  energy: number;
  repeat: boolean;
  /** Pitch table index; 0 unvoiced. */
  pitch: number;
  /** K1..K10 table indices (K5..K10 unused when unvoiced). */
  k: number[];
}

export interface AnalysisOptions {
  /** Multiply detected pitch periods (greater than one lowers the voice). */
  pitchScale: number;
  /** Multiply energies before quantising. */
  gain: number;
  /** Pre-emphasis coefficient. */
  preEmphasis: number;
  /** Normalised autocorrelation above which a frame is voiced. */
  voicing: number;
  /** Scale the input to a 0.9 peak first, so every voice encodes at the same level. */
  normalise: boolean;
}

export const DEFAULT_OPTIONS: AnalysisOptions = { pitchScale: 1, gain: 1, preEmphasis: 0.75, voicing: 0.45, normalise: true };

const WINDOW = 240;
const ORDER = 10;
const MIN_LAG = PITCH[1];
const MAX_LAG = PITCH[PITCH.length - 1];

function hamming(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** Levinson-Durbin: reflection coefficients (predictor convention, k1 positive for a low-pass signal) and the residual energy. */
export function levinson(r: Float64Array): { k: number[]; residual: number } {
  let a: number[] = new Array(ORDER + 1).fill(0);
  let e = r[0];
  const k: number[] = [];
  for (let i = 1; i <= ORDER; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc -= a[j] * r[i - j];
    const ki = e > 0 ? acc / e : 0;
    k.push(ki);
    const next = a.slice();
    next[i] = ki;
    for (let j = 1; j < i; j++) next[j] = a[j] - ki * a[i - j];
    a = next;
    e *= 1 - ki * ki;
  }
  return { k, residual: Math.max(0, e) };
}

function nearest(table: number[], value: number, from = 0): number {
  let best = from;
  for (let i = from; i < table.length; i++) if (Math.abs(table[i] - value) < Math.abs(table[best] - value)) best = i;
  return best;
}

/** Pitch period by normalised autocorrelation of the centre-clipped frame; 0 when unvoiced. */
export function detectPitch(s: Float64Array, start: number, voicing: number): { lag: number; strength: number } {
  const n = 2 * FRAME_SAMPLES;
  const seg = new Float64Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = s[start + i] ?? 0;
    seg[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const clip = 0.3 * peak;
  for (let i = 0; i < n; i++) seg[i] = seg[i] > clip ? seg[i] - clip : seg[i] < -clip ? seg[i] + clip : 0;
  let bestLag = 0;
  let best = 0;
  for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
    let num = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      num += seg[i] * seg[i + lag];
      e1 += seg[i] * seg[i];
      e2 += seg[i + lag] * seg[i + lag];
    }
    const norm = num / (Math.sqrt(e1 * e2) + 1e-9);
    if (norm > best) {
      best = norm;
      bestLag = lag;
    }
  }
  // Prefer a half-period peak nearly as strong: guards against octave-low errors.
  if (bestLag >= 2 * MIN_LAG) {
    const half = Math.round(bestLag / 2);
    let num = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + half < n; i++) {
      num += seg[i] * seg[i + half];
      e1 += seg[i] * seg[i];
      e2 += seg[i + half] * seg[i + half];
    }
    if (num / (Math.sqrt(e1 * e2) + 1e-9) > 0.85 * best) bestLag = half;
  }
  return best >= voicing ? { lag: bestLag, strength: best } : { lag: 0, strength: best };
}

const CHIRP_ENERGY = CHIRP.reduce((s, c) => s + c * c, 0);

/** Analyse 8 kHz samples in -1..1 into chip frames, ending with a stop frame. */
export function analyse(input: Float64Array, options: Partial<AnalysisOptions> = {}): Frame[] {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  let peak = 0;
  for (const v of input) peak = Math.max(peak, Math.abs(v));
  const scale = opt.normalise && peak > 0 ? 0.9 / peak : 1;
  const raw = new Float64Array(input.length);
  const s = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) {
    raw[i] = input[i] * scale;
    s[i] = raw[i] - opt.preEmphasis * (i > 0 ? raw[i - 1] : 0);
  }
  const w = hamming(WINDOW);
  let wEnergy = 0;
  for (const v of w) wEnergy += v * v;
  const count = Math.ceil(input.length / FRAME_SAMPLES);
  const lags: number[] = [];
  const frames: Frame[] = [];
  for (let f = 0; f < count; f++) {
    const start = f * FRAME_SAMPLES - (WINDOW - FRAME_SAMPLES) / 2;
    const r = new Float64Array(ORDER + 1);
    for (let lag = 0; lag <= ORDER; lag++) {
      let acc = 0;
      for (let i = lag; i < WINDOW; i++) acc += (s[start + i] ?? 0) * w[i] * (s[start + i - lag] ?? 0) * w[i - lag];
      r[lag] = acc;
    }
    const { k, residual } = levinson(r);
    const pitch = detectPitch(raw, Math.max(0, f * FRAME_SAMPLES - FRAME_SAMPLES / 2), opt.voicing);
    lags.push(pitch.lag);
    // Residual RMS on the 16-bit scale, then the chip's energy: its excitation is (E * chirp or E * 64) / 8 on a 2048 scale.
    const rms = Math.sqrt(residual / wEnergy) * 32768;
    const chipRms = rms / 16;
    const period = Math.min(MAX_LAG, Math.max(MIN_LAG, Math.round(pitch.lag * opt.pitchScale) || MIN_LAG));
    const divisor = pitch.lag === 0 ? 8 : Math.sqrt(CHIRP_ENERGY / period) / 8;
    const energy = (chipRms / divisor) * opt.gain;
    frames.push({ energy: nearest(ENERGY.slice(0, 15), energy), repeat: false, pitch: 0, k: k.map((ki, i) => nearest(K_TABLES[i], -ki * 512)) });
  }
  // Median-smooth the pitch track, then quantise with the speaker's scale.
  for (let f = 0; f < count; f++) {
    const trio = [lags[f - 1] ?? 0, lags[f], lags[f + 1] ?? 0].filter((l) => l > 0).sort((a, b) => a - b);
    let lag = lags[f];
    if (lag > 0 && trio.length === 3) lag = trio[1];
    if (lag > 0) {
      const scaled = Math.min(MAX_LAG, Math.max(MIN_LAG, lag * opt.pitchScale));
      frames[f].pitch = nearest(PITCH, scaled, 1);
    }
    if (frames[f].energy === 0) frames[f].pitch = 0;
  }
  // Trim silence to one frame at each end, and end with a stop frame.
  let first = frames.findIndex((fr) => fr.energy > 0);
  let last = frames.length - 1;
  while (last > 0 && frames[last].energy === 0) last -= 1;
  if (first < 0) first = 0;
  const trimmed = frames.slice(Math.max(0, first - 1), last + 2);
  trimmed.push({ energy: 15, repeat: false, pitch: 0, k: [] });
  return trimmed;
}

/** A synthesised breath: unvoiced noise shaped like an "h", swelling and fading over 14 frames. */
export function breathFrames(): Frame[] {
  const envelope = [3, 5, 6, 7, 8, 8, 8, 8, 7, 7, 6, 5, 4, 3];
  const k = [nearest(K_TABLES[0], -0.55 * 512), nearest(K_TABLES[1], 0.35 * 512), nearest(K_TABLES[2], -0.2 * 512), nearest(K_TABLES[3], 0.1 * 512)];
  const frames = envelope.map((energy) => ({ energy, repeat: false, pitch: 0, k }));
  frames.push({ energy: 15, repeat: false, pitch: 0, k: [] });
  return frames;
}

/** Pack frames in the chip's format: energy, repeat, pitch, then K1..K4 or K1..K10; most significant bit first. */
export function packFrames(frames: Frame[]): Uint8Array {
  const bits: number[] = [];
  const push = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  for (const f of frames) {
    push(f.energy, 4);
    if (f.energy === 0 || f.energy === 15) continue;
    push(f.repeat ? 1 : 0, 1);
    push(f.pitch, 6);
    if (f.repeat) continue;
    const n = f.pitch === 0 ? 4 : 10;
    for (let i = 0; i < n; i++) push(f.k[i], K_BITS[i]);
  }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => {
    bytes[i >> 3] |= b << (7 - (i & 7));
  });
  return bytes;
}

/** Read a 16-bit mono WAV into samples in -1..1, with its sample rate. */
export function readWav(buffer: Buffer): { rate: number; samples: Float64Array } {
  let pos = 12;
  let rate = 0;
  let channels = 1;
  let data: Buffer | null = null;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(pos + 10);
      rate = buffer.readUInt32LE(pos + 12);
    } else if (id === 'data') {
      data = buffer.subarray(pos + 8, pos + 8 + size);
      break;
    }
    pos += 8 + size + (size & 1);
  }
  if (!data) throw new Error('no data chunk');
  const n = Math.floor(data.length / 2 / channels);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) samples[i] = data.readInt16LE(i * 2 * channels) / 32768;
  return { rate, samples };
}
