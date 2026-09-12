import { ATTRACT, FIELDS_PER_FRAME, IRQ_HZ, VG_FIELD_IRQS } from '../config';
import { reversedBasis } from '../frame';
import { initStars, stepStars } from '../dogfight/stars';
import { nextFloat } from '../random';
import type { AttractPhase, GameState } from '../types';

const PHASE_ORDER: AttractPhase[] = ['highScores', 'banner', 'instructions', 'scoring'];
const TUNES = ['ben', 'cantina', 'end', 'rebelRepeats', 'themeB', 'theme', 'rebel', 'fourths', 'vader'];

/** Enter the attract at a given screen: after power-up and initials the table, after a game the banner. */
export function enterAttract(state: GameState, phase: AttractPhase): void {
  const a = state.attract;
  a.phase = phase;
  a.frame = 0;
  a.storyScale = [-1, -1, -1, -1, -1, -1, -1, -1];
  a.racing = -1;
  state.player.basis = reversedBasis();
  state.dogfight.frame = 0;
  initStars(state);
  if (phase === 'banner') startBanner(state);
}

function startBanner(state: GameState): void {
  const a = state.attract;
  const interval = ATTRACT.musicIntervalSeconds * (IRQ_HZ / VG_FIELD_IRQS / FIELDS_PER_FRAME);
  if (a.musicClock >= interval) {
    a.musicClock = 0;
    state.events.push({ type: 'music', cue: TUNES[Math.floor(nextFloat(state.rng) * TUNES.length)] });
  }
}

/** One game frame of the attract cycle. */
export function stepAttractFrame(state: GameState): void {
  const a = state.attract;
  a.frame += 1;
  a.musicClock += 1;
  state.dogfight.frame += 1;
  stepStars(state);
  switch (a.phase) {
    case 'highScores':
      if (a.frame >= ATTRACT.highScoresFrames) next(state);
      break;
    case 'banner':
      stepBanner(state);
      if (a.frame >= ATTRACT.bannerFrames) next(state);
      break;
    case 'instructions':
    case 'scoring':
      if (a.frame >= ATTRACT.pageFrames) next(state);
      break;
  }
}

function next(state: GameState): void {
  const i = PHASE_ORDER.indexOf(state.attract.phase);
  enterAttract(state, PHASE_ORDER[(i + 1) % PHASE_ORDER.length]);
}

/**
 * The storyline: each line starts at its alarm frame at scale 0 and grows one
 * per frame until the hold; after the hold the lines resume, the first racing
 * away four per frame, and each vanishing line hands the race to the next.
 */
function stepBanner(state: GameState): void {
  const a = state.attract;
  const n = a.frame;
  const starts = [65, 80, 96, 112, 128, 144, 160, 184];
  for (let i = 0; i < 8; i++) {
    if (a.storyScale[i] < 0 && n >= starts[i]) a.storyScale[i] = 0;
  }
  if (n >= 64 && n < ATTRACT.storyGrowUntil) {
    for (let i = 0; i < 8; i++) if (a.storyScale[i] >= 0) a.storyScale[i] += 1;
  } else if (n >= ATTRACT.storyHoldUntil) {
    if (a.racing < 0) a.racing = 0;
    for (let i = 0; i < 8; i++) {
      if (a.storyScale[i] < 0 || a.storyScale[i] >= ATTRACT.storyGoneAt) continue;
      a.storyScale[i] += i === a.racing ? ATTRACT.storyRaceStep : 1;
      if (a.storyScale[i] >= ATTRACT.storyGoneAt) {
        a.storyScale[i] = ATTRACT.storyGoneAt;
        if (i === a.racing) a.racing += 1;
      }
    }
  }
}

/** The linear scale of a storyline line, or -1 when not shown. */
export function storyLineScale(state: GameState, i: number): number {
  const s = state.attract.storyScale[i];
  return s < 0 || s >= ATTRACT.storyGoneAt ? -1 : s;
}
