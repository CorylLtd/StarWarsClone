import { describe, expect, it } from 'vitest';
import { DARTH, LASER, SCORING } from '../config';
import { identityBasis, vec } from '../frame';
import { dogfightState, FIRE, IDLE, runFields, runFrames } from '../testUtils';
import { makeAlien } from './aliens';
import { hitAlien } from './aliens';

/** A dogfight with the player facing +X and a single alien parked straight ahead. */
function faceOff(kind: 'tie' | 'darth', distance = 8000) {
  const state = dogfightState(3, 1);
  state.player.basis = identityBasis();
  state.dogfight.aliens = [makeAlien({ kind, spot: vec(distance, 0, 0), script: kind === 'tie' ? 'TCH1A1' : 'TCH1D3' }), null, null];
  state.dogfight.liveCount = 1;
  return state;
}

describe('lasers versus aliens', () => {
  it('a TIE under the cursor is destroyed by a trigger pull and scores 1,000', () => {
    const state = faceOff('tie');
    // Freeze the alien in place so the test is about the hit test.
    const alien = state.dogfight.aliens[0]!;
    alien.script.timer = 10000;
    alien.script.flags = 0;
    const events = runFields(state, 2, FIRE);
    expect(events.some((e) => e.type === 'laserHitAlien' && e.destroyed)).toBe(true);
    expect(state.score).toBe(SCORING.tieFighter);
    // The slot is refilled by the next alien of the level list the same frame.
    expect(state.dogfight.aliens[0]!.pos.x).toBe(31744);
    expect(state.dogfight.explosions).toHaveLength(3);
    expect(state.player.laserHit).toBe(LASER.hitFreezeFrames);
  });

  it('a TIE off to the side of the cursor is missed', () => {
    const state = faceOff('tie');
    const alien = state.dogfight.aliens[0]!;
    alien.pos = vec(8000, 3000, 0);
    alien.script.timer = 10000;
    alien.script.flags = 0;
    const events = runFields(state, 2, FIRE);
    expect(events.some((e) => e.type === 'laserHitAlien')).toBe(false);
    expect(state.score).toBe(0);
  });

  it("Darth's Ship survives every hit, glows, and scores 2,000 each time", () => {
    const state = faceOff('darth');
    hitAlien(state, 0, 4000);
    const darth = state.dogfight.aliens[0]!;
    expect(darth).not.toBeNull();
    expect(darth.glow).toBe(DARTH.glowFrames);
    expect(state.score).toBe(SCORING.darthsShip);
    // Untouchable while glowing.
    hitAlien(state, 0, 4000);
    expect(state.score).toBe(SCORING.darthsShip);
    darth.glow = 0;
    hitAlien(state, 0, 4000);
    expect(state.score).toBe(2 * SCORING.darthsShip);
    expect(state.dogfight.aliens[0]).not.toBeNull();
  });

  it('explosion pieces tumble away and expire', () => {
    const state = faceOff('tie');
    hitAlien(state, 0, 4000);
    expect(state.dogfight.explosions).toHaveLength(3);
    runFrames(state, 30);
    expect(state.dogfight.explosions).toHaveLength(0);
  });
});

describe('lasers versus fireballs', () => {
  it('a fireball under the cursor is shot down for 33 points before it can hit', () => {
    const state = faceOff('tie');
    state.dogfight.aliens = [null, null, null];
    state.dogfight.liveCount = 0;
    state.dogfight.fireballs[5] = { kind: 'live', mover: 'home', pos: vec(6000, 0, 0), timer: 64, at: { x: 0, y: 0 }, halfDistance: 3000, impacting: false };
    const events = runFields(state, 2, FIRE);
    expect(events.some((e) => e.type === 'laserHitFireball')).toBe(true);
    expect(state.score).toBe(SCORING.fireball);
    expect(state.dogfight.fireballs[5]!.kind).toBe('hurt');
  });

  it('an unanswered fireball reaches the windshield and costs a shield', () => {
    const state = faceOff('tie');
    state.dogfight.aliens = [null, null, null];
    state.dogfight.liveCount = 0;
    state.dogfight.fireballs[5] = { kind: 'live', mover: 'home', pos: vec(6000, 0, 0), timer: 64, at: { x: 0, y: 0 }, halfDistance: 3000, impacting: false };
    const before = state.shields;
    const events = runFrames(state, 30, IDLE);
    expect(events.some((e) => e.type === 'shieldLost')).toBe(true);
    expect(state.shields).toBe(before - 1);
    expect(state.player.rollFrames).toBeGreaterThan(0);
  });
});
