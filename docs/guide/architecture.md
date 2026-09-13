# Architecture

The game is a pure simulation with three consumers. The simulation in `src/game` owns a single `GameState`, advances it one vector-generator field at a time, and records what happened as a list of events. The renderer draws the state, the sound engine reacts to the events, and `main.ts` is the only place that knows about all of them. Input arrives as one snapshot per step. Nothing in the simulation touches the DOM, Three.js or Web Audio, so the whole of the game logic runs under Vitest in Node.

## The layers

```
             ┌───────────────┐
  pointer,   │  src/input    │  YokeInput.snapshot() -> Input {x, y, fire}
  keys, pad  └───────┬───────┘
                     ▼
             ┌───────────────┐
             │  src/game     │  step(state, input, DT) mutates GameState,
             │               │  fills state.events
             └───┬───────┬───┘
                 │       │ events
      GameState  ▼       ▼
     ┌────────────┐  ┌────────────┐  ┌──────────────┐
     │ src/render │  │ src/audio  │  │ localStorage │
     │ (Three.js) │  │ (Web Audio)│  │ (main.ts)    │
     └────────────┘  └────────────┘  └──────────────┘
```

| Layer | Depends on | Knows about |
|---|---|---|
| `src/game` | `src/data` only | The original's frame, units and rules. Nothing else. |
| `src/input` | `src/game/types`, `src/game/math` | The DOM events and the Gamepad API. |
| `src/render` | `src/game` (types, config, frame, projection, cursor), `src/data`, Three.js | How to draw a `GameState`. |
| `src/audio` | `src/data` | Web Audio, the chip models, the effect and cue tables. |
| `src/ui` | nothing | The screen element's size. |
| `src/main.ts` | everything above | Wiring, the frame loop, persistence, dev hooks. |

The renderer reads the state directly and is stateless about game logic: it can draw any `GameState` at any moment, which is what makes the dev hook that jumps into a stage work. The sound engine never reads the state; it only receives events. Persistence is two `localStorage` keys written from the event handler in `main.ts`.

The dependency direction is enforced by convention, not tooling. If a change makes `src/game` import from `src/render` or `src/audio`, it is in the wrong place.

## Start-up

[main.ts](../../src/main.ts) builds the pieces in this order.

1. `createInitialState(seed, highScore, table)` from [state.ts](../../src/game/state.ts). The seed is `Date.now()`; the high score and the top three table rows are loaded from `localStorage`, falling back to the defaults in `src/data/attract.ts`.
2. `new YokeInput(window, screen)` listens for pointer, keyboard and blur events on the window and measures the pointer against the `#screen` element.
3. `new WorldRenderer(screen)` creates the Three.js renderer, scene, camera and post-processing inside the screen element.
4. `new ScreenFrame(window, screen, () => world.resize())` sizes the element to the largest 4:3 rectangle that fits the window and tells the renderer when that changes.
5. `new SoundEngine()` creates nothing yet. The `AudioContext` is only made on the first key or pointer event, through `sound.unlock()`, because browsers refuse to start audio without a gesture.

Query parameters are read after that: `?mute` sets `sound.muted`, and `?music=ours` and `?speech=ours` switch off the original's tables when they are installed locally. The dev hooks are attached only when `import.meta.env.DEV` is true.

## The frame loop

The loop is a fixed-step accumulator driven by `requestAnimationFrame`.

```ts
const elapsed = Math.min((now - last) / 1000, 0.25);
accumulator += elapsed;
if (accumulator >= DT) {
  const snapshot = input.snapshot();
  while (accumulator >= DT) {
    step(state, snapshot, DT);
    for (const e of state.events) dispatch(e);
    accumulator -= DT;
  }
}
```

Four points matter.

