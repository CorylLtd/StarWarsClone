import { describe, expect, it } from 'vitest';
import { CAMERA, SCREEN } from './config';
import { degToRad } from './math';
import { onScreen, project, projectCameraSpace, toCameraSpace } from './projection';
import type { View } from './types';

const LEVEL: View = { yaw: 0, pitch: 0, roll: 0 };

describe('projection', () => {
  it('puts a point straight ahead at the centre', () => {
    expect(project({ x: 0, y: 0, z: -100 }, LEVEL)).toEqual({ x: 0, y: 0 });
  });

  it('returns null for points behind the camera', () => {
    expect(project({ x: 0, y: 0, z: 10 }, LEVEL)).toBeNull();
    expect(project({ x: 0, y: 0, z: 0 }, LEVEL)).toBeNull();
  });

  it('maps the edge of the vertical field of view to y = 1', () => {
    const z = -100;
    const y = -z * Math.tan(degToRad(CAMERA.fovYDeg) / 2);
    expect(projectCameraSpace({ x: 0, y, z })!.y).toBeCloseTo(1);
  });

  it('maps the edge of the horizontal field of view to x = 1', () => {
    const z = -100;
    const x = -z * Math.tan(degToRad(CAMERA.fovYDeg) / 2) * SCREEN.aspect;
    expect(projectCameraSpace({ x, y: 0, z })!.x).toBeCloseTo(1);
  });

  it('yawing right brings a point on the right toward the centre', () => {
    const p = { x: 30, y: 0, z: -100 };
    const before = project(p, LEVEL)!;
    const after = project(p, { yaw: -degToRad(10), pitch: 0, roll: 0 })!;
    expect(before.x).toBeGreaterThan(0);
    expect(Math.abs(after.x)).toBeLessThan(Math.abs(before.x));
  });

  it('pitching up brings a point above toward the centre', () => {
    const p = { x: 0, y: 30, z: -100 };
    const before = project(p, LEVEL)!;
    const after = project(p, { yaw: 0, pitch: degToRad(10), roll: 0 })!;
    expect(before.y).toBeGreaterThan(0);
    expect(Math.abs(after.y)).toBeLessThan(Math.abs(before.y));
  });

  it('rolling rotates the image about the view axis', () => {
    const c = toCameraSpace({ x: 10, y: 0, z: -100 }, { yaw: 0, pitch: 0, roll: degToRad(90) });
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(-10);
    expect(c.z).toBeCloseTo(-100);
  });

  it('knows what is on screen', () => {
    expect(onScreen({ x: 0.5, y: -0.9 })).toBe(true);
    expect(onScreen({ x: 1.01, y: 0 })).toBe(false);
  });
});
