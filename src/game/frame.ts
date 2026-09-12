/**
 * Vectors and orientation matrices in the original's frame: X forward, Y
 * right, Z up (left-handed). Universe units are 16-bit in the original; here
 * they are plain numbers in the same scale. The renderer converts to Three.js
 * with (x, y, z) -> (y, z, -x).
 */

export interface Vec {
  x: number;
  y: number;
  z: number;
}

/**
 * A ship's orientation as its three body axes expressed in universe
 * coordinates: rows of the world-to-view matrix. Identity faces +X.
 */
export interface Basis {
  fwd: Vec;
  right: Vec;
  up: Vec;
}

export function vec(x: number, y: number, z: number): Vec {
  return { x, y, z };
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(a: Vec): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function identityBasis(): Basis {
  return { fwd: vec(1, 0, 0), right: vec(0, 1, 0), up: vec(0, 0, 1) };
}

/** A basis yawed 180 degrees: facing -X, as every alien spawns and as the player starts each wave. */
export function reversedBasis(): Basis {
  return { fwd: vec(-1, 0, 0), right: vec(0, -1, 0), up: vec(0, 0, 1) };
}

export function cloneBasis(b: Basis): Basis {
  return { fwd: { ...b.fwd }, right: { ...b.right }, up: { ...b.up } };
}

/** Universe vector into the body frame: (forward, right, up) components. */
export function toView(b: Basis, v: Vec): Vec {
  return { x: dot(b.fwd, v), y: dot(b.right, v), z: dot(b.up, v) };
}

/** Body-frame vector back into universe coordinates. */
export function toWorld(b: Basis, v: Vec): Vec {
  return {
    x: b.fwd.x * v.x + b.right.x * v.y + b.up.x * v.z,
    y: b.fwd.y * v.x + b.right.y * v.y + b.up.y * v.z,
    z: b.fwd.z * v.x + b.right.z * v.y + b.up.z * v.z,
  };
}

/** Rotate two axes of a basis in their own plane by `angle` (radians): a -> a cos + b sin, b -> b cos - a sin. */
function turn(a: Vec, b: Vec, angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ax = a.x * c + b.x * s;
  const ay = a.y * c + b.y * s;
  const az = a.z * c + b.z * s;
  b.x = b.x * c - a.x * s;
  b.y = b.y * c - a.y * s;
  b.z = b.z * c - a.z * s;
  a.x = ax;
  a.y = ay;
  a.z = az;
}

/** Yaw about the body's up axis: positive turns the nose toward the right wing. */
export function yaw(b: Basis, angle: number): void {
  turn(b.fwd, b.right, angle);
}

/** Pitch about the body's right axis: positive raises the nose toward the up axis. */
export function pitch(b: Basis, angle: number): void {
  turn(b.fwd, b.up, angle);
}

/** Roll about the body's forward axis: positive drops the right wing (right rotates toward down). */
export function roll(b: Basis, angle: number): void {
  turn(b.up, b.right, angle);
}

/** Re-orthonormalise after many incremental rotations so the basis does not drift. */
export function normalizeBasis(b: Basis): void {
  const f = b.fwd;
  const lf = length(f);
  f.x /= lf;
  f.y /= lf;
  f.z /= lf;
  const r = b.right;
  const d = dot(r, f);
  r.x -= f.x * d;
  r.y -= f.y * d;
  r.z -= f.z * d;
  const lr = length(r);
  r.x /= lr;
  r.y /= lr;
  r.z /= lr;
  // Left-handed frame: up = right x fwd... derive from the identity: fwd=(1,0,0), right=(0,1,0), up=(0,0,1) = fwd x right.
  b.up = cross(f, r);
}

export function cross(a: Vec, b: Vec): Vec {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Angle helpers for the original's binary angle constants. */
export const DEG = Math.PI / 180;
