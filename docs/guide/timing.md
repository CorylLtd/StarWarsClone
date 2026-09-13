# Timing: fields, frames and pace

The simulation keeps two clocks, as the cabinet did. The **Field** is the vector display's refresh, about 42 a second, and is the simulation's step. The **Game Frame** is one pass of the original's main loop, at most every second Field and slower on screens the vector generator took longer to draw. Almost all game logic runs per Game Frame; only the Cursor slew and the fire latch run per Field. The constants live in [config.ts](../../src/game/config.ts) and the per-screen periods in `PACE`; the mechanism is in [update.ts](../../src/game/update.ts) and [pace.ts](../../src/game/pace.ts).

## The original's clocks

The main board's interrupt ran at 3 MHz divided by 12,000, so 252 Hz. The interrupt handler restarted the vector generator every 6 interrupts and released the mainline every 12. The mainline also waited for the vector generator to finish the previous picture, so on a busy screen a Game Frame took longer than 12 interrupts.

| Constant | Value | Meaning |
|---|---|---|
| `IRQ_HZ` | 252 | Interrupts per second, `3024000 / 1000 / 12`. |
| `VG_FIELD_IRQS` | 6 | Interrupts per Field. |
| `GAME_FRAME_IRQS` | 12 | Interrupts per Game Frame when the mainline keeps up. |
| `DT` | 0.0238 s | One Field: `VG_FIELD_IRQS / IRQ_HZ`. The simulation step. |
| `FIELDS_PER_FRAME` | 2 | Fields per Game Frame at full speed. |

## What runs per Field

`step(state, input, dt)` in `update.ts` is called once per Field by the frame loop.

1. `state.events` is cleared.
2. `state.time` and `state.field` advance.
3. `stepCursor` slews the Cursor toward the yoke. The original did this in the interrupt, so the Cursor moves smoothly even when the Game Frame is slow.
4. `state.fireLatch` is set if the input's `fire` is true. The latch survives until a Game Frame consumes it, so a press that lands between frames is not lost.
5. `state.frameDebt` grows by `DT / framePeriod(state)`. If it is still below one, the step ends here.
6. Otherwise one is taken off the debt and `stepFrame` runs with `fire` replaced by the latch, after which the latch is cleared.

Nothing reads `state.field` today. The renderer's flicker and colour cycles run from its own draw counter at the display rate, not from the simulation's Field count.

## What runs per Game Frame

`stepFrame` advances `state.frame` and `state.modeFrames`, fades the last-score display, and dispatches on `state.mode`: the Attract, initials entry, the select screen, play, or dying. In play it dispatches again on `state.stage` to the stage module's step function. Every counter that the original kept in its main loop, such as `PH.TIM` (the phase timer) and the per-stage `frame` fields, is a Game Frame count.

## Pace: the frame period by screen

`framePeriod(state)` in `pace.ts` returns the real length of the current Game Frame in seconds. The values in `PACE` were measured, first from MAME's frame counter against emulated time and then, for most screens, from a cabinet recording, which is the reference wherever the two differ.

| Screen | `PACE` key | Period | Rate |
|---|---|---|---|
| High-score table | `attract.highScores` | 0.0735 s | 13.6 Hz |
| Banner and storyline | `attract.banner` | 0.0586 s | 17 Hz |
| Flight instructions | `attract.instructions` | 0.062 s | 16 Hz |
| Scoring page | `attract.scoring` | 0.025 s | 40 Hz |
| Death Star Select | `select` | 0.0488 s | 20.5 Hz |
| Initials entry | `initials` | 0.0735 s | 13.6 Hz |
| Dogfight, nothing near | `dogfightFar` | 0.05 s | 20 Hz |
| Dogfight, a TIE Fighter close | `dogfightNear` | 0.1 s | 10 Hz |
| The turn toward the Death Star | `dogfightApproach` | 0.091 s | 11 Hz |
| The Approach zoom | `dogfightFar` | 0.05 s | 20 Hz |
| Surface | `surface` | 0.074 s | 13.5 Hz |
| Trench | `trench` | 0.076 s | 13 Hz |
| Death Star pull-away | `deathStarPullAway` | 0.071 s | 14 Hz |
| Death Star ring explosion | `deathStarExplosion` | 0.04 s | 25 Hz |
| Next-wave accounting | `nextWave` | 0.05 s | 20 Hz |
| Dying | `dying` | 0.069 s | 14.5 Hz |

The Dogfight is the one screen whose period varies within itself. A TIE Fighter close to the eye is drawn large, with long vectors, and the original slowed to 10 Hz. `framePeriod` reproduces that from the last view: for each alien that was drawn, `near = dogfightNearHalfDistance / halfDistance`, the squares are summed as a load, and the period is interpolated from `dogfightFar` to `dogfightNear` by `min(1, load)`. A single TIE Fighter at half-distance 2500 brings the Dogfight to its near period.

`frameDebt` accumulates `DT / period` per Field, so at a 0.05 s period a frame runs every 2.1 Fields and at 0.1 s every 4.2. The fractional part is carried, never dropped, so the long-run rate matches the measured one exactly.

## Why not a fixed 21 Hz

The first version stepped game logic every second Field. Difficulty then came out wrong: fireballs, choreography timers and gun windows are all counted in Game Frames, so a screen that ran at 21 Hz instead of the cabinet's 13 was half again as hard. Once the pace was right, the passive wave 1 lost four shields in about 345 frames, the same as MAME. Any change to a `PACE` value changes difficulty, not just feel.

## Consequences for code

- **Never assume two Fields per Game Frame.** Tests step with `runFrame` and `runFrames` from [testUtils.ts](../../src/game/testUtils.ts), which loop `step` until `state.frame` advances. `runFields` is for the Cursor and the fire latch.
- **Choose the counter by what the original counted.** Anything that ran in the original's main loop counts Game Frames (`state.frame`, `state.stageFrames`, `state.modeFrames`, the per-stage `frame`). Anything that ran in its interrupt counts Fields (`state.field`).
- **`state.time`** is real seconds, advanced by `dt` per Field, but no game logic reads it. The Attract's music interval is counted in Game Frames, converting `ATTRACT.musicIntervalSeconds` at the nominal 21 Hz, so it stretches with the pace as the original's counter did.
- **`framePeriod` reads the last view.** The Dogfight period depends on `alien.drawn`, which the stage's view step fills. A test that manipulates aliens without running the view sees the far period.
- **Speech and music timing** are in seconds inside the audio layer, scheduled on the `AudioContext` clock. They are triggered by events at Game Frame boundaries, so their cue points move with the pace as the original's did.
