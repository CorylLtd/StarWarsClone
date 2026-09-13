# Speech

The Speech Lines are the arcade's words at the arcade's trigger points, spoken in voices of this project's own through a model of the sound board's TMS5220 speech chip. [speech.ts](../../src/audio/speech.ts) reproduces the board's sentence queue and timings; [speechLines.ts](../../src/audio/speechLines.ts) maps each line to its Words, its Speaker and its queue rule; [tms5220Processor.ts](../../src/audio/tms5220Processor.ts) models the chip in an `AudioWorklet` from the tables in [tms5220Tables.ts](../../src/audio/tms5220Tables.ts). The frames the chip plays are produced offline by [scripts/encodeSpeech.ts](../../scripts/encodeSpeech.ts) and [scripts/lpc.ts](../../scripts/lpc.ts) from macOS `say` and checked in as [src/data/speech.ts](../../src/data/speech.ts). The speech ROMs, which hold the film's actors, are never read by the repository's code; with a local ROM set, [scripts/extractSpeech.ts](../../scripts/extractSpeech.ts) decodes them into a git-ignored file that the game then prefers. The board's driver and its sentence table are in the [Speech](../reference/speech.md) reference.

## Where lines are raised

The simulation pushes `{ type: 'speech', line }` and `dispatch` in [main.ts](../../src/main.ts) calls `SoundEngine.speak(line)`, which passes it to `SpeechEngine.say` unless muted.

| Line | Raised in | When |
|---|---|---|
| `RED FIVE STANDING BY` | [update.ts](../../src/game/update.ts) | game start |
| `I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT` | [dogfight/guns.ts](../../src/game/dogfight/guns.ts) | first shield hit with more than three left |
| `R2, TRY AND INCREASE THE POWER` | dogfight/guns.ts | shields down to two |
| `I'VE LOST R2` | dogfight/guns.ts | the last shield is lost |
| `I CAN'T SHAKE HIM` | dogfight/guns.ts | the shake counter runs out |
| `THIS IS RED FIVE, I'M GOING IN` | [dogfight/index.ts](../../src/game/dogfight/index.ts) | the Dogfight ends |
| `USE THE FORCE, LUKE` | [surface/index.ts](../../src/game/surface/index.ts), [trench/index.ts](../../src/game/trench/index.ts) | the Surface's last lap; a Trench not entered from the Surface and not repeated |
| `LUKE, TRUST ME` or `LET GO, LUKE` | trench/index.ts | Trench pseudo-second 16; the first when `state.wave` is even, the second when odd |
| `YAHOO, YOU'RE ALL CLEAR KID` | trench/index.ts | pseudo-second 24 when `state.wave` is even |
| `THE FORCE IS STRONG WITH THIS ONE` | trench/index.ts | pseudo-second 22 when `state.wave` is odd |
| `GREAT SHOT KID, THAT WAS ONE IN A MILLION` | trench/index.ts | Exhaust Port hit when `state.wave` is odd and at least 3 |

`state.wave` is the original's 0-based counter: 0 is displayed wave 1, so "even" here means odd displayed waves.
| `R2 NO` | trench/index.ts | Exhaust Port missed |
| `REMEMBER`, `THE FORCE WILL BE WITH YOU, ALWAYS` | update.ts | game over |

## speechLines.ts

### Speakers

`SPEAKERS` maps the four `Speaker` values to a macOS voice, a speaking rate for `say -r`, and a `pitchScale` applied by the encoder:

| Speaker | Voice | Rate | Pitch scale |
|---|---|---|---|
| `luke` | Eddy (English (US)) | 180 | 1 |
| `han` | Reed (English (US)) | 190 | 1 |
| `ben` | Daniel | 165 | 1 |
| `vader` | Rocko (English (US)) | 150 | 1.5 |

A pitch scale above one multiplies the detected pitch period, lowering the voice.

### Lines

```ts
export interface SpeechLine {
  speaker: Speaker;
  words: string[];
  dropIfBusy?: boolean;
}
```

`SPEECH_LINES` is keyed by the line text the game raises. `words` is the list the board queued: one or more Word strings, with `PAUSE` (`'pause'`, the board's 0xFE quarter-second) and `BREATH` (`'breath'`, a synthesised frame sequence used around Vader's line) where the sentence table had them. Some lines are two Words (`YAHOO` then `YOU'RE ALL CLEAR KID`; `THE FORCE WILL BE WITH YOU` then `ALWAYS`); `I'VE LOST R2` is preceded by seven pauses. `dropIfBusy` marks the lines the board sent with `SPITE`, which spoke only when nothing was queued or sounding: `YAHOO, YOU'RE ALL CLEAR KID`, `I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT`, `I'VE LOST R2` and `I CAN'T SHAKE HIM`.

