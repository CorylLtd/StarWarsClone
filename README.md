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

Milestone 1 of 9: the skeleton. A letterboxed 4:3 vector display with bloom, a
yoke driven by mouse, gamepad or keyboard, a cursor, a mode/stage/wave state
machine and its tests. Placeholder shapes stand in for the traced arcade
geometry until the Dogfight milestone.

## Running it

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests for the simulation
npm run build      # type-check, then bundle into dist/
```

Controls: move the mouse to aim (the screen's edges are full yoke deflection),
click or press Space to fire, Enter to start. A gamepad's left stick, face
buttons and Start work too, as do the arrow keys or WASD.

Open the game with `?mute` on the URL to run without audio. In dev builds the
live game state is exposed as `window.__sw`, the sound engine as
`window.__swSound`, and `window.__swAdvance()` jumps to the next stage.

## How the code is organised

```
src/
  game/     pure simulation: state, rules, projection, RNG, one module per stage (no DOM, no Three.js)
  input/    mouse, gamepad and keyboard -> one yoke snapshot
  render/   Three.js scene that draws a GameState
  ui/       DOM overlays: screen frame, HUD, attract and game-over cards
  audio/    Web Audio synthesis (POKEY, TMS5220 speech, music to come)
  main.ts   wires everything together and runs the fixed-step frame loop
```

`src/game` knows nothing about rendering or sound. It operates on a plain
`GameState`, steps at a fixed 60 Hz, draws all randomness from a seeded
generator, and reports one-off happenings by pushing `GameEvent` values that
`main.ts` forwards to the renderer and sound engine. The renderer's camera and
the simulation's cursor hit-test projection read the same `CAMERA` record in
`src/game/config.ts`, so what looks aimed is aimed.

The vocabulary used throughout the code follows the arcade's own manuals; see
[CONTEXT.md](CONTEXT.md).

## Reference material

Behaviour, timings and shapes are checked against the original running in MAME
and against Atari's published source listing. Neither the ROM set nor that
source is part of this repository, and the path to a local MAME ROM directory
belongs in the git-ignored `local.config.json`.
