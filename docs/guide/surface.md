# The Surface stage

The Surface is the second stage of a wave: Red Five flies over the Death Star among Laser Towers, Bishops and Laser Bunkers, shooting Tower Tops and dodging ground fire, until five Laps of the Maze have passed and the ship rolls down into the Trench. The simulation lives in `src/game/surface/`, one file per concern, with the Maze tables in `src/data/surface.ts` and every tuning number in `SURFACE` in `src/game/config.ts`. It is called once per Game Frame from `stepPlaying` in [update.ts](../../src/game/update.ts), knows nothing about rendering, and reports one-off happenings by pushing `GameEvent` values. The deeper rules, with citations into the original listing, are in [Surface rules](../reference/surface-rules.md); the shapes are in [Surface shapes](../reference/shapes-surface.md).

## Files

| File | Holds |
|---|---|
| [index.ts](../../src/game/surface/index.ts) | `enterSurface`, `stepSurfaceFrame`, the phase machine, motion and bank, the transition into the Trench |
| [buildings.ts](../../src/game/surface/buildings.ts) | Maze loading, the wrapping distance model, sight tests, the Laser against buildings, collisions |
| [groundGuns.ts](../../src/game/surface/groundGuns.ts) | When Laser Towers and Laser Bunkers fire, how their shots move, impacts and Laser hits on shots |
| [fragments.ts](../../src/game/surface/fragments.ts) | The three slabs thrown off a destroyed Hat or Laser Bunker |
| [dots.ts](../../src/game/surface/dots.ts) | The fifty green ground dots that stand in for the ground plane |
| [src/data/surface.ts](../../src/data/surface.ts) | Generated: building models, fragment models, the Maze tables, the wave-to-Maze table |
| [src/game/stages/surface.ts](../../src/game/stages/surface.ts) | An empty skeleton (`enterSurface` and `stepSurface` with no body). Nothing imports `src/game/stages/`; the live entry points are the ones in `src/game/surface/index.ts` |
| [surface.test.ts](../../src/game/surface/surface.test.ts) | Vitest coverage of the flow and the combat |

The state the module works on is `state.surface`, typed as `Surface` in [types.ts](../../src/game/types.ts), plus `state.player` (basis, Cursor, Laser) and `state.dogfight.fireballs`, which the Surface borrows as its six ground-shot slots. The renderer reads `buildings`, `fragments`, `munge`, `dots` and `pos` in `src/render/surfaceView.ts`, and `towersLeft`, `nextTowerPoints` and `allTowersCleared` for the HUD text in `src/render/renderer.ts`.

## Entering the Surface: `enterSurface`

`enterStage(state, 'surface')` in [update.ts](../../src/game/update.ts) calls `enterSurface(state)`. It is reached when `stepDogfightFrame` reports done and `state.wave !== 0`; displayed wave 1 skips the Surface and enters the Trench directly.

`enterSurface` resets the whole `Surface` record: `frame` 0, `phase` `'flying'`, position `(SURFACE.startX, 0, SURFACE.startAltitude)` = (128, 0, 8192), `speed` `SURFACE.speedStart` (256), zero velocity, `laps` 0, bank and both roll accumulators 0, no fragments, `gunsKilled` false. It sets the player's basis to the identity (facing +X, level) and clears `rollFrames`, empties the six fireball slots, then calls `loadMaze` and `initDots`, and pushes `{ type: 'music', cue: 'fourths' }`. This mirrors the original's `PHIGD`: `TX = 128`, `TZ = 8192`, `VX = 256`, music `PM4TH`.

Note the altitude starts above the clamp: `maxAltitude` is 7168, so the first move pins `pos.z` to 7168. The test "clamps altitude on the first move" checks exactly that.

## One Game Frame: `stepSurfaceFrame`

`stepSurfaceFrame(state, input)` returns `true` when the Trench should begin. It dispatches on `state.surface.phase`: `'flying'` goes to `stepFlying`, `'dropping'` and `'descending'` go to `stepTransition`. The caller in `update.ts` checks `state.shields < 0` after every frame and switches to the dying mode, so the stage functions only need to stop work once a fatal hit has landed.

The order of work in `stepFlying` follows the original's `PHEGD` (view, guns, move):

