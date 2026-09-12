# Star Wars (Atari 1983) — the speech driver and its lines

How the sound board spoke, from SNDSPK.MAC (the driver, "Jed Margolin,
adapted by GregR, 6/14/82") and the command list in SNDPBX.MAC, and what this
project does instead of reading the speech ROMs (ADR 0001). Numbers decimal
unless `0x`.

## 1. Hardware

* A TMS5220 on the sound board's 6532 port B, driven in **Speak External**
  mode: the 6809 writes command 0x60 then streams the phrase's bytes into
  the chip's 16-byte FIFO, gated by its READY line, from a 4 ms interrupt
  that runs the speech driver **twice per tick (every 2 ms)**. PA5 switches
  the chip's supply so a wedged chip can be power-cycled; a watchdog does
  that if READY stays false for a second.
* The chip decodes LPC frames at 8 kHz, 40 frames a second: a 4-bit energy,
  a repeat bit, a 6-bit pitch (0 = unvoiced) and ten reflection coefficients
  (5, 5, 4, 4, 4, 4, 4, 3, 3, 3 bits; only the first four in an unvoiced
  frame), interpolated over eight 25-sample periods, exciting a ten-stage
  lattice filter with a 52-sample chirp per pitch period or a random bit
  stream. Energy 0 is silence, energy 15 a stop frame.

## 2. The driver

* **Words** are the speech ROM phrases, indexed 1-23 in a table of start and
  end addresses (`SPKVTB`). **Sentences** are byte lists of word indices
  ending in 0xFF, with **0xFE for a quarter-second pause**.
* **Queue**: 16 sentences deep (`SPKQUE`). `SPKNEW` always queues; `SPITE`
  ("if I can't be first, I won't be at all") queues only when the queue is
  empty *and* nothing is being spoken, otherwise the line is dropped.
* **Timing** (talk status 3 → 2 → 1 → 0): for each word the driver sends
  0x60 then every byte, one per 2 ms as READY allows; when the last byte has
  gone it waits **128 × 2 ms = 256 ms** (the chip is still emptying about
  three frames from its FIFO), then fetches the next word. A 0xFE costs the
  same 256 ms. After 0xFF it idles for **255 × 2 ms = 510 ms** before
  starting the next queued sentence. `SPKSKP` empties the queue; a
  sound-board reset (`SPKRES`) also clears it.
* While speaking or pausing (`SP.STA`/`SP.DLY` non-zero) the board's
  FM/ambience modulation of the effect chips is switched off.

## 3. Sentences and where the game sends them

| Command | Words | Queue rule | Sent when |
|---|---|---|---|
| `SPKRED` | RED FIVE, STANDING BY | queue | game start |
| `SPKR2T` | pause, R2 TRY AND INCREASE THE POWER | queue | shields down to 2 |
| `SPKTHI` | THIS IS RED FIVE, I'M GOING IN | queue | Dogfight ends |
| `SPKIMO` | breath, I'M ON THE LEADER, breath | queue | (not raised by this recreation) |
| `SPKUSE` | USE THE FORCE, LUKE | queue | Surface's last lap; Trench start |
| `SPKSTR` | breath, THE FORCE IS STRONG WITH THIS ONE, breath | queue | Trench pseudo-second 22, odd waves |
| `SPKYAU` | YAHOO, YOU'RE ALL CLEAR KID | drop if busy | Trench pseudo-second 24, even waves |
| `SPKREM` | REMEMBER | queue | game over |
| `SPKALW` / `SPKFOR` / `SPKFOA` | ALWAYS / THE FORCE WILL BE WITH YOU / both | queue | game over (`FOA`) |
| `SPKHAV` | breath, I HAVE YOU NOW, breath | queue | (not raised) |
| `SPKSTA` | breath, STAY IN ATTACK FORMATION, breath | queue | (not raised) |
| `SPKR2N` | R2 NO | queue | Exhaust Port missed |
| `SPKHIT` | pause, I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT | drop if busy | first shield hit with more than 3 left |
| `SPKLOS` | 7 pauses (1.75 s), I'VE LOST R2 | drop if busy | last shield lost |
| `SPKSHK` | I CAN'T SHAKE HIM | drop if busy | the shake counter runs out |
| `SPKTRU` | LUKE, TRUST ME | queue | Trench pseudo-second 16, even waves |
| `SPKLET` | LET GO, LUKE | queue | Trench pseudo-second 16, odd waves |
| `SPKSIZ` | LOOK AT THE SIZE OF THAT THING | drop if busy | (not raised) |
| `SPKELE` | "elephant pass-by sound" | drop if busy | (not raised) |
| `SPKGRE` | GREAT SHOT KID, THAT WAS ONE IN A MILLION | queue | Exhaust Port hit, odd waves from 3 |

Commented-out sentences in the source (switch your deflectors on, rebel base
one minute and closing, get set up for your attack run, my scope's negative)
were never sent.

## 4. What this project does

* The speech ROMs are film audio and are never read. `scripts/encodeSpeech.ts`
  speaks each word with a macOS `say` voice per speaker (Luke, Han, Ben,
  Vader) at 8 kHz and `scripts/lpc.ts` encodes it into the chip's frames:
  Levinson-Durbin reflection coefficients quantised to the chip's tables
  (with the chip's sign convention), pitch by centre-clipped autocorrelation
  with a per-speaker scale (Vader's is lowered), and energies calibrated to
  the chip's excitation levels. The breaths are synthesised frames. The
  output is `src/data/speech.ts`.
* `src/audio/tms5220Processor.ts` models the chip (§1) in an AudioWorklet
  from the tables in `src/audio/tms5220Tables.ts`; `src/audio/speech.ts`
  reproduces the queue and timings of §2; `src/audio/speechLines.ts` maps
  the lines the game raises to §3's words, pauses, breaths and queue rules.
