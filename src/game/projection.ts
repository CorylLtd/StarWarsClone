import { CAMERA, SCREEN } from './config';
import { degToRad } from './math';
import type { ScreenPoint, View } from './types';

/** A point in the world, metres, Three.js handedness: +X right, +Y up, camera looks down -Z. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Rotate a world-space point into camera space for the given view. The
 * camera sits at the origin; the view is applied as yaw about Y, then pitch
 * about X, then roll about Z, and the point gets the inverse.
 */
export function toCameraSpace(p: Vec3, view: View): Vec3 {
  // Inverse yaw.
  const cy = Math.cos(-view.yaw);
  const sy = Math.sin(-view.yaw);
  let x = p.x * cy + p.z * sy;
  let z = -p.x * sy + p.z * cy;
  let y = p.y;
  // Inverse pitch.
  const cp = Math.cos(-view.pitch);
  const sp = Math.sin(-view.pitch);
  const y2 = y * cp - z * sp;
  const z2 = y * sp + z * cp;
  y = y2;
  z = z2;
  // Inverse roll.
  const cr = Math.cos(-view.roll);
  const sr = Math.sin(-view.roll);
  const x3 = x * cr - y * sr;
  const y3 = x * sr + y * cr;
  x = x3;
  y = y3;
  return { x, y, z };
}

/**
 * Project a camera-space point to normalised screen coordinates using the
 * same pinhole model as a Three.js PerspectiveCamera with CAMERA's settings.
 * Returns null for points at or behind the near plane.
 */
export function projectCameraSpace(p: Vec3): ScreenPoint | null {
  if (p.z >= -CAMERA.near) return null;
  const t = Math.tan(degToRad(CAMERA.fovYDeg) / 2);
  return {
    x: p.x / -p.z / (t * SCREEN.aspect),
    y: p.y / -p.z / t,
  };
}

/** Project a world-space point as seen through `view`. */
export function project(p: Vec3, view: View): ScreenPoint | null {
  return projectCameraSpace(toCameraSpace(p, view));
}

export function onScreen(s: ScreenPoint): boolean {
  return s.x >= -1 && s.x <= 1 && s.y >= -1 && s.y <= 1;
}
