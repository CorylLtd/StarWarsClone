import { describe, expect, it } from 'vitest';
import { DEG, identityBasis, pitch, reversedBasis, roll, toView, toWorld, vec, yaw } from './frame';

describe('basis', () => {
  it('identity maps universe to view unchanged', () => {
    const b = identityBasis();
    expect(toView(b, vec(1, 2, 3))).toEqual(vec(1, 2, 3));
    expect(toWorld(b, vec(1, 2, 3))).toEqual(vec(1, 2, 3));
  });

  it('a reversed basis sees +X as behind and +Y on its left', () => {
    const b = reversedBasis();
    const v = toView(b, vec(10, 5, 0));
    expect(v.x).toBe(-10);
    expect(v.y).toBe(-5);
  });

  it('yawing right brings a point on the right ahead', () => {
    const b = identityBasis();
    yaw(b, 90 * DEG);
    const v = toView(b, vec(0, 1, 0));
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it('pitching up brings a point above ahead', () => {
    const b = identityBasis();
    pitch(b, 90 * DEG);
    const v = toView(b, vec(0, 0, 1));
    expect(v.x).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('rolling right (right wing down) sends a point above toward the left', () => {
    const b = identityBasis();
    roll(b, 90 * DEG);
    const v = toView(b, vec(0, 0, 1));
    expect(v.y).toBeCloseTo(-1);
    expect(v.z).toBeCloseTo(0);
    // and the ship's up axis now points to universe right
    expect(b.up.y).toBeCloseTo(1);
  });

  it('view and world transforms are inverses', () => {
    const b = identityBasis();
    yaw(b, 0.3);
    pitch(b, -0.7);
    roll(b, 1.1);
    const p = vec(3, -4, 5);
    const back = toWorld(b, toView(b, p));
    expect(back.x).toBeCloseTo(3);
    expect(back.y).toBeCloseTo(-4);
    expect(back.z).toBeCloseTo(5);
  });
});
