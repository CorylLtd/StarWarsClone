# Dogfight

The Dogfight is the first Stage of every Wave: Red Five sits still in open space while TIE Fighters and Darth's Ship fly Choreography around the ship, and the view swings itself to track them. The module lives in `src/game/dogfight/` and is pure simulation: no DOM, no Three.js, the original's units and frame (X forward, Y right, Z up). It owns the Dogfight's own state (`state.dogfight`) and the player pieces every Stage shares: the Cursor, the Lasers, the Deflector Shield accounting and the star field. `src/game/update.ts` calls `enterDogfight` when the Stage begins and `stepDogfightFrame` once per Game Frame; the module answers with mutated state and a list of `GameEvent` values that `main.ts` forwards to the renderer and the sound engine. The rules themselves are summarised here and spelled out in [Dogfight rules](../reference/dogfight-rules.md) and [Choreography](../reference/choreography.md).

## Files

| File | Owns | Original routines it mirrors |
|---|---|---|
| [index.ts](../../src/game/dogfight/index.ts) | `enterDogfight`, `stepDogfightFrame`, `stepDyingFrame`; the phase machine | `PHISP1`, `PHESP1`, `PHESP2`, `VEWHPA`, `PHES0D` |
| [aim.ts](../../src/game/dogfight/aim.ts) | Auto-aim: `stepView`, `chooseAimTarget`, `aimRates`, `deathStarRates`, `ticsFromRate` | `AIM`, `AIMA`, `AIMDTH`, `RHTRIG` |
| [cursor.ts](../../src/game/cursor.ts) | Yoke to Cursor: `stepCursor`, `hoodShift` | `RHCTRL`, `RHPOS` (the interrupt side) |
| [lasers.ts](../../src/game/dogfight/lasers.ts) | Trigger, bolt timing, hit resolution: `stepLaserTrigger`, `tickLaser`, `resolveLaser` | `TSTLAZ`, `CLSLZ` |
| [view.ts](../../src/game/dogfight/view.ts) | Projection of aliens and Fireballs to screen, hit boxes, status bits, impacts: `view` | `VIEW`, `S2VW`, `VWGUN` |
| [guns.ts](../../src/game/dogfight/guns.ts) | Fireballs and the Deflector Shield: `fireFireball`, `stepFireballs`, `hurtFireball`, `fireballImpact`, `shieldHit`, `loseShield` | `FRAGUN`, `MOVAM`, `GNHTSG`, `GNAHIT`, `DO1GAS` |
| [aliens.ts](../../src/game/dogfight/aliens.ts) | TIE Fighters and Darth's Ship: `spawnNextAlien`, `stepAliens`, `hitAlien`, `stepRetreat`, `addScore` | `CPU`, `CPUAL`, `ADASHP`, `CPHTSA`, `CPURET` |
| [scripts.ts](../../src/game/dogfight/scripts.ts) | The Choreography interpreter: `stepScript`, `startScript`, `ctFrames`, the `F` and `S` bit tables | `NWCHOR`, `CHNXT`, `CHTW.D/E`, `CHCN.D/E`, `CHIF.D` |
| [waves.ts](../../src/game/dogfight/waves.ts) | Wave Sets, level lists, start spots, the fire-rate table, `hardness` | `TSPWAV`, `WV.HRD` |
| [explosions.ts](../../src/game/dogfight/explosions.ts) | The three tumbling pieces of a destroyed TIE Fighter | `IXPLD`, `DOXPLD` |
| [stars.ts](../../src/game/dogfight/stars.ts) | The star field, shared with the Attract | `VWSTAR`, `SMVSP1`, `SMVHIS`, `SMVBNR`, `SMVINS`, `SMVSCR` |
| [choreography.ts](../../src/data/choreography.ts) | Data: `PROGRAM`, `ENTRY`, `START_SPOTS`, `LEVEL_LISTS`, `WAVE_SETS` | `TCH1A1` and the other script labels |

There is also a `src/game/stages/` directory with a `Stage` interface and an empty `enterDogfight`/`stepDogfight` pair. Nothing imports it. The live entry points are the ones in `src/game/dogfight/index.ts`, which `update.ts` imports as `./dogfight`.

## State

The module's state is the `Dogfight` interface in [types.ts](../../src/game/types.ts), created by `createDogfight` in [state.ts](../../src/game/state.ts). The whole `GameState` is described on the [Game state and modes](./state.md) page.

