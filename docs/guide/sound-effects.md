# Sound effects and the POKEY model

Every Sound Effect in the game is the register sequence the cabinet's sound board produced, replayed Beat by Beat through a software model of its four POKEY chips. The simulation raises a `GameEvent` of type `sound`; `main.ts` hands the name to `SoundEngine.play`, which looks the effect up in the traced tables of [effects.ts](../../src/audio/effects.ts) and turns each step into a register write stamped with a sample time. `PokeyBoard` in [pokey.ts](../../src/audio/pokey.ts) posts those writes to an `AudioWorklet` whose source is the string in [pokeyProcessor.ts](../../src/audio/pokeyProcessor.ts). Nothing is sampled. This page follows that path from event to waveform and then describes each layer.

## From event to register write

1. A stage module pushes an event onto `state.events`, for example `state.events.push({ type: 'sound', name: 'laser' })` in [lasers.ts](../../src/game/dogfight/lasers.ts). The `sound` member of the `GameEvent` union is declared in [types.ts](../../src/game/types.ts); it carries only a `name` string.
2. The frame loop in [main.ts](../../src/main.ts) steps the simulation, then calls `dispatch` for each event. `dispatch` forwards every event to the renderer and then switches on `type`: `sound` becomes `sound.play(event.name)`, `passby` becomes `sound.play('passby')` or `sound.play('passbyRecede')` depending on `event.receding`, `music` becomes `sound.playMusic(event.cue)` and `speech` becomes `sound.speak(event.line)`.
3. `SoundEngine.play` in [sound.ts](../../src/audio/sound.ts) expands a compound name through `COMPOUND`, finds each part in `EFFECTS`, and calls the private `start` with a start time of `context.currentTime + 0.02`.
4. `start` converts that time to a sample index with `PokeyBoard.sampleAt`, clears the channels the effect uses, maps every `EffectStep` to a `PokeyWrite` at `startSample + round(t * sampleRate / tickHz)`, appends a volume-zero write for each channel at `length` Beats, and posts the list with `PokeyBoard.write`.
5. The worklet keeps the writes in a queue sorted by sample time. In `process` it applies every write whose `at` is at or before `currentFrame + i` before producing sample `i`, so an effect lands on the exact sample the engine asked for.

The 20 ms offset in step 3 gives the message time to cross into the audio thread before its first sample is due. The original had between 0 and 8 ms of latency before the first write, so this is of the same order.

## SoundEngine

`SoundEngine` in [sound.ts](../../src/audio/sound.ts) owns the `AudioContext`, the POKEY board, the speech engine and the master gain. `main.ts` constructs one at start-up and exposes it as `window.__swSound` in dev builds.

### Lazy AudioContext and `unlock`

The constructor creates nothing. Browsers refuse to start audio without a user gesture, so `main.ts` registers `keydown` and `pointerdown` listeners that call `unlock`. The first call creates the `AudioContext`, the master `GainNode` (gain 0.7), the limiter, a `PokeyBoard` and a `SpeechEngine`. Later calls only resume a suspended context. Until `unlock` has run, `play`, `setLoop`, `playMusic` and `speak` return without doing anything because `board` and `context` are still `null`.

### The master limiter

A `DynamicsCompressorNode` sits between the master gain and `context.destination` with threshold -6 dB, knee 3, ratio 12, attack 2 ms and release 150 ms. The comment in the source gives the reason: the Death Star explosion runs on all eight effect channels while the end music plays on the other eight, and the sum would clip.

### Cold-start buffering

`PokeyBoard` and `SpeechEngine` both load their worklet module asynchronously. Each keeps a `pending` array and a private `post` method: while the `AudioWorkletNode` does not exist yet, messages go into `pending`; once `addModule` resolves, the node is created, connected, and every pending message is posted in order. The engine can therefore schedule writes immediately after `unlock` and none are lost. `whenReady` returns the promise for callers that want to wait, which the offline render helpers in `main.ts` do.

### `play`, `setLoop`, `stop` and priority

`play(name)` ignores names it does not know, so the game can raise events before their sounds exist. `start` checks the `busy` table, a four-by-four grid of `{ priority, until }` per chip and channel: a new effect is refused only when a channel is still busy with a strictly higher priority. Every entry in `EFFECTS` has `priority: 1`, so today a new effect always takes its channels, which is what the original did (it had no priorities and no queue). `busy[chip][ch].until` is set to `Infinity` for a looping effect and to the start time plus `length / tickHz` otherwise.

`setLoop(name, on)` records the state in the `looping` map, starts the effect on a rising edge and calls the private `stop` on a falling edge, which clears the channels and resets their `busy` slots. No entry in `EFFECTS` sets `loop: true` and nothing outside `sound.ts` calls `setLoop`; the thrust sound the Dogfight raises is an ordinary one-shot effect.

