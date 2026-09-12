/**
 * Decode the original's music tables from a local copy of the Atari source
 * listing into src/data/local/music.ts, which is git-ignored: the game plays
 * these when the file exists and its own compositions otherwise (ADR 0001).
 * Needs local.config.json with `atariSource`: a directory holding SWMUS.MAC,
 * or a zip of the listing. Run with `npm run music`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const config = JSON.parse(readFileSync('local.config.json', 'utf8')) as { atariSource?: string };
if (!config.atariSource) throw new Error('local.config.json needs "atariSource": a directory or zip holding SWMUS.MAC');
const source = config.atariSource.replace(/^~/, homedir());

function readListing(): string {
  if (statSync(source).isDirectory()) return readFileSync(join(source, 'SWMUS.MAC'), 'latin1');
  const names = execFileSync('unzip', ['-Z1', source]).toString().split('\n');
  const entry = names.find((n) => n.endsWith('SWMUS.MAC'));
  if (!entry) throw new Error(`no SWMUS.MAC in ${source}`);
  return execFileSync('unzip', ['-p', source, entry], { maxBuffer: 1 << 24 }).toString('latin1');
}

/** Assemble the listing's .BYTE, .WORD, .GOSUB and .RETURN lines into one image; numbers are hex, a trailing dot marks decimal. */
function assemble(text: string): { image: number[]; directory: number[] } {
  const num = (t: string) => (t.trim().endsWith('.') ? parseInt(t.trim().slice(0, -1), 10) : parseInt(t.trim(), 16));
  const image: (number | { label: string; scope: string | null })[] = [];
  const labels = new Map<string, number>();
  const locals = new Map<string, number>();
  const directoryLabels: string[] = [];
  let scope: string | null = null;
  let inMacro = false;
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    let line = raw.split(';')[0].trimEnd();
    // Macro definitions (.GOSUB and .RETURN) are expanded below, not assembled.
    if (/^\s*\.MACRO\b/.test(line)) inMacro = true;
    if (inMacro) {
      if (/^\s*\.ENDM\b/.test(line)) inMacro = false;
      continue;
    }
    const label = /^([A-Z0-9$]+):/.exec(line);
    if (label) {
      const name = label[1];
      if (name.endsWith('$')) locals.set(`${scope}/${name}`, image.length);
      else {
        scope = name;
        labels.set(name, image.length);
      }
      line = line.slice(label[0].length).replace(/^:/, '');
    }
    const s = line.trim();
    if (s.startsWith('.BYTE')) for (const t of s.slice(5).split(',')) image.push(num(t));
    else if (s.startsWith('.WORD') && scope === 'TUNTAB') directoryLabels.push(...s.slice(5).split(',').map((t) => t.trim()));
    else if (s.startsWith('.GOSUB')) image.push(0x90, { label: s.split(/\s+/)[1], scope }, 0);
    else if (s.startsWith('.RETURN')) image.push(0x91);
  }
  const resolve = (name: string, sc: string | null) => {
    const off = locals.get(`${sc}/${name}`) ?? labels.get(name);
    if (off === undefined) throw new Error(`unresolved label ${name}`);
    return off;
  };
  const out: number[] = [];
  for (let i = 0; i < image.length; i++) {
    const b = image[i];
    if (typeof b === 'number') out.push(b);
    else {
      const off = resolve(b.label, b.scope);
      out.push(off >> 8, off & 0xff);
      i += 1;
    }
  }
  return { image: out, directory: directoryLabels.map((l) => resolve(l, null)) };
}

const music = assemble(readListing());
mkdirSync('src/data/local', { recursive: true });
const file = 'src/data/local/music.ts';
writeFileSync(
  file,
  `/**
 * The original's music tables, decoded by scripts/extractMusic.ts from a
 * local copy of the Atari source. This file is git-ignored and must never be
 * committed: it encodes the film score (ADR 0001).
 */
import type { OriginalMusic } from '../../audio/musicBytes';

export const ORIGINAL_MUSIC: OriginalMusic = {
  image: [${music.image.join(',')}],
  directory: [${music.directory.join(',')}],
};
`,
);
console.log(`wrote ${file}: ${music.image.length} bytes, ${music.directory.length} tunes${existsSync('.gitignore') && readFileSync('.gitignore', 'utf8').includes('src/data/local') ? '' : ' (WARNING: src/data/local is not git-ignored)'}`);