| Field | Meaning |
|---|---|
| `frame` | Game Frames since the Stage began. The original's `PH.TIM`. The Attract borrows it to drift the stars. |
| `phase` | `'fight'`, `'retreat'`, `'turn'` or `'zoom'`. |
| `level`, `listIndex` | Which level list of the Wave Set is being drawn from, and the position in it. |
| `liveCount` | Aliens alive; `WV.LIV`. |
| `aliens` | Three slots, each an `Alien` or `null`. |
| `fireballs` | Six gun slots, each a `Fireball` or `null`. |
| `explosions`, `munge` | Explosion pieces and the shared tumble matrix applied to all of them. |
| `stars` | Fifty `Star` positions in universe units. |
| `darthSeen` | Set true when the Retreat begins; nothing reads it. |
| `passbySlot` | The alien roaring past, for the passby sound. |
| `zoomScale`, `zoomStep` | The Approach zoom: the Death Star's scale value and its accelerating step. |
| `deathStarDir` | Unit vector to the Death Star, universe +X. |

The `Player` interface holds what the Dogfight shares with the other Stages: the view `basis`, `aimSlot` and `shakeCount` for auto-aim and the "I can't shake him" line, `rollFrames` and `rollDir` for the forced roll, the Cursor triple (`cursorTarget`, `cursorPot`, `cursor`), the Laser fields (`laserFrames`, `laserLeftPair`, `laserHit`, `laserAt`), and `flashFrames` and `gaugeFrames` for the Shield hit. `yawResidue` and `pitchResidue` exist on `Player` but nothing uses them.

Positions of aliens and space Fireballs are relative to the player, who does not move in the Dogfight. An alien's `pos` is therefore also the vector from the eye to it, and `scale(a.pos, -1)` is the player seen from the alien.

## Entering the Stage

`enterDogfight` in [index.ts](../../src/game/dogfight/index.ts) is called by `enterStage` in `update.ts`, which `beginWave` reaches from Death Star Select and `completeWave` reaches from the Trench. It resets every field above, sets `frame` to `DOGFIGHT.firstWaveStartFrame` (39) when `state.firstWave` is set and to 0 otherwise, sets `shakeCount` to 9 and `aimSlot` to 0, fills the three slots with `spawnNextAlien`, and calls `initStars`. It does not touch `player.basis`: `beginWave` and `completeWave` set it to `reversedBasis()` first, so the player starts facing away from the Death Star and the auto-aim has to swing the view round. Every alien spawns at a start spot with X = 31744 (`DOGFIGHT.spawnX`) with a reversed basis of its own, facing the player.

## One Game Frame

`stepDogfightFrame(state, input)` runs once per Game Frame and returns `true` when the Stage is over. In the `fight` phase it runs, in this order, the same order as the original's `PHESP1`:

1. `stepLaserTrigger`: a rising edge on `input.fire` starts a bolt; the bolt and hit-freeze counters tick.
2. `view(state, true)`: project every alien and Fireball, fill in hit boxes and status bits, resolve the bolt, apply Fireball impacts.
3. If `state.shields < 0` return `false`; `update.ts` sees the same value and switches to `dying`.
4. `stepFireballs`, `stepExplosions`; `gaugeFrames` and `flashFrames` count down.
5. `stepAliens`: every alien thinks, turns, moves and perhaps fires.
6. `stepView(state, chooseAimTarget(state))`: the forced roll and the auto-aim turn the view.
7. `stepStars`.
8. `frame += 1`, then the music cues and the phase timer.
9. If `liveCount < DOGFIGHT.alienSlots`, `spawnNextAlien` refills one slot. Only one per frame, and after `stepAliens`, so a freshly spawned alien is projected by `view` once before its script first runs.

Step 8 pushes `{ type: 'music', cue }` at `DOGFIGHT.musicCueFrames.theme` (40), `.themeB` (200) and `.descent` (400). The first cue is `'vader'` instead of `'theme'` when `state.wave >= 3 && state.wave % 2 === 1`, that is on displayed waves 4, 6, 8 and so on. When `frame` reaches `DOGFIGHT.lengthFrames` (420) the phase becomes `retreat`. The Dogfight is timed, not kill-limited.

Note that `stepLaserTrigger` and `view` come before `stepAliens`, so the bolt is judged against the positions the aliens reached in the previous frame's `stepAliens`, projected afresh this frame, before they move again. That matches the original.

## The phase machine

| Phase | What runs | Exit |
|---|---|---|
| `fight` | The full list above | `frame >= 420` → `retreat` (also sets `darthSeen`) |
| `retreat` | Trigger, `view`, Fireballs, explosions, `stepRetreat` instead of `stepAliens`, `stepView(state, null)`, stars | Every slot `null` → `turn`; pushes speech `"THIS IS RED FIVE, I'M GOING IN"` and sound `r2Yes` |
| `turn` | Trigger, `view`, Fireballs, explosions, `stepView(state, null)`, stars. No early return on `shields < 0`; `stepPlaying` in `update.ts` checks after the call anyway. | `dot(basis.fwd, deathStarDir) >= DOGFIGHT.approachFacingCos` → `zoom`; sets `zoomScale = DOGFIGHT.zoomStart`, `zoomStep = 0x100`, pushes sound `thrust` |
| `zoom` | `tickLaser` only (a bolt in flight burns out, none can start), stars, the scale step | `zoomScale <= DOGFIGHT.zoomEnd` → return `true` |

