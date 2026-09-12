import * as THREE from 'three';
import { TAU } from '../game/math';
import { range, type Rng } from '../game/random';

const STAR_COUNT = 400;
const STAR_RADIUS = 9000;

/** Stars on a distant sphere. They respond to the view but never to travel. */
export function createStarfield(rng: Rng, color: THREE.ColorRepresentation): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform on the sphere.
    const u = range(rng, -1, 1);
    const a = range(rng, 0, TAU);
    const flat = Math.sqrt(1 - u * u);
    positions[i * 3] = Math.cos(a) * flat * STAR_RADIUS;
    positions[i * 3 + 1] = u * STAR_RADIUS;
    positions[i * 3 + 2] = Math.sin(a) * flat * STAR_RADIUS;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geom, new THREE.PointsMaterial({ color, size: 2, sizeAttenuation: false }));
  stars.frustumCulled = false;
  return stars;
}
