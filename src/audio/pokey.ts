import { POKEY_PROCESSOR_SOURCE } from './pokeyProcessor';

/** The sound board's POKEY clock in Hz (MAME: 1.5 MHz crystal). */
export const POKEY_CLOCK_HZ = 1500000;
/** The music chips sat behind a 3.5 kHz low-pass filter on the sound board. */
export const MUSIC_LOW_PASS_HZ = 3500;
/** Relative level of the music chips against the effect chips. */
export const MUSIC_GAIN = 0.9;

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
  private readonly started: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    clockHz: number,
  ) {
    this.started = ctx.currentTime;
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

  /** Drop everything queued for a whole chip from a time on, and silence all four channels there. */
  clearChip(chip: number, atSample: number): void {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'clear', chip, at: atSample });
    this.node.port.postMessage({ type: 'writes', writes: [1, 3, 5, 7].map((reg) => ({ at: atSample, chip, reg, value: 0 })) });
  }

  reset(): void {
    this.node?.port.postMessage({ type: 'reset' });
  }
}
