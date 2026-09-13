/**
 * All tuning numbers live here. Nothing else in the game layer may contain a
 * magic number. Values come from the original's source listing unless marked
 * PLACEHOLDER; the reference document for each is in docs/reference.
 *
 * Units: the original's universe units (16-bit in the arcade), the original's
 * frame (X forward, Y right, Z up), and "VG units" for anything on screen.
 */

/** The main board interrupt: 3 kHz clock divided by 12 (MAME: 3.024 MHz / 1000 / 12). */
export const IRQ_HZ = 3024000 / 1000 / 12;
/** Game logic runs every 12 interrupts (about 21 Hz). */
export const GAME_FRAME_IRQS = 12;
/** The vector generator restarts every 6 interrupts (about 42 Hz): cursor slew and sprite animation run at this rate. */
export const VG_FIELD_IRQS = 6;
/** One vector-generator field in seconds: the simulation step. */
export const DT = VG_FIELD_IRQS / IRQ_HZ;
/** Fields per game frame when the mainline keeps up with the interrupt. */
export const FIELDS_PER_FRAME = GAME_FRAME_IRQS / VG_FIELD_IRQS;

/**
 * The Game Frame's real period by screen, in seconds. The original's main
 * loop also waited for the vector generator to finish drawing, so screens
 * with more or longer vectors ran slower than the 21 Hz interrupt tick.
 * Measured in MAME from the frame counter against emulated time
 * (docs/reference/dogfight-rules.md §2); the explosion and next-wave values
 * are estimates.
 */
export const PACE = {
  /** Attract screens: the high-score table as MAME measures it; the banner, instructions and scoring
   * pages as a cabinet recording times them (512 frames in 30 s, 434 in 27 s, the 120-frame scroll-in
   * of the scoring page in 3 s). */
  attract: { highScores: 0.0735, banner: 0.0586, instructions: 0.062, scoring: 0.025 },
  select: 0.0488,
  initials: 0.0735,
  /** Dogfight: this with nothing near, rising with the nearest TIE Fighter's size toward the near period. */
  dogfightFar: 0.05,
  dogfightNear: 0.1,
  /** Half-distance at which a TIE Fighter alone brings the Dogfight to its near period. */
  dogfightNearHalfDistance: 2500,
  /** The turn toward the Death Star draws it large; the zoom that follows ran at the full rate. */
  dogfightApproach: 0.091,
  /** The surface as a cabinet recording times it: its fixed run in about 46 s, 13.5 frames a second. */
  surface: 0.074,
  /** The trench run in about 33 s on the cabinet recording, 13 frames a second. */
  trench: 0.076,
  /** The pull-away (42 frames in 3.0 s) and the ring explosion (119 frames in 4.75 s), from a cabinet recording. */
  deathStarPullAway: 0.071,
  deathStarExplosion: 0.04,
  nextWave: 0.05,
  /** The 40-frame death sequence in about 2.75 s, from the same recording. */
  dying: 0.069,
};

/** The vector generator's screen. */
export const VG = {
  /** Half the visible width in VG X units on a 4:3 tube (between the 480 limit and the 510 hard edge). */
  halfWidth: 495,
  /** Half the visible height in VG Y units; a Y unit is physically 2/3 of an X unit. */
  halfHeight: 557,
  /** The 3-D vanishing point sits this far below the screen centre. */
  offsetY: -104,
  /** Perspective focal length: screen = 512 * lateral / forward. */
  focal: 512,
  /** Text rows, 24 units high, from the top. */
  rowTop: 552,
  rowHeight: 24,
  charWidth: 24,
  limitTop: 408,
  limitBottom: -552,
  limitLeft: -480,
  limitRight: 480,
};

/** Cursor travel and slew. Pot units are the yoke's +-127 range; screen units are pot * 4. */
export const CURSOR = {
  potLeft: -112,
  potRight: 112,
  potBottom: -104,
  potTop: 120,
  potToScreen: 4,
  /** Fraction of the remaining distance moved per field, far and near. */
  slewFar: 0x60 / 256,
  slewNear: 0x30 / 256,
  /** Remaining distance (pot units) above which the far fraction applies. */
  slewFarFrom: 0x40,
  /** How far the yoke shifts the drawn hood and gun tips at full deflection, VG units. */
  hoodShiftX: 55,
  hoodShiftY: 40,
};