The Retreat (`CPURET`) is `stepRetreat` in [aliens.ts](../../src/game/dogfight/aliens.ts): each alien's Y and Z high bytes move toward zero by 2 and 3 per frame while their magnitude is at least 9, X advances by `DOGFIGHT.retreatSpeed` (1024) while it stays at or below 32767, and the alien is removed once X would overflow and both high bytes are within 8 of zero. Scripts do not run and nothing fires, but `view` still runs, so the player can still shoot a retreating ship. Glow and the thrown roll keep counting down.

During `turn` the auto-aim has no target, so `stepView` uses `deathStarRates` and the view turns to face +X. The cosine threshold `0x3f00 / 0x4000` is about ten degrees. In `zoom`, `zoomScale -= zoomStep >> 8` and `zoomStep += 0x60` each frame, from `7 * 128 + 127` down to `3 * 128 + 16`: about 57 frames of the Death Star swelling. The renderer reads `zoomScale` directly. When `stepDogfightFrame` returns `true`, `stepPlaying` in `update.ts` enters the Trench on `state.wave === 0` and the Surface otherwise.

`stepDyingFrame` is the fifth mode of the same file: while `state.mode === 'dying'` and the Stage is the Dogfight, `update.ts` calls it instead. It rolls the view by `AIM.deathRollDeg` (-4.48 degrees) a frame, keeps Fireballs, explosions and stars moving, and counts `frame`. After `TIMING.deathFrames` (40) `endGame` runs.

### Pace

The Game Frame period is not fixed. `framePeriod` in [pace.ts](../../src/game/pace.ts) returns `PACE.dogfightApproach` in `turn`, `PACE.dogfightFar` in `zoom`, and otherwise a period that rises from `PACE.dogfightFar` toward `PACE.dogfightNear` as the nearest alien grows, using each alien's `drawn.halfDistance` against `PACE.dogfightNearHalfDistance`. `step` in `update.ts` accumulates `DT / framePeriod(state)` every Field and runs a Game Frame when the debt reaches one. The Cursor slews every Field regardless. The [Timing](./timing.md) page covers the two clocks.

## The pieces

### Cursor

`stepCursor` in [cursor.ts](../../src/game/cursor.ts) runs from `update.step` every Field, in every mode, as the original's interrupt did. The Yoke deflection `input.x`, `input.y` in -1..1 becomes a target in pot units (times 127) clamped to the Cursor box `CURSOR.potLeft..potRight` (-112..112) and `potBottom..potTop` (-104..120). `cursorPot` slews toward it by `CURSOR.slewFar` (0x60/256) of the remaining distance when that distance is at least `CURSOR.slewFarFrom` (0x40) and `CURSOR.slewNear` (0x30/256) otherwise, moving at least one unit and never overshooting. `cursor` is the rounded pot times `CURSOR.potToScreen` (4), in VG units without the -104 vertical offset; the renderer adds `VG.offsetY` when it draws. `hoodShift` reports how far the drawn hood and gun tips slide with the Yoke; the renderer has its own copy of that arithmetic.

### Auto-aim

The Yoke does not turn the view in the Dogfight. `stepView` in [aim.ts](../../src/game/dogfight/aim.ts) does. Each frame it first applies the forced roll if `rollFrames > 0` (`rollDir * AIM.hitRollDeg` a frame), then computes yaw and pitch rates for the target and turns the basis by `ticsFromRate(rate) * AIM.ticDeg` degrees, one tic being 360/5632 degrees. Yaw is applied with the sign flipped because a positive yaw rate means turn left in the original.

