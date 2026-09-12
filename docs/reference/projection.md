# Star Wars (Atari, 1983) — 3D projection, camera frame, yoke → view mapping

Derived from the 6809 source (`WS*.MAC`) and the mathbox microcode (`SWMP.MAC`, `SWMP.DOC`).
Assembler conventions: numbers are hex unless followed by `.` (decimal). All constants below are
given in **decimal** unless prefixed with `0x`.

Sources cited as `FILE:LABEL` (all under the `swsrc` directory).

---

## 0. TL;DR for the Three.js port

| Item | Value | Source |
|---|---|---|
| Projection | `sx = 512 * Y / X`, `sy = 512 * Z / X` (VG units, relative to the "math view" centre) | `WSMAIN.MAC:IMATH` (`M.DVN = 0x200`), `SWMP.MAC:PERS`, `WSOBJ.MAC:OBJPNT` |
| Focal length f | **512 VG units** in both axes (numerator of the hardware divider) | `WSMAIN.MAC:IMATH` |
| Designed 3D viewport (logical) | X ±512, Y ±512 around the math centre (a ±45° cone, `tan = 1` at the edge) | `WSSTAR.MAC:VWSTAR` visibility test, `WSVROM.MAC` edge constants |
| Math-view centre on screen | (0, **−104**) VG units (`VGOFFY`) — i.e. 104 Y-units below the physical screen centre | `WSVROM.MAC` top, `WSOBJ.MAC:OBJCEN` |
| Physical visible window (estimate, 4:3 monitor) | X ≈ ±495 X-units, Y ≈ ±557 Y-units | §1.4 |
| Anisotropy | **1 VG Y-unit = 2/3 of 1 VG X-unit physically** (the game multiplies Y by 3/2 to draw round circles) | `WSVROM.MAC:ASPECT` (`MASP=3, DASP=2`), `TCTEST.MAC` pot test "1.5/1 ASPECT RATIO" |
| Three.js camera, faithful (squashed) | frustum tangents: left/right ±0.967, top +1.291, bottom −0.885 → `fovY ≈ 94.8°`, `aspect = 0.889 (8/9)`, rendered into a 4:3 viewport, vanishing point 9.3 % of screen height below centre | §2.6 |
| Three.js camera, geometrically correct | left/right ±0.967, top +0.861, bottom −0.590 → `fovY ≈ 71.9°`, `aspect = 4/3`, same 9.3 % downward offset | §2.6 |
| World frame | X = forward, Y = right, Z = up (**left-handed**); universe is a 16-bit wrapping cube | `SWMP.DOC` "Strange but true", §3 |
| Space (dogfight) yoke | moves the **crosshair only**; the view direction is **auto-aimed** at the current target (TIE / Death Star) — no yaw/pitch from the yoke | `WSMAIN.MAC:STWSP1`, `AIM`, `AIMA` |
| Ground / trench yoke | translates the ship sideways/vertically and (ground only) banks the view; no yaw/pitch | `WSMAIN.MAC:S1MVGD`, `S1TWGD`, `S1MVBS` |
| Angle unit | 1 "tic" = 0.0639° = 1.116 mrad; rotations applied in quanta of 14 tics (0.895°) or 78 tics (4.986°), remainder applied as a display-only "residue" | `WSMAIN.MAC:RHRSDU`, `RESIDU`, `TRHTIC` |
| Game logic rate | 20 Hz (12 IRQs × 4.2 ms); VG refresh 40 Hz (6 IRQs); cursor updated at 40 Hz | `WSINT.MAC:IRQ`, `DOVG` |

---

## 1. Screen space (vector generator coordinates)

### 1.1 Constants (`WSVROM.MAC` top, duplicated in `WSGLOB.MAC`)

| Symbol | Value | Comment in source |
|---|---|---|
| `VGEDGT` | +600 | hard top edge (never visible) |
| `VGEDGB` | −612 | hard bottom edge |
| `VGEDGL` | −510 | hard left edge |
| `VGEDGR` | +510 | hard right edge (never visible) |
| `VGLIMT` | +408 | top limit for math view, always visible ("DMZ") |
| `VGLIMB` | −552 | bottom limit |
| `VGLIML` | −480 | left limit |
| `VGLIMR` | +480 | right limit |
| `VGOFFY` | **−104** | offset in Y for math box |
| `VGRW0` | +552 | very top text line guaranteed visible |
| `VGRW1..VGRW6` | 528, 504, 480, 456, 432, 408 | text rows, 24 units high (`VG$C = 24`, `VG$CW = 24`) |
| `VGCURT` | +120 | cursor top limit, in ±128 "pot" units (= +480 VG units) |
| `VGCURB` | −104 | cursor bottom limit (= −416 VG units) |
| `VGCURL` / `VGCURR` | −112 / +112 | cursor left/right limits (= ∓448 VG units) |
| `VGCNTR` | 0x8040 | "centre beam" opcode — beam returns to (0,0) |
| `VGSCAL` | 0x7200 | default scale opcode (binary scale 2 = ¼ of the raw 13-bit vector space) |

