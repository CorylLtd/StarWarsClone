# Music

The Music Cues play on the two POKEY chips the cabinet reserved for music, through a step-by-step model of its music driver. [music.ts](../../src/audio/music.ts) parses a small note notation and runs the driver's per-step logic (duration accounting, amplitude and frequency envelopes, ties, glides and key offsets) to produce timed register writes; [musicCues.ts](../../src/audio/musicCues.ts) holds the eleven cues as compositions of this project's own; [musicBytes.ts](../../src/audio/musicBytes.ts) reads the driver's byte format so that, when a local copy of the Atari listing has been decoded by [extractMusic.ts](../../scripts/extractMusic.ts), the game can play the original's tables instead. The driver mechanics and the cue points come from the [Music player](../reference/music-player.md) reference.

## Where cues are raised

A cue starts when the simulation pushes `{ type: 'music', cue }` and `dispatch` in [main.ts](../../src/main.ts) calls `SoundEngine.playMusic(cue)`.

| Cue | Raised in | When |
|---|---|---|
| `theme` or `vader` | [dogfight/index.ts](../../src/game/dogfight/index.ts) | Dogfight frame `DOGFIGHT.musicCueFrames.theme` (40); `vader` when `state.wave`, the original's 0-based counter, is odd and at least 3 |
| `themeB` | dogfight/index.ts | frame 200 |
| `descent` | dogfight/index.ts | frame 400 |
| `fourths` | [surface/index.ts](../../src/game/surface/index.ts) | Surface start |
| `rebel` | surface/index.ts | frame `SURFACE.rebelThemeFrame` (224) |
| `rebelRepeats` | [trench/index.ts](../../src/game/trench/index.ts) | Trench pseudo-second 2 |
| `torpedo` | [trench/combat.ts](../../src/game/trench/combat.ts) | the Torpedo enters the Exhaust Port, with the `torpedo` effect |
| `end` | trench/index.ts | the Death Star explosion begins |
| `ben` | [update.ts](../../src/game/update.ts) | game over without a qualifying score |
| `cantina` | [attract/highScores.ts](../../src/game/attract/highScores.ts) | the High Score Table is drawn for Initials Entry |
| one of `TUNES` | [attract/index.ts](../../src/game/attract/index.ts) | a Banner start, chosen at random from nine names |

The frame numbers live in [config.ts](../../src/game/config.ts).

## Playback in SoundEngine

`playMusic` in [sound.ts](../../src/audio/sound.ts) fetches a compiled `MusicTrack` from a cache keyed `ours:<cue>` or `original:<cue>` depending on `useOriginalMusic`. The source is `originalCue(ORIGINAL_MUSIC, cue)` when the original is installed and chosen, otherwise `MUSIC_CUES[cue]`; an unknown cue is ignored. It then, at `currentTime + 0.02`:

1. calls `PokeyBoard.clearChip` on each of `MUSIC_CHIPS` (chips 2 and 3), dropping any queued writes and silencing all four channels;
2. writes `MUSIC_AUDCTL` (0x78) to register 8 of both chips;
3. schedules every `MusicWrite` at `start + round(w.t * sampleRate / STEP_HZ)`;
4. records `{ cue, until }` so `musicPlaying` can answer.

A new cue therefore cuts off the old one, as the original's driver did, and nothing else stops music. The music output of the board passes through the 3.5 kHz low-pass and `MUSIC_GAIN` described on the [Sound effects](sound-effects.md) page.

## The driver model in music.ts

### Constants

| Export | Value |
|---|---|
| `STEP_HZ` | `BEAT_HZ` from effects.ts, 123.0012 steps per second: each Voice is updated every other 4 ms tick |
| `MUSIC_CHIPS` | `[2, 3]` |
| `MUSIC_AUDCTL` | 0x78: channels 1+2 and 3+4 joined into 16-bit dividers at the chip clock |
| `VOICE_HARDWARE` | Voice 1: chip 3 registers 0, 2, 3; Voice 2: chip 3 registers 4, 6, 7; Voice 3: chip 2 registers 0, 2, 3; Voice 4: chip 2 registers 4, 6, 7 |
| `AMP_ENVELOPES` | `none`, `steel`, `hard`, `rise`, `ties`: 32 volume offsets indexed by steps since the note began |
| `FREQ_ENVELOPES` | `none`, `glock`: 128 divider offsets indexed by half-steps since the note began |

