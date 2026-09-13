# Rendering

The render layer turns a `GameState` into pixels and owns no game logic. [renderer.ts](../../src/render/renderer.ts) holds one class, `WorldRenderer`, which keeps two Three.js scenes: a 3-D scene seen through an `ArcadeCamera` that projects as the cabinet's mathbox and monitor did, and a flat overlay in vector-generator (VG) screen units for everything the original drew flat: the Cursor, Lasers, Fireballs, cockpit, HUD and text. Every line is a fat-line segment batched through `LineSet`, coloured from the eight-colour palette in [colors.ts](../../src/render/colors.ts), and the whole image goes through a bloom pass for the phosphor glow. `main.ts` calls `world.render(state, dt)` at most `MAX_RENDER_FPS` times a second, after stepping the simulation. This page describes each module of `src/render` and the DOM frame in `src/ui` that holds the canvas.

## Where the render layer sits

[main.ts](../../src/main.ts) wires the layer up:

```ts
const screen = document.getElementById('screen')!;
const world = new WorldRenderer(screen);
new ScreenFrame(window, screen, () => world.resize());
```

The animation loop steps the simulation in fixed `DT` fields, forwards each `GameEvent` to `world.handleEvent` and the sound engine, then renders. Rendering is capped: `MAX_RENDER_FPS` is 60, and `MIN_RENDER_INTERVAL_MS` is `1000 / MAX_RENDER_FPS - 4`, so a display refreshing faster than that skips frames while the simulation still steps on every animation frame.

| Module | What it does |
|---|---|
| [renderer.ts](../../src/render/renderer.ts) | `WorldRenderer`: scenes, camera, batches, post-processing, and the per-mode draw calls |
| [arcadeCamera.ts](../../src/render/arcadeCamera.ts) | `ArcadeCamera`: the asymmetric, vertically squashed frustum |
| [lines.ts](../../src/render/lines.ts) | `LineMaterials`, `linesFromEdges`, `markLinesUpdated`: fat-line helpers for fixed meshes |
| [lineSet.ts](../../src/render/lineSet.ts) | `LineSet`: a rebuildable batch of coloured segments |
| [models.ts](../../src/render/models.ts) | `modelEdges`, `placeFromOriginal`: vector ROM models into Three.js |
| [colors.ts](../../src/render/colors.ts) | The palette, `vgColor`, `pureColor` and the colour tables |
| [text.ts](../../src/render/text.ts) | `drawText`, `drawNumber`, `textWidth`: the vector font |
| [deathStar.ts](../../src/render/deathStar.ts) | `drawBigDeathStar`: the detailed Death Star of the Approach and the pull-away |
| [attractView.ts](../../src/render/attractView.ts) | `drawAttractScreen`, `drawInitialsScreen` |
| [surfaceView.ts](../../src/render/surfaceView.ts) | `drawSurface`: buildings, fragments and ground dots |
| [trenchView.ts](../../src/render/trenchView.ts) | `drawTrench`, `drawTorpedo`, `drawDeathStarEnd`, `drawForceBonus`, `drawTrenchMessages` |
| [starfield.ts](../../src/render/starfield.ts) | `createStarfield`: a sphere of stars that nothing imports (see below) |
| [screenFrame.ts](../../src/ui/screenFrame.ts) | `ScreenFrame`: the 4:3 DOM element the canvas fills |

## Coordinate frames

The simulation works in the original's frame: X forward, Y right, Z up, a left-handed triple, in the arcade's universe units (see [frame.ts](../../src/game/frame.ts)). Three.js is right-handed with -Z forward, +Y up, +X right. The conversion is a fixed reflection:

```ts
// Original (x, y, z) -> Three.js (y, z, -x)
three.x =  game.y;   // right
three.y =  game.z;   // up
three.z = -game.x;   // forward is -z
```

