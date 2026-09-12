import * as THREE from 'three';
import type { RomModel } from '../data/vectorRom';
import type { Basis, Vec } from '../game/frame';

/**
 * Line segments for a traced model in Three.js coordinates and world units:
 * model units times the table's scale, times two because the original added
 * unhalved model points to halved positions. Original (x, y, z) -> (y, z, -x).
 */
export function modelEdges(model: RomModel): number[] {
  const s = model.scale * 2;
  const out: number[] = [];
  for (const [a, b] of model.lines) {
    const p = model.points[a];
    const q = model.points[b];
    out.push(p[1] * s, p[2] * s, -p[0] * s, q[1] * s, q[2] * s, -q[0] * s);
  }
  return out;
}

const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpBack = new THREE.Vector3();

/** Place an object from the original's frame: position and body basis to Three.js. */
export function placeFromOriginal(obj: THREE.Object3D, pos: Vec, basis: Basis): void {
  obj.position.set(pos.y, pos.z, -pos.x);
  tmpRight.set(basis.right.y, basis.right.z, -basis.right.x);
  tmpUp.set(basis.up.y, basis.up.z, -basis.up.x);
  // The model's nose is +X in its own frame, which maps to local -Z: so local "back" is the body's forward axis negated.
  tmpBack.set(-basis.fwd.y, -basis.fwd.z, basis.fwd.x);
  obj.matrix.makeBasis(tmpRight, tmpUp, tmpBack);
  obj.matrix.setPosition(obj.position);
  obj.matrixAutoUpdate = false;
  obj.matrixWorldNeedsUpdate = true;
}
