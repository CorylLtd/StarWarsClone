import { describe, expect, it } from 'vitest';
import { dot, identityBasis, reversedBasis, scale, vec } from '../frame';
import { createInitialState } from '../state';
import { aimRates, deathStarRates, stepView, ticsFromRate } from './aim';

function facingError(state: ReturnType<typeof createInitialState>, target: { x: number; y: number; z: number }): number {
  const t = scale(target, 1 / Math.hypot(target.x, target.y, target.z));
  return Math.acos(Math.max(-1, Math.min(1, dot(state.player.basis.fwd, t))));
}

describe('auto-aim', () => {
  it('a target to the right gives a negative yaw rate (turn right) and above gives a positive pitch rate', () => {
    const r = aimRates(vec(10000, 4000, 3000));
    expect(r.yawRate).toBeLessThan(0);
    expect(r.pitchRate).toBeGreaterThan(0);
    const l = aimRates(vec(10000, -4000, -3000));
    expect(l.yawRate).toBeGreaterThan(0);
    expect(l.pitchRate).toBeLessThan(0);
  });

  it('a target behind saturates the rates', () => {
    const r = aimRates(vec(-10000, 100, -100));
    expect(Math.abs(r.yawRate)).toBeGreaterThan(60);
    expect(Math.abs(r.pitchRate)).toBeGreaterThan(60);
  });

  it('rate to tics halves and keeps the sign', () => {
    expect(ticsFromRate(127)).toBe(63);
    expect(ticsFromRate(-128)).toBe(-63);
    expect(ticsFromRate(0)).toBe(0);
  });

  it('the view converges on a fixed target ahead-right within a couple of seconds', () => {
    const state = createInitialState(1);
    state.player.basis = identityBasis();
    const target = vec(20000, 12000, -6000);
    const before = facingError(state, target);
    for (let i = 0; i < 60; i++) stepView(state, target);
    const after = facingError(state, target);
    expect(after).toBeLessThan(before);
    // The original's high-byte rates leave a dead band of a few degrees around the target.
    expect(after).toBeLessThan(0.1);
  });

  it('the view swings round from facing backwards to a target at +X', () => {
    const state = createInitialState(1);
    state.player.basis = reversedBasis();
    const target = vec(31744, 0, 1024);
    for (let i = 0; i < 80; i++) stepView(state, target);
    expect(facingError(state, target)).toBeLessThan(0.1);
  });

  it('with no target the view settles on the Death Star at +X', () => {
    const state = createInitialState(1);
    state.player.basis = reversedBasis();
    for (let i = 0; i < 120; i++) stepView(state, null);
    expect(state.player.basis.fwd.x).toBeGreaterThan(0.99);
    const r = deathStarRates(vec(0.9, 0.3, -0.2));
    expect(r.yawRate).toBeLessThan(0);
    expect(r.pitchRate).toBeLessThan(0);
  });
});
