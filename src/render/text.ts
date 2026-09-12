import type * as THREE from 'three';
import { FONT, FONT_ADVANCE } from '../data/hud';
import type { LineSet } from './lineSet';

/** Draw a string with the arcade font, lower-left of the first character at (x, y), at `scale` times normal size. */
export function drawText(lines: LineSet, text: string, x: number, y: number, color: THREE.Color, scale = 1): void {
  let pen = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch === '@' ? '(c)' : ch];
    if (glyph) for (const stroke of glyph) lines.polyline(stroke, color, pen, y, scale);
    pen += FONT_ADVANCE * scale;
  }
}

/**
 * A number in a fixed-width field the way the original drew them: leading
 * zeros are suppressed but still advance the pen (down to `minShown` digits),
 * and a thousands comma, advancing only 4 units, appears once a significant
 * digit has been drawn.
 */
export function drawNumber(lines: LineSet, value: number, x: number, y: number, color: THREE.Color, field = 1, minShown = 1): void {
  const digits = String(Math.max(0, Math.floor(value))).padStart(field, '0');
  let pen = x;
  let shown = false;
  for (let i = 0; i < digits.length; i++) {
    const remaining = digits.length - 1 - i;
    const significant = digits[i] !== '0' || shown || remaining < minShown;
    if (significant) {
      shown = true;
      const glyph = FONT[digits[i]];
      if (glyph) for (const stroke of glyph) lines.polyline(stroke, color, pen, y);
    }
    pen += FONT_ADVANCE;
    if (remaining > 0 && remaining % 3 === 0 && shown) {
      lines.polyline([[-4, -6], [-2, 4]], color, pen, y);
      pen += 4;
    }
  }
}

export function textWidth(text: string, scale = 1): number {
  return text.length * FONT_ADVANCE * scale;
}
