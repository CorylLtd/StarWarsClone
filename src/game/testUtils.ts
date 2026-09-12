import { DT, FIELDS_PER_FRAME } from './config';
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

/** Step whole game frames. */
export function runFrames(state: GameState, frames: number, input: Input = IDLE): GameEvent[] {
  return runFields(state, frames * FIELDS_PER_FRAME, input);
}

/** Press fire for one field, then release. */
export function pressFire(state: GameState): GameEvent[] {
  return [...runFields(state, FIELDS_PER_FRAME, FIRE), ...runFields(state, FIELDS_PER_FRAME, IDLE)];
}

/** Step whole game frames with the shields topped up every frame, so flow tests outlive the fireballs. */
export function runFramesInvulnerable(state: GameState, frames: number, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < frames; i++) {
    state.shields = Math.max(state.shields, 6);
    out.push(...runFields(state, FIELDS_PER_FRAME, input));
  }
  return out;
}