`aimRates(rel)` is `AIMA`: the target's position in the player's frame is halved to 16 bits, then all three components are doubled together until the forward value would overflow past 0x4000, or, when the target is behind, until the lateral values would. The rates are the high bytes of the shifted Y (one's complement, for yaw) and Z (for pitch). `deathStarRates(dir)` is `AIMDTH`, working from the unit direction scaled to 0x4000, with the rates folded through 0x7f when the Death Star is behind. `ticsFromRate` is `RHTRIG`: the rate clamped to -128..127, halved with one's complement for negatives. The comment in `stepView` explains why the turn per frame is simply half the rate: the original's displayed view was the master matrix plus a residue, and the residue's growth per frame is that.

`chooseAimTarget` picks the tracked slot: scanning from `player.aimSlot` upward, the first live alien whose `glow` is zero. Moving to a different slot resets `shakeCount` to 9. If none is found, `aimSlot` goes back to 0 and the function returns `null`, which `stepView` reads as "aim at `deathStarDir`". Because the scan starts at the current slot it never looks at lower slots until the fallback resets it.

### Lasers

`stepLaserTrigger` in [lasers.ts](../../src/game/dogfight/lasers.ts) compares `input.fire` with `state.fireHeld`. On a rising edge it toggles `laserLeftPair`, clears `laserHit`, sets `laserFrames = LASER.boltFrames` (8), and pushes `laserFired` and the `laser` sound. It then calls `tickLaser`, which is the per-frame part of `TSTLAZ`: a hit freeze (`laserHit > 0`) counts down and forces `laserFrames` to 0; otherwise a live bolt counts down and latches `laserAt` from the Cursor, so the bolt follows the Cursor while it lasts. `laserOn` is exported but unused, and its second clause is `&& false`.

`resolveLaser` is `CLSLZ`. It runs inside `view` once the screen positions are known and does nothing when no bolt is live or a freeze is running. It finds the nearest alien whose `drawn.at` lies within an octagon of `drawn.hitSize` around `laserAt` (`withinOctagon` in [projection.ts](../../src/game/projection.ts), factor `LASER.octagonFactor`), and the nearest live Fireball with a box of `512 * 80 / halfDistance + LASER.hitPad`. Distance is compared as `halfDistance`, the original's halved forward value. A Fireball wins if it is closer; otherwise the alien is hit. Either sets `laserHit = LASER.hitFreezeFrames` (4). There is no 3-D ray test.

### View and hit boxes

`view` in [view.ts](../../src/game/dogfight/view.ts) is the original's `VIEW`. For each alien it calls `projectRelative(a.pos, player.basis)`, which returns `null` outside the 90 degree cone or too close (`inCone`). It sets `status.inView`, `status.playerNear` (real distance at most `DOGFIGHT.nearDistance`) and `status.playerMid` (at most `DOGFIGHT.midDistance`). A projected alien gets `drawn = { at, halfDistance, hitSize }` where `hitSize` is `hitSize(view.x, LASER.hitRadius, LASER.hitPad)`: a 160 unit sphere projected, plus 10 screen units. `status.playerAimingAtMe` (the original's `C$PS`) is the Cursor within three times that box, measured as `|dx| + |dy|`. An alien within `DOGFIGHT.passbyDistance` becomes `passbySlot` and pushes `{ type: 'passby', receding: false }`; the slot clears when it moves away or dies.

For Fireballs: a `glow` shot is skipped; a `hurt` shot keeps turning with the view and is merely not drawn when out of view; a `live` shot out of view is removed (`VWGUN` discards live shots). A live shot with forward value at most `FIREBALL.impactDistance` (784) whose screen position lies inside the Cursor box (`CURSOR.pot*` times `potToScreen`) is marked `impacting`. Then `resolveLaser` runs if `lasersActive`, and finally every still-live impacting shot goes to `fireballImpact`. Ordering the Laser first means a shot under the Cursor on the frame it reaches the windshield is shot down rather than felt.

### Guns and Fireballs

`Fireball` in `types.ts` has a `kind` (`live`, `hurt`, `glow`), a `mover` (`home` in space), `pos`, `timer`, the remembered screen `at` and `halfDistance`, and the `impacting` flag. In [guns.ts](../../src/game/dogfight/guns.ts):

- `freeGunSlots(state, usable)` returns a free index among the last `usable` of the six slots, or -1.
- `fireFireball(state, from, slot, gun)` places a live homing shot at the alien's position with `FIREBALL.lifeFrames` (64) and pushes `alienFired` and the `tieCannon` sound. If the firing alien is the tracked `aimSlot`, `shakeCount` drops, and at 0 the speech `"I CAN'T SHAKE HIM"` is pushed.
- `stepFireballs` ticks every timer and scales a live homing shot's position by `FIREBALL.homing` (7/8) each frame, rounded, so it closes on the eye exponentially (`MOVAM`). Expired shots are nulled.
- `hurtFireball` (`GNHTSG`) turns a shot into `hurt` for `FIREBALL.hurtFrames`, scores `SCORING.fireball` (33) and pushes `laserHitFireball` with the `cannonStop` and `shotDestroyed` sounds.
- `fireballImpact` (`GNAHIT`) turns it into `glow` for `FIREBALL.glowFrames` and calls `shieldHit`.

### Deflector Shields

