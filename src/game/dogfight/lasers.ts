import { LASER } from '../config';
import { withinOctagon } from '../projection';
import type { GameState, Input } from '../types';
import { hitAlien } from './aliens';
import { hurtFireball } from './guns';

/** Once per frame: a fire press starts an 8-frame bolt; a bolt that has hit freezes for 4 frames. */
export function stepLaserTrigger(state: GameState, input: Input): void {
  const p = state.player;
  if (input.fire && !state.fireHeld) {
    p.laserLeftPair = !p.laserLeftPair;
    p.laserHit = 0;
    p.laserFrames = LASER.boltFrames;
    state.events.push({ type: 'laserFired' });
    state.events.push({ type: 'sound', name: 'laser' });
  }
  state.fireHeld = input.fire;
  tickLaser(state);
}

/** The per-frame part of TSTLAZ without the trigger: a hit freeze counts down, then the bolt's remaining frames. */
export function tickLaser(state: GameState): void {
  const p = state.player;
  if (p.laserHit > 0) {
    p.laserHit -= 1;
    p.laserFrames = 0;
    return;
  }
  if (p.laserFrames > 0) {
    p.laserFrames -= 1;
    p.laserAt = { ...p.cursor };
  }
}

export function laserOn(state: GameState): boolean {
  return state.player.laserFrames > 0 || (state.player.laserHit > 0 && state.player.laserFrames === 0 && false);
}

/**
 * Resolve this frame's bolt against what was drawn: the nearest alien and the
 * nearest live fireball under the cursor. A fireball wins if it is closer.
 * Called after the view has filled in `drawn` and fireball screen positions.
 */
export function resolveLaser(state: GameState): void {
  const p = state.player;
  if (p.laserFrames === 0 && p.laserHit === 0) return;
  if (p.laserHit > 0) return;
  const d = state.dogfight;
  let bestAlien = -1;
  let bestAlienDist = Infinity;
  for (let i = 0; i < d.aliens.length; i++) {
    const a = d.aliens[i];
    if (!a || !a.drawn) continue;
    if (withinOctagon(a.drawn.at, p.laserAt, a.drawn.hitSize, LASER.octagonFactor) && a.drawn.halfDistance < bestAlienDist) {
      bestAlien = i;
      bestAlienDist = a.drawn.halfDistance;
    }
  }
  let bestShot = -1;
  let bestShotDist = Infinity;
  for (let i = 0; i < d.fireballs.length; i++) {
    const fb = d.fireballs[i];
    if (!fb || fb.kind !== 'live' || fb.halfDistance <= 0) continue;
    const size = (512 * 80) / fb.halfDistance + LASER.hitPad;
    if (withinOctagon(fb.at, p.laserAt, size, LASER.octagonFactor) && fb.halfDistance < bestShotDist) {
      bestShot = i;
      bestShotDist = fb.halfDistance;
    }
  }
  if (bestShot >= 0 && bestShotDist < bestAlienDist) {
    hurtFireball(state, bestShot);
    p.laserHit = LASER.hitFreezeFrames;
  } else if (bestAlien >= 0) {
    hitAlien(state, bestAlien, bestAlienDist);
    p.laserHit = LASER.hitFreezeFrames;
  }
}
