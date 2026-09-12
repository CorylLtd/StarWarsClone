import { describe, expect, it } from 'vitest';
import { analyse, breathFrames, detectPitch, levinson, packFrames, type Frame } from '../../scripts/lpc.ts';
import { SPEECH_WORDS } from '../data/speech';
import { BREATH, PAUSE, SPEECH_LINES } from './speechLines';
import { TMS5220_CORE_SOURCE } from './tms5220Processor';
import { CHIRP, ENERGY, FRAME_SAMPLES, K_BITS, K_TABLES, PITCH, TMS5220_TABLES } from './tms5220Tables';

/** Every simulation source file, as text, so the lines the game raises can be checked. */
const GAME_SOURCES = import.meta.glob('../game/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

interface Chip {
  speaking: boolean;
  current: { energy: number; pitch: number; k: number[] };
  speak(bytes: number[] | Uint8Array): void;
  sample(): number;
}
// The worklet's chip core, evaluated outside the worklet.
const Tms5220 = new Function(`${TMS5220_CORE_SOURCE}; return Tms5220;`)() as new (tables: unknown) => Chip;

function render(frames: Frame[]): Float64Array {
  const chip = new Tms5220(TMS5220_TABLES);
  chip.speak(packFrames(frames));
  const out = new Float64Array(frames.length * FRAME_SAMPLES);
  for (let i = 0; i < out.length; i++) out[i] = chip.sample();
  return out;
}

describe('the chip tables', () => {
  it('have the chip\'s sizes', () => {
    expect(ENERGY).toHaveLength(16);
    expect(PITCH).toHaveLength(64);
    expect(CHIRP).toHaveLength(52);
    K_TABLES.forEach((t, i) => expect(t).toHaveLength(1 << K_BITS[i]));
  });
});

describe('the chip model', () => {
  it('is silent until spoken to and after a stop frame', () => {
    const chip = new Tms5220(TMS5220_TABLES);
    expect(chip.sample()).toBe(0);
    chip.speak(packFrames([{ energy: 15, repeat: false, pitch: 0, k: [] }]));
    for (let i = 0; i < 400; i++) chip.sample();
    expect(chip.speaking).toBe(false);
  });

  it('falls silent within a frame of a word ending', () => {
    for (const w of Object.values(SPEECH_WORDS).slice(0, 6)) {
      const chip = new Tms5220(TMS5220_TABLES);
      const bytes: number[] = [];
      for (let i = 0; i < w.data.length; i += 2) bytes.push(parseInt(w.data.slice(i, i + 2), 16));
      chip.speak(bytes);
      for (let i = 0; i < (w.frames + 1) * FRAME_SAMPLES; i++) chip.sample();
      expect(chip.speaking).toBe(false);
      expect(chip.sample()).toBe(0);
    }
  });

  it('sounds a voiced frame at its pitch period', () => {
    const frames: Frame[] = new Array(8).fill({ energy: 10, repeat: false, pitch: 30, k: new Array(10).fill(0).map((_, i) => K_TABLES[i].indexOf(K_TABLES[i].reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a))) ) });
    frames.push({ energy: 15, repeat: false, pitch: 0, k: [] });
    const out = render(frames);
    // With flat coefficients the output is the chirp itself, repeating every PITCH[30] samples.
    const period = PITCH[30];
    let matches = 0;
    for (let i = 600; i < 1200; i++) if (Math.abs(out[i] - out[i + period]) < 1e-9) matches += 1;
    expect(matches).toBe(600);
    expect(Math.max(...Array.from(out))).toBeGreaterThan(0.05);
  });

  it('interpolates energy toward a target over a frame', () => {
    const chip = new Tms5220(TMS5220_TABLES);
    const k = new Array(10).fill(0).map((_, i) => K_TABLES[i].indexOf(K_TABLES[i].reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a))));
    chip.speak(packFrames([{ energy: 4, repeat: false, pitch: 30, k }, { energy: 12, repeat: false, pitch: 30, k }, { energy: 12, repeat: false, pitch: 30, k }, { energy: 15, repeat: false, pitch: 0, k: [] }]));
    for (let i = 0; i < FRAME_SAMPLES; i++) chip.sample();
    const energies: number[] = [];
    for (let p = 0; p < 8; p++) {
      chip.sample();
      energies.push(chip.current.energy);
      for (let i = 1; i < 25; i++) chip.sample();
    }
    expect(energies[0]).toBe(ENERGY[4]);
    expect(energies[7]).toBeLessThan(ENERGY[12]);
    expect(energies[7]).toBeGreaterThan(energies[1]);
    chip.sample();
    expect(chip.current.energy).toBe(ENERGY[12]);
  });
});

