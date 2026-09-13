import { DEATH_STAR_LIGHTS_EVEN, DEATH_STAR_LIGHTS_ODD } from '../data/deathStarLights';
import { DEATH_STAR_DETAIL } from '../data/hud';
import { vgColor } from './colors';
import type { LineSet } from './lineSet';

/** Screen half-length of the dash that stands in for one city light (a single lit point in the ROM). */
const LIGHT_HALF = 1.5;

/**
 * The detailed Death Star of the approach and the pull-away (WSMAIN.MAC DTHVW) about (cx, cy) at a
 * masked scale word (binary * 128 + linear): the circle, trench, dish, inside and farmland at that
 * scale, then the city lights three binary steps larger (clamped at binary 0), yellow at 0x60 once
 * they reach full size and 0x30 before. Even space waves spell MAY THE FORCE / BE WITH YOU.
 */
export function drawBigDeathStar(flat: LineSet, cx: number, cy: number, scaleWord: number, wave: number): void {
  const binary = Math.floor(scaleWord / 128);
  const linear = scaleWord % 128;
  const factor = Math.pow(2, 2 - binary) * ((256 - linear) / 256);
  for (const strokes of Object.values(DEATH_STAR_DETAIL)) {
    for (const s of strokes) flat.polyline(s.points, vgColor(s.color, s.lum), cx, cy, factor);
  }
  const lightBinary = binary - 3;
  const clamped = lightBinary < 0;
  const lightFactor = clamped ? 4 : Math.pow(2, 2 - lightBinary) * ((256 - linear) / 256);
  const lum = clamped || lightBinary === 0 ? 0x60 : 0x30;
  const dot = vgColor('YLW', lum);
  const faint = vgColor('YLW', Math.round(lum / 6));
  const stamps = wave % 2 === 0 ? DEATH_STAR_LIGHTS_EVEN : DEATH_STAR_LIGHTS_ODD;
  for (const stamp of stamps) {
    for (const [a, b] of stamp.lines) flat.polyline([a, b], faint, cx, cy, lightFactor);
    for (const [x, y] of stamp.dots) {
      flat.polyline([[-LIGHT_HALF, 0], [LIGHT_HALF, 0]], dot, cx + x * lightFactor, cy + y * lightFactor);
    }
  }
}