| Line | Speaker | Words | Drop if busy |
|---|---|---|---|
| `RED FIVE STANDING BY` | luke | 1 | |
| `R2, TRY AND INCREASE THE POWER` | luke | pause, 1 | |
| `THIS IS RED FIVE, I'M GOING IN` | luke | 1 | |
| `USE THE FORCE, LUKE` | ben | 1 | |
| `THE FORCE IS STRONG WITH THIS ONE` | vader | breath, 1, breath | |
| `YAHOO, YOU'RE ALL CLEAR KID` | han | 2 | yes |
| `REMEMBER` | ben | 1 | |
| `THE FORCE WILL BE WITH YOU, ALWAYS` | ben | 2 | |
| `R2 NO` | luke | 1 | |
| `I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT` | luke | pause, 1 | yes |
| `I'VE LOST R2` | luke | 7 pauses, 1 | yes |
| `I CAN'T SHAKE HIM` | luke | 1 | yes |
| `LUKE, TRUST ME` | ben | 1 | |
| `LET GO, LUKE` | ben | 1 | |
| `GREAT SHOT KID, THAT WAS ONE IN A MILLION` | han | 1 | |

`ORIGINAL_WORD_INDEX` maps each Word to the board's word index, for playing the original's phrases when installed. `SPEECH_TIMING` holds the board's timings in seconds: `interWord` 0.256, `fifoTail` 0.06, `pause` 0.256, `interMessage` 0.51 and `queueLength` 16.

## SpeechEngine

`SpeechEngine` in [speech.ts](../../src/audio/speech.ts) is constructed by `SoundEngine.unlock` with the context, the master gain and `SPEECH_GAIN`. It loads the worklet from a Blob URL of `TMS5220_PROCESSOR_SOURCE`, creates `new AudioWorkletNode(ctx, 'tms5220', { outputChannelCount: [1], processorOptions: { tables: TMS5220_TABLES } })` and connects it through a `GainNode`. Messages posted before the node exists wait in `pending`, as in `PokeyBoard`. `setGain` works before the node exists by stashing the value. `whenReady` returns the load promise.

### `say`

`say(line, from = currentTime + 0.02)` returns the context time at which the line will start, or `null` if it was dropped or unknown. In order:

1. Look the line up in `SPEECH_LINES`; unknown lines return `null`.
2. If `now >= freeAt` the queue has drained, so `queued` resets to 0.
3. `busy` is `queued > 0 || now < busyUntil`. A `dropIfBusy` line returns `null` when busy.
4. A full queue (`queued >= 16`) returns `null`.
5. The start time `t` is the later of `from` and `freeAt`.
6. For each entry in `words`: `PAUSE` adds `SPEECH_TIMING.pause`; otherwise the Word's frames are looked up with `wordData`, a `speak` message is posted at `sampleAt(t)`, and `t` advances by the Word's duration (`frames * FRAME_SAMPLES / SAMPLE_RATE`) minus `fifoTail` plus `interWord`. The subtraction reproduces the board starting its 256 ms wait while about 60 ms of speech was still in the chip's FIFO.
7. `busyUntil = t`, `freeAt = t + interMessage`, `queued` increments, and the line is appended to a 64-entry history for the dev console.

`wordData` returns the original's frames when `useOriginal` is set and `ORIGINAL_SPEECH` holds the Word's index, and `SPEECH_WORDS[word]` otherwise. `busy()` and `history()` are for the dev console.

The timing is all computed on the main thread from frame counts; the worklet does not report back. The worklet starts a queued Word only when the chip is not already speaking, so a Word that runs past its predicted end delays the next rather than overlapping it.

### A worked example

`RED FIVE STANDING BY` is one Word of 64 frames in the checked-in data. With the queue empty and `from` 20 ms ahead of now:

| Step | Time from `from` |
|---|---|
| the Word's `speak` message | 0 |
| its 64 frames end | 64 × 200 / 8000 = 1.6 s |
| `t` after the Word | 1.6 − 0.06 + 0.256 = 1.796 s, which becomes `busyUntil` |
| `freeAt` | 1.796 + 0.51 = 2.306 s |

A second `say` before 1.796 s sees `busy` true: a `dropIfBusy` line is dropped, any other line is scheduled from `freeAt`. A `say` at or after 2.306 s resets `queued` and starts at once. The 0.51 s inter-message gap is why two lines raised in the same Game Frame, as at game over (`REMEMBER` then `THE FORCE WILL BE WITH YOU, ALWAYS`), are heard with half a second between them.

### The original's phrases

