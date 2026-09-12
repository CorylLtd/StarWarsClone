# Star Wars (Atari 1983) – Death Star SURFACE stage (phase GD), decoded from source

Companion to `shapes-surface.json` (built by `decode_surface.py` from `raw_decoded.json` + `WSGRND.MAC`).
Conventions as in `shapes-dogfight.md`: mathbox frame X forward, Y right, Z up (left-handed); screen VG units
+X right, +Y up, 3-D centre at `VGOFFY = −104`; hex unless a trailing dot.

## 1. What the surface stage draws (`WSMAIN.MAC VEWGD`)

Per frame: `VWMES` (score/wave) → `VWMTWR` (tower messages) → `VWGAS` (shield) → `VWSITE` (cursor + cockpit)
→ `VWSTRG` (green ground dots) → `VWGUN` (fireballs) → `VWGRND` (buildings) → `CLGLZ` (laser hits) → `VWLAZ`
(bolts) → `VWXPLD` (fragments) → `VWGLW` (windshield flash). Cursor, lasers, cockpit, gauge and fireball
stamps are identical to the dogfight (see the earlier findings).

**There is no ground grid, horizon line or mesh.** The "surface" is the world plane Z = 0, shown only by
≈50 green dots streaming past (`VWSTRG`) and by the buildings standing on it. The mathbox horizon microcode
(`HZN/HZN2`) is never invoked by the game. No hyperspace star streaks enter the surface; the transition
into the ground phase is the growing Death Star (`VWDTHB`, see `shapes-hud.md`) while the space stars dim
(`ST.BRT −= 2` per frame), then `ISTARG` re-seeds the 50 star records as ground dots.

## 2. Units and the `GD$MDT` offset

* World/universe units = the player's `M$TX/TY/TZ`. Player altitude is clamped to `[GD$MNT=200, GD$MXT=1C00]`
  (`S1MVGD`), forward speed 100 → 400 (+1/frame). `GD$MDT = 1C00−200/2+200` evaluated left-to-right by
  MACRO-11 = **0F00** ("middle of the allowed vertical traverse").
