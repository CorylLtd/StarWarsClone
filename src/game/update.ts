import { OPTIONS, TIMING, YOKE } from './config';
import { clamp } from './math';
import { STAGE_ORDER, STAGES } from './stages';
import type { GameState, Input, StageKind } from './types';

/** Advance the simulation by one fixed step. Never touches the outside world. */
export function step(state: GameState, input: Input, dt: number): void {
  state.events.length = 0;
  state.time += dt;
  state.modeTime += dt;
  applyYoke(state, input);

  switch (state.mode) {
    case 'attract':
      if (input.start) startGame(state);
      break;
    case 'playing':
      state.stageTime += dt;
      handleFire(state, input);
      STAGES[state.stage].step(state, input, dt);
      break;
    case 'gameOver':
      if (state.modeTime >= TIMING.gameOverHold) setMode(state, 'attract');
      break;
  }
}

/** The yoke moves the cursor and swings the view every step, in every mode. */
function applyYoke(state: GameState, input: Input): void {
  const x = clamp(input.x, -1, 1);
  const y = clamp(input.y, -1, 1);
  state.cursor.x = x * YOKE.cursorRangeX;
  state.cursor.y = y * YOKE.cursorRangeY;
  state.view.yaw = -x * YOKE.maxYaw;
  state.view.pitch = y * YOKE.maxPitch;
  state.view.roll = -x * YOKE.maxRoll;
}

/** A fire button raises `laserFired` on the press, not while held. */
function handleFire(state: GameState, input: Input): void {
  if (input.fire && !state.fireHeld) state.events.push({ type: 'laserFired' });
  state.fireHeld = input.fire;
}

function setMode(state: GameState, mode: GameState['mode']): void {
  state.mode = mode;
  state.modeTime = 0;
}

export function startGame(state: GameState): void {
  state.score = 0;
  state.wave = 1;
  state.shields = OPTIONS.startingShields;
  state.fireHeld = true; // the press that started the game must not also fire
  setMode(state, 'playing');
  state.events.push({ type: 'gameStarted' });
  enterStage(state, STAGE_ORDER[0]);
}

export function enterStage(state: GameState, stage: StageKind): void {
  state.stage = stage;
  state.stageTime = 0;
  STAGES[stage].enter(state);
  state.events.push({ type: 'stageStarted', stage, wave: state.wave });
}

/** Move to the next stage; after the Trench, the wave is complete and the next begins. */
export function advanceStage(state: GameState): void {
  const i = STAGE_ORDER.indexOf(state.stage);
  if (i === STAGE_ORDER.length - 1) {
    state.events.push({ type: 'waveCompleted', wave: state.wave });
    state.wave += 1;
    enterStage(state, STAGE_ORDER[0]);
  } else {
    enterStage(state, STAGE_ORDER[i + 1]);
  }
}

/**
 * Lose one Deflector Shield. The flight instructions say the shield "will
 * protect you for x collisions", so the game ends on the collision after the
 * last shield is gone. To be confirmed against the source.
 */
export function loseShield(state: GameState): void {
  if (state.shields > 0) {
    state.shields -= 1;
    state.events.push({ type: 'shieldLost', remaining: state.shields });
    return;
  }
  endGame(state);
}

export function endGame(state: GameState): void {
  if (state.score > state.highScore) state.highScore = state.score;
  setMode(state, 'gameOver');
  state.events.push({ type: 'gameOver' });
}
