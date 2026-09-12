import { SURFACE } from '../config';
import { toView, vec } from '../frame';
import { inCone } from '../projection';
import { nextFloat } from '../random';
import type { GameState } from '../types';

/** Fifty green dots on the ground plane, seeded anywhere and reborn ahead of the player as they pass out of view. */
export function initDots(state: GameState): void {
  const s = state.surface;
  s.dots = [];
  for (let i = 0; i < SURFACE.dotCount; i++) {
    s.dots.push(vec(Math.floor(nextFloat(state.rng) * 65536) - 32768, Math.floor(nextFloat(state.rng) * 65536) - 32768, 0));
  }
}

export function stepDots(state: GameState): void {
  const s = state.surface;
  const p = state.player.basis;
  for (const d of s.dots) {
    const view = toView(p, vec(d.x - s.pos.x, d.y - s.pos.y, -s.pos.z));
    if (view.x > 0x100 && inCone(view)) continue;
    const ahead = SURFACE.dotAheadMin + Math.floor(nextFloat(state.rng) * (SURFACE.dotAheadMax - SURFACE.dotAheadMin));
    const side = Math.floor(nextFloat(state.rng) * 0x8000) * (view.y >= 0 ? -1 : 1);
    d.x = s.pos.x + ahead;
    d.y = s.pos.y + side;
    d.z = 0;
  }
}
