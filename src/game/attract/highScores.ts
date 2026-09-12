import { INITIALS_ALPHABET } from '../../data/attract';
import { ATTRACT } from '../config';
import type { GameState, HighScoreRow } from '../types';

/** Where a score lands in the table, or -1: a score equal to or above a row takes that row. */
export function qualifyingRow(scores: readonly HighScoreRow[], score: number): number {
  for (let i = 0; i < scores.length; i++) if (score >= scores[i].score) return i;
  return -1;
}

/** Insert a blank row for the player at `row`, dropping the last row. */
export function insertRow(scores: HighScoreRow[], row: number, score: number): void {
  scores.splice(row, 0, { initials: '', score });
  scores.length = 10;
}

/** Begin the initials entry for a qualifying score. */
export function beginInitials(state: GameState, row: number): void {
  insertRow(state.highScores, row, state.score);
  state.initials = { row, letters: [], hover: null, frame: 0 };
  state.mode = 'initials';
  state.modeFrames = 0;
  state.fireHeld = true;
  state.events.push({ type: 'highScore', row });
  state.events.push({ type: 'music', cue: 'cantina' });
}

/** The alphabet item under the cursor: within 24 units on each axis and 32 combined. */
export function hoveredItem(state: GameState): string | null {
  const c = state.player.cursor;
  const cx = c.x + ATTRACT.hoverCursorOffset.x;
  const cy = c.y + ATTRACT.hoverCursorOffset.y;
  const done = state.initials.letters.length >= 3;
  for (const item of INITIALS_ALPHABET) {
    if (done && item.ch !== 'RUB' && item.ch !== 'END') continue;
    const dx = Math.abs(cx - item.x);
    const dy = Math.abs(cy - item.y);
    if (dx <= ATTRACT.hoverBox && dy <= ATTRACT.hoverBox && dx + dy < ATTRACT.hoverOctagon) return item.ch;
  }
  return done ? 'END' : null;
}

/** One frame of initials entry: track the hovered item, commit on a trigger edge, time out at 32 seconds. */
export function stepInitialsFrame(state: GameState, fire: boolean): boolean {
  const e = state.initials;
  e.frame += 1;
  e.hover = hoveredItem(state);
  const press = fire && !state.fireHeld;
  state.fireHeld = fire;
  const row = state.highScores[e.row];
  if (press && e.hover !== null) {
    if (e.hover === 'END') {
      row.initials = e.letters.join('').padEnd(3, ' ').trimEnd();
      state.events.push({ type: 'sound', name: 'torpedo' });
      finish(state);
      return true;
    }
    if (e.hover === 'RUB') {
      if (e.letters.length > 0) e.letters.pop();
      state.events.push({ type: 'sound', name: 'shotDestroyed' });
    } else if (e.letters.length < 3) {
      e.letters.push(e.hover);
      state.events.push({ type: 'sound', name: 'laser' });
    }
    row.initials = e.letters.join('');
  }
  if (e.frame >= ATTRACT.initialsTimeoutFrames) {
    row.initials = e.letters.join('');
    finish(state);
    return true;
  }
  return false;
}

function finish(state: GameState): void {
  state.events.push({ type: 'initialsDone' });
}