The `VGCUR*` values are computed in the source as e.g. `VGCURT = (512−30)/4` and
`VGCURL = (−512+30+(1024−(VGLIMR−VGLIML))/2)/4`; 30 is the cursor half-size, /4 converts the
±512 screen range to the ±128 pot range.

### 1.2 Origin and axes
* Origin (0,0) is the **screen centre** (`CNTR` opcode). X positive = right (`VGEDGR` is
  "right"), Y positive = up (`VGRW0 = +552` is the top text line).
* Vectors are encoded as 13-bit signed deltas (`WSVGMC.MAC:VCTR`: `DY & 0x1FFF`, `DX & 0x1FFF`),
  so anything outside ±4095 wraps (a visible artefact of the original when objects get very close).
* Text/HUD occupies Y from 408 up to 552+; the 3D "math view" is the region below `VGLIMT = 408`.

### 1.3 The math view and `VGOFFY`
Every 3D screen position is emitted relative to the beam centre with `VGOFFY` added to Y
(`WSOBJ.MAC:OBJCEN`, `WSOBJ.MAC:PLOT` macro, `WSSTAR.MAC:VWSTAR` "LDD #VGOFFY&01FFF"), so the
3D vanishing point sits at screen (0, −104).

Star visibility is exactly `|Y| < |X|` and `|Z| < |X|` (§5), i.e. the star cone is ±512 VG units
around the math centre. Around (0, −104) that is X ±512 ≈ hard edges ±510, Y from **+408**
(= exactly `VGLIMT`, the bottom of the text area) down to **−616** (≈ hard bottom −612). So
`VGOFFY` was chosen so that the ±45° projection cone fills the screen from the text area down to the
bottom edge. Treat the **logical 3D viewport as X ∈ [−512, 512], Y ∈ [−512, 512] around (0, −104)**.

Relative to the math centre the other limits are: up +512 (`VGLIMT`), down −448 (`VGLIMB`),
hard up +704, hard down −508; X ±480 (limits), ±510 (hard).

### 1.4 Aspect ratio: **VG Y-units are physically 2/3 of X-units**
Evidence:
* `WSVROM.MAC:ASPECT` macro sets `MASP=3, DASP=2` ("ASPECT RATIO AFFECTS Y") and every Y
  coordinate of shapes drawn under it is multiplied by 3/2. It is used with the comments
  "GIVES ROUND GUNSHOTS", "WANT ROUND, SO USE ASPECT RATIO" (Death Star base circle), "KEEP ROUND",
  "MAKES GAS GAUGE TALLER".
* `TCTEST.MAC` pot test: the Y pot reading is multiplied by 1.5 with the comment
  "COMPENSATE FOR 1.5/1 ASPECT RATIO".

Hence, if the monitor is a normal 4:3 landscape tube, one X-unit is 1.5× the physical length of one
Y-unit. Consequences:
* The logical space (1020 wide × 1212 tall) is physically 1020 × 808 X-unit-equivalents ≈ 1.26:1.
  With a 4:3 tube filled horizontally by ±495 X-units (between the ±480 "limit" and ±510 "hard"
  values), the visible height is 743 X-units = **1114 Y-units, i.e. Y ≈ ±557** — consistent with
  the source's "top line at +552 guaranteed visible, +600 never visible".
* **The 3D projection is anisotropic**: it uses f = 512 in both axes in logical units, so the
  rendered world is squashed vertically to 2/3. Nothing in the object pipeline compensates
  (no ×3/2 in `OBJPNT`/`VWSTAR`), and the object models are not pre-stretched (e.g. the TIE body
  octagon is 14 × 12 model units). A faithful recreation reproduces the squash (§2.6 option A).

---

## 2. The projection

### 2.1 Pipeline (space objects, `WSOBJ.MAC:OBJPNT`)
For each object vertex (after the mathbox `POSTADD` produced view coordinates `XP, YP, ZP`):

1. `M.DVD ← XP` — writing the divisor starts the hardware divider (`M.DVD = 0x4704`).
2. `QUO ← M.DVN / XP` where the numerator latch `M.DVN` was set **once** to `0x200 = 512`
   (`WSMAIN.MAC:IMATH`: "LDD #200 / STD M.DVN ;RECIPROCAL PERSPECTIVE"; restored after other
   uses in `WSGUNS.MAC`, `WSLAZR.MAC`).