Screen output is identical because `512 * Y / X` equals `512 * x / -z`. [Coordinates](./coordinates.md) covers the units themselves; this page covers where the conversion happens. It appears in four places, and nowhere else: `modelEdges` and `placeFromOriginal` in [models.ts](../../src/render/models.ts), `ArcadeCamera.setBasis`, and a private `toThree` in each of [surfaceView.ts](../../src/render/surfaceView.ts) and [trenchView.ts](../../src/render/trenchView.ts). A `Basis` (the body axes `fwd`, `right`, `up`) becomes a Three.js matrix through `makeBasis(right, up, back)` where `back` is the negated forward axis, because a Three.js object looks down its local -Z.

The overlay uses a second frame: VG screen units, +X right, +Y up, origin at the screen centre, the same units the simulation's `ScreenPoint` uses. The overlay camera is `new THREE.OrthographicCamera(-VG.halfWidth, VG.halfWidth, VG.halfHeight, -VG.halfHeight, -10, 10)`, so overlay coordinates are VG units directly. One rule follows from this: a point the simulation projected (`projectRelative` in [projection.ts](../../src/game/projection.ts), `Fireball.at`, `Player.cursor`, `visibleStars`) is relative to the vanishing point, and the overlay code adds `VG.offsetY` (-104) to its y before drawing. The 3-D scene needs no such offset because the camera's frustum has the vanishing point built in.

## WorldRenderer

### Scene setup

The constructor builds everything once and never allocates during play:

| Object | Scene | Purpose |
|---|---|---|
| `aliens[]` | 3-D | `DOGFIGHT.alienSlots` (3) slots, each a `TIE_FIGHTER` mesh and a `DARTHS_SHIP` mesh sharing one `LineMaterial` |
| `pieces[]` | 3-D | 8 slots of `TIE_PIECE_PORT_WING`, `TIE_PIECE_STBD_WING` and `TIE_PIECE_CABIN` meshes for explosion pieces |
| `ground` | 3-D | A `LineSet` of 1024 segments rebuilt every render for the Surface and the Trench |
| `groundDots` | 3-D | `THREE.Points`, up to 64, the green Surface dots |
| `flat` | overlay | A `LineSet` of 2048 segments rebuilt every render for everything 2-D |
| `stars` | overlay | `THREE.Points`, up to 64, the Dogfight and Attract stars at their projected VG positions |

The `WebGLRenderer` is created with `antialias: false` and `powerPreference: 'low-power'`; anti-aliasing comes from the composer's render target instead (`samples: MSAA_SAMPLES`, 4, at `HalfFloatType`). The pixel ratio is `Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)` with `MAX_PIXEL_RATIO` 1.5. `autoClear` is off; `render` clears by hand before the composer runs. The canvas gets the class `world` so [style.css](../../src/style.css) can position it.

### render(state, dt)

`render` ignores `dt` and increments a private `frame` counter on every call. It sets the camera from `state.player.basis`, works out which screen is showing, and draws in a fixed order:

1. `drawAliens` and `drawPieces` set the visibility, placement and colour of the fixed meshes (Dogfight only).
2. `drawStars` fills the star points from `visibleStars(state)` in the Dogfight, in the Trench's `next` phase, and in the Attract.
3. `ground.begin()`; `drawSurface` on the Surface, `drawTrench` while the Trench phase is `flying`; `ground.end()`.
4. `flat.begin()`; the 2-D draws for the current mode; `flat.end()`.
5. `renderer.clear()` then `composer.render()`.

What the flat batch holds depends on `state.mode` and `state.stage`:

| Mode | Drawn |
|---|---|
| `playing` or `dying`, Dogfight | Death Star miniature or zoom, Fireballs, Lasers (not during the `zoom` phase), cockpit, Cursor (`playing` only), HUD, first-wave hints |
| `playing` or `dying`, Surface | Fireballs, Lasers, cockpit, Cursor (`playing` only), HUD, tower messages (`drawSurfaceMessages`) |
| `playing` or `dying`, Trench `flying` | Fireballs, Lasers, cockpit, Cursor (`playing` only), HUD, `drawTorpedo`, `drawTrenchMessages` |
| `playing` or `dying`, Trench after `flying` | HUD, `drawDeathStarEnd`; `drawForceBonus` during `explosion1` |
| `dying` | All of the above for the stage, plus the growing red GAME OVER (`drawGameOverGrowing`) |
| `select` | `drawSelect`: the messages, countdown and three Death Star miniatures, then HUD and Cursor |
| `initials` | `drawInitialsScreen` and the Cursor |
| `attract` | `drawAttractScreen` |