### Music and speech entry points

`playMusic(cue)` and `speak(line)` are described on the [Music](music.md) and [Speech](speech.md) pages. Relevant here: `playMusic` clears both music chips with `clearChip`, writes `MUSIC_AUDCTL` to register 8 of each, then schedules the compiled track at `sampleRate / STEP_HZ` samples per step; `musicPlaying` reports the cue until its computed end time.

### Flags

| Field | Default | Effect |
|---|---|---|
| `muted` | `false`; `main.ts` sets it from `?mute` | `play`, `playMusic` and `speak` return early. `setLoop` does not check it. |
| `useOriginalMusic` | `ORIGINAL_MUSIC !== null` | Choose the decoded original tune tables over `MUSIC_CUES` when [src/data/local/music.ts](../../src/data/local/) exists. `?music=ours` clears it. |
| `useOriginalSpeech` | `true` | Copied into `SpeechEngine.useOriginal` by `unlock`. With the original installed the speech gain is `SPEECH_GAIN_ORIGINAL` (0.85) instead of `SPEECH_GAIN` (1.3). `?speech=ours` clears it. |

`ORIGINAL_MUSIC` is loaded in `sound.ts` through `import.meta.glob('../data/local/music.ts', { eager: true })`, which resolves to nothing when the git-ignored file is absent.

## PokeyBoard

[pokey.ts](../../src/audio/pokey.ts) wraps the worklet as one node with two mono outputs.

| Export | Value | Meaning |
|---|---|---|
| `POKEY_CLOCK_HZ` | 1 500 000 | The chip clock MAME uses for this board. |
| `MUSIC_LOW_PASS_HZ` | 3500 | The board's low-pass filter on the music chips. |
| `MUSIC_GAIN` | 0.65 | Level of the music output against the effect output. |
| `PokeyWrite` | `{ at, chip, reg, value }` | One register write at a sample index. |

The constructor builds a Blob URL from `POKEY_PROCESSOR_SOURCE`, calls `audioWorklet.addModule`, then creates `new AudioWorkletNode(ctx, 'pokey', { numberOfOutputs: 2, outputChannelCount: [1, 1], processorOptions: { clockHz } })`. Output 0, the two effect chips, connects straight to the output node. Output 1, the two music chips, goes through a `BiquadFilterNode` (`lowpass`, `MUSIC_LOW_PASS_HZ`, Q of `Math.SQRT1_2`) and a `GainNode` at `MUSIC_GAIN`, then to the same output.

| Method | What it posts |
|---|---|
| `sampleAt(time)` | Not a message: `round(time * sampleRate)`, clamped at 0. This is the worklet's `currentFrame` clock. |
| `write(writes)` | `{ type: 'writes', writes }`. |
| `clear(chip, channel, atSample)` | `{ type: 'clear', chip, channel, at }` followed by a write of 0 to that channel's AUDC at the same sample. |
| `clearChip(chip, atSample)` | `{ type: 'clear', chip, at }` followed by writes of 0 to all four AUDC registers. |
| `reset()` | `{ type: 'reset' }`. |

`clear` matters for correctness: an effect that is cut off by a new one on the same channel would otherwise leave its later writes in the queue, and they would reappear under the new effect.

## The POKEY model

[pokeyProcessor.ts](../../src/audio/pokeyProcessor.ts) exports one string, `POKEY_PROCESSOR_SOURCE`, holding three classes in plain JavaScript. It is kept as a string so it can be loaded from a Blob URL without a build step of its own. The file has no tests of its own; `main.ts` exposes `window.__swPokeyTest` and `window.__swPokeyTest16` in dev builds, which render a pure tone offline and count zero crossings to check the divider formulas.

### `Poly`

A linear feedback shift register of `bits` length with the given `taps`. `step` shifts in the inverted XOR of the tapped bits and returns the new low bit. The chip has four: `poly4` (taps 3, 2), `poly5` (taps 4, 2), `poly9` (taps 8, 3) and `poly17` (taps 16, 11). All four step once per chip clock.

### `Pokey`

One chip. State: `audf[4]`, `audc[4]`, `audctl`, a down-counter per channel, an output bit per channel, two high-pass latches `hp[2]`, the four polynomial counters and their latest bits, and the two base-rate dividers `div64` (modulo 28) and `div15` (modulo 114).

Register map, as `write(reg, value)` decodes it:

| `reg` | Register | Notes |
|---|---|---|
| 0, 2, 4, 6 | AUDF1 to AUDF4 | Frequency divider for channel `reg >> 1`. |
| 1, 3, 5, 7 | AUDC1 to AUDC4 | Distortion and volume for channel `reg >> 1`. |
| 8 | AUDCTL | Clock selections, joins, high-pass and poly choice. |
| 9 and above | ignored | |