/** The player's view in the Dogfight: auto-aim slew in binary-angle "tics" (1 tic = 360/5632 degrees). */
export const AIM = {
  ticDeg: 360 / 5632,
  bigStepTics: 78,
  smallStepTics: 14,
  bigStepDeg: 4.986,
  smallStepDeg: 0.895,
  residueMax: 127,
  /** Forced roll after a shield hit: frames and degrees per frame. */
  hitRollFrames: 32,
  hitRollDeg: 4.48,
  /** The view rolls this much per frame while dying. */
  deathRollDeg: -4.48,
};

export const DOGFIGHT = {
  /** Game frames the Dogfight lasts, and the head start on the very first wave. */
  lengthFrames: 420,
  firstWaveStartFrame: 39,
  musicCueFrames: { theme: 40, themeB: 200, descent: 400 },
  alienSlots: 3,
  gunSlots: 6,
  spawnX: 31744,
  /** Body-axis speeds per frame for the three move strengths. */
  speed: [256, 512, 768],
  turnDeg: 4.48,
  positionClamp: 32000,
  /** Real distance below which an alien will not fire. */
  minFireDistance: 4096,
  /** Squared half-distance thresholds the original uses for near/mid/passby, converted to real distances. */
  nearDistance: 4096,
  midDistance: 12288,
  passbyDistance: 3238,
  /** Retreat: forward units per frame and lateral convergence per frame. */
  retreatSpeed: 1024,
  retreatConvergeY: 512,
  retreatConvergeZ: 768,
  retreatConvergeUntil: 0x900 * 2,
  /** The approach turns the view until the Death Star is within this of straight ahead (cos). */
  approachFacingCos: 0x3f00 / 0x4000,
  /**
   * The approach zoom: the Death Star's scale value (binary * 128 + linear)
   * falls from start to end at an accelerating rate, about 57 frames.
   */
  zoomStart: 7 * 128 + 127,
  zoomEnd: 3 * 128 + 16,
};

export const SURFACE = {
  /** The maze repeats every this many universe units forward; the lap counter ticks when 16-bit X overflows. */
  mapWrap: 0x8000,
  /** Start position and the altitude limits applied after every move. */
  startX: 128,
  startAltitude: 8192,
  minAltitude: 512,
  maxAltitude: 7168,
  /** Forward speed: start, increase per frame, and cap. */
  speedStart: 256,
  speedRamp: 1,
  speedMax: 1024,
  /** Lateral and vertical velocity per unit of cursor pot per unit of speed. */
  lateralGain: 1 / 128,
  verticalGain: 1 / 256,
  /** Bank: tics per pot unit, tics per unit of collision roll, slew per frame normally and while a collision roll is active. */
  bankTicsPerPot: 2,
  bankTicsPerRoll: 32,
  bankSlewTics: 16,
  bankSlewTicsHit: 80,
  /** Buildings are drawn when their forward distance is in this range (real units) and within the 45 degree cone. */
  minDistance: 512,
  maxDistance: 30720,
  /** Real sizes: tower radius, height and hat bottom; bunker radius and height. */
  towerRadius: 960,
  towerHeight: 13920,
  hatBottom: 12480,
  bunkerRadius: 1680,
  bunkerHeight: 1440,
  /** Laser hit: sight fudge in screen units. */
  hitPad: 10,
  /** Collision: real distance at or below 1024 + 2 * speed for towers, 2048 + 2 * speed for bunkers (flying below their height). */
  towerCrashBase: 1024,
  bunkerCrashBase: 2048,
  towerCrashRoll: 32,
  bunkerCrashRoll: 19,
  /** The lap after which guns fall silent and off-screen buildings are switched off; the stage ends when X comes back to zero. */
  killAtLap: 5,
  /** Tower hat scoring: first hat, and the increase per hat. */
  towerPointsStart: 200,
  towerPointsStep: 200,
  allTowersBonus: 50000,
  /** Fragments: frames alive, gravity per frame, friction per frame, and spawn heights. */
  fragmentFrames: 32,
  fragmentGravity: 200,
  fragmentFriction: 1 / 32,
  towerFragmentHeight: 14400,
  bunkerFragmentHeight: 720,
  /** Ground dots: count and respawn window ahead of the player. */
  dotCount: 50,
  dotAheadMin: 0x7000,
  dotAheadMax: 0x7fff,
  /** Music cue: the Rebel theme after this many game frames. */
  rebelThemeFrame: 224,
  /** Ground guns: usable gun slots by hardness; tower shots close at this speed and live this long. */
  gunSlotsByHardness: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
  shotSpeed: 256,
  shotFrames: 112,
  /** Tower gun arming: the top and hat heights, real units, scaled by distance. */
  towerTopForArming: 6960 * 2,
  hatForArming: 720 * 2,
  /** Ground shots impact within max(speed, 512) + 272 real units. */
  impactPad: 272,
  /** The trench transition: two 17-frame halves, roll per frame, descent rates and target depths. */
  transitionFrames: 17,
  transitionRollDeg: 10.55,
  transitionDropTo: 896,
  transitionDropRate: 384,
  trenchDropTo: -3328,
  trenchDropRate: 256,
  transitionSpeed: 768,
};

