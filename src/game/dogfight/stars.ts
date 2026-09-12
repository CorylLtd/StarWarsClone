import { STARS } from '../config';
import { toView, toWorld, type Vec, vec } from '../frame';
import { inCone } from '../projection';
import { nextFloat, type Rng } from '../random';
import type { GameState, Star } from '../types';

/** A fresh star somewhere ahead of the viewer, in the viewer's frame; the sign of y/z is chosen by the caller. */
function freshViewPos(rng: Rng, ySign: number, zSign: number): Vec {
  const x = 2 * (Math.floor(nextFloat(rng) * 32) * 256 + Math.floor(nextFloat(rng) * 256));
  const y = 2 * Math.floor(nextFloat(rng) * 32) * Math.floor(nextFloat(rng) * 256) * ySign;
  const z = 2 * Math.floor(nextFloat(rng) * 32) * Math.floor(nextFloat(rng) * 256) * zSign;
  return vec(Math.max(x, STARS.minHalfDistance * 2 + 1), y, z);
}

export function initStars(state: GameState): void {
  const p = state.player.basis;
  state.dogfight.stars = [];
  for (let i = 0; i < STARS.count; i++) {
    const sign = (): number => (nextFloat(state.rng) < 0.5 ? -1 : 1);
    state.dogfight.stars.push({ pos: toWorld(p, freshViewPos(state.rng, sign(), sign())) });
  }
}

/** The viewer drifts along +X for parallax; a star that leaves the visible shell is reborn on the opposite side. */
export function stepStars(state: GameState): void {
  const p = state.player.basis;
  const drift = vec(state.dogfight.frame * STARS.driftPerFrame, 0, 0);
  for (const star of state.dogfight.stars) {
    const view = toView(p, { x: star.pos.x - drift.x, y: star.pos.y, z: star.pos.z });
    const half = view.x / 2;
    if (half > STARS.minHalfDistance && half <= STARS.maxHalfDistance && inCone(view)) continue;
    const fresh = freshViewPos(state.rng, view.y >= 0 ? -1 : 1, view.z >= 0 ? -1 : 1);
    const w = toWorld(p, fresh);
    star.pos = vec(w.x + drift.x, w.y, w.z);
  }
}

/** Screen-space positions of the visible stars for the renderer, VG units without the offset. */
export function visibleStars(state: GameState): { x: number; y: number }[] {
  const p = state.player.basis;
  const driftX = state.dogfight.frame * STARS.driftPerFrame;
  const out: { x: number; y: number }[] = [];
  for (const star of state.dogfight.stars) {
    const view = toView(p, { x: star.pos.x - driftX, y: star.pos.y, z: star.pos.z });
    const half = view.x / 2;
    if (half > STARS.minHalfDistance && half <= STARS.maxHalfDistance && inCone(view)) {
      out.push({ x: (512 * view.y) / view.x, y: (512 * view.z) / view.x });
    }
  }
  return out;
}

export type { Star };
