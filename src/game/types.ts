import type { Basis, Vec } from './frame';
import type { Rng } from './random';

/** Top-level mode: what the cabinet is doing. */
export type Mode = 'attract' | 'select' | 'playing' | 'dying' | 'initials';

/** The attract cycle's screens. */
export type AttractPhase = 'highScores' | 'banner' | 'instructions' | 'scoring';

/** The three stages of a wave, in order. */
export type StageKind = 'dogfight' | 'surface' | 'trench';

/**
 * One snapshot of the yoke and buttons. `x` is +1 pushed fully right, `y` is
 * +1 pulled fully back (cursor up), both 0 at rest. `fire` is any of the four
 * yoke buttons, which also start a game.
 */
export interface Input {
  x: number;
  y: number;
  fire: boolean;
}

/** A point on the vector generator's screen: VG units, +X right, +Y up, origin at the screen centre. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export type AlienKind = 'tie' | 'darth';

/** Choreography status bits, as the original names them. */
export interface AlienStatus {
  hit: boolean;
  playerInSights: boolean;
  playerAhead: boolean;
  random1: boolean;
  random2: boolean;
  fired: boolean;
  playerNear: boolean;
  playerAimingAtMe: boolean;
  inView: boolean;
  playerMid: boolean;
}

export interface Alien {
  kind: AlienKind;
  pos: Vec;
  basis: Basis;
  /** Velocity for this frame, universe units per game frame. */
  vel: Vec;
  hitsLeft: number;
  /** Frames of green/white flicker left after a hit; the alien is untouchable while > 0. */
  glow: number;
  /** Frames of forced roll left. */
  rollFrames: number;
  status: AlienStatus;
  script: ScriptState;
  /** Screen position and hit box computed by the last view, if drawn. */
  drawn: { at: ScreenPoint; halfDistance: number; hitSize: number } | null;
  /** Times this alien has been hit (drives damage markers on shapes that have them). */
  damage: number;
}

export interface ScriptState {
  /** Index of the current op in the choreography program. */
  pc: number;
  /** Frames left on the current timed op. */
  timer: number;
  /** Active .CUNTIL mask: any of these status bits set skips ahead. */
  untilMask: number;
  /** Single return slot for gosub, or -1. */
  returnPc: number;
  /** The twirl and move flags held for the current op. */
  flags: number;
}

export type FireballKind = 'live' | 'hurt' | 'glow';

/** How a shot moves: homing on the eye (space), a straight tower shot, or a rising bunker shot. */
export type FireballMover = 'home' | 'towerForward' | 'towerLeft' | 'towerRight' | 'bunkerLeft' | 'bunkerRight' | 'wall';

export interface Fireball {
  kind: FireballKind;
  mover: FireballMover;
  /** Position relative to the player (space) or in universe coordinates (ground), universe axes. */
  pos: Vec;
  /** Frames left. */
  timer: number;
  /** Screen position remembered for glow/hurt drawing. */
  at: ScreenPoint;
  halfDistance: number;
  /** Set by the view when the shot has reached the windshield this frame. */
  impacting: boolean;
}

export interface ExplosionPiece {
  shape: 'portWing' | 'stbdWing' | 'cabin';
  pos: Vec;
  vel: Vec;
  timer: number;
}

export interface Star {
  pos: Vec;
}

export interface Player {
  basis: Basis;
  /** Auto-aim: which alien slot is being tracked, and the yaw/pitch rate residues. */
  aimSlot: number;
  yawResidue: number;
  pitchResidue: number;
  /** Forced roll frames left and direction after a shield hit. */
  rollFrames: number;
  rollDir: 1 | -1;
  /** Cursor target from the yoke (pot units) and the slewed position (pot units, fractional). */
  cursorTarget: ScreenPoint;
  cursorPot: ScreenPoint;
  /** Cursor on screen, VG units (pot * 4), without the -104 offset. */
  cursor: ScreenPoint;
  /** Lasers: frames left on the bolt, which pair fires, hit freeze, and the cursor latched for this frame's bolt. */
  laserFrames: number;
  laserLeftPair: boolean;
  laserHit: number;
  laserAt: ScreenPoint;
  /** Screen flash frames left after a shield hit. */
  flashFrames: number;
  /** Gauge animation frames left; shield loss is refused while > 0. */
  gaugeFrames: number;
  /** Shots fired at the player by the tracked alien before "I can't shake him". */
  shakeCount: number;
}

