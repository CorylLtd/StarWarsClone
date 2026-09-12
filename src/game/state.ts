import { OPTIONS } from './config';
import { identityBasis, reversedBasis, vec } from './frame';
import { createRng } from './random';
import { HIGH_SCORE_DEFAULTS } from '../data/attract';
import type { Dogfight, GameState, HighScoreRow, Player, Surface, Trench } from './types';

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

export function createSurface(): Surface {
  return {
    frame: 0,
    phase: 'flying',
    pos: vec(0, 0, 0),
    speed: 0,
    vel: vec(0, 0, 0),
    laps: 0,
    bankTics: 0,
    collisionRoll: 0,
    transitionRoll: 0,
    buildings: [],
    towersLeft: 0,
    nextTowerPoints: 0,
    allTowersCleared: false,
    fragments: [],
    munge: identityBasis(),
    dots: [],
    gunsKilled: false,
  };
}

export function createTrench(): Trench {
  return {
    phase: 'flying',
    frame: 0,
    pos: vec(0, 0, 0),
    vel: vec(0, 0, 0),
    pie: [],
    wedgeIndex: 0,
    rowIndex: 0,
    farX: 0,
    nearX: 0,
    rowStarts: [],
    slots: Array.from({ length: 16 }, () => ({ left: [0, 0, 0, 0], right: [0, 0, 0, 0], catwalkCue: 0, catwalkLum: 0, struck: 0 })),
    portX: null,
    endX: null,
    force: 0,
    forceBonus: 0,
    torpedo: null,
    torpedoFired: false,
    repeat: 0,
    missedFrames: 0,
    cueIndex: 0,
    cueIndexPassed: 0,
    dxScale: 0,
    dxStep: 0,
    burstPhase: 0,
    burstCount: 0,
    nextTim: 0,
    shieldsAdded: 0,
    lastSlot: 0,
  };
}

export function defaultHighScores(): HighScoreRow[] {
  return HIGH_SCORE_DEFAULTS.map(([initials, score]) => ({ initials, score }));
}

export function createInitialState(seed: number, highScore: number = 0, highScores: HighScoreRow[] = defaultHighScores()): GameState {
  return {
    mode: 'attract',
    time: 0,
    field: 0,
    frame: 0,
    frameDebt: 0,
    modeFrames: 0,
    wave: 0,
    difficulty: OPTIONS.playDifficulty,
    difficultyBump: 0,
    firstWave: true,
    stage: 'dogfight',
    stageFrames: 0,
    score: 0,
    highScore: Math.max(highScore, highScores[0]?.score ?? 0),
    shields: OPTIONS.startingShields,
    lastScore: 0,
    lastScoreFade: 0,
    firstShieldHitDone: false,
    selectFrames: 0,
    player: createPlayer(),
    dogfight: createDogfight(),
    surface: createSurface(),
    trench: createTrench(),
    attract: { phase: 'highScores', frame: 0, storyScale: [-1, -1, -1, -1, -1, -1, -1, -1], racing: -1, musicClock: 0, lastWaveDisplayed: 0 },
    initials: { row: -1, letters: [], hover: null, frame: 0 },
    highScores,
    credits: 1,
    fireHeld: false,
    fireLatch: false,
    rng: createRng(seed),
    events: [],
  };
}
