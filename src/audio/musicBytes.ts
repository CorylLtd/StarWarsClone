import type { Item, MusicCue } from './music';

/**
 * The sound board's own tune format as an item stream for the player: two
 * bytes per instruction, a note (1-97, or 0 for a rest) with a duration
 * whose low bit ties it, or a function (bit 7 set) with its argument:
 * rate, volume and key set or changed, envelopes, voice control, synth
 * mode, a call to another tune, loops, gosub and return. A duration of 0
 * ends the tune, or returns from a called one. This is what
 * scripts/extractMusic.ts produces from a local copy of the original's
 * tables; the data itself never enters the repository.
 */

export interface OriginalMusic {
  /** The tune data as one byte image. */
  image: number[];
  /** Offsets into the image of each tune, indexed as the driver's directory. */
  directory: number[];
}

/** Which four tunes of the directory each cue starts, voices 1 to 4, from the driver's cue routines. */
export const ORIGINAL_CUE_TUNES: Record<string, [number, number, number, number]> = {
  torpedo: [1, 2, 3, 4],
  ben: [7, 8, 9, 10],
  cantina: [11, 12, 13, 14],
  end: [15, 16, 17, 18],
  rebel: [19, 20, 21, 22],
  rebelRepeats: [23, 24, 25, 26],
  theme: [27, 28, 29, 30],
  fourths: [31, 32, 33, 34],
  themeB: [35, 36, 37, 38],
  descent: [39, 40, 41, 42],
  vader: [43, 44, 45, 46],
};

const signed = (b: number) => (b > 127 ? b - 256 : b);
const AMP_NAMES = ['none', 'steel', 'hard', 'rise', 'ties'];
const FREQ_NAMES = ['none', 'glock'];
const MAX_INSTRUCTIONS = 100000;

/** Walk one tune from its start, yielding the notes and settings the driver would act on. */
export function* tuneItems(music: OriginalMusic, tune: number): Generator<Item> {
  const mem = music.image;
  let pc = music.directory[tune];
  let subReturn: number | null = null;
  let loopStart = 0;
  let loopCount = 0;
  let gosubReturn = 0;
  for (let n = 0; n < MAX_INSTRUCTIONS; n++) {
    const op = mem[pc];
    const arg = mem[pc + 1];
    if (op === undefined || arg === undefined) return;
    pc += 2;
    if (op < 0x80) {
      if (arg === 0) {
        if (subReturn === null) return;
        pc = subReturn;
        subReturn = null;
        continue;
      }
      yield { kind: 'note', note: op, units: arg >> 1, tied: (arg & 1) === 1 };
      continue;
    }
    switch (op & 0x7f) {
      case 0:
        yield { kind: 'rate', value: arg, relative: false };
        break;
      case 1:
        yield { kind: 'rate', value: arg, relative: true };
        break;
      case 2:
        yield { kind: 'vol', value: arg, relative: false };
        break;
      case 3:
        yield { kind: 'vol', value: signed(arg), relative: true };
        break;
      case 4:
        yield { kind: 'key', value: signed(arg) };
        break;
      case 5:
        yield { kind: 'key', value: signed(arg), relative: true };
        break;
      case 6:
        yield { kind: 'fenv', name: FREQ_NAMES[arg] ?? 'none' };
        break;
      case 7:
        yield { kind: 'env', name: AMP_NAMES[arg] ?? 'none' };
        break;
      case 10:
        yield { kind: 'tone', value: arg };
        break;
      case 12:
        yield { kind: 'synth', on: arg !== 0 };
        break;
      case 13:
        subReturn = pc;
        pc = music.directory[arg];
        break;
      case 14:
        loopCount = arg;
        loopStart = pc;
        break;
      case 15:
        loopCount = (loopCount - 1) & 0xff;
        if (loopCount !== 0) pc = loopStart;
        break;
      case 16:
        gosubReturn = pc + 1;
        pc = (mem[pc - 1] << 8) | mem[pc];
        break;
      case 17:
        pc = gosubReturn;
        break;
      default:
        // Sync checks and the POKEY control write: not used by the tunes, ignored by the driver as built.
        break;
    }
  }
}

/** A cue built from the original's tunes. */
export function originalCue(music: OriginalMusic, cue: string): MusicCue | null {
  const tunes = ORIGINAL_CUE_TUNES[cue];
  if (!tunes) return null;
  return { voices: [tuneItems(music, tunes[0]), tuneItems(music, tunes[1]), tuneItems(music, tunes[2]), tuneItems(music, tunes[3])] };
}
