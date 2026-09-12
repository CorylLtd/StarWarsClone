import { DARTH, DOGFIGHT, SCORING } from '../config';
import { add, cloneBasis, DEG, dot, length, pitch, reversedBasis, roll, scale, toView, type Vec, vec, yaw } from '../frame';
import { clamp } from '../math';
import { nextFloat } from '../random';
import type { Alien, AlienStatus, GameState } from '../types';
import { spawnExplosion } from './explosions';
import { fireFireball, freeGunSlots } from './guns';
import { F, startScript, statusBits, stepScript } from './scripts';
import { fireRow, hardness, levelList, type SpawnEntry, waveSet } from './waves';

const TURN = DOGFIGHT.turnDeg * DEG;

export function emptyStatus(): AlienStatus {
  return {
    hit: false,
    playerInSights: false,
    playerAhead: false,
    random1: false,
    random2: false,
    fired: false,
    playerNear: false,
    playerAimingAtMe: false,
    inView: false,
    playerMid: false,
  };
}

export function makeAlien(entry: SpawnEntry): Alien {
  return {
    kind: entry.kind,
    pos: { ...entry.spot },
    basis: reversedBasis(),
    vel: vec(0, 0, 0),
    hitsLeft: entry.kind === 'darth' ? DARTH.hitPoints : 1,
    glow: 0,
    rollFrames: 0,
    status: emptyStatus(),
    script: startScript(entry.script),
    drawn: null,
    damage: 0,
  };
}

/** Put the next alien of the wave's level lists into the first free slot, if any. */
export function spawnNextAlien(state: GameState): boolean {
  const d = state.dogfight;
  const slot = d.aliens.indexOf(null);
  if (slot < 0) return false;
  const set = waveSet(state.wave);
  let list = levelList(set[Math.min(d.level, set.length - 1)]);
  if (d.listIndex >= list.length) {
    d.level = Math.min(d.level + 1, set.length - 1);
    d.listIndex = 0;
    list = levelList(set[d.level]);
  }
  const entry = list[d.listIndex];
  d.listIndex += 1;
  d.aliens[slot] = makeAlien(entry);
  d.liveCount += 1;
  return true;
}

/** One frame of thinking, turning, moving and shooting for every alien (the original's CPU). */
export function stepAliens(state: GameState): void {
  const d = state.dogfight;
  for (let slot = 0; slot < d.aliens.length; slot++) {
    const a = d.aliens[slot];
    if (!a) continue;
    stepAlien(state, a, slot);
  }
}

function stepAlien(state: GameState, a: Alien, slot: number): void {
  const st = a.status;
  // Everything but inView is recomputed each frame.
  st.hit = false;
  st.fired = false;
  st.random1 = nextFloat(state.rng) < 0.5;
  st.random2 = nextFloat(state.rng) < 0.5;
  // The player, seen from the alien.
  const rel = toView(a.basis, scale(a.pos, -1));
  const dist = length(a.pos);
  st.playerAhead = rel.x > 0 && dist < 32768;
  st.playerInSights = st.playerAhead && rel.y * rel.y + rel.z * rel.z <= 1448 * 1448;

  if (a.glow > 0) a.glow -= 1;

  stepScript(a.script, statusBits(st));
  const flags = a.script.flags;

  // Net script yaw/roll/pitch this frame, which the aim-at-player rule defers to.
  const turned = { yaw: 0, roll: 0, pitch: 0 };
  if (a.rollFrames > 0) {
    // Thrown after a hit: spin, and keep the thrown velocity.
    a.rollFrames -= 1;
    roll(a.basis, DARTH.rollDeg * DEG);
  } else {
    if (flags & F.RL) {
      roll(a.basis, -TURN);
      turned.roll -= 1;
    }
    if (flags & F.RR) {
      roll(a.basis, TURN);
      turned.roll += 1;
    }
    if (flags & F.PU) {
      pitch(a.basis, TURN);
      turned.pitch += 1;
    }
    if (flags & F.PD) {
      pitch(a.basis, -TURN);
      turned.pitch -= 1;
    }
    if (flags & F.YR) {
      yaw(a.basis, TURN);
      turned.yaw += 1;
    }
    if (flags & F.YL) {
      yaw(a.basis, -TURN);
      turned.yaw -= 1;
    }
  }
  if (a.glow === 0) a.vel = velocityFromFlags(a, flags);
  if (flags & F.T0) {
    const target = flags & F.T9 ? add(scale(a.pos, -1), scale(state.player.basis.fwd, 4096)) : scale(a.pos, -1);
    aimAtPlayer(a, toView(a.basis, target), turned);
  }

  a.pos = add(a.pos, a.vel);
  a.pos.x = clamp(a.pos.x, -DOGFIGHT.positionClamp, DOGFIGHT.positionClamp);
  a.pos.y = clamp(a.pos.y, -DOGFIGHT.positionClamp, DOGFIGHT.positionClamp);
  a.pos.z = clamp(a.pos.z, -DOGFIGHT.positionClamp, DOGFIGHT.positionClamp);

  maybeFire(state, a, slot, flags, dist);
}

/**
 * The original's aim-at-player: yaw toward the target's side and pitch toward
 * its height by one step each, unless the script already yawed or pitched
 * this frame. Each turn may be helped by a roll, unless the script rolled:
 * after the yaw, if the target is clearly above or below, roll right when the
 * side and height signs differ and left otherwise; after the pitch, if the
 * target is clearly to one side, roll left when the signs differ and right
 * otherwise. "Clearly" means beyond the original's one-high-byte dead zone.
 */
