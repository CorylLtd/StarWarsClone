import { POKEY_PROCESSOR_SOURCE } from './pokeyProcessor';

/** One register write to one of the four chips at a sample time. */
export interface PokeyWrite {
  at: number;
  chip: number;
  reg: number;
  value: number;
}

/**
 * The four POKEY chips as a worklet node. Writes are scheduled by sample
 * time; `now()` gives the current sample clock so callers can place effects
 * relative to it.
 */
export class PokeyBoard {
  private node: AudioWorkletNode | null = null;
  private ready: Promise<void>;
  private readonly started: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    clockHz: number,
  ) {
    this.started = ctx.currentTime;
    const url = URL.createObjectURL(new Blob([POKEY_PROCESSOR_SOURCE], { type: 'application/javascript' }));
    this.ready = ctx.audioWorklet.addModule(url).then(() => {
      this.node = new AudioWorkletNode(ctx, 'pokey', { outputChannelCount: [1], processorOptions: { clockHz } });
      this.node.connect(out);
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  /** The worklet's sample clock for a context time. */
  sampleAt(time: number): number {
    return Math.max(0, Math.round((time - this.started) * this.ctx.sampleRate));
  }

  write(writes: PokeyWrite[]): void {
    if (!this.node || writes.length === 0) return;
    this.node.port.postMessage({ type: 'writes', writes });
  }

  /** Drop everything queued for a chip's channel from a time on, and silence it there. */
  clear(chip: number, channel: number, atSample: number): void {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'clear', chip, channel, at: atSample });
    this.node.port.postMessage({ type: 'writes', writes: [{ at: atSample, chip, reg: channel * 2 + 1, value: 0 }] });
  }

  reset(): void {
    this.node?.port.postMessage({ type: 'reset' });
  }
}
