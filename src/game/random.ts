/** Deterministic mulberry32 generator so game logic is reproducible in tests. */
export interface Rng {
  seed: number;
}

export function createRng(seed: number): Rng {
  return { seed: seed >>> 0 };
}

/** Uniform float in [0, 1). */
export function nextFloat(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) >>> 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(nextFloat(rng) * items.length)];
}
