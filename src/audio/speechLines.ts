/**
 * The Speech Lines: the arcade's words at the arcade's trigger points, in a
 * voice of our own. Each line the game raises maps to the words its sound
 * board queued (some lines were two words, some had a pause or a breath
 * before or after), who speaks it, and whether the board dropped it when
 * anything else was queued or speaking ("if I can't be first, I won't be at
 * all"). The word text is what macOS `say` is given by scripts/encodeSpeech.ts.
 */

export type Speaker = 'luke' | 'han' | 'ben' | 'vader';

/** The macOS voice for each speaker, its speaking rate, and a pitch scale applied when encoding. */
export const SPEAKERS: Record<Speaker, { voice: string; rate: number; pitchScale: number }> = {
  luke: { voice: 'Eddy (English (US))', rate: 180, pitchScale: 1 },
  han: { voice: 'Reed (English (US))', rate: 190, pitchScale: 1 },
  ben: { voice: 'Daniel', rate: 165, pitchScale: 1 },
  vader: { voice: 'Rocko (English (US))', rate: 150, pitchScale: 1.5 },
};

/** A quarter-second pause (the board's 0xFE) or a synthesised breath (Vader's). */
export const PAUSE = 'pause';
export const BREATH = 'breath';

export interface SpeechLine {
  speaker: Speaker;
  words: string[];
  /** Dropped when anything is queued or being spoken. */
  dropIfBusy?: boolean;
}

export const SPEECH_LINES: Record<string, SpeechLine> = {
  'RED FIVE STANDING BY': { speaker: 'luke', words: ['RED FIVE STANDING BY'] },
  'R2, TRY AND INCREASE THE POWER': { speaker: 'luke', words: [PAUSE, 'R2, TRY AND INCREASE THE POWER'] },
  "THIS IS RED FIVE, I'M GOING IN": { speaker: 'luke', words: ["THIS IS RED FIVE, I'M GOING IN"] },
  'USE THE FORCE, LUKE': { speaker: 'ben', words: ['USE THE FORCE, LUKE'] },
  'THE FORCE IS STRONG WITH THIS ONE': { speaker: 'vader', words: [BREATH, 'THE FORCE IS STRONG WITH THIS ONE', BREATH] },
  "YAHOO, YOU'RE ALL CLEAR KID": { speaker: 'han', words: ['YAHOO', "YOU'RE ALL CLEAR KID"], dropIfBusy: true },
  REMEMBER: { speaker: 'ben', words: ['REMEMBER'] },
  'THE FORCE WILL BE WITH YOU, ALWAYS': { speaker: 'ben', words: ['THE FORCE WILL BE WITH YOU', 'ALWAYS'] },
  'R2 NO': { speaker: 'luke', words: ['R2 NO'] },
  "I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT": { speaker: 'luke', words: [PAUSE, "I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT"], dropIfBusy: true },
  "I'VE LOST R2": { speaker: 'luke', words: [PAUSE, PAUSE, PAUSE, PAUSE, PAUSE, PAUSE, PAUSE, "I'VE LOST R2"], dropIfBusy: true },
  "I CAN'T SHAKE HIM": { speaker: 'luke', words: ["I CAN'T SHAKE HIM"], dropIfBusy: true },
  'LUKE, TRUST ME': { speaker: 'ben', words: ['LUKE, TRUST ME'] },
  'LET GO, LUKE': { speaker: 'ben', words: ['LET GO, LUKE'] },
  'GREAT SHOT KID, THAT WAS ONE IN A MILLION': { speaker: 'han', words: ['GREAT SHOT KID, THAT WAS ONE IN A MILLION'] },
};

/** The board's timings, in seconds. */
export const SPEECH_TIMING = {
  /** After a word's last byte is sent (about 60 ms of it still buffered), before the next word. */
  interWord: 0.256,
  /** Speech still buffered in the chip's FIFO when the inter-word delay starts. */
  fifoTail: 0.06,
  /** A 0xFE pause. */
  pause: 0.256,
  /** After a sentence ends, before the next queued one starts. */
  interMessage: 0.51,
  /** Sentences the queue holds. */
  queueLength: 16,
};