The private draw methods read these parts of `GameState`:

| Method | Reads |
|---|---|
| `drawAliens` | `dogfight.aliens[i]`: `drawn`, `kind`, `pos`, `basis`, `glow` |
| `drawPieces` | `dogfight.explosions[i]`: `shape`, `pos`, `timer`; `dogfight.munge` for the shared tumble |
| `drawStars` | `visibleStars(state)` from [stars.ts](../../src/game/dogfight/stars.ts) |
| `drawCursor` | `player.cursor`; yellow in `initials` or over a select-screen Death Star (`selectTarget`), else turquoise |
| `drawCockpit` | `COCKPIT` strokes from [hud.ts](../../src/data/hud.ts), shifted by `hoodShift` |
| `drawLasers` | `player.laserFrames`, `laserHit`, `laserLeftPair`, `laserAt`; gun tips from `LASER.guns` |
| `drawFireballs` | `dogfight.fireballs[]`: `kind`, `at`, `halfDistance`, `timer` |
| `drawDeathStar` | `dogfight.deathStarDir`, `dogfight.phase`, `dogfight.zoomScale`, `wave` |
| `drawHud` | `score`, `wave`, `lastScore`, `lastScoreFade`, `shields`, `player.gaugeFrames`, `dogfight.frame` |
| `drawSurfaceMessages` | `surface.allTowersCleared`, `towersLeft`, `nextTowerPoints`, `frame` |
| `drawSelect` | `selectFrames`; positions from `SELECT.positions` |
| `drawGameOverGrowing` | `modeFrames` |

The private `hoodShift` is the renderer's own: `Math.sign(pot) * Math.floor(Math.abs(pot) * COCKPIT_SHIFT)`, with `COCKPIT_SHIFT` from [hud.ts](../../src/data/hud.ts) (110/256 and 80/256) applied to `player.cursorPot`. It moves the cockpit pictures and the Laser gun tips together. There is also a `hoodShift` exported from [cursor.ts](../../src/game/cursor.ts) that nothing calls.

`drawLasers` reproduces the original's bolt: from each gun tip it halves the remaining distance to `laserAt` up to eight times, colouring each step from `LASER_COLOURS` rotated by `frame` with the second gun offset by four entries; once `laserHit` is set, it draws a single turquoise segment and a `LASER_SPLASHES` stamp at the end. `drawFireballs` scales a Fireball's sparkle by `512 / halfDistance` clamped to 1/64..4, and draws the `hurt` and `glow` kinds as purple and white pinwheels whose brightness follows `timer`. The comments in `renderer.ts` name the original's routines (`VEWHPB`, `GN1DRW`, `GLOWVW`, `VWGLW`) where a choice needs explaining.

### handleEvent

`handleEvent(_event: GameEvent)` is empty. The renderer draws only from state; events matter to the sound engine and to `main.ts` (which saves the high score on `gameOver` and the table on `initialsDone`). `dispatch` in `main.ts` still forwards every event to `world.handleEvent` first, so a renderer that needs a one-off cue (a flash, a shake) has a place to receive it.

### Bloom and post-processing

The `EffectComposer` runs four passes: a `RenderPass` of the 3-D scene through the `ArcadeCamera`, a `RenderPass` of the overlay through the orthographic camera with `clear = false` so it composites over the first, an `UnrealBloomPass`, and an `OutputPass`. The bloom defaults are exported as `BLOOM`:

| Parameter | Default |
|---|---|
| `strength` | 0.06 |
| `radius` | 0.05 |
| `threshold` | 0.5 |