export const TRENCH = {
  /** Walls, floor and the player's clamps, universe units. */
  wallY: 1024,
  floorZ: -4096,
  topZ: 0,
  playerMaxY: 511,
  playerMinZ: -3583,
  playerMaxZ: -257,
  /** Constant forward speed and the yoke gains. */
  speed: 768,
  lateralGain: 1 / 256,
  verticalGain: 1 / 128,
  /** Starting altitude from the surface, and after a miss or from space (clamped to the top band). */
  entryFromSurfaceZ: -3328,
  entryFromSpaceZ: 0,
  /** Panel slots: 2048 units each, sixteen per ring; four bands per wall with these centres. */
  slotLength: 2048,
  ringSlots: 16,
  bandCentres: [-512, -1536, -2560, -3584],
  bandHalfHeight: 512,
  /** Rows are generated while their end lies within this of the near row; drawn up to this far. */
  generateAhead: 24576,
  drawAhead: 28672,
  /** Catwalk collision: only while the player is within the first this-many units of the slot. */
  catwalkHitDepth: 1024,
  catwalkQuickGlowFrames: 8,
  /** Wall guns: fire window and probability by hardness, usable slots by hardness. */
  gunWindow: [
    { mask: 15, prob: 128 },
    { mask: 15, prob: 96 },
    { mask: 15, prob: 64 },
    { mask: 15, prob: 32 },
    { mask: 7, prob: 96 },
    { mask: 7, prob: 32 },
    { mask: 3, prob: 96 },
    { mask: 3, prob: 32 },
  ],
  gunSlotsByHardness: [1, 1, 2, 2, 3, 3, 3, 4],
  /** Guns fire at a player above them by less than this at full chance, by up to twice this rarely. */
  gunAboveNear: 1024,
  gunAboveFar: 2048,
  shotFrames: 64,
  shotStartY: 896,
  /** Ground shots hit within the speed plus this. */
  impactPad: 272,
  /**
   * Laser ray: the far point is 28672 ahead and offset by 7/8 of the yoke's
   * 16-bit position (the pot times 256), so it passes through the cursor.
   */
  rayAhead: 28672,
  rayPerPot: (7 / 8) * 256,
  laserRadius: 64,
  /** The port: sits this far before the end wall; the torpedo triggers within this of it. */
  portToEnd: 4096,
  portHitRadius: 512,
  portDrawAhead: 28672,
  /** Torpedo speed added to the player's, and its lateral offset. */
  torpedoSpeed: 768,
  torpedoOffsetY: 128,
  /** End-of-trench test: the end wall within this. */
  endReach: 2048,
  /** The Force bonus by displayed wave 1..5+. */
  forceBonus: [5000, 10000, 25000, 50000, 100000],
  /** Catwalk depth cue: colours cycle, brightness from this down by 8 per catwalk to the floor value. */
  catwalkColours: ['YLW', 'TRQ', 'PRP'],
  catwalkLumStart: 0x88,
  catwalkLumStep: 8,
  catwalkLumMin: 0x40,
  /** Music and speech cues in 16-frame pseudo-seconds. */
  pseudoSecondFrames: 16,
  /** Death Star explosion: the receding scale in masked units (binary * 128 + linear), from half size to a sixteenth; the step starts at 10 per frame and drops by one every 16 frames. */
  dx1ScaleStart: 3 * 128 + 4,
  dx1ScaleEnd: 6 * 128,
  dx1StepStart: 10 * 16,
  dx3Phase0Frames: 31,
  dx3Phase1Frames: 31,
  dx3Phase2Frames: 27,
  dx3Phase3Frames: 30,
  /** Next-wave accounting runs on a 16-frame pseudo-second clock from 4 down to -2. */
  nextStartTim: 4,
};

