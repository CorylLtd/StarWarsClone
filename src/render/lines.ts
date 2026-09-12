import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/** Beam width in pixels. Wider than one pixel so bloom's half-res blur cannot flicker on it. */
export const LINE_WIDTH = 2;

/** Flat list of line-segment endpoints: six numbers per edge. */
export type EdgeList = number[];

export type V3 = readonly [number, number, number];

export function edge(out: EdgeList, a: V3, b: V3): void {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** Every material shares the screen resolution so fat lines stay the same pixel width. */
export class LineMaterials {
  private readonly all: LineMaterial[] = [];

  constructor(
    private width: number,
    private height: number,
  ) {}

  make(color: THREE.ColorRepresentation, lineWidth: number = LINE_WIDTH): LineMaterial {
    const material = new LineMaterial({ color, linewidth: lineWidth, alphaToCoverage: true });
    material.resolution.set(this.width, this.height);
    this.all.push(material);
    return material;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const m of this.all) m.resolution.set(width, height);
  }
}

/** Fat-line segments from a flat edge list. Pass a Float32Array to keep it shared for later in-place updates. */
export function linesFromEdges(edges: EdgeList | Float32Array, material: LineMaterial): LineSegments2 {
  const geom = new LineSegmentsGeometry();
  geom.setPositions(edges instanceof Float32Array ? edges : new Float32Array(edges));
  return new LineSegments2(geom, material);
}

/** Flag a fat-line geometry's shared position buffer as changed. */
export function markLinesUpdated(lines: LineSegments2): void {
  const attr = lines.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
  attr.data.needsUpdate = true;
  lines.geometry.computeBoundingSphere();
}