export interface Dogfight {
  /** Game frames since the stage began (PH.TIM). */
  frame: number;
  phase: 'fight' | 'retreat' | 'turn' | 'zoom';
  /** Index into the wave set's level lists and the position within the current list. */
  level: number;
  listIndex: number;
  liveCount: number;
  aliens: (Alien | null)[];
  fireballs: (Fireball | null)[];
  explosions: ExplosionPiece[];
  /** The shared tumble applied to all explosion pieces. */
  munge: Basis;
  stars: Star[];
  /** Whether Darth has been drawn this wave (his line is spoken once). */
  darthSeen: boolean;
  /** Slot of the alien currently roaring past, if any. */
  passbySlot: number | null;
  /** Death Star approach zoom state. */
  zoomScale: number;
  zoomStep: number;
  /** Unit vector from the player toward the Death Star (universe +X). */
  deathStarDir: Vec;
}

export type BuildingType = 'tower' | 'bishop' | 'bunker';

export interface Building {
  type: BuildingType;
  /** Map position: forward along X (within one lap), lateral along Y. */
  pos: Vec;
  /** Lap count at which it awakens. */
  sequence: number;
  /** A tower whose hat has been shot, or a bunker that has been destroyed. */
  damaged: boolean;
  /** Switched off for good on the final lap once out of sight. */
  killed: boolean;
  /** Real forward distance and lateral offset from the last view, if in sight. */
  seen: { distance: number; lateral: number } | null;
  /** Frames left of the collision flash. */
  flash: number;
  /** Tower gun: armed when its top was seen below the player's altitude; fires once per lap. */
  armed: boolean;
  firedThisLap: boolean;
}

export interface GroundFragment {
  shape: 'towerLeft' | 'towerCentre' | 'towerRight' | 'bunkerLeft' | 'bunkerCentre' | 'bunkerRight';
  pos: Vec;
  vel: Vec;
  timer: number;
}

export interface Surface {
  /** Game frames since the stage began. */
  frame: number;
  phase: 'flying' | 'dropping' | 'descending';
  /** Player universe position: x forward as a signed 16-bit value, y right, z altitude. */
  pos: Vec;
  /** Forward speed, universe units per frame. */
  speed: number;
  /** Lateral and vertical velocity from the yoke. */
  vel: Vec;
  /** Times the 16-bit forward position has overflowed: the awakening sequence. */
  laps: number;
  /** Bank of the view in tics (0.064 degrees), and the collision roll kick that decays by one per frame. */
  bankTics: number;
  collisionRoll: number;
  /** Extra roll accumulated during the trench transition, radians. */
  transitionRoll: number;
  buildings: Building[];
  /** Towers whose hats are still up. */
  towersLeft: number;
  /** Points the next tower hat is worth. */
  nextTowerPoints: number;
  allTowersCleared: boolean;
  fragments: GroundFragment[];
  munge: Basis;
  /** Universe positions of the green ground dots. */
  dots: Vec[];
  /** Guns are silenced after this many wraps. */
  gunsKilled: boolean;
}

/** A trench panel row as generated: which codes sit in each band of each wall. */
export interface TrenchSlot {
  /** Codes top to bottom: 0 empty, 1 panel, 2 catwalk, 3 gun; a destroyed panel or turret reads 0. */
  left: number[];
  right: number[];
  /** Depth-cue colour index and brightness for a catwalk in this slot. */
  catwalkCue: number;
  catwalkLum: number;
  /** Frames the catwalk shows as struck. */
  struck: number;
}

export interface Torpedo {
  pos: Vec;
  live: boolean;
}