AUDCTL bits the model honours:

| Bit | Effect in `clockKind` and `period` |
|---|---|
| 0x80 | Use the 9-bit poly instead of the 17-bit one. |
| 0x40 | Channel 1 counts at the chip clock; period `AUDF + 4`. |
| 0x20 | Channel 3 counts at the chip clock; period `AUDF + 4`. |
| 0x10 | Join channels 1 and 2 into one 16-bit divider. Channel 1 counts, channel 2's output toggles. Period `(AUDF2 << 8 | AUDF1) + 7` at the chip clock, `+ 1` otherwise. |
| 0x08 | Join channels 3 and 4 likewise. |
| 0x04 | High-pass channel 1 by channel 3. |
| 0x02 | High-pass channel 2 by channel 4. |
| 0x01 | Base rate is the 15 kHz clock (clock / 114) instead of 64 kHz (clock / 28). |

`tick` runs once per chip clock: it steps the four polys, advances the two base dividers, then for each channel that is due (every tick when fast, else on the 64 kHz or 15 kHz tick) decrements the counter. On reaching zero it reloads from `period` and calls `underflow` on the channel itself, or on the partner channel when this is the low half of a joined pair. The high channel of a joined pair is skipped in the loop since its partner drives it.

`underflow(ch)` reads AUDC bits 7 to 5. When bit 7 is clear the 5-bit poly gates the event: nothing happens unless `p5` is set. Then bit 5 toggles the output (pure tone), bit 6 loads the 4-bit poly bit, and otherwise the output takes the 17-bit or 9-bit poly bit. When channel 3 underflows with AUDCTL 0x04 set, `hp[0]` latches channel 1's output; channel 4 with 0x02 latches channel 2's.

`mix` sums the four channels: volume is AUDC bits 3 to 0; a channel with volume 0 contributes nothing; bit 4 forces the output high (volume-only mode); high-passed channels output `out ^ hp`. Each channel adds `+vol` or `-vol` and the sum is divided by 60.

### `PokeyProcessor`

The worklet processor holds four `Pokey` instances and a write queue. `ticksPerSample` is `clockHz / sampleRate`; an accumulator runs the chips as many whole ticks as fit into each output sample (about 31 at 48 kHz). The message handler accepts:

| `type` | Action |
|---|---|
| `writes` | Append and re-sort the queue by `at`. |
| `reset` | Empty the queue and zero every chip's AUDF, AUDC and AUDCTL. |
| `clear` | Remove queued writes for `chip` whose `at >= m.at`; with `channel` given, only that channel's AUDF/AUDC pair and any AUDCTL write; without it, the whole chip. |

`process` computes `now = currentFrame + i` per sample, applies due writes, ticks the chips, and writes `(chip0.mix() + chip1.mix()) * 0.6` to output 0 and `(chip2.mix() + chip3.mix()) * 0.6` to output 1.

## The effect tables

[effects.ts](../../src/audio/effects.ts) is data only, traced from the sound board's effect tables as described in [Sound effects reference](../reference/sound-effects.md). Do not edit it by hand.

### Shape of an effect

```ts
export interface EffectStep { t: number; reg: number; value: number }
export interface Effect {
  chip: number;        // 0 or 1 for effects
  channels: number[];  // channels it occupies, 0-3
  tickHz: number;      // Beats per second of the sequencer
  steps: EffectStep[];
  length: number;      // Beats until silent
  loop?: boolean;
  priority: number;
}
```

`t` is a Beat number and `reg` uses the register map above. `BEAT_HZ` is 123.0012, one Beat every 8.13 ms; every effect uses it as `tickHz`. The original's two effect POKEYs had AUDCTL 0 and no effect writes register 8, so every effect channel is 8-bit on the 64 kHz base rate.

### The effects

