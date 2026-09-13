import type * as THREE from 'three';
import { FONT, FONT_ADVANCE } from '../data/hud';
import type { LineSet } from './lineSet';

/** Half-length of the dash that stands in for a zero-length stroke: the period and colon are single
 * points in the vector ROM (VCTR 0,0,ON), which the line renderer would otherwise drop. */
const DOT_HALF = 2;

function drawStroke(lines: LineSet, stroke: readonly (readonly [number, number])[], color: THREE.Color, x: number, y: number, scale: number): void {
  const dot = stroke.length === 2 && stroke[0][0] === stroke[1][0] && stroke[0][1] === stroke[1][1];
  if (dot) {
    const [px, py] = stroke[0];
    lines.polyline([[px - DOT_HALF, py], [px + DOT_HALF, py]], color, x, y, scale);
    return;
  }
  lines.polyline(stroke, color, x, y, scale);
}

/** Draw a string with the arcade font, lower-left of the first character at (x, y), at `scale` times normal size. */
export function drawText(lines: LineSet, text: string, x: number, y: number, color: THREE.Color, scale = 1): void {
  let pen = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch === '@' ? '(c)' : ch];
    if (glyph) for (const stroke of glyph) drawStroke(lines, stroke, color, pen, y, scale);
    pen += FONT_ADVANCE * scale;
  }
}

/**
 * A number in a fixed-width field the way the original drew them: leading
 * zeros are suppressed but still advance the pen (down to `minShown` digits),
 * and a thousands comma, advancing only 4 units, appears once a significant
 * digit has been drawn.
 */
export function drawNumber(lines: LineSet, value: number, x: number, y: number, color: THREE.Color, field = 1, minShown = 1, scale = 1): void {
  const digits = String(Math.max(0, Math.floor(value))).padStart(field, '0');
  let pen = x;
  let shown = false;
  for (let i = 0; i < digits.length; i++) {
    const remaining = digits.length - 1 - i;
    const significant = digits[i] !== '0' || shown || remaining < minShown;
    if (significant) {
      shown = true;
      const glyph = FONT[digits[i]];
      if (glyph) for (const stroke of glyph) drawStroke(lines, stroke, color, pen, y, scale);
    }
    pen += FONT_ADVANCE * scale;
    if (remaining > 0 && remaining % 3 === 0 && shown) {
      lines.polyline([[-4, -6], [-2, 4]], color, pen, y, scale);
      pen += 4 * scale;
    }
  }
}

export function textWidth(text: string, scale = 1): number {
  return text.length * FONT_ADVANCE * scale;
}
