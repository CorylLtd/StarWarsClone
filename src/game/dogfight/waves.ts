/**
 * Which aliens appear, where, and with which script, per wave: the original's
 * level lists, wave sets and start spots from src/data/choreography, plus the
 * fire-rate table.
 */
import { LEVEL_LISTS, START_SPOTS, WAVE_SETS } from '../../data/choreography';
import type { Vec } from '../frame';
import type { AlienKind } from '../types';

export interface SpawnEntry {
  kind: AlienKind;
  spot: Vec;
  script: string;
}

export function levelList(name: string): SpawnEntry[] {
  return LEVEL_LISTS[name].map((e) => ({ kind: e.kind, spot: START_SPOTS[e.spot], script: e.script }));
}

/** The level lists for a wave (0 = displayed wave 1). Waves 7+ alternate the last two sets. */
export function waveSet(wave: number): string[] {
  const w = Math.min(wave, 31);
  if (w < WAVE_SETS.length) return WAVE_SETS[w];
  return w % 2 === 0 ? WAVE_SETS[4] : WAVE_SETS[5];
}

/** Fire-rate table by hardness: window mask, probability byte threshold, usable gun slots. */
export const FIRE_TABLE: { mask: number; prob: number; guns: number }[] = [
  { mask: 0x0f, prob: 0x80, guns: 1 },
  { mask: 0x0f, prob: 0x80, guns: 1 },
  { mask: 0x0f, prob: 0x80, guns: 2 },
  { mask: 0x0f, prob: 0x40, guns: 3 },
  { mask: 0x07, prob: 0x80, guns: 4 },
  { mask: 0x07, prob: 0x20, guns: 5 },
  { mask: 0x07, prob: 0x20, guns: 6 },
  { mask: 0x03, prob: 0x80, guns: 6 },
  { mask: 0x03, prob: 0x60, guns: 6 },
  { mask: 0x03, prob: 0x40, guns: 6 },
  { mask: 0x03, prob: 0x30, guns: 6 },
];

export function fireRow(hardness: number): { mask: number; prob: number; guns: number } {
  return FIRE_TABLE[Math.min(hardness, FIRE_TABLE.length - 1)];
}

/** WV.HRD: wave plus difficulty, capped. */
export function hardness(wave: number, difficulty: number): number {
  return Math.min(15, Math.min(wave, 31) + difficulty);
}