| Step | Call | What it does |
|---|---|---|
| 1 | `stepLaserTrigger` | Fires on a fresh press, ticks the bolt and the hit freeze (shared with the Dogfight, [lasers.ts](../../src/game/dogfight/lasers.ts)) |
| 2 | `viewBuildings` | Marks which buildings are in sight this frame (`b.seen`), ticks collision flashes, kills out-of-sight buildings on the last Lap |
| 3 | `viewGroundShots` | Projects the ground shots, resolves the Laser against them, and applies impacts |
| 4 | `resolveGroundLaser` | The Laser against Hats, tower bodies and Laser Bunkers, unless a shot was already hit |
| 5 | return if `shields < 0` | Nothing more happens on the frame of the fatal hit |
| 6 | `checkCollisions` | Crashes into Laser Towers and Laser Bunkers |
| 7 | `stepGroundShots`, `stepFireballs` | Move the shots; tick their timers and drop expired ones |
| 8 | `stepGroundFragments` | Move the slabs |
| 9 | gauge and flash counters | `gaugeFrames` and `flashFrames` count down |
| 10 | `stepGroundGuns` | Decide which buildings fire this frame |
| 11 | bank | Slew `bankTics` toward the yoke and the collision kick, rebuild the basis |
| 12 | move | Forward, sideways, vertically; the 16-bit wrap and the Lap counter |
| 13 | `stepDots` | Respawn dots that left the view |
| 14 | clocks | `frame += 1`; the Rebel theme at `rebelThemeFrame`; the end-of-stage test |

The Laser is resolved before movement and before the guns fire, so a shot launched this frame cannot be hit until the next. The renderer draws the state as it stands after the frame.

## The phase machine

| Phase | Entered when | Per frame | Leaves when |
|---|---|---|---|
| `'flying'` | `enterSurface` | `stepFlying` above | `laps >= killAtLap` (5) and `pos.x >= 0` |
| `'dropping'` | End of flying; `frame` reset, `laps` pinned to 5, fireballs cleared, speech `USE THE FORCE, LUKE` pushed | Roll, ease speed to 768, drop altitude at 384 a frame to 896 | `frame >= transitionFrames` (17); `pos.x` and `pos.y` are zeroed |
| `'descending'` | End of dropping | Same roll and speed, drop at 256 a frame to -3328 | `frame >= 17`; `stepSurfaceFrame` returns `true` |

The two transition phases are the original's `G0B` and `G1B`. `stepTransition` handles both: it adds `transitionRollDeg` (10.55 degrees) a frame to `transitionRoll`, signed by wave parity (`state.wave % 2 === 1` rolls positive; `state.wave` is 0-based, so this is the original's "sign + when `GM.WAV` odd"), slews `bankTics` back to zero at `bankSlewTics` a frame, eases `speed` toward `transitionSpeed` by an eighth of the difference, and moves forward. Over 34 frames the roll totals about 359 degrees. Fragments and dots still step during the transition; guns, shots and collisions do not. When `stepSurfaceFrame` returns `true`, `update.ts` calls `enterStage(state, 'trench')`, and `enterTrench` sees that the previous stage was the Surface and starts at the bottom Band.

## The player position model

`state.surface.pos` is the original's `TX`, `TY`, `TZ`: `x` forward, `y` right, `z` altitude, universe units (see [Coordinates](./coordinates.md)). The Surface never yaws or pitches; the player's basis is the identity rolled by the bank (`applyBank`), so every object's forward offset is its `x` difference.

Motion per frame in `stepFlying`:

- `vel.y = speed * |cursorPot.x| / 128`, signed by the pot; `vel.z = speed * |cursorPot.y| / 256`, signed by the pot (`lateralGain`, `verticalGain`). Pulling the Cursor up climbs.
- `pos.x += speed`; `pos.y += vel.y` (no lateral limit); `pos.z` is clamped to `[minAltitude, maxAltitude]` = [512, 7168].
- `speed = min(speedMax, speed + speedRamp)`: 256 rising by 1 a frame toward 1024.

### The 16-bit forward wrap and Laps

`pos.x` is kept as a signed 16-bit value. When it passes 32767 the code subtracts 65536, increments `laps`, and clears every building's `firedThisLap`. Starting at 128, the first Lap ticks after 32640 units and each later one after 65536. `laps` is the original's `GD.SEQ`. The stage ends when `laps` reaches `killAtLap` (5) and `pos.x` has come back to zero or above: 32640 + 4 × 65536 + 32768 = 327552 units, about 593 frames with the speed ramp. The test "laps tick when the 16-bit forward position overflows" checks the first-then-every-two pattern, and "runs about 593 frames" brackets the length at 550 to 650.