export interface Trench {
  phase: 'flying' | 'explosion1' | 'explosion3' | 'next';
  frame: number;
  /** Player position: x along the trench, y lateral, z vertical. */
  pos: Vec;
  vel: Vec;
  /** The wedge sequence for this wave and the generator's position in it. */
  pie: string[];
  wedgeIndex: number;
  rowIndex: number;
  /** X where the next row will be generated, and the X of the nearest generated row. */
  farX: number;
  nearX: number;
  /** Row boundaries generated so far, for the wall verticals. */
  rowStarts: number[];
  /** The sixteen-slot rings of panel codes, indexed by (x >> 11) & 15. */
  slots: TrenchSlot[];
  /** Exhaust port X and end wall X once generated. */
  portX: number | null;
  endX: number | null;
  /** The Force: 0 still trying, -1 fired, 1 earned. */
  force: number;
  forceBonus: number;
  torpedo: Torpedo | null;
  torpedoFired: boolean;
  /** Passes through this trench: 0 first, 1 and up repeats after a miss. */
  repeat: number;
  /** Frames of the "exhaust port missed" message. */
  missedFrames: number;
  /** Depth cue index assigned to the next catwalk generated, and the count already passed by the player. */
  cueIndex: number;
  cueIndexPassed: number;
  /** Explosion bookkeeping: scale step for the receding Death Star and the burst phase and count. */
  dxScale: number;
  dxStep: number;
  burstPhase: number;
  burstCount: number;
  /** Next-wave accounting pseudo-second counter. */
  nextTim: number;
  shieldsAdded: number;
  /** Slot the player is in, for leaving detection. */
  lastSlot: number;
}

export interface HighScoreRow {
  initials: string;
  score: number;
}

export interface Attract {
  phase: AttractPhase;
  /** Frames into the phase (PH.TIM counts down in the original; here it counts up). */
  frame: number;
  /** Banner: the storyline lines' linear scales (-1 = not started, 240 = gone). */
  storyScale: number[];
  /** Which line is currently racing away. */
  racing: number;
  /** Frames since the last attract tune; the next plays at a banner start once this passes the interval. */
  musicClock: number;
  lastWaveDisplayed: number;
}

export interface InitialsEntry {
  /** Which high-score row the player took. */
  row: number;
  /** Letters entered so far. */
  letters: string[];
  /** The item under the cursor, if any (letter, ' ', 'RUB' or 'END'). */
  hover: string | null;
  frame: number;
}

export type GameEvent =
  | { type: 'gameStarted' }
  | { type: 'waveSelected'; wave: number }
  | { type: 'stageStarted'; stage: StageKind; wave: number }
  | { type: 'waveCompleted'; wave: number }
  | { type: 'laserFired' }
  | { type: 'laserHitAlien'; kind: AlienKind; destroyed: boolean }
  | { type: 'laserHitFireball' }
  | { type: 'towerTopHit'; points: number }
  | { type: 'bunkerHit' }
  | { type: 'laserSplash' }
  | { type: 'allTowersCleared' }
  | { type: 'collision'; with: BuildingType }
  | { type: 'catwalkHit' }
  | { type: 'turretHit' }
  | { type: 'panelHit' }
  | { type: 'torpedoFired' }
  | { type: 'forceBonus'; points: number }
  | { type: 'portMissed' }
  | { type: 'deathStarDestroyed' }
  | { type: 'alienFired' }
  | { type: 'shieldHit' }
  | { type: 'shieldLost'; remaining: number }
  | { type: 'passby'; receding: boolean }
  | { type: 'speech'; line: string }
  | { type: 'music'; cue: string }
  | { type: 'sound'; name: string }
  | { type: 'playerDied' }
  | { type: 'gameOver' }
  | { type: 'highScore'; row: number }
  | { type: 'initialsDone' };

export interface GameState {
  mode: Mode;
  /** Seconds since the state was created. */
  time: number;
  /** Vector generator fields since the state was created; a game frame is every second field. */
  field: number;
  /** Game frames since the current mode began. */
  modeFrames: number;
  /** Wave counter as the original keeps it: 0 = displayed wave 1. */
  wave: number;
  /** Difficulty knobs: the option plus the per-wave bump. */
  difficulty: number;
  difficultyBump: number;
  firstWave: boolean;
  stage: StageKind;
  /** Game frames since the current stage began. */
  stageFrames: number;
  score: number;
  highScore: number;
  /** Deflector Shields remaining; -1 once the fatal hit has landed. */
  shields: number;
  /** The last amount scored, shown fading under the score. */
  lastScore: number;
  lastScoreFade: number;
  firstShieldHitDone: boolean;
  /** Select-a-Death-Star countdown, game frames left. */
  selectFrames: number;
  player: Player;
  dogfight: Dogfight;
  surface: Surface;
  trench: Trench;
  attract: Attract;
  initials: InitialsEntry;
  highScores: HighScoreRow[];
  /** Credits: free play holds this at one. */
  credits: number;
  fireHeld: boolean;
  /** A fire press seen on any field since the last game frame, so no press falls between frames. */
  fireLatch: boolean;
  rng: Rng;
  /** Events raised by the most recent step. Cleared at the start of every step. */
  events: GameEvent[];
}