Two URL flags are read from `location.search` in the constructor. `?nobloom` leaves the bloom pass out of the composer, which is the way to judge the raw lines. `?bloom=strength,radius,threshold` overrides the three defaults; the override applies only when exactly three comma-separated values are given, and `strength` falls back to the default if its value is not a finite number.

### resize

`resize()` reads the container's `clientWidth` and `clientHeight` and passes them to the `WebGLRenderer`, the composer, the shared `LineMaterials`, both `LineSet` batches and the bloom pass. `ScreenFrame` calls it from its `fit()` whenever the window resizes. Fat lines need the resolution because their width is in pixels, and the material computes it from the viewport size.

## The arcade camera

[arcadeCamera.ts](../../src/render/arcadeCamera.ts) subclasses `THREE.PerspectiveCamera` and replaces `updateProjectionMatrix` so the frustum is built from the `VG` constants in [config.ts](../../src/game/config.ts) rather than a field of view:

```ts
const right  = (VG.halfWidth / f) * n;                   // 495 / 512
const top    = ((VG.halfHeight - VG.offsetY) / f) * n;   // (557 + 104) / 512
const bottom = (-(VG.halfHeight + VG.offsetY) / f) * n;  // -(557 - 104) / 512
this.projectionMatrix.makePerspective(-right, right, top, bottom, n, this.far);
```

Three things follow. The focal length is `VG.focal`, 512, so a point at 45 degrees lands on the edge of a logical ±512 viewport: the same `512 * lateral / forward` the simulation's `projectRelative` and `inCone` use in [projection.ts](../../src/game/projection.ts) for hit tests, so what looks aimed is aimed. The frustum is asymmetric: `VG.offsetY` is -104, so the vanishing point sits 104 VG units below the screen centre. And the visible window is ±495 X units by ±557 Y units drawn into a 4:3 canvas, which makes one Y unit physically two thirds of one X unit. That is the cabinet's vertical squash, reproduced deliberately (option A in [Projection](../reference/projection.md), section 2.6); the TIE Fighter's octagonal wing panels look wider than tall, as on the tube.

`setBasis(b)` places the camera from the player's `Basis` in the original's frame without going through Euler angles: `matrixAutoUpdate` is off and `matrix`, `matrixWorld` and `matrixWorldInverse` are written directly. The camera never moves; the Surface and Trench views subtract the player's position from every point instead, and in the Dogfight the player is always at the origin.

The 2-D pictures in [vectorRom.ts](../../src/data/vectorRom.ts) and [hud.ts](../../src/data/hud.ts) carry the squash in their own coordinates, since the original drew them in VG units. Where a shape needs to look round the code multiplies y by 1.5 by hand, as the original's `ASPECT` macro did: see the explosion rings in `drawDeathStarEnd`.

## Line batching

[lines.ts](../../src/render/lines.ts) sets `LINE_WIDTH` to 2 pixels, wider than one so the bloom pass's half-resolution blur cannot flicker on a line. Every fat line is a `LineSegments2` from Three.js's addons with a `LineMaterial` (`alphaToCoverage: true`). `LineMaterials` keeps every material it makes so `resize` can update their `resolution` together. `linesFromEdges(edges, material)` builds a mesh from a flat list of six numbers per segment; `markLinesUpdated` flags a shared position buffer after an in-place edit.

[lineSet.ts](../../src/render/lineSet.ts) is the batch used for anything that changes shape every render. A `LineSet` owns one `LineSegments2` with `vertexColors`, two `Float32Array` buffers (positions and colours, six floats per segment) and a count:

```ts
flat.begin();
flat.segment(x0, y0, z0, x1, y1, z1, color);
flat.polyline(points, color, ox, oy, s, sy);   // 2-D, at z = 0
flat.end();
```