The Maze itself repeats every `mapWrap` (0x8000 = 32768) units, half a 16-bit range. `distanceTo(state, b)` returns `(b.pos.x - pos.x) mod 32768`, always in [0, 32768), so every building is ahead and the same Maze scrolls past twice per 65536-unit Lap. `relativeTo` builds the full offset vector `(distance, lateral, -pos.z)` for the renderer and the fragments.

### Bank

`bankTics` is the original's `GD.ACT`, in tics of 360/5632 degrees (`bankRadians`). Each frame the target is `bankTicsPerPot * cursorPot.x + bankTicsPerRoll * collisionRoll` (2 tics per pot unit, 32 per unit of collision roll), and `bankTics` moves toward it by at most `bankSlewTics` (16) a frame, or `bankSlewTicsHit` (80) while `collisionRoll` is non-zero. `collisionRoll` (`S.ROL`) decays toward zero by one a frame. `applyBank` rebuilds `player.basis` as the identity rolled by `bankRadians(state) + transitionRoll`.

## The Maze data

`src/data/surface.ts` is generated and must not be edited by hand. The parts the Surface uses:

```ts
export interface MazeEntry {
  readonly type: 'tower' | 'bishop' | 'bunker';
  readonly right: number;     // universe Y, -32768..32768
  readonly forward: number;   // universe X within one lap, 0..32768
  readonly sequence: number;  // the Lap at which it awakens, 0..3
}
export const MAZES: Record<string, readonly MazeEntry[]>;
export const MAZE_BY_WAVE: Record<number, string>;   // keyed by displayed wave, 2..20
export const RANDOM_MAZES: readonly string[];        // the six T3 mazes used from wave 21
```

There are nineteen Mazes: nine base layouts of 28 entries (`TSQUARE`, `TCLUSTR`, `TTURNON`, `TWEDGE`, `TDIFF`, `TTRAP`, `TSYMTRC`, `TVALLEY`, `TTWRCTY`) and their `T3` variants with four more towers (32 entries), plus `TBUNK`, 28 Laser Bunkers and no towers, for displayed wave 2. Only `TDIFF` and `T3DIFF` contain Bishops (three each). The same file holds the building models (`GROUND_POINTS`, `TOWER`, `TOWER_STUB`, `BUNKER`, at `BUILDING_UNIT` = 240 universe units per model unit) and the six fragment models, which only the renderer reads.

`mazeForWave` in [buildings.ts](../../src/game/surface/buildings.ts) looks up `MAZE_BY_WAVE[state.wave + 1]` and, when the displayed wave is 21 or higher, picks one of `RANDOM_MAZES` with the seeded `pick`. This is the original's `TGDPTR` table and its "random one of the last six" rule.

## Buildings

`loadMaze` turns each `MazeEntry` into a `Building`:

| Field | Meaning |
|---|---|
| `type`, `pos`, `sequence` | From the table; `pos` is `vec(forward, right, 0)` |
| `damaged` | Hat shot off, or a Laser Bunker destroyed |
| `killed` | Switched off for good on the final Lap once out of sight |
| `seen` | `{ distance, lateral }` from the last `viewBuildings`, or `null` |
| `flash` | Collision flash frames left; also blocks a second crash on the same pass |
| `armed`, `firedThisLap` | Tower gun state (see Ground guns) |

`loadMaze` also sets `towersLeft` to the number of non-bunker entries (`GD.TWL`), `nextTowerPoints` to `towerPointsStart` (`TWRMUL`), and clears `allTowersCleared`.

### Awakening by Lap

`isActive(state, b)` is `b.sequence <= laps && !b.killed && !(bunker && damaged)`. So Lap 0 shows only sequence-0 buildings, Lap 1 adds sequence 1, and by Lap 3 everything in the table is awake. A damaged tower stays active and is drawn as `TOWER_STUB`; a damaged Laser Bunker is never drawn again. Damage persists across Laps; nothing respawns.

### Sight

`viewBuildings` runs once a frame. For every active building it computes the wrapped distance `d` and lateral offset, and marks it seen when `minDistance <= d < maxDistance` (512 to 30720) and `|lateral| < d` (the 45-degree cone). A building out of sight has `firedThisLap` cleared, and on `laps >= killAtLap` is marked `killed`, which is how the field empties on the last Lap (`Q.KTW`). Everything else in the module (Laser, collisions, guns) works only on buildings with `seen` set.