`ORIGINAL_SPEECH` is loaded through `import.meta.glob('../data/local/speech.ts', { eager: true })` and is `null` when that git-ignored file is absent. `SpeechEngine.useOriginal` defaults to `ORIGINAL_SPEECH !== null`, but `SoundEngine.unlock` overwrites it with `SoundEngine.useOriginalSpeech`, which defaults to `true` and is cleared by `?speech=ours`; with the file absent `wordData` falls through to `SPEECH_WORDS` anyway. When the original is in use `SoundEngine` sets the gain to `SPEECH_GAIN_ORIGINAL` (0.85) because the original's phrases were recorded hotter.

## The chip model

### Why the core is a string

[tms5220Processor.ts](../../src/audio/tms5220Processor.ts) exports two strings. `TMS5220_CORE_SOURCE` defines the `Tms5220` class; `TMS5220_PROCESSOR_SOURCE` is that string followed by a `Tms5220Processor` worklet class and `registerProcessor('tms5220', ...)`. An `AudioWorklet` module must be loaded from a URL, and a Blob URL of a string needs no build step. Keeping the core separate lets [speech.test.ts](../../src/audio/speech.test.ts) and [extractSpeech.ts](../../scripts/extractSpeech.ts) evaluate it outside the worklet:

```ts
const Tms5220 = new Function(`${TMS5220_CORE_SOURCE}; return Tms5220;`)();
```

The class is therefore untyped JavaScript; the test file declares a small `Chip` interface for it.

### tms5220Tables.ts

The chip's coefficient ROM, as recovered from the die and published in MAME, shared by the encoder and the model:

| Export | Content |
|---|---|
| `ENERGY` | 16 frame energies by 4-bit index; 0 is silence, 15 the stop frame |
| `PITCH` | 64 pitch periods in samples by 6-bit index; 0 is unvoiced |
| `K_BITS` | bits per reflection coefficient K1 to K10: 5, 5, 4, 4, 4, 4, 4, 3, 3, 3 |
| `K_TABLES` | the coefficient values by index, in units of 1/512 |
| `CHIRP` | the 52-sample glottal pulse |
| `INTERP_SHIFT` | shifts for the eight interpolation periods: 0, 3, 3, 3, 2, 2, 1, 1 |
| `SAMPLE_RATE`, `FRAME_SAMPLES`, `PERIOD_SAMPLES` | 8000, 200, 25 |
| `TMS5220_TABLES` | all of the above as one object for `processorOptions` |

### `Tms5220`

`speak(bytes)` starts a packed frame stream. `bits(n)` reads most significant bit first; running out of data returns -1, which `parseFrame` treats like a stop. `parseFrame` reads a 4-bit energy; 0 keeps the filter shape with the energy target at 0, 15 (or exhausted data) clears `speaking`. Otherwise it reads the repeat bit and 6-bit pitch, looks up the energy and pitch targets, and unless repeating reads K1 to K4 (unvoiced) or K1 to K10 (voiced) as table indices. `inhibit` is set when the previous frame was silent or the voicing changed, so the new frame takes effect at once instead of being interpolated.

`interpolate` runs at the start of each 25-sample period. Period 0 copies the targets to the working parameters, parses the next frame, and jumps straight to it if inhibited; periods 1 to 7 close each parameter by `(target - current) >> INTERP_SHIFT[ip]`.

`sample` produces one 8 kHz value. When idle it clears the lattice and returns 0. Unvoiced excitation is plus or minus 64 from a 13-bit shift register; voiced excitation is the chirp once per pitch period. The ten-stage lattice filter runs in the chip's integer arithmetic with `>> 9` products, the output is clipped to 12 bits and scaled to -1 to 1.

### `Tms5220Processor`

