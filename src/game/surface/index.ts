import { AIM, SURFACE } from '../config';
import { DEG, identityBasis, roll } from '../frame';
import { clamp } from '../math';
import { stepFireballs } from '../dogfight/guns';
import { stepLaserTrigger } from '../dogfight/lasers';
import type { GameState, Input } from '../types';
import { bankRadians, checkCollisions, loadMaze, resolveGroundLaser, viewBuildings } from './buildings';
import { initDots, stepDots } from './dots';
import { stepGroundFragments } from './fragments';
import { stepGroundGuns, stepGroundShots, viewGroundShots } from './groundGuns';

/** The Surface begins: level at the map origin, high up and slow, with the wave's maze laid out. */
export function enterSurface(state: GameState): void {
  const s = state.surface;
  s.frame = 0;
  s.phase = 'flying';
  s.pos.x = SURFACE.startX;
  s.pos.y = 0;
  s.pos.z = SURFACE.startAltitude;
  s.speed = SURFACE.speedStart;
  s.vel.x = s.vel.y = s.vel.z = 0;
  s.laps = 0;
  s.bankTics = 0;
  s.collisionRoll = 0;
  s.transitionRoll = 0;
  s.fragments = [];
  s.gunsKilled = false;
  state.player.basis = identityBasis();
  state.player.rollFrames = 0;
  state.dogfight.fireballs = [null, null, null, null, null, null];
  loadMaze(state);
  initDots(state);
  state.events.push({ type: 'music', cue: 'fourths' });
}

/** Rebuild the view basis from the bank and any transition roll. */
function applyBank(state: GameState): void {
  const p = state.player;
  p.basis = identityBasis();
  roll(p.basis, bankRadians(state) + state.surface.transitionRoll);
}

/** One game frame over the surface. Returns true when the trench should begin. */
export function stepSurfaceFrame(state: GameState, input: Input): boolean {
  const s = state.surface;
  const p = state.player;
  switch (s.phase) {
    case 'flying':
      return stepFlying(state, input);
    case 'dropping':
    case 'descending':
      return stepTransition(state);
  }
  void p;
}

function stepFlying(state: GameState, input: Input): boolean {
  const s = state.surface;
  const p = state.player;
  stepLaserTrigger(state, input);
  viewBuildings(state);
  viewGroundShots(state, p.laserFrames > 0 && p.laserHit === 0);
  resolveGroundLaser(state);
  if (state.shields < 0) return false;
  checkCollisions(state);
  stepGroundShots(state);
  stepFireballs(state);
  stepGroundFragments(state);
  if (p.gaugeFrames > 0) p.gaugeFrames -= 1;
  if (p.flashFrames > 0) p.flashFrames -= 1;
  stepGroundGuns(state);

  // Bank toward the yoke plus the collision kick, slewing a few tics a frame.
  const target = SURFACE.bankTicsPerPot * p.cursorPot.x + SURFACE.bankTicsPerRoll * s.collisionRoll;
  const slew = s.collisionRoll !== 0 ? SURFACE.bankSlewTicsHit : SURFACE.bankSlewTics;
  s.bankTics += clamp(target - s.bankTics, -slew, slew);
  if (s.collisionRoll > 0) s.collisionRoll -= 1;
  else if (s.collisionRoll < 0) s.collisionRoll += 1;
  applyBank(state);

  // Move: forward at a ramping speed, sideways and vertically from the yoke, altitude clamped.
  s.vel.y = (s.speed * Math.abs(p.cursorPot.x) * SURFACE.lateralGain) * Math.sign(p.cursorPot.x);
  s.vel.z = (s.speed * Math.abs(p.cursorPot.y) * SURFACE.verticalGain) * Math.sign(p.cursorPot.y);
  s.pos.x += s.speed;
  if (s.pos.x > 32767) {
    s.pos.x -= 65536;
    s.laps += 1;
    for (const b of s.buildings) b.firedThisLap = false;
  }
  s.pos.y += s.vel.y;
  s.pos.z = clamp(s.pos.z + s.vel.z, SURFACE.minAltitude, SURFACE.maxAltitude);
  s.speed = Math.min(SURFACE.speedMax, s.speed + SURFACE.speedRamp);
  stepDots(state);
  s.frame += 1;
  if (s.frame === SURFACE.rebelThemeFrame) state.events.push({ type: 'music', cue: 'rebel' });
  if (s.laps >= SURFACE.killAtLap) {
    s.gunsKilled = true;
    if (s.pos.x >= 0) {
      s.phase = 'dropping';
      s.frame = 0;
      s.laps = SURFACE.killAtLap;
      state.dogfight.fireballs = [null, null, null, null, null, null];
      state.events.push({ type: 'speech', line: 'USE THE FORCE, LUKE' });
    }
  }
  return false;
}

/** The trench transition: roll a full turn over 34 frames while dropping to the trench floor. */
function stepTransition(state: GameState): boolean {
  const s = state.surface;
  const dir = state.wave % 2 === 1 ? 1 : -1;
  s.transitionRoll += dir * SURFACE.transitionRollDeg * DEG;
  s.bankTics += clamp(-s.bankTics, -SURFACE.bankSlewTics, SURFACE.bankSlewTics);
  s.speed += (SURFACE.transitionSpeed - s.speed) / 8;
  s.pos.x += s.speed;
  if (s.phase === 'dropping') {
    if (s.pos.z > SURFACE.transitionDropTo) s.pos.z = Math.max(SURFACE.transitionDropTo, s.pos.z - SURFACE.transitionDropRate);
  } else if (s.pos.z > SURFACE.trenchDropTo) {
    s.pos.z = Math.max(SURFACE.trenchDropTo, s.pos.z - SURFACE.trenchDropRate);
  }
  applyBank(state);
  stepGroundFragments(state);
  stepDots(state);
  s.frame += 1;
  if (s.frame >= SURFACE.transitionFrames) {
    if (s.phase === 'dropping') {
      s.phase = 'descending';
      s.frame = 0;
      s.pos.x = 0;
      s.pos.y = 0;
      return false;
    }
    return true;
  }
  return false;
}

export { AIM };
