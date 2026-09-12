/**
 * Decode the original's speech phrases from a local copy of the ROM set into
 * src/data/local/speech.ts, which is git-ignored: the game plays these when
 * the file exists and its own voices otherwise (ADR 0001). Needs
 * local.config.json with `romSet`: the MAME zip (or a directory) holding the
 * sound board program ROM 136021.107, whose phrase table at 0x4002 gives each
 * word's start and end. Run with `npm run speech:original`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { TMS5220_CORE_SOURCE } from '../src/audio/tms5220Processor.ts';
import { FRAME_SAMPLES, TMS5220_TABLES } from '../src/audio/tms5220Tables.ts';

const SOUND_ROM = '136021.107';
const ROM_BASE = 0x4000;
const TABLE = 0x4002;
const WORDS = 24;

const config = JSON.parse(readFileSync('local.config.json', 'utf8')) as { romSet?: string };
if (!config.romSet) throw new Error('local.config.json needs "romSet": the ROM zip or a directory holding 136021.107');
const source = config.romSet.replace(/^~/, homedir());
const rom = statSync(source).isDirectory() ? readFileSync(join(source, SOUND_ROM)) : execFileSync('unzip', ['-p', source, SOUND_ROM], { maxBuffer: 1 << 20 });
if (rom.length !== 0x2000) throw new Error(`${SOUND_ROM}: expected 8192 bytes, got ${rom.length}`);

interface Chip {
  speaking: boolean;
  speak(bytes: number[]): void;
  sample(): number;
}
const Tms5220 = new Function(`${TMS5220_CORE_SOURCE}; return Tms5220;`)() as new (tables: unknown) => Chip;

/** The chip took each byte least significant bit first; the model reads most significant bit first. */
const reverse = (b: number) => {
  let r = 0;
  for (let i = 0; i < 8; i++) r |= ((b >> i) & 1) << (7 - i);
  return r;
};

const entries: string[] = [];
for (let word = 1; word < WORDS; word++) {
  const at = TABLE - ROM_BASE + word * 4;
  const start = rom.readUInt16BE(at) - ROM_BASE;
  const end = rom.readUInt16BE(at + 2) - ROM_BASE;
  const bytes = Array.from(rom.subarray(start, end), reverse);
  const chip = new Tms5220(TMS5220_TABLES);
  chip.speak(bytes);
  let frames = 0;
  while (chip.speaking && frames < 2000) {
    for (let i = 0; i < FRAME_SAMPLES; i++) chip.sample();
    frames += 1;
  }
  console.log(`word ${String(word).padStart(2)}: ${end - start} bytes, ${frames} frames (${(frames / 40).toFixed(2)} s)`);
  entries.push(`  ${word}: { frames: ${frames}, data: '${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}' },`);
}
mkdirSync('src/data/local', { recursive: true });
const file = 'src/data/local/speech.ts';
writeFileSync(
  file,
  `/**
 * The original's speech phrases, decoded by scripts/extractSpeech.ts from a
 * local copy of the ROM set. This file is git-ignored and must never be
 * committed: it holds the film's actors (ADR 0001). Keyed by the sound
 * board's word index; frames are 25 ms, the last a stop frame.
 */
export const ORIGINAL_SPEECH: Record<number, { frames: number; data: string }> = {
${entries.join('\n')}
};
`,
);
console.log(`wrote ${file}`);