Each Voice is a joined channel pair: `lo` is the low AUDF, `hi` the high AUDF, and `ctl` the AUDC of the high channel, which carries the distortion bits and the volume.

### Pitch

`noteNumber(name)` turns a name such as `A4` into the driver's numbering: 1 is C0 and 58 is A4; 0 is a rest. `noteDivider(note)` computes the 16-bit divider for the chip clock, `round(POKEY_CLOCK_HZ / (2 * hz)) - 7`, clamped to 0 to 0xFFFF, from `16.3516 * 2^((note - 1) / 12)` Hz. The test `sounds A4 at 440 Hz on the chip clock` checks the round trip within 0.5 %.

### Notation

`parseVoice(text)` tokenises one Voice into `Item` values. A token is either a setting in braces or a note.

| Token | Item |
|---|---|
| `{rate n}` or `{rate +n}` | `rate`, absolute or relative |
| `{vol n}` or `{vol -n}` | `vol`, the median volume 0 to 15 |
| `{key n}` | `key`, a semitone offset added to every following note |
| `{env name}` | `env`, one of the `AMP_ENVELOPES` keys |
| `{fenv name}` | `fenv`, one of the `FREQ_ENVELOPES` keys |
| `{synth on}` or `{synth off}` | `synth` |
| `{tone pure}` or `{tone buzz}` | `tone`, AUDC distortion bits 0xA0 or 0xC0 |
| note | `note` with `note` number, `units` and `tied` |

A note token is a name (`C`, `D`, ... with `#` or `b`, then an octave), or `R` for a rest, followed by a duration: `w h q e s t` for 128, 64, 32, 16, 8 and 4 units, an optional `.` for dotted, an optional `3` for a triplet, or `:n` for units directly. A quarter note is 32 units. Triplets are rounded through a running accumulator so that three of them sum exactly. A trailing `~` ties the token to the next note: the next note is parsed with `tied: true`. Unknown settings, envelope names and malformed tokens throw.

`rep(times, phrase)` repeats a phrase and `diatonic(phrase, degrees)` moves every note by scale degrees within C major, dropping accidentals, leaving rests and settings alone. Both are helpers for writing cues.

### `compileVoice`

`compileVoice(source, voice)` accepts either notation or an iterable of `Item` values (the byte decoder produces the latter) and runs the driver's step loop for one Voice. State per Voice, with its initial value:

| Variable | Initial | Role |
|---|---|---|
| `odur` | 0 | duration counter |
| `rate` | 64 | units drained per step |
| `vvol` | 7 | median volume |
| `key` | 0 | semitone offset |
| `tone` | 0xA0 | distortion bits |
| `env`, `fenv` | `none` | envelopes |
| `synth` | false | glide mode |
| `vseq` | 0 | steps since the last untied note, saturating at 255 |
| `onote` | 0 | current divider |
| `vsa` | 0 | glide offset |

Each step: `vseq` increments; `odur -= rate`; when it goes negative the loop pulls items until it finds a note. Settings take effect immediately. A note sets `vsa = onote - divider`, `onote = divider` and adds `units * 128` to `odur`, so any overrun carries into the next note and a quarter note lasts `4096 / rate` steps. An untied note resets `vseq` and `vsa` to 0; a tied note leaves `vseq` running, and clears `vsa` unless `synth` is on. Running out of items emits a volume-zero write to `ctl` and returns `{ writes, length: step }`. A Voice that never ends throws after `MAX_STEPS` (20 000).

