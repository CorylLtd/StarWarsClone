import { CURSOR } from './config';
import { clamp } from './math';
import type { Input, Player } from './types';

/**
 * Yoke to cursor, run every vector-generator field as the original's
 * interrupt did: the yoke deflection becomes a target in pot units, clamped to
 * the cursor box, and the cursor slews toward it by a fraction of the
 * remaining distance each field (a larger fraction when far), never
 * overshooting and always moving at least one unit.
 */
export function stepCursor(player: Player, input: Input): void {
  const tx = clamp(Math.round(input.x * 127), CURSOR.potLeft, CURSOR.potRight);
  const ty = clamp(Math.round(input.y * 127), CURSOR.potBottom, CURSOR.potTop);
  player.cursorTarget.x = tx;
  player.cursorTarget.y = ty;
  player.cursorPot.x = slew(player.cursorPot.x, tx);
  player.cursorPot.y = slew(player.cursorPot.y, ty);
  player.cursor.x = Math.round(player.cursorPot.x) * CURSOR.potToScreen;
  player.cursor.y = Math.round(player.cursorPot.y) * CURSOR.potToScreen;
}

function slew(pos: number, target: number): number {
  const delta = target - pos;
  const dist = Math.abs(delta);
  if (dist === 0) return pos;
  const fraction = dist >= CURSOR.slewFarFrom ? CURSOR.slewFar : CURSOR.slewNear;
  const move = Math.max(1, dist * fraction);
  return move >= dist ? target : pos + Math.sign(delta) * move;
}

/** How far the yoke shifts the drawn hood and gun tips, VG units, from the slewed cursor position. */
export function hoodShift(player: Player): { x: number; y: number } {
  return {
    x: (player.cursorPot.x / 127) * CURSOR.hoodShiftX,
    y: (player.cursorPot.y / 127) * CURSOR.hoodShiftY,
  };
}
