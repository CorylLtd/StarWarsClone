import { AIM } from '../config';
import { DEG, pitch, roll, toView, type Vec, yaw } from '../frame';
import type { GameState } from '../types';

/**
 * The player's view in space: a forced roll after a hit, then the auto-aim
 * that slews the view toward the tracked alien (or the Death Star when none
 * is trackable) in the original's quantised steps.
 */
export function stepView(state: GameState, target: Vec | null): void {
  const p = state.player;
  if (p.rollFrames > 0) {
    p.rollFrames -= 1;
    roll(p.basis, p.rollDir * AIM.hitRollDeg * DEG);
  }
  const rates = target ? aimRates(toView(p.basis, target)) : deathStarRates(toView(p.basis, state.dogfight.deathStarDir));
  // The displayed view is the master matrix plus the leftover residue, so the
  // effective turn per frame is simply half the rate in tics.
  pitch(p.basis, ticsFromRate(rates.pitchRate) * AIM.ticDeg * DEG);
  yaw(p.basis, -ticsFromRate(rates.yawRate) * AIM.ticDeg * DEG);
}

/** RHTRIG: the residue grows by |rate| >> 1 tics per frame (one's complement for negative rates), signed. */
export function ticsFromRate(rate: number): number {
  const r = Math.max(-128, Math.min(127, Math.trunc(rate)));
  const a = r < 0 ? ~r : r;
  const tics = a >> 1;
  return r < 0 ? -tics : tics;
}

/** Pick the alien to track: the first live, non-glowing slot from the current one; null means the Death Star. */
export function chooseAimTarget(state: GameState): Vec | null {
  const d = state.dogfight;
  const p = state.player;
  for (let i = p.aimSlot; i < d.aliens.length; i++) {
    const a = d.aliens[i];
    if (a && a.glow === 0) {
      if (i !== p.aimSlot) p.shakeCount = 9;
      p.aimSlot = i;
      return a.pos;
    }
    if (p.shakeCount > 0) p.shakeCount = 9;
  }
  p.aimSlot = 0;
  return null;
}

/**
 * AIMA: the target's position in the player's frame, halved to 16 bits, is
 * shifted up together until the forward value would overflow (or, behind the
 * player, until the lateral values would), then the rates are the high bytes:
 * yaw rate is the one's complement of the shifted Y, pitch rate the shifted Z.
 * Positive yaw rate means turn left.
 */
export function aimRates(rel: Vec): { yawRate: number; pitchRate: number } {
  let x = clamp16(Math.trunc(rel.x / 2));
  let y = clamp16(Math.trunc(rel.y / 2));
  let z = clamp16(Math.trunc(rel.z / 2));
  const overflows = (v: number): boolean => v >= 0x4000 || v < -0x4000;
  if (x >= 0x100) {
    for (let i = 0; i < 16; i++) {
      if (overflows(x)) break;
      x *= 2;
      if (overflows(y)) break;
      y *= 2;
      if (overflows(z)) break;
      z *= 2;
    }
  } else {
    y = y | 1;
    for (let i = 0; i < 16; i++) {
      if (overflows(y)) break;
      y *= 2;
      if (overflows(z)) break;
      z *= 2;
    }
  }
  return { yawRate: ~hiByte(y), pitchRate: hiByte(z) };
}

/** AIMDTH: no alien to track, so aim at the Death Star from the player's own forward axis. */
export function deathStarRates(dir: Vec): { yawRate: number; pitchRate: number } {
  const ax = Math.trunc(dir.x * 0x4000);
  const ay = Math.trunc(dir.y * 0x4000);
  const az = Math.trunc(dir.z * 0x4000);
  if (ax >= 0) return { yawRate: ~hiByte(ay), pitchRate: hiByte(az) };
  return { yawRate: ~(0x7f - hiByte(ay)), pitchRate: 0x7f - hiByte(az) };
}

function clamp16(v: number): number {
  return Math.max(-32768, Math.min(32767, v));
}

/** Signed high byte of a 16-bit value. */
function hiByte(v: number): number {
  return Math.floor(clamp16(v) / 256);
}

