import { SPEECH_WORDS } from '../data/speech';
import { BREATH, PAUSE, SPEECH_LINES, SPEECH_TIMING } from './speechLines';
import { FRAME_SAMPLES, SAMPLE_RATE, TMS5220_TABLES } from './tms5220Tables';
import { TMS5220_PROCESSOR_SOURCE } from './tms5220Processor';

/**
 * The speech engine: the sound board's sentence queue in front of a TMS5220
 * model. A line becomes its words, spoken one after another with the board's
 * gaps; sentences queue up to sixteen deep and play in order with the board's
 * delay between them, and the lines the board only spoke when nothing else
 * was waiting are dropped the same way.
 */
export class SpeechEngine {
  private node: AudioWorkletNode | null = null;
  private readonly ready: Promise<void>;
  private readonly started: number;
  /** Context time when the queue drains: the end of the last sentence plus the inter-message delay. */
  private freeAt = 0;
  /** Context time when the last queued sentence stops sounding. */
  private busyUntil = 0;
  private queued = 0;
  private readonly spoken: { line: string; at: number }[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    gain = 1,
  ) {
    this.started = ctx.currentTime;
    const url = URL.createObjectURL(new Blob([TMS5220_PROCESSOR_SOURCE], { type: 'application/javascript' }));
    this.ready = ctx.audioWorklet.addModule(url).then(() => {
      this.node = new AudioWorkletNode(ctx, 'tms5220', { outputChannelCount: [1], processorOptions: { tables: TMS5220_TABLES } });
      const g = ctx.createGain();
      g.gain.value = gain;
      this.node.connect(g);
      g.connect(out);
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Queue a line. Returns when it will start, or null if it was dropped or unknown. */
  say(line: string, from = this.ctx.currentTime + 0.02): number | null {
    const entry = SPEECH_LINES[line];
    if (!entry || !this.node) return null;
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
      const data = SPEECH_WORDS[word === BREATH ? BREATH : word];
      if (!data) continue;
      this.node.port.postMessage({ type: 'speak', at: this.sampleAt(t), data: hexBytes(data.data) });
      t += (data.frames * FRAME_SAMPLES) / SAMPLE_RATE - SPEECH_TIMING.fifoTail + SPEECH_TIMING.interWord;
    }
    this.busyUntil = t;
    this.freeAt = t + SPEECH_TIMING.interMessage;
    this.queued += 1;
    this.spoken.push({ line, at: start });
    return start;
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
    return Math.max(0, Math.round((time - this.started) * this.ctx.sampleRate));
  }
}

function hexBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}