Then the output for the step: with synth on, `vsa` is halved (arithmetic shift) every fourth step, so a tied note glides from the previous pitch. The divider is `onote + fenv[min(vseq >> 1, 127)] * 8 + vsa`, masked to 16 bits. The volume is `clamp(vvol + env[min(vseq, 31)], 0, 15)` for a note and 0 for a rest; the control byte keeps the tone bits either way. Writes are emitted only for registers whose value changed, with `t = step + phase`, where `phase` is 0.5 for Voices 2 and 4 because the original updated them on the alternate 4 ms tick.

A `vol` setting is 8-bit arithmetic with sign: `{vol -1}` from 0 yields -1, which the clamp turns into silence rather than wrapping to 15.

### `compileCue`

`compileCue(cue)` compiles the four Voices, concatenates their writes, sorts by `t`, and returns a `MusicTrack` with `writes`, `length` (the longest Voice) and `voiceLengths`.

```ts
export interface MusicCue {
  voices: [string, string, string, string]
        | [Iterable<Item>, Iterable<Item>, Iterable<Item>, Iterable<Item>];
}
```

## The cues in musicCues.ts

`MUSIC_CUES` maps the eleven names to `MusicCue` values built from notation strings with `rep` and `diatonic`. Voice 1 is the lead. These are compositions for this project: the original's tables encode the film score, which ADR 0001 keeps out of the repository, so only the cue points, lengths, tempi, envelopes and voice roles of the [Music player](../reference/music-player.md) reference are reproduced. Do not add melodic material from the original.

`ORIGINAL_CUE_SECONDS` records the original cue lengths measured by simulating the driver over its tables:

| Cue | Original length (s) |
|---|---|
| `theme` | 6.28 |
| `themeB` | 8.59 |
| `descent` | 6.24 |
| `vader` | 7.4 |
| `fourths` | 10.93 |
| `rebel` | 15.91 |
| `rebelRepeats` | 11.69 |
| `end` | 13.79 |
| `ben` | 12.68 |
| `cantina` | 27.64 |
| `torpedo` | 0.44 |

`torpedo` is built by a function rather than written out: four Voices of two-unit tied notes stepping down a semitone at a time with the rate rising each note, synth on and volume 15, each Voice at a different key offset.

### Writing or changing a cue

A cue is four notation strings, Voice 1 first. The constraints the tests impose:

1. Each Voice's units should add up to the same total, so the four end within 3 % of each other. `rep` and `diatonic` help keep parallel Voices aligned.
2. The whole cue must land within 10 % of `ORIGINAL_CUE_SECONDS[name]`: the game raises the next cue on its own clock and does not wait.
3. Use only the settings the parser knows; an unknown envelope or tone throws at compile time, which the test `every cue compiles` catches.
4. Keep to the outward shape recorded in the [Music player](../reference/music-player.md) reference (rate, envelopes, voice roles) and do not reproduce the original's melodies.

A quick way to size a Voice: at rate `r` a quarter note is `4096 / r` steps and a step is 8.13 ms, so a cue of `q` quarters at rate `r` lasts `q × 4096 / (r × 123)` seconds. `window.__swRenderMusic(name, true)` reports the compiled length without listening.

### Registers written per Voice

Each Voice touches three registers of its chip, and `compileVoice` emits a write only when the value changes:

| Register | Written when |
|---|---|
| `lo` (AUDF of the low channel) | the low byte of the divider changes: every new note, every glide step, every `glock` half-step |
| `hi` (AUDF of the high channel) | the high byte changes: less often, since neighbouring notes often share it |
| `ctl` (AUDC of the high channel) | the volume or tone bits change: every envelope step, every rest, and the final volume 0 |

The low channels' AUDC registers (1 and 5) are never written and stay at 0, which is why the test `every cue compiles` accepts only registers 0, 2, 3, 4, 6 and 7.

## The original's tables

### musicBytes.ts

The driver's tune format is two bytes per instruction. `tuneItems(music, tune)` is a generator that walks a tune from `music.directory[tune]` and yields the same `Item` values the notation parser does, so `compileVoice` does not know which source it is reading. The decoding:

