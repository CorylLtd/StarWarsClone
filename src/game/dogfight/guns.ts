import { FIREBALL, SCORING } from '../config';
import type { Alien, Fireball, GameState } from '../types';
import { addScore } from './aliens';

/** Index of a free gun slot among the last `usable` of the six, or -1. */
export function freeGunSlots(state: GameState, usable: number): number {
  const g = state.dogfight.fireballs;
  for (let i = g.length - usable; i < g.length; i++) if (g[i] === null) return i;
  return -1;
}

/** Launch a fireball from an alien toward the player. */
export function fireFireball(state: GameState, from: Alien, slot: number, gun: number): void {
  const fb: Fireball = {
    kind: 'live',
    mover: 'home',
    pos: { ...from.pos },
    timer: FIREBALL.lifeFrames,
    at: { x: 0, y: 0 },
    halfDistance: 0,
    impacting: false,
  };
  state.dogfight.fireballs[gun] = fb;
  state.events.push({ type: 'alienFired' });
  state.events.push({ type: 'sound', name: 'tieCannon' });
  if (slot === state.player.aimSlot) {
    state.player.shakeCount -= 1;
    if (state.player.shakeCount === 0) state.events.push({ type: 'speech', line: "I CAN'T SHAKE HIM" });
  }
}

/** Move every shot: live ones home on the eye by seven eighths per frame; the rest just time out. */
export function stepFireballs(state: GameState): void {
  const g = state.dogfight.fireballs;
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (!fb) continue;
    fb.timer -= 1;
    if (fb.kind === 'live' && fb.mover === 'home') {
      fb.pos.x = Math.round(fb.pos.x * FIREBALL.homing);
      fb.pos.y = Math.round(fb.pos.y * FIREBALL.homing);
      fb.pos.z = Math.round(fb.pos.z * FIREBALL.homing);
    }
    if (fb.timer <= 0) g[i] = null;
  }
}

/** The laser has destroyed a fireball: it dissolves in place as a purple sparkle. */
export function hurtFireball(state: GameState, index: number): void {
  const fb = state.dogfight.fireballs[index];
  if (!fb) return;
  fb.kind = 'hurt';
  fb.timer = FIREBALL.hurtFrames;
  addScore(state, SCORING.fireball);
  state.events.push({ type: 'laserHitFireball' });
  state.events.push({ type: 'sound', name: 'shotDestroyed' });
}

/** A fireball has struck the windshield: it glows white and shrinks there while the shields take the hit. */
export function fireballImpact(state: GameState, index: number): void {
  const fb = state.dogfight.fireballs[index];
  if (!fb) return;
  fb.kind = 'glow';
  fb.timer = FIREBALL.glowFrames;
  shieldHit(state);
}

/** A hit on the deflector: flash, roll, and a shield lost unless the gauge is still animating the last loss. */
export function shieldHit(state: GameState): void {
  const p = state.player;
  state.events.push({ type: 'shieldHit' });
  state.events.push({ type: 'sound', name: 'shieldHit' });
  if (p.rollFrames === 0) p.rollDir = state.rng.seed & 1 ? 1 : -1;
  p.rollFrames = 32;
  if (p.gaugeFrames > 0) return;
  p.flashFrames = FIREBALL.screenFlashFrames;
  if (!state.firstShieldHitDone) {
    state.firstShieldHitDone = true;
    if (state.shields > 3) state.events.push({ type: 'speech', line: "I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT" });
  }
  loseShield(state);
}

export function loseShield(state: GameState): void {
  const old = state.shields;
  if (old <= 0) {
    state.shields = -1;
    return;
  }
  state.shields = old - 1;
  state.player.gaugeFrames = 10 + old;
  state.events.push({ type: 'shieldLost', remaining: state.shields });
  if (state.shields === 2) state.events.push({ type: 'speech', line: 'R2, TRY AND INCREASE THE POWER' });
  if (state.shields === 0) state.events.push({ type: 'speech', line: "I'VE LOST R2" });
}
