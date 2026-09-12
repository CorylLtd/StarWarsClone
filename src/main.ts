import { SoundEngine } from './audio/sound';
import { DT } from './game/config';
import { createInitialState, defaultHighScores } from './game/state';
import { ATTRACT } from './game/config';
import type { HighScoreRow } from './game/types';
import type { GameEvent } from './game/types';
import { enterStage, step } from './game/update';
import type { StageKind } from './game/types';
import { YokeInput } from './input/yoke';
import { WorldRenderer } from './render/renderer';
import { ScreenFrame } from './ui/screenFrame';

const HIGH_SCORE_KEY = 'starwars.highScore';
/** The cabinet's NVRAM kept only the top three rows; so do we. */
const TABLE_KEY = 'starwars.highScores';
/** Draw at most this often; the simulation still steps at DT on every animation frame. */
const MAX_RENDER_FPS = 60;
const MIN_RENDER_INTERVAL_MS = 1000 / MAX_RENDER_FPS - 4;

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function loadTable(): HighScoreRow[] {
  const table = defaultHighScores();
  try {
    const saved = JSON.parse(localStorage.getItem(TABLE_KEY) ?? '[]') as HighScoreRow[];
    for (let i = 0; i < Math.min(ATTRACT.persistedRows, saved.length); i++) {
      if (typeof saved[i]?.score === 'number' && typeof saved[i]?.initials === 'string') table[i] = saved[i];
    }
  } catch {
    /* keep the defaults */
  }
  return table;
}

function saveTable(table: HighScoreRow[]): void {
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(table.slice(0, ATTRACT.persistedRows)));
  } catch {
    /* storage unavailable */
  }
}

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    /* storage unavailable; high score is session-only */
  }
}

const screen = document.getElementById('screen')!;
const state = createInitialState(Date.now() >>> 0, loadHighScore(), loadTable());
const input = new YokeInput(window, screen);
const world = new WorldRenderer(screen);
new ScreenFrame(window, screen, () => world.resize());
const sound = new SoundEngine();

if (import.meta.env.DEV) {
  const dev = window as unknown as {
    __sw: typeof state;
    __swSound: typeof sound;
    __swWorld: typeof world;
    __swStep: (fields: number) => void;
    __swEnterStage: (stage: StageKind, wave?: number) => void;
  };
  dev.__swWorld = world;
  dev.__swStep = (fields) => {
    for (let i = 0; i < fields; i++) step(state, { x: 0, y: 0, fire: false }, DT);
  };
  dev.__sw = state;
  dev.__swSound = sound;
  dev.__swEnterStage = (stage, wave) => {
    if (wave !== undefined) state.wave = wave;
    enterStage(state, stage);
  };
}

// Open the game with ?mute to run without any audio.
const muted = new URLSearchParams(location.search).has('mute');
if (!muted) {
  window.addEventListener('keydown', () => sound.unlock());
  window.addEventListener('pointerdown', () => sound.unlock());
}

function dispatch(event: GameEvent): void {
  world.handleEvent(event);
  switch (event.type) {
    case 'gameOver':
      saveHighScore(state.highScore);
      break;
    case 'initialsDone':
      saveTable(state.highScores);
      break;
    default:
      break;
  }
}

let last = performance.now();
let accumulator = 0;
let lastRender = -Infinity;
let renderElapsed = 0;

function frame(now: number): void {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  accumulator += elapsed;
  renderElapsed += elapsed;

  // Only read the input when a field will run, so one-shot presses latched in
  // the input are never consumed by a display frame that steps nothing.
  if (accumulator >= DT) {
    const snapshot = input.snapshot();
    while (accumulator >= DT) {
      step(state, snapshot, DT);
      for (const e of state.events) dispatch(e);
      accumulator -= DT;
    }
  }

  if (now - lastRender < MIN_RENDER_INTERVAL_MS) {
    requestAnimationFrame(frame);
    return;
  }
  lastRender = now;
  const frameDt = renderElapsed;
  renderElapsed = 0;

  world.render(state, frameDt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
