import * as THREE from 'three';

/** The vector generator's eight colours, by the original's names. */
const BASE: Record<string, [number, number, number]> = {
  OFF: [0, 0, 0],
  BLU: [0.25, 0.35, 1],
  GRN: [0.2, 1, 0.2],
  TRQ: [0.2, 0.95, 1],
  RED: [1, 0.2, 0.2],
  PRP: [1, 0.3, 1],
  YLW: [1, 0.9, 0.2],
  WHT: [0.96, 0.96, 1],
};

const ALIASES: Record<string, string> = {
  BLUE: 'BLU',
  GREEN: 'GRN',
  TURQUOISE: 'TRQ',
  RED: 'RED',
  PURPLE: 'PRP',
  YELLOW: 'YLW',
  WHITE: 'WHT',
};

/** The flash colour cycle: colours 1..7 in order, one per field. */
export const FLASH_CYCLE = ['BLU', 'GRN', 'TRQ', 'RED', 'PRP', 'YLW', 'WHT'];

/** A colour name plus luminance (0..255, 128 normal) as an RGB triple. Luminance above normal pushes toward white. */
export function vgColor(name: string, lum = 0x80): THREE.Color {
  const key = ALIASES[name.toUpperCase()] ?? name.toUpperCase();
  const [r, g, b] = BASE[key] ?? BASE.WHT;
  const l = lum / 0x80;
  if (l <= 1) return new THREE.Color(r * l, g * l, b * l);
  const t = Math.min(1, (l - 1) / 1);
  return new THREE.Color(r + (1 - r) * t * 0.6, g + (1 - g) * t * 0.6, b + (1 - b) * t * 0.6);
}

/** The alien glow table TVWCL indexed by frames of glow left (31..0): white flashes fading over green. */
export function alienGlowColor(glow: number): THREE.Color {
  if (glow <= 0) return vgColor('GRN', 0x80);
  if (glow >= 30) return vgColor('WHT', 0xc0);
  if (glow % 2 === 0) return vgColor('GRN', 0x80);
  const lum = glow >= 17 ? 0x80 : glow >= 13 ? 0x70 : glow >= 9 ? 0x60 : glow >= 5 ? 0x50 : glow >= 3 ? 0x40 : 0x30;
  return vgColor('WHT', lum);
}

/** The explosion piece table TVWCLE indexed by frames left: yellow, then green with white flashes, then a green fade. */
export function explosionColor(timer: number): THREE.Color {
  if (timer >= 24) return vgColor('YLW', 0xa0);
  if (timer >= 16) {
    const i = timer - 16; // 7..0
    if (i % 2 === 1) return vgColor('GRN', 0xa0);
    const lums = [0xc0, 0xa0, 0x90, 0x80];
    return vgColor('WHT', lums[Math.min(3, (7 - i) >> 1)]);
  }
  const fade = [0x30, 0x30, 0x40, 0x40, 0x50, 0x50, 0x60, 0x60, 0x70, 0x70, 0x80, 0x80, 0x90, 0x90, 0xa0, 0xa0];
  return vgColor('GRN', fade[Math.max(0, Math.min(15, timer))]);
}

/** Shield gauge colour by count: red at 1-2, yellow at 3-4, green above. */
export function gaugeColorName(shields: number): string {
  if (shields <= 0) return 'OFF';
  if (shields <= 2) return 'RED';
  if (shields <= 4) return 'YLW';
  return 'GRN';
}
