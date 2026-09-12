/**
 * The TMS5220's coefficient ROM: what the chip decodes each frame's indices
 * into. Chip constants (as recovered from the die and published in MAME),
 * shared by the offline encoder and the worklet model.
 */

/** Frame energies by 4-bit index; 0 is silence, 15 is the stop frame. */
export const ENERGY = [0, 1, 2, 3, 4, 6, 8, 11, 16, 23, 33, 47, 63, 85, 114, 0];

/** Pitch periods in samples at 8 kHz by 6-bit index; 0 is unvoiced. */
export const PITCH = [
  0, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 46, 48, 50, 52, 53, 56, 58, 60, 62, 65, 68, 70, 72,
  76, 78, 80, 84, 86, 91, 94, 98, 101, 105, 109, 114, 118, 122, 127, 132, 137, 142, 148, 153, 159,
];

/** Bits per reflection coefficient K1..K10 in a voiced frame; an unvoiced frame carries K1..K4 only. */
export const K_BITS = [5, 5, 4, 4, 4, 4, 4, 3, 3, 3];

/** Reflection coefficients K1..K10 by index, in units of 1/512. */
export const K_TABLES: number[][] = [
  [-501, -498, -497, -495, -493, -491, -488, -482, -478, -474, -469, -464, -459, -452, -445, -437, -412, -380, -339, -288, -227, -158, -81, -1, 80, 157, 226, 287, 337, 379, 411, 436],
  [-328, -303, -274, -244, -211, -175, -138, -99, -59, -18, 24, 64, 105, 143, 180, 215, 248, 278, 306, 331, 354, 374, 392, 408, 422, 435, 445, 455, 463, 470, 476, 506],
  [-441, -387, -333, -279, -225, -171, -117, -63, -9, 45, 98, 152, 206, 260, 314, 368],
  [-328, -273, -217, -161, -106, -50, 5, 61, 116, 172, 228, 283, 339, 394, 450, 506],
  [-328, -282, -235, -189, -142, -96, -50, -3, 43, 90, 136, 182, 229, 275, 322, 368],
  [-256, -212, -168, -123, -79, -35, 10, 54, 98, 143, 187, 232, 276, 320, 365, 409],
  [-308, -260, -212, -164, -117, -69, -21, 27, 75, 122, 170, 218, 266, 314, 361, 409],
  [-256, -161, -66, 29, 124, 219, 314, 409],
  [-256, -176, -96, -15, 65, 146, 226, 307],
  [-205, -132, -59, 14, 87, 160, 234, 307],
];

/** The voiced excitation: one glottal pulse, 52 samples, then silence to the end of the pitch period. */
export const CHIRP = [
  0x00, 0x03, 0x0f, 0x28, 0x4c, 0x6c, 0x71, 0x50, 0x25, 0x26, 0x4c, 0x44, 0x1a, 0x32, 0x3b, 0x13, 0x37, 0x1a, 0x25, 0x1f, 0x1d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
].map((v) => (v > 127 ? v - 256 : v));

/** Interpolation shifts for the eight periods of a frame: the parameters close (target - current) >> shift; 0 is the jump to the target. */
export const INTERP_SHIFT = [0, 3, 3, 3, 2, 2, 1, 1];

/** Samples per second, per frame and per interpolation period. */
export const SAMPLE_RATE = 8000;
export const FRAME_SAMPLES = 200;
export const PERIOD_SAMPLES = 25;

/** Everything the worklet needs, as one object it can be handed at construction. */
export const TMS5220_TABLES = { ENERGY, PITCH, K_BITS, K_TABLES, CHIRP, INTERP_SHIFT, FRAME_SAMPLES, PERIOD_SAMPLES, SAMPLE_RATE };
