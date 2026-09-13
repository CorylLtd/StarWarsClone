# Testing and debugging

The simulation is tested with Vitest in Node, without a browser. The audio chip models are tested the same way, because their cores are plain JavaScript that can run outside an AudioWorklet. The renderer has no automated tests and is checked by eye against MAME and a cabinet recording. In the browser, a dev build exposes the live objects and a set of offline analysis helpers on `window`.

## Running the tests

```bash
npm test
```

```bash
npm run test:watch
```

Vitest is configured in [vite.config.ts](../../vite.config.ts): Node environment, every `src/**/*.test.ts`. `npm run build` runs `tsc --noEmit` first, so a type error fails the build even though Vite would bundle past it.

| Test file | Covers |
|---|---|
| `game/update.test.ts` | Modes, game start, the select screen, dying and game over, the Dogfight's flow, the Laser and shields, the Cursor, the fire latch. |
| `game/frame.test.ts` | The basis rotations and their sign conventions. |
| `game/projection.test.ts` | The cone test, projection and the octagon. |
| `game/math.test.ts`, `game/random.test.ts` | Helpers; the RNG is deterministic per seed. |
| `game/dogfight/aim.test.ts`, `combat.test.ts`, `scripts.test.ts` | Auto-aim, hits and shields, the choreography interpreter. |
| `game/surface/surface.test.ts` | The Surface's lap, buildings, collisions, guns and transition. |
| `game/trench/trench.test.ts` | The Trench's generator, guns, ray, port, Force and destruction. |
| `game/attract/attract.test.ts` | The Attract cycle, the banner, the high-score table and initials entry. |
| `audio/effects.test.ts` | The effect tables' shape. |
| `audio/music.test.ts` | The notation parser, the driver model, and the cue lengths against the original's within 10%. |
| `audio/speech.test.ts` | The TMS5220 core, the LPC encoder's round trip, and the sentence queue. |

## Writing a simulation test

[testUtils.ts](../../src/game/testUtils.ts) has the helpers every game test uses.

| Helper | What it does |
|---|---|
| `IDLE`, `FIRE` | Inputs at rest, and at rest with fire held. |
| `dogfightState(seed, wave)` | A state already in the Dogfight of `wave`, events cleared, fire released. |
| `runFields(state, n, input)` | Step `n` Fields and return every event raised. For the Cursor and the fire latch. |
| `runFrame(state, input)` | Step Fields until `state.frame` advances by one. |
| `runFrames(state, n, input)` | `n` Game Frames. |
| `pressFire(state)` | One frame with fire held, one released. |
| `runFramesInvulnerable(state, n, input)` | `n` Game Frames with the shields topped up each frame, for flow tests that must outlive the Fireballs. |

A typical test builds a state, sets up the situation by writing to it directly, steps whole frames and asserts on the state and the events.

```ts
it('music cues fire at the original frames', () => {
  const state = dogfightState(1, 1);
  const events = runFrames(state, DOGFIGHT.musicCueFrames.descent + 1)
    .filter((e) => e.type === 'music');
  expect(events.map((e) => (e as { cue: string }).cue)).toEqual(['theme', 'themeB', 'descent']);
});
```

Rules to keep tests honest:

- **Step frames, not a fixed number of fields.** How many Fields a Game Frame takes depends on the screen's pace. `runFrame` loops until the frame counter moves.
- **Read constants from `config.ts`** rather than repeating the number, so a traced correction moves the test with it.
- **Set the situation up directly.** Tests write `state.dogfight.phase = 'turn'` or `state.shields = 0` rather than playing there, and clear `state.events` afterwards if the set-up raised any.
- **Seeds are part of the test.** A test that depends on a random outcome should say which seed and why.
- **The view fills `drawn` and `seen`.** Hit tests and the Dogfight's pace read what the last view computed, so a test that places an alien and fires without stepping a frame will not hit it.

## Dev hooks in the browser

In a dev build (`npm run dev`) [main.ts](../../src/main.ts) attaches these to `window`.

| Name | Use |
|---|---|
| `__sw` | The live `GameState`. Read or write anything. |
| `__swSound` | The `SoundEngine`. `__swSound.playMusic('theme')` or `.speak('RED FIVE STANDING BY')` after a click. |
| `__swWorld` | The `WorldRenderer`. |
| `__swEnterStage(stage, wave?)` | Set the wave and call `enterStage` on the live state: `__swEnterStage('trench', 2)`. |
| `__swStep(fields)` | Step the live state with idle input. Does not dispatch events, so no sound plays; only the frame loop dispatches. |
| `__swRenderEffect(name)` | Render an effect offline through the POKEY model and report its length, peak and the dominant pitch per 100 ms. |
| `__swRenderMusic(cue, ours?)` | Render a cue offline and report its length, write count, peak and RMS per second. |
| `__swRenderSpeech(line)` | Render a Speech Line offline and report its start, length, peak and RMS per quarter second. |
| `__swPokeyTest()` | A pure tone on the 64 kHz clock; should measure about 780 Hz. |
| `__swPokeyTest16(divider)` | A pure tone on a joined 16-bit pair; should measure `clock / (2 * (divider + 7))`. |
| `__swPokeyBoard` | The `PokeyBoard` class, for building one against an `OfflineAudioContext`. |

The URL flags `?mute`, `?nobloom`, `?bloom=s,r,t`, `?music=ours` and `?speech=ours` are listed on the [Overview](./index.md#url-flags-and-dev-hooks).

The dev server for the browser pane is defined in `.claude/launch.json` on port 5174. The pane throttles `requestAnimationFrame` when hidden, so a game that looks slow there is being throttled, not misbehaving.

## Checking against the original

Neither the ROM set nor the source listing is in the repository, and both live outside it on the developer's machine, with the paths in `local.config.json`. Behaviour and timing were measured by running the original in MAME headless and reading its memory from a Lua autoboot script. The recipe, kept here because it is not obvious:

- Run with `-video none -sound none -nothrottle -str N -autoboot_script script.lua`; snapshots land under MAME's snapshot directory.
- Coining up through the input ports does not work headless. Instead poke the phase variable to the begin-game phase about six seconds after boot, then half a second later poke the player's gas variable, or the player dies at once.
- The frame counter, wave number and score are readable at fixed addresses, so a script can log difficulty over time and take a snapshot when a Fireball's type byte says it is at the windshield.
- The listing's files are CRLF and some tools treat them as binary; `grep -a` reads them.

Pace figures were then refined from a cabinet recording, extracting frames with `ffmpeg -ss T -i video -frames:v 1` and comparing contact sheets. Where the recording and MAME differed, the recording won, except for the high-score page which the recording did not show from its start.

The `cfg/` directory holds MAME configuration files from those sessions. The reference snapshots and the decoder scripts for the shapes are outside the repository.
