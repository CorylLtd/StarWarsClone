import { POKEY_PROCESSOR_SOURCE } from './pokeyProcessor';

/** The sound board's POKEY clock in Hz (MAME: 1.5 MHz crystal). */
export const POKEY_CLOCK_HZ = 1500000;
/** The music chips sat behind a 3.5 kHz low-pass filter on the sound board. */
export const MUSIC_LOW_PASS_HZ = 3500;
/** Relative level of the music chips against the effect chips. */
export const MUSIC_GAIN = 0.65;

/** One register write to one of the four chips at a sample time. */
export interface PokeyWrite {
  at: number;
  chip: number;
  reg: number;
  value: number;
}

/**
 * The four POKEY chips as a worklet node. Writes are scheduled by sample
 * time; `sampleAt()` converts a context time to the worklet's sample clock
 * so callers can place effects relative to now. Chips 0 and 1 (the effect
 * chips) go straight out; chips 2 and 3 (the music chips) go out through the
 * board's low-pass filter.
 */
export class PokeyBoard {
  private node: AudioWorkletNode | null = null;
  private ready: Promise<void>;
  /** Messages posted before the worklet was up, sent as soon as it is. */
  private pending: unknown[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    clockHz: number,
  ) {
    const url = URL.createObjectURL(new Blob([POKEY_PROCESSOR_SOURCE], { type: 'application/javascript' }));
    this.ready = ctx.audioWorklet.addModule(url).then(() => {
      this.node = new AudioWorkletNode(ctx, 'pokey', { numberOfOutputs: 2, outputChannelCount: [1, 1], processorOptions: { clockHz } });
      this.node.connect(out, 0);
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = MUSIC_LOW_PASS_HZ;
      lowPass.Q.value = Math.SQRT1_2;
      const musicGain = ctx.createGain();
      musicGain.gain.value = MUSIC_GAIN;
      this.node.connect(lowPass, 1);
      lowPass.connect(musicGain);
      musicGain.connect(out);
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

  /** The context's sample clock (the worklet's `currentFrame`) for a context time. */
  sampleAt(time: number): number {
    return Math.max(0, Math.round(time * this.ctx.sampleRate));
  }

  write(writes: PokeyWrite[]): void {
    if (writes.length === 0) return;
    this.post({ type: 'writes', writes });
  }

  /** Drop everything queued for a chip's channel from a time on, and silence it there. */
  clear(chip: number, channel: number, atSample: number): void {
    this.post({ type: 'clear', chip, channel, at: atSample });
    this.post({ type: 'writes', writes: [{ at: atSample, chip, reg: channel * 2 + 1, value: 0 }] });
  }

  /** Drop everything queued for a whole chip from a time on, and silence all four channels there. */
  clearChip(chip: number, atSample: number): void {
    this.post({ type: 'clear', chip, at: atSample });
    this.post({ type: 'writes', writes: [1, 3, 5, 7].map((reg) => ({ at: atSample, chip, reg, value: 0 })) });
  }

  reset(): void {
    this.post({ type: 'reset' });
  }
}
