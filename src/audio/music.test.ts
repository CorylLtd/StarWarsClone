import { describe, expect, it } from 'vitest';
import { compileCue, compileVoice, diatonic, MUSIC_CHIPS, noteDivider, noteNumber, parseVoice, STEP_HZ, VOICE_HARDWARE } from './music';
import { MUSIC_CUES, ORIGINAL_CUE_SECONDS } from './musicCues';
import { POKEY_CLOCK_HZ } from './pokey';

/** Every simulation source file, as text, so the cues the game raises can be checked. */
const GAME_SOURCES = import.meta.glob('../game/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function volumes(text: string, voice = 0): number[] {
  const hw = VOICE_HARDWARE[voice];
  return compileVoice(text, voice)
    .writes.filter((w) => w.reg === hw.ctl)
    .map((w) => w.value & 0x0f);
}

describe('notation', () => {
  it('names notes as the driver numbered them', () => {
    expect(noteNumber('C0')).toBe(1);
    expect(noteNumber('A4')).toBe(58);
    expect(noteNumber('Bb3')).toBe(noteNumber('A#3'));
  });

  it('sounds A4 at 440 Hz on the chip clock', () => {
    const hz = POKEY_CLOCK_HZ / (2 * (noteDivider(noteNumber('A4')) + 7));
    expect(Math.abs(hz - 440) / 440).toBeLessThan(0.005);
  });

  it('reads durations, dots, triplets, explicit units and slurs', () => {
    const items = parseVoice('C4q D4e. E4e3 E4e3 E4e3 F4:20~ G4s Rq').filter((i) => i.kind === 'note') as { units: number; tied: boolean }[];
    expect(items.map((i) => i.units)).toEqual([32, 24, 11, 10, 11, 20, 8, 32]);
    expect(items.map((i) => i.tied)).toEqual([false, false, false, false, false, false, true, false]);
  });

  it('rejects what it does not understand', () => {
    expect(() => parseVoice('H4q')).toThrow();
    expect(() => parseVoice('{env loud}')).toThrow();
  });

  it('moves a phrase by scale degrees within C major', () => {
    expect(diatonic('C5e Bb4q Rq {vol 3} B3h', -2)).toBe('A4e G4q Rq {vol 3} G3h');
  });
});

describe('the player', () => {
  it('holds a quarter note for 4096 / rate steps', () => {
    const v = compileVoice('{rate 64} {env none} C4q', 0);
    expect(v.length).toBe(64);
    const off = v.writes.filter((w) => w.reg === VOICE_HARDWARE[0].ctl).at(-1)!;
    expect(off.t).toBe(64);
    expect(off.value).toBe(0);
  });

  it('carries a note\'s overrun into the next', () => {
    expect(compileVoice('{rate 100} {env none} C4q C4q C4q C4q', 0).length).toBe(Math.ceil((4 * 4096) / 100));
  });

  it('shapes the volume with the amplitude envelope', () => {
    expect(volumes('{rate 64} {env hard} {vol 7} C4q').slice(0, 5)).toEqual([10, 14, 13, 12, 11]);
    expect(volumes('{rate 64} {env steel} {vol 7} C4q')[0]).toBe(15);
  });

  it('keeps the envelope running through a slur', () => {
    const plain = volumes('{rate 64} {env steel} {vol 7} C4e D4e');
    const slurred = volumes('{rate 64} {env steel} {vol 7} C4e~ D4e');
    expect(plain.filter((v) => v === 15)).toHaveLength(2);
    expect(slurred.filter((v) => v === 15)).toHaveLength(1);
  });

  it('rests keep the tone bits and drop the volume', () => {
    const hw = VOICE_HARDWARE[0];
    const ctl = compileVoice('{tone pure} C4e Re', 0).writes.filter((w) => w.reg === hw.ctl);
    expect(ctl.at(-2)!.value).toBe(0xa0);
  });

  it('glides a slurred note from the previous pitch with synth on', () => {
    const hw = VOICE_HARDWARE[0];
    const dividerAt = (writes: { t: number; reg: number; value: number }[], t: number) => {
      let lo = 0;
      let hi = 0;
      for (const w of writes) {
        if (w.t > t) break;
        if (w.reg === hw.lo) lo = w.value;
        if (w.reg === hw.hi) hi = w.value;
      }
      return (hi << 8) | lo;
    };
    const v = compileVoice('{rate 64} {synth on} C4q~ G4q', 0);
    const c = noteDivider(noteNumber('C4'));
    const g = noteDivider(noteNumber('G4'));
    expect(dividerAt(v.writes, 63)).toBe(c);
    const atStart = dividerAt(v.writes, 64);
    expect(atStart).toBeGreaterThan(g);
    expect(atStart).toBeLessThanOrEqual(c);
    expect(dividerAt(v.writes, 120)).toBe(g);
  });

  it('places voices 2 and 4 half a step after 1 and 3', () => {
    expect(compileVoice('C4q', 1).writes[0].t % 1).toBe(0.5);
    expect(compileVoice('C4q', 2).writes[0].t % 1).toBe(0);
  });
});

describe('the cues', () => {
  it('every cue the game raises is composed', () => {
    const names = new Set<string>();
    for (const [file, text] of Object.entries(GAME_SOURCES)) {
      if (file.endsWith('.test.ts')) continue;
      for (const m of text.matchAll(/type: 'music', cue: '([A-Za-z0-9]+)'/g)) names.add(m[1]);
      const tunes = /TUNES = \[([^\]]*)\]/.exec(text);
      if (tunes) for (const m of tunes[1].matchAll(/'([A-Za-z0-9]+)'/g)) names.add(m[1]);
    }
    expect(names.size).toBeGreaterThanOrEqual(11);
    for (const name of names) expect(MUSIC_CUES[name], name).toBeDefined();
  });

  it('every cue compiles, uses only the music chips, and ends silent on every voice', () => {
    for (const [name, cue] of Object.entries(MUSIC_CUES)) {
      const track = compileCue(cue);
      expect(track.writes.length, name).toBeGreaterThan(0);
      for (const w of track.writes) {
        expect(MUSIC_CHIPS, `${name} chip ${w.chip}`).toContain(w.chip);
        expect([0, 2, 3, 4, 6, 7], `${name} reg ${w.reg}`).toContain(w.reg);
      }
      VOICE_HARDWARE.forEach((hw, i) => {
        const last = track.writes.filter((w) => w.chip === hw.chip && w.reg === hw.ctl).at(-1)!;
        expect(last.value, `${name} voice ${i + 1}`).toBe(0);
      });
    }
  });

  it('the four voices of a cue end together', () => {
    for (const [name, cue] of Object.entries(MUSIC_CUES)) {
      const { voiceLengths } = compileCue(cue);
      const longest = Math.max(...voiceLengths);
      for (const l of voiceLengths) expect(Math.abs(l - longest) / longest, `${name} ${voiceLengths}`).toBeLessThan(0.03);
    }
  });

  it('each cue runs about as long as the original at its cue point', () => {
    for (const [name, seconds] of Object.entries(ORIGINAL_CUE_SECONDS)) {
      const ours = compileCue(MUSIC_CUES[name]).length / STEP_HZ;
      expect(Math.abs(ours - seconds) / seconds, `${name}: ${ours.toFixed(2)}s vs ${seconds}s`).toBeLessThan(0.1);
    }
  });
});
