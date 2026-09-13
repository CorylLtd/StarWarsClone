# The Trench stage

The Trench is the last stage of a wave: Red Five flies the Death Star's trench at a fixed speed past Catwalks and Trench Turrets, fires a Laser at the floor to launch the Torpedo into the Exhaust Port, and either watches the Death Star burst or bashes the end wall and flies the same Trench again. The simulation lives in `src/game/trench/`: `index.ts` holds entry, the phase machine and the Death Star's destruction, `layout.ts` generates the walls from the Pie and Wedge tables in `src/data/trench.ts`, and `combat.ts` holds Catwalk collision, Trench Turrets, the Laser ray and the Torpedo. Tuning is in `TRENCH` in `src/game/config.ts`. It is called once per Game Frame from `stepPlaying` in [update.ts](../../src/game/update.ts) and reports one-off happenings as `GameEvent` values. The deeper rules, with citations into the original listing, are in [Trench rules](../reference/trench-rules.md); the shapes are in [Trench shapes](../reference/shapes-trench.md).

## Files

| File | Holds |
|---|---|
| [index.ts](../../src/game/trench/index.ts) | `enterTrench`, `stepTrenchFrame`, flight, the miss and repeat, the explosion phases, the next-wave accounting |
| [layout.ts](../../src/game/trench/layout.ts) | `pieForWave`, `slotIndex`, `resetLayout`, `generateRow`, `stepLayout`, the Force bonus award |
| [combat.ts](../../src/game/trench/combat.ts) | `bandAt`, `checkCatwalks`, `trenchHardness`, Trench Turrets and their shots, `resolveTrenchLaser`, `stepTorpedo` |
| [src/data/trench.ts](../../src/data/trench.ts) | Generated: the wall models, `WEDGES`, `WEDGE_ENDS`, `PIES`, and `TRENCH_MESSAGES` notes for the HUD |
| [src/game/stages/trench.ts](../../src/game/stages/trench.ts) | An empty skeleton. Nothing imports `src/game/stages/`; the live entry points are in `src/game/trench/index.ts` |
| [trench.test.ts](../../src/game/trench/trench.test.ts) | Vitest coverage of layout, flight, the Force, Catwalks, Trench Turrets and the Exhaust Port |

The state is `state.trench`, typed as `Trench` in [types.ts](../../src/game/types.ts). Like the Surface, the Trench borrows `state.dogfight.fireballs` for its six shot slots and `state.player` for the basis, Cursor and Laser. The renderer (`src/render/trenchView.ts`) reads `pos`, `slots`, `rowStarts`, `portX`, `endX`, `torpedo`, `force`, `forceBonus`, `repeat`, `missedFrames`, `cueIndexPassed`, and the explosion and accounting fields.

## Entering the Trench: `enterTrench`

```ts
export function enterTrench(state: GameState, fromSurface: boolean, repeat = false): void
```

`enterStage(state, 'trench')` in `update.ts` passes `fromSurface = previous === 'surface'`. The stage is reached two ways. After the Surface's roll-in, on every wave but the first, the ship arrives at the bottom Band: `pos.z = TRENCH.entryFromSurfaceZ` (-3328), the original's `G1B` drop target. On displayed wave 1 the Dogfight goes straight to the Trench (`S0B`, "no descent animation from space"), and `pos.z = TRENCH.entryFromSpaceZ` (0), which the first move clamps to `playerMaxZ` (-257), the top Band. A repeat pass after a miss also starts at the top.

The rest of the reset: `phase` `'flying'`, `frame` 0, `pos.x = pos.y = 0`, zero velocity, no Torpedo, `torpedoFired` false, `lastSlot` 0, the player's basis set to the identity with `rollFrames` cleared, and the six fireball slots emptied. The Force state is `force = repeat ? -1 : 0`; on a first pass `forceBonus` and `repeat` are zeroed as well. `missedFrames` is `4 * pseudoSecondFrames` (64) on a repeat, which times the "EXHAUST PORT MISSED" message. `resetLayout(state, repeat)` rebuilds the walls, keeping the Pie on a repeat. The speech line `USE THE FORCE, LUKE` is pushed here only for the space entry: the Surface queues it as its drop begins, and the original spoke it once at `G0B`/`S0B`.

