import { describe, expect, it } from 'vitest';
import { HIGH_SCORE_DEFAULTS } from '../../data/attract';
import { ATTRACT } from '../config';
import { createInitialState } from '../state';
import { FIRE, IDLE, runFrame, runFrames } from '../testUtils';
import { visibleStars } from '../dogfight/stars';
import { storyLineScale } from './index';
import { beginInitials, hoveredItem, qualifyingRow } from './highScores';

describe('attract cycle', () => {
  it('slides the stars left to right on the instructions page and downward on the scoring page', () => {
    const drift = (phase: string): { dx: number; dy: number } => {
      const state = createInitialState(1);
      while (state.attract.phase !== phase) runFrame(state);
      runFrames(state, 5);
      const before = state.dogfight.stars.map((s) => ({ ...s.pos }));
      const from = new Map(visibleStars(state).map((s) => [s.index, s]));
      runFrames(state, 4);
      let dx = 0;
      let dy = 0;
      for (const s of visibleStars(state)) {
        const was = from.get(s.index);
        const p = state.dogfight.stars[s.index].pos;
        if (!was || p.x !== before[s.index].x || p.y !== before[s.index].y || p.z !== before[s.index].z) continue;
        dx += s.x - was.x;
        dy += s.y - was.y;
      }
      return { dx, dy };
    };
    expect(drift('instructions').dx).toBeGreaterThan(0);
    expect(Math.abs(drift('instructions').dy)).toBeLessThan(drift('instructions').dx / 10);
    expect(drift('scoring').dy).toBeLessThan(0);
  });

  it('runs high scores, banner, instructions, scoring, and round again with the original timings', () => {
    const state = createInitialState(1);
    expect(state.attract.phase).toBe('highScores');
    runFrames(state, ATTRACT.highScoresFrames);
    expect(state.attract.phase).toBe('banner');
    runFrames(state, ATTRACT.bannerFrames);
    expect(state.attract.phase).toBe('instructions');
    runFrames(state, ATTRACT.pageFrames);
    expect(state.attract.phase).toBe('scoring');
    runFrames(state, ATTRACT.pageFrames);
    expect(state.attract.phase).toBe('highScores');
  });

  it('the storyline lines start at their alarms, grow, hold, then race away one at a time', () => {
    const state = createInitialState(1);
    runFrames(state, ATTRACT.highScoresFrames);
    runFrames(state, 64);
    expect(storyLineScale(state, 0)).toBe(-1);
    runFrames(state, 2);
    expect(storyLineScale(state, 0)).toBeGreaterThanOrEqual(0);
    runFrames(state, 158);
    const held = storyLineScale(state, 0);
    runFrames(state, 100);
    expect(storyLineScale(state, 0)).toBe(held);
    runFrames(state, 60);
    expect(storyLineScale(state, 0)).toBe(-1);
    expect(storyLineScale(state, 1)).toBeGreaterThan(held);
  });

  it('a trigger pull starts a game from any attract screen', () => {
    const state = createInitialState(1);
    runFrames(state, 300);
    runFrame(state, FIRE);
    expect(state.mode).toBe('select');
  });
});

describe('high scores', () => {
  it('starts with the arcade defaults', () => {
    const state = createInitialState(1);
    expect(state.highScores[0]).toEqual({ initials: 'OBI', score: 1285353 });
    expect(state.highScores.length).toBe(HIGH_SCORE_DEFAULTS.length);
  });

  it('qualifies at or above a row and pushes the rest down', () => {
    const state = createInitialState(1);
    expect(qualifyingRow(state.highScores, 380655)).toBe(9);
    expect(qualifyingRow(state.highScores, 380654)).toBe(-1);
    expect(qualifyingRow(state.highScores, 2000000)).toBe(0);
    state.score = 1000000;
    beginInitials(state, 3);
    expect(state.highScores[3]).toEqual({ initials: '', score: 1000000 });
    expect(state.highScores[4].initials).toBe('GJR');
    expect(state.highScores.length).toBe(10);
  });

  it('initials are chosen by hovering and pulling the trigger, END finishes, RUB steps back', () => {
    const state = createInitialState(1);
    state.score = 1000000;
    beginInitials(state, 3);
    state.fireHeld = false;
    const aim = (x: number, y: number) => {
      const px = Math.round((x - ATTRACT.hoverCursorOffset.x) / 4);
      const py = Math.round((y - ATTRACT.hoverCursorOffset.y) / 4);
      state.player.cursorPot = { x: px, y: py };
      state.player.cursor = { x: px * 4, y: py * 4 };
      return { x: px / 127, y: py / 127 };
    };
    let a = aim(-292, -92);
    expect(hoveredItem(state)).toBe('A');
    runFrame(state, { ...a, fire: true });
    runFrame(state, { ...a, fire: false });
    expect(state.initials.letters).toEqual(['A']);
    a = aim(284, -140);
    expect(hoveredItem(state)).toBe('RUB');
    runFrame(state, { ...a, fire: true });
    runFrame(state, { ...a, fire: false });
    expect(state.initials.letters).toEqual([]);
    a = aim(-244, -476);
    runFrame(state, { ...a, fire: true });
    runFrame(state, { ...a, fire: false });
    a = aim(284, -92);
    expect(hoveredItem(state)).toBe('END');
    runFrame(state, { ...a, fire: true });
    expect(state.mode).toBe('attract');
    expect(state.attract.phase).toBe('highScores');
    expect(state.highScores[3].initials).toBe('J');
  });

  it('entry times out after 640 frames', () => {
    const state = createInitialState(1);
    state.score = 1000000;
    beginInitials(state, 0);
    runFrames(state, ATTRACT.initialsTimeoutFrames + 1, IDLE);
    expect(state.mode).toBe('attract');
  });
});