`distanceShrink(d)` = `max(1/16, 1 - floor(d/512)/64)` is the original's linear scale word: buildings are drawn smaller than perspective alone gives, and the Laser test uses the same factor so what looks aimed is aimed. See the reference for the derivation.

## Shooting Hats and Laser Bunkers

`resolveGroundLaser` mirrors `GRLZIN`/`GRLZCL`/`GDHTGB`. It returns at once unless a bolt is live and no hit freeze is running (`laserFrames > 0 && laserHit === 0`); `viewGroundShots` has already claimed the frame if a ground shot was under the Cursor, so a shot always wins over a building.

The test is done in un-banked screen space: `unbankedCursor` rotates the Cursor by `-bankRadians`. For every seen, undamaged building:

1. `k = focal / d * distanceShrink(d)`; the building's screen X is `yt = focal * lateral / d` and its base Y is `zt = focal * -pos.z / d`.
2. The Cursor must be within the scaled half-width plus `hitPad` (10) of `yt`, and between the base and the scaled height (`towerHeight` 13920 or `bunkerHeight` 1440).
3. For a tower, a Cursor below the scaled `hatBottom` (12480) is a body hit: it records `bodyDistance` and moves on.
4. Otherwise the building is a candidate; the nearest wins.

If the nearest candidate is closer than any body hit, it is `damaged`, `spawnGroundFragments` runs, the score is added, an event is pushed, `sound: 'explosion'` follows, and `laserHit` is set to `LASER.hitFreezeFrames` (the bolt freezes). A body hit only pushes `laserSplash` and sets `laserHit = -1`. A miss with the un-banked Cursor below the centre line also pushes `laserSplash` (the green ground splash).

### Hat scoring and the all-towers bonus

| Target | Points | Bookkeeping |
|---|---|---|
| Laser Bunker | `SCORING.laserBunker` (200) | event `bunkerHit` |
| Tower Top | `surface.nextTowerPoints`, then `+= towerPointsStep` | event `towerTopHit { points }`; `towersLeft -= 1` |
| Last Tower Top | `SURFACE.allTowersBonus` (50000) on top | `allTowersCleared = true`; event `allTowersCleared` |

`nextTowerPoints` starts at `towerPointsStart` (200) and rises by 200 per Hat, so Hats score 200, 400, 600 and so on; the HUD shows the next value. `SCORING.laserTower` and `SCORING.allTowerTops` exist in `config.ts` but this module reads `SURFACE.towerPointsStart` and `SURFACE.allTowersBonus` instead. Change the `SURFACE` values if you want to retune.

## Tower and Laser Bunker collision

`checkCollisions` looks at every seen building. The reach is `towerCrashBase + 2 * speed` (1024 + 2 × speed) for towers and Bishops, `bunkerCrashBase + 2 * speed` (2048 + 2 × speed) for Laser Bunkers, compared with `seen.distance`. Towers crash at any altitude; a Laser Bunker only when undamaged and `pos.z < bunkerHeight`. A building with `flash > 0` is skipped, so one pass costs one crash. On a crash: `flash = 4`, events `collision { with: type }` and `sound: 'crash'`, then `shieldHit` from [guns.ts](../../src/game/dogfight/guns.ts), which refuses the loss while the gauge animation (`gaugeFrames`) is still running, exactly as the original's `GS.GLW` window did.

The bank kick: a tower sets `collisionRoll` to `±towerCrashRoll` (32) away from the tower's side, a Laser Bunker to `±bunkerCrashRoll` (19) with a random sign, in both cases only if `collisionRoll` is already zero. Note the original tested no lateral position beyond the sight cone, and neither does this code: a tower inside the cone at 1024 + 2 × speed counts as struck.

## Ground guns

[groundGuns.ts](../../src/game/surface/groundGuns.ts) implements `GDGUN`/`GDTWRGN`/`GDBSHGN`/`GDBNKGN` and the movers from `WSGUNS.MAC`. Shots live in `state.dogfight.fireballs`, six slots, but only the first `usableSlots` may be used: `SURFACE.gunSlotsByHardness[min(hardness, 11)]`, where `hardness` is `min(15, min(wave, 31) + difficulty)` from [waves.ts](../../src/game/dogfight/waves.ts). The reference notes the original's Surface used a Hardness one notch below the Dogfight's (`GD.WAV = GM.WAV - 1`); this code uses the same `hardness` as the Dogfight.

`stepGroundGuns` does nothing once `laps >= killAtLap` or when `shields < 0`. For every seen, undamaged building:

- **Laser Bunker**: a chance of `(64 - floor(d / 512)) / 256` per frame. It launches `bunkerRight` if the bunker is right of the player, else `bunkerLeft`, at the bunker's position and height 512.
- **Tower or Bishop**: fires once per sighting, when its scaled top crosses the player's altitude. With `f = 2 * (0x4000 - d/2) / 0x4000`, `top = towerTopForArming * f` and `hat = hatForArming * f`. If the top is below the player it arms; when it is crossing (`0 <= top - z <= hat`) or was armed and is now above, it disarms, sets `firedThisLap`, and launches up to three shots with independent 50 % chances: `towerForward` (towers only), `towerRight`, `towerLeft`, at the player's altitude. `firedThisLap` is cleared both at each Lap and whenever the building leaves sight, so a building that leaves and re-enters the cone within a Lap may fire again.

`launch` fills a `Fireball` with `kind: 'live'`, the mover, a `timer` of `shotFrames` (112), and pushes `alienFired` and `sound: 'groundShot'`.

`stepGroundShots` moves shots in universe coordinates:

| Mover | Motion per frame |
|---|---|
| `towerForward` | `x -= shotSpeed` (256) |
| `towerLeft`, `towerRight` | `x -= 256` and `y -= 256` or `y += 256` |
| `bunkerLeft`, `bunkerRight` | `x` creeps by `4 * (hi(x) - hi(player.x))`; `y` slews toward `player.y ∓ 256` with gain 1/8 toward the preferred side and 1/32 away, clamped to ±384, plus 7/8 of the player's `vel.y`; `z` rises toward `player.z + 256` with gain 1/8, at most 512, never down |

`viewGroundShots(state, lasersOn)` projects each live shot relative to the player with `projectRelative`; a shot outside the cone is dropped. With lasers on it finds the nearest shot inside the octagon around `laserAt` (size `512 * 80 / halfDistance + 10`), calls `hurtFireball` (33 points, purple sparkle) and sets `laserHit = 4`. A shot within `max(speed, 512) + impactPad` ahead and inside the Cursor box (the `CURSOR.pot*` limits times 4) is `impacting`, and `fireballImpact` costs a Deflector Shield through `shieldHit`.

## Fragments

`spawnGroundFragments(state, b)` (`BGTWXP`/`BGBKXP`) pushes three `GroundFragment` records, shapes `towerLeft`/`towerCentre`/`towerRight` or the bunker equivalents, at the building's wrapped position, height `towerFragmentHeight` (14400) or `bunkerFragmentHeight` (720). Each flies toward a point 0x7F00 ahead of the player and 0x3F00 to the left, centre or right, at a 1/32 of that distance per frame plus a random forward nudge, with an upward speed of `((0x200 | rnd) * 4)` for towers or `(0x300 | rnd) * 4` for bunkers. `timer` is `fragmentFrames` (32). The queue holds eight; the oldest is shifted out.

`stepGroundFragments` applies the shared tumble: `surface.munge` is rolled 19.04 degrees and pitched 4.99 degrees a frame while any fragment lives, and reset to the identity when none does. Each fragment moves by its velocity, loses `fragmentFriction` (1/32) of its horizontal speed, drops by `fragmentGravity` (200) a frame, and stops at `z = 0`.

## Ground dots

There is no horizon line and no grid; the ground is the buildings plus fifty green dots. `initDots` seeds `dotCount` dots anywhere in the 65536-unit square at `z = 0`. `stepDots` keeps a dot while its view-space forward distance exceeds 0x100 and it is inside the cone (`inCone`), and otherwise respawns it `dotAheadMin..dotAheadMax` (0x7000 to 0x7FFF) ahead and a random 0..0x7FFF to the side opposite its current view `y`. This is `VWSTRG`/`STRNWG`, which reused the fifty star slots.

## Events pushed

