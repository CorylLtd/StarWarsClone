# Game state and modes

Everything the simulation knows is in one `GameState` object, defined in [types.ts](../../src/game/types.ts) and built by [state.ts](../../src/game/state.ts). It is a plain mutable object with no methods. The top-level `mode` says what the cabinet is doing; within play, `stage` says which stage is running, and each stage has its own slice of the state. The transitions all live in [update.ts](../../src/game/update.ts).

## The shape of `GameState`

| Field group | Fields | Notes |
|---|---|---|
| Mode and clocks | `mode`, `time`, `field`, `frame`, `frameDebt`, `modeFrames` | See [Timing](./timing.md). `modeFrames` resets on every mode change. |
| Wave and difficulty | `wave`, `difficulty`, `difficultyBump`, `firstWave` | `wave` is 0-based: 0 is displayed wave 1, as the original's `GM.WAV`. |
| Stage | `stage`, `stageFrames` | Reset by `enterStage`. |
| Score and shields | `score`, `highScore`, `shields`, `lastScore`, `lastScoreFade`, `firstShieldHitDone` | `shields` is -1 once the fatal hit has landed. |
| Select screen | `selectFrames` | Countdown in Game Frames. |
| Player | `player: Player` | Orientation, auto-aim residues, Cursor, Laser, forced roll, gauge. |
| Stage slices | `dogfight`, `surface`, `trench` | One object each, recreated on entry. |
| Attract and initials | `attract`, `initials`, `highScores` | The ten-row table lives here. |
| Input bookkeeping | `credits`, `fireHeld`, `fireLatch` | Free play holds `credits` at one. |
| Randomness | `rng: Rng` | Seeded mulberry32 in [random.ts](../../src/game/random.ts). |
| Events | `events: GameEvent[]` | Cleared at the start of every step. |

`createInitialState(seed, highScore, highScores)` returns the Attract on the high-score page with the operator options from `OPTIONS` applied: `difficulty` starts at `playDifficulty` and `shields` at `startingShields`. `createPlayer`, `createDogfight`, `createSurface` and `createTrench` are the per-slice constructors; `startGame` and each `enter*` call them so no stale fields survive a new game.

All randomness comes from `state.rng` through `nextFloat`, `range` and `pick`. There is no `Math.random` in `src/game`, which is what makes a test with a fixed seed deterministic.

## Modes

```
                 fire press                 shoot a miniature or time out
  ┌─────────┐ ─────────────► ┌────────┐ ──────────────────────────────► ┌─────────┐
  │ attract │                │ select │                                 │ playing │
  └─────────┘ ◄──┐           └────────┘                                 └────┬────┘
      ▲          │                                                           │ shields < 0
      │          │ no qualifying score          40 frames                    ▼
      │          └──────────────────────────── ┌───────┐ ◄───────────── ┌─────────┐
      │                                        │ dying │ ── endGame ──► │  (end)  │
      │  END or 640-frame timeout              └───────┘                └─────────┘
  ┌──────────┐ ◄─────────────────────────────── qualifying score
  │ initials │
  └──────────┘
```

| Mode | Stepped by | Leaves when |
|---|---|---|
| `attract` | `stepAttractFrame` | A fire press that was not already held: `startGame`. |
| `select` | `stepSelect` | The Cursor is over a Death Star miniature on a press, or `selectFrames` runs out: `beginWave`. |
| `playing` | `stepPlaying`, which dispatches on `stage` | The stage reports done, or `shields < 0`. |
| `dying` | `stepDyingFrame` in the Dogfight only; the Surface and Trench hold their last picture | `modeFrames >= TIMING.deathFrames` (40): `endGame`. |
| `initials` | `stepInitialsFrame` | The player signs off with END or the 640-frame timeout: back to the Attract's high-score page. |

`setMode` is the only way the mode changes and it zeroes `modeFrames`. `fireHeld` is set true on every entry into a mode that a press could otherwise fall straight through, so the press that started the game does not also select a Death Star.

## Game start and the select screen

`startGame` zeroes the score and wave, restores the operator options, rebuilds the player and Dogfight slices, arms the countdown with `SELECT.countdownFrames` (256) and pushes `gameStarted` and the speech line "RED FIVE STANDING BY". `selectTarget` tests the Cursor against `SELECT.positions`, three miniatures at screen positions that map to waves 0, 2 and 4, using a box and a diagonal limit. `beginWave` sets the wave, faces the player away from the Death Star with `reversedBasis`, pushes `waveSelected` and enters the Dogfight.

## Stages within a wave

