# Star Wars (Atari 1983) — the music player and its cue points

How the sound board's music driver worked and when the game called it, from
the original's sound-board source (SNDPM.MAC, the driver; SNDAUX.MAC, the
scheduler) and the main game (WSMAIN.MAC, WSGUNS.MAC). This records the
player's mechanics and the shape of each cue — length, tempo, voice roles,
envelopes — and deliberately not the notes: per ADR 0001 the cues in this
project are original compositions that keep only these outward shapes.
Numbers are decimal unless `0x`.

## 1. Hardware and voices

* The music used the third and fourth POKEYs (0x1810 and 0x1818, "behind a
  3.5 kHz low-pass filter"). Both got **AUDCTL 0x78** at init: channels 1+2
  and 3+4 joined into 16-bit dividers clocked at the chip clock, giving
  **four 16-bit voices**: voice 1 = 0x1818 ch 1+2, voice 2 = 0x1818 ch 3+4,
  voice 3 = 0x1810 ch 1+2, voice 4 = 0x1810 ch 3+4. The low channel holds the
  low byte of the divider, the high channel the high byte and the AUDC
  (volume and distortion). Pitch is `f = clock / (2 (N + 7))`.
* The driver's note table (`NOTTAB`) is a 97-entry semitone table for a
  1.512 MHz clock, entry 1 = C0 (16.35 Hz) up to C8; entry 0 is a rest. A4 =
  440 Hz is entry 58.
* Voices 5-8 (priority-sharing voice 4's hardware) and split 8-bit voices
  exist in the driver but no cue uses them; the "dynamic reconfiguration" to
  8-bit voices is never invoked.

## 2. Timing

* The scheduler runs every 4 ms (6532 timer, 6144 E-cycles at 1.512 MHz);
  `PKDR` updates voices 1 and 3 on odd ticks and voices 2 and 4 on even
  ticks, so **each voice steps every 8.13 ms** (the same beat as the effect
  sequencer), with voices 2/4 half a step behind 1/3.
* Each voice keeps a 16-bit duration counter `ODUR` and an 8-bit `rate`. Every
  step `ODUR -= rate`; when it goes negative the next instruction is read. A
  note adds `(duration byte >> 1) × 128` to `ODUR`, so overrun carries into
  the next note and a note of `u` units lasts `u × 128 / rate` steps. The
  tunes count a quarter note as 32 units (eighth 16, sixteenth 8, half 64,
  dotted half 96; triplet eighths as 10/11/11), so **a quarter note lasts
  4096 / rate steps**: rate 64 is 115 bpm, rate 90 is 162 bpm, rate 128 is
  230 bpm (those tunes move in half notes).
* Bit 0 of the duration byte is the **tie** flag: a tied note does not reset
  the envelope counter, and with synth mode on it glides from the previous
  pitch.

## 3. Instruction set (two bytes each)

| Op byte | Data byte | Meaning |
|---|---|---|
| 0 | duration | rest |
| 1-97 | duration | note (plus the key offset) |
| any | 0 | end of tune (or return from a sub-phrase) |
| 0x80 / 0x81 | n | rate = n / rate += n |
| 0x82 / 0x83 | n | median volume = n / += n (0-15) |
| 0x84 / 0x85 | n | key offset = n / += n (semitones, signed) |
| 0x86 | i | frequency envelope i |
| 0x87 | i | amplitude envelope i |
| 0x8A | bits | voice control (AUDC distortion bits; every cue uses 0xA0, pure tone) |
| 0x8B | bits | write AUDCTL of the first music POKEY |
| 0x8C | flag | synth (glide) mode on/off |
| 0x8D | i | call sub-phrase i from the tune directory |
| 0x8E / 0x8F | n | loop start (n times) / loop end |
| 0x90 addr | | gosub (three bytes) |
| 0x91 | | return |

## 4. Envelopes and output

* `VSEQ` counts steps since the last untied note (saturating at 255).
* **Amplitude**: `volume = clamp(median + amp[min(VSEQ, 31)], 0, 15)` from a
  32-byte table: `NULENV` (flat), `SDRUM` "steel drum" (+10 decaying to 0 in
  16 steps, then −1/−2: a pluck), `EHARD` "hard emphasis" (+3, +7, decaying
  to 0 over 28 steps), `QKRIZE` "quick rising" (+7 decaying to 0 in 14
  steps) and `TIES` (+10 decaying to +2, held). A rest keeps the distortion
  bits and writes volume 0. Untied notes have no gap: "let the amplitude
  envelope do the pre-gap".
* **Frequency**: `divider += freq[VSEQ >> 1] × 8` from a 128-byte table:
  `NULENV` (0) or `GLOCK` (−1 throughout, a slight sharpening).
* **Synth mode**: on a tied note the driver saves the difference between
  the old and new dividers and adds it to the output, halving it every four
  steps (arithmetic shift), so the pitch glides to the new note over about a
  quarter of a second.
* Starting a tune (`.TUNE`) re-initialises the voice (rate 64, volume 7,
  key 0, control 0xA0, null envelopes, output silenced) before pointing it at
  the new data; a cue starts all four voices this way, so **a new cue cuts
  off the old one** and nothing else ever stops music (only a sound-board
  reset at power-up or on watchdog failure). `VIU` (voices in use) also turns
  the board's FM/ambience modulation off while any music plays.

## 5. Cue points

Commands 27-37 (`PMBEN` … `PMTHB`, see sound-effects.md). Where the game
sends them:

| Cue (ours) | Original | Sent when |
|---|---|---|
| theme | `PMTH5` | Dogfight game frame 40 (`2 × 20`), waves 1-3 and even waves |
| vader | `PMDAR` | Dogfight frame 40 on odd waves from 3 |
| themeB | `PMTHB` | Dogfight frame 200 |
| descent | `PMDES` | Dogfight frame 400; the Dogfight ends at 420 |
| fourths | `PM4TH` | Surface start |
| rebel | `PMREB` | Surface pseudo-second 14 (frame 224) |
| rebelRepeats | `PMRRP` | Trench pseudo-second 2 |
| torpedo | `PMSF2` | the Torpedo enters the Exhaust Port (with effect `AUDPH` on the effect chips) |
| end | `PMEND` | the Death Star explosion begins |
| ben | `PMBEN` | game over with no qualifying score |
| cantina | `PMCNT` | the High Score Table is drawn for Initials Entry |
| (random) | table of 9 | a Banner start, once 400 s have passed since the last, unless the operator option silences it |

## 6. Cue shapes

Lengths from simulating the driver over the tune data (voice steps ×
8.13 ms). "Roles" is what each voice does; ranges are the sounding pitches.

| Cue | Length | Rate | Voice 1 | Voice 2 | Voice 3 | Voice 4 | Envelopes, other |
|---|---|---|---|---|---|---|---|
| theme | 6.3 s (17 quarters) | 90 | lead D4-G5, no rests | harmony D3-D5 | inner D3-B4, 19 % rests | bass C2-D3 in quarters | steel + hard |
| themeB | 8.6 s (33 quarters) | 128 | lead F4-A#5, long notes | harmony F3-D5 | steady quarters G2-F3 | bass F2-A#3, tied long notes, vol 10 | quick-rise; ties on the bass |
| descent | 6.2 s (15 quarters) | 80 | high D5-G6 | F#4-G5 | D4-D#5, sustained | bass D2-C4 | hard, quick-rise; volumes 5/3/7/9 |
| vader | 7.4 s (16 quarters) | 72 | D#4-D#5 | A#3-D#4 | F#3-A#4 | bass D#2-A#2, glock | all voices the same dotted rhythm (8+24, 32, 48, 64 units); no rests |
| fourths | 10.9 s (31.5 quarters) | 96 | G4-C6, triplets, 29 % rests | E4-C6, triplets | pulses A2-G#5, 68 notes | bass C#2-A#5 | steel + quick-rise; key shifts −12 / −24 / 0 between repeats |
| rebel | 15.9 s | 135 then 90 | D5-G#5 | B4-F5 | arpeggios G3-D5 (76 notes of 8 units) | bass G2-C3 | quick-rise; volumes 6→2 fading during the slow ending |
| rebelRepeats | 11.7 s | 152 | D5-A5 | A#4-F#5 | F4-D5 | pedal C3 in 26 half notes | voices 1-3 share one rhythm (63 notes, many triplets); hard on the bass |
| end | 13.8 s (53 quarters) | 128 | C#5-F#7 (second pass an octave up) | C#2-F#6 | C3-F#6, 35 % rests | bass A2-E3, long tied notes | hard + quick-rise; volumes 10→4 in the coda; glock on 2/3 |
| ben | 12.7 s (32 quarters) | 84 | lead D4-G5, continuous | F#5-A#5, 50 % rests | A4-G5, 50 % rests | bass C2-G2, 50 % rests | hard on the lead, quick-rise on the rest |
| cantina | 27.6 s (≈124 quarters) | 150 | D4-D#5, 152 notes | A3-A#4 in parallel | F3-G4 | walking bass D2-G3 in 32-unit steps | steel + ties; synth glides on and off; loops |
| torpedo | 0.44 s | 207→255 (sub-phrases at 65→112) | four voices of 48 two-unit notes, keys stepping down a semitone each note, synth on, vol 15 | | | | a special effect, not a tune |
| test tones | | 60 | C4 scale steps with key changes | | | | diagnostics only |

## 7. What this project does with it

`src/audio/music.ts` reproduces §2-4 (the step loop, duration carry, the
four amplitude and two frequency envelopes, ties, synth glide, key offsets,
voice control) from a note notation, and writes the resulting registers to
chips 2 and 3 of the POKEY model with AUDCTL 0x78; `src/audio/pokey.ts`
puts those two chips through a 3.5 kHz low-pass. `src/audio/musicCues.ts`
holds original cues matching §6's lengths, tempi and roles, and a test keeps
each within 10 % of the original's length so the cue points still line up.