`shieldHit` pushes `shieldHit` and its sound, starts a 32 frame forced roll (direction from the low bit of `rng.seed` unless one is already running), and then, only if `gaugeFrames` is 0, sets `flashFrames`, speaks the first-hit line when more than three Shields remain, and calls `loseShield`. The roll happens even when the gauge blocks the loss, as `GNAHIT` did. `loseShield` is `DO1GAS`: with `shields <= 0` it sets `shields = -1` and returns, and the next frame's check ends the game; otherwise it decrements, sets `gaugeFrames = 10 + old` (the window in which a second loss is refused), pushes `shieldLost` with the remaining count, and speaks at 2, 1 and 0. The `SHIELDS` block in config records `lossWindowBase` and `levelVoiceAt`, but `guns.ts` uses the literals 10, 2, 1 and 0 rather than reading them; only `SHIELDS.endOfWaveBonusPerShield` is read, and that is in the Trench. Details are in [Dogfight rules, section 8](../reference/dogfight-rules.md).

### Aliens

`Alien` carries `kind`, `pos`, `basis`, `vel`, `hitsLeft`, `glow`, `rollFrames`, `status`, `script`, `drawn` and `damage`. `makeAlien` in [aliens.ts](../../src/game/dogfight/aliens.ts) builds one from a `SpawnEntry` with a reversed basis and `startScript(entry.script)`. `spawnNextAlien` fills the first `null` slot from the Wave Set's current level list, advancing `level` when a list is exhausted and holding on the last list forever, which is how `TWV2Z` repeats until the clock runs out.

`stepAliens` calls `stepAlien` for each slot, the original's `CPU`:

1. Clear `hit` and `fired`; draw `random1` and `random2` from the seeded generator.
2. Compute the player in the alien's frame: `playerAhead` (in front and closer than 32768) and `playerInSights` (ahead and within a 1448 unit lateral radius).
3. Count down `glow`.
4. `stepScript(a.script, statusBits(status))`, leaving this frame's flags in `script.flags`.
5. If `rollFrames > 0` (thrown after a hit) roll by `DARTH.rollDeg` and skip the script's turns; otherwise apply `RL`, `RR`, `PU`, `PD`, `YR`, `YL`, each one `DOGFIGHT.turnDeg` (4.48 degrees) about the alien's own axes, noting which axes the script turned.
6. Unless glowing, `vel = velocityFromFlags`: `MF`/`MF2` add `DOGFIGHT.speed[0]`/`[1]` along the alien's forward axis, `MU`/`MU2` and `MD`/`MD2` along and against its up axis; both bits set give 768.
7. If `T0`, `aimAtPlayer` yaws and pitches one step toward the player, or toward a point 4096 units ahead of the player when `T9` is also set, unless the script already yawed or pitched this frame; each turn may add a roll, chosen by the sign relationship of the target's side and height, unless the script rolled. The dead zone is the original's one high byte on halved coordinates.
8. `pos += vel`, each component clamped to `DOGFIGHT.positionClamp`.
9. `maybeFire`.

`maybeFire` refuses when the alien is out of view, when `T9` is set, when the real distance is at most `DOGFIGHT.minFireDistance`, or while glowing. It then takes `fireRow(hardness(state.wave, state.difficulty))`: the frame counter masked by `row.mask` must be zero, a random byte must exceed `row.prob`, and `freeGunSlots(state, row.guns)` must find a slot. Success sets `status.fired` for the script to test.

`hitAlien(state, slot, halfDistance)` is `CPHTSA`. It ignores a glowing alien. A TIE Fighter whose `hitsLeft` reaches 0 spawns an explosion, empties the slot, scores `SCORING.tieFighter` and pushes `laserHitAlien` with `destroyed: true` plus the `explosion` sound. Darth's Ship is never destroyed: each hit sets `hitsLeft` back to `DARTH.hitPoints + 1`, starts `DARTH.glowFrames` of glow and forced roll, throws it away along the player's forward axis by `DARTH.thrownForward - halfDistance` with random side and lift of 128..255, scores `SCORING.darthsShip` and pushes `laserHitAlien` with `destroyed: false`. `addScore` updates `score`, `lastScore`, `lastScoreFade` and `highScore`.

### Choreography scripts

[scripts.ts](../../src/game/dogfight/scripts.ts) is the interpreter; the program is data in [choreography.ts](../../src/data/choreography.ts). `PROGRAM` is one flat array of `RomOp` for every script, with `goto` and `gosub` targets as indices into it, and `ENTRY` maps the original's labels (`TCH1A1`, `TCH2D3`, `SPLIT`, `TCH1DZ` and so on) to entry indices. `compile` turns the named flags and status bits into masks, giving `SCRIPT_PROGRAM`.

Ops, with the original macros they came from:

| Op | Fields | Original | Meaning |
|---|---|---|---|
| `ct` | `frames`, `flags` | `.CT` | Hold these twirl and move flags for `frames` Game Frames |
| `until` | `mask` | `.CUNTIL` | Install a status mask; while it is set, any matching bit abandons the running op |
| `if` | `mask` | `.CIF` | Continue if any masked bit is set, otherwise skip to the next `if` |
| `goto` | `target` | `.CGOTO` | Jump |
| `gosub` | `target` | | Jump with a single return slot |
| `return` | | | Return to it, or stop if there is none |

`ctFrames(byte)` decodes the original's `.CT` time byte as the reference derives it: the byte clamped at 0x73, then high nibble times 16 plus low nibble times 4 plus 3. The data already holds decoded frame counts.

`stepScript(r, status, program)` runs once per alien per frame. If `untilMask` matches `status`, the timer is cleared and `pc` moves to the next `until` op, which installs its own mask when decoded. Otherwise a running timer counts down and the function returns. Then it decodes until a `ct` is reached, at most 128 ops: `ct` sets `flags` and `timer = frames - 1`; `until` installs its mask and continues; `if` advances and, on no match with a non-empty mask, skips to the next `if`, which is evaluated in turn; `goto`, `gosub` and `return` move `pc`. So a `ct` op's flags are applied on `frames` consecutive frames counting the decode frame. The semantics are the reference's [section 3](../reference/choreography.md).

The flag bits in `F` are this project's own layout, not the original's byte values:

| Flag | Bit | Effect |
|---|---|---|
| `MF`, `MF2` | 0, 1 | Forward 256, 512; both bits 768 (`MF3`) |
| `MU`, `MU2` | 2, 3 | Up along own up axis |
| `MD`, `MD2` | 4, 5 | Down |
| `RL`, `RR` | 6, 7 | Roll left, right |
| `PU`, `PD` | 8, 9 | Pitch up, down |
| `YL`, `YR` | 10, 11 | Yaw left, right |
| `T0` | 12 | Aim at the player (`C$T0`) |
| `T9` | 13 | Aim 4096 units ahead of the player; suppresses firing (`C$T9`) |

The status bits in `S` keep the original's `A$CHST` values:

| Bit | Value | Original | Set by |
|---|---|---|---|
| `hit` | 0x0001 | `C$AH` | `hitAlien` |
| `damaged` | 0x0002 | `C$AD` | Never set; `statusBits` ignores it as the original did |
| `playerInSights` | 0x0004 | `C$AS` | `stepAlien` |
| `playerAhead` | 0x0008 | `C$AV` | `stepAlien` |
| `random1`, `random2` | 0x0010, 0x0020 | `C$R1`, `C$R2` | `stepAlien`, each frame |
| `fired` | 0x0040 | `C$AG` | `maybeFire` |
| `playerNear` | 0x0400 | `C$PN` | `view` |
| `playerAimingAtMe` | 0x0800 | `C$PS` | `view` |
| `inView` | 0x1000 | `C$PV` | `view`, and it persists from the last `view` into `stepAlien` |
| `playerMid` | 0x2000 | `C$PM` | `view` |

`ScriptState` is `{ pc, timer, untilMask, returnPc, flags }`.

### Waves

[waves.ts](../../src/game/dogfight/waves.ts) joins the data to the spawner. `levelList(name)` resolves `LEVEL_LISTS[name]` to `SpawnEntry` values `{ kind, spot, script }` with the spot looked up in `START_SPOTS`. `waveSet(wave)` returns `WAVE_SETS[wave]` for the first six waves (wave 0 is displayed Wave 1) and alternates the last two sets after that, even waves taking index 4 and odd index 5, with `wave` clamped at 31. `hardness(wave, difficulty)` is `WV.HRD`: `min(15, min(wave, 31) + difficulty)`, where `state.difficulty` already includes the per-wave bump added by `completeWave`. `FIRE_TABLE` has eleven rows indexed by Hardness, each `{ mask, prob, guns }`; `fireRow` clamps to the last. The lists themselves are summarised in [Choreography, section 8](../reference/choreography.md).

### Explosions

`spawnExplosion` in [explosions.ts](../../src/game/dogfight/explosions.ts) queues three `ExplosionPiece` values for a destroyed TIE Fighter: the port and starboard wings, offset by `EXPLOSION.wingOffset` along the ship's right axis with the ship's velocity plus that offset for `EXPLOSION.wingFrames`, and the cabin, drifting away from the player at about 2048 units a frame (`32767 / 16`) with a random forward jitter for `EXPLOSION.cabinFrames`. The queue holds `EXPLOSION.queueSize` pieces; the oldest is dropped. `stepExplosions` rolls and pitches the shared `munge` basis by `EXPLOSION.mungeRollDeg` and `mungePitchDeg` each frame, moves every piece, and drops pieces that expire or leave the cone. With no pieces, `munge` is reset to the identity. The renderer orients every piece by `munge`.