`polyline` takes a list of `[x, y]` points, an offset and a scale (with an optional separate y scale), and emits one segment per pair. `end()` uploads: if the capacity doubled during the batch it swaps in a new `LineSegmentsGeometry`, otherwise it marks the interleaved `instanceStart` and `instanceColorStart` buffers dirty. `instanceCount` is set to the segment count, so unused capacity costs nothing, and the mesh is hidden when empty. Capacity grows by doubling and never shrinks.

The fixed meshes (aliens and explosion pieces) do not use `LineSet`; their geometry never changes, only their `matrix`, `visible` flag and material colour.

## Models

[models.ts](../../src/render/models.ts) reads the `RomModel` shapes in [vectorRom.ts](../../src/data/vectorRom.ts): `points` in model units in the original's frame, an assembly-time `scale`, and `lines` as pairs of point indices. `modelEdges(model)` multiplies each point by `scale * 2` (the original added unhalved model points to halved positions, so world size is twice the table's) and converts to Three.js. `placeFromOriginal(obj, pos, basis)` sets an object's matrix from a position and body `Basis`, again through `makeBasis(right, up, back)`.

The models drawn this way are `TIE_FIGHTER`, `DARTHS_SHIP` and the three `TIE_PIECE_*` fragments. The Surface and Trench shapes are in [surface.ts](../../src/data/surface.ts) and [trench.ts](../../src/data/trench.ts) in their own unit systems (`BUILDING_UNIT` 240 and `TRENCH_UNIT` 16 universe units per model unit) and go through `LineSet` instead. The reference notes for each family are in `docs/reference/shapes-dogfight.md`, `shapes-surface.md`, `shapes-trench.md`, `shapes-hud.md` and `shapes-attract.md`.

## Colours

[colors.ts](../../src/render/colors.ts) holds the vector generator's eight colours by the original's three-letter names, as a cabinet recording measures them:

| Code | Alias | RGB (0..1) | Measured on the cabinet |
|---|---|---|---|
| `OFF` | | 0, 0, 0 | |
| `BLU` | `BLUE` | 0.1, 0.05, 1 | 58, 7, 255 |
| `GRN` | `GREEN` | 0, 0.85, 0 | 0, 216, 0 |
| `TRQ` | `TURQUOISE` | 0, 0.92, 1 | 0, 234, 255 |
| `RED` | `RED` | 1, 0.1, 0.03 | 255, 32, 14 |
| `PRP` | `PURPLE` | 1, 0.14, 1 | 255, 35, 255 |
| `YLW` | `YELLOW` | 1, 0.93, 0.03 | 255, 240, 0 |
| `WHT` | `WHITE` | 1, 1, 1 | 255, 255, 255 |

An unknown name falls back to white. Two functions turn a name and a brightness code into a `THREE.Color`:

| Function | Brightness scale | Use |
|---|---|---|
| `vgColor(name, lum = 0x80)` | 0x80 is normal; below it the colour scales down linearly; above it the colour is clamped at the base (`OVERDRIVE_WHITENING` is 0, since the recording shows full-brightness strokes as pure as normal ones) | Nearly everything |
| `pureColor(name, lum = 0xff)` | 0xff is full; scales linearly over 0..255 | Stamps whose brightness ramps over the whole range: Fireball sparkles, the logo |

Both allocate a new `THREE.Color` on every call. The tables next to them are the original's colour sequences:

| Export | Meaning |
|---|---|
| `FLASH_CYCLE` | Colours 1..7 in order; indexed by the renderer's `frame % 7` for flashing text and fuse tips |
| `alienGlowColor(glow)` | The TVWCL table: white flashes fading over green while an alien's `glow` counts down |
| `explosionColor(timer)` | The TVWCLE table: yellow, then green with white flashes, then a green fade |
| `gaugeColorName(shields)` | Shield gauge: red at 1 or 2, yellow at 3 or 4, green above, `OFF` at none |

## Text