3. `XP ← QUO`, run microcode `PERS` (`SWMP.MAC:PERS`): `YP ← YP × XP`, `ZP ← ZP × XP`.
4. Screen `sx = YP`, `sy = ZP` (then `sy + VGOFFY` for the first/centre point; subsequent points as
   deltas: `WSOBJ.MAC:OBJDRW`, `BJLNV`).

The divider (`DIVTST.MAC` header) is an "unsigned 15 bit fractional divider which assumes that the
dividend is less than twice the divisor": `QUO = (DVN / DVD) × 16384`, i.e. `0x4000 = 1.0`
(test: `4000/4000 = 4000`). The multiplier is 2.14 fixed point (`SWMP.DOC`: "4000H × 4000H = 4000H").
Therefore

```
QUO      = 512 / X   (in 2.14, valid while X > 256)
screen_x = Y * QUO / 16384 = 512 * Y / X
screen_y = Z * QUO / 16384 = 512 * Z / X
```

**f = 512 VG units.** A point at 45° off-axis lands exactly on the ±512 edge of the logical
viewport (`tan = 1`).

### 2.2 Near clipping / overflow
* `QUO` overflows to ≥ 0x8000 (negative as signed) when `X ≤ 256`; when X is negative (behind), the
  unsigned divide yields a small quotient (≤ 0x100). Comment in `WSOBJ.MAC:BJBCLP`:
  "X TOO CLOSE(LE 100) GIVES NEGATIVE QUOTIENT; X BEHIND(HS 8000) GIVES LO QUOTIENT".
* Ground/trench objects (`BJBCLP`, `BJGCLP`) clamp `QUO` to `0x7FFF` (≈ 2.0) when `X ≤ 256` and then
  clamp the resulting screen coordinates to `±(edge + 24)` (trench) or `±(edge + 512)` (ground).
* Space objects (`OBJPNT`) have **no per-vertex guard**; the object as a whole is only drawn when its
  centre passes `16 < X ≤ 0x7F00` and `Y² < X²`, `Z² < X²` (`WSMAIN.MAC:S2VW`), i.e. inside the ±45°
  cone. Vertices nearer than X = 256 produce wrapped garbage (original artefact).
* Stars: visible iff `256 < X ≤ 4095` (in halved units, §2.4) and inside the cone.
* Death Star miniature: direction test only, inside the cone (`WSMAIN.MAC:VWDTHA`).
* The VG's 13-bit delta wraps at ±4096, so even "clamped" coordinates beyond that fold over.

### 2.3 Ground objects (`SWMP.MAC:PER2`, `WSOBJ.MAC:BJGPNT`)
Same mathematics, pipelined: `XS = (YR + YP) × YT`, `YS = (ZR + ZP) × YT` with `YT = QUO =
512 / (XR + XP)` where `(XP,YP,ZP)` is the (negated) object centre in view coordinates and
`(XR,YR,ZR)` the rotated model vertex. Screen Y gets `VGOFFY` added in the `PLOT` macro.

### 2.4 Units
* World ("universe") coordinates are 16-bit two's complement; the universe wraps (`PRE2`:
  "wrap-around is automatic").
* Space objects: the alien's centre is transformed with `M$PSB2` (`SWMP.MAC:PRE2`), which computes
  `view = R · (P − T) / 2` — the **halved** vector ("15 BIT OUTPUT" to avoid overflow). The halved
  centre is then used as the `POSTADD` translation while model vertices are added at full model
  scale. So model coordinates (`.P x,y,z` × `.S`) are in **half-universe units**; e.g. the TIE fighter
  (`.S = 13`, points −16..18) spans ±234 model units = ±468 universe units. For the recreation it is
  simplest to work in these "view units" (= universe/2) everywhere in space: distances to aliens
  come out of `PSB2` already halved (`0x800` "too close to shoot", `0x4000` "too far"), stars are
  visible for `256 < X ≤ 4095`, and f = 512 applies to them directly.
* Ground objects use `M$PSUB` (no halving) and `.S = 120` models; trench panels use `PSB2` centres
  with explicitly half-size models (`.PH`, "NOTE HALF SIZE DUE TO PSUB LACK OF DIV2").
* The scale/zoom constant `M.SCL` is fixed at `0x4000` (1.0); `XSCALE` is unused.

### 2.5 Field of view in angles (logical units)
* Horizontal: half-angle = atan(495/512) = **44.0°** (visible), 43.2° at ±480, 44.9° at ±510.
* Vertical, logical: +45° (to `VGLIMT`), −41.2° (to `VGLIMB`), −50.3° (hard bottom).
* Vertical, physical (×2/3): the top of the math view (+512 Y = 341 X-eq) is at 33.7°, the bottom
  of the screen (≈ −557−104 = −661 Y = −441 X-eq) at −40.7°.

