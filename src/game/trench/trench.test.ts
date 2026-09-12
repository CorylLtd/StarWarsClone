import { describe, expect, it } from 'vitest';
import { PIES } from '../../data/trench';
import { SCORING, TRENCH } from '../config';
import { createInitialState } from '../state';
import { IDLE, runFields, runFrames } from '../testUtils';
import { beginWave, enterStage, startGame } from '../update';
import { bandAt, checkCatwalks } from './combat';
import { slotIndex } from './layout';

function trenchState(wave = 0) {
  const state = createInitialState(9);
  startGame(state);
  beginWave(state, wave);
  enterStage(state, 'trench');
  state.events.length = 0;
  state.fireHeld = false;
  return state;
}

describe('trench layout', () => {
  it('uses the fixed pie for the wave and pre-generates rows', () => {
    const state = trenchState(0);
    expect(state.trench.pie).toEqual([...PIES.PIE1]);
    expect(state.trench.rowStarts.length).toBeGreaterThan(5);
    expect(state.trench.farX).toBeGreaterThan(8192);
  });

  it('every trench is 331776 units long, port 4096 before the end', () => {
    for (const wave of [0, 3, 10]) {
      const state = trenchState(wave);
      let guard = 0;
      while (state.trench.endX === null && guard < 2000) {
        state.trench.pos.x += 4096;
        runFrames(state, 0);
        // generate by stepping the layout through a frame
        state.shields = 6;
        runFrames(state, 1);
        guard += 1;
      }
      expect(state.trench.endX).toBe(331776);
      expect(state.trench.portX).toBe(331776 - TRENCH.portToEnd);
    }
  });

  it('slot index wraps every sixteen slots', () => {
    expect(slotIndex(0)).toBe(0);
    expect(slotIndex(2048 * 17)).toBe(1);
  });
});

describe('trench flight', () => {
  it('starts at the top band from space and flies at 768 per frame', () => {
    const state = trenchState(0);
    runFrames(state, 1);
    expect(state.trench.pos.z).toBe(TRENCH.playerMaxZ);
    const x = state.trench.pos.x;
    runFrames(state, 10);
    expect(state.trench.pos.x - x).toBe(10 * TRENCH.speed);
  });

  it('the yoke moves sideways and down within the walls and floor', () => {
    const state = trenchState(0);
    runFields(state, 200, { x: 1, y: -1, fire: false });
    expect(state.trench.pos.y).toBe(TRENCH.playerMaxY);
    expect(state.trench.pos.z).toBe(TRENCH.playerMinZ);
  });

  it('runs about 432 frames, then a miss costs a shield and repeats the same trench harder', () => {
    const state = trenchState(0);
    const pie = [...state.trench.pie];
    let frames = 0;
    const events: string[] = [];
    while (state.trench.repeat === 0 && frames < 1000) {
      state.shields = 6;
      events.push(...runFrames(state, 1).map((e) => e.type));
      frames += 1;
    }
    expect(frames).toBeGreaterThan(400);
    expect(frames).toBeLessThan(460);
    expect(events).toContain('portMissed');
    expect(state.trench.repeat).toBe(1);
    expect(state.trench.pie).toEqual(pie);
    expect(state.trench.force).toBe(-1);
    expect(state.trench.pos.x).toBeLessThan(4096);
  });
});

describe('the Force', () => {
  it('is earned by not firing until the port row is generated', () => {
    const state = trenchState(2);
    let frames = 0;
    const events = [];
    while (state.trench.portX === null && frames < 1000) {
      state.shields = 6;
      events.push(...runFrames(state, 1));
      frames += 1;
    }
    expect(state.trench.force).toBe(1);
    expect(events.some((e) => e.type === 'forceBonus' && e.points === TRENCH.forceBonus[2])).toBe(true);
    expect(state.score).toBeGreaterThanOrEqual(TRENCH.forceBonus[2]);
  });

  it('is lost by firing', () => {
    const state = trenchState(0);
    runFields(state, 2, { x: 0, y: 0, fire: true });
    expect(state.trench.force).toBe(-1);
  });
});

describe('catwalks', () => {
  it('bands are 1024 tall around their centres', () => {
    expect(bandAt(-512)).toBe(0);
    expect(bandAt(-3584)).toBe(3);
    expect(bandAt(-1024)).toBe(0);
    expect(bandAt(-1025)).toBe(1);
  });

  it('a catwalk on the player side at the player band costs a shield in the first part of the slot', () => {
    const state = trenchState(0);
    const t = state.trench;
    t.pos.x = 2048 * 3 + 100;
    t.pos.y = -100;
    t.pos.z = -3584;
    t.slots[3].left = [0, 0, 0, 2];
    const before = state.shields;
    checkCatwalks(state);
    expect(state.shields).toBe(before - 1);
    // Other side or another band: no hit.
    const clear = trenchState(0);
    clear.trench.pos.x = 2048 * 3 + 100;
    clear.trench.pos.y = 100;
    clear.trench.pos.z = -3584;
    clear.trench.slots[3].left = [0, 0, 0, 2];
    checkCatwalks(clear);
    expect(clear.shields).toBe(before);
    clear.trench.pos.y = -100;
    clear.trench.pos.z = -512;
    checkCatwalks(clear);
    expect(clear.shields).toBe(before);
  });
});

describe('the exhaust port', () => {
  it('a laser ray onto the floor near the port launches the torpedo, and the end wall then destroys the Death Star', () => {
    const state = trenchState(0);
    const t = state.trench;
    // Generate the whole trench first.
    while (t.endX === null) {
      t.pos.x += 4096;
      state.shields = 6;
      runFrames(state, 1);
    }
    // Fly low, well before the port, and aim straight down the middle so the ray lands on the port.
    t.pos.z = TRENCH.playerMinZ;
    t.pos.y = 0;
    const height = t.pos.z - TRENCH.floorZ;
    const rsy = -104;
    const reach = (TRENCH.rayAhead * height) / (-TRENCH.rayPerPot * rsy);
    t.pos.x = t.portX! - reach;
    state.player.cursorPot = { x: 0, y: rsy };
    state.player.cursorTarget = { x: 0, y: rsy };
    state.player.cursor = { x: 0, y: rsy * 4 };
    const events = runFields(state, 2, { x: 0, y: rsy / 127, fire: true });
    expect(events.some((e) => e.type === 'torpedoFired'), 'torpedo fired').toBe(true);
    expect(t.torpedoFired).toBe(true);
    // Reach the end wall.
    let frames = 0;
    while (t.phase === 'flying' && frames < 200) {
      state.shields = 6;
      runFrames(state, 1);
      frames += 1;
    }
    expect(t.phase).toBe('explosion1');
    // Through the explosion and the accounting to the next wave.
    let more = 0;
    const scoreBefore = state.score;
    const all = [];
    while (state.stage === 'trench' && more < 600) {
      all.push(...runFrames(state, 1));
      more += 1;
    }
    expect(all.some((e) => e.type === 'deathStarDestroyed'), 'destroyed').toBe(true);
    expect(all.some((e) => e.type === 'waveCompleted'), 'wave completed').toBe(true);
    expect(state.score - scoreBefore).toBeGreaterThanOrEqual(SCORING.exhaustPort);
    expect(state.stage).toBe('dogfight');
    expect(state.wave).toBe(1);
  });
});

void IDLE;
