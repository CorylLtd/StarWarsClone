import * as THREE from 'three';
import {
  BUILDING_UNIT,
  BUNKER,
  BUNKER_PIECE_CENTRE,
  BUNKER_PIECE_LEFT,
  BUNKER_PIECE_RIGHT,
  GROUND_POINTS,
  TOWER,
  TOWER_PIECE_CENTRE,
  TOWER_PIECE_LEFT,
  TOWER_PIECE_RIGHT,
  TOWER_STUB,
  type BuildingPart,
  type FragmentModel,
} from '../data/surface';
import { SURFACE } from '../game/config';
import { toWorld, type Vec } from '../game/frame';
import { distanceShrink, isActive, relativeTo } from '../game/surface/buildings';
import type { GameState, GroundFragment } from '../game/types';
import { vgColor } from './colors';
import type { LineSet } from './lineSet';

const FRAGMENT_MODELS: Record<GroundFragment['shape'], FragmentModel> = {
  towerLeft: TOWER_PIECE_LEFT,
  towerCentre: TOWER_PIECE_CENTRE,
  towerRight: TOWER_PIECE_RIGHT,
  bunkerLeft: BUNKER_PIECE_LEFT,
  bunkerCentre: BUNKER_PIECE_CENTRE,
  bunkerRight: BUNKER_PIECE_RIGHT,
};

/** Original-frame universe vector to Three.js, relative to the camera at the player's position. */
function toThree(rel: Vec): [number, number, number] {
  return [rel.y, rel.z, -rel.x];
}

/**
 * Draws the Death Star surface into a 3-D line batch positioned relative to
 * the player: buildings shrunk about their base by the original's distance
 * scale and faded yellow with distance, tumbling fragments, and the ground
 * dots go into a points buffer.
 */
export function drawSurface(state: GameState, lines: LineSet, dots: Float32Array): number {
  const s = state.surface;
  for (const b of s.buildings) {
    if (!isActive(state, b) || !b.seen) continue;
    const rel = relativeTo(state, b);
    const halfHi = Math.floor(b.seen.distance / 512);
    // The original's distance scale shrinks the building about its base, and dims the base with distance.
    const shrink = distanceShrink(b.seen.distance);
    const baseLum = 0x40 + Math.floor(((0xff - 4 * halfHi) * 0x40) / 256);
    const baseColor = b.flash > 0 ? vgColor('WHT', 0xff) : vgColor('YLW', Math.max(0x40, Math.min(0x7f, baseLum)));
    const topColor = b.flash > 0 ? vgColor('WHT', 0xff) : b.type === 'bunker' ? vgColor('RED', 0x60) : vgColor('WHT', 0x80);
    const parts: readonly BuildingPart[] = b.type === 'bunker' ? BUNKER : b.damaged ? TOWER_STUB : TOWER;
    for (const part of parts) {
      const color = part.part === 'top' ? topColor : baseColor;
      for (const [i, j] of part.lines) {
        const a = GROUND_POINTS[i];
        const c = GROUND_POINTS[j];
        const [x0, y0, z0] = toThree({ x: rel.x + a[0] * BUILDING_UNIT * shrink, y: rel.y + a[1] * BUILDING_UNIT * shrink, z: rel.z + a[2] * BUILDING_UNIT * shrink });
        const [x1, y1, z1] = toThree({ x: rel.x + c[0] * BUILDING_UNIT * shrink, y: rel.y + c[1] * BUILDING_UNIT * shrink, z: rel.z + c[2] * BUILDING_UNIT * shrink });
        lines.segment(x0, y0, z0, x1, y1, z1, color);
      }
    }
  }

  for (const f of s.fragments) {
    const model = FRAGMENT_MODELS[f.shape];
    const rel = { x: f.pos.x - s.pos.x, y: f.pos.y - s.pos.y, z: f.pos.z - s.pos.z };
    const unit = model.scale * 2;
    const tower = f.shape.startsWith('tower');
    const lum = f.timer <= 7 ? 16 * f.timer : 0x80;
    const color = vgColor(tower ? 'WHT' : 'RED', lum);
    for (const [i, j] of model.lines) {
      const a = toWorld(s.munge, { x: model.points[i][0] * unit, y: model.points[i][1] * unit, z: model.points[i][2] * unit });
      const c = toWorld(s.munge, { x: model.points[j][0] * unit, y: model.points[j][1] * unit, z: model.points[j][2] * unit });
      const [x0, y0, z0] = toThree({ x: rel.x + a.x, y: rel.y + a.y, z: rel.z + a.z });
      const [x1, y1, z1] = toThree({ x: rel.x + c.x, y: rel.y + c.y, z: rel.z + c.z });
      lines.segment(x0, y0, z0, x1, y1, z1, color);
    }
  }

  let n = 0;
  for (const d of s.dots) {
    if (n * 3 + 2 >= dots.length) break;
    const [x, y, z] = toThree({ x: d.x - s.pos.x, y: d.y - s.pos.y, z: -s.pos.z });
    dots[n * 3] = x;
    dots[n * 3 + 1] = y;
    dots[n * 3 + 2] = z;
    n += 1;
  }
  void SURFACE;
  return n;
}

export const GROUND_DOT_COLOR = new THREE.Color(0x30ff30);