### 2.6 Three.js camera parameters
Let `f = 512`, `Wx = 495` (half visible width, X-units), `Hy = 557` (half visible height,
Y-units), `off = 104` (`VGOFFY`), `s = 2/3` (physical size of a Y-unit in X-units).
Frustum plane tangents (relative to the screen centre, not the math centre):

```
right  = +Wx / f            = +0.967
left   = −Wx / f            = −0.967
top    = +(Hy + off) s / f  (s = 1 → +1.291 ; s = 2/3 → +0.861)
bottom = −(Hy − off) s / f  (s = 1 → −0.885 ; s = 2/3 → −0.590)
```

**Option A — faithful (reproduces the 2/3 vertical squash):** `s = 1`, render into a 4:3
viewport. Equivalent symmetric numbers: `fovY = 2·atan(Hy/f) = 2·atan(1.088) = 94.8°`,
`aspect = Wx/Hy = 0.889 (= 8/9 = 4/3 × 2/3)`, then shift the projection centre down by
`off/Hy = 18.7 %` of the half-height (= 9.3 % of the full height).

**Option B — geometrically correct pinhole:** `s = 2/3`, `fovY = 2·atan(Hy·s/f) = 2·atan(0.725) =
71.9°`, `aspect = 4/3` (check: `tan(35.95°)·4/3 = 0.967 = Wx/f` ✓), same 9.3 % downward shift.
Objects will look 1.5× taller than on the original hardware.

Code sketch (works for both; only `s` differs):

```ts
const f = 512, Wx = 495, Hy = 557, off = 104, s = 2/3 /* or 1 for option A */;
const n = 1, fa = 1e5;
cam.projectionMatrix.makePerspective(-Wx/f*n, Wx/f*n, (Hy+off)*s/f*n, -(Hy-off)*s/f*n, n, fa);
cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
// or: cam = new PerspectiveCamera(fovY, aspect, n, fa); cam.setViewOffset(W, H, 0, -0.0933*H, W, H);
```

Mapping VG units to pixels for a canvas of width `W` px (4:3): `px = W/2 · sx/Wx`,
`py = −(H/2) · (sy + VGOFFY)/Hy` for a screen-relative `sy` — the HUD/text (rows at Y 408..552) and
cursor are placed with the same mapping.

Uncertainty: `Wx` and `Hy` depend on how each cabinet's monitor size pots were set; the source only
guarantees `480 ≤ Wx ≤ 510` and `552 ≤ Hy ≤ 612` (see open questions).

---

## 3. World / camera frame

### 3.1 Axes and handedness
`SWMP.DOC`: "Strange but true: X is straight ahead, Z is up, and Y is to the right."
Screen x = +Y, screen y = +Z (§2.1) and VG x is right / y is up, so (X ahead, Y right, Z up) — this
is a **left-handed** triple. Mapping to Three.js (right-handed, −z forward, +y up, +x right):

```
three.x =  game.Y      (right)
three.y =  game.Z      (up)
three.z = −game.X      (forward is −z)
```
This is a reflection (det = −1), which is expected; screen output is identical because
`f·Y/X = f·x/(−z)` and `f·Z/X = f·y/(−z)`.

### 3.2 Ship matrices (mathbox RAM, `SWMP.DOC` memory map, `WSGLOB.MAC` `M$AX..M$TZ`)
Each ship block holds three "unit vectors" `A=(AX,AY,AZ)`, `B=(BX,BY,BZ)`, `C=(CX,CY,CZ)`
(2.14 fixed point, identity = `0x4000` on `AX, BY, CZ`, `WSMATH.MAC:UNITV`), a velocity `V`, and a
position `T=(XT,YT,ZT)` in universe units.

* `PRESUB`/`PRE2` (universe → view): `view = [[AX,BX,CX],[AY,BY,CY],[AZ,BZ,CZ]] · (P − T)` (halved
  for `PRE2`). So the rows **A, B, C are the universe X, Y, Z axes expressed in view coordinates**,
  and the columns `(AX,BX,CX)`, `(AY,BY,CY)`, `(AZ,BZ,CZ)` are the ship's forward/right/up vectors
  in universe coordinates.
* `POST2` (view → universe, used for new stars): `P = Mᵀ · view + T`.
* `CONCAT` + `POSTADD` (`SWMP.DOC`): concatenates ship-2 (alien) orientation with ship-1 (player)
  so alien model vertices go straight to the player's view: `view = R1 · R2ᵀ · p + XT`.
