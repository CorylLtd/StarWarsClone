import type * as THREE from 'three';
import {
  COIN_TEXT,
  COPYRIGHT,
  HIGH_SCORE_ROWS_Y,
  HIGH_SCORE_ROWS_Y_ENTRY,
  HIGH_SCORE_TITLE,
  HIGH_SCORE_TITLE_ENTRY,
  INITIALS_ALPHABET,
  INITIALS_MESSAGES,
  INSTRUCTIONS,
  INSTRUCTIONS_DIGIT,
  SCORING_PAGE,
  STORYLINE,
  type Message,
} from '../data/attract';
import { HUD_TEXT } from '../data/hud';
import { LOGO, LOGO_VANISHING_POINT } from '../data/logo';
import { ATTRACT, OPTIONS } from '../game/config';
import { storyLineScale } from '../game/attract';
import type { GameState } from '../game/types';
import { FLASH_CYCLE, vgColor } from './colors';
import type { LineSet } from './lineSet';
import { drawNumber, drawText } from './text';

const COLOR_NAMES: Record<string, string> = {
  red: 'RED',
  green: 'GRN',
  blue: 'BLU',
  turquoise: 'TRQ',
  purple: 'PRP',
  yellow: 'YLW',
  white: 'WHT',
};

function messageColor(name: string, lum: number, frame: number): THREE.Color {
  if (name.startsWith('flashing')) return vgColor(FLASH_CYCLE[frame % 7], lum);
  return vgColor(COLOR_NAMES[name] ?? 'WHT', lum);
}

function drawMessage(flat: LineSet, m: Message, frame: number, lum = 0x80, yOffset = 0, scale = 1): void {
  drawText(flat, m.text, m.x, m.y + yOffset, messageColor(m.color, lum, frame), scale);
}

/** The score and wave labels and the coin lines the cabinet shows in every attract screen. */
function drawFrameText(state: GameState, flat: LineSet, frame: number): void {
  const red = vgColor('RED');
  const green = vgColor('GRN');
  drawText(flat, HUD_TEXT.scoreLabel.text, HUD_TEXT.scoreLabel.x, HUD_TEXT.scoreLabel.y, red);
  drawText(flat, HUD_TEXT.waveLabel.text, HUD_TEXT.waveLabel.x, HUD_TEXT.waveLabel.y, red);
  drawNumber(flat, state.score, HUD_TEXT.scoreDigits.x, HUD_TEXT.scoreDigits.y, green, 8, 2);
  drawNumber(flat, state.attract.lastWaveDisplayed, HUD_TEXT.waveNumber.x, HUD_TEXT.waveNumber.y, green, 2, 1);
  if (state.credits > 0) {
    const t = COIN_TEXT.pullTrigger;
    drawText(flat, t.text, t.x, t.y, vgColor(FLASH_CYCLE[frame % 7], 0x80));
    const word = state.credits === 1 ? COIN_TEXT.credit : COIN_TEXT.credits;
    drawText(flat, word.text, word.x, word.y, vgColor('WHT'));
    drawNumber(flat, state.credits, COIN_TEXT.creditCount.x, COIN_TEXT.creditCount.y, vgColor('WHT'), 1);
  } else {
    const top = Math.floor(frame / 16) % 2 === 0 ? COIN_TEXT.insertCoins : COIN_TEXT.gameOver;
    drawText(flat, top.text, top.x, top.y, vgColor(COLOR_NAMES[top.color]));
    const price = COIN_TEXT.prices[0];
    drawText(flat, price, -price.length * 12, COIN_TEXT.priceY, vgColor('YLW'));
  }
}

/** The high-score table at 1.5 times size with rank, initials and score columns. */
function drawTable(state: GameState, flat: LineSet, rowsY: readonly number[], scale: number, color: THREE.Color, highlight = -1, frame = 0): void {
  for (let i = 0; i < 10 && i < state.highScores.length; i++) {
    const row = state.highScores[i];
    const y = rowsY[i] * scale;
    const rowColor = i === highlight ? vgColor('WHT') : color;
    drawNumber(flat, i + 1, -200 * scale, y, rowColor, 2, 1);
    drawText(flat, '.', -200 * scale + 48 * scale, y, rowColor, scale);
    let initials = row.initials.padEnd(3, i === highlight ? '_' : ' ');
    if (i === highlight && frame % 2 === 1 && state.initials.letters.length < 3) {
      const k = state.initials.letters.length;
      initials = initials.slice(0, k) + ' ' + initials.slice(k + 1);
    }
    drawText(flat, initials, -128 * scale, y, rowColor, scale);
    drawScoreAt(flat, row.score, -16 * scale, y, rowColor, scale);
  }
}

