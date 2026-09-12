import { SoundEngine } from './audio/sound';
import { DT } from './game/config';
import { createRng } from './game/random';
import { createInitialState } from './game/state';
import type { GameEvent } from './game/types';
import { advanceStage, step } from './game/update';
import { YokeInput } from './input/yoke';
import { WorldRenderer } from './render/renderer';
import { Hud } from './ui/hud';
import { ScreenFrame } from './ui/screenFrame';
import { Screens } from './ui/screens';

const HIGH_SCORE_KEY = 'starwars.highScore';
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

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    /* storage unavailable; high score is session-only */
  }
}

const screen = document.getElementById('screen')!;
const state = createInitialState(Date.now() >>> 0, loadHighScore());
const input = new YokeInput(window, screen);
const world = new WorldRenderer(screen, createRng(0x5741_5253));
new ScreenFrame(window, screen, () => world.resize());
const hud = new Hud(screen);
const screens = new Screens(screen);
const sound = new SoundEngine();

if (import.meta.env.DEV) {
  const dev = window as unknown as { __sw: typeof state; __swSound: typeof sound; __swAdvance: () => void };
  dev.__sw = state;
  dev.__swSound = sound;
  dev.__swAdvance = () => advanceStage(state);
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

  const snapshot = input.snapshot();
  while (accumulator >= DT) {
    step(state, snapshot, DT);
    for (const e of state.events) dispatch(e);
    accumulator -= DT;
  }

  if (now - lastRender < MIN_RENDER_INTERVAL_MS) {
    requestAnimationFrame(frame);
    return;
  }
  lastRender = now;
  const frameDt = renderElapsed;
  renderElapsed = 0;

  world.render(state, frameDt);
  hud.update(state);
  screens.update(state);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
