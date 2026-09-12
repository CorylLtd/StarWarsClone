import { PIES, WEDGES, WEDGE_ENDS, type WedgeRow } from '../../data/trench';
import { TRENCH } from '../config';
import { pick } from '../random';
import type { GameState, TrenchSlot } from '../types';

/** The 17 wedges the random pie draws from, and the random pie's shape. */
const RANDOM_CANDIDATES = ['03', '06', '09', '15', '14', '16', '18', '20', '24', '25', '26', '30', '32', '35', '36', '37', '55'];
const RANDOM_PIE = ['10', '95', 'XX', '94', 'XX', '97', 'XX', '94', 'XX', '97', 'XX', '94', 'XX', '97', 'XX', '29'];

/** The wedge sequence for a wave: a fixed pie for displayed waves 1 to 11, a random assembly after. */
export function pieForWave(state: GameState): string[] {
  const displayed = Math.min(state.wave, 31) + 1;
  const fixed = PIES[`PIE${displayed}`];
  if (fixed) return [...fixed];
  return RANDOM_PIE.map((w) => (w === 'XX' ? pick(state.rng, RANDOM_CANDIDATES) : w));
}

export function slotIndex(x: number): number {
  return Math.floor(x / TRENCH.slotLength) & (TRENCH.ringSlots - 1);
}

export function emptySlot(): TrenchSlot {
  return { left: [0, 0, 0, 0], right: [0, 0, 0, 0], catwalkCue: 0, catwalkLum: 0, struck: 0 };
}

/** Reset the rings and pre-generate the first rows of the pie. */
export function resetLayout(state: GameState, keepPie: boolean): void {
  const t = state.trench;
  if (!keepPie) t.pie = pieForWave(state);
  t.wedgeIndex = 0;
  t.rowIndex = 0;
  t.farX = 0;
  t.nearX = 0;
  t.rowStarts = [];
  t.slots = Array.from({ length: TRENCH.ringSlots }, emptySlot);
  t.portX = null;
  t.endX = null;
  t.cueIndex = 0;
  t.cueIndexPassed = 0;
  for (let i = 0; i < 9; i++) generateRow(state);
}

/** Append the next row of the pie at farX, writing its panel codes into the ring. Returns false at the end. */
export function generateRow(state: GameState): boolean {
  const t = state.trench;
  if (t.endX !== null) return false;
  const wedgeName = t.pie[t.wedgeIndex];
  if (wedgeName === undefined) return false;
  const rows: readonly WedgeRow[] = WEDGES[wedgeName] ?? [];
  if (t.rowIndex >= rows.length) {
    const end = WEDGE_ENDS[wedgeName] as { type?: string } | undefined;
    if (end?.type === 'port' || end?.type === 'end' || t.wedgeIndex === t.pie.length - 1) {
      // The last wedge ends with the port row then the end wall.
      t.portX = t.farX;
      t.rowStarts.push(t.farX);
      t.farX += TRENCH.portToEnd;
      t.endX = t.farX;
      if (t.force === 0) earnForce(state);
      return false;
    }
    t.wedgeIndex += 1;
    t.rowIndex = 0;
    return generateRow(state);
  }
  const row = rows[t.rowIndex];
  t.rowIndex += 1;
  const slot = t.slots[slotIndex(t.farX)];
  slot.left = [...row.left];
  slot.right = [...row.right];
  slot.struck = 0;
  if (row.left.includes(2) || row.right.includes(2)) {
    slot.catwalkCue = t.cueIndex;
    t.cueIndex += 1;
  }
  t.rowStarts.push(t.farX);
  t.farX += row.length;
  return true;
}

/** Keep rows generated while the far end lies within the generation distance; clear slots the player has left. */
export function stepLayout(state: GameState): void {
  const t = state.trench;
  while (t.endX === null && t.farX - t.pos.x <= TRENCH.generateAhead) {
    if (!generateRow(state)) break;
  }
  const current = slotIndex(t.pos.x);
  if (current !== t.lastSlot) {
    const left = t.slots[t.lastSlot];
    if (left.left.includes(2) || left.right.includes(2)) t.cueIndexPassed += 1;
    left.left = [0, 0, 0, 0];
    left.right = [0, 0, 0, 0];
    t.lastSlot = current;
  }
  t.rowStarts = t.rowStarts.filter((x) => x + TRENCH.slotLength * 2 >= t.pos.x);
}

function earnForce(state: GameState): void {
  const t = state.trench;
  t.force = 1;
  const bonus = TRENCH.forceBonus[Math.min(state.wave, TRENCH.forceBonus.length - 1)];
  t.forceBonus = bonus;
  state.score += bonus;
  state.lastScore = bonus;
  state.lastScoreFade = 255;
  if (state.score > state.highScore) state.highScore = state.score;
  state.events.push({ type: 'forceBonus', points: bonus });
}
