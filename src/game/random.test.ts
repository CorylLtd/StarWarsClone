import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, range } from './random';

describe('random', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b));
  });

  it('stays within range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = range(rng, -3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(3);
    }
  });
});
