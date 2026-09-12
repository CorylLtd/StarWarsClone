import { MAZE_BY_WAVE, MAZES, RANDOM_MAZES, type MazeEntry } from '../../data/surface';
import { LASER, SCORING, SURFACE, VG } from '../config';
import { type Vec, vec } from '../frame';
import { pick } from '../random';
import type { Building, GameState } from '../types';
import { addScore } from '../dogfight/aliens';
import { shieldHit } from '../dogfight/guns';
import { spawnGroundFragments } from './fragments';

/** The maze for a displayed wave: fixed until wave 20, random among the hardest after that. */
export function mazeForWave(state: GameState): readonly MazeEntry[] {
  const displayed = state.wave + 1;
  const name = MAZE_BY_WAVE[displayed] ?? pick(state.rng, RANDOM_MAZES);
  return MAZES[name];
}

export function loadMaze(state: GameState): void {
  const s = state.surface;
  s.buildings = mazeForWave(state).map((e) => ({
    type: e.type,
    pos: vec(e.forward, e.right, 0),
    sequence: e.sequence,
    damaged: false,
    killed: false,
    seen: null,
    flash: 0,
    armed: false,
    firedThisLap: false,
  }));
  s.towersLeft = s.buildings.filter((b) => b.type !== 'bunker').length;
  s.nextTowerPoints = SURFACE.towerPointsStart;
  s.allTowersCleared = false;
}

/** Forward distance to a building, with the maze repeating every lap so it is always ahead. */
export function distanceTo(state: GameState, b: Building): number {
  const d = b.pos.x - state.surface.pos.x;
  return ((d % SURFACE.mapWrap) + SURFACE.mapWrap) % SURFACE.mapWrap;
}

/** A building's offset from the player in the original's frame. */
export function relativeTo(state: GameState, b: Building): Vec {
  const s = state.surface;
  return vec(distanceTo(state, b), b.pos.y - s.pos.y, -s.pos.z);
}

export function isActive(state: GameState, b: Building): boolean {
  return b.sequence <= state.surface.laps && !b.killed && !(b.type === 'bunker' && b.damaged);
}

/** Size factor the original's distance scale applies to a building at a real forward distance. */
export function distanceShrink(distance: number): number {
  return Math.max(1 / 16, 1 - Math.floor(distance / 512) / 64);
}

/**
 * Note which buildings are in sight this frame: awake, between the near and
 * far limits, and inside the 45-degree cone. Buildings out of sight on the
 * final lap are switched off for good.
 */
export function viewBuildings(state: GameState): void {
  const s = state.surface;
  for (const b of s.buildings) {
    b.seen = null;
    if (b.flash > 0) b.flash -= 1;
    if (!isActive(state, b)) continue;
    const d = distanceTo(state, b);
    const lateral = b.pos.y - s.pos.y;
    const inSight = d >= SURFACE.minDistance && d < SURFACE.maxDistance && Math.abs(lateral) < d;
    if (!inSight) {
      if (s.laps >= SURFACE.killAtLap) b.killed = true;
      b.firedThisLap = false;
      continue;
    }
    b.seen = { distance: d, lateral };
  }
}

/** The cursor with the view's bank undone, as the original tested it. */
function unbankedCursor(state: GameState): { x: number; y: number } {
  const c = state.player.cursor;
  const a = -bankRadians(state);
  return { x: c.x * Math.cos(a) - c.y * Math.sin(a), y: c.x * Math.sin(a) + c.y * Math.cos(a) };
}

export function bankRadians(state: GameState): number {
  return (state.surface.bankTics * 360) / 5632 / 180 * Math.PI;
}

/**
 * The laser against the buildings, in un-banked screen space: the cursor
 * must lie within the building's scaled half-width and between its base and
 * top. A tower hat or a bunker is destroyed; a tower body only splashes.
 */
export function resolveGroundLaser(state: GameState): void {
  const p = state.player;
  if (p.laserFrames === 0 || p.laserHit !== 0) return;
  const s = state.surface;
  const cursor = unbankedCursor(state);
  let best: Building | null = null;
  let bestDistance = Infinity;
  let bodyDistance = Infinity;
  for (const b of s.buildings) {
    if (!b.seen || b.damaged) continue;
    const d = b.seen.distance;
    const k = (VG.focal / d) * distanceShrink(d);
    const yt = (VG.focal * b.seen.lateral) / d;
    const zt = (VG.focal * -s.pos.z) / d;
    const tower = b.type !== 'bunker';
    const radius = (tower ? SURFACE.towerRadius : SURFACE.bunkerRadius) * k;
    const height = (tower ? SURFACE.towerHeight : SURFACE.bunkerHeight) * k;
    if (Math.abs(cursor.x - yt) > radius + SURFACE.hitPad) continue;
    const dz = cursor.y - zt;
    if (dz < 0 || dz > height) continue;
    if (tower && cursor.y + SURFACE.hitPad < zt + SURFACE.hatBottom * k) {
      bodyDistance = Math.min(bodyDistance, d);
      continue;
    }
    if (d < bestDistance) {
      best = b;
      bestDistance = d;
    }
  }
  if (best && bestDistance < bodyDistance) {
    best.damaged = true;
    spawnGroundFragments(state, best);
    if (best.type === 'bunker') {
      addScore(state, SCORING.laserBunker);
      state.events.push({ type: 'bunkerHit' });
    } else {
      addScore(state, s.nextTowerPoints);
      state.events.push({ type: 'towerTopHit', points: s.nextTowerPoints });
      s.nextTowerPoints += SURFACE.towerPointsStep;
      s.towersLeft -= 1;
      if (s.towersLeft === 0 && !s.allTowersCleared) {
        s.allTowersCleared = true;
        addScore(state, SURFACE.allTowersBonus);
        state.events.push({ type: 'allTowersCleared' });
      }
    }
    state.events.push({ type: 'sound', name: 'explosion' });
    p.laserHit = LASER.hitFreezeFrames;
  } else if (bodyDistance < Infinity) {
    state.events.push({ type: 'laserSplash' });
    p.laserHit = -1;
  } else if (cursor.y < 0) {
    state.events.push({ type: 'laserSplash' });
  }
}

/**
 * Crashes: any tower in sight closer than 1024 plus twice the speed, at any
 * altitude; a bunker closer than 2048 plus twice the speed when flying below
 * its height. One shield per crash, gated by the gauge window.
 */
export function checkCollisions(state: GameState): void {
  const s = state.surface;
  for (const b of s.buildings) {
    if (!b.seen) continue;
    const tower = b.type !== 'bunker';
    const reach = (tower ? SURFACE.towerCrashBase : SURFACE.bunkerCrashBase) + 2 * s.speed;
    if (b.seen.distance > reach) continue;
    if (!tower && (b.damaged || s.pos.z >= SURFACE.bunkerHeight)) continue;
    if (b.flash > 0) continue;
    b.flash = 4;
    state.events.push({ type: 'collision', with: b.type });
    state.events.push({ type: 'sound', name: 'crash' });
    if (tower) {
      const away = b.seen.lateral > 0 ? -1 : 1;
      if (s.collisionRoll === 0) s.collisionRoll = away * SURFACE.towerCrashRoll;
    } else if (s.collisionRoll === 0) {
      s.collisionRoll = (state.rng.seed & 1 ? 1 : -1) * SURFACE.bunkerCrashRoll;
    }
    shieldHit(state);
  }
}
