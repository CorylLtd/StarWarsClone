import { VG } from './config';
import { type Basis, toView, type Vec } from './frame';
import type { ScreenPoint } from './types';

/**
 * A point relative to the eye, seen through the player's basis, projected the
 * way the original's mathbox did it: screen = 512 * lateral / forward, in VG
 * units around the vanishing point (which the renderer draws 104 units low).
 * Returns null when the point is not inside the 90-degree cone the original
 * draws, or too close.
 */
export function projectRelative(rel: Vec, basis: Basis): { at: ScreenPoint; view: Vec } | null {
  const view = toView(basis, rel);
  if (!inCone(view)) return null;
  return { at: { x: (VG.focal * view.y) / view.x, y: (VG.focal * view.z) / view.x }, view };
}

/** The original's visibility test: ahead, not too close, and |lateral| < forward on both axes. */
export function inCone(view: Vec): boolean {
  return view.x > 32 && view.x <= 0x7f00 * 2 && Math.abs(view.y) < view.x && Math.abs(view.z) < view.x;
}

/**
 * Hit-box half size for an object at a given real distance: a sphere of
 * `radius` units projects to 512 * radius / distance, plus a pad, in VG units.
 */
export function hitSize(distance: number, radius: number, pad: number): number {
  return (VG.focal * radius) / distance + pad;
}

/** The original's octagonal overlap test between two screen points. */
export function withinOctagon(a: ScreenPoint, b: ScreenPoint, size: number, octagonFactor: number): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= size && dy <= size && dx + dy <= octagonFactor * size;
}

/** VG screen units to normalised device coordinates for the 4:3 frame; y is up in both. */
export function toNdc(p: ScreenPoint): ScreenPoint {
  return { x: p.x / VG.halfWidth, y: p.y / VG.halfHeight };
}
