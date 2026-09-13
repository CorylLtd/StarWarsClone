import { AIM, DOGFIGHT } from '../config';
import { DEG, dot, roll, vec } from '../frame';
import type { GameState, Input } from '../types';
import { spawnNextAlien, stepAliens, stepRetreat } from './aliens';
import { chooseAimTarget, stepView } from './aim';
import { stepExplosions } from './explosions';
import { stepFireballs } from './guns';
import { stepLaserTrigger, tickLaser } from './lasers';
import { initStars, stepStars } from './stars';
import { view } from './view';

/** The Dogfight begins: fresh slots, the first group, stars, and the timer (with a head start on the very first wave). */
export function enterDogfight(state: GameState): void {
  const d = state.dogfight;
  d.frame = state.firstWave ? DOGFIGHT.firstWaveStartFrame : 0;
  d.phase = 'fight';
  d.level = 0;
  d.listIndex = 0;
  d.liveCount = 0;
  d.aliens = [null, null, null];
  d.fireballs = [null, null, null, null, null, null];
  d.explosions = [];
  d.darthSeen = false;
  d.passbySlot = null;
  d.deathStarDir = vec(1, 0, 0);
  state.player.shakeCount = 9;
  state.player.aimSlot = 0;
  for (let i = 0; i < DOGFIGHT.alienSlots; i++) spawnNextAlien(state);
  initStars(state);
}

/** One game frame of the Dogfight. Returns true when the stage is over and the next should begin. */
export function stepDogfightFrame(state: GameState, input: Input): boolean {
  const d = state.dogfight;
  const p = state.player;
  switch (d.phase) {
    case 'fight': {
      stepLaserTrigger(state, input);
      view(state, true);
      if (state.shields < 0) return false; // update.ts moves to dying
      stepFireballs(state);
      stepExplosions(state);
      if (p.gaugeFrames > 0) p.gaugeFrames -= 1;
      if (p.flashFrames > 0) p.flashFrames -= 1;
      stepAliens(state);
      stepView(state, chooseAimTarget(state));
      stepStars(state);
      d.frame += 1;
      const cues = DOGFIGHT.musicCueFrames;
      if (d.frame === cues.theme) {
        const vader = state.wave >= 3 && state.wave % 2 === 1;
        state.events.push({ type: 'music', cue: vader ? 'vader' : 'theme' });
      }
      if (d.frame === cues.themeB) state.events.push({ type: 'music', cue: 'themeB' });
      if (d.frame === cues.descent) state.events.push({ type: 'music', cue: 'descent' });
      if (d.frame >= DOGFIGHT.lengthFrames) {
        d.phase = 'retreat';
        d.darthSeen = true;
      } else if (d.liveCount < DOGFIGHT.alienSlots) {
        spawnNextAlien(state);
      }
      return false;
    }
    case 'retreat': {
      stepLaserTrigger(state, input);
      view(state, true);
      if (state.shields < 0) return false;
      stepFireballs(state);
      stepExplosions(state);
      if (p.gaugeFrames > 0) p.gaugeFrames -= 1;
      if (p.flashFrames > 0) p.flashFrames -= 1;
      stepRetreat(state);
      stepView(state, null);
      stepStars(state);
      d.frame += 1;
      if (d.aliens.every((a) => a === null)) {
        d.phase = 'turn';
        state.events.push({ type: 'speech', line: "THIS IS RED FIVE, I'M GOING IN" });
        state.events.push({ type: 'sound', name: 'r2Yes' });
      }
      return false;
    }
    case 'turn': {
      // VEWHPA still runs TSTLAZ, CLSLZ and VWLAZ while the ship turns toward the Death Star.
      stepLaserTrigger(state, input);
      view(state, true);
      stepFireballs(state);
      stepExplosions(state);
      stepView(state, null);
      stepStars(state);
      d.frame += 1;
      if (dot(p.basis.fwd, d.deathStarDir) >= DOGFIGHT.approachFacingCos) {
        d.phase = 'zoom';
        d.zoomScale = DOGFIGHT.zoomStart;
        d.zoomStep = 0x100;
        state.events.push({ type: 'sound', name: 'thrust' });
      }
      return false;
    }
    case 'zoom': {
      // No new bolts during the zoom, but one already in flight still burns out.
      tickLaser(state);
      stepStars(state);
      d.frame += 1;
      d.zoomScale -= d.zoomStep >> 8;
      d.zoomStep += 0x60;
      if (d.zoomScale <= DOGFIGHT.zoomEnd) return true;
      return false;
    }
  }
}

/** While dying the view rolls and everything keeps drawing. */
export function stepDyingFrame(state: GameState): void {
  roll(state.player.basis, AIM.deathRollDeg * DEG);
  stepFireballs(state);
  stepExplosions(state);
  stepStars(state);
  state.dogfight.frame += 1;
}