* Ground objects are `.PGND x,y,z` with `.S = 30.*4 = 120`: ROM words `(x·120, y·120, z·120 − 0F00)`.
* The map places each building's centre at `(TGD$X, TGD$Y, GD$MDT·2 = 1E00)` world and runs `PRE2`
  (`M$PSB2`), which **halves** the centre → view-space `(XP, YP, 0F00)`. The rotated model points
  (`BJGROT` uses `PRESUB`, **not halved**) are added to that halved centre (`PER2I/PER2`), so the model's
  `z·120 − 0F00` puts z = 0 exactly on the ground and **1 model unit = 120 halved-view units = 240 world
  units**. Tower height 58 → 13 920 world (twice the player's ceiling: you fly *among* the towers);
  bunker height 6 → 1 440 world (can be overflown; collision if lower). The collision code confirms the
  factor everywhere (`6*120.*2`, `58*120.*2`, `4*120.*2` "HITE*SCALE*PSUB2").
* Fragments (`TW1..3`, `BK1..3`, `.S = 12`) go through the ship pipeline (halved centre + unhalved model) so
  1 fragment unit = 24 world units.

## 3. The building model (`.WP GND`, 16 points shared by TWR / STB / BNK)

```
 0 (0,0,0) centre on ground        4 (-4,0,58) 5 (0,4,58) 6 (0,-4,58)   top of hat
 1 (-8,0,0) FRONT (−x, faces player)  7 (-4,0,52) 8 (0,4,52) 9 (0,-4,52)   bottom of hat
 2 (0,8,0) LEFT (+y)  3 (0,-8,0) RIGHT  10..12 (r=5, z=14) midline   13..15 (r=6, z=6) near bottom
```
Only three sides (front, +y, −y) exist – there are no back edges because buildings are always seen from
the front (the map wraps so everything is ahead).

* **Laser tower** (`.WGD TWR`, also used for id GND): base part in `M.GDCB`: 1-3, 3-15, 15-12, 12-9, 7-10,
  10-13, 13-1, 1-2, 2-14, 14-11, 11-8; **top ("hat") part** in `M.GDCT`: 9-6, 6-4, 4-7, 8-5, 5-4, 7-9, 7-8.
  The hat is the triangular prism between z = 52 and z = 58 (front edges only). Draw order in the JSON.
* **Stub** (`.WGD STB`): the tower with the hat removed; same base lines plus 9-7 and 8-7 closing the top,
  all in `M.GDCB`. Selected by `GDVIEW` when the tower is damaged (`TYP$DM`) or its hat flag `TYP$BK` is
  clear (`M.GDCT` is then set to black and unused).
* **Bunker** (`.WGD BNK`): points 1,2,3 and 13,14,15 only: 1-2, 2-14, 14-13, 13-1, 1-3, 3-15, 15-13, 14-15 –
  the bottom 6 units of the same spire ("SHORTY"), all in `M.GDCT`.
* `WPN`, `WGA/WGB`, `WFF/WFG`, `PORT` are **trench** objects (`WSBASE/WSPANL`), not used on the surface.
* Bishop (`PC$BSH`) buildings use the tower picture; they differ only in firing (diagonal shots only).

Colours (`GDVIEW`): `M.GDCB` = YELLOW, lum `40 + (FF − 4·XPhi)/4` (0x40 far … 0x7F near); `M.GDCT` = WHITE 80
for an intact hat, RED 60 (`VGCOPC−20`) for an intact lone bunker, black when damaged; `VJFLS` (cycling
colours at FF) on the frame of a collision with the player. All vectors intensity 7.

## 4. Draw routine semantics

1. `BJGROT` (once per frame, id GND): each ROM point → `PRESUB` with the player's matrix and zero translation
   → rotated `(XR, YR, ZR)` in a 16-byte block per point at `M.GDFE + 16n` (offsets +6/+18/+1A; the same
   block later receives the screen result at +1C = `M.GDXS`). Pure attitude rotation; buildings have no
   orientation of their own. (`BJFROT` is the same with Y negated – trench mirror – unused here.)
2. `VWGRND` per map entry whose awakening sequence ≤ `GD.SEQ`: centre → `PRE2`; if XP < 0 it is wrapped with
   `AND 3FFF` (the map repeats every **8000** world units forward); visible iff `100 ≤ XP < 3C00` and
   `|YP| < XP`. Then `GDVIEW`.
3. `BJGPNT` (or `BJGCLP` when `XPhi ≤ 8`, i.e. nearer than 900 halved): negate XP/YP/ZP; for each point
   `XT = XR + XP` (`PER2I`), divider `Q = 200/XT`, `PER2`: `XS = (YR+YP)·Q`, `YS = (ZR+ZP)·Q` ⇒
   **screen = 512·(YR+YP)/(XR+XP), 512·(ZR+ZP)/(XR+XP)**. `BJGCLP` additionally forces `Q = 7FFF` when the
   unsigned quotient ≤ 100 (point at/behind the eye, X ≤ 100 → "negative quotient") and clamps every
   screen X to ±(510+512) = ±1022 and screen Y to [−612+104−512, 600+104+512] = [−1020, 1216] (before the
   −104 offset is applied by PLOT). The trench version `BJBCLP` uses ±24 instead of ±512.
4. `BJGDRW` → the `.WGD` routine (`PLOT`/`DRAWTO` macros in `WSOBJ.MAC`): `PLOT 0` = blank long vector from the
   centred beam to point 0's screen position (dy = YS₀ + VGOFFY, dx = XS₀); then the `SCALE` word `M.GDSC`;
   then `COLOR` words and relative long vectors between consecutive projected points (intensity 7,
   `BDRAWTO` first one blank); `ENDPLOT` = `VGSCAL`, `VGCNTR`.
5. **Distance scale**: `M.GDSC = 7200 | 4·XPhi` – a VG *linear* scale L ≈ XP/64 applied after the move to
   point 0, so the object is shrunk **about its ground centre** by ≈ (256−L)/256 = 1 − X_world/8000. At the
   far limit (XP = 3C00) buildings appear at 1/16 of their perspective size and grow to full size as they
   approach – an intentional LOD/fog effect (the laser hit test compensates: "ADJUST FOR LINEAR SCALE
   EFFECT"). A faithful recreation should reproduce it (scale the model about its base by
   `1 − X_view_halved/0x4000`).

## 5. Ground dots (`WSSTAR.MAC VWSTRG / STRNWG`, `WSMAIN ISTARG`)

50 records (X, Y, Z) in mathbox RAM; `ISTARG` seeds X, Y with 16-bit randoms and Z = 0. Each frame every dot
is transformed with `PRE2` (player matrix + real position) and drawn iff `XP > 100`, `YP² < XP²`, `ZP² < XP²`
(90° cone, no far limit) as a GREEN lum 80 intensity-7 dot (`VGSTAR`), projected with 512·Y/X, 512·Z/X,
relative to (0, VGOFFY). A dot that fails is respawned (`STRNWG`) at `X = playerX + (rnd&7F | 70)<<8 | rnd`
(7000..7FFF ahead), `Y = playerY ± ((rnd&7F)<<8 | rnd)` on the side opposite its last view Y, `Z = 0`.

## 6. Mazes, sequencing, messages, guns

* `WSGRND.MAC` holds 10 base mazes (+"T3" extensions with 4 more towers) of up to 32 entries
  `TOWER/BISHOP/BUNKER x,y,seq` – x = +right (mathbox Y), y = forward (mathbox X), hex world units, seq = the
  wrap count at which the building "awakens". Wave→maze: 2 BUNK, 3 SQUARE, 4 CLUSTR, 5 TURNON, 6 WEDGE, 7 DIFF,
  8 TRAP, 9 SYMTRC, 10 VALLEY, 11 TWRCTY, 12–20 the T3 versions, ≥21 random among the last six. All tables
  are in the JSON.
* The player's X wraps at 8000 (`S1MVGD` overflow) → `GD.SEQ++`; buildings with seq ≤ GD.SEQ are live;
  when a building is off-screen it is (re)armed alive/aiming, keeping `TYP$DM`; damaged bunkers stay hidden.
  At `GD.SEQ = 5` guns are killed (`Q.KTW`) and after one more pass the trench phase starts.
* Collisions with the player: tower – `XP − 200 − VX ≤ 0` (any altitude): flash, shield glow, roll ±20,
  `AUDCR`; bunker – only if altitude < 1440 world and within 400+VX.
* Laser hits (`GRLZCL`): screen-space test against the un-rotated cursor; tower hat (z 52..58) or bunker →
  `GDHTGB`: `TYP$DM`, fragments (`BGTWXP` at height 14 400 / `BGBKXP` at 720 world), score (`SCRTWR`: 200 +200
  per tower, `SCRBNK`); tower body → yellow full-surface splash only.
* Messages (`VWMTWR`, only when `GD.WAV > 0`): "POINTS NEXT TOWER" RED (−128,384) + value GREEN (−304,384)
  flashing 3/4 duty, or "50,000 FOR SHOOTING ALL TOWERS"; "TOWERS" RED (314,444) + count GREEN (360,408);
  "CLEARED ALL LASER TOWERS" cycling colour (−284,384) when all tops are hit (+5000).
* Guns: towers fire forward/diagonal fireballs from their map position at the player's altitude, only while
  the top straddles/crosses the player's horizon (`GDTWRGN`); bishops diagonal only; bunkers from height
  200 with probability falling with distance. Same GNB/GNT stamps as the dogfight.

## 7. Fragments (`WSXPLD.MAC BGTWXP/BGBKXP`, `MVTW*/MVBK*`, `VWTWN`)

Three pieces per hit (left / centre / right; `TW1/TW2/TW3` are 6- and 8-point slabs, `BK1..3` 6-point slabs,
`.S=12`), spawned at the building's position (Y ∓ 200 for the side pieces, X + 200 for the centre one) with
velocities toward the player (ΔX/32, ΔY/32 with ±3F00 lateral bias, upward (200|rnd)·4 for tower pieces,
(300|rnd)·4 for bunker pieces), then gravity −200(dec)/frame, 1/32 friction, Z clamped at 0; 20(hex) frames.
Drawn WHITE (tower) / RED (bunker), lum 80 fading to 16·timer over the last 7 frames; the beam is first put at
the piece's ground projection (`OBJCEN` on (CX, CY, 0)), then the same `7200 | 4·XThi` distance scale, then the
OBJDRW pipeline with the tumbling `MUNGE` matrix. Vertices/lines in the JSON (`fragments.*`).

## 8. Conversion to Three.js

Same mapping as before: `three = (Y_mb, Z_mb, −X_mb)` (right, up, −forward). For a building at map entry
(x_right, y_fwd): world position `(X = y_fwd, Y = x_right, Z = 0)`, model vertices `modelUnits × 240` world
units (z already measured from the ground), no rotation. Camera = player matrix, focal 512 VG units, screen Y
offset −104, plus the aspect caveat from `shapes-dogfight.md` §4. Apply the distance shrink about the base
and the yellow lum fade if you want the original look.

## 9. Open questions

1. The `GD$MDT` expression relies on MACRO-11's left-to-right evaluation; the assembled value (0F00) is
   confirmed by `WSOBJ.MAC`, but the comment "MIDDLE OF ALLOWED TOWER TRAVERSE" only makes sense as 0F00.
2. Ground dots: the exact byte packing in `STRNWG` (`LDA RND.S3; ANDA #7F; …; LDB RND.S2` reuse) is read as
   `(rnd3&7F)<<8 | rnd2`; the lateral range is therefore ±7FFF – verify visually.
3. The linear-scale shrink of far buildings and its pivot (point 0) is inferred from the macro order
   (`PLOT` before `MOVD M.GDSC`); the AVG's exact linear-scale formula ((256−L)/256) is from the `SCAL` macro
   comment.
4. Player lateral/vertical response to the stick (`S1MVGD`) was only summarised, not extracted exactly.
5. `WGA/WGB/WPN/WFF/PORT` exist in `raw_decoded.json` but belong to the trench stage; not documented here.
