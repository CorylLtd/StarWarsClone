import * as THREE from 'three';
import { CATWALK, EXHAUST_PORT, TRENCH_UNIT, WALL_GUN, WALL_PANEL, type TrenchModel } from '../data/trench';
import { DEATH_STAR_DETAIL, DEATH_STAR_MINI } from '../data/hud';
import { FIREBALL_TIPS } from '../data/vectorRom';
import { TRENCH, VG } from '../game/config';
import { toView, vec, type Vec } from '../game/frame';
import { inCone } from '../game/projection';
import type { GameState } from '../game/types';
import { slotIndex } from '../game/trench/layout';
import { FLASH_CYCLE, vgColor } from './colors';
import type { LineSet } from './lineSet';
import { drawNumber, drawText, textWidth } from './text';

function toThree(rel: Vec): [number, number, number] {
  return [rel.y, rel.z, -rel.x];
}

/** A line between two points relative to the player, clipped at the near end to the view cone as the original did. */
function trenchLine(lines: LineSet, state: GameState, a: Vec, b: Vec, color: THREE.Color): void {
  const p = state.player.basis;
  const va = toView(p, a);
  const vb = toView(p, b);
  // Both endpoints must be ahead; pull a behind-the-eye end forward to the near limit.
  const near = 200;
  let A = a;
  let B = b;
  if (va.x < near && vb.x < near) return;
  if (va.x < near) A = lerpToX(a, b, va.x, vb.x, near);
  if (vb.x < near) B = lerpToX(b, a, vb.x, va.x, near);
  const [x0, y0, z0] = toThree(A);
  const [x1, y1, z1] = toThree(B);
  lines.segment(x0, y0, z0, x1, y1, z1, color);
}

function lerpToX(from: Vec, to: Vec, fx: number, tx: number, x: number): Vec {
  const t = (x - fx) / (tx - fx);
  return vec(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.z + (to.z - from.z) * t);
}

function drawModel(lines: LineSet, model: TrenchModel, origin: Vec, mirrorY: boolean, override?: { color: THREE.Color }): void {
  for (const part of model.parts) {
    const color = override?.color ?? vgColor(part.color, part.lum);
    for (const [i, j] of part.lines) {
      const a = model.points[i];
      const b = model.points[j];
      const sy = mirrorY ? -1 : 1;
      const [x0, y0, z0] = toThree(vec(origin.x + a[0] * TRENCH_UNIT, origin.y + a[1] * TRENCH_UNIT * sy, origin.z + a[2] * TRENCH_UNIT));
      const [x1, y1, z1] = toThree(vec(origin.x + b[0] * TRENCH_UNIT, origin.y + b[1] * TRENCH_UNIT * sy, origin.z + b[2] * TRENCH_UNIT));
      lines.segment(x0, y0, z0, x1, y1, z1, color);
    }
  }
}