`enterStage(state, stage)` resets `stageFrames`, calls the stage's `enter` function and pushes `stageStarted`. `stepPlaying` calls the stage's step function and reads its boolean result.

| Stage | Entered from | Done means |
|---|---|---|
| `dogfight` | `beginWave`, `completeWave` | The Approach zoom has finished. Wave 0 goes to the Trench; every other wave goes to the Surface. |
| `surface` | Dogfight done | The descent into the Trench has finished. |
| `trench` | Surface done, or Dogfight done on wave 0 | The Death Star's destruction and next-wave accounting have finished: `completeWave`. |

`enterTrench` is told whether the Trench was entered from the Surface, which decides the entry altitude. The wave-1 path from space starts higher.

`completeWave` pushes `waveCompleted`, advances `wave` (capped at 98), raises `difficultyBump` by one for each of the first five waves (capped at 4), adds the bump to `difficulty` (capped at 15), clears `firstWave` and re-enters the Dogfight. The points for the Exhaust Port, the end-of-wave shield bonus, the bonus Deflector Shield and the wave-select bonus are all awarded inside the Trench's `next` phase before `completeWave` is reached, so `completeWave` itself scores nothing.

## Difficulty and Hardness

Two numbers feed the enemies' fire rate. `state.difficulty` starts at the operator's Play Difficulty and grows by `difficultyBump` at each Death Star. **Hardness** is `hardness(wave, difficulty)` in [waves.ts](../../src/game/dogfight/waves.ts): the wave (capped at 31) plus the difficulty, capped at 15. The original called it `WV.HRD`. It indexes the fire tables: `FIRE_TABLE` in the Dogfight, `gunSlotsByHardness` on the Surface and `gunWindow` in the Trench. A missed Exhaust Port repeats the Trench with `trench.repeat` incremented, and `trenchHardness` adds one bump per repeat to that trench only, matching the original's `PHIB0B`, which bumped `WV.HRD` without touching `GM.DIF`.

## Deflector Shields

`loseShield` in [guns.ts](../../src/game/dogfight/guns.ts) is the one place a shield is lost, whatever the stage. A loss at zero sets `shields` to -1, which `stepPlaying` turns into the `dying` mode on the same frame. Otherwise it decrements, arms `player.gaugeFrames` with `10 + old` frames during which a second loss is refused, pushes `shieldLost`, and raises R2's sounds and speech lines at two, one and zero shields. The bonus shield after a Death Star never raises the count above `OPTIONS.startingShields`.

## Game over

`endGame` records a new high score, remembers the wave for the Attract, pushes `gameOver` and the two closing speech lines, then asks `qualifyingRow` whether the score takes a row. A qualifying score inserts a blank row, pushes `highScore` and the cantina cue, and switches to `initials`. Otherwise Ben's cue plays and the Attract starts at the banner. The [Attract](./attract.md) page covers the initials entry.

## Events

The full `GameEvent` union, and who raises each.

| Event | Payload | Raised by |
|---|---|---|
| `gameStarted` | | `startGame` |
| `waveSelected` | `wave` | `beginWave` |
| `stageStarted` | `stage`, `wave` | `enterStage` |
| `waveCompleted` | `wave` | `completeWave` |
| `laserFired` | | the Laser step in the Dogfight, Surface and Trench |
| `laserHitAlien` | `kind`, `destroyed` | Dogfight combat |
| `laserHitFireball` | | Dogfight combat |
| `towerTopHit` | `points` | Surface |
| `bunkerHit` | | Surface |
| `laserSplash` | | Surface |
| `allTowersCleared` | | Surface |
| `collision` | `with` | Surface |
| `catwalkHit` | | Trench |
| `turretHit` | | Trench |
| `panelHit` | | Trench |
| `torpedoFired` | | Trench |
| `forceBonus` | `points` | Trench |
| `portMissed` | | Trench |
| `deathStarDestroyed` | | Trench |
| `alienFired` | | Dogfight aliens |
| `shieldHit` | | the Fireball impact |
| `shieldLost` | `remaining` | `loseShield` |
| `passby` | `receding` | Dogfight aliens |
| `speech` | `line` | many places; the line names index `SPEECH_LINES` |
| `music` | `cue` | many places; the cue names index `MUSIC_CUES` |
| `sound` | `name` | many places; the names index `EFFECTS` and `COMPOUND` |
| `playerDied` | | `stepPlaying` |
| `gameOver` | | `endGame` |
| `highScore` | `row` | `beginInitials` |
| `initialsDone` | | the initials entry |

Only `sound`, `passby`, `music`, `speech`, `gameOver` and `initialsDone` have a consumer outside tests today; see [Architecture](./architecture.md#events).
