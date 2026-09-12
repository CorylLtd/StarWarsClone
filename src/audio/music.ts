import { BEAT_HZ } from './effects';
import { POKEY_CLOCK_HZ } from './pokey';

/**
 * The music player: four 16-bit POKEY voices driven the way the sound board's
 * music driver drove them. A cue is four voices, each a string of notes and
 * settings; `compileCue` walks each voice one step at a time (a step is one
 * 8 ms sequencer tick, as for the effects) doing the driver's duration
 * accounting, amplitude and frequency envelopes, ties and glides, and emits
 * the register writes that result. The cues themselves are original
 * compositions in src/audio/musicCues.ts.
 *
 * Notation, one token per note or setting:
 *   C4q  F#5e.  Bb3h~  Rq  A4e3  G3:20
 *     note name with # or b, scientific octave (A4 = 440 Hz), then a duration:
 *     w h q e s t = 128 64 32 16 8 4 units (a quarter is 32), '.' dotted,
 *     '3' triplet (rounded so three sum exactly), or ':n' units directly.
 *     A trailing '~' slurs into the next note (its envelope keeps running, and
 *     with synth on it glides). R is a rest.
 *   {rate 90} {rate +8}   step rate: units drain at this rate per step (see below)
 *   {vol 7} {vol -1}      median volume 0-15, or a change
 *   {key -12}             semitone offset added to every note
 *   {env hard}            amplitude envelope: none steel hard rise ties
 *   {fenv glock}          frequency envelope: none glock
 *   {synth on}            glide tied notes from the previous pitch
 *   {tone pure}           distortion bits: pure (0xA0) or buzz (0xC0)
 * A quarter note lasts 4096 / rate steps, so rate 64 is 115 bpm and rate 128
 * is 230 bpm (the driver's tunes count in half notes at that rate).
 */

/** Steps per second: every voice is updated every other 4 ms tick. */
export const STEP_HZ = BEAT_HZ;
/** The music chips: the third and fourth POKEYs. */
export const MUSIC_CHIPS = [2, 3];
/** AUDCTL for both music chips: channels 1+2 and 3+4 joined into 16-bit dividers at the chip clock. */
export const MUSIC_AUDCTL = 0x78;

/** One register write at a step time (fractional: voices 2 and 4 run half a step later than 1 and 3). */
export interface MusicWrite {
  t: number;
  chip: number;
  reg: number;
  value: number;
}

export interface MusicTrack {
  writes: MusicWrite[];
  /** Steps until the last voice is silent. */
  length: number;
  /** Per voice, steps until silent. */
  voiceLengths: number[];
}

export interface MusicCue {
  voices: [string, string, string, string] | [Iterable<Item>, Iterable<Item>, Iterable<Item>, Iterable<Item>];
}

/** Where each voice lives: voices 1 and 2 on the fourth chip, 3 and 4 on the third; each is a channel pair (low AUDF, high AUDF, AUDC of the high channel). */
export const VOICE_HARDWARE = [
  { chip: 3, lo: 0, hi: 2, ctl: 3 },
  { chip: 3, lo: 4, hi: 6, ctl: 7 },
  { chip: 2, lo: 0, hi: 2, ctl: 3 },
  { chip: 2, lo: 4, hi: 6, ctl: 7 },
];

