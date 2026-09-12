import type { Rng } from './random';

/** Top-level mode: what the cabinet is doing. */
export type Mode = 'attract' | 'playing' | 'gameOver';

/** The three stages of a wave, in order. */
export type StageKind = 'dogfight' | 'surface' | 'trench';

/**
 * One snapshot of the yoke and buttons. `x` is +1 pushed fully right, `y` is
 * +1 pulled fully back (cursor up), both 0 at rest. `fire` is any of the four
 * yoke buttons; `start` is the cabinet's start button.
 */
export interface Input {
  x: number;
  y: number;
  fire: boolean;
  start: boolean;
}

/** Normalised screen coordinates: x and y in [-1, 1], origin at the centre, y up. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Where the player is looking, driven by the yoke. Radians. */
export interface View {
  yaw: number;
  pitch: number;
  roll: number;
}

export type GameEvent =
  | { type: 'gameStarted' }
  | { type: 'stageStarted'; stage: StageKind; wave: number }
  | { type: 'waveCompleted'; wave: number }
  | { type: 'laserFired' }
  | { type: 'shieldLost'; remaining: number }
  | { type: 'gameOver' };

export interface GameState {
  mode: Mode;
  /** Seconds since the state was created. */
  time: number;
  /** Seconds since the current mode or stage began. */
  modeTime: number;
  wave: number;
  stage: StageKind;
  stageTime: number;
  score: number;
  highScore: number;
  /** Deflector Shields remaining. */
  shields: number;
  cursor: ScreenPoint;
  view: View;
  /** True while a fire button is held, so a held button fires only once. */
  fireHeld: boolean;
  rng: Rng;
  /** Events raised by the most recent step. Cleared at the start of every step. */
  events: GameEvent[];
}
