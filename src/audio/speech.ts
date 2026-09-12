import { SPEECH_WORDS } from '../data/speech';
import { ORIGINAL_WORD_INDEX, PAUSE, SPEECH_LINES, SPEECH_TIMING } from './speechLines';

/** The original's phrases, if scripts/extractSpeech.ts has decoded them locally (the file is git-ignored). */
const LOCAL_SPEECH = import.meta.glob('../data/local/speech.ts', { eager: true }) as Record<string, { ORIGINAL_SPEECH: Record<number, { frames: number; data: string }> }>;
export const ORIGINAL_SPEECH: Record<number, { frames: number; data: string }> | null = Object.values(LOCAL_SPEECH)[0]?.ORIGINAL_SPEECH ?? null;
import { FRAME_SAMPLES, SAMPLE_RATE, TMS5220_TABLES } from './tms5220Tables';
import { TMS5220_PROCESSOR_SOURCE } from './tms5220Processor';

/** Lines kept in the dev console's history. */
const HISTORY_LENGTH = 64;

/**
 * The speech engine: the sound board's sentence queue in front of a TMS5220
 * model. A line becomes its words, spoken one after another with the board's
 * gaps; sentences queue up to sixteen deep and play in order with the board's
 * delay between them, and the lines the board only spoke when nothing else
 * was waiting are dropped the same way.
 */
export class SpeechEngine {
  private node: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private readonly ready: Promise<void>;
  /** Messages posted before the worklet was up, sent as soon as it is. */
  private pending: unknown[] = [];
  /** Context time when the queue drains: the end of the last sentence plus the inter-message delay. */
  private freeAt = 0;
  /** Context time when the last queued sentence stops sounding. */
  private busyUntil = 0;
  private queued = 0;
  private readonly spoken: { line: string; at: number }[] = [];
  /** Play the original's phrases when they are installed locally; false keeps this project's voices. */
  useOriginal = ORIGINAL_SPEECH !== null;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    gain = 1,
  ) {
    const url = URL.createObjectURL(new Blob([TMS5220_PROCESSOR_SOURCE], { type: 'application/javascript' }));
    this.ready = ctx.audioWorklet.addModule(url).then(() => {
      this.node = new AudioWorkletNode(ctx, 'tms5220', { outputChannelCount: [1], processorOptions: { tables: TMS5220_TABLES } });
      const g = ctx.createGain();
      g.gain.value = this.gainNode?.gain.value ?? gain;
      this.gainNode = g;
      this.node.connect(g);
      g.connect(out);
      for (const m of this.pending) this.node.port.postMessage(m);
      this.pending = [];
    });
  }

  private post(message: unknown): void {
    if (this.node) this.node.port.postMessage(message);
    else this.pending.push(message);
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Output level; may be set before the worklet is up. */
  setGain(value: number): void {
    if (this.gainNode) this.gainNode.gain.value = value;
    else this.gainNode = { gain: { value } } as GainNode;
  }

  /** Queue a line. Returns when it will start, or null if it was dropped or unknown. */
  say(line: string, from = this.ctx.currentTime + 0.02): number | null {
    const entry = SPEECH_LINES[line];
    if (!entry) return null;
    const now = this.ctx.currentTime;
    if (now >= this.freeAt) this.queued = 0;
    const busy = this.queued > 0 || now < this.busyUntil;
    if (entry.dropIfBusy && busy) return null;
    if (this.queued >= SPEECH_TIMING.queueLength) return null;
    let t = Math.max(from, this.freeAt);
    const start = t;
    for (const word of entry.words) {
      if (word === PAUSE) {
        t += SPEECH_TIMING.pause;
        continue;
      }
      const data = this.wordData(word);
      if (!data) continue;
      this.post({ type: 'speak', at: this.sampleAt(t), data: hexBytes(data.data) });
      t += (data.frames * FRAME_SAMPLES) / SAMPLE_RATE - SPEECH_TIMING.fifoTail + SPEECH_TIMING.interWord;
    }
    this.busyUntil = t;
    this.freeAt = t + SPEECH_TIMING.interMessage;
    this.queued += 1;
    this.spoken.push({ line, at: start });
    if (this.spoken.length > HISTORY_LENGTH) this.spoken.shift();
    return start;
  }

  /** A word's frames: the original's when installed and chosen, else ours. */
  private wordData(word: string): { frames: number; data: string } | undefined {
    if (this.useOriginal && ORIGINAL_SPEECH) {
      const index = ORIGINAL_WORD_INDEX[word];
      if (index !== undefined && ORIGINAL_SPEECH[index]) return ORIGINAL_SPEECH[index];
    }
    return SPEECH_WORDS[word];
  }

  /** Whether a sentence is sounding or waiting. */
  busy(): boolean {
    return this.queued > 0 && this.ctx.currentTime < this.busyUntil;
  }

  /** Lines said so far, with their start times; for the dev console. */
  history(): { line: string; at: number }[] {
    return this.spoken;
  }

  private sampleAt(time: number): number {
    return Math.max(0, Math.round(time * this.ctx.sampleRate));
  }
}

function hexBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}
