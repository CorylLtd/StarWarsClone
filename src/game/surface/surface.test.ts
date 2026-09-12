import { describe, expect, it } from 'vitest';
import { MAZES } from '../../data/surface';
import { SCORING, SURFACE, VG } from '../config';
import { vec } from '../frame';
import { createInitialState } from '../state';
import { FIRE, runFields, runFrame, runFrames } from '../testUtils';
import { beginWave, enterStage, startGame } from '../update';
import { checkCollisions, distanceShrink, distanceTo, viewBuildings } from './buildings';

function surfaceState(wave = 2): ReturnType<typeof createInitialState> {
  const state = createInitialState(5);
  startGame(state);
  beginWave(state, wave);
  enterStage(state, 'surface');
  state.events.length = 0;
  state.fireHeld = false;
  return state;
}

/** Aim the cursor at a screen point (VG units) and hold it there. */
function aimAt(state: ReturnType<typeof createInitialState>, x: number, y: number) {
  const px = Math.round(x / 4);
  const py = Math.round(y / 4);
  state.player.cursorPot = { x: px, y: py };
  state.player.cursorTarget = { x: px, y: py };
  state.player.cursor = { x: px * 4, y: py * 4 };
  return { x: px / 127, y: py / 127, fire: true };
}

describe('surface flow', () => {
  it('loads the maze for the wave with its towers counted, high and slow', () => {
    const state = surfaceState(2); // displayed wave 3: SQUARE
    expect(state.surface.buildings.length).toBe(MAZES.TSQUARE.length);
    expect(state.surface.towersLeft).toBe(MAZES.TSQUARE.filter((e) => e.type !== 'bunker').length);
    expect(state.surface.pos.z).toBe(SURFACE.startAltitude);
    expect(state.surface.speed).toBe(SURFACE.speedStart);
  });

  it('clamps altitude on the first move and ramps the speed', () => {
    const state = surfaceState(2);
    runFrames(state, 1);
    expect(state.surface.pos.z).toBe(SURFACE.maxAltitude);
    runFrames(state, 40);
    expect(state.surface.speed).toBe(SURFACE.speedStart + 41);
  });

  it('laps tick when the 16-bit forward position overflows, first after one lap then every two', () => {
    const state = surfaceState(2);
    let frames = 0;
    while (state.surface.laps < 1 && frames < 400) {
      runFrames(state, 1);
      frames += 1;
    }
    const firstLap = frames;
    expect(state.surface.laps).toBe(1);
    while (state.surface.laps < 2 && frames < 800) {
      runFrames(state, 1);
      frames += 1;
    }
    expect(frames - firstLap).toBeGreaterThan(firstLap / 2);
  });

  it('runs about 593 frames, then rolls through the transition into the trench', () => {
    const state = surfaceState(2);
    let frames = 0;
    while (state.surface.phase === 'flying' && frames < 1000) {
      state.shields = 6;
      runFrames(state, 1);
      frames += 1;
    }
    expect(frames).toBeGreaterThan(550);
    expect(frames).toBeLessThan(650);
    expect(state.events.some((e) => e.type === 'speech')).toBe(true);
    let more = 0;
    while (state.stage === 'surface' && more < 100) {
      runFrames(state, 1);
      more += 1;
    }
    expect(state.stage).toBe('trench');
    expect(more).toBe(2 * SURFACE.transitionFrames);
  });

  it('the yoke moves the ship sideways and down and banks the view', () => {
    const state = surfaceState(2);
    runFields(state, 200, { x: 1, y: -1, fire: false });
    expect(state.surface.pos.y).toBeGreaterThan(0);
    expect(state.surface.pos.z).toBe(SURFACE.minAltitude);
    expect(state.surface.bankTics).toBeGreaterThan(100);
    expect(state.player.basis.up.y).toBeGreaterThan(0);
  });
});