/** The driver's amplitude envelopes: volume offsets by steps since the note began, held at the last entry. */
export const AMP_ENVELOPES: Record<string, number[]> = {
  none: new Array(32).fill(0),
  steel: [10, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -2],
  hard: [3, 7, 7, 6, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, -1],
  rise: [7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  ties: [10, 9, 8, 7, 6, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
};

/** The driver's frequency envelopes: divider offsets (times eight for a 16-bit voice) by half-steps since the note began. */
export const FREQ_ENVELOPES: Record<string, number[]> = {
  none: new Array(128).fill(0),
  glock: new Array(128).fill(-1),
};

const TONES: Record<string, number> = { pure: 0xa0, buzz: 0xc0 };
const DURATIONS: Record<string, number> = { w: 128, h: 64, q: 32, e: 16, s: 8, t: 4 };
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Note number as the driver counted them: 1 is C0 (16.35 Hz), 58 is A4; 0 is a rest. */
export function noteNumber(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const semitone = SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 1 + Number(m[3]) * 12 + semitone;
}

/** The 16-bit divider that sounds a note number on the chip clock: f = clock / (2 (N + 7)). */
export function noteDivider(note: number): number {
  const hz = 16.3516 * Math.pow(2, (note - 1) / 12);
  const n = Math.round(POKEY_CLOCK_HZ / (2 * hz)) - 7;
  return Math.max(0, Math.min(0xffff, n));
}

/** One thing a voice does: a note or rest, or a setting. The notation parser and the driver's byte format both produce these. */
export type Item =
  | { kind: 'note'; note: number; units: number; tied: boolean }
  | { kind: 'rate'; value: number; relative: boolean }
  | { kind: 'vol'; value: number; relative: boolean }
  | { kind: 'key'; value: number; relative?: boolean }
  | { kind: 'env'; name: string }
  | { kind: 'fenv'; name: string }
  | { kind: 'synth'; on: boolean }
  | { kind: 'tone'; value: number };

/** Parse one voice's notation into items. */
export function parseVoice(text: string): Item[] {
  const items: Item[] = [];
  let tripletAcc = 0;
  let tieNext = false;
  for (const token of text.match(/\{[^}]*\}|\S+/g) ?? []) {
    if (token.startsWith('{')) {
      const [name, arg] = token.slice(1, -1).trim().split(/\s+/);
      const relative = arg?.startsWith('+') || arg?.startsWith('-');
      switch (name) {
        case 'rate':
          items.push({ kind: 'rate', value: Number(arg), relative: !!relative });
          break;
        case 'vol':
          items.push({ kind: 'vol', value: Number(arg), relative: !!relative });
          break;
        case 'key':
          items.push({ kind: 'key', value: Number(arg) });
          break;
        case 'env':
          if (!AMP_ENVELOPES[arg]) throw new Error(`bad envelope ${arg}`);
          items.push({ kind: 'env', name: arg });
          break;
        case 'fenv':
          if (!FREQ_ENVELOPES[arg]) throw new Error(`bad frequency envelope ${arg}`);
          items.push({ kind: 'fenv', name: arg });
          break;
        case 'synth':
          items.push({ kind: 'synth', on: arg === 'on' });
          break;
        case 'tone':
          if (TONES[arg] === undefined) throw new Error(`bad tone ${arg}`);
          items.push({ kind: 'tone', value: TONES[arg] });
          break;
        default:
          throw new Error(`bad setting ${token}`);
      }
      continue;
    }
    const m = /^(R|[A-G](?:#|b)?-?\d)(?:([whqest])(\.?)(3?)|:(\d+))(~?)$/.exec(token);
    if (!m) throw new Error(`bad token ${token}`);
    let units: number;
    if (m[5]) {
      units = Number(m[5]);
    } else {
      units = DURATIONS[m[2]] * (m[3] ? 1.5 : 1);
      if (m[4]) {
        const exact = units * (2 / 3);
        units = Math.round(tripletAcc + exact) - Math.round(tripletAcc);
        tripletAcc += exact;
      }
    }
    items.push({ kind: 'note', note: m[1] === 'R' ? 0 : noteNumber(m[1]), units, tied: tieNext });
    tieNext = m[6] === '~';
  }
  return items;
}

const MAX_STEPS = 20000;

/** Compile one voice from notation or a stream of items: the driver's per-step logic, emitting writes only when a register changes. */
export function compileVoice(source: string | Iterable<Item>, voice: number): { writes: MusicWrite[]; length: number } {
  const items = typeof source === 'string' ? parseVoice(source)[Symbol.iterator]() : source[Symbol.iterator]();
  let pending = items.next();
  const hw = VOICE_HARDWARE[voice];
  const phase = voice % 2 === 1 ? 0.5 : 0;
  const writes: MusicWrite[] = [];
  let odur = 0;
  let rate = 64;
  let vvol = 7;
  let key = 0;
  let tone = 0xa0;
  let env = AMP_ENVELOPES.none;
  let fenv = FREQ_ENVELOPES.none;
  let synth = false;
  let vseq = 0;
  let onote = 0;
  let vsa = 0;
  let lastLo = -1;
  let lastHi = -1;
  let lastCtl = -1;
  const emit = (step: number, reg: number, value: number) => writes.push({ t: step + phase, chip: hw.chip, reg, value });

  for (let step = 0; step < MAX_STEPS; step++) {
    vseq = Math.min(vseq + 1, 255);
    odur -= rate;
    if (odur < 0) {
      let fetched = false;
      while (!fetched && !pending.done) {
        const it = pending.value;
        pending = items.next();
        switch (it.kind) {
          case 'rate':
            rate = (it.relative ? rate + it.value : it.value) & 0xff;
            break;
          case 'vol':
            vvol = (it.relative ? vvol + it.value : it.value) & 0xff;
            if (vvol > 127) vvol -= 256;
            break;
          case 'key':
            key = it.relative ? key + it.value : it.value;
            break;
          case 'env':
            env = AMP_ENVELOPES[it.name];
            break;
          case 'fenv':
            fenv = FREQ_ENVELOPES[it.name];
            break;
          case 'synth':
            synth = it.on;
            break;
          case 'tone':
            tone = it.value;
            break;
          case 'note': {
            const divider = it.note === 0 ? 0 : noteDivider(it.note + key);
            vsa = onote - divider;
            onote = divider;
            odur += it.units * 128;
            if (!it.tied) {
              vseq = 0;
              vsa = 0;
            } else if (!synth) {
              vsa = 0;
            }
            fetched = true;
            break;
          }
        }
      }
      if (!fetched) {
        // End of the voice: the driver re-initialises it, which silences its output channel.
        emit(step, hw.ctl, 0);
        return { writes, length: step };
      }
    }
    // A glide halves its remaining offset every four steps.
    if (synth && step % 4 === 0) vsa >>= 1;
    const freq = (onote + fenv[Math.min(vseq >> 1, 127)] * 8 + vsa) & 0xffff;
    let vol = 0;
    if (onote !== 0) vol = Math.max(0, Math.min(15, vvol + env[Math.min(vseq, 31)]));
    const ctl = (tone & 0xf0) | vol;
    const lo = freq & 0xff;
    const hi = freq >> 8;
    if (hi !== lastHi) emit(step, hw.hi, hi);
    if (lo !== lastLo) emit(step, hw.lo, lo);
    if (ctl !== lastCtl) emit(step, hw.ctl, ctl);
    lastLo = lo;
    lastHi = hi;
    lastCtl = ctl;
  }
  throw new Error(`voice ${voice + 1} never ends`);
}

/** Compile a four-voice cue into one write list, sorted by time. */
export function compileCue(cue: MusicCue): MusicTrack {
  const writes: MusicWrite[] = [];
  const voiceLengths: number[] = [];
  cue.voices.forEach((text, i) => {
    const v = compileVoice(text, i);
    writes.push(...v.writes);
    voiceLengths.push(v.length);
  });
  writes.sort((a, b) => a.t - b.t);
  return { writes, length: Math.max(...voiceLengths), voiceLengths };
}

/** Repeat a phrase. */
export function rep(times: number, phrase: string): string {
  return new Array(times).fill(phrase).join(' ');
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Move every note of a phrase by scale degrees within C major (accidentals
 * drop to the scale), leaving rests and settings alone; for parallel voices.
 */
export function diatonic(phrase: string, degrees: number): string {
  return (phrase.match(/\{[^}]*\}|\S+/g) ?? [])
    .map((token) => {
      const m = /^([A-G])(#|b)?(-?\d)(.*)$/.exec(token);
      if (!m || token.startsWith('{') || token.startsWith('R')) return token;
      const index = LETTERS.indexOf(m[1]) + Number(m[3]) * 7 + degrees;
      return `${LETTERS[((index % 7) + 7) % 7]}${Math.floor(index / 7)}${m[4]}`;
    })
    .join(' ');
}