### Stars

[stars.ts](../../src/game/dogfight/stars.ts) keeps `STARS.count` (50) stars in universe units. The viewer does not move, so parallax comes from a drift: `driftWorld` is `dogfight.frame * STARS.driftPerFrame` along +X in the Dogfight, and along a per-screen direction in the viewer's body axes in the Attract (`ATTRACT_DRIFT`, after `SMVHIS`, `SMVBNR`, `SMVINS`, `SMVSCR`). `stepStars` transforms each star into the view frame minus the drift; a star whose half-distance leaves `(STARS.minHalfDistance, STARS.maxHalfDistance]` or leaves the cone is reborn ahead on the opposite side. `visibleStars` returns screen positions for the renderer, `512 * y / x` and `512 * z / x`. The Attract and the Trench (`src/game/trench/index.ts`) call `initStars` and `stepStars` too, which is why `stepAttractFrame` increments `state.dogfight.frame`: the drift is keyed to it.

## Configuration

Everything numeric comes from [config.ts](../../src/game/config.ts). Values are from the original's listing unless marked otherwise there.

| Group | Key | Value | Read by |
|---|---|---|---|
| `DOGFIGHT` | `lengthFrames` | 420 | `stepDogfightFrame` |
| | `firstWaveStartFrame` | 39 | `enterDogfight` |
| | `musicCueFrames` | theme 40, themeB 200, descent 400 | `stepDogfightFrame` |
| | `alienSlots` | 3 | `enterDogfight`, `stepDogfightFrame` |
| | `speed` | [256, 512, 768] | `velocityFromFlags` (first two) |
| | `turnDeg` | 4.48 | `stepAlien`, `aimAtPlayer` |
| | `positionClamp` | 32000 | `stepAlien` |
| | `minFireDistance` | 4096 | `maybeFire` |
| | `nearDistance`, `midDistance`, `passbyDistance` | 4096, 12288, 3238 | `view` |
| | `retreatSpeed` | 1024 | `stepRetreat` |
| | `approachFacingCos` | 0x3f00 / 0x4000 | `turn` phase |
| | `zoomStart`, `zoomEnd` | 1023, 400 | `zoom` phase |
| `AIM` | `ticDeg` | 360 / 5632 | `stepView` |
| | `hitRollDeg`, `deathRollDeg` | 4.48, -4.48 | `stepView`, `stepDyingFrame` |
| `LASER` | `boltFrames`, `hitFreezeFrames` | 8, 4 | `lasers.ts` |
| | `hitRadius`, `hitPad`, `octagonFactor` | 160, 10, 1.5 | `view`, `resolveLaser` |
| | `guns` | four gun tip positions | The renderer |
| `FIREBALL` | `lifeFrames`, `homing`, `impactDistance` | 64, 7/8, 784 | `guns.ts`, `view` |
| | `glowFrames`, `hurtFrames`, `screenFlashFrames` | 15, 15, 16 | `guns.ts` |
| `DARTH` | `hitPoints`, `glowFrames`, `rollDeg`, `thrownForward` | 4, 31, 20.34, 0x4000 | `makeAlien`, `hitAlien`, `stepAlien` |
| `EXPLOSION` | `wingFrames`, `cabinFrames`, `queueSize` | 24, 16, 8 | `explosions.ts` |
| | `mungeRollDeg`, `mungePitchDeg`, `wingOffset` | 19.04, 4.99, 256 | `explosions.ts` |
| `STARS` | `count`, `minHalfDistance`, `maxHalfDistance`, `driftPerFrame` | 50, 0x100, 0xfff, 128 | `stars.ts` |
| `CURSOR` | `pot*`, `potToScreen`, `slew*` | see file | `cursor.ts`, `view` |
| `SCORING` | `tieFighter`, `darthsShip`, `fireball` | 1000, 2000, 33 | `hitAlien`, `hurtFireball` |
| `PACE` | `dogfightFar`, `dogfightNear`, `dogfightNearHalfDistance`, `dogfightApproach` | 0.05, 0.1, 2500, 0.091 | `framePeriod` |

Several keys in these groups are documentation only: `AIM.bigStepTics`, `smallStepTics`, `bigStepDeg`, `smallStepDeg`, `residueMax` and `hitRollFrames`; `DOGFIGHT.gunSlots`, `retreatConvergeY`, `retreatConvergeZ` and `retreatConvergeUntil`; `SHIELDS.lossWindowBase` and `levelVoiceAt`; `STARS.brightness`. Where they have a counterpart in code it is a literal (`p.rollFrames = 32`, the 2 and 3 in `stepRetreat`, `10 + old` in `loseShield`).

## Events

