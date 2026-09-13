# Overview

This site explains how the Star Wars clone is built, for a programmer who wants to read, change or extend it. The game is a browser recreation of Atari's 1983 colour vector arcade game, written in TypeScript with [Three.js](https://threejs.org/) for drawing and the Web Audio API for sound. Its behaviour, timings, shapes and tables were checked against the original running in MAME and against Atari's published source listing, neither of which is part of the repository.

The pages under **Guide** describe the code as it is. The pages under **Reference** are the notes taken from the original while tracing its rules and shapes, and are the place to look when a number in the code needs justifying. **Decisions** holds the architecture decision records.

## The stack

| Concern | Choice | Where |
|---|---|---|
| Language | TypeScript, strict, ES2022 modules | [tsconfig.json](../../tsconfig.json) |
| Bundler and dev server | Vite | [vite.config.ts](../../vite.config.ts) |
| Tests | Vitest, Node environment, `src/**/*.test.ts` | [vite.config.ts](../../vite.config.ts) |
| 3-D drawing | Three.js, line geometry with a bloom pass | [src/render](../../src/render/renderer.ts) |
| Sound | Web Audio, two AudioWorklet chip models | [src/audio](../../src/audio/sound.ts) |
| Persistence | `localStorage` for the high score and the top three table rows | [src/main.ts](../../src/main.ts) |

There is one runtime dependency, Three.js. Everything else in the game is written in the repository.

## Repository layout

```
src/
  game/     the simulation: state, rules, projection, RNG, one module per stage
  input/    mouse, gamepad and keyboard folded into one yoke snapshot
  render/   the Three.js scene that draws a GameState
  ui/       the DOM screen frame that keeps the 4:3 aspect
  audio/    the POKEY and TMS5220 models, effects, music and speech engines
  data/     traced and generated tables: shapes, layouts, choreography, encoded speech
  main.ts   wires the pieces together and runs the frame loop
scripts/    offline tools: the speech encoder and the local-only extractors
docs/       this site, the reference notes and the ADRs
cfg/        MAME configuration used while measuring the original
```

The layering rule is strict: `src/game` imports nothing from `render`, `audio`, `input` or `ui`, and touches neither the DOM nor Three.js. The [Architecture](./architecture.md) page explains how the layers meet.

## Commands

```bash
npm install
npm run dev          # Vite dev server
npm test             # Vitest, once
npm run test:watch   # Vitest, watching
npm run build        # tsc --noEmit, then vite build into dist/
npm run preview      # serve dist/
npm run docs:dev     # this site, live
npm run docs:build   # this site, static, into docs/.vitepress/dist
```

Three further scripts regenerate data. `npm run speech` re-encodes the speech lines with macOS `say` and needs macOS. `npm run music` and `npm run speech:original` read local copies of the original's listing and ROM set, and write git-ignored files. See [Data tables and scripts](./data.md).

## URL flags and dev hooks

The game reads a few query parameters, all handled in [main.ts](../../src/main.ts) and [renderer.ts](../../src/render/renderer.ts).

| Flag | Effect |
|---|---|
| `?mute` | No audio at all. The `AudioContext` is never created. |
| `?nobloom` | Draw the raw lines without the glow pass. |
| `?bloom=s,r,t` | Bloom strength, radius and threshold. |
| `?music=ours` | Play this project's compositions even when the original's tables are installed locally. |
| `?speech=ours` | Play this project's voices even when the original's phrases are installed locally. |

In a dev build `main.ts` also hangs the live state, the sound engine and the renderer on `window` and adds helpers to jump into a stage or render a sound offline. They are listed on the [Testing and debugging](./testing.md) page.

## How the project got here

The work was done in numbered milestones, one commit each, and the commit log is the change history. The order was chosen so that each milestone was a playable vertical slice.

| Milestone | What landed |
|---|---|
| 1 | The skeleton: vector look, yoke input, the stage state machine |
| 2 | The Dogfight from the original's tables, the vector ROM shapes, arcade-derived tuning |
| 3 | The Death Star Surface |
| 4 | The Trench, the Exhaust Port and the Death Star's destruction |
| 5 | The Attract, game over and initials entry |
| 6 | The sound effects through a POKEY model |
| 7 | The music through the original's driver on the POKEY model |
| 8 | The speech, re-voiced through a TMS5220 model |
| 9 | Polish from play-testing, still under way: pace measured from a cabinet recording, the palette, fireball colours, the trench ray scale |

## Where to go next

- [Architecture](./architecture.md) for the layers, the frame loop and the event flow.
- [Timing](./timing.md) for why the simulation steps in fields and what a Game Frame is.
- [Coordinates](./coordinates.md) for the frame, the units and the projection everything else relies on.
- [Game state and modes](./state.md) for the shape of `GameState` and the mode machine.
- One page per stage: [Dogfight](./dogfight.md), [Surface](./surface.md), [Trench](./trench.md), [Attract](./attract.md).
- [Conventions](./conventions.md) before making a change.
