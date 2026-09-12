import { CURSOR, FIREBALL, SCORING, SURFACE } from '../config';
import { vec } from '../frame';
import { nextFloat } from '../random';
import { projectRelative } from '../projection';
import type { Fireball, FireballMover, GameState } from '../types';
import { fireballImpact, hurtFireball } from '../dogfight/guns';
import { addScore } from '../dogfight/aliens';
import { hardness } from '../dogfight/waves';

function usableSlots(state: GameState): number {
  const h = Math.min(hardness(state.wave, state.difficulty), 11);
  return SURFACE.gunSlotsByHardness[h];
}

function freeSlot(state: GameState): number {
  const n = usableSlots(state);
  for (let i = 0; i < n; i++) if (state.dogfight.fireballs[i] === null) return i;
  return -1;
}

function launch(state: GameState, slot: number, mover: FireballMover, pos: { x: number; y: number; z: number }): void {
  const fb: Fireball = { kind: 'live', mover, pos: { ...pos }, timer: SURFACE.shotFrames, at: { x: 0, y: 0 }, halfDistance: 0, impacting: false };
  state.dogfight.fireballs[slot] = fb;
  state.events.push({ type: 'alienFired' });
  state.events.push({ type: 'sound', name: 'groundShot' });
}

/** Towers fire once per lap as their scaled top crosses the player's altitude; bunkers by a distance-based chance. */
export function stepGroundGuns(state: GameState): void {
  const s = state.surface;
  if (s.laps >= SURFACE.killAtLap || state.shields < 0) return;
  for (const b of s.buildings) {
    if (!b.seen || b.damaged) continue;
    const d = b.seen.distance;
    const halfHi = Math.floor(d / 2 / 256);
    if (b.type === 'bunker') {
      const chance = (64 - halfHi) / 256;
      if (nextFloat(state.rng) >= chance) continue;
      const slot = freeSlot(state);
      if (slot < 0) continue;
      const toRight = b.pos.y > s.pos.y;
      launch(state, slot, toRight ? 'bunkerRight' : 'bunkerLeft', vec(s.pos.x + d, b.pos.y, 512));
      continue;
    }
    if (b.firedThisLap) continue;
    const f = (2 * (0x4000 - d / 2)) / 0x4000;
    const top = SURFACE.towerTopForArming * f;
    const hat = SURFACE.hatForArming * f;
    const crossing = top - s.pos.z >= 0 && top - s.pos.z <= hat;
    if (!crossing && top < s.pos.z) {
      b.armed = true;
      continue;
    }
    if (!crossing && !(b.armed && top > s.pos.z)) continue;
    b.armed = false;
    b.firedThisLap = true;
    const movers: FireballMover[] = [];
    if (b.type === 'tower' && nextFloat(state.rng) < 0.5) movers.push('towerForward');
    if (nextFloat(state.rng) < 0.5) movers.push('towerRight');
    if (nextFloat(state.rng) < 0.5) movers.push('towerLeft');
    for (const m of movers) {
      const slot = freeSlot(state);
      if (slot < 0) break;
      launch(state, slot, m, vec(s.pos.x + d, b.pos.y, s.pos.z));
    }
  }
}

/** Move the ground shots in universe coordinates: tower shots straight, bunker shots creeping and rising toward the player. */
export function stepGroundShots(state: GameState): void {
  const s = state.surface;
  const g = state.dogfight.fireballs;
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (!fb || fb.kind !== 'live') continue;
    switch (fb.mover) {
      case 'towerForward':
        fb.pos.x -= SURFACE.shotSpeed;
        break;
      case 'towerLeft':
        fb.pos.x -= SURFACE.shotSpeed;
        fb.pos.y -= SURFACE.shotSpeed;
        break;
      case 'towerRight':
        fb.pos.x -= SURFACE.shotSpeed;
        fb.pos.y += SURFACE.shotSpeed;
        break;
      case 'bunkerLeft':
      case 'bunkerRight': {
        fb.pos.x -= 4 * (Math.floor(fb.pos.x / 256) - Math.floor(s.pos.x / 256));
        const preferred = s.pos.y + (fb.mover === 'bunkerRight' ? 256 : -256);
        const dy = preferred - fb.pos.y;
        const towardPreferred = (fb.mover === 'bunkerRight') === dy > 0;
        const gain = towardPreferred ? 1 / 8 : 1 / 32;
        fb.pos.y += Math.max(-384, Math.min(384, dy * gain)) + (s.vel.y * 7) / 8;
        const dz = s.pos.z + 256 - fb.pos.z;
        if (dz > 0) fb.pos.z += Math.min(512, dz / 8);
        break;
      }
      default:
        break;
    }
  }
}

/** Project the ground shots relative to the player; judge impacts and laser hits like the dogfight. */
export function viewGroundShots(state: GameState, lasersOn: boolean): void {
  const s = state.surface;
  const p = state.player;
  const g = state.dogfight.fireballs;
  let bestShot = -1;
  let bestDist = Infinity;
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (!fb || fb.kind !== 'live') continue;
    const rel = vec(fb.pos.x - s.pos.x, fb.pos.y - s.pos.y, fb.pos.z - s.pos.z);
    const proj = projectRelative(rel, p.basis);
    if (!proj) {
      g[i] = null;
      continue;
    }
    fb.at = proj.at;
    fb.halfDistance = proj.view.x / 2;
    if (lasersOn) {
      const size = (512 * 80) / Math.max(1, fb.halfDistance) + 10;
      const dx = Math.abs(fb.at.x - p.laserAt.x);
      const dy = Math.abs(fb.at.y - p.laserAt.y);
      if (dx <= size && dy <= size && dx + dy <= 1.5 * size && fb.halfDistance < bestDist) {
        bestShot = i;
        bestDist = fb.halfDistance;
      }
    }
    const reach = Math.max(s.speed, 512) + SURFACE.impactPad;
    const inBox =
      proj.at.x >= CURSOR.potLeft * CURSOR.potToScreen &&
      proj.at.x <= CURSOR.potRight * CURSOR.potToScreen &&
      proj.at.y >= CURSOR.potBottom * CURSOR.potToScreen &&
      proj.at.y <= CURSOR.potTop * CURSOR.potToScreen;
    fb.impacting = proj.view.x <= reach && inBox;
  }
  if (bestShot >= 0) {
    hurtFireball(state, bestShot);
    p.laserHit = 4;
    g[bestShot]!.impacting = false;
  }
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (fb && fb.kind === 'live' && fb.impacting) {
      fb.impacting = false;
      fireballImpact(state, i);
    }
  }
  void FIREBALL;
  void SCORING;
  void addScore;
}
