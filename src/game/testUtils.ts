import { DT } from './config';
import { createInitialState } from './state';
import type { GameEvent, GameState, Input } from './types';
import { beginWave, startGame, step } from './update';

export const IDLE: Input = { x: 0, y: 0, fire: false };
export const FIRE: Input = { x: 0, y: 0, fire: true };

/** A state already in the Dogfight of the given wave, with no events pending. */
export function dogfightState(seed = 1, wave = 0): GameState {
  const state = createInitialState(seed);
  startGame(state);
  beginWave(state, wave);
  state.events.length = 0;
  state.fireHeld = false;
  return state;
}

/** Step `fields` vector-generator fields under constant input and return every event raised. */
export function runFields(state: GameState, fields: number, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < fields; i++) {
    step(state, input, DT);
    out.push(...state.events);
  }
  return out;
}

/** Step fields until one game frame has run (how many fields that takes depends on the screen's pace). */
export function runFrame(state: GameState, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  const target = state.frame + 1;
  while (state.frame < target) {
    step(state, input, DT);
    out.push(...state.events);
  }
  return out;
}

/** Step whole game frames. */
export function runFrames(state: GameState, frames: number, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < frames; i++) out.push(...runFrame(state, input));
  return out;
}

/** Press fire through one game frame, then release for one. */
export function pressFire(state: GameState): GameEvent[] {
  return [...runFrame(state, FIRE), ...runFrame(state, IDLE)];
}

/** Step whole game frames with the shields topped up every frame, so flow tests outlive the fireballs. */
export function runFramesInvulnerable(state: GameState, frames: number, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < frames; i++) {
    state.shields = Math.max(state.shields, 6);
    out.push(...runFrame(state, input));
  }
  return out;
}
