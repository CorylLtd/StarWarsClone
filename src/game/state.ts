import { OPTIONS } from './config';
import { createRng } from './random';
import type { GameState } from './types';

export function createInitialState(seed: number, highScore: number = 0): GameState {
  return {
    mode: 'attract',
    time: 0,
    modeTime: 0,
    wave: 1,
    stage: 'dogfight',
    stageTime: 0,
    score: 0,
    highScore,
    shields: OPTIONS.startingShields,
    cursor: { x: 0, y: 0 },
    view: { yaw: 0, pitch: 0, roll: 0 },
    fireHeld: false,
    rng: createRng(seed),
    events: [],
  };
}
