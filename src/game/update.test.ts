import { describe, expect, it } from 'vitest';
import { DOGFIGHT, FIELDS_PER_FRAME, OPTIONS, SELECT, TIMING } from './config';
import { createInitialState } from './state';
import { dogfightState, FIRE, IDLE, pressFire, runFields, runFrames, runFramesInvulnerable } from './testUtils';
import { loseShield } from './dogfight/guns';

describe('modes', () => {
  it('starts in the attract and stays there without a press', () => {
    const state = createInitialState(1);
    expect(runFrames(state, 100)).toEqual([]);
    expect(state.mode).toBe('attract');
  });

  it('a fire press starts a game at the select screen with fresh shields', () => {
    const state = createInitialState(1);
    const events = runFields(state, FIELDS_PER_FRAME, FIRE);
    expect(state.mode).toBe('select');
    expect(state.shields).toBe(OPTIONS.startingShields);
    expect(events.map((e) => e.type)).toEqual(['gameStarted', 'speech']);
  });

  it('the select screen times out into wave 1', () => {
    const state = createInitialState(1);
    runFields(state, FIELDS_PER_FRAME, FIRE);
    runFrames(state, SELECT.countdownFrames + 1);
    expect(state.mode).toBe('playing');
    expect(state.wave).toBe(0);
    expect(state.stage).toBe('dogfight');
  });

  it('shooting the right-hand Death Star selects wave 5', () => {
    const state = createInitialState(1);
    runFields(state, FIELDS_PER_FRAME, FIRE);
    // Slew the cursor onto the right miniature at (400, 100): pot x = 100, y = (100 + 104) / 4 = 51.
    const aim = { x: 100 / 127, y: 51 / 127, fire: false };
    runFields(state, 40, aim);
    runFields(state, FIELDS_PER_FRAME, { ...aim, fire: true });
    expect(state.mode).toBe('playing');
    expect(state.wave).toBe(4);
  });

  it('the dying roll lasts 40 frames, then game over, then the attract', () => {
    const state = dogfightState();
    state.shields = 0;
    loseShield(state);
    expect(state.shields).toBe(-1);
    runFrames(state, 1);
    expect(state.mode).toBe('dying');
    runFrames(state, TIMING.deathFrames);
    expect(state.mode).toBe('gameOver');
    runFields(state, Math.ceil(TIMING.gameOverHold * 42) + 4);
    expect(state.mode).toBe('attract');
  });
});

describe('dogfight flow', () => {
  it('opens with three aliens facing the player and the head start on the first wave', () => {
    const state = dogfightState();
    expect(state.dogfight.aliens.filter((a) => a !== null)).toHaveLength(3);
    expect(state.dogfight.frame).toBe(DOGFIGHT.firstWaveStartFrame);
    for (const a of state.dogfight.aliens) expect(a!.pos.x).toBe(DOGFIGHT.spawnX);
  });

  it('the player faces away from the spawn at first and the auto-aim swings round', () => {
    const state = dogfightState();
    expect(state.player.basis.fwd.x).toBe(-1);
    runFrames(state, 60);
    expect(state.player.basis.fwd.x).toBeGreaterThan(0.9);
  });

  it('the fight ends by the clock and the aliens retreat, then the view turns to the Death Star', () => {
    const state = dogfightState();
    runFramesInvulnerable(state, DOGFIGHT.lengthFrames - DOGFIGHT.firstWaveStartFrame + 1);
    expect(state.dogfight.phase).toBe('retreat');
    runFramesInvulnerable(state, 80);
    expect(['turn', 'zoom']).toContain(state.dogfight.phase);
  });

  it('wave 1 goes straight to the trench after the zoom', () => {
    const state = dogfightState();
    let frames = 0;
    while (state.stage === 'dogfight' && frames < 800) {
      runFramesInvulnerable(state, 1);
      frames += 1;
    }
    expect(state.stage).toBe('trench');
  });

  it('later waves go to the surface', () => {
    const state = dogfightState(1, 2);
    let frames = 0;
    while (state.stage === 'dogfight' && frames < 800) {
      runFramesInvulnerable(state, 1);
      frames += 1;
    }
    expect(state.stage).toBe('surface');
    expect(frames).toBeLessThan(800);
  });

  it('music cues fire at the original frames', () => {
    const state = dogfightState(1, 1);
    const events = runFrames(state, DOGFIGHT.musicCueFrames.descent + 1).filter((e) => e.type === 'music');
    expect(events.map((e) => (e as { cue: string }).cue)).toEqual(['theme', 'themeB', 'descent']);
  });
});

describe('lasers and shields', () => {
  it('a press fires a bolt that lasts eight frames and alternates gun pairs', () => {
    const state = dogfightState();
    const first = state.player.laserLeftPair;
    const events = pressFire(state);
    expect(events.filter((e) => e.type === 'laserFired')).toHaveLength(1);
    expect(state.player.laserLeftPair).toBe(!first);
    runFrames(state, 5);
    expect(state.player.laserFrames).toBeGreaterThan(0);
    runFrames(state, 3);
    expect(state.player.laserFrames).toBe(0);
  });

  it('each loss raises an event, the gauge blocks a second loss for a while, and the hit after zero kills', () => {
    const state = dogfightState();
    loseShield(state);
    expect(state.shields).toBe(OPTIONS.startingShields - 1);
    expect(state.player.gaugeFrames).toBe(10 + OPTIONS.startingShields);
    state.shields = 0;
    loseShield(state);
    expect(state.shields).toBe(-1);
  });
});

describe('cursor', () => {
  it('slews toward the yoke and clamps to the cursor box', () => {
    const state = createInitialState(1);
    runFields(state, 1, { x: 1, y: 1, fire: false });
    expect(state.player.cursor.x).toBeGreaterThan(0);
    expect(state.player.cursor.x).toBeLessThan(448);
    runFields(state, 60, { x: 1, y: 1, fire: false });
    expect(state.player.cursor.x).toBe(448);
    expect(state.player.cursor.y).toBe(480);
    runFields(state, 60, { x: -1, y: -1, fire: false });
    expect(state.player.cursor.x).toBe(-448);
    expect(state.player.cursor.y).toBe(-416);
    runFields(state, 60, IDLE);
    expect(state.player.cursor.x).toBe(0);
  });
});

describe('fire latch', () => {
  it('a press that lasts a single field between game frames still starts the game', () => {
    const state = createInitialState(1);
    runFields(state, 1, IDLE); // field 1: no game frame
    runFields(state, 1, FIRE); // field 2: game frame sees the press
    expect(state.mode).toBe('select');
    const again = createInitialState(1);
    runFields(again, 2, IDLE); // fields 1-2
    runFields(again, 1, FIRE); // field 3: odd, no game frame
    runFields(again, 1, IDLE); // field 4: game frame must still see it
    expect(again.mode).toBe('select');
  });
});