* `AIMDTH` (`WSMAIN.MAC`) reads `M$AX/AY/AZ + M.S1` as "the Death Star direction": the Death Star
  lies at universe (0x4000, 0, 0) — along **universe +X** — and `VWDTHA` projects it as
  `512·AY/AX, 512·AZ/AX`.

### 3.3 Where things live
* **Space waves:** the player's position `T1` stays at the origin (`NW1SHP` zeroes it; `SMVSP1`
  only advances the star offset). The player only **rotates**. Aliens move in the universe frame
  along their own axes (`WSCPU.MAC:SNMVF` etc. — velocity += forward/64 per frame) and are
  transformed each frame via `PSB2` (centre) then `CONCAT/POSTADD` (vertices). Objects are therefore
  positioned in a **world frame**, and the camera is the player's orientation matrix.
* **Stars:** universe frame, but viewed through a *virtual viewer position* `(ST.UX, ST.UY, ST.UZ)`
  written into the downloaded ship-1 translation before the star pass and restored afterwards
  (`WSSTAR.MAC:VWSTAR`). In the dogfight `ST.UX = FRAME × 128` (`WSMAIN.MAC:S1MV`): the viewer
  slides along **universe +X** (toward the Death Star) at 128 universe units/frame regardless of
  where the ship is pointing; 256/frame in hyperspace (`S1MVHP`).
* **Ground / trench:** the player's `T1` moves (`S1MVGD`, `S1MVBS`), towers/panels are universe
  objects.

### 3.4 Rotation conventions (`SWMP.MAC:ROLL/PITCH/YAW`, applied to the A, B, C rows)
```
YAW  (+sin): x' = x cos − y sin ; y' = x sin + y cos     — world rotates ahead→right : ship yaws LEFT
PITCH(+sin): z' = z cos − x sin ; x' = z sin + x cos     — world ahead moves down     : ship pitches UP
ROLL (+sin): y' = y cos − z sin ; z' = y sin + z cos     — world rotates CCW on screen: ship rolls RIGHT
```
Rotations are intrinsic (about the ship's own up/right/forward axes since they act on view-frame
components). Per game frame the player's matrix is updated in the order: roll (if hit) → pitch → yaw
(`STWSP1` → `S1RL`, `S1RHPT`, `S1RHYW`), each by one quantum (§6). The alien-tracking code confirms
the signs: a target at +Y (right) gets a negative yaw sin (`AIMA`: `COMA` on Y) which yaws the ship
right; a target at +Z gets positive pitch sin which pitches up.

---

## 4. Yoke handling

### 4.1 Hardware and sampling (`WSGLOB.MAC`, `WSINT.MAC:DOPOTS`, `SW5.DOC`)
* ADC at `0x4380` (`R.CHN`), 8-bit result 0..255. Conversion started by writing `0x46C0` (channel
  0) or `0x46C1` (channel 1) — the code writes each strobe twice.
* IRQ every ≈ 4.2 ms (comment "12.*4.2MS==>50. MS, 20 PER SECOND" — game frame = 12 IRQs = 20 Hz).
  Each IRQ reads one channel and starts the other, so **each pot is sampled at ≈ 120 Hz**.
* `PT.VL1` ← channel 1 = **X / yaw pot** ("LEFT/RIGHT VG X"), `PT.VL2` ← channel 0 = **Y / pitch
  pot** ("UP/DOWN VG Y") (`WSINT.MAC:RHCTRL`; `TCTEST.MAC` calls channel 1 "X POT").
* Glitch filter ("POKEY FILTER"): the stored value moves only when two consecutive samples are
  both above (or both below) it, and then to the one **closer** to the stored value. Adds ≤ 1 sample
  of lag.

### 4.2 Normalisation (`WSINT.MAC:RHLIM`, per axis block `RHEOP` (pitch) / `RHEOY` (yaw))
* Self-calibrating: `RH$LO` tracks the lowest (deglitched) reading; `RH$SP` is a spread multiplier
  that is reduced when the scaled value overflows for ≥ 2 frames. Both are saved in NOVRAM
  (`POTSAV`) and perturbed (+1) at every game start (`PHISG2`) so they re-adapt.
* `scaled = (raw − LO) × (1 + SP/256)`, clamped to 1..255, then `NML = scaled − 128` →
  **signed −127..+127**, full travel of the pot ≈ full range.
* Clamp to the cursor limits (`RHCTRL`): yaw `NML ∈ [−112, +112]`, pitch `NML ∈ [−104, +120]`.