| Event | Where | When |
|---|---|---|
| `stageStarted { stage: 'surface', wave }` | `enterStage` | Entry |
| `music { cue: 'fourths' }` | `enterSurface` | Entry (`PM4TH`) |
| `music { cue: 'rebel' }` | `stepFlying` | `frame === rebelThemeFrame` (224, the original's `PH.TIM == 14`) |
| `speech 'USE THE FORCE, LUKE'` | `stepFlying` | Start of `'dropping'` (`SPKUSE` at `G0B`); `enterTrench` does not repeat it when coming from the Surface |
| `laserFired`, `sound 'laser'` | `stepLaserTrigger` | Fresh press |
| `towerTopHit { points }`, `bunkerHit`, `allTowersCleared`, `sound 'explosion'` | `resolveGroundLaser` | Hits |
| `laserSplash` | `resolveGroundLaser` | Tower body, or the ground |
| `collision { with }`, `sound 'crash'` | `checkCollisions` | Crash |
| `shieldHit`, `sound 'shieldHit'`, `shieldLost { remaining }`, shield speech lines | `shieldHit`/`loseShield` in guns.ts | Any Deflector Shield loss |
| `alienFired`, `sound 'groundShot'` | `launch` | A building fires |
| `laserHitFireball`, `sound 'cannonStop'`, `sound 'shotDestroyed'` | `hurtFireball` | A shot destroyed |

## Tuning

Everything is in `SURFACE` in [config.ts](../../src/game/config.ts). The values most likely to be touched:

| Constant | Value | Used for |
|---|---|---|
| `mapWrap` | 0x8000 | The Maze repeat distance |
| `startX`, `startAltitude` | 128, 8192 | `enterSurface` |
| `minAltitude`, `maxAltitude` | 512, 7168 | Altitude clamp |
| `speedStart`, `speedRamp`, `speedMax` | 256, 1, 1024 | Forward speed |
| `minDistance`, `maxDistance` | 512, 30720 | Sight range |
| `towerRadius`, `towerHeight`, `hatBottom` | 960, 13920, 12480 | Laser test |
| `bunkerRadius`, `bunkerHeight` | 1680, 1440 | Laser test, bunker crash altitude |
| `towerCrashBase`, `bunkerCrashBase` | 1024, 2048 | Collision reach |
| `killAtLap` | 5 | Guns silenced, buildings killed, stage end |
| `towerPointsStart`, `towerPointsStep`, `allTowersBonus` | 200, 200, 50000 | Hat scoring |
| `gunSlotsByHardness` | `[1,1,2,2,3,3,4,4,5,5,6,6]` | Usable shot slots |
| `rebelThemeFrame` | 224 | Music cue |
| `transitionFrames`, `transitionRollDeg` | 17, 10.55 | Each half of the roll into the Trench |
| `transitionDropTo`, `trenchDropTo` | 896, -3328 | Altitude targets of the two halves |

The Game Frame period on the Surface is `PACE.surface` (0.074 s, about 13.5 frames a second) from [pace.ts](../../src/game/pace.ts), measured from a cabinet recording.

## How `surface.test.ts` exercises it

The helper `surfaceState(wave)` builds a seeded state, starts a game, `beginWave`s and enters the Surface directly with `enterStage`; `aimAt(state, x, y)` writes the Cursor pot, target and screen position for a VG-unit point and returns an `Input` with fire held. Frames are driven through `runFrame`/`runFrames`/`runFields` from [testUtils.ts](../../src/game/testUtils.ts), which step fields until a Game Frame has run, so the pace table applies.

"surface flow" covers: the Maze and tower count for displayed wave 3 (`TSQUARE`), the first-frame altitude clamp and the speed ramp, the Lap pattern, the stage length and the two 17-frame transition halves, exactly one `USE THE FORCE, LUKE` between the Surface and the Trench, and that the yoke moves the ship and banks the basis. Flow tests top `shields` up each frame so ground fire cannot end them.

"surface combat" parks a single building at a chosen distance with `parkTower`, calls `viewBuildings` by hand, and aims by computing the same `k`, `yt`, `zt` the code uses: a Hat hit scores 200 and raises `nextTowerPoints`; a body hit only splashes; a Laser Bunker scores 200; a tower costs a Deflector Shield at any height while a Laser Bunker only when flying low; and `distanceTo` wraps so every building is ahead.

## Things to watch

- `src/game/stages/surface.ts` is an unused skeleton. Edit `src/game/surface/index.ts`.
- The Surface reads `hardness(wave, difficulty)` for its gun slots, which is the Dogfight's Hardness, not the one-notch-easier value the reference records for `PHIGD`.
- Guns are keyed to `b.seen`, and `firedThisLap` is cleared when a building leaves sight, so "once per Lap" is really "once per sighting".
- `stepTransition` does not step shots, guns or collisions; the fireball slots were emptied when `'dropping'` began.
- The transition already lowers `surface.pos.z` to -3328, but the Trench keeps its own position and `enterTrench` sets `trench.pos.z` from `TRENCH.entryFromSurfaceZ`.
