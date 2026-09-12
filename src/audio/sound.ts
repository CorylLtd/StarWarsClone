import { COMPOUND, EFFECTS, type Effect } from './effects';
import { compileCue, MUSIC_AUDCTL, MUSIC_CHIPS, STEP_HZ, type MusicTrack } from './music';
import { MUSIC_CUES } from './musicCues';
import { PokeyBoard, POKEY_CLOCK_HZ, type PokeyWrite } from './pokey';

export { POKEY_CLOCK_HZ };

/**
 * The sound engine: four modelled POKEY chips driven by the original's effect
 * tables and by our own music cues. Effects are scheduled as timed register
 * writes; a new effect on a channel cancels what was queued there unless a
 * higher-priority effect is still playing. Music has the other two chips to
 * itself, and a new cue replaces whatever cue was playing, as the original's
 * driver did.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private board: PokeyBoard | null = null;
  private master: GainNode | null = null;
  /** For each chip and channel, the priority and end time of the effect occupying it. */
  private readonly busy: { priority: number; until: number }[][] = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => ({ priority: 0, until: 0 })));
  private readonly looping = new Map<string, boolean>();
  private readonly tracks = new Map<string, MusicTrack>();
  /** The cue playing on the music chips and when it ends, in context time. */
  private music: { cue: string; until: number } | null = null;
  muted = false;

  /** Browsers refuse to start audio without a user gesture; call from a key or pointer handler. */
  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.context.destination);
    this.board = new PokeyBoard(this.context, this.master, POKEY_CLOCK_HZ);
  }

  /** Play a named effect now. Unknown names are ignored so the game can raise events before their sounds exist. */
  play(name: string): void {
    if (!this.board || !this.context || this.muted) return;
    const parts = COMPOUND[name] ?? [name];
    for (const part of parts) {
      const effect = EFFECTS[part];
      if (effect) this.start(part, effect, this.context.currentTime + 0.02);
    }
  }

  /** Start or stop a looping effect. */
  setLoop(name: string, on: boolean): void {
    const effect = EFFECTS[name];
    if (!effect || !this.board || !this.context) return;
    const was = this.looping.get(name) ?? false;
    if (on === was) return;
    this.looping.set(name, on);
    if (on) this.start(name, effect, this.context.currentTime + 0.02);
    else this.stop(effect, this.context.currentTime + 0.02);
  }

  /** Play a music cue now on the music chips, cutting off any cue still playing. Unknown cues are ignored. */
  playMusic(cue: string): void {
    if (!this.board || !this.context || this.muted) return;
    const track = this.track(cue);
    if (!track) return;
    const at = this.context.currentTime + 0.02;
    const start = this.board.sampleAt(at);
    const samplesPerStep = this.context.sampleRate / STEP_HZ;
    const writes: PokeyWrite[] = [];
    for (const chip of MUSIC_CHIPS) {
      this.board.clearChip(chip, start);
      writes.push({ at: start, chip, reg: 8, value: MUSIC_AUDCTL });
    }
    for (const w of track.writes) writes.push({ at: start + Math.round(w.t * samplesPerStep), chip: w.chip, reg: w.reg, value: w.value });
    this.board.write(writes);
    this.music = { cue, until: at + track.length / STEP_HZ };
  }

  /** The cue currently sounding, if any. */
  musicPlaying(): string | null {
    if (!this.music || !this.context || this.context.currentTime >= this.music.until) return null;
    return this.music.cue;
  }

  private track(cue: string): MusicTrack | null {
    let track = this.tracks.get(cue) ?? null;
    if (!track && MUSIC_CUES[cue]) {
      track = compileCue(MUSIC_CUES[cue]);
      this.tracks.set(cue, track);
    }
    return track;
  }

  private start(name: string, effect: Effect, at: number): void {
    const board = this.board!;
    const startSample = board.sampleAt(at);
    const samplesPerTick = this.context!.sampleRate / effect.tickHz;
    for (const ch of effect.channels) {
      const slot = this.busy[effect.chip][ch];
      if (slot.until > at && slot.priority > effect.priority) return;
    }
    for (const ch of effect.channels) {
      board.clear(effect.chip, ch, startSample);
      this.busy[effect.chip][ch] = { priority: effect.priority, until: effect.loop ? Infinity : at + effect.length / effect.tickHz };
    }
    const writes: PokeyWrite[] = effect.steps.map((s) => ({
      at: startSample + Math.round(s.t * samplesPerTick),
      chip: effect.chip,
      reg: s.reg,
      value: s.value,
    }));
    if (!effect.loop) {
      for (const ch of effect.channels) writes.push({ at: startSample + Math.round(effect.length * samplesPerTick), chip: effect.chip, reg: ch * 2 + 1, value: 0 });
    }
    board.write(writes);
    void name;
  }

  private stop(effect: Effect, at: number): void {
    const board = this.board!;
    const sample = board.sampleAt(at);
    for (const ch of effect.channels) {
      board.clear(effect.chip, ch, sample);
      this.busy[effect.chip][ch] = { priority: 0, until: 0 };
    }
  }
}
