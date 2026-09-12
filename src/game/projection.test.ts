import { describe, expect, it } from 'vitest';
import { VG } from './config';
import { identityBasis, reversedBasis, vec } from './frame';
import { hitSize, inCone, projectRelative, withinOctagon } from './projection';

describe('projection', () => {
  it('a point straight ahead lands on the vanishing point', () => {
    expect(projectRelative(vec(1000, 0, 0), identityBasis())!.at).toEqual({ x: 0, y: 0 });
  });

  it('screen position is 512 times the lateral ratio', () => {
    const r = projectRelative(vec(4096, 1024, -512), identityBasis())!;
    expect(r.at.x).toBeCloseTo(128);
    expect(r.at.y).toBeCloseTo(-64);
  });

  it('points behind, beside or too close are not drawn', () => {
    expect(projectRelative(vec(-1000, 0, 0), identityBasis())).toBeNull();
    expect(projectRelative(vec(1000, 1001, 0), identityBasis())).toBeNull();
    expect(projectRelative(vec(1000, 0, -1001), identityBasis())).toBeNull();
    expect(projectRelative(vec(10, 0, 0), identityBasis())).toBeNull();
    expect(inCone(vec(1000, 999, 999))).toBe(true);
  });

  it('sees through the player basis', () => {
    // Facing -X, a point at +X is behind; a point at -X ahead.
    expect(projectRelative(vec(1000, 0, 0), reversedBasis())).toBeNull();
    expect(projectRelative(vec(-1000, 0, 0), reversedBasis())!.at).toEqual({ x: 0, y: 0 });
  });

  it('hit size follows the original formula', () => {
    expect(hitSize(16384, 160, 10)).toBeCloseTo(15);
    expect(hitSize(4096, 160, 10)).toBeCloseTo(30);
    expect(hitSize(1024, 160, 10)).toBeCloseTo(90);
  });

  it('octagon test trims the corners of the square', () => {
    const c = { x: 0, y: 0 };
    expect(withinOctagon(c, { x: 30, y: 0 }, 30, 1.5)).toBe(true);
    expect(withinOctagon(c, { x: 30, y: 30 }, 30, 1.5)).toBe(false);
    expect(withinOctagon(c, { x: 22, y: 22 }, 30, 1.5)).toBe(true);
  });

  it('the visible window is wider than tall in VG units', () => {
    expect(VG.halfWidth).toBeLessThan(VG.halfHeight);
  });
});