| Op byte | Data | Yields |
|---|---|---|
| 1 to 97, or 0 | duration, low bit = tie | `note` with `units = duration >> 1`; a duration of 0 ends the tune or returns from a called one |
| 0x80 / 0x81 | n | `rate` absolute / relative |
| 0x82 / 0x83 | n | `vol` absolute / relative (signed) |
| 0x84 / 0x85 | n | `key` absolute / relative (signed) |
| 0x86 | i | `fenv` by index into `none`, `glock` |
| 0x87 | i | `env` by index into `none`, `steel`, `hard`, `rise`, `ties` |
| 0x8A | bits | `tone` |
| 0x8C | flag | `synth` |
| 0x8D | i | call tune `i` from the directory, returning at its end |
| 0x8E / 0x8F | n | loop start (n times) / loop end |
| 0x90 addr | | gosub to a 16-bit address in the image |
| 0x91 | | return |
| other | | ignored, as the driver as built did |

`ORIGINAL_CUE_TUNES` maps each cue name to the four directory indices its cue routine started, and `originalCue(music, cue)` builds a `MusicCue` of four generators from them. `OriginalMusic` is `{ image: number[], directory: number[] }`.

### extractMusic.ts and the local file

`npm run music` runs [scripts/extractMusic.ts](../../scripts/extractMusic.ts). It reads `atariSource` from the git-ignored `local.config.json`, a directory or zip holding the listing, and pulls `SWMUS.MAC` from it. `assemble` walks the listing's lines, skipping macro definitions and comments, and collects `.BYTE` values (hex, or decimal with a trailing dot) into one image, records labels and local labels, expands `.GOSUB label` into `0x90` plus a resolved 16-bit address and `.RETURN` into `0x91`, and takes the `.WORD` entries under the `TUNTAB` label as the tune directory. The output is `src/data/local/music.ts` exporting `ORIGINAL_MUSIC: OriginalMusic`. The script warns if `src/data/local` is not git-ignored.

`sound.ts` picks the file up with `import.meta.glob('../data/local/music.ts', { eager: true })`, which is empty when the file is absent, so `ORIGINAL_MUSIC` is `null` and `useOriginalMusic` starts false. With the file present the original plays by default; `?music=ours` on the URL restores `MUSIC_CUES`. The file must never be committed.

## Tests

[music.test.ts](../../src/audio/music.test.ts) covers four areas.

| Group | What it checks |
|---|---|
| notation | note numbering (`C0` is 1, `A4` is 58, `Bb3` equals `A#3`); A4 renders within 0.5 % of 440 Hz; durations, dots, triplets, explicit units and ties parse to the expected units; bad tokens throw; `diatonic` moves a phrase by degrees |
| the player | a quarter at rate 64 lasts 64 steps and ends with a volume-zero write; overrun carries; `hard` and `steel` shape the first volumes; a tie keeps the envelope running; a rest keeps the tone bits; a synth glide starts between the two dividers and lands on the target; Voices 2 and 4 sit at `t % 1 === 0.5` |
| the cues | every cue name the game raises (including the `TUNES` array in the attract) exists in `MUSIC_CUES`; every cue compiles, writes only chips 2 and 3 and registers 0, 2, 3, 4, 6, 7, and ends with volume 0 on every Voice; the four Voices of a cue end within 3 % of each other; each cue's length is within 10 % of `ORIGINAL_CUE_SECONDS` |
| the driver's byte format | a hand-built image exercises rate, loops, key changes, gosub, call and end; when `src/data/local/music.ts` exists, each original cue runs within 3 % of `ORIGINAL_CUE_SECONDS`, otherwise the test returns without asserting |

The 10 % bound is what keeps the cue points lined up: the game does not wait for a cue to end, so a cue that ran long would overlap the next.

## Dev helpers

`window.__swSound.playMusic(cue)` plays a cue after a click. `window.__swRenderMusic(cue, ours)` compiles the cue (the original when installed unless `ours` is true), renders it on an `OfflineAudioContext` through a `PokeyBoard`, and reports its length, write count, peak and RMS per second.
