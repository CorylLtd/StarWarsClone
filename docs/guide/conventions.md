# Conventions

These are the rules the code follows. Most exist because the project's aim is fidelity to a specific machine, and the rules keep the recreation checkable against it.

## Vocabulary

[CONTEXT.md](../../CONTEXT.md) is the glossary. It gives the arcade's own name for each thing, from Atari's manuals and on-screen text, and lists the words to avoid. Code, comments, tests, commits and these pages use those names: a Fireball, not a bullet; a Deflector Shield, not a life; a Game Frame and a Field, not a tick; a Catwalk, not a barrier. When a new concept needs a name, add it to the glossary first.

Comments name the original's routines and variables where the code mirrors them, in the listing's spelling: `PH.TIM`, `WV.HRD`, `GM.BMP`, `.CUNTIL`, `PHIB0B`. Readers cross-check against the listing, and the names are the index.

## British spelling

Colour, centre, synthesised, initialise. Identifiers follow the API they touch (`colors.ts` because Three.js says `color`), prose and comments follow British usage.

## No magic numbers in the simulation

Every tuning number under `src/game` lives in [config.ts](../../src/game/config.ts) with a comment on its unit and source. See [Configuration](./config.md). Data tables that are too large for the config, such as choreography programs and the Surface maze, live under `src/data` and are imported by the stage that uses them.

## The simulation is pure

`src/game` imports only from itself and `src/data`. No DOM, no Three.js, no Web Audio, no `Math.random`, no `Date`. Anything the outside world needs to know is an event on `state.events`; anything the simulation needs from outside comes in through `Input`. This is what lets the tests run in Node and what keeps the renderer replaceable.

## One module per stage

The Dogfight, the Surface and the Trench each have a directory under `src/game` with an `index.ts` exporting `enter*` and `step*Frame`, a slice of `GameState` created by a function in `state.ts`, a `*.test.ts`, and a reference note under `docs/reference`. A stage never reaches into another stage's slice. Shared player behaviour that first appeared in the Dogfight, such as the Laser and `loseShield`, is imported from `src/game/dogfight` by the other stages.

## The original's frame, units and pace

Positions are in universe units with X forward, Y right and Z up. Durations are counted in Game Frames or Fields according to which of the original's loops counted them. Game logic runs at the cabinet's measured pace per screen. Converting to Three.js, seconds or pixels is done at the edge, in `src/render`, `src/audio` and `src/input`. The [Coordinates](./coordinates.md) and [Timing](./timing.md) pages explain the frames and clocks.

## Traced, not ported

No routine is translated line by line from the 6809 listing. Rules are written fresh in TypeScript from an understanding of the source, checked against MAME. Data such as shapes, choreography programs and effect tables was traced and is stored as tables under `src/data`. The ADR [What is copied from the original](../adr/0001-what-is-copied-from-the-original.md) records the boundary: the ROMs and the listing never enter the repository; the speech and music the repository ships are this project's own; the original's music and speech can be decoded from local copies into git-ignored files.

Paths to those local copies belong in the git-ignored `local.config.json`, with the keys `atariSource` and `romSet`. Decoded output belongs in the git-ignored `src/data/local/`. Nothing from either may be committed or pasted into a document.

## Tests step frames, not fields

Unit tests build a state with `createInitialState(seed)` or `dogfightState(seed, wave)` and advance it with `runFrame`, `runFrames` and `pressFire` from [testUtils.ts](../../src/game/testUtils.ts). They never assume how many Fields a Game Frame takes, because the answer depends on the screen. `runFields` is reserved for per-Field behaviour: the Cursor slew and the fire latch. See [Testing](./testing.md).

## Commits

One commit per milestone or, in the polish milestone, one per part, with a message that says what the change makes the game do: "a yellow cursor throughout initials entry", "trench pace from the cabinet recording". Work stops after each so it can be play-tested. Pushes to the public repository happen only on request.

## Reference notes

When a rule or number is traced from the original, the finding is written into the matching file under `docs/reference` with the listing's file and label, before or with the code. The notes are the justification for the constants and the place to look when behaviour is questioned. They contain no ROM bytes, no note data and no decoded speech.