## One Game Frame: `stepTrenchFrame`

`stepTrenchFrame(state, input)` returns `true` when the next wave should begin. It dispatches on `state.trench.phase`:

| Phase | Function | Original | Game Frame period (`PACE`) |
|---|---|---|---|
| `'flying'` | `stepFlying` | `BS` | `trench` 0.076 s |
| `'explosion1'` | `stepExplosion1` | `DX1` | `deathStarPullAway` 0.071 s |
| `'explosion3'` | `stepExplosion3` | `DX3` | `deathStarExplosion` 0.04 s |
| `'next'` | `stepNext` | `NXT` | `nextWave` 0.05 s |

There is no `'explosion2'`; the original's one-frame `DX2` is folded into the switch to `'explosion3'`.

### Order of work in `stepFlying`

| Step | Call | What it does |
|---|---|---|
| 1 | `stepLaserTrigger` | Fires on a fresh press, ticks the bolt and the hit freeze |
| 2 | `viewWallShots` | Projects the shots, resolves the Laser against them, applies impacts; returns whether a shot was hit |
| 3 | `resolveTrenchLaser` | The ray against walls, floor and Exhaust Port, only when lasers are on and no shot was hit |
| 4 | return if `shields < 0` | Nothing more on the frame of the fatal hit |
| 5 | `stepWallShots`, `stepFireballs` | Move the shots; tick timers and drop expired ones |
| 6 | `stepTorpedo` | Glide the Torpedo to the port |
| 7 | `stepWallGuns` | Decide which Trench Turrets fire |
| 8 | counters | `gaugeFrames`, `flashFrames`, `missedFrames`, each slot's `struck` count down |
| 9 | move | `vel.y = speed * |cursorPot.x| / 256`, `vel.z = speed * |cursorPot.y| / 128`, signed by the pot; `pos.x += speed` (768); `y` clamped to `±playerMaxY` (511), `z` to `[playerMinZ, playerMaxZ]` (-3583 to -257) |
| 10 | `stepLayout` | Generate rows ahead, clear the slot just left |
| 11 | `checkCatwalks` | Collision with a Catwalk in the player's slot |
| 12 | clocks | `frame += 1`; music and speech on the pseudo-second clock |
| 13 | end test | `endX - pos.x <= endReach` (2048): hit or miss |

The player's basis stays the identity throughout: the Trench has no bank, yaw or pitch (`S1TWBS` was an `RTS`). `shieldHit` still sets `rollFrames`, but nothing in the Trench applies it to the basis.

### The pseudo-second clock

