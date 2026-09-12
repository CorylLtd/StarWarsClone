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

/** A number with thousands commas the way the original drew them: commas advance only 4 units. */
export function drawNumber(lines: LineSet, value: number, x: number, y: number, color: THREE.Color, minDigits = 1): void {
  const digits = String(Math.max(0, Math.floor(value))).padStart(minDigits, '0');
  let pen = x;
  for (let i = 0; i < digits.length; i++) {
    const glyph = FONT[digits[i]];
    if (glyph) for (const stroke of glyph) lines.polyline(stroke, color, pen, y);
    pen += FONT_ADVANCE;
    const remaining = digits.length - 1 - i;
    if (remaining > 0 && remaining % 3 === 0) {
      lines.polyline([[-4, -6], [-2, 4]], color, pen, y);
      pen += 4;
    }
  }
}

export function textWidth(text: string, scale = 1): number {
  return text.length * FONT_ADVANCE * scale;
}