### 4.3 Cursor position and slew (`WSINT.MAC:RHPOS`, runs once per **VG frame**, not per game frame)
`RH$POS` is a 16-bit 8.8 fixed-point position (`VG.RSX`, `VG.RSY`), target = `NML + 0.5`:
```
err  = target − pos                                   (units of the ±128 range)
step = 0.375 × |err|   if |err| ≥ 64  (a quarter screen)
       0.1875 × |err|  otherwise      ("SLOWER WHEN CLOSER")
pos += sign(err) × step   (|err| rounded up so it "always slews some"; |err| capped at 248)
```
So the crosshair follows the yoke as a first-order lag with gain 0.19–0.375 per VG frame.
VG frame timing (`WSINT.MAC:DOVG`): after each restart `VGTIMR` is set to 5 and the VG is restarted
again only when the counter has gone negative (6 IRQs ≈ 25 ms) *and* the VG has halted, so the
**VG refresh is a nominal 40 Hz** (two VG frames per 20 Hz game frame; slower if a frame takes
longer than 25 ms to draw). The cursor lives in the VG RAM variable `VRSITE`, which is **not**
double-buffered, so it moves at 40 Hz while the 3D scene updates at 20 Hz. Time constant of the
lag (`τ = −T/ln(1−g)`, T = 25 ms): ≈ 53 ms for large errors (g = 0.375), ≈ 120 ms for small errors
(g = 0.1875).

### 4.4 Cursor on screen (`WSINT.MAC:GNSITE`, `WSSITE.MAC:VWCURC`, `WSVROM.MAC:VGSITE`)
```
VG.CX = pos_x × 4       (top 10 bits of the 8.8 value → ±512 range)
VG.CY = pos_y × 4
cursor screen position = (VG.CX, VG.CY + VGOFFY)      i.e. (VG.CX, VG.CY − 104)
```
Full deflection therefore puts the cursor at X = ±448, Y = +480 / −416 relative to the math centre
(the cursor half-size is 30 units; these leave a 32-unit margin to the `VGLIM*` limits). In angular
terms with f = 512 the crosshair reaches ±41.2° horizontally and +43.2° / −39.1° vertically.
Positive `NML` → cursor right / cursor up. The mainline copies these into `SI.CX/SI.CY`
(10-bit screen) and `SI.RSX/SI.RSY` (16-bit) once per game frame (`WSMAIN.MAC:VGTOSITE`).

### 4.5 Yoke → view rotation

**Space (dogfight, hyperspace):** none directly. `STWSP1` calls `AIM`, which sets the turn rates
`RH$RAT` from the position of the first live, non-glowing alien (or the Death Star direction,
`AIMDTH`) — the view auto-tracks the target. The yoke only moves the crosshair and shifts the
cockpit graphics (§4.7). Auto-aim law (`WSMAIN.MAC:AIMA`):
1. target centre in view coords (halved) `X, Y, Z`;
2. shift `Y, Z` left together with `X` until `X` would overflow (i.e. `X·2^(k−1) ∈ [16384, 32768)`),
   so `Y' ≈ (64..128)·(Y/X)`; if the target is behind, use the largest scale;
3. `RAT_yaw = −(high byte of Y')`, `RAT_pitch = high byte of Z'` (each −128..127).
4. Each game frame (`RHTRIG`): `residue += RAT/2` tics (saturating at ±127 tics).
5. `RHRSDU`: if `|residue| ≥ 78` rotate by 4.986° and subtract 78; else if `≥ 14` rotate 0.895° and
   subtract 14; else no rotation. The leftover (< 14 tics) is applied for display only (`RESIDU`).

Resulting turn rate ≈ `(32..64) × tan(offset angle)` tics/frame = `2.0..4.1°/frame` per unit
tangent = **0.71–1.43 rad/s per unit tan(angle)** at 20 Hz, saturating at 63.5 tics/frame =
4.06°/frame = **81°/s (1.42 rad/s)**. A proportional pursuit with a ~1 s time constant.

Being hit rolls the view 4.48°/frame for `S.ROL` frames (`STWSP1`: sin = 0x4FF).

**Ground (tower) phase** (`S1TWGD`, `S1MVGD`): no yaw/pitch; the view direction stays along
universe +X.
* Bank (roll) target = `2 × RSX` tics (+ 32 tics per count of hit-roll `S.ROL`): full deflection
  ±127 → ±254 tics = **±16.2° (±0.283 rad)**; per unit of `NML`: 0.128° (2.23 mrad). Slewed toward
  the target at ≤ 16 tics/frame = 1.02°/frame = **20.5°/s** (collision roll: ≤ 50 tics/frame =
  64°/s). Positive `RSX` (yoke right) → bank right (world rotates CCW on screen).
* Lateral velocity `VY = VX × |RSX| / 128` (signed) — at full deflection sideways speed = forward
  speed ("FASTEST IS AT 45 DEGREES"), i.e. the ship slides right when the yoke is right.
