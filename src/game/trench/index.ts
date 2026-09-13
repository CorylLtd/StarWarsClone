import { OPTIONS, SCORING, SHIELDS, TRENCH } from '../config';
import { identityBasis, reversedBasis } from '../frame';
import { clamp } from '../math';
import { stepFireballs } from '../dogfight/guns';
import { stepLaserTrigger } from '../dogfight/lasers';
import { initStars, stepStars } from '../dogfight/stars';
import type { GameState, Input } from '../types';
import { checkCatwalks, resolveTrenchLaser, stepTorpedo, stepWallGuns, stepWallShots, viewWallShots } from './combat';
import { resetLayout, stepLayout } from './layout';

/** Enter the trench: from the surface the dive has already placed the ship low; from space or after a miss it starts high. */
export function enterTrench(state: GameState, fromSurface: boolean, repeat = false): void {
  const t = state.trench;
  t.phase = 'flying';
  t.frame = 0;
  t.pos.x = 0;
  t.pos.y = 0;
  t.pos.z = fromSurface && !repeat ? TRENCH.entryFromSurfaceZ : TRENCH.entryFromSpaceZ;
  t.vel.x = t.vel.y = t.vel.z = 0;
  t.torpedo = null;
  t.torpedoFired = false;
  t.force = repeat ? -1 : 0;
  if (!repeat) {
    t.forceBonus = 0;
    t.repeat = 0;
  }
  t.missedFrames = repeat ? 4 * TRENCH.pseudoSecondFrames : 0;
  t.lastSlot = 0;
  state.player.basis = identityBasis();
  state.player.rollFrames = 0;
  state.dogfight.fireballs = [null, null, null, null, null, null];
  resetLayout(state, repeat);
  // The original speaks the line once, when the transition into the trench begins: the surface
  // stage queues it as the drop starts, so only the space-to-trench entry queues it here.
  if (!repeat && !fromSurface) state.events.push({ type: 'speech', line: 'USE THE FORCE, LUKE' });
}

/** One game frame of the trench and what follows it. Returns true when the next wave should begin. */
export function stepTrenchFrame(state: GameState, input: Input): boolean {
  const t = state.trench;
  switch (t.phase) {
    case 'flying':
      return stepFlying(state, input);
    case 'explosion1':
      return stepExplosion1(state);
    case 'explosion3':
      return stepExplosion3(state);
    case 'next':
      return stepNext(state);
  }
}

function stepFlying(state: GameState, input: Input): boolean {
  const t = state.trench;
  const p = state.player;
  stepLaserTrigger(state, input);
  const lasersOn = p.laserFrames > 0 && p.laserHit === 0;
  const shotHit = viewWallShots(state, lasersOn);
  if (lasersOn && !shotHit) resolveTrenchLaser(state);
  if (state.shields < 0) return false;
  stepWallShots(state);
  stepFireballs(state);
  stepTorpedo(state);
  stepWallGuns(state);
  if (p.gaugeFrames > 0) p.gaugeFrames -= 1;
  if (p.flashFrames > 0) p.flashFrames -= 1;
  if (t.missedFrames > 0) t.missedFrames -= 1;
  for (const slot of t.slots) if (slot.struck > 0) slot.struck -= 1;

  // Move: constant speed forward, the yoke sideways and vertically, clamped inside the trench.
  t.vel.y = TRENCH.speed * Math.abs(p.cursorPot.x) * TRENCH.lateralGain * Math.sign(p.cursorPot.x);
  t.vel.z = TRENCH.speed * Math.abs(p.cursorPot.y) * TRENCH.verticalGain * Math.sign(p.cursorPot.y);
  t.pos.x += TRENCH.speed;
  t.pos.y = clamp(t.pos.y + t.vel.y, -TRENCH.playerMaxY, TRENCH.playerMaxY);
  t.pos.z = clamp(t.pos.z + t.vel.z, TRENCH.playerMinZ, TRENCH.playerMaxZ);
  stepLayout(state);
  checkCatwalks(state);
  t.frame += 1;

  const tim = Math.floor(t.frame / TRENCH.pseudoSecondFrames);
  if (t.frame % TRENCH.pseudoSecondFrames === 0) {
    if (tim === 2) state.events.push({ type: 'music', cue: 'rebelRepeats' });
    const even = state.wave % 2 === 0;
    if (tim === 16) state.events.push({ type: 'speech', line: even ? 'LUKE, TRUST ME' : 'LET GO, LUKE' });
    if (even && tim === 24) state.events.push({ type: 'speech', line: "YAHOO, YOU'RE ALL CLEAR KID" });
    if (!even && tim === 22) state.events.push({ type: 'speech', line: 'THE FORCE IS STRONG WITH THIS ONE' });
  }

  if (t.endX !== null && t.endX - t.pos.x <= TRENCH.endReach) {
    if (t.torpedoFired) {
      t.phase = 'explosion1';
      t.frame = 0;
      t.dxScale = TRENCH.dx1ScaleStart;
      t.dxStep = TRENCH.dx1StepStart;
      state.player.basis = identityBasis();
      state.events.push({ type: 'music', cue: 'end' });
      if (state.wave >= 3 && state.wave % 2 === 1) state.events.push({ type: 'speech', line: 'GREAT SHOT KID, THAT WAS ONE IN A MILLION' });
      return false;
    }
    // Missed: bash the end wall, lose a shield, and fly the same trench again, harder.
    state.events.push({ type: 'portMissed' });
    state.events.push({ type: 'sound', name: 'crash' });
    const old = state.shields;
    state.player.gaugeFrames = 0;
    if (old <= 0) {
      state.shields = -1;
      return false;
    }
    state.shields = old - 1;
    state.player.gaugeFrames = 10 + old;
    state.events.push({ type: 'shieldLost', remaining: state.shields });
    state.events.push({ type: 'speech', line: 'R2 NO' });
    t.repeat += 1; // each pass adds GM.BMP to this trench's hardness only (trenchHardness)
    enterTrench(state, false, true);
  }
  return false;
}

