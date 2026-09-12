import { SoundEngine } from './audio/sound';
import { PokeyBoard } from './audio/pokey';
import { COMPOUND, EFFECTS } from './audio/effects';
import { compileCue, STEP_HZ } from './audio/music';
import { originalCue } from './audio/musicBytes';
import { MUSIC_CUES } from './audio/musicCues';
import { SpeechEngine } from './audio/speech';
import { SPEECH_LINES } from './audio/speechLines';
import { ORIGINAL_MUSIC, POKEY_CLOCK_HZ } from './audio/sound';
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
  (window as unknown as { __swPokeyBoard: typeof PokeyBoard }).__swPokeyBoard = PokeyBoard;
  // Render one effect offline and describe it: peak level and the dominant pitch every 100 ms.
  (window as unknown as { __swRenderEffect: (name: string) => Promise<unknown> }).__swRenderEffect = async (name: string) => {
    const parts = COMPOUND[name] ?? [name];
    const seconds = Math.max(...parts.map((p) => EFFECTS[p].length / EFFECTS[p].tickHz)) + 0.1;
    const off = new OfflineAudioContext(1, Math.ceil(48000 * seconds), 48000);
    const board = new PokeyBoard(off, off.destination, POKEY_CLOCK_HZ);
    await board.whenReady();
    const writes = [];
    for (const p of parts) {
      const e = EFFECTS[p];
      const spt = 48000 / e.tickHz;
      for (const s of e.steps) writes.push({ at: Math.round(s.t * spt), chip: e.chip, reg: s.reg, value: s.value });
    }
    board.write(writes);
    await new Promise((r) => setTimeout(r, 200));
    const d = (await off.startRendering()).getChannelData(0);
    const window = 4800;
    const pitches: number[] = [];
    let peak = 0;
    for (let start = 0; start + window <= d.length; start += window) {
      let crossings = 0;
      let p = 0;
      for (let i = start + 1; i < start + window; i++) {
        p = Math.max(p, Math.abs(d[i]));
        if ((d[i - 1] < 0) !== (d[i] < 0)) crossings += 1;
      }
      peak = Math.max(peak, p);
      pitches.push(p < 0.01 ? 0 : Math.round(crossings * 5));
    }
    return { seconds: Number(seconds.toFixed(2)), peak: Number(peak.toFixed(3)), pitchPer100ms: pitches };
  };
  // Render one music cue offline and describe it: length, peak level and the RMS level of each second.
  (window as unknown as { __swRenderMusic: (name: string, ours?: boolean) => Promise<unknown> }).__swRenderMusic = async (name: string, ours = false) => {
    const source = (!ours && ORIGINAL_MUSIC ? originalCue(ORIGINAL_MUSIC, name) : null) ?? MUSIC_CUES[name];
    const track = compileCue(source);
    const seconds = track.length / STEP_HZ + 0.2;
    const off = new OfflineAudioContext(1, Math.ceil(48000 * seconds), 48000);
    const board = new PokeyBoard(off, off.destination, POKEY_CLOCK_HZ);
    await board.whenReady();
    const spt = 48000 / STEP_HZ;
    board.write([2, 3].map((chip) => ({ at: 0, chip, reg: 8, value: 0x78 })));
    board.write(track.writes.map((w) => ({ at: Math.round(w.t * spt), chip: w.chip, reg: w.reg, value: w.value })));
    await new Promise((r) => setTimeout(r, 200));
    const d = (await off.startRendering()).getChannelData(0);
    let peak = 0;
    const rmsPerSecond: number[] = [];
    for (let start = 0; start < d.length; start += 48000) {
      let sum = 0;
      const end = Math.min(d.length, start + 48000);
      for (let i = start; i < end; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        sum += d[i] * d[i];
      }
      rmsPerSecond.push(Number(Math.sqrt(sum / (end - start)).toFixed(3)));
    }
    return { seconds: Number((track.length / STEP_HZ).toFixed(2)), writes: track.writes.length, peak: Number(peak.toFixed(3)), rmsPerSecond };
  };
  // Render one Speech Line offline and describe it: length, peak level and the RMS level of each quarter second.
  (window as unknown as { __swRenderSpeech: (line: string) => Promise<unknown> }).__swRenderSpeech = async (line: string) => {
    if (!SPEECH_LINES[line]) return null;
    const off = new OfflineAudioContext(1, 48000 * 12, 48000);
    const speech = new SpeechEngine(off, off.destination);
    speech.useOriginal = sound.useOriginalSpeech;
    await speech.whenReady();
    const start = speech.say(line, 0.05)!;
    await new Promise((r) => setTimeout(r, 200));
    const d = (await off.startRendering()).getChannelData(0);
    let peak = 0;
    const rms: number[] = [];
    let lastLoud = 0;
    for (let s = 0; s + 12000 <= d.length; s += 12000) {
      let sum = 0;
      for (let i = s; i < s + 12000; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        sum += d[i] * d[i];
      }
      const r = Math.sqrt(sum / 12000);
      if (r > 0.005) lastLoud = s + 12000;
      rms.push(Number(r.toFixed(3)));
    }
    return { start: Number(start.toFixed(2)), seconds: Number((lastLoud / 48000).toFixed(2)), peak: Number(peak.toFixed(3)), rmsPerQuarterSecond: rms.slice(0, Math.ceil(lastLoud / 12000) + 1) };
  };
  // Offline self-test of the 16-bit join: a pure tone on a joined pair at the chip clock should measure clock / (2 * (N + 7)) Hz.
  (window as unknown as { __swPokeyTest16: (divider: number) => Promise<number> }).__swPokeyTest16 = async (divider: number) => {
    const off = new OfflineAudioContext(1, 48000, 48000);
    const board = new PokeyBoard(off, off.destination, POKEY_CLOCK_HZ);
    await board.whenReady();
    board.write([
      { at: 0, chip: 3, reg: 8, value: 0x78 },
      { at: 0, chip: 3, reg: 0, value: divider & 0xff },
      { at: 0, chip: 3, reg: 2, value: divider >> 8 },
      { at: 0, chip: 3, reg: 3, value: 0xaf },
    ]);
    await new Promise((r) => setTimeout(r, 200));
    const d = (await off.startRendering()).getChannelData(0);
    let crossings = 0;
    for (let i = 1; i < d.length; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) crossings += 1;
    return crossings / 2;
  };
  // Offline self-test of the POKEY model: a pure tone at AUDF 0x28 on the 64 kHz clock should measure about 64000 / (2 * 41) Hz.
  (window as unknown as { __swPokeyTest: () => Promise<number> }).__swPokeyTest = async () => {
    const off = new OfflineAudioContext(1, 48000, 48000);
    const board = new PokeyBoard(off, off.destination, 1500000);
    await board.whenReady();
    board.write([
      { at: 0, chip: 0, reg: 8, value: 0 },
      { at: 0, chip: 0, reg: 0, value: 0x28 },
      { at: 0, chip: 0, reg: 1, value: 0xaf },
    ]);
    await new Promise((r) => setTimeout(r, 200));
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    let crossings = 0;
    for (let i = 1; i < d.length; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) crossings += 1;
    return crossings / 2;
  };
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
const params = new URLSearchParams(location.search);
const muted = params.has('mute');
sound.muted = muted;
// The original's tables play when installed locally; ?music=ours brings this project's compositions back.
if (params.get('music') === 'ours') sound.useOriginalMusic = false;
if (params.get('speech') === 'ours') sound.useOriginalSpeech = false;
if (!muted) {
  window.addEventListener('keydown', () => sound.unlock());
  window.addEventListener('pointerdown', () => sound.unlock());
}

function dispatch(event: GameEvent): void {
  world.handleEvent(event);
  switch (event.type) {
    case 'sound':
      sound.play(event.name);
      break;
    case 'passby':
      sound.play(event.receding ? 'passbyRecede' : 'passby');
      break;
    case 'music':
      sound.playMusic(event.cue);
      break;
    case 'speech':
      sound.speak(event.line);
      break;
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