/** Draw the trench into the 3-D batch relative to the player: fixed edges, wall verticals, far end, panels, port and torpedo. */
export function drawTrench(state: GameState, lines: LineSet, frame: number): void {
  const t = state.trench;
  const px = t.pos.x;
  const rel = (x: number, y: number, z: number): Vec => vec(x - px, y - t.pos.y, z - t.pos.z);
  const far = Math.min(TRENCH.drawAhead, t.endX !== null ? t.endX - px : TRENCH.drawAhead);
  const edge = vgColor('GRN', 0x70);
  for (const [y, z] of [
    [-TRENCH.wallY, TRENCH.topZ],
    [TRENCH.wallY, TRENCH.topZ],
    [-TRENCH.wallY, TRENCH.floorZ],
    [-512, TRENCH.floorZ],
    [512, TRENCH.floorZ],
    [TRENCH.wallY, TRENCH.floorZ],
  ]) {
    trenchLine(lines, state, rel(px + far, y, z), rel(px, y, z), edge);
  }
  const vertical = vgColor('GRN', 0x60);
  for (const x of t.rowStarts) {
    if (x - px > far || x < px - TRENCH.slotLength) continue;
    for (const y of [-TRENCH.wallY, TRENCH.wallY]) {
      let bottom = TRENCH.floorZ;
      if (x < px) bottom = Math.max(TRENCH.floorZ, t.pos.z - 2 * (px - x + 200));
      trenchLine(lines, state, rel(x, y, bottom), rel(x, y, TRENCH.topZ), vertical);
    }
  }
  const farColor = vgColor('GRN', 0x50);
  const fx = px + far;
  trenchLine(lines, state, rel(fx, -TRENCH.wallY, TRENCH.topZ), rel(fx, -TRENCH.wallY, TRENCH.floorZ), farColor);
  trenchLine(lines, state, rel(fx, -TRENCH.wallY, TRENCH.floorZ), rel(fx, TRENCH.wallY, TRENCH.floorZ), farColor);
  trenchLine(lines, state, rel(fx, TRENCH.wallY, TRENCH.floorZ), rel(fx, TRENCH.wallY, TRENCH.topZ), farColor);
  if (t.endX !== null && t.endX - px <= TRENCH.drawAhead) {
    trenchLine(lines, state, rel(t.endX, -TRENCH.wallY, TRENCH.topZ), rel(t.endX, TRENCH.wallY, TRENCH.topZ), vgColor('GRN', 0x80));
  }

  // Panels: every slot from the player's to the draw distance.
  const firstSlot = Math.floor(px / TRENCH.slotLength);
  const lastSlot = Math.floor((px + far) / TRENCH.slotLength);
  for (let s = firstSlot; s <= lastSlot; s++) {
    const slot = t.slots[s & (TRENCH.ringSlots - 1)];
    const cx = s * TRENCH.slotLength + TRENCH.slotLength / 2;
    if (cx - px < 0) continue;
    for (const [wall, codes, mirror] of [
      ['left', slot.left, false],
      ['right', slot.right, true],
    ] as const) {
      const wy = wall === 'left' ? -TRENCH.wallY : TRENCH.wallY;
      for (let band = 0; band < 4; band++) {
        const code = codes[band];
        if (code === 0) continue;
        const origin = rel(cx, wy, TRENCH.bandCentres[band]);
        if (!inCone(toView(state.player.basis, origin))) continue;
        if (code === 1) drawModel(lines, WALL_PANEL, origin, mirror);
        else if (code === 3) drawModel(lines, WALL_GUN, origin, mirror);
        else {
          const cue = (slot.catwalkCue - t.cueIndexPassed) % 3;
          const lum = Math.max(TRENCH.catwalkLumMin, TRENCH.catwalkLumStart - TRENCH.catwalkLumStep * Math.max(0, slot.catwalkCue - t.cueIndexPassed));
          const color = slot.struck > 0 ? vgColor(FLASH_CYCLE[frame % 7], 0xff) : vgColor(TRENCH.catwalkColours[((cue % 3) + 3) % 3], lum);
          drawModel(lines, CATWALK, origin, mirror, { color });
        }
      }
    }
  }

  if (t.portX !== null && t.portX - px <= TRENCH.portDrawAhead && t.portX - px > -TRENCH.slotLength / 2) {
    drawModel(lines, EXHAUST_PORT, rel(t.portX, 0, TRENCH.floorZ), false);
  }
  void slotIndex;
}

/** The torpedo pair as turquoise pinwheels at their projected positions, drawn flat. */
export function drawTorpedo(state: GameState, flat: LineSet, frame: number): void {
  const t = state.trench;
  if (!t.torpedo || !t.torpedo.live) return;
  for (const side of [-1, 1]) {
    const rel = vec(t.torpedo.pos.x - t.pos.x, t.torpedo.pos.y + side * TRENCH.torpedoOffsetY - t.pos.y, t.torpedo.pos.z - t.pos.z);
    const view = toView(state.player.basis, rel);
    if (view.x < 1 || !inCone(view)) continue;
    const at = { x: (VG.focal * view.y) / view.x, y: (VG.focal * view.z) / view.x + VG.offsetY };
    const factor = Math.min(2, Math.max(1 / 8, 1024 / Math.max(1, view.x)));
    const tips = FIREBALL_TIPS[frame % 4];
    for (const stroke of tips) flat.polyline(stroke, vgColor('TRQ', 0xff), at.x, at.y, factor);
  }
}

