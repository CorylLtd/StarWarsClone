import { STARS } from '../config';
import { add, scale, sub, toView, toWorld, type Vec, vec } from '../frame';
import { inCone } from '../projection';
import { nextFloat, type Rng } from '../random';
import type { AttractPhase, GameState, Star } from '../types';

/** How the viewer moves behind each attract screen, in body axes (WSMAIN.MAC SMVHIS, SMVBNR, SMVINS,
 * SMVSCR): forward for the high scores, forward and up behind the banner, sideways for the
 * instructions (the viewer slides left, so the stars cross left to right), up for the scoring page. */
const ATTRACT_DRIFT: Record<AttractPhase, Vec> = {
  highScores: vec(1, 0, 0),
  banner: vec(1, 0, 1),
  instructions: vec(0, -1, 0),
  scoring: vec(0, 0, 1),
};

/** Where the viewer has drifted to, in universe units: 0x80 per frame on each moving axis. The dogfight
 * slides along universe +X; the attract screens move relative to their fixed view. */
function driftWorld(state: GameState): Vec {
  const n = state.dogfight.frame * STARS.driftPerFrame;
  if (state.mode === 'attract') return scale(toWorld(state.player.basis, ATTRACT_DRIFT[state.attract.phase]), n);
  return vec(n, 0, 0);
}

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
  const drift = driftWorld(state);
  for (const star of state.dogfight.stars) {
    const view = toView(p, sub(star.pos, drift));
    const half = view.x / 2;
    if (half > STARS.minHalfDistance && half <= STARS.maxHalfDistance && inCone(view)) continue;
    const fresh = freshViewPos(state.rng, view.y >= 0 ? -1 : 1, view.z >= 0 ? -1 : 1);
    star.pos = add(toWorld(p, fresh), drift);
  }
}

/** Screen-space positions of the visible stars for the renderer, VG units without the offset. */
export function visibleStars(state: GameState): { index: number; x: number; y: number }[] {
  const p = state.player.basis;
  const drift = driftWorld(state);
  const out: { index: number; x: number; y: number }[] = [];
  state.dogfight.stars.forEach((star, index) => {
    const view = toView(p, sub(star.pos, drift));
    const half = view.x / 2;
    if (half > STARS.minHalfDistance && half <= STARS.maxHalfDistance && inCone(view)) {
      out.push({ index, x: (512 * view.y) / view.x, y: (512 * view.z) / view.x });
    }
  });
  return out;
}

export type { Star };
