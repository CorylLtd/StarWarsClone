import { describe, expect, it } from 'vitest';
import { DT, OPTIONS, TIMING, YOKE } from './config';
import { createInitialState } from './state';
import { IDLE, playingState, runCollect } from './testUtils';
import { advanceStage, loseShield, step } from './update';

describe('modes', () => {
  it('starts in the attract and stays there without a start press', () => {
    const state = createInitialState(1);
    expect(runCollect(state, 600)).toEqual([]);
    expect(state.mode).toBe('attract');
  });

  it('a start press begins a game in the Dogfight of wave 1', () => {
    const state = createInitialState(1);
    const events = runCollect(state, 1, { ...IDLE, start: true });
    expect(state.mode).toBe('playing');
    expect(state.stage).toBe('dogfight');
    expect(state.wave).toBe(1);
    expect(state.shields).toBe(OPTIONS.startingShields);
    expect(events.map((e) => e.type)).toEqual(['gameStarted', 'stageStarted']);
  });

  it('start does nothing during play', () => {
    const state = playingState();
    expect(runCollect(state, 10, { ...IDLE, start: true })).toEqual([]);
    expect(state.mode).toBe('playing');
  });

  it('the game over screen holds, then returns to the attract', () => {
    const state = playingState();
    state.shields = 0;
    loseShield(state);
    expect(state.mode).toBe('gameOver');
    runCollect(state, Math.floor(TIMING.gameOverHold / DT) - 1);
    expect(state.mode).toBe('gameOver');
    runCollect(state, 2);
    expect(state.mode).toBe('attract');
  });
});

describe('stages and waves', () => {
  it('advances Dogfight, Surface, Trench, then a new wave', () => {
    const state = playingState();
    advanceStage(state);
    expect(state.stage).toBe('surface');
    advanceStage(state);
    expect(state.stage).toBe('trench');
    const before = state.events.length;
    advanceStage(state);
    expect(state.stage).toBe('dogfight');
    expect(state.wave).toBe(2);
    expect(state.events.slice(before).map((e) => e.type)).toEqual(['waveCompleted', 'stageStarted']);
  });

  it('resets stage time on every stage change', () => {
    const state = playingState();
    runCollect(state, 30);
    expect(state.stageTime).toBeGreaterThan(0);
    advanceStage(state);
    expect(state.stageTime).toBe(0);
  });
});

describe('firing', () => {
  it('fires once per press, not while held', () => {
    const state = playingState();
    const held = runCollect(state, 5, { ...IDLE, fire: true });
    expect(held.filter((e) => e.type === 'laserFired')).toHaveLength(1);
    runCollect(state, 1);
    const again = runCollect(state, 1, { ...IDLE, fire: true });
    expect(again.filter((e) => e.type === 'laserFired')).toHaveLength(1);
  });

  it('the press that starts the game does not also fire', () => {
    const state = createInitialState(1);
    const events = runCollect(state, 3, { ...IDLE, start: true, fire: true });
    expect(events.some((e) => e.type === 'laserFired')).toBe(false);
  });
});

describe('shields', () => {
  it('each loss raises an event until none remain, then the game ends', () => {
    const state = playingState();
    state.score = 500;
    for (let i = OPTIONS.startingShields; i > 0; i--) {
      loseShield(state);
      expect(state.shields).toBe(i - 1);
      expect(state.mode).toBe('playing');
    }
    loseShield(state);
    expect(state.mode).toBe('gameOver');
    expect(state.highScore).toBe(500);
  });
});

describe('yoke', () => {
  it('moves the cursor and swings the view, clamped to full deflection', () => {
    const state = createInitialState(1);
    step(state, { x: 2, y: -0.5, fire: false, start: false }, DT);
    expect(state.cursor.x).toBeCloseTo(YOKE.cursorRangeX);
    expect(state.cursor.y).toBeCloseTo(-0.5 * YOKE.cursorRangeY);
    expect(state.view.yaw).toBeCloseTo(-YOKE.maxYaw);
    expect(state.view.pitch).toBeCloseTo(-0.5 * YOKE.maxPitch);
  });
});
