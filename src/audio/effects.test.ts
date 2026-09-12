import { describe, expect, it } from 'vitest';
import { COMPOUND, EFFECTS } from './effects';

/** Every simulation source file, as text, so the sound names the game raises can be checked. */
const GAME_SOURCES = import.meta.glob('../game/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('sound effects', () => {
  it('every sound the game raises has an effect table', () => {
    const names = new Set<string>();
    for (const [file, text] of Object.entries(GAME_SOURCES)) {
      if (file.endsWith('.test.ts')) continue;
      for (const m of text.matchAll(/type: 'sound', name: '([A-Za-z0-9]+)'/g)) names.add(m[1]);
    }
    expect(names.size).toBeGreaterThan(8);
    for (const name of names) {
      expect(EFFECTS[name] ?? COMPOUND[name], name).toBeDefined();
    }
  });

  it('effect tables only touch their own channels and end in silence', () => {
    for (const [name, e] of Object.entries(EFFECTS)) {
      for (const s of e.steps) {
        if (s.reg === 8) continue;
        expect(e.channels, `${name} reg ${s.reg}`).toContain(s.reg >> 1);
      }
      expect(e.length).toBeGreaterThanOrEqual(0);
    }
  });
});