describe('surface combat', () => {
  function parkTower(state: ReturnType<typeof createInitialState>, distance: number) {
    const tower = state.surface.buildings.find((b) => b.type === 'tower')!;
    state.surface.buildings = [tower];
    tower.sequence = 0;
    tower.pos = vec((state.surface.pos.x + distance) % 32768, state.surface.pos.y, 0);
    state.surface.pos.z = SURFACE.maxAltitude;
    viewBuildings(state);
    expect(tower.seen).not.toBeNull();
    return tower;
  }

  it('shooting a tower hat scores the progressive value and leaves a stub', () => {
    const state = surfaceState(2);
    const tower = parkTower(state, 20000);
    const d = distanceTo(state, tower);
    const k = (VG.focal / d) * distanceShrink(d);
    const base = (VG.focal * -state.surface.pos.z) / d;
    const input = aimAt(state, 0, base + (SURFACE.hatBottom + 300) * k);
    const events = runFrame(state, input);
    expect(events.some((e) => e.type === 'towerTopHit')).toBe(true);
    expect(tower.damaged).toBe(true);
    expect(state.score).toBe(SURFACE.towerPointsStart);
    expect(state.surface.nextTowerPoints).toBe(SURFACE.towerPointsStart + SURFACE.towerPointsStep);
  });

  it('shooting the tower body only splashes', () => {
    const state = surfaceState(2);
    const tower = parkTower(state, 20000);
    const d = distanceTo(state, tower);
    const k = (VG.focal / d) * distanceShrink(d);
    const base = (VG.focal * -state.surface.pos.z) / d;
    const input = aimAt(state, 0, base + 2000 * k);
    const events = runFrame(state, input);
    expect(events.some((e) => e.type === 'laserSplash')).toBe(true);
    expect(tower.damaged).toBe(false);
    expect(state.score).toBe(0);
  });

  it('a bunker scores 200', () => {
    const state = surfaceState(1); // displayed wave 2: BUNK
    const bunker = state.surface.buildings.find((b) => b.type === 'bunker')!;
    bunker.sequence = 0;
    bunker.pos = vec(state.surface.pos.x + 6000, state.surface.pos.y, 0);
    state.surface.pos.z = SURFACE.minAltitude;
    viewBuildings(state);
    const d = distanceTo(state, bunker);
    const k = (VG.focal / d) * distanceShrink(d);
    const base = (VG.focal * -state.surface.pos.z) / d;
    const input = aimAt(state, 0, base + 700 * k);
    const events = runFrame(state, input);
    expect(events.some((e) => e.type === 'bunkerHit')).toBe(true);
    expect(state.score).toBe(SCORING.laserBunker);
  });

  it('flying into a tower costs a shield at any height; a bunker only when flying low', () => {
    const state = surfaceState(2);
    const tower = state.surface.buildings.find((b) => b.type === 'tower')!;
    tower.sequence = 0;
    tower.pos = vec(state.surface.pos.x + 800, state.surface.pos.y + 100, 0);
    state.surface.pos.z = SURFACE.maxAltitude;
    viewBuildings(state);
    const before = state.shields;
    checkCollisions(state);
    expect(state.shields).toBe(before - 1);
    const low = surfaceState(1);
    const bunker = low.surface.buildings.find((b) => b.type === 'bunker')!;
    bunker.sequence = 0;
    bunker.pos = vec(low.surface.pos.x + 800, low.surface.pos.y, 0);
    low.surface.pos.z = SURFACE.maxAltitude;
    viewBuildings(low);
    checkCollisions(low);
    expect(low.shields).toBe(before);
    low.surface.pos.z = SURFACE.minAltitude;
    viewBuildings(low);
    checkCollisions(low);
    expect(low.shields).toBe(before - 1);
  });

  it('distances wrap so every building is ahead', () => {
    const state = surfaceState(2);
    state.surface.pos.x = 0x7000;
    const b = state.surface.buildings[0];
    b.pos = vec(0x1000, 0, 0);
    expect(distanceTo(state, b)).toBe(0x2000);
  });
});

void FIRE;