function aimAtPlayer(a: Alien, rel: Vec, turned: { yaw: number; roll: number; pitch: number }): void {
  // The original works on halved coordinates' high bytes: a dead zone of {-1, 0} is |half| < 256.
  const yHi = Math.floor(rel.y / 2 / 256);
  const zHi = Math.floor(rel.z / 2 / 256);
  const inDead = (hi: number): boolean => hi === -1 || hi === 0;
  const signsDiffer = (yHi < 0) !== (zHi < 0);
  let rolled = turned.roll !== 0;
  if (turned.yaw === 0) {
    yaw(a.basis, yHi >= 0 ? TURN : -TURN);
    if (!rolled && !inDead(zHi)) {
      roll(a.basis, signsDiffer ? TURN : -TURN);
      rolled = true;
    }
  }
  if (turned.pitch === 0) {
    pitch(a.basis, zHi >= 0 ? TURN : -TURN);
    if (!rolled && !inDead(yHi)) {
      roll(a.basis, signsDiffer ? -TURN : TURN);
    }
  }
}

function velocityFromFlags(a: Alien, flags: number): Vec {
  let v = vec(0, 0, 0);
  const [s1, s2] = DOGFIGHT.speed;
  // The "3" strengths are both bits set, so they fall out as s1 + s2.
  if (flags & F.MF) v = add(v, scale(a.basis.fwd, s1));
  if (flags & F.MF2) v = add(v, scale(a.basis.fwd, s2));
  if (flags & F.MU) v = add(v, scale(a.basis.up, s1));
  if (flags & F.MU2) v = add(v, scale(a.basis.up, s2));
  if (flags & F.MD) v = add(v, scale(a.basis.up, -s1));
  if (flags & F.MD2) v = add(v, scale(a.basis.up, -s2));
  return v;
}

function maybeFire(state: GameState, a: Alien, slot: number, flags: number, dist: number): void {
  const st = a.status;
  if (!st.inView || flags & F.T9 || dist <= DOGFIGHT.minFireDistance || a.glow > 0) return;
  const row = fireRow(hardness(state.wave, state.difficulty));
  if ((state.dogfight.frame & row.mask) !== 0) return;
  if (Math.floor(nextFloat(state.rng) * 256) <= row.prob) return;
  const free = freeGunSlots(state, row.guns);
  if (free < 0) return;
  fireFireball(state, a, slot, free);
  st.fired = true;
}

/** The laser has hit this alien. */
export function hitAlien(state: GameState, slot: number, halfDistance: number): void {
  const d = state.dogfight;
  const a = d.aliens[slot];
  if (!a || a.glow > 0) return;
  a.status.hit = true;
  a.damage += 1;
  a.hitsLeft -= 1;
  if (a.kind === 'tie' && a.hitsLeft <= 0) {
    spawnExplosion(state, a);
    d.aliens[slot] = null;
    d.liveCount = Math.max(0, d.liveCount - 1);
    addScore(state, SCORING.tieFighter);
    state.events.push({ type: 'laserHitAlien', kind: 'tie', destroyed: true });
    state.events.push({ type: 'sound', name: 'explosion' });
    return;
  }
  // Darth: never destroyed. Glow, roll, and get thrown away with random spin.
  a.hitsLeft = DARTH.hitPoints + 1;
  a.glow = DARTH.glowFrames;
  a.rollFrames = DARTH.glowFrames;
  const p = state.player.basis;
  const push = DARTH.thrownForward - halfDistance;
  const side = (nextFloat(state.rng) < 0.5 ? -1 : 1) * (128 + Math.floor(nextFloat(state.rng) * 128));
  const lift = (nextFloat(state.rng) < 0.5 ? -1 : 1) * (128 + Math.floor(nextFloat(state.rng) * 128));
  a.vel = add(add(scale(p.fwd, push * Math.sign(dot(p.fwd, a.pos)) ), scale(p.right, side)), scale(p.up, lift));
  addScore(state, SCORING.darthsShip);
  state.events.push({ type: 'laserHitAlien', kind: 'darth', destroyed: false });
  state.events.push({ type: 'sound', name: 'explosion' });
}

export function addScore(state: GameState, points: number): void {
  state.score += points;
  state.lastScore = points;
  state.lastScoreFade = 255;
  if (state.score > state.highScore) state.highScore = state.score;
}

/** The retreat: every alien races back toward the Death Star and is removed once past the far edge and near the axis. */
export function stepRetreat(state: GameState): void {
  const d = state.dogfight;
  for (let slot = 0; slot < d.aliens.length; slot++) {
    const a = d.aliens[slot];
    if (!a) continue;
    a.pos.y = convergeHighByte(a.pos.y, 2);
    a.pos.z = convergeHighByte(a.pos.z, 3);
    const yHi = Math.floor(a.pos.y / 256);
    const zHi = Math.floor(a.pos.z / 256);
    const next = a.pos.x + DOGFIGHT.retreatSpeed;
    if (next <= 32767) {
      a.pos.x = next;
    } else if (Math.abs(yHi) <= 8 && Math.abs(zHi) <= 8) {
      d.aliens[slot] = null;
    }
    a.vel = vec(DOGFIGHT.retreatSpeed, 0, 0);
    if (a.glow > 0) a.glow -= 1;
    if (a.rollFrames > 0) {
      a.rollFrames -= 1;
      roll(a.basis, DARTH.rollDeg * DEG);
    }
  }
}

/** Move a coordinate's high byte toward zero by `step` while its magnitude is at least 9, as the original did. */
function convergeHighByte(value: number, step: number): number {
  const hi = Math.floor(value / 256);
  const lo = value - hi * 256;
  if (hi >= 9) return (hi - step) * 256 + lo;
  if (hi <= -9) return (hi + step) * 256 + lo;
  return value;
}

export { cloneBasis };