/** The Death Star shrinks away as the ship pulls out, then the burst begins. */
function stepExplosion1(state: GameState): boolean {
  const t = state.trench;
  t.frame += 1;
  t.dxScale += t.dxStep >> 4;
  t.dxStep = Math.max(0, t.dxStep - 1);
  if (t.dxScale >= TRENCH.dx1ScaleEnd) {
    t.phase = 'explosion3';
    t.frame = 0;
    t.burstPhase = 0;
    t.burstCount = 1;
    state.events.push({ type: 'sound', name: 'deathStar' });
  }
  return false;
}

/** Four phases of circles and rings, then the next-wave accounting. */
function stepExplosion3(state: GameState): boolean {
  const t = state.trench;
  t.frame += 1;
  switch (t.burstPhase) {
    case 0:
      t.burstCount += 2;
      if (t.burstCount >= 0x3f) {
        t.burstPhase = 1;
        t.burstCount = 1;
        state.events.push({ type: 'sound', name: 'deathStar' });
      }
      break;
    case 1:
      t.burstCount += 2;
      if (t.burstCount >= 0x3f) {
        t.burstPhase = 2;
        t.burstCount = 1;
        state.events.push({ type: 'sound', name: 'deathStar' });
      }
      break;
    case 2:
      t.burstCount += 3;
      if (t.burstCount >= 0x50) {
        t.burstPhase = 3;
        t.burstCount = 0x80;
      }
      break;
    default:
      t.burstCount -= 4;
      if (t.burstCount < 8) {
        t.phase = 'next';
        t.frame = 0;
        t.nextTim = TRENCH.nextStartTim;
        t.shieldsAdded = 0;
        state.player.basis = reversedBasis();
        initStars(state);
        state.events.push({ type: 'deathStarDestroyed' });
      }
      break;
  }
  return false;
}

/** Next-wave accounting on a 16-frame clock: the port, shields, bonus shields, the selection bonus, then the bump. */
function stepNext(state: GameState): boolean {
  const t = state.trench;
  t.frame += 1;
  state.dogfight.frame += 1;
  stepStars(state);
  if (t.frame % TRENCH.pseudoSecondFrames !== 0) return false;
  t.nextTim -= 1;
  switch (t.nextTim) {
    case 3:
      addPoints(state, SCORING.exhaustPort);
      break;
    case 2:
      addPoints(state, Math.max(0, state.shields) * SHIELDS.endOfWaveBonusPerShield);
      break;
    case 1: {
      const before = state.shields;
      state.shields = Math.min(OPTIONS.startingShields, state.shields + OPTIONS.bonusShieldsPerDeathStar);
      t.shieldsAdded = state.shields - before;
      break;
    }
    case 0:
      if (state.firstWave) addPoints(state, SCORING.waveSelectBonus[state.wave] ?? 0);
      break;
    case -2:
      return true;
    default:
      break;
  }
  return false;
}

function addPoints(state: GameState, points: number): void {
  if (points <= 0) return;
  state.score += points;
  state.lastScore = points;
  state.lastScoreFade = 255;
  if (state.score > state.highScore) state.highScore = state.score;
}