`TRENCH.pseudoSecondFrames` is 16. `tim = floor(frame / 16)` is the original's `PH.TIM`. On the frame a pseudo-second turns over: `tim === 2` pushes `music 'rebelRepeats'` (`PMRRP`); at 16, `LUKE, TRUST ME` when `state.wave` is even or `LET GO, LUKE` when odd; then `YAHOO, YOU'RE ALL CLEAR KID` at 24 on even waves or `THE FORCE IS STRONG WITH THIS ONE` at 22 on odd ones. `state.wave` is 0-based, so "even" means displayed odd waves, matching the reference's `BS.WAV` parity.

## The row generator

[layout.ts](../../src/game/trench/layout.ts) turns the tables into a ring of panel codes that the renderer, the guns, the Laser and the Catwalk test all read.

### Pie, Wedges, rows

```ts
export interface WedgeRow {
  readonly length: number;                              // 2048 short, 4096 long
  readonly left: readonly [number, number, number, number];   // codes top to bottom
  readonly right: readonly [number, number, number, number];
}
export const WEDGES: Record<string, readonly WedgeRow[]>;   // 53 wedges, '01'..'99'
export const WEDGE_ENDS: Record<string, unknown>;           // { type: 'next' | 'end' } per wedge
export const PIES: Record<string, readonly string[]>;       // 'PIE1'..'PIE11', 'PIEXX'
```

A Pie is sixteen Wedge names. `pieForWave` uses `min(state.wave, 31) + 1` as the displayed wave and returns a copy of `PIES['PIE<n>']` for waves 1 to 11. From wave 12 it assembles the random Pie: `RANDOM_PIE` in `layout.ts` (the same shape as `PIEXX` in the data, the `'XX'` entries filled with `pick` from the seventeen `RANDOM_CANDIDATES`). This is the original's `GNBASE`, run once per Death Star and not on a repeat, which is why `resetLayout` takes `keepPie`.

Every content Wedge is 32768 units long, every divider (`92` to `97`) 6144, the intro `10` 28672 and the port Wedges (`29`, `98`, `99`) 30720, so every Trench is 331776 units. The test "every trench is 331776 units long" checks that for three waves.

### The sixteen-slot ring

The walls are `t.slots`, sixteen `TrenchSlot` records, one per `slotLength` (2048) of trench, indexed by `slotIndex(x) = floor(x / 2048) & 15`, the original's `(X >> 11) & 15` into `PNLW`/`PNRW`. A `TrenchSlot` has `left` and `right` arrays of four codes, top Band to bottom, plus `catwalkCue`, `catwalkLum` and `struck`.

| Code | Meaning | Model | Interaction |
|---|---|---|---|
| 0 | Empty (also a destroyed panel or turret) | | |
| 1 | Decorative panel | `WALL_PANEL`, green | Laser: 50 points |
| 2 | Catwalk | `CATWALK` | Collision at its Band on its side |
| 3 | Trench Turret | `WALL_GUN`, red | Fires; Laser: 100 points |

`generateRow` appends the next row of the current Wedge at `t.farX`: it copies the row's codes into the slot at `slotIndex(farX)`, zeroes `struck`, assigns `catwalkCue = cueIndex++` when either wall holds a 2, pushes `farX` onto `rowStarts` (the wall verticals the renderer draws), and advances `farX` by the row length. A 4096 row writes only its first slot. When a Wedge is exhausted it moves to the next; when the Wedge's `WEDGE_ENDS` type is `'port'` or `'end'`, or it is the last of the Pie, it lays the port row: `portX = farX`, then `farX += portToEnd` (4096) and `endX = farX`. If `force` is still 0 at that moment, `earnForce` runs.

`resetLayout` clears everything (`wedgeIndex`, `rowIndex`, `farX`, `nearX`, `rowStarts`, fresh slots, `portX` and `endX` null, both cue counters) and pre-generates nine rows. `stepLayout` then keeps generating while `farX - pos.x <= generateAhead` (24576) and `endX` is null (`DOFAR`). When the player's slot changes it clears the codes of the slot just left, bumps `cueIndexPassed` if that slot held a Catwalk, and trims `rowStarts` to those within two slots behind. `nearX` is reset but never updated anywhere; ignore it.

### Bands

`TRENCH.bandCentres` are `[-512, -1536, -2560, -3584]` with `bandHalfHeight` 512; the floor is `floorZ` -4096 and the top edge 0. `bandAt(z)` returns the first Band whose centre is within 512 of `z`, or -1, so a height exactly on a boundary belongs to the upper Band.

### Catwalks and their depth-cue colours

The Catwalk colour is a depth cue, not a property of the row. The renderer computes it from `slot.catwalkCue - t.cueIndexPassed`: the colour is `TRENCH.catwalkColours[(cue) mod 3]` (`YLW`, `TRQ`, `PRP`, the original's `TFFCUE`) and the brightness is `catwalkLumStart` (0x88) minus `catwalkLumStep` (8) per Catwalk ahead, floored at `catwalkLumMin` (0x40). As the player passes a slot with a Catwalk, `cueIndexPassed` rises and every Catwalk ahead shifts one step nearer and brighter. A slot whose `struck` is positive is drawn in the flash cycle instead. `slot.catwalkLum` is initialised but never written or read; the renderer recomputes the brightness each frame.

## Catwalk collision

`checkCatwalks` (`PNVLW`/`PNVRW`) tests only the player's own slot and only while `pos.x` is within the first `catwalkHitDepth` (1024) of it. The Band is `bandAt(pos.z)`. The side is chosen by sign: `pos.y <= 0` reads `left`, otherwise `right`; at exactly `y === 0` both walls count. A hit needs code 2 there and `slot.struck === 0`. Then `struck = 4`, events `catwalkHit` and `sound 'crash'`, and `shieldHit`; if that started a gauge animation, `gaugeFrames` is capped at `catwalkQuickGlowFrames` (8), the Trench's quick glow. Lateral position within the half does not matter: a Catwalk blocks its whole side at its Band. Walls, floor and top are never collided with; the position is clamped.

## Hardness and the gun window

```ts
export function trenchHardness(state: GameState): number {
  return Math.min(15, hardness(state.wave, state.difficulty) + state.trench.repeat * state.difficultyBump);
}
```

This is `WV.HRD` for the Trench: the wave's Hardness plus `GM.BMP` (`state.difficultyBump`) for each repeat pass. The comment in the code records the reason it is computed rather than stored: the original's `PHIB0B` bumped `WV.HRD` and never `GM.DIF`, so a missed port hardens only the repeated Trench and leaves `state.difficulty` alone. The test "a repeat pass raises only this trench's hardness by the bump" pins that down.

`stepWallGuns` (`DOBASE`/`BSGUN`) does nothing while `torpedoFired`. It reads `TRENCH.gunWindow[min(trenchHardness, 7)]`:

| Hardness | `mask` | `prob` | Fires on frames | Near chance |
|---|---|---|---|---|
| 0 | 15 | 128 | every 16th | 50 % |
| 1 | 15 | 96 | every 16th | 62 % |
| 2 | 15 | 64 | every 16th | 75 % |
| 3 | 15 | 32 | every 16th | 87 % |
| 4 | 7 | 96 | every 8th | 62 % |
| 5 | 7 | 32 | every 8th | 87 % |
| 6 | 3 | 96 | every 4th | 62 % |
| 7 and up | 3 | 32 | every 4th | 87 % |

On a window frame (`(frame & mask) === 0`) it walks every slot from the player's to `generateAhead` ahead, both walls, top Band first. A code-3 panel considers the player only when above its Band centre: by less than `gunAboveNear` (1024) it fires when a random byte `r >= prob`; by less than `gunAboveFar` (2048) when `(r * r) >> 8 >= prob`, which is rare; a player below a Trench Turret is never fired at. A shot needs a free slot among the first `usableSlots`: `gunSlotsByHardness[min(hardness, 7)]` = `[1,1,2,2,3,3,3,4]`, or all six once `portX` is set. The shot is a `Fireball` with `mover: 'wall'` at the slot centre, `y = ∓shotStartY` (896) and the Band centre, `timer` `shotFrames` (64); events `alienFired` and `sound 'groundShot'`.

`stepWallShots` moves them: `x` creeps by `4 * (hi(x) - hi(pos.x))`, `z` rises toward the player with gain 1/16, `y` moves inward toward the player's `y` with gain 1/16 only while that is inward; at Hardness 0 the target is `∓384` instead of the player (the original's easy-wave sideline aim). `viewWallShots` projects each shot with `projectRelative`, drops any outside the cone, and applies the Laser octagon (`LASER.hitPad`, `LASER.octagonFactor`) to find the nearest under `laserAt`; a hit calls `hurtFireball`, sets `laserHit` and returns `true`, which skips `resolveTrenchLaser` for the frame. A shot within `speed + impactPad` (1040) and inside the fixed Cursor box (|x| ≤ 448, y from -416 to 480) is `impacting` and costs a Deflector Shield through `fireballImpact`.

## The Laser ray

`resolveTrenchLaser` (`CLBLZ`/`LZCPNW`/`LZHPN`) runs when a bolt is live and no hit freeze is running. Its first act is `if (t.force === 0) t.force = -1`: firing while still trying forfeits The Force.

The ray goes from the ship to a far point ahead:

```ts
const dirX = TRENCH.rayAhead;               // 28672
const dirY = TRENCH.rayPerPot * p.cursorPot.x;
const dirZ = TRENCH.rayPerPot * p.cursorPot.y;
```

`rayPerPot` is `(7 / 8) * 256` = 224 (pot units are explained on the [Coordinates](./coordinates.md) page). The original offset the far point by 7/8 of `LZ.RSX`/`LZ.RSY`, the yoke's 16-bit slewed positions, which are the 8-bit pot values times 256. With `focal` 512, the far point projects to `512 * 224 * pot / 28672 = 4 * pot` screen units, which is where the Cursor is drawn (`pot * 4`), so the ray passes through the Cursor. The reference records that an earlier reading took 7/8 of the 8-bit pot, which would never reach a wall; do not reintroduce it.

The ray is intersected with the nearer wall (`|y| = wallY`, 1024) and, if aimed down, the floor (`floorZ`). Whichever comes first within the ray's length (`t <= 1`) wins:

- **Wall**: the hit's slot is `slotIndex(hitX)`, its Band `bandAt(hitZ)`, and the codes are `right` for a rightward ray, else `left`. The hit must fall between 512 and 1536 into the slot, widened by `laserRadius` (64), where the panel model sits. Code 3 becomes 0 for `SCORING.trenchTurret` (100) with `turretHit`; code 1 becomes 0 for 50 points with `panelHit`; both push `sound 'explosion'` and set `laserHit` to `LASER.hitFreezeFrames`. Catwalks cannot be shot. Anything else on a wall is a `laserSplash`.
- **Floor**: if the floor point lies between the walls it is a `laserSplash`, and if the port exists, no Torpedo has fired, and the point is within `portHitRadius` (512) of `(portX, 0)` in both `x` and `y`, the Torpedo launches.

The 50 for a panel is a literal in `combat.ts`; `SCORING` has no entry for it.

## The Exhaust Port and the Torpedo

`portX` is set by `generateRow` when the last Wedge runs out, roughly 24576 ahead of the player, and `endX = portX + portToEnd`. The renderer draws `EXHAUST_PORT` at `(portX, 0, floorZ)` while it is within `portDrawAhead`.

A floor hit near the port sets `torpedoFired`, creates `torpedo = { pos: (pos.x + 256, pos.y, pos.z), live: true }`, empties the fireball slots, and pushes `torpedoFired`, `music 'torpedo'` and `sound 'torpedo'` (`FRPTGN`: `PMSF2` + `AUDPH`). From that moment the hit is decided; the Torpedo's flight is cosmetic. `stepTorpedo` moves it forward at `torpedoSpeed + speed` (1536) a frame up to `portX`, holds `z` at or below `portX - x + floorZ` so it dives as it nears, narrows `y` to `±(portX - x) / 16`, and marks it dead once 0x4000 behind the player. The renderer draws the pair at `±torpedoOffsetY` (128).

## The Force bonus

`t.force` is the original's `Q.FRC`: 0 still trying, -1 forfeited, 1 earned. `enterTrench` starts it at 0 on a first pass and -1 on a repeat. The first `resolveTrenchLaser` while it is 0 sets -1. When `generateRow` lays the port row with `force` still 0, `earnForce` sets it to 1, scores `TRENCH.forceBonus[min(state.wave, 4)]` (5,000, 10,000, 25,000, 50,000, 100,000 for displayed waves 1 to 5 and up) straight into `state.score` and `lastScore`, stores it in `forceBonus` for the HUD, and pushes `forceBonus { points }`. The port row is generated about 24576 units before the port, so the rule is: fire nothing until the last Wedge has been laid out; the port shot itself does not cost the bonus. The tests "is earned by not firing until the port row is generated" and "is lost by firing" cover both sides.

## The end of the Trench: hit, miss and repeat

When `endX` is set and `endX - pos.x <= endReach` (2048):

**Hit** (`torpedoFired`): `phase` becomes `'explosion1'`, `frame` 0, `dxScale = dx1ScaleStart`, `dxStep = dx1StepStart`, the basis is reset to the identity, `music 'end'` (`PMEND`) is pushed, and on `state.wave >= 3` with an odd value the speech `GREAT SHOT KID, THAT WAS ONE IN A MILLION`.

**Miss**: events `portMissed` and `sound 'crash'`. The code then takes a Deflector Shield itself rather than through `shieldHit`: it zeroes `gaugeFrames` first so the loss cannot be refused by the gauge window, and if `shields` was already 0 or less sets `shields = -1` and returns (the caller switches to dying). Otherwise `shields -= 1`, `gaugeFrames = 10 + old`, `shieldLost { remaining }` and the speech `R2 NO`. Then `repeat += 1` and `enterTrench(state, false, true)`: the same Pie, the walls regenerated from the start, the player back at `(0, 0)` and the top Band, `force = -1`, `missedFrames` 64. Because `trenchHardness` adds `repeat * difficultyBump`, only this Trench gets harder; `state.difficulty` is untouched until `completeWave`. The test "runs about 432 frames, then a miss costs a shield and repeats the same trench harder" brackets the flight at 400 to 460 frames and checks the Pie is unchanged.

## The Death Star's destruction

### `'explosion1'`: the pull-away

`stepExplosion1` (`DX1`) grows `dxScale` by `dxStep >> 4` a frame while `dxStep` falls by one a frame, from `dx1ScaleStart` (3 × 128 + 4, half size in the original's masked scale) until `dxScale >= dx1ScaleEnd` (6 × 128, a sixteenth). The step is 10 for sixteen frames, then 9, then 8, so the phase lasts about 42 frames. The renderer reads `dxScale` to shrink the Death Star. On completion: `phase` `'explosion3'`, `burstPhase` 0, `burstCount` 1, and `sound 'deathStar'`.

### `'explosion3'`: the burst

`stepExplosion3` (`DX3`, `XP.PH0` to `XP.PH3`) runs four phases on `burstCount`; the renderer draws circles and rings from `burstPhase` and `burstCount`:

| `burstPhase` | Per frame | Ends when | Then |
|---|---|---|---|
| 0 | `burstCount += 2` | `>= 0x3f` | phase 1, count 1, `sound 'deathStar'` |
| 1 | `burstCount += 2` | `>= 0x3f` | phase 2, count 1, `sound 'deathStar'` |
| 2 | `burstCount += 3` | `>= 0x50` | phase 3, count 0x80 |
| 3 | `burstCount -= 4` | `< 8` | `phase = 'next'` |

That is 31, 31, 27 and 30 frames, about 119 in all. `TRENCH.dx3Phase0Frames` and its siblings record those lengths but the code is driven by the counts, not by them. Entering `'next'` resets `frame`, sets `nextTim = nextStartTim` (4) and `shieldsAdded = 0`, turns the player round with `reversedBasis`, re-seeds the stars with `initStars`, and pushes `deathStarDestroyed`.

### `'next'`: the accounting

`stepNext` (`NXT`) advances `dogfight.frame` and `stepStars` every frame so the star field streams, and does its work only when `frame % pseudoSecondFrames === 0`, decrementing `nextTim` on each 16-frame pseudo-second:

| `nextTim` | Action | HUD text (renderer) |
|---|---|---|
| 3 | `SCORING.exhaustPort` (25,000) | |
| 2 | `max(0, shields) * SHIELDS.endOfWaveBonusPerShield` (5,000 each) | "BONUS FOR REMAINING ENERGY" |
| 1 | `shields = min(OPTIONS.startingShields, shields + OPTIONS.bonusShieldsPerDeathStar)`; `shieldsAdded` records the difference | "n ADDED TO DEFLECTOR SHIELD" or "SHIELD AT FULL STRENGTH" |
| 0 | On `state.firstWave`, `SCORING.waveSelectBonus[state.wave]` | "STARTING WAVE BONUS" |
| -2 | Return `true` | |

Points here go through a local `addPoints` that ignores zero or negative amounts. When `stepTrenchFrame` returns `true`, `completeWave` in `update.ts` pushes `waveCompleted`, raises `wave`, applies the bump to `difficulty`, clears `firstWave` and enters the next Dogfight. Bonus Deflector Shields never exceed the Starting Shields.

## Events pushed

| Event | Where | When |
|---|---|---|
| `stageStarted { stage: 'trench', wave }` | `enterStage` | Entry from the Dogfight or the Surface; a repeat calls `enterTrench` directly and raises none |
| `speech 'USE THE FORCE, LUKE'` | `enterTrench` | Entry from space only |
| `music 'rebelRepeats'` | `stepFlying` | Pseudo-second 2 |
| `speech` lines by wave parity | `stepFlying` | Pseudo-seconds 16, 22, 24 |
| `laserFired`, `sound 'laser'` | `stepLaserTrigger` | Fresh press |
| `turretHit`, `panelHit`, `sound 'explosion'` | `resolveTrenchLaser` | Wall hits |
| `laserSplash` | `resolveTrenchLaser` | Wall miss or floor |
| `torpedoFired`, `music 'torpedo'`, `sound 'torpedo'` | `resolveTrenchLaser` | Floor point on the port |
| `forceBonus { points }` | `earnForce` | Port row generated with `force === 0` |
| `catwalkHit`, `sound 'crash'` | `checkCatwalks` | Collision |
| `shieldHit`, `sound 'shieldHit'`, `shieldLost { remaining }`, shield speech | `shieldHit`/`loseShield` | Catwalk or shot impact |
| `alienFired`, `sound 'groundShot'` | `stepWallGuns` | A Trench Turret fires |
| `laserHitFireball`, `sound 'cannonStop'`, `sound 'shotDestroyed'` | `hurtFireball` | A shot destroyed |
| `portMissed`, `sound 'crash'`, `shieldLost`, `speech 'R2 NO'` | `stepFlying` | End wall without the Torpedo |
| `music 'end'`, `speech 'GREAT SHOT KID...'` | `stepFlying` | End wall with the Torpedo |
| `sound 'deathStar'` ×3 | `stepExplosion1`, `stepExplosion3` | Burst phases 0, 1, 2 begin |
| `deathStarDestroyed` | `stepExplosion3` | Entering `'next'` |
| `waveCompleted { wave }` | `completeWave` | After `nextTim` reaches -2 |

## Tuning

All in `TRENCH` in [config.ts](../../src/game/config.ts):

| Constant | Value | Used for |
|---|---|---|
| `wallY`, `floorZ`, `topZ` | 1024, -4096, 0 | Geometry |
| `playerMaxY`, `playerMinZ`, `playerMaxZ` | 511, -3583, -257 | Position clamps |
| `speed`, `lateralGain`, `verticalGain` | 768, 1/256, 1/128 | Motion |
| `entryFromSurfaceZ`, `entryFromSpaceZ` | -3328, 0 | `enterTrench` |
| `slotLength`, `ringSlots`, `bandCentres`, `bandHalfHeight` | 2048, 16, four centres, 512 | The ring and Bands |
| `generateAhead`, `drawAhead` | 24576, 28672 | Generation and drawing distance |
| `catwalkHitDepth`, `catwalkQuickGlowFrames` | 1024, 8 | Catwalk collision |
| `gunWindow`, `gunSlotsByHardness`, `gunAboveNear`, `gunAboveFar` | see above | Trench Turrets |
| `shotFrames`, `shotStartY`, `impactPad` | 64, 896, 272 | Shots |
| `rayAhead`, `rayPerPot`, `laserRadius` | 28672, 224, 64 | The Laser ray |
| `portToEnd`, `portHitRadius`, `portDrawAhead` | 4096, 512, 28672 | The Exhaust Port |
| `torpedoSpeed`, `torpedoOffsetY` | 768, 128 | The Torpedo |
| `endReach` | 2048 | End-of-trench test |
| `forceBonus` | `[5000, 10000, 25000, 50000, 100000]` | The Force |
| `catwalkColours`, `catwalkLumStart`, `catwalkLumStep`, `catwalkLumMin` | `YLW/TRQ/PRP`, 0x88, 8, 0x40 | Depth cue (renderer) |
| `pseudoSecondFrames` | 16 | Cues and accounting |
| `dx1ScaleStart`, `dx1ScaleEnd`, `dx1StepStart` | 388, 768, 160 | Pull-away |
| `nextStartTim` | 4 | Accounting clock |

## How `trench.test.ts` exercises it

`trenchState(wave)` seeds a state, starts a game, `beginWave`s and enters the Trench with `enterStage`, so every test takes the space entry (top Band) regardless of wave. Frames run through `runFrame`/`runFrames`/`runFields` from [testUtils.ts](../../src/game/testUtils.ts), so `PACE.trench` applies and flow tests top `shields` up each frame.

- **Layout**: the fixed Pie for wave 1 with rows pre-generated; every Trench 331776 long with the port 4096 before the end, driven by jumping `pos.x` 4096 a frame; `slotIndex` wrapping at sixteen.
- **Flight**: the top Band from space and 768 a frame; the yoke reaching the clamps; about 432 frames to a miss, one Deflector Shield, `repeat` 1, the same Pie, `force` -1, and the position reset; the repeat raising `trenchHardness` by `difficultyBump` while `difficulty` stays put.
- **The Force**: earned when `portX` appears without firing; lost by one `runFrame` with fire.
- **Catwalks**: `bandAt` edges; a code 2 on the player's side and Band in the first part of the slot costs a Deflector Shield, and the other side or another Band does not.
- **Trench Turrets**: the test solves the ray backwards, placing the player so a pot of (56, 28) meets the right wall inside slot 6 at Band 1, writes a 3 there, and expects `turretHit` and the code cleared.
- **The Exhaust Port**: generates the whole Trench, flies low with the Cursor pulled down (`rsy = -104`) at the distance where the ray's floor point lands on `portX`, expects `torpedoFired`, runs to the end wall for `'explosion1'`, then through the burst and accounting to `deathStarDestroyed`, `waveCompleted`, at least 25,000 points, and the Dogfight of wave 1.

## Things to watch

- `src/game/stages/trench.ts` is an unused skeleton. Edit `src/game/trench/index.ts`.
- A repeat pass re-enters through `enterTrench` directly, not `enterStage`, so no `stageStarted` event is raised and `state.stageFrames` keeps counting.
- The miss path bypasses `shieldHit`: no screen flash, no forced roll, no first-hit speech, and the gauge window is cleared so the loss always lands.
- The 50 points for a decorative panel is a literal in `combat.ts`, against the rule in `config.ts` that no magic number lives outside it.
- `slot.catwalkLum` and `t.nearX` are dead fields; the renderer derives the Catwalk brightness from `catwalkCue` and `cueIndexPassed`.
- `dx3Phase0Frames` to `dx3Phase3Frames` are documentation only; the burst is driven by `burstCount`.
- The ray is not clipped at `endX`; the reference lists whether a floor point beyond the end wall is reachable as an open question.