describe('the encoder', () => {
  it('packs frames the way the chip reads them', () => {
    const chip = new Tms5220(TMS5220_TABLES);
    const frames: Frame[] = [{ energy: 9, repeat: false, pitch: 20, k: [3, 4, 5, 6, 7, 8, 9, 1, 2, 3] }, { energy: 15, repeat: false, pitch: 0, k: [] }];
    chip.speak(packFrames(frames));
    chip.sample();
    expect(chip.current.energy).toBe(ENERGY[9]);
    expect(chip.current.pitch).toBe(PITCH[20]);
    expect(chip.current.k).toEqual(frames[0].k.map((idx, i) => K_TABLES[i][idx]));
  });

  it('finds the pitch of a pulse train', () => {
    const s = new Float64Array(1600);
    for (let i = 0; i < s.length; i += 66) s[i] = 1;
    for (let i = 1; i < s.length; i++) s[i] += 0.9 * s[i - 1];
    expect(detectPitch(s, 200, 0.45).lag).toBe(66);
  });

  it('recovers a lattice\'s coefficients from what the chip produces with them', () => {
    // Speak steady unvoiced frames with a chosen spectrum, then analyse the output: the same K indices should come back.
    const k = [24, 10, 8, 8];
    const frames: Frame[] = new Array(14).fill({ energy: 9, repeat: false, pitch: 0, k });
    frames.push({ energy: 15, repeat: false, pitch: 0, k: [] });
    const out = render(frames);
    expect(Math.max(...Array.from(out))).toBeLessThan(0.99);
    const back = analyse(out.slice(400, 2400), { preEmphasis: 0, normalise: false });
    const middle = back[Math.floor(back.length / 2)];
    expect(middle.pitch).toBe(0);
    for (let i = 0; i < 4; i++) expect(Math.abs(middle.k[i] - k[i]), `K${i + 1}`).toBeLessThanOrEqual(1);
    expect(Math.abs(middle.energy - 9)).toBeLessThanOrEqual(1);
  });

  it('levinson sees a positive first coefficient for a low-pass signal', () => {
    const r = new Float64Array([1, 0.9, 0.81, 0.73, 0.66, 0.59, 0.53, 0.48, 0.43, 0.39, 0.35]);
    expect(levinson(r).k[0]).toBeCloseTo(0.9);
  });

  it('a breath is unvoiced and ends with a stop', () => {
    const b = breathFrames();
    expect(b.every((f) => f.pitch === 0)).toBe(true);
    expect(b.at(-1)!.energy).toBe(15);
  });
});

describe('the lines', () => {
  it('every line the game raises has words, and every word has frames', () => {
    const lines = new Set<string>();
    for (const [file, text] of Object.entries(GAME_SOURCES)) {
      if (file.endsWith('.test.ts')) continue;
      for (const m of text.matchAll(/type: 'speech', line: (?:'([^']+)'|"([^"]+)")/g)) lines.add(m[1] ?? m[2]);
      for (const m of text.matchAll(/even \? '([^']+)' : '([^']+)'/g)) {
        lines.add(m[1]);
        lines.add(m[2]);
      }
    }
    expect(lines.size).toBeGreaterThanOrEqual(15);
    for (const line of lines) {
      const entry = SPEECH_LINES[line];
      expect(entry, line).toBeDefined();
      for (const word of entry.words) {
        if (word === PAUSE) continue;
        expect(SPEECH_WORDS[word === BREATH ? BREATH : word], word).toBeDefined();
      }
    }
  });

  it('every word stream ends with a stop frame and is mostly not silence', () => {
    for (const [word, w] of Object.entries(SPEECH_WORDS)) {
      const chip = new Tms5220(TMS5220_TABLES);
      const bytes: number[] = [];
      for (let i = 0; i < w.data.length; i += 2) bytes.push(parseInt(w.data.slice(i, i + 2), 16));
      chip.speak(bytes);
      let loud = 0;
      for (let f = 0; f < w.frames; f++) {
        let peak = 0;
        for (let i = 0; i < FRAME_SAMPLES; i++) peak = Math.max(peak, Math.abs(chip.sample()));
        if (peak > 0.02) loud += 1;
      }
      expect(chip.speaking, word).toBe(false);
      expect(loud / w.frames, word).toBeGreaterThan(0.5);
    }
  });
});

describe('the original\'s phrases, when installed locally', () => {
  it('decode through the chip model as speech that ends', async () => {
    const local = import.meta.glob('../data/local/speech.ts', { eager: true }) as Record<string, { ORIGINAL_SPEECH: Record<number, { frames: number; data: string }> }>;
    const words = Object.values(local)[0]?.ORIGINAL_SPEECH;
    if (!words) return;
    const { ORIGINAL_WORD_INDEX } = await import('./speechLines');
    for (const index of Object.values(ORIGINAL_WORD_INDEX)) expect(words[index], `word ${index}`).toBeDefined();
    for (const [index, w] of Object.entries(words)) {
      const chip = new Tms5220(TMS5220_TABLES);
      const bytes: number[] = [];
      for (let i = 0; i < w.data.length; i += 2) bytes.push(parseInt(w.data.slice(i, i + 2), 16));
      chip.speak(bytes);
      let loud = 0;
      for (let f = 0; f < w.frames; f++) {
        let peak = 0;
        for (let i = 0; i < FRAME_SAMPLES; i++) peak = Math.max(peak, Math.abs(chip.sample()));
        if (peak > 0.02) loud += 1;
      }
      expect(chip.speaking, `word ${index} stops`).toBe(false);
      expect(w.frames, `word ${index} length`).toBeGreaterThan(8);
      expect(loud / w.frames, `word ${index} loud`).toBeGreaterThan(0.4);
    }
  });
});