| Name | Chip | Channels | Length (Beats) | Raised by the game |
|---|---|---|---|---|
| `laser` | 0 | 0, 1 | 52 | Dogfight laser fire; a letter shot in Initials Entry |
| `tieCannon` | 1 | 1, 2 | 408 | an enemy fires |
| `cannonStop` | 1 | 1, 2 | 0 | a Fireball is shot down |
| `shotDestroyed` | 1 | 3 | 14 | a Fireball is shot down; `RUB` in Initials Entry |
| `shieldHit` | 1 | 1, 3 | 56 | a Fireball impacts |
| `explosion` | 1 | 0 | 102 | enemies, Tower Tops, Trench targets destroyed |
| `groundShot` | 0 | 2 | 106 | Laser Bunkers and Trench Turrets fire |
| `thrust` | 0 | 2, 3 | 350 | the Approach, as the zoom toward the Death Star begins |
| `passby` | 0 | 2, 3 | 198 | an enemy passes the X-Wing |
| `passbyRecede` | 0 | 2, 3 | 128 | not raised: the only `passby` event has `receding: false` |
| `passbyStop` | 0 | 2, 3 | 0 | not raised |
| `pffft` | 0 | 3 | 16 | not raised |
| `crash0` | 0 | 2 | 90 | via `crash` |
| `crash1` | 1 | 1, 3 | 90 | via `crash` |
| `deathStar0` | 0 | 0, 1, 2, 3 | 288 | via `deathStar` |
| `deathStar1` | 1 | 0, 1, 2, 3 | 288 | via `deathStar` |
| `torpedo0` | 0 | 0, 1, 2 | 52 | via `torpedo` |
| `torpedo1` | 1 | 2 | 52 | via `torpedo` |
| `r2Yes` | 1 | 0 | 488 | the Dogfight ends |
| `r2Sad` | 1 | 0 | 399 | first shield hit with more than three left |
| `r2Down` | 1 | 0 | 448 | shields down to two |
| `r2C` | 1 | 0 | 160 | shields down to one |
| `r2Dead` | 1 | 0 | 219 | the last shield is lost |

The four R2 sounds and `tieCannon`, `explosion`, `shieldHit` and `shotDestroyed` share chip 1; `laser`, `groundShot`, `thrust` and the pass-by sounds share chip 0. Chip 0 here is the original's POKEY at 0x1800 and chip 1 its POKEY at 0x1808, so effect channels 1 to 4 of the reference document are chip 0 channels 0 to 3 and effect channels 5 to 8 are chip 1 channels 0 to 3.

A length of 0 (`cannonStop`, `passbyStop`) is the original's stop command: an effect with empty tables, whose only action is the volume-zero write `start` appends at Beat 0.

### COMPOUND effects

The original's `crash`, `deathStar` and `torpedo` spanned both effect chips. An `Effect` names one chip, so those are split and rejoined by `COMPOUND`:

| Name | Parts | Raised by the game |
|---|---|---|
| `crash` | `crash0`, `crash1` | striking a Laser Tower or Laser Bunker; striking a Catwalk; hitting the end wall after a missed Exhaust Port |
| `deathStar` | `deathStar0`, `deathStar1` | three times as the Death Star explosion's bursts begin |
| `torpedo` | `torpedo0`, `torpedo1` | the Torpedo enters the Exhaust Port; `END` in Initials Entry |

`play` starts each part at the same time. The game raises the compound names. Because `deathStar` occupies all eight effect channels, the three triggers each restart the whole effect, as on the cabinet.

## Timing in numbers

| Quantity | Value |
|---|---|
| one Beat | 1 / 123.0012 s = 8.13 ms |
| samples per Beat at 48 kHz | 390.2, rounded per step by `start` |
| chip ticks per output sample at 48 kHz | 1 500 000 / 48 000 = 31.25 |
| scheduling offset | 20 ms after `currentTime` |
| effect end | `length` Beats after the start, when `start` writes volume 0 to every channel used |

`start` rounds each step's sample index separately, so the Beat grid drifts by less than one sample over an effect. The worklet's tick accumulator carries the fractional 0.25 tick from sample to sample, so the chip clock is exact on average.

## Adding a sound event

1. Push `{ type: 'sound', name }` from the stage module at the point the original sent its command; the [Sound effects reference](../reference/sound-effects.md) lists the command each game routine sent.
2. The name must be a key of `EFFECTS` or `COMPOUND`, or `effects.test.ts` fails. Every effect the original had is already in the table, so this is normally a matter of picking the right name.
3. If a new effect spans both chips, add a part per chip and a `COMPOUND` entry, keeping each part's `channels` honest so the second test passes.
4. Check it offline with `window.__swRenderEffect(name)` before listening.

Nothing in the renderer or the simulation waits for a sound: `play` returns at once and the effect's end is only recorded in `busy`.

### effects.test.ts

[effects.test.ts](../../src/audio/effects.test.ts) has two tests. The first reads every non-test file under `src/game` as raw text through `import.meta.glob`, collects the names in `type: 'sound', name: '...'` literals, and asserts each is a key of `EFFECTS` or `COMPOUND`. Add a sound event with a name that has no table and this test fails. The second asserts that no step of an effect writes a channel outside its `channels` list (register 8 is exempt) and that `length` is not negative.

## Dev helpers

In dev builds `main.ts` defines `window.__swRenderEffect(name)`, which builds a `PokeyBoard` on an `OfflineAudioContext`, schedules the effect from Beat 0, renders it and reports the peak level and a dominant pitch estimate per 100 ms. `window.__swSound.play(name)` plays one live after a click.
