import { FIELDS_PER_FRAME, OPTIONS, SELECT, TIMING } from './config';
import { stepCursor } from './cursor';
import { enterDogfight, stepDogfightFrame, stepDyingFrame } from './dogfight';
import { enterSurface, stepSurfaceFrame } from './surface';
import { enterTrench, stepTrenchFrame } from './trench';
import { reversedBasis } from './frame';
import { createDogfight, createPlayer } from './state';
import type { GameState, Input, StageKind } from './types';

/**
 * Advance the simulation by one vector-generator field. The cursor slews every
 * field, as the original's interrupt did; game logic runs every second field.
 */
export function step(state: GameState, input: Input, dt: number): void {
  state.events.length = 0;
  state.time += dt;
  state.field += 1;
  stepCursor(state.player, input);
  state.fireLatch = state.fireLatch || input.fire;
  if (state.field % FIELDS_PER_FRAME !== 0) return;
  stepFrame(state, { ...input, fire: state.fireLatch });
  state.fireLatch = false;
}

function stepFrame(state: GameState, input: Input): void {
  state.modeFrames += 1;
  if (state.lastScoreFade > 0) state.lastScoreFade = Math.max(0, state.lastScoreFade - 8);
  switch (state.mode) {
    case 'attract':
      if (input.fire && !state.fireHeld) startGame(state);
      state.fireHeld = input.fire;
      break;
    case 'select':
      stepSelect(state, input);
      break;
    case 'playing':
      stepPlaying(state, input);
      break;
    case 'dying':
      stepDyingFrame(state);
      if (state.modeFrames >= TIMING.deathFrames) endGame(state);
      break;
    case 'gameOver':
      if (state.modeFrames * FIELDS_PER_FRAME >= TIMING.gameOverHold * 42) setMode(state, 'attract');
      break;
  }
}

function setMode(state: GameState, mode: GameState['mode']): void {
  state.mode = mode;
  state.modeFrames = 0;
}

/** Start: "Red Five standing by", fresh shields and score, then the select-a-Death-Star screen. */
export function startGame(state: GameState): void {
  state.score = 0;
  state.lastScore = 0;
  state.lastScoreFade = 0;
  state.wave = 0;
  state.difficulty = OPTIONS.playDifficulty;
  state.difficultyBump = 0;
  state.firstWave = true;
  state.firstShieldHitDone = false;
  state.shields = OPTIONS.startingShields;
  state.player = createPlayer();
  state.dogfight = createDogfight();
  state.fireHeld = true;
  state.selectFrames = SELECT.countdownFrames;
  setMode(state, 'select');
  state.events.push({ type: 'gameStarted' });
  state.events.push({ type: 'speech', line: 'RED FIVE STANDING BY' });
}

/** Which select-screen Death Star the cursor is over, if any. */
export function selectTarget(state: GameState): number {
  const c = state.player.cursor;
  for (let i = 0; i < SELECT.positions.length; i++) {
    const p = SELECT.positions[i];
    const dx = Math.abs(c.x - p.x);
    const dy = Math.abs(c.y - 104 - p.y);
    if (dx < SELECT.hitDx && dy < SELECT.hitDy && dx + dy < SELECT.hitSum) return i;
  }
  return -1;
}

function stepSelect(state: GameState, input: Input): void {
  state.selectFrames -= 1;
  const press = input.fire && !state.fireHeld;
  state.fireHeld = input.fire;
  const over = selectTarget(state);
  if (press && over >= 0) {
    beginWave(state, SELECT.positions[over].wave);
    return;
  }
  if (state.selectFrames <= 0) beginWave(state, 0);
}

/** Face away from the Death Star and start the Dogfight of the given wave. */
export function beginWave(state: GameState, wave: number): void {
  state.wave = wave;
  state.player.basis = reversedBasis();
  state.player.rollFrames = 0;
  state.player.laserFrames = 0;
  state.player.laserHit = 0;
  state.fireHeld = true;
  setMode(state, 'playing');
  state.events.push({ type: 'waveSelected', wave });
  enterStage(state, 'dogfight');
}

export function enterStage(state: GameState, stage: StageKind): void {
  const previous = state.stage;
  state.stage = stage;
  state.stageFrames = 0;
  if (stage === 'dogfight') enterDogfight(state);
  if (stage === 'surface') enterSurface(state);
  if (stage === 'trench') enterTrench(state, state.stageFrames < 0 ? false : previous === 'surface');
  state.events.push({ type: 'stageStarted', stage, wave: state.wave });
}

function stepPlaying(state: GameState, input: Input): void {
  state.stageFrames += 1;
  switch (state.stage) {
    case 'dogfight': {
      const done = stepDogfightFrame(state, input);
      if (state.shields < 0) {
        setMode(state, 'dying');
        state.events.push({ type: 'playerDied' });
        return;
      }
      // Wave 1 skips the Surface and goes straight to the Trench.
      if (done) enterStage(state, state.wave === 0 ? 'trench' : 'surface');
      return;
    }
    case 'surface': {
      const done = stepSurfaceFrame(state, input);
      if (state.shields < 0) {
        setMode(state, 'dying');
        state.events.push({ type: 'playerDied' });
        return;
      }
      if (done) enterStage(state, 'trench');
      return;
    }
    case 'trench': {
      const done = stepTrenchFrame(state, input);
      if (state.shields < 0) {
        setMode(state, 'dying');
        state.events.push({ type: 'playerDied' });
        return;
      }
      if (done) completeWave(state);
      return;
    }
  }
}

/** Between Death Stars: shield bonus, bonus shields, difficulty bump, next wave. */
export function completeWave(state: GameState): void {
  state.events.push({ type: 'waveCompleted', wave: state.wave });
  state.wave = Math.min(98, state.wave + 1);
  if (state.wave < 5) state.difficultyBump = Math.min(4, state.difficultyBump + 1);
  state.difficulty = Math.min(15, state.difficulty + state.difficultyBump);
  state.firstWave = false;
  state.player.basis = reversedBasis();
  enterStage(state, 'dogfight');
}

export function endGame(state: GameState): void {
  if (state.score > state.highScore) state.highScore = state.score;
  setMode(state, 'gameOver');
  state.events.push({ type: 'gameOver' });
}