The worklet holds one chip and a queue of `{ at, data }` messages sorted by sample time. `process` starts the next queued Word when its time has come and the chip is idle, runs the chip at 8 kHz through a step accumulator, AC-couples the output with a one-pole DC blocker (the board's output stage was AC-coupled), and linearly interpolates between 8 kHz samples up to the context rate. A `stop` message empties the queue and resets the chip; nothing in the game sends one.

## The encoder

### scripts/lpc.ts

Frames are 25 ms at 8 kHz. `analyse(input, options)` returns `Frame[]`, each `{ energy, repeat, pitch, k }` as table indices, ending in a stop frame. The options are `pitchScale`, `gain`, `preEmphasis` (0.75), `voicing` (0.45) and `normalise` (scale to a 0.9 peak first so every voice encodes at the same level).

Per frame, over a 240-sample Hamming window centred on it:

- autocorrelation of the pre-emphasised signal to order 10, then `levinson` for the reflection coefficients and residual energy;
- `detectPitch` on the raw signal: centre-clipped normalised autocorrelation over the chip's lag range, with a half-period check against octave-low errors, voiced when the peak exceeds `voicing`;
- energy: the residual RMS on the 16-bit scale divided by 16, then by the excitation level (8 for unvoiced, `sqrt(CHIRP_ENERGY / period) / 8` for voiced), times `gain`, quantised to the nearest of `ENERGY[0..14]`.

The pitch track is median-smoothed over three frames, multiplied by `pitchScale`, and quantised to `PITCH`; a silent frame gets pitch 0. Leading and trailing silence are trimmed to one frame each.

Sign convention: `levinson` returns coefficients in the predictor convention, where K1 is positive for a low-pass signal, and `analyse` quantises `-ki * 512` against `K_TABLES`. So `k_chip = -k_levinson`. The test `recovers a lattice's coefficients from what the chip produces with them` pins this: frames with chosen K indices are rendered through the chip model, analysed, and the same indices come back.

`breathFrames` synthesises an unvoiced "h" over 14 frames with a fixed envelope and four hand-picked coefficients. `packFrames` writes energy, repeat, pitch and the coefficients in the chip's bit widths, most significant bit first. `readWav` parses a 16-bit mono WAV.

The packed frame layout, as `packFrames` writes it and `parseFrame` reads it:

| Field | Bits | Present when |
|---|---|---|
| energy | 4 | always; 0 or 15 ends the frame here |
| repeat | 1 | energy 1 to 14 |
| pitch | 6 | energy 1 to 14 |
| K1 to K4 | 5, 5, 4, 4 | not a repeat frame |
| K5 to K10 | 4, 4, 4, 3, 3, 3 | not a repeat frame and pitch not 0 |

The encoder never sets `repeat`, so the repeat path in the chip model is exercised only by the original's phrases.

### Changing a voice or a line

To change who says a line or which macOS voice a Speaker uses, edit `SPEECH_LINES` or `SPEAKERS` in [speechLines.ts](../../src/audio/speechLines.ts) and run `npm run speech`; the line test fails until the new Words have frames. Voice names must be installed on the machine that runs the script (`say -v ?` lists them). To make a line drop when the board is busy, set `dropIfBusy`; to add a pause, insert `PAUSE` into `words`. A new line also needs a `type: 'speech'` event in `src/game`, and the reverse: an event whose line is not in `SPEECH_LINES` fails the test.

### scripts/encodeSpeech.ts

`npm run speech` (macOS only) collects every distinct Word from `SPEECH_LINES`, remembering the first Speaker to use it, and for each runs

```
say -v <voice> -r <rate> -o <file> --data-format=LEI16@8000 <word, lower-cased>
```

then `readWav`, `analyse` with the Speaker's `pitchScale`, and `packFrames`. It appends `breathFrames` under the `BREATH` key and writes `src/data/speech.ts`, which exports `SPEECH_WORDS: Record<string, { frames, data }>` with the packed frames as hex. Regenerate after changing a line's words or a Speaker's voice.

### scripts/extractSpeech.ts

`npm run speech:original` reads `romSet` from the git-ignored `local.config.json`, the MAME zip or a directory, and takes the sound board program ROM `136021.107` (8192 bytes, based at 0x4000). Its phrase table at 0x4002 gives each of the 23 Words a start and end address. Each phrase's bytes are bit-reversed, because the chip took bytes least significant bit first and the model reads most significant bit first, then run through the chip core to count frames until it stops. The output is `src/data/local/speech.ts` exporting `ORIGINAL_SPEECH: Record<number, { frames, data }>` keyed by word index. This file holds the film's actors and must never be committed.

## Tests

[speech.test.ts](../../src/audio/speech.test.ts):

| Group | Checks |
|---|---|
| the chip tables | 16 energies, 64 pitches, 52 chirp samples, each K table sized `1 << K_BITS[i]` |
| the chip model | silent until spoken to and after a stop frame; the first six checked-in Words fall silent within a frame of their end; flat coefficients reproduce the chirp at the frame's pitch period; energy interpolates across the eight periods and reaches the target |
| the encoder | `packFrames` round-trips through the chip; `detectPitch` finds a 66-sample pulse train; the K sign convention round-trips; `levinson` gives a positive K1 for a low-pass signal; a breath is unvoiced and ends with a stop |
| the lines | every line the game raises (including the `even ? ... : ...` pair in the Trench) has an entry, and every Word has frames; every checked-in Word ends with a stop and is loud for more than half its frames |
| the original's phrases | when `src/data/local/speech.ts` exists, every indexed Word is present, decodes to speech that stops, is longer than 8 frames and mostly loud; otherwise the test returns without asserting |

## Dev helpers

`window.__swSound.speak(line)` queues a line after a click and `window.__swSound.speechEngine()` exposes `busy()` and `history()`. `window.__swRenderSpeech(line)` renders a line on an `OfflineAudioContext` with the current `useOriginalSpeech` choice and reports its start, length, peak and RMS per quarter second.
