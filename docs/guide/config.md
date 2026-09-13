# Configuration and tuning

Every tuning number in the simulation lives in [config.ts](../../src/game/config.ts). Nothing else under `src/game` may contain a magic number. Each value came from the original's source listing unless it is marked `PLACEHOLDER` in a comment, and the reference note for its group says where it was read. The values are in the original's units: universe units for distances, Game Frames for durations, degrees for angles converted from the original's tics, and VG units for anything on screen.

## The groups

| Export | Consumed by | Reference |
|---|---|---|
| `IRQ_HZ`, `GAME_FRAME_IRQS`, `VG_FIELD_IRQS`, `DT`, `FIELDS_PER_FRAME` | `update.ts`, `main.ts`, tests | [Timing](./timing.md) |
| `PACE` | `pace.ts` | [Timing](./timing.md#pace-the-frame-period-by-screen) |
| `VG` | `projection.ts`, the renderer and camera, text layout | [Coordinates](./coordinates.md) |
| `CURSOR` | `cursor.ts` | [Coordinates](./coordinates.md#pot-units-and-the-cursor) |
| `AIM` | `dogfight/aim.ts`, the death roll | [Dogfight](./dogfight.md) |
| `DOGFIGHT` | `dogfight/index.ts`, `aliens.ts`, `view.ts` | [Dogfight rules](../reference/dogfight-rules.md) |
| `SURFACE` | `surface/*` | [Surface rules](../reference/surface-rules.md) |
| `TRENCH` | `trench/*` | [Trench rules](../reference/trench-rules.md) |
| `FIREBALL` | `dogfight/guns.ts`, the ground guns | [Dogfight rules](../reference/dogfight-rules.md) |
| `LASER` | `dogfight/lasers.ts`, hit tests everywhere | [Dogfight rules](../reference/dogfight-rules.md) |
| `DARTH` | `dogfight/aliens.ts` | [Dogfight rules](../reference/dogfight-rules.md) |
| `EXPLOSION` | `dogfight/explosions.ts` | [Dogfight shapes](../reference/shapes-dogfight.md) |
| `STARS` | `dogfight/stars.ts` | [Projection](../reference/projection.md) §5 |
| `OPTIONS` | `state.ts`, `update.ts`, the Trench's accounting | Atari's `SWOPTS.DOC` |
| `SHIELDS` | `guns.ts`, the Trench's accounting | |
| `SCORING` | every place points are awarded | The scoring page text |
| `SELECT` | `update.ts` | [Attract rules](../reference/attract-rules.md) |
| `ATTRACT` | `attract/*`, `main.ts` | [Attract rules](../reference/attract-rules.md) |
| `TIMING` | `update.ts` | |

## Operator options

`OPTIONS` holds the cabinet's DIP settings at the manufacturer's recommended values.

| Option | Value | Effect |
|---|---|---|
| `startingShields` | 7 | Deflector Shields at the start of a game, and the ceiling bonus shields cannot exceed. |
| `playDifficulty` | 1 (Moderate) | The base of `state.difficulty`; 0 Easy to 3 Hardest. |
| `bonusShieldsPerDeathStar` | 1 | Added in the Trench's next-wave accounting. |
| `attractMusicIntervalSeconds` | 420 | Not read; `ATTRACT.musicIntervalSeconds` (400) is the value in use. |

There is no settings screen. Changing an option means editing the constant, and the tests that assert on shields read it from here.

## Scoring

| Constant | Points |
|---|---|
| `tieFighter` | 1,000 |
| `darthsShip` | 2,000 |
| `laserBunker` | 200 |
| `laserTower` | 200, rising by `SURFACE.towerPointsStep` per Tower Top |
| `trenchTurret` | 100 |
| `fireball` | 33 |
| `exhaustPort` | 25,000 |
| `allTowerTops` | 50,000 |
| `waveSelectBonus` | 0, 200,000, 400,000, 600,000, 800,000 by starting wave, paid once at the first Death Star |
| `SHIELDS.endOfWaveBonusPerShield` | 5,000 per remaining shield |

Points are added in the stage modules and in `addPoints` in the Trench, which also sets `lastScore` and `lastScoreFade` for the fading amount under the score display.

## How a value is chosen

The comment on each constant says which of three sources it came from.

1. **The listing.** Most values are a constant or table entry from the 6809 source, converted to real units. The reference notes cite the file and label. When a comment says "converted", the original's number was a squared half-distance or a binary angle and the conversion is shown in the reference.
2. **Measurement.** The `PACE` values and the palette were measured, from MAME and then from a cabinet recording. The comment gives the measurement.
3. **Placeholder.** A value marked `PLACEHOLDER` has not been traced and was set by feel. None remain in `config.ts` today; the marker is the rule for any that are added.

A change to a listing-derived constant should come with a note of what was misread, so that the reference notes stay true. A change to a measured value should come with the measurement.

## Adding a constant

- Put it in the group that owns the behaviour, with a comment saying what it is, its unit and its source.
- Reference it from code by the group, `TRENCH.rayPerPot`, not by copying the number.
- If it changes difficulty or timing, run the tests: several assert the original's pacing, such as four shields lost in a passive wave 1 or the music cues at their frames.