[text.ts](../../src/render/text.ts) draws the arcade font from `FONT` in [hud.ts](../../src/data/hud.ts): strokes per glyph in a 24-unit cell, 16 wide and 24 tall, advancing `FONT_ADVANCE` (24). `drawText(lines, text, x, y, color, scale)` uppercases the string and places the lower-left of the first character at `(x, y)`; `@` maps to the `(c)` glyph. The period and colon are single points in the vector ROM (zero-length lit vectors), which a line renderer would drop, so `drawStroke` draws them as 4-unit dashes (`DOT_HALF`).

`drawNumber(lines, value, x, y, color, field, minShown, scale)` draws a number in a fixed-width field the way the original did: leading zeros are suppressed but still advance the pen, down to `minShown` digits, and a thousands comma advancing only 4 units appears once a significant digit has been drawn. `textWidth` is `length * FONT_ADVANCE * scale`, used to centre messages.

Text rows are placed by the tables in [hud.ts](../../src/data/hud.ts) (`HUD_TEXT`, `GAUGE_BASE`, `GAUGE_TITLE`, `GAUGE_DIGIT`) and [attract.ts](../../src/data/attract.ts) (`Message` lists with the lower-left of each string in VG units), matching the original's rows from `VG.rowTop` (552) down in steps of `VG.rowHeight` (24). Some positions are literals in the draw calls instead, for example the Death Star Select messages in `drawSelect` and the tower messages in `drawSurfaceMessages`; the comments there name the original's message slots where they are known.

## The views

Each view module is a set of free functions taking `GameState` and a `LineSet`. None keeps state between renders.

| Module | Function | Batch | Reads |
|---|---|---|---|
| [deathStar.ts](../../src/render/deathStar.ts) | `drawBigDeathStar(flat, cx, cy, scaleWord, wave)` | `flat` | A masked scale word (binary × 128 + linear); `DEATH_STAR_DETAIL` from hud.ts, `DEATH_STAR_LIGHTS_EVEN` or `_ODD` by wave parity |
| [attractView.ts](../../src/render/attractView.ts) | `drawAttractScreen(state, flat, frame)` | `flat` | `state.attract` (`phase`, `frame`, `lastWaveDisplayed`), `score`, `credits`, `highScores`, `storyLineScale(state, i)` |
| | `drawInitialsScreen(state, flat, frame)` | `flat` | `state.initials` (`row`, `letters`, `hover`), `highScores` |
| [surfaceView.ts](../../src/render/surfaceView.ts) | `drawSurface(state, lines, dots)` | `ground`, `groundDots` | `state.surface`: `buildings[]` (`seen`, `flash`, `damaged`, `type`), `fragments[]`, `munge`, `dots[]`, `pos` |
| [trenchView.ts](../../src/render/trenchView.ts) | `drawTrench(state, lines, frame)` | `ground` | `state.trench`: `pos`, `rowStarts`, `slots[]`, `endX`, `portX`, `cueIndexPassed`; `player.basis` |
| | `drawTorpedo(state, flat, frame)` | `flat` | `trench.torpedo`, `trench.pos`, `player.basis` |
| | `drawDeathStarEnd(state, flat, frame)` | `flat` | `trench.phase`, `dxScale`, `burstPhase`, `burstCount`, `nextTim`, `shieldsAdded`; `shields`, `firstWave`, `wave` |
| | `drawForceBonus`, `drawTrenchMessages` | `flat` | `trench.force`, `forceBonus`, `missedFrames`, `frame`, `repeat`, `portX` |

### deathStar.ts

`drawBigDeathStar` splits the scale word into `binary = floor(word / 128)` and `linear = word % 128` and draws the detail strokes at `2^(2 - binary) * (256 - linear) / 256`. The city lights are drawn three binary steps larger (clamped at binary 0), yellow at 0x60 once full size and 0x30 before, each light a 3-unit dash (`LIGHT_HALF`) with its connecting strokes at a sixth of that brightness. Even waves spell MAY THE FORCE / BE WITH YOU. The Dogfight's `zoom` phase and the Trench's `explosion1` phase both use it, with `dogfight.zoomScale` and `trench.dxScale` respectively.

### attractView.ts

