# Attract and Initials Entry

The Attract is what the cabinet shows when no game is in progress: the High Score Table, the Banner with its receding logo and Storyline, the flight instructions page and the scoring page, round and round on the original's clock. Initials Entry is the screen a qualifying score lands on after a game. Both live in `src/game/attract/` and are pure simulation: they time the screens, move the Storyline and the stars, and keep the High Score Table; drawing is the renderer's job (`src/render/attractView.ts`), from data in `src/data/`. The mode switches around them, the Death Star Select screen and the game's start and end, live in [update.ts](../../src/game/update.ts). The original's behaviour is written up in [Attract rules](../reference/attract-rules.md) and, for the select screen, [Dogfight rules, section 1](../reference/dogfight-rules.md).

## Files

| File | Owns | Original routines it mirrors |
|---|---|---|
| [attract/index.ts](../../src/game/attract/index.ts) | `enterAttract`, `stepAttractFrame`, `storyLineScale`; the Banner and Storyline mechanics; attract music | `PHIHIS`/`PHEHIS`, `PHIBNR`, `PHIINS`, `PHISCR`, `BGBNNR`, `SPMESS`, `TSPMAL` |
| [attract/highScores.ts](../../src/game/attract/highScores.ts) | `qualifyingRow`, `insertRow`, `beginInitials`, `hoveredItem`, `stepInitialsFrame` | `UPDATE`, `PUTHI`, `PHIENT`/`PHEENT`, `GETINT` |
| [update.ts](../../src/game/update.ts) | `step`, `startGame`, `selectTarget`, `stepSelect`, `beginWave`, `endGame`, `enterAttractMode` | `STRTCK`, `PHESG1`, `PHISDS`/`PHESDS`, `PHIEGM`/`PHEEGM` |
| [data/attract.ts](../../src/data/attract.ts) | Texts, positions and colours of every Attract and Initials Entry message; `STORYLINE`; `HIGH_SCORE_DEFAULTS`; `INITIALS_ALPHABET`; `COIN_TEXT` | `TCMES.MAC` message tables, `TCHSCR.MAC` defaults |
| [data/logo.ts](../../src/data/logo.ts) | `LOGO` strokes and `LOGO_VANISHING_POINT` | `VJSW*` in `WSVROM.MAC` |
| [data/hud.ts](../../src/data/hud.ts) | `HUD_TEXT` (the SCORE and WAVE labels every Attract screen shows), the vector `FONT` | `VGTITL` |
| [main.ts](../../src/main.ts) | Loading and saving the persisted rows in `localStorage` | The NVRAM top three |

## Modes

`GameState.mode` is one of `'attract'`, `'select'`, `'playing'`, `'dying'` and `'initials'` (see [Game state and modes](./state.md)). `step` in `update.ts` runs once per Field: it clears `state.events`, slews the Cursor, latches any fire press into `fireLatch`, and runs `stepFrame` when the current screen's frame period has elapsed (`framePeriod` in [pace.ts](../../src/game/pace.ts): `PACE.attract[phase]`, `PACE.select`, `PACE.initials`, `PACE.dying`). `stepFrame` dispatches on the mode:

| Mode | Each Game Frame | Leaves by |
|---|---|---|
| `attract` | `stepAttractFrame`, then a fire rising edge calls `startGame` | `startGame` → `select` |
| `select` | `stepSelect` | A shot on a Death Star or the countdown → `beginWave` → `playing` |
| `playing` | `stepPlaying` (the Stages) | `shields < 0` → `dying` |
| `dying` | `stepDyingFrame` in the Dogfight; nothing in the other Stages | `modeFrames >= TIMING.deathFrames` (40) → `endGame` |
| `initials` | `stepInitialsFrame` | Returns `true` → `enterAttractMode(state, 'highScores')` |

`setMode` records the new mode and zeroes `modeFrames`. Every transition into a mode that reads the trigger sets `state.fireHeld = true`, so the press that caused the transition cannot also count as the next one.

## The Attract cycle

