import * as THREE from 'three';
import { VG } from '../game/config';
import type { Basis } from '../game/frame';

/**
 * A camera that projects exactly as the original's mathbox and monitor did:
 * screen = 512 * lateral / forward in vector units, the vanishing point 104
 * units below the screen centre, a visible window of +-495 by +-557 units,
 * and vertical units two thirds the size of horizontal ones. The frustum is
 * therefore asymmetric and the image vertically squashed, as on the cabinet.
 */
export class ArcadeCamera extends THREE.PerspectiveCamera {
  constructor() {
    super(60, 4 / 3, 1, 200000);
    this.rotation.order = 'YXZ';
    this.matrixAutoUpdate = false;
    this.updateProjectionMatrix();
  }

  override updateProjectionMatrix(): void {
    const n = this.near;
    const f = VG.focal;
    const right = (VG.halfWidth / f) * n;
    const top = ((VG.halfHeight - VG.offsetY) / f) * n;
    const bottom = (-(VG.halfHeight + VG.offsetY) / f) * n;
    this.projectionMatrix.makePerspective(-right, right, top, bottom, n, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }

  /** Point the camera along a basis expressed in the original's frame (X forward, Y right, Z up). */
  setBasis(b: Basis): void {
    // Original (x, y, z) -> Three (y, z, -x). The camera looks down its local -Z, so its local +Z is "back".
    const right = new THREE.Vector3(b.right.y, b.right.z, -b.right.x);
    const up = new THREE.Vector3(b.up.y, b.up.z, -b.up.x);
    const back = new THREE.Vector3(-b.fwd.y, -b.fwd.z, b.fwd.x);
    this.matrix.makeBasis(right, up, back);
    this.matrixWorld.copy(this.matrix);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  }
}