`drawFrameText` draws the score and wave labels and the Credit lines common to every Attract screen. The phases then differ: `highScores` draws `COPYRIGHT`, the title and the High Score Table at 1.5 times size in blue, fading over the last `ATTRACT.highScoresFadeFrames`; `banner` calls `drawBanner`, which recedes the `LOGO` strokes toward `LOGO_VANISHING_POINT` (0, 408) in `pureColor('BLU')` scaled by each stroke's `intensity`, then draws each `STORYLINE` line in green at the scale `storyLineScale` reports; `instructions` and `scoring` reveal one line every `ATTRACT.pageLineEvery` frames, fade after `pageRevealFrames`, and the scoring page rises from 960 units below. `drawInitialsScreen` draws the messages, the flashing title, the table at normal size with the player's row in white and the current letter slot blinking on odd frames, and `INITIALS_ALPHABET` with the hovered item in white; `RUB` and `END` are drawn at half size.

### surfaceView.ts

`drawSurface` draws every building that `isActive` and has a `seen` record, relative to the player through `relativeTo` (both from [buildings.ts](../../src/game/surface/buildings.ts)). Each is shrunk about its base by `distanceShrink(distance)`, `max(1/16, 1 - floor(distance / 512) / 64)`, the original's distance scale. The base is yellow at a brightness that falls with distance between 0x40 and 0x7f; the top is white for a Laser Tower (its Hat) and red at 0x60 for a Laser Bunker; a building with `flash > 0` is white at full brightness. The part lists are `BUNKER`, `TOWER_STUB` for a tower whose Hat is gone, and `TOWER`, all indexing `GROUND_POINTS` scaled by `BUILDING_UNIT` (240). Fragments use the `FRAGMENT_MODELS` table, tumble through `surface.munge` with `toWorld`, and brighten from `16 * timer` for their last seven frames. The ground dots are copied into the `Float32Array` the renderer owns, at ground level (`z = -surface.pos.z`), and the function returns how many it wrote.

### trenchView.ts

`drawTrench` draws everything in universe units relative to `trench.pos`. `trenchLine` clips each segment at the near end: both endpoints go through `toView` with the player's basis, and an endpoint closer than 200 units forward is pulled to that limit along the segment, as the original did. The fixed geometry is six long edges (wall tops, wall feet and two floor lines at ±512) in green 0x70, a vertical at each `rowStarts` entry in green 0x60, the far end in green 0x50 at `TRENCH.drawAhead`, and the end wall's top edge at `endX` in green 0x80. Panels come from `trench.slots[s & (TRENCH.ringSlots - 1)]` for each slot from the player's to the draw distance: code 1 is `WALL_PANEL`, 3 is `WALL_GUN` (a Trench Turret), and any other non-zero code is a `CATWALK`, whose colour cycles through `TRENCH.catwalkColours` by depth cue and flashes `FLASH_CYCLE` while `struck`. The right wall's models are mirrored in Y. `EXHAUST_PORT` is drawn on the floor at `portX` when within `TRENCH.portDrawAhead`.

`drawTorpedo` projects the Torpedo pair by hand (`toView`, `inCone`, then `512 * y / x`) and draws turquoise `FIREBALL_TIPS` pinwheels on the flat batch. `drawDeathStarEnd` covers the three phases after the Exhaust Port is hit: `explosion1` is the big Death Star receding at `dxScale`; `explosion3` is the burst, the miniature on its first frame and then circles of the Death Star's 16-segment outline at scale words stepped by `burstCount`, red, blue and white by `burstPhase`; `next` is the DEATH STAR DESTROYED text and the shield accounting shown as `nextTim` counts down.

### starfield.ts

`createStarfield(rng, color)` builds 400 `THREE.Points` on a sphere of radius 9000. Nothing imports it. The stars the player sees come from `visibleStars` in [stars.ts](../../src/game/dogfight/stars.ts), which the simulation streams and regenerates as the original did, and `WorldRenderer.drawStars` places them on the overlay as points at their projected VG positions. Treat `starfield.ts` as unused.

