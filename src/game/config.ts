/**
 * All tuning numbers live here. Nothing else in the game layer may contain a
 * magic number.
 *
 * Values marked PLACEHOLDER are guesses that stand in until the milestone that
 * needs them derives the real figure from the original source or from running
 * the original in MAME.
 */

/** Simulation step, seconds. */
export const DT = 1 / 60;

/**
 * The original's display refresh, from MAME's starwars.cpp: the vector
 * generator restarts at CLOCK_3KHZ / 12 / 6 ≈ 41.67 Hz. Per-frame counters
 * taken from the source are converted to seconds with this.
 */
export const ARCADE_FRAME_HZ = 3000 / 12 / 6;

/** The vector monitor's visible field, used for letterboxing and projection. */
export const SCREEN = {
  aspect: 4 / 3,
};

/**
 * Camera used by both the renderer and the simulation's hit-test projection.
 * The two must never diverge, so they read this one record.
 */
export const CAMERA = {
  /** PLACEHOLDER: vertical field of view, degrees. To be calibrated from the mathbox constants. */
  fovYDeg: 60,
  near: 0.5,
  far: 20000,
};

/** How far the yoke swings the view and the cursor. */
export const YOKE = {
  /** PLACEHOLDER radians of yaw at full sideways deflection. */
  maxYaw: 0.21,
  /** PLACEHOLDER radians of pitch at full fore/aft deflection. */
  maxPitch: 0.16,
  /** PLACEHOLDER radians of bank at full sideways deflection. */
  maxRoll: 0.12,
  /** Cursor travel at full deflection, in normalised screen units. PLACEHOLDER. */
  cursorRangeX: 0.85,
  cursorRangeY: 0.8,
};

/** Factory-default operator option settings (SWOPTS.DOC, the *** rows). */
export const OPTIONS = {
  startingShields: 6,
  playDifficulty: 'easy' as 'easy' | 'moderate' | 'hard' | 'hardest',
  /** PLACEHOLDER until the bonus-shield row of the option doc is decoded. */
  bonusShieldsPerDeathStar: 1,
  attractMusicIntervalSeconds: 7 * 60,
};

export const SCORING = {
  tieFighter: 1000,
  darthsShip: 2000,
  laserBunker: 200,
  laserTower: 200,
  trenchTurret: 100,
  fireball: 33,
  exhaustPort: 25000,
  allTowerTops: 50000,
};

export const TIMING = {
  /** Seconds the final score stays up before the attract resumes. PLACEHOLDER. */
  gameOverHold: 6,
};
