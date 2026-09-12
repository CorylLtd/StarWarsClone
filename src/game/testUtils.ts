import { DT } from './config';
import { createInitialState } from './state';
import type { GameEvent, GameState, Input } from './types';
import { startGame, step } from './update';

export const IDLE: Input = { x: 0, y: 0, fire: false, start: false };

export function playingState(seed = 1): GameState {
  const state = createInitialState(seed);
  startGame(state);
  state.events.length = 0;
  state.fireHeld = false;
  return state;
}

/** Step `n` times under constant input and return every event raised. */
export function runCollect(state: GameState, n: number, input: Input = IDLE): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    step(state, input, DT);
    out.push(...state.events);
  }
  return out;
}