## What the renderer reads, and when

Three clocks meet in `render` (the first two are described in [Timing](./timing.md)):

| Clock | Rate | Advances |
|---|---|---|
| Field | `DT`, about 42 a second | `state.field`; the Cursor (`stepCursor`), `fireLatch`, `frameDebt` |
| Game Frame | `framePeriod(state)`, 10 to 21 a second by screen | `state.frame`; everything else in `GameState` |
| Render | at most `MAX_RENDER_FPS` | `WorldRenderer.frame` |

`step` in [update.ts](../../src/game/update.ts) runs `stepCursor` on every Field and the rest of the logic only when `frameDebt` reaches one, so `player.cursor` and `player.cursorPot` are fresher than the aliens, Fireballs and Trench they are drawn over. The renderer reads both without caring which is which: it draws the Cursor where `player.cursor` says on every render, so the Cursor glides at Field rate while the scene steps at Game Frame rate, as it did on the cabinet.

The renderer's own `frame` counter is neither. It increments once per `render` call, so the colour cycles indexed by `frame % 7` (`FLASH_CYCLE`), the Laser colour rotation, the Fireball sparkle cycles and the initials blink run at the render rate, up to 60 a second, not at the Field rate the comment in `colors.ts` names. Anything that must keep the cabinet's timing reads a counter from `GameState` instead: the first-wave hints alternate on `dogfight.frame`, the tower message blinks on `surface.frame`, and the Trench hints on `trench.frame`.

The renderer also computes a few things the simulation does not store: the Death Star miniature's screen position from `deathStarDir`, the Torpedo's projection, the near-clipping of Trench lines, and the hood shift. Everything else on screen is a projection the simulation already made for its own hit tests.

## The DOM frame

[index.html](../../index.html) is three elements: `<div id="app"><div id="screen"></div></div>`, the stylesheet, and the module script `src/main.ts`. `WorldRenderer` appends its canvas to `#screen`.

`ScreenFrame` in [screenFrame.ts](../../src/ui/screenFrame.ts) keeps `#screen` at the monitor's `ASPECT` of 4:3, as large as fits in the window, and calls its `onResize` callback (which is `world.resize`) after every fit:

```ts
let width = w;
let height = w / ASPECT;
if (height > h) { height = h; width = h * ASPECT; }
```

The element's `style.width` and `style.height` are set in whole pixels; the renderer reads them back through `clientWidth` and `clientHeight`. `YokeInput` uses the same element's bounding rectangle for the mouse, so the visible frame, the render viewport and the Yoke's full deflection are one rectangle.

[style.css](../../src/style.css) does the rest: `html, body` are black with `overflow: hidden`, `user-select: none` and `cursor: none` (the browser pointer is hidden because the Cursor is drawn by the renderer); `#app` is a fixed, flex-centred box; `#screen` is `position: relative` with `overflow: hidden` and a black background; `#screen canvas.world` fills it with `position: absolute; inset: 0`. The `:root` colour variables, the `.overlay` class and the `[hidden]` rule have no users in the current source.

## Dev hooks

In a dev build (`import.meta.env.DEV`) [main.ts](../../src/main.ts) puts the live objects on `window`:

| Hook | Value |
|---|---|
| `window.__swWorld` | The `WorldRenderer` instance |
| `window.__sw` | The `GameState` |
| `window.__swSound` | The `SoundEngine` |
| `window.__swStep(fields)` | Steps the simulation that many Fields with a centred, unfired Yoke |
| `window.__swEnterStage(stage, wave?)` | Jumps straight into a stage |

`__swWorld` is mainly useful for `resize()` and for inspecting the private fields from the console (`__swWorld.flat`, `__swWorld.camera`). Because the renderer holds no state of its own beyond its meshes and the `frame` counter, changing `__sw` and waiting for the next render is enough to see any state on screen; `__swEnterStage('trench', 3)` followed by a click is the fastest way to reach a given screen.