* Vertical velocity `VZ = VX × |RSY| / 256` (signed); altitude clamped to `512..7168`.
  Forward speed `VX` ramps by +1/frame up to 1024/frame.

**Trench** (`S1TWBS` is empty, `S1MVBS`): no rotation at all; `VY = VX × |RSX| / 256`
(clamped to Y ∈ ±511), `VZ = VX × |RSY| / 128` (Z ∈ [−3583, −257]).

### 4.6 Effect on object positions
In space the yoke never moves or rotates the scene; TIE fighters "slide" only because the auto-aim
rotates the camera toward them. In ground/trench the yoke translates the camera (objects slide
opposite to the deflection, perspective-correctly) and, on the ground, rolls it.

### 4.7 Cockpit / hood shift (`WSSITE.MAC:VWPLAN`)
The X-wing nose/gun graphics drawn at the bottom are offset by `RSX × 110/256` X-units
(≤ ±55) and `RSY × 80/256` Y-units (≤ ±40), same sign as the cursor; these offsets (`LZ.GX`,
`LZ.GY`) are also the origin of the player's laser bolts.

### 4.8 Sign conventions (as far as the software determines them)
* Higher ADC value on channel 1 → cursor right → (ground) slide right and bank right → (space)
  hood graphics shift right.
* Higher ADC value on channel 0 → cursor up → (ground) climb.
* Whether "push forward" or "pull back" produces the higher ADC value is a wiring question not
  visible in the source (attract mode: `SI.RSX ≤ −96` → instructions page, `≥ +96` → high scores,
  `WSMAIN.MAC:STRTCK`).

---

## 5. The star field (`WSSTAR.MAC`, `WSMAIN.MAC:ISTAR`)
* **50 stars** (`M$STNM = 50`), each a 16-bit universe point (X,Y,Z) in mathbox RAM `M.STAD`.
  Initialised to fully random 16-bit coordinates (`ISTAR`).
* Each frame (`VWSTAR`), with the virtual viewer translation (§3.3): transform with `PSB2`
  (halved view coords); the star is drawn iff `256 < X ≤ 4095` **and** `Y² < X²` **and**
  `Z² < X²` (a ±45° cone, i.e. the ±512 logical viewport). Screen position = `512·Y/X, 512·Z/X`
  (plus `VGOFFY`), drawn as a dot (`VGSTAR` = zero-length lit vector), white with brightness
  `ST.BRT` (0x80 normal), bucketed into a 4×4 grid of screen sectors to shorten beam moves.