Every event is a `GameEvent` from `types.ts`, pushed onto `state.events`, which `update.step` clears at the start of every Field.

| Event | Pushed by | When |
|---|---|---|
| `laserFired`, `sound laser` | `stepLaserTrigger` | Trigger rising edge |
| `laserHitAlien { kind, destroyed }`, `sound explosion` | `hitAlien` | Bolt lands on an alien |
| `laserHitFireball`, `sound cannonStop`, `sound shotDestroyed` | `hurtFireball` | Bolt lands on a Fireball |
| `alienFired`, `sound tieCannon` | `fireFireball` | An alien fires |
| `speech "I CAN'T SHAKE HIM"` | `fireFireball` | The tracked alien's ninth shot |
| `shieldHit`, `sound shieldHit` | `shieldHit` | Fireball impact |
| `speech "I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT"`, `sound r2Sad` | `shieldHit` | First impact of the game with more than three Shields |
| `shieldLost { remaining }` | `loseShield` | A Shield is lost |
| `speech "R2, TRY AND INCREASE THE POWER"`, `sound r2Down` | `loseShield` | Two Shields left |
| `sound r2C` | `loseShield` | One left |
| `speech "I'VE LOST R2"`, `sound r2Dead` | `loseShield` | None left |
| `passby { receding: false }` | `view` | An alien comes within `passbyDistance`. The receding form is never pushed. |
| `music theme` or `vader`, `themeB`, `descent` | `stepDogfightFrame` | Frames 40, 200, 400 |
| `speech "THIS IS RED FIVE, I'M GOING IN"`, `sound r2Yes` | `stepDogfightFrame` | Retreat complete |
| `sound thrust` | `stepDogfightFrame` | Zoom begins |

`update.ts` adds `stageStarted`, `waveSelected`, `waveCompleted` and `playerDied` around the Stage.

## Tests

The tests are Vitest files beside the code and drive the simulation through [testUtils.ts](../../src/game/testUtils.ts): `dogfightState(seed, wave)` builds a state already in the Dogfight, `runFields` steps Fields, `runFrame` steps Fields until one Game Frame has run (how many depends on the pace), `runFrames` repeats that, `pressFire` presses for a frame and releases for one, and `runFramesInvulnerable` tops the Shields up every frame so flow tests outlive the Fireballs. All return the events raised.

- [aim.test.ts](../../src/game/dogfight/aim.test.ts): `aimRates` signs for targets right, left, above, below and behind; `ticsFromRate` halves and keeps the sign; `stepView` converges on a fixed target within 60 frames and swings round from a reversed basis within 80; with no target the view settles on +X and `deathStarRates` has the right signs.
- [combat.test.ts](../../src/game/dogfight/combat.test.ts): a `faceOff` helper parks one alien straight ahead with its script timer frozen. A TIE Fighter under the Cursor is destroyed by one press, scores 1,000, is replaced in the same frame, leaves three explosion pieces and starts the four frame freeze; one off to the side is missed; Darth's Ship glows, is untouchable while glowing, and scores 2,000 per hit without dying; explosion pieces expire within 30 frames; a Fireball under the Cursor is shot down for 33 and becomes `hurt`; an unanswered Fireball costs a Shield and starts the roll.
- [scripts.test.ts](../../src/game/dogfight/scripts.test.ts): `ctFrames` against the reference's worked examples; the interpreter on a hand-built program (timed holds, `until` skips, `if` fallthrough, `gosub` and `return`, `goto` loops); the real program has every entry and jump in range; `TCH1A1` flies `MF` for 67 frames then `MF2`; every script survives a thousand frames of random status bits.
- [update.test.ts](../../src/game/update.test.ts) covers the flow from outside: three aliens and the 39 frame head start on the first wave, the reversed start and the swing round, the clock ending the fight and the Retreat leading to `turn` or `zoom`, Wave 1 going to the Trench and later waves to the Surface, the music cue frames, bolts burning out during `turn` and `zoom`, the eight frame bolt alternating gun pairs, the gauge window, and the Cursor slew and clamp.

Run them with `npm test`.

## Things to know before changing it

- The player never moves. Alien and Fireball positions are relative to the eye, and every projection goes through `player.basis` alone.
- The order inside `stepDogfightFrame` matters for hit detection and for a fresh alien's first script frame. Keep new work in the slot the original's `PHESP1` gives it.
- `darthSeen` is set but never read. Darth's speech line is not raised by this module.
- The `passby` check in `view` tests `!d.passbySlot`, which is true for slot 0 as well as `null`, so a second alien can take over the passby while slot 0 is still near.
- `src/game/stages/` is an unused skeleton. Edit `src/game/dogfight/index.ts`.
- Score, Shield and Hardness values reach the module through `state`, not through arguments; tests set them directly on the state.