function drawScoreAt(flat: LineSet, score: number, x: number, y: number, color: THREE.Color, scale: number): void {
  // Eight digits with commas and six leading zeros suppressed, at the row's scale.
  const digits = String(Math.max(0, Math.floor(score))).padStart(8, '0');
  let pen = x;
  let shown = false;
  for (let i = 0; i < 8; i++) {
    const remaining = 7 - i;
    const significant = digits[i] !== '0' || shown || remaining < 2;
    if (significant) {
      shown = true;
      drawText(flat, digits[i], pen, y, color, scale);
    }
    pen += 24 * scale;
    if (remaining > 0 && remaining % 3 === 0 && shown) {
      flat.polyline([[-4, -6], [-2, 4]], color, pen, y, scale);
      pen += 4 * scale;
    }
  }
}

/** The whole attract screen for the current phase. */
export function drawAttractScreen(state: GameState, flat: LineSet, frame: number): void {
  const a = state.attract;
  drawFrameText(state, flat, frame);
  switch (a.phase) {
    case 'highScores': {
      for (const m of COPYRIGHT) drawMessage(flat, m, frame);
      const left = ATTRACT.highScoresFrames - a.frame;
      const lum = left < ATTRACT.highScoresFadeFrames ? Math.max(0, left) : 0x80;
      drawText(flat, HIGH_SCORE_TITLE.text, HIGH_SCORE_TITLE.x, HIGH_SCORE_TITLE.y, vgColor('RED'));
      drawTable(state, flat, HIGH_SCORE_ROWS_Y, 1.5, vgColor('BLU', lum));
      break;
    }
    case 'banner':
      drawBanner(state, flat);
      break;
    case 'instructions':
    case 'scoring': {
      const page = a.phase === 'instructions' ? INSTRUCTIONS : SCORING_PAGE;
      const shown = Math.floor(a.frame / ATTRACT.pageLineEvery) + 1;
      const fade = a.frame - ATTRACT.pageRevealFrames;
      const lum = fade > 0 ? Math.max(0x0f, 0x80 - fade) : 0x80;
      const yOffset = a.phase === 'scoring' ? Math.max(0, ATTRACT.scoringScroll - a.frame * ATTRACT.scoringScrollPerFrame) : 0;
      for (let i = 0; i < Math.min(shown, page.length); i++) {
        drawMessage(flat, page[i], frame, lum, yOffset);
        if (a.phase === 'instructions' && i === 3) {
          drawText(flat, String(OPTIONS.startingShields), INSTRUCTIONS_DIGIT.x, INSTRUCTIONS_DIGIT.y + yOffset, vgColor('RED', lum));
        }
      }
      break;
    }
  }
}

/** The banner: the logo receding into the vanishing point and the storyline rising and shrinking toward it. */
function drawBanner(state: GameState, flat: LineSet): void {
  const a = state.attract;
  const n = a.frame;
  const vp = LOGO_VANISHING_POINT;
  if (n < ATTRACT.logoGoneAt) {
    const linear = n < ATTRACT.logoFixedUntil ? ATTRACT.logoFixedScale : n;
    const lum = n < ATTRACT.logoFixedUntil ? Math.min(0xd5, 0x18 + 3 * n) : (0xff - n + 0x18) & 0xff;
    const f = 0.5 * ((256 - linear) / 256);
    for (const stroke of LOGO) {
      const color = vgColor('BLU', Math.round((lum * stroke.intensity) / 7));
      flat.polyline(stroke.points, color, vp.x, vp.y, f);
    }
  }
  for (let i = 0; i < STORYLINE.length; i++) {
    const linear = storyLineScale(state, i);
    if (linear < 0) continue;
    const f = 2 * ((256 - linear) / 256);
    const line = STORYLINE[i];
    const lum = (0xff - linear + 0x10) & 0xff;
    drawText(flat, line.text, vp.x + line.x * f, vp.y + ATTRACT.storyOffsetY * f, vgColor('GRN', Math.min(0xff, lum)), f);
  }
}

/** The initials entry screen: messages, the table with the player's row, and the alphabet with the hovered item in white. */
export function drawInitialsScreen(state: GameState, flat: LineSet, frame: number): void {
  drawFrameText(state, flat, frame);
  for (const m of INITIALS_MESSAGES) drawMessage(flat, m, frame);
  drawText(flat, HIGH_SCORE_TITLE_ENTRY.text, HIGH_SCORE_TITLE_ENTRY.x, HIGH_SCORE_TITLE_ENTRY.y, vgColor(FLASH_CYCLE[frame % 7], 0x80));
  drawTable(state, flat, HIGH_SCORE_ROWS_Y_ENTRY, 1, vgColor('BLU'), state.initials.row, frame);
  for (const item of INITIALS_ALPHABET) {
    const selected = state.initials.hover === item.ch;
    if (item.ch === 'RUB' || item.ch === 'END') {
      drawText(flat, item.ch, item.x - 8, item.y, vgColor(selected ? 'WHT' : 'RED', 0x50), 0.5);
    } else {
      drawText(flat, item.ch === ' ' ? '_' : item.ch, item.x, item.y, vgColor(selected ? 'WHT' : 'RED'));
    }
  }
}