* A star that fails the test is immediately **regenerated** (`STARNW`) at a random point in the
  view frustum: view `X = 0..8191`, `Y = ±(0..7905)`, `Z = ±(0..7905)` (products of random bytes,
  the sign chosen opposite to the previous star's Y/Z so the field stays balanced), converted to
  universe coordinates with `POST2`. So it is a **streaming random field**, not a fixed sphere.
* Motion in the dogfight: the viewer advances 128 universe units/frame along universe +X
  (`ST.UX = FRAME<<7`), so stars stream toward and past the player at a constant rate (from max
  distance to the near plane in ≈ 3 s), independent of where the ship points. Attract screens use
  other constant drifts (`SMVBNR`, `SMVINS`, `SMVSCR`, `SMVHIS`: ±128/frame on X/Y/Z).
* Response to the yoke: **none** in space (only the auto-aim camera rotation moves them). Ground
  version `VWSTRG` places stars far ahead on the ground plane (`STRNWG`: Z = 0, X ≥ 0x7000) so they
  act as a horizon.

---

## 6. Angle representation and precision

* Sines/cosines are 2.14 fixed point, `0x4000 = 1.0`; the mathbox rotates by a full 2×2 rotation
  with rounding (`+ 1/2 LSB` via `C40 = 0x40`, `C80 = 0x80`).
* **Tic table** `WSMAIN.MAC:TRHTIC` (78 entries): entry n = (sin, cos) of n tics; tic 1 = sin 18
  (0.064°), tic 14 = sin 256 (0.895°), tic 78 = sin 1424 (4.986°). **1 tic ≈ 0.0639° ≈ 1.116
  mrad.** The cosine is stored as a 1-byte offset from `0x4000`.
* Player rotation quanta (`RHRSDU`): 78 tics (sin 0x590 = 1424, cos 0x3FC2) and 14 tics (sin 0x100,
  cos 0x3FFE). The displayed orientation adds the exact sub-quantum residue every frame (`RESIDU` on
  the downloaded copy of the matrix), so the effective angular resolution seen on screen is **1 tic**
  while the stored matrix only changes in 0.895°/4.986° steps.
* Other fixed angles: hit roll 4.48° (0x4FF/0x3FCE); `IMATH` default 0.895° (0x21F/0x3FF7 — note the
  comment says .895 but 0x21F = 543 → 1.90°); ground→trench transition roll 10.55° (3000/16107);
  alien turn table `WSCPU.MAC:TSNGLE` = 0.63°, 0.90°, 1.27°, 1.90°, 3.47°, 4.48°, 4.99°, 4.99° per
  frame (the CPU uses entry 5 = 4.48°/frame for all alien manoeuvres).
* Because matrices are built by repeated 2.14 rotations with rounding, they drift slightly; they are
  reset to identity per ship at wave start (`UNITV`).

### 6.1 Summary of yoke / rotation constants (radians)

| Quantity | Value |
|---|---|
| 1 tic | 1.116 × 10⁻³ rad (0.0639°) |
| small quantum (14 tics) | 0.01563 rad (0.895°) |
| large quantum (78 tics) | 0.08702 rad (4.986°) |
| auto-aim max rate | 0.0708 rad/frame = 1.42 rad/s (81°/s) |
| auto-aim gain | ≈ 0.036–0.071 rad/frame per unit tan(offset) = 0.71–1.43 rad/s per unit tan |
| hit roll (space) | 0.0782 rad/frame (4.48°) per `S.ROL` count |
| ground bank per full yoke deflection | 0.283 rad (16.2°) — 2.23 mrad per NML unit |
| ground bank slew | 0.0179 rad/frame (1.02°) = 0.357 rad/s; collision 0.0558 rad/frame |
| cursor per full deflection | ±448 X-units (= ±0.875 of half-frustum, 41.2°); +480/−416 Y-units |
| cursor slew | 0.375 (far) / 0.1875 (near) of remaining error per 40 Hz VG frame (τ ≈ 53 / 120 ms) |

---

## 7. Per-frame order in the space wave (`WSMAIN.MAC:PHESP1`)
1. `VIEW`: download ship-1 matrix + apply residues (`IS1UV`, `RESIDU`) → draw HUD, Death Star
   miniature, cursor/cockpit (`VWSITE`), stars (`VWSTAR`), explosions, aliens (`SNVW` →
   `S2VW`: `PSB2`, `CONCAT`, `OBJBPNT`, `OBJDRW`), guns, lasers, glow → `VGDONE` (swap buffer).
2. Gun shots, glow, fuel.
3. `CPU`: alien choreography/movement.
4. `VGTOSITE`: latch IRQ cursor into `SI.*`.
5. `STWSP1`: hit-roll, `AIM` → pitch/yaw quanta on ship 1.
6. `IS1UV`, `SMVSP1` (advance star offset).

---

## 8. Open questions
1. **Physical extents / calibration.** The exact visible window in VG units depends on monitor
   size-pot adjustment; the source bounds it to X ±480..±510, Y +552..+600 / −552..−612. The 4:3 +
   2/3-unit assumption gives `Wx ≈ 495, Hy ≈ 557`. Confirm against cabinet photos / the self-test
   crosshatch, or expose `Wx, Hy` as tunables.
2. **Is the 2/3 vertical squash really what players saw?** All evidence (ASPECT macro, pot test
   comment) says the raw Y unit is 2/3 of the X unit and the 3D pipeline does not compensate. Verify
   with footage (a head-on TIE wing panel should look wider than tall) before choosing option A vs B.
3. **Yoke polarity.** Which physical direction raises the ADC value on each channel (push forward =
   up or down?) is hardware wiring; not determinable from the source.
4. **VG refresh rate**, which sets the cursor slew speed (0.19–0.375 of the error per VG frame).
   Nominally 40 Hz from the `VGTIMR = 5` reload (6 IRQs), but it stretches whenever a frame takes
   more than 25 ms to draw; measure on hardware/MAME or make the cursor time constant a tunable
   (≈ 50–120 ms).
5. **IRQ period.** The 4.2 ms figure comes from a source comment; the 20 Hz game rate is derived
   from it (12 IRQs/frame).
6. **`HALF = 0xE000` in `PRE2`.** As a 2.14 number it is −0.5, yet the game logic (stars must stay in
   front) requires the effective factor to be +0.5; `SWMP.DOC` flags it ("actually −1/2"). The
   multiplier evidently treats it as +½; treated as such here.
7. **`IMATH` default angle**: constant 0x21F is 1.90° although commented ".895 degrees" (harmless,
   overwritten before use).
8. Whether to reproduce the original's near-plane artefacts (13-bit vector wrap, un-guarded
   vertices with X ≤ 256) or clip cleanly.