export const FIREBALL = {
  lifeFrames: 64,
  /** Distance multiplier per frame: it homes exponentially on the eye. */
  homing: 7 / 8,
  impactDistance: 784,
  /** Frames the white windshield glow lasts, and the purple hurt sparkle. */
  glowFrames: 15,
  hurtFrames: 15,
  screenFlashFrames: 16,
};

export const LASER = {
  boltFrames: 8,
  hitFreezeFrames: 4,
  /** Hit box: a sphere of this real radius around the centre, plus this many screen units. */
  hitRadius: 160,
  hitPad: 10,
  octagonFactor: 1.5,
  /** Gun tip positions in VG units before the hood shift. */
  guns: {
    upperLeft: { x: -390, y: -104 },
    lowerLeft: { x: -395, y: -517 },
    lowerRight: { x: 395, y: -517 },
    upperRight: { x: 390, y: -104 },
  },
};

export const DARTH = {
  hitPoints: 4,
  glowFrames: 31,
  rollDeg: 20.34,
  thrownForward: 0x4000,
};

export const EXPLOSION = {
  wingFrames: 24,
  cabinFrames: 16,
  queueSize: 8,
  mungeRollDeg: 19.04,
  mungePitchDeg: 4.99,
  /** Wing pieces start this fraction of the ship's right axis (times 0x4000) from the centre. */
  wingOffset: 0x4000 / 64,
};

export const STARS = {
  count: 50,
  /** Halved-distance visibility limits. */
  minHalfDistance: 0x100,
  maxHalfDistance: 0xfff,
  /** The viewer slides along +X this much per frame for parallax. */
  driftPerFrame: 128,
  brightness: 0x80,
};

/** Operator option settings at the manufacturer's recommended values (SWOPTS.DOC: 7 starting shields, Moderate difficulty, 1 bonus shield per Death Star). */
export const OPTIONS = {
  startingShields: 7,
  playDifficulty: 1 as 0 | 1 | 2 | 3,
  bonusShieldsPerDeathStar: 1,
  attractMusicIntervalSeconds: 7 * 60,
};

export const SHIELDS = {
  /** Frames the gauge animation blocks further losses: 10 + previous count. */
  lossWindowBase: 10,
  levelVoiceAt: { power: 2, lostR2: 0 },
  endOfWaveBonusPerShield: 5000,
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
  waveSelectBonus: [0, 200000, 400000, 600000, 800000],
};

export const SELECT = {
  countdownFrames: 256,
  /** Death Star miniature positions on the select screen, VG units. */
  positions: [
    { x: -400, y: 100, wave: 0 },
    { x: 0, y: -300, wave: 2 },
    { x: 400, y: 100, wave: 4 },
  ],
  hitDx: 52,
  hitDy: 72,
  hitSum: 80,
};

export const ATTRACT = {
  highScoresFrames: 256,
  highScoresFadeFrames: 80,
  bannerFrames: 512,
  pageFrames: 434,
  pageRevealFrames: 320,
  pageLineEvery: 8,
  scoringScroll: 960,
  scoringScrollPerFrame: 8,
  /** Banner: logo phases and the storyline growth, hold and race-away. */
  logoFixedUntil: 64,
  logoGoneAt: 248,
  logoFixedScale: 0x40,
  storyGrowUntil: 224,
  storyHoldUntil: 352,
  storyRaceStep: 4,
  storyGoneAt: 240,
  storyVanishingY: 408,
  storyOffsetY: -560,
  /** Attract music: one random tune at a banner start once this many seconds have passed since the last. */
  musicIntervalSeconds: 400,
  /** Initials entry timeout and hover box. */
  initialsTimeoutFrames: 640,
  hoverBox: 24,
  hoverOctagon: 32,
  hoverCursorOffset: { x: -8, y: -116 },
  /** Persist only the top rows, as the cabinet's NVRAM did. */
  persistedRows: 3,
  /** Frames the game-over text takes to grow, and the death phase length. */
  gameOverGrowFrames: 32,
};

export const TIMING = {
  deathFrames: 40,
};