- **`DT` is one vector-generator field**, about 23.8 ms. The simulation always steps by exactly this; the wall clock only decides how many steps run per animation frame. Game logic then runs on its own slower clock inside `step`, described on the [Timing](./timing.md) page.
- **Elapsed time is clamped to a quarter second.** A tab that was hidden does not replay minutes of simulation when it returns. The browser pane in the desktop app throttles `requestAnimationFrame` while hidden, so timing looks slow there; that is the throttle, not a bug.
- **The input snapshot is taken only when at least one field will run.** `YokeInput` latches presses that were shorter than a frame; if the snapshot were taken on every animation frame, a display frame that stepped nothing would consume the latch and the press would be lost.
- **Events are dispatched after every step**, not batched per animation frame, so their order matches the order the simulation raised them.

Drawing is separate from stepping. `world.render(state, frameDt)` runs at most `MAX_RENDER_FPS` (60) times a second, tracked by `lastRender`; the `frameDt` it receives is the wall-clock time since the previous draw, which the renderer uses only for effects that are not part of the simulation.

## Events

The simulation communicates one-off happenings by pushing `GameEvent` values onto `state.events`. The list is cleared at the start of every `step`, so an event lives for exactly one field. The full union is in [types.ts](../../src/game/types.ts) and tabulated on the [Game state](./state.md#events) page.

`dispatch` in `main.ts` is the only consumer.

| Event | Handling |
|---|---|
| `sound` | `sound.play(name)`: schedule the named effect from `src/audio/effects.ts`. |
| `passby` | `sound.play('passby')` or `'passbyRecede'` depending on `receding`. |
| `music` | `sound.playMusic(cue)`: replace whatever cue is playing. |
| `speech` | `sound.speak(line)`: queue a line from `src/audio/speechLines.ts`. |
| `gameOver` | Save `state.highScore` to `localStorage`. |
| `initialsDone` | Save the top three rows of `state.highScores` to `localStorage`. |
| everything else | Nothing. |

Every event is also passed to `world.handleEvent`, but that method is an empty stub today: the renderer draws from the state and does not react to events. Events such as `laserHitAlien`, `shieldLost` and `stageStarted` exist for tests and for readers of the event stream rather than for any current consumer. Raising sound from the simulation is done by pushing a `sound`, `music` or `speech` event with a name; the simulation never imports the audio layer.

## Input

`YokeInput.snapshot()` returns an `Input` of `{ x, y, fire }` with `x` and `y` in `[-1, 1]` and `fire` true if any button is down or was pressed since the last snapshot. The mouse is the primary source, the gamepad overrides it outside a dead zone, and the keyboard overrides both while held. The [Input](./input.md) page has the details. Inside the simulation, `stepCursor` in [cursor.ts](../../src/game/cursor.ts) turns the snapshot into the Cursor every field, and `state.fireLatch` remembers a press until the next Game Frame runs.

## Persistence

| Key | Value | Written on |
|---|---|---|
| `starwars.highScore` | The high score as a decimal string | `gameOver` |
| `starwars.highScores` | JSON array of the top `ATTRACT.persistedRows` (3) rows | `initialsDone` |

Only three rows are kept because the cabinet's NVRAM kept only three; the other seven rows of the table are reset to the defaults on every load. All reads and writes are wrapped in `try` so a browser with storage disabled still runs.

## Dev hooks

In a dev build `main.ts` attaches the live objects and a set of offline analysis helpers to `window`. They are listed on the [Testing and debugging](./testing.md#dev-hooks) page. The one to know about first is `__swEnterStage(stage, wave)`, which sets the wave and calls `enterStage` on the live state, and `__swStep(fields)`, which steps the live state without dispatching events.

## What is not here

- There is no scene graph of game objects beyond fixed meshes for the three alien slots and the explosion pieces. Everything else is line geometry rebuilt from the state on every draw.
- There is no entity system or message bus. Each stage module mutates its own slice of `GameState` and pushes events.
- `src/game/stages/` holds a `Stage` interface and a `STAGES` table from the milestone-1 skeleton. Nothing imports it: `update.ts` calls each stage's `enter` and `step` functions directly. It can be deleted or brought back into use, but it is not the entry point.