/** The Death Star receding, then the burst of circles and rings, then the next-wave messages. */
export function drawDeathStarEnd(state: GameState, flat: LineSet, frame: number): void {
  const t = state.trench;
  const cx = 0;
  const cy = VG.offsetY;
  if (t.phase === 'explosion1') {
    // Masked scale units: binary * 128 + linear; factor 2^(2 - b) * (256 - l) / 256, from half size shrinking away.
    const b = Math.floor(t.dxScale / 128);
    const l = t.dxScale % 128;
    const factor = Math.pow(2, 2 - b) * ((256 - l) / 256);
    for (const strokes of Object.values(DEATH_STAR_DETAIL)) {
      for (const s of strokes) flat.polyline(s.points, vgColor(s.color, s.lum), cx, cy, factor);
    }
    return;
  }
  if (t.phase === 'explosion3') {
    // The miniature (VJBMIN) is drawn only by VEWDX2, the single frame that starts the burst; the
    // DX3 frames that follow draw nothing but the circles and rings.
    if (t.burstPhase === 0 && t.frame === 0) for (const s of DEATH_STAR_MINI) flat.polyline(s.points, vgColor(s.color, s.lum), cx, cy, 1);
    // Every circle is the Death Star's 16-segment outline (raw radius 1600) at a vector-generator
    // scale word: radius = 1600 * 2^(2 - binary) * (256 - linear) / 256, one word step apart.
    const circle = (word: number, color: THREE.Color): void => {
      let b = (word >> 8) & 0xf;
      let l = word & 0xff;
      while (l < 0) {
        l += 128;
        b -= 1;
      }
      const radius = 1600 * Math.pow(2, 2 - b) * ((256 - l) / 256);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i++) pts.push([Math.cos((i / 16) * Math.PI * 2) * radius, Math.sin((i / 16) * Math.PI * 2) * radius * 1.5]);
      flat.polyline(pts, color, cx, cy);
    };
    const rings = (from: number, n: number, color: THREE.Color): void => {
      for (let i = 0; i < n; i++) circle(from - 4 * i, color);
    };
    const count = Math.max(0, t.burstCount);
    switch (t.burstPhase) {
      case 0:
        for (let i = 0; i < count; i++) circle(0x76f0 - 2 * i, vgColor('RED', 0x80));
        break;
      case 1:
        for (let i = 0; i < count; i++) circle(0x76f0 - 2 * i, vgColor('BLU', 0xff));
        for (let i = count; i < 0x3f; i++) circle(0x76f0 - 2 * i, vgColor('RED', 0xff));
        rings(0x7670 - 8 * count, (((count >> 2) & 7) ^ 7) + 1, vgColor('RED', 0xff));
        break;
      case 2:
        for (let i = 0; i < count; i++) circle(0x7670 - 2 * i, vgColor('WHT', 0xff));
        for (let i = count; i < 0x3f; i++) circle(0x7670 - 2 * i, vgColor('BLU', 0xff));
        rings(0x7670 - 8 * count, ((count & 0xf) ^ 0xf) + 1, vgColor('BLU', 0xff));
        break;
      default:
        rings(0x7500 + count, ((count >> 1) & 0x3f) ^ 0x3f, vgColor('WHT', 0xff));
        break;
    }
    return;
  }
  if (t.phase === 'next') {
    const cycling = vgColor(FLASH_CYCLE[frame % 7], 0x80);
    drawText(flat, 'DEATH STAR DESTROYED', -236, 312, cycling);
    if (t.nextTim <= 2) {
      drawText(flat, 'BONUS FOR REMAINING ENERGY', -308, 192, vgColor('GRN'));
      drawText(flat, '5,000  X', -128, 144, vgColor('GRN'));
      drawNumber(flat, Math.max(0, state.shields), 112, 144, vgColor('GRN'), 1);
    }
    if (t.nextTim <= 1) {
      if (t.shieldsAdded > 0) {
        drawNumber(flat, t.shieldsAdded, -320, 72, vgColor('YLW'), 1);
        drawText(flat, ' ADDED TO DEFLECTOR SHIELD', -296, 72, vgColor('YLW'));
      } else {
        drawText(flat, 'SHIELD AT FULL STRENGTH', -272, 72, vgColor('YLW'));
      }
    }
    if (t.nextTim <= 0 && state.firstWave && state.wave > 0) drawText(flat, 'STARTING WAVE BONUS', -224, -48, vgColor('RED'));
  }
  void textWidth;
}

/** Trench messages: the Force, the port, the first-wave hints and the miss. */
export function drawTrenchMessages(state: GameState, flat: LineSet, frame: number): void {
  const t = state.trench;
  const cycling = vgColor(FLASH_CYCLE[frame % 7], 0x80);
  if (t.force === 0) drawText(flat, 'USE THE FORCE', -152, 336, cycling);
  if (t.force === 1) {
    drawNumber(flat, t.forceBonus, -320, 384, cycling, 6, 1);
    drawText(flat, ' FOR USING THE FORCE', -320 + 6 * 24 + 4, 384, cycling);
  }
  if (t.missedFrames > 0) drawText(flat, 'EXHAUST PORT MISSED', -448, 312, cycling, 2);
  const tim = Math.floor(t.frame / TRENCH.pseudoSecondFrames);
  if (state.firstWave && t.repeat === 0 && tim < 8) {
    const alternate = state.wave > 0 && Math.floor(t.frame / 16) % 2 === 1;
    if (alternate) drawText(flat, 'AVOID CATWALKS', -164, 384, vgColor('RED'));
    else drawText(flat, 'SHOOT FIREBALLS', -176, 384, vgColor('WHT'));
  }
  if (state.firstWave && t.portX !== null && t.portX > t.pos.x) drawText(flat, 'EXHAUST PORT AHEAD', -424, 312, cycling, 2);
}
