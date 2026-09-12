import { OPTIONS } from './config';
import { identityBasis, reversedBasis, vec } from './frame';
import { createRng } from './random';
import type { Dogfight, GameState, Player } from './types';

export function createPlayer(): Player {
  return {
    basis: reversedBasis(),
    aimSlot: 0,
    yawResidue: 0,
    pitchResidue: 0,
    rollFrames: 0,
    rollDir: 1,
    cursorTarget: { x: 0, y: 0 },
    cursorPot: { x: 0, y: 0 },
    cursor: { x: 0, y: 0 },
    laserFrames: 0,
    laserLeftPair: false,
    laserHit: 0,
    laserAt: { x: 0, y: 0 },
    flashFrames: 0,
    gaugeFrames: 0,
    shakeCount: 9,
  };
}

export function createDogfight(): Dogfight {
  return {
    frame: 0,
    phase: 'fight',
    level: 0,
    listIndex: 0,
    liveCount: 0,
    aliens: [null, null, null],
    fireballs: [null, null, null, null, null, null],
    explosions: [],
    munge: identityBasis(),
    stars: [],
    darthSeen: false,
    passbySlot: null,
    zoomScale: 0,
    zoomStep: 0,
    deathStarDir: vec(1, 0, 0),
  };
}

export function createInitialState(seed: number, highScore: number = 0): GameState {
  return {
    mode: 'attract',
    time: 0,
    field: 0,
    modeFrames: 0,
    wave: 0,
    difficulty: OPTIONS.playDifficulty,
    difficultyBump: 0,
    firstWave: true,
    stage: 'dogfight',
    stageFrames: 0,
    score: 0,
    highScore,
    shields: OPTIONS.startingShields,
    lastScore: 0,
    lastScoreFade: 0,
    firstShieldHitDone: false,
    selectFrames: 0,
    player: createPlayer(),
    dogfight: createDogfight(),
    fireHeld: false,
    fireLatch: false,
    rng: createRng(seed),
    events: [],
  };
}