The state is `state.attract`, an `Attract` from [types.ts](../../src/game/types.ts): `phase`, `frame` (frames into the phase, counting up where the original's `PH.TIM` counted down), `storyScale` (eight linear scales, -1 for not started), `racing` (which Storyline line is racing away), `musicClock` and `lastWaveDisplayed`.

`enterAttract(state, phase)` sets the phase, zeroes `frame`, resets `storyScale` and `racing`, puts `player.basis` back to `reversedBasis()`, zeroes `state.dogfight.frame` and calls `initStars`. The star field is the Dogfight's module ([stars.ts](../../src/game/dogfight/stars.ts)); the Attract borrows `player.basis` as the viewer and `dogfight.frame` as the drift clock. If the phase is `banner` it also calls `startBanner` for the music check.

`stepAttractFrame` increments `frame`, `musicClock` and `dogfight.frame`, calls `stepStars`, and then times the phase. `next` moves along `PHASE_ORDER`, which is `['highScores', 'banner', 'instructions', 'scoring']`, wrapping round.

| Phase | Length in Game Frames | Frame period (`PACE.attract`) | About | Stars drift (body axes) |
|---|---|---|---|---|
| `highScores` | `ATTRACT.highScoresFrames` = 256 | 0.0735 s | 18.8 s | forward, `SMVHIS` |
| `banner` | `ATTRACT.bannerFrames` = 512 | 0.0586 s | 30.0 s | forward and up, `SMVBNR` |
| `instructions` | `ATTRACT.pageFrames` = 434 | 0.062 s | 26.9 s | sideways, `SMVINS` |
| `scoring` | `ATTRACT.pageFrames` = 434 | 0.025 s | 10.9 s | up, `SMVSCR` |

The frame counts are the original's; the periods were measured in MAME and from a cabinet recording, as the comments on `PACE` in [config.ts](../../src/game/config.ts) say. After power-up the cycle starts at `highScores` (`createInitialState`), after Initials Entry at `highScores`, and after a game that did not qualify at `banner`.

There is no demo game. The renderer draws the SCORE and WAVE labels, the score (`state.score`, still the last game's), `attract.lastWaveDisplayed` and the coin lines over every screen from `HUD_TEXT` and `COIN_TEXT`. `state.credits` is 1 and never changes: free play.

### Attract music

`startBanner` is the attract-music check the original ran at every banner start. `TUNES` lists nine cue names (`ben`, `cantina`, `end`, `rebelRepeats`, `themeB`, `theme`, `rebel`, `fourths`, `vader`). When `musicClock` has reached `ATTRACT.musicIntervalSeconds * (IRQ_HZ / VG_FIELD_IRQS / FIELDS_PER_FRAME)`, that is 400 seconds at the nominal 21 Game Frames a second, or 8400 frames, one is chosen with `nextFloat` and pushed as `{ type: 'music', cue }`, and the clock resets. `musicClock` counts only in `stepAttractFrame`, so time spent playing does not count, and because the Attract screens run slower than 21 frames a second the real interval is nearer seven and a half minutes of Attract. `OPTIONS.attractMusicIntervalSeconds` exists in config but this code reads `ATTRACT.musicIntervalSeconds`.

### The Banner and the Storyline

The Banner is 512 frames. The logo's motion is entirely the renderer's, keyed to `attract.frame` and the `ATTRACT.logo*` constants: fixed at `logoFixedScale` until `logoFixedUntil` (64) while its brightness ramps, then receding with the frame count until `logoGoneAt` (248). `LOGO` in [logo.ts](../../src/data/logo.ts) is a list of strokes with an `intensity` of 1 to 7 and points in picture units relative to `LOGO_VANISHING_POINT`, (0, 408); the low-intensity vertical strokes are the drop lines that give the letters their extruded look.

The Storyline is the simulation's, in `stepBanner`. Each of the eight lines has a linear scale in `storyScale[i]`: -1 before it starts, 0 when it appears at its largest, growing as it recedes, and `ATTRACT.storyGoneAt` (240) once it has gone. The mechanics, from `SPMESS` and `TSPMAL`:

1. A line starts at its alarm frame (65, 80, 96, 112, 128, 144, 160, 184) with scale 0.
2. From frame 64 until `ATTRACT.storyGrowUntil` (224) every started line grows by 1 a frame.
3. From 224 until `ATTRACT.storyHoldUntil` (352) nothing moves: the hold for reading.
4. From 352 the lines resume at 1 a frame, and the line indexed by `racing` (starting at 0) moves by `ATTRACT.storyRaceStep` (4). When the racing line reaches 240 it is clamped there and `racing` moves to the next line, so the lines vanish one after another.

`storyLineScale(state, i)` is the query the renderer uses: the scale, or -1 when the line is not shown. The renderer turns it into a size factor `2 * (256 - scale) / 256`, places the line at `LOGO_VANISHING_POINT` plus `STORYLINE[i].x` and `ATTRACT.storyOffsetY` times that factor, and dims it with the scale. Note that the alarm frames are a literal array inside `stepBanner` and are repeated as `start` in `STORYLINE` in [data/attract.ts](../../src/data/attract.ts); change both together. `ATTRACT.storyVanishingY` duplicates the vanishing point and is unused.

### Instructions and scoring pages

The simulation only times these two pages; `stepAttractFrame` has nothing to do for them beyond the 434 frame limit. The reveal and fade are the renderer's from `ATTRACT.pageRevealFrames` (320), `pageLineEvery` (8), `highScoresFadeFrames` (80), `scoringScroll` (960) and `scoringScrollPerFrame` (8), with the texts in `INSTRUCTIONS` and `SCORING_PAGE`. `INSTRUCTIONS_DIGIT` is where the Starting Shields digit (`OPTIONS.startingShields`) is drawn into the fourth line's gap.

### The High Score Table screen

Timed by `ATTRACT.highScoresFrames`. The renderer draws `COPYRIGHT`, `HIGH_SCORE_TITLE` and the ten rows of `state.highScores` at `HIGH_SCORE_ROWS_Y`. The rows come from `HIGH_SCORE_DEFAULTS` through `defaultHighScores` in [state.ts](../../src/game/state.ts) unless `main.ts` loaded saved ones (see Persistence).

## Starting a game

In the `attract` case of `stepFrame`, `input.fire && !state.fireHeld` calls `startGame`. The input reaching `stepFrame` has `fire` replaced by `state.fireLatch`, which `step` sets on any Field since the last Game Frame, so a press shorter than a frame period still starts a game. `startGame` (`PHESG1`) resets the score and its fade, `wave` to 0, `difficulty` to `OPTIONS.playDifficulty` with a zero `difficultyBump`, `firstWave` and `firstShieldHitDone`, `shields` to `OPTIONS.startingShields`, replaces `player` and `dogfight` with fresh records (which recentres the Cursor), sets `selectFrames = SELECT.countdownFrames`, switches to `select`, and pushes `gameStarted` and the speech `"RED FIVE STANDING BY"`. `highScores`, `highScore` and `attract.lastWaveDisplayed` are left alone.

## Death Star Select

`stepSelect` counts `selectFrames` down from `SELECT.countdownFrames` (256) and calls `beginWave` with the chosen wave on a trigger rising edge while `selectTarget` is over a miniature, or with 0 when the countdown expires. `selectTarget` compares the Cursor with the three `SELECT.positions`: the Cursor's Y is shifted by the literal 104 (the `VGOFFY` vanishing-point offset, `VG.offsetY` in config), and a miniature is hit when `dx < SELECT.hitDx` (52), `dy < SELECT.hitDy` (72) and `dx + dy < SELECT.hitSum` (80). The positions carry their wave: left (-400, 100) wave 0, bottom (0, -300) wave 2, right (400, 100) wave 4, displayed as 1, 3 and 5. The renderer calls `selectTarget` too, to colour the Cursor yellow, and shows the countdown digit as `floor(selectFrames * 8 / 256)`, 8 down to 0.

`beginWave(state, wave)` sets `wave`, resets the view to `reversedBasis()` and the roll and Laser counters, sets `fireHeld`, switches to `playing`, pushes `waveSelected` and calls `enterStage(state, 'dogfight')`. The bonus for starting on a later wave (`SCORING.waveSelectBonus`) is paid by the Trench at the end of the first Death Star, not here.

## Ending a game

When a Stage leaves `shields < 0`, `stepPlaying` sets `dying` and pushes `playerDied`. After `TIMING.deathFrames` (40) Game Frames, at `PACE.dying`, `endGame` runs (`PHIEGM`/`PHEEGM`):

1. `highScore` takes the score if higher.
2. `attract.lastWaveDisplayed = wave + 1`, which the Attract shows as WAVE until the next game ends.
3. Events `gameOver`, then speech `"REMEMBER"` and `"THE FORCE WILL BE WITH YOU, ALWAYS"`.
4. `qualifyingRow(state.highScores, state.score)`: if it is 0 or more, `beginInitials(state, row)`; otherwise music `ben` and `enterAttractMode(state, 'banner')`.

`enterAttractMode(state, phase)` is the only way back into `attract`: it sets the mode, sets `fireHeld` and calls `enterAttract`. Only `'highScores'` and `'banner'` are accepted.

## Initials Entry

The state is `state.initials`, an `InitialsEntry`: `row` (the table row taken, -1 when none), `letters` (entered so far), `hover` (the item under the Cursor: a letter, `' '`, `'RUB'`, `'END'` or `null`) and `frame`.

`qualifyingRow(scores, score)` returns the first row whose score the new score equals or exceeds, or -1; the tenth row, 380,655 by default, is the floor. `insertRow` splices a blank row in and truncates the table to ten, dropping the last. `beginInitials` does that with `state.score`, resets `state.initials`, switches to `initials` with `fireHeld` set, and pushes `highScore { row }` and music `cantina`. From then on the row's `initials` string is kept up to date as letters are chosen, so the renderer shows the row live.

`hoveredItem` is `GETINT`: the Cursor, offset by `ATTRACT.hoverCursorOffset` (-8, -116), is compared with every entry of `INITIALS_ALPHABET`, and the first within `ATTRACT.hoverBox` (24) on both axes and `ATTRACT.hoverOctagon` (32) combined is returned. Once three letters are in, only `RUB` and `END` can be hovered, and the fallback is `END` rather than `null`, so the selector jumps to END as the original's did. The alphabet is A to I down the left, J to U along the bottom, V to Z up the right, then the blank, RUB and END.

`stepInitialsFrame(state, fire)` runs each Game Frame at `PACE.initials`:

| Condition | Effect | Event |
|---|---|---|
| Rising edge over a letter or the blank, fewer than three entered | Append it | `sound laser` |
| Rising edge over `RUB` | Remove the last letter, if any | `sound shotDestroyed` |
| Rising edge over `END` | Commit `letters` padded to three and trimmed of trailing blanks; finish | `sound torpedo`, `initialsDone` |
| `frame >= ATTRACT.initialsTimeoutFrames` (640) | Commit whatever is entered; finish | `initialsDone` |

It returns `true` on finishing, and `stepFrame` answers with `enterAttractMode(state, 'highScores')`. The renderer flashes the current initial, shows blanks as underscores, draws the hovered item in white and the Cursor in yellow, from `INITIALS_MESSAGES`, `HIGH_SCORE_TITLE_ENTRY` and `HIGH_SCORE_ROWS_Y_ENTRY`.

## Persistence

The cabinet's NVRAM kept only the top three rows; so does [main.ts](../../src/main.ts), under two `localStorage` keys:

| Key | Holds | Written | Read |
|---|---|---|---|
| `starwars.highScores` | JSON of `highScores.slice(0, ATTRACT.persistedRows)`, three `{ initials, score }` rows | `saveTable` on the `initialsDone` event | `loadTable` at start-up |
| `starwars.highScore` | `state.highScore` as a number | `saveHighScore` on the `gameOver` event | `loadHighScore` at start-up |

`loadTable` starts from `defaultHighScores()` and overlays the first `ATTRACT.persistedRows` saved rows, keeping a row only if it has a numeric `score` and a string `initials`; anything else keeps the defaults. Rows four to ten always return to the defaults on reload. Both are passed to `createInitialState(seed, highScore, highScores)`, which sets `highScore` to the larger of the saved number and the table's top row. Every storage call is wrapped in `try`/`catch`, so a browser without storage plays with session-only scores. The simulation itself never touches storage; `main.ts` watches the two events in `dispatch`.

## Data

[data/attract.ts](../../src/data/attract.ts) and [data/logo.ts](../../src/data/logo.ts) are traced tables, marked "do not edit by hand". Positions are VG units, the lower-left of the first character for text, and `Message` is `{ text, x, y, color }` with the colour as a name the renderer maps to the vector generator's palette (`'flashing ...'` cycles through the seven colours once per Field).

| Export | Shape | Read by |
|---|---|---|
| `INSTRUCTIONS`, `INSTRUCTIONS_DIGIT` | Sixteen red `Message` rows; where the Starting Shields digit goes | Renderer, instructions page |
| `SCORING_PAGE` | Nine purple `Message` rows | Renderer, scoring page |
| `STORYLINE` | Eight `{ text, x, start }`: centring offset from the vanishing point and the alarm frame | Renderer, Banner |
| `COPYRIGHT` | Four green `Message` rows | Renderer, High Score Table |
| `HIGH_SCORE_TITLE`, `HIGH_SCORE_ROWS_Y` | Title position and the ten row heights for the table screen | Renderer |
| `HIGH_SCORE_TITLE_ENTRY`, `HIGH_SCORE_ROWS_Y_ENTRY` | The same for Initials Entry, where the table sits in the lower half | Renderer |
| `HIGH_SCORE_DEFAULTS` | Ten `[initials, score]` pairs, OBI 1,285,353 down to RLM 380,655 | `defaultHighScores` in `state.ts` |
| `INITIALS_MESSAGES` | The four messages above the alphabet | Renderer |
| `INITIALS_ALPHABET` | Twenty-nine `{ ch, x, y }` items: A to Z, `' '`, `RUB`, `END` | `hoveredItem`, renderer |
| `COIN_TEXT` | The coin and credit lines and the four price strings | Renderer, every Attract screen |
| `LOGO`, `LOGO_VANISHING_POINT` | Logo strokes with `intensity` 1 to 7; the point (0, 408) they recede toward | Renderer, Banner |

Nothing in `src/game/attract/` reads the message tables. The simulation's only data dependencies are `HIGH_SCORE_DEFAULTS` (through `state.ts`) and `INITIALS_ALPHABET`.

## Configuration

| Group | Key | Value | Read by |
|---|---|---|---|
| `ATTRACT` | `highScoresFrames`, `bannerFrames`, `pageFrames` | 256, 512, 434 | `stepAttractFrame` |
| | `storyGrowUntil`, `storyHoldUntil`, `storyRaceStep`, `storyGoneAt` | 224, 352, 4, 240 | `stepBanner`, `storyLineScale` |
| | `logoFixedUntil`, `logoGoneAt`, `logoFixedScale`, `storyOffsetY` | 64, 248, 0x40, -560 | The renderer |
| | `highScoresFadeFrames`, `pageRevealFrames`, `pageLineEvery`, `scoringScroll`, `scoringScrollPerFrame` | 80, 320, 8, 960, 8 | The renderer |
| | `musicIntervalSeconds` | 400 | `startBanner` |
| | `initialsTimeoutFrames`, `hoverBox`, `hoverOctagon`, `hoverCursorOffset` | 640, 24, 32, (-8, -116) | `highScores.ts` |
| | `persistedRows` | 3 | `main.ts` |
| | `gameOverGrowFrames`, `storyVanishingY` | 32, 408 | Nothing; the renderer uses a literal 32 and `LOGO_VANISHING_POINT` |
| `SELECT` | `countdownFrames` | 256 | `startGame`, `stepSelect`, the renderer |
| | `positions`, `hitDx`, `hitDy`, `hitSum` | three miniatures; 52, 72, 80 | `selectTarget` |
| `PACE` | `attract`, `select`, `initials`, `dying` | see table above; 0.0488, 0.0735, 0.069 | `framePeriod` |
| `TIMING` | `deathFrames` | 40 | `stepFrame` |
| `OPTIONS` | `startingShields`, `playDifficulty` | 7, 1 | `startGame` |

## Events

| Event | Pushed by | When |
|---|---|---|
| `music <random tune>` | `startBanner` | A Banner starts with the music clock expired |
| `gameStarted`, `speech "RED FIVE STANDING BY"` | `startGame` | Trigger in the Attract |
| `waveSelected { wave }` | `beginWave` | A Death Star chosen or the countdown expired |
| `playerDied` | `stepPlaying` | Shields below zero |
| `gameOver`, `speech "REMEMBER"`, `speech "THE FORCE WILL BE WITH YOU, ALWAYS"` | `endGame` | After the death frames |
| `music ben` | `endGame` | No qualifying score |
| `highScore { row }`, `music cantina` | `beginInitials` | A qualifying score |
| `sound laser`, `sound shotDestroyed`, `sound torpedo` | `stepInitialsFrame` | Letter, RUB, END |
| `initialsDone` | `stepInitialsFrame` | END or timeout |

## Tests

[attract.test.ts](../../src/game/attract/attract.test.ts) uses the helpers in [testUtils.ts](../../src/game/testUtils.ts) (`runFrame`, `runFrames`, `FIRE`, `IDLE`) against `createInitialState(1)`:

- The stars cross left to right on the instructions page and move downward on the scoring page, measured through `visibleStars` on stars that were not reborn between two samples.
- The cycle runs `highScores`, `banner`, `instructions`, `scoring` and back with exactly the configured frame counts.
- The first Storyline line is absent at frame 64, present two frames later, holds its scale through the pause, and is gone once it has raced away while the second line has grown past it.
- A trigger pull after 300 frames of Attract switches to `select`.
- The table starts with the arcade defaults (`OBI` 1,285,353, ten rows).
- `qualifyingRow`: 380,655 takes row 9, 380,654 does not qualify, 2,000,000 takes row 0; `beginInitials` at row 3 inserts a blank row, pushes `GJR` down to row 4 and keeps ten rows.
- The hover-and-trigger flow: aiming at A and pressing enters A, RUB removes it, J is entered, END finishes with `J` in the row and the mode back at `attract` on `highScores`. The `aim` helper writes `cursorPot` and `cursor` directly, undoing `hoverCursorOffset`.
- Entry times out after `ATTRACT.initialsTimeoutFrames` frames of idle input.

The `modes` group in [update.test.ts](../../src/game/update.test.ts) covers the surrounding flow: the Attract stays put without a press; a press reaches `select` with fresh Shields and exactly `gameStarted` then `speech`; the select screen times out into wave 0; slewing the Cursor onto the right-hand miniature for 40 Fields and pressing selects wave 4; the dying roll lasts 40 frames and a low score goes to the Banner with `gameOver`; a score of 900,000 goes to Initials Entry at row 3 with the table still ten rows. The `fire latch` test shows a one-Field press between Game Frames still starting a game.

Run them with `npm test`.

## Things to know before changing it

- The Attract depends on the Dogfight module for its stars and writes `state.dogfight.frame` and `state.player.basis`. Entering a game rebuilds both records, so nothing leaks into play.
- The Storyline alarm frames live in two places: `stepBanner` and `STORYLINE`.
- The Storyline is the simulation's; the logo, page reveals, scrolls and fades are the renderer's, keyed to `attract.frame`. A timing change may need both sides.
- `startGame` does not consume a Credit and never will under free play; `credits` is only drawn.
- `selectTarget` applies the vertical offset as a literal 104 rather than `VG.offsetY`.
- Only the top three rows survive a reload, and a saved row is dropped silently if its shape is wrong.
- `stepInitialsFrame` writes the row's `initials` on every press, so a test or tool reading the table mid-entry sees partial initials.
