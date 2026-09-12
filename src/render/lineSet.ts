import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LINE_WIDTH } from './lines';

/**
 * A rebuildable batch of coloured fat-line segments. Call `begin()`, add
 * segments with `segment()` or `polyline()`, then `end()` to upload. Capacity
 * grows as needed; unused capacity is hidden by the instance count.
 */
export class LineSet {
  readonly mesh: LineSegments2;
  private readonly material: LineMaterial;
  private positions: Float32Array;
  private colors: Float32Array;
  private count = 0;
  private capacity: number;
  private dirtyCapacity = false;

  constructor(capacity: number, width: number, height: number, lineWidth = LINE_WIDTH) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 6);
    this.colors = new Float32Array(capacity * 6);
    this.material = new LineMaterial({ vertexColors: true, linewidth: lineWidth, alphaToCoverage: true });
    this.material.resolution.set(width, height);
    const geom = new LineSegmentsGeometry();
    geom.setPositions(this.positions);
    geom.setColors(this.colors);
    this.mesh = new LineSegments2(geom, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.geometry.instanceCount = 0;
  }

  resize(width: number, height: number): void {
    this.material.resolution.set(width, height);
  }

  begin(): void {
    this.count = 0;
  }

  private ensure(): void {
    if (this.count < this.capacity) return;
    this.capacity *= 2;
    const p = new Float32Array(this.capacity * 6);
    p.set(this.positions);
    this.positions = p;
    const c = new Float32Array(this.capacity * 6);
    c.set(this.colors);
    this.colors = c;
    this.dirtyCapacity = true;
  }

  segment(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color): void {
    this.ensure();
    const i = this.count * 6;
    const p = this.positions;
    p[i] = x0;
    p[i + 1] = y0;
    p[i + 2] = z0;
    p[i + 3] = x1;
    p[i + 4] = y1;
    p[i + 5] = z1;
    const c = this.colors;
    c[i] = c[i + 3] = color.r;
    c[i + 1] = c[i + 4] = color.g;
    c[i + 2] = c[i + 5] = color.b;
    this.count += 1;
  }

  /** A 2-D polyline at z = 0, offset by (ox, oy) and scaled by s. */
  polyline(points: readonly (readonly [number, number])[], color: THREE.Color, ox = 0, oy = 0, s = 1, sy = s): void {
    for (let i = 0; i + 1 < points.length; i++) {
      this.segment(
        ox + points[i][0] * s,
        oy + points[i][1] * sy,
        0,
        ox + points[i + 1][0] * s,
        oy + points[i + 1][1] * sy,
        0,
        color,
      );
    }
  }

  end(): void {
    const geom = this.mesh.geometry;
    if (this.dirtyCapacity) {
      this.mesh.geometry = new LineSegmentsGeometry();
      this.mesh.geometry.setPositions(this.positions);
      this.mesh.geometry.setColors(this.colors);
      geom.dispose();
      this.dirtyCapacity = false;
    } else {
      const start = geom.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
      start.data.needsUpdate = true;
      const cstart = geom.getAttribute('instanceColorStart') as THREE.InterleavedBufferAttribute;
      cstart.data.needsUpdate = true;
    }
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
  }
}
