# Star Wars Clone

A browser recreation of Atari's 1983 colour vector arcade game *Star Wars*,
written in TypeScript with [Three.js](https://threejs.org/). You are Red Five:
fight off TIE Fighters and Darth's Ship, cross the Death Star's surface between
the laser towers, then fly the trench to the exhaust port.

This is an unofficial, non-commercial fan project with no affiliation to,
endorsement by, or connection with Lucasfilm Ltd., The Walt Disney Company, or
Atari. *Star Wars* and all related names are trademarks of Lucasfilm Ltd.
Nothing from the original game's ROMs or source code is distributed here. See
[docs/adr/0001-what-is-copied-from-the-original.md](docs/adr/0001-what-is-copied-from-the-original.md)
for exactly what the recreation does and does not take from the original.

## Status

Milestone 8 of 9: everything a player sees and hears is in: the sound
effects, the music and the speech. The attract cycles the high-score table, the banner
with its receding logo and storyline, the flight instructions and the scoring
page on the original's clock; a game runs the Dogfight, the Surface and the
Trench through the Death Star's destruction and on to the next wave by the
original's rules; a qualifying score signs the table with the yoke, and the
top three rows persist as the cabinet's NVRAM did. Every effect is the
original sound board's own register sequence played through a model of its
four POKEY chips, and the music cues play at the original's cue points
through the original's music driver logic, as compositions of our own; the
speech lines are spoken at the original's cue points, in system voices,
through a model of its speech chip.

## Running it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests for the simulation
npm run build      # type-check, then bundle into dist/
```

Controls: move the mouse to aim (the screen's edges are full yoke deflection),
click, Space or Enter to fire; as on the cabinet, the trigger also starts a
game. A gamepad's left stick and buttons work too, as do the arrow keys or
WASD.

Open the game with `?mute` on the URL to run without audio, `?nobloom` to see
the raw lines, or `?bloom=strength,radius,threshold` to tune the glow. In dev
builds the live game state is exposed as `window.__sw`, the sound engine as
`window.__swSound`, the renderer as `window.__swWorld`, and
`window.__swEnterStage(stage, wave)` jumps straight into a stage;
`window.__swSound.playMusic(cue)` plays a cue after a click, and
`window.__swRenderMusic(cue)` renders one offline and reports its level;
`window.__swSound.speak(line)` and `window.__swRenderSpeech(line)` do the
same for a speech line.

## Audio

Nothing is sampled. The cabinet's sound board drove four POKEY chips from a
second 6809, and `src/audio/pokeyProcessor.ts` models those chips in an
AudioWorklet: per-channel dividers on the chip's clock selections, the 4-,
5-, 9- and 17-bit polynomial counters, the 16-bit joins and high-pass
flip-flops, and 4-bit volumes. `src/audio/effects.ts` holds every effect as
the register writes the sound CPU's sequencer made, beat by beat, traced from
its tables; `src/audio/sound.ts` schedules them by sample time when the game
raises a sound event. The music takes the other two chips as four 16-bit
voices behind a 3.5 kHz low-pass, as on the board: `src/audio/music.ts`
mirrors the sound board's music driver (duration accounting, amplitude and
frequency envelopes, ties, glides, key offsets) over a small note notation,
and `src/audio/musicCues.ts` holds the cues. Those cues are original
compositions: the original's music tables encode the film score, so only the
cue points, lengths, tempi and voice roles are kept (see
`docs/reference/music-player.md`). The `AudioContext` is created lazily on the
first key or pointer event, because browsers refuse to start audio without a
gesture.

Speech is the arcade's words in a voice of our own. `scripts/encodeSpeech.ts`
has macOS `say` speak each line at 8 kHz and `scripts/lpc.ts` encodes it into
TMS5220 frames with the chip's own quantisation tables; the result is checked
in as `src/data/speech.ts` so nothing but macOS is needed to regenerate it
(`npm run speech`). `src/audio/tms5220Processor.ts` models the chip in an
AudioWorklet, and `src/audio/speech.ts` keeps the sound board's sentence
queue, pauses and the lines it dropped when busy. The speech ROMs, which hold
the film's actors, are never read (see `docs/reference/speech.md`).

## How the code is organised

```
src/
  game/     pure simulation: state, rules, projection, RNG, one module per stage (no DOM, no Three.js)
  input/    mouse, gamepad and keyboard -> one yoke snapshot
  render/   Three.js scene that draws a GameState
  ui/       DOM overlays: screen frame, HUD, attract and game-over cards
  audio/    Web Audio synthesis: the POKEY model, effects, music, the TMS5220 model and speech
  data/     generated tables: vector ROM shapes, stage layouts, encoded speech
  scripts/  offline tools: the speech encoder
  main.ts   wires everything together and runs the fixed-step frame loop
```

`src/game` knows nothing about rendering or sound. It works in the original's
own frame and units (X forward, Y right, Z up, the arcade's universe units and
vector-generator screen units), steps once per display field (about 42 Hz)
with game logic at the cabinet's own pace (`src/game/pace.ts`: at most every
second field, and slower on the screens its vector generator took longer to
draw, so the Trench and a close TIE Fighter run at the arcade's 10 to 14
frames a second rather than 21), draws all randomness
from a seeded generator, and reports one-off happenings by pushing `GameEvent`
values that `main.ts` forwards to the renderer and sound engine. The
simulation projects objects to screen units itself for the cursor hit tests;
the renderer's arcade camera reproduces the same projection, vertical squash
included, so what looks aimed is aimed.

Traced data lives in `src/data`: the object tables and 2-D pictures in
`vectorRom.ts` and `hud.ts`, the enemy choreography, level lists and wave
sets in `choreography.ts`. The notes those were derived from are in
`docs/reference`.

The vocabulary used throughout the code follows the arcade's own manuals; see
[CONTEXT.md](CONTEXT.md).

## Reference material

Behaviour, timings and shapes are checked against the original running in MAME
and against Atari's published source listing. Neither the ROM set nor that
source is part of this repository, and the path to a local MAME ROM directory
belongs in the git-ignored `local.config.json`.
