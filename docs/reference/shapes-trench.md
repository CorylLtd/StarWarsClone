# Star Wars (Atari 1983) – Death Star TRENCH stage (phases G0B/G1B/BS, DX1–3, NXT), decoded from source

Companion to `shapes-trench.json` (built by `decode_trench.py` from `raw_decoded.json` + `WSBASE.MAC`).
Conventions as before: mathbox/world frame X forward, Y right, Z up (left-handed); screen VG units, +X right,
+Y up, 3-D centre at `VGOFFY = −104`; hex unless a trailing dot.

## 1. Trench coordinate frame and units (correction)

World units are the player's `M$TX/TY/TZ`. The trench runs along +X; **walls at Y = ±400, floor at Z = −1000,
top edge at Z = 0** – 2048 world units wide and 4096 deep. (My dogfight note called these "halved" values;
they are world values that `PRE2` halves to ±200 / −800 for the mathbox.) The player is clamped to
Y ∈ [−1FF, 1FF], Z ∈ [−DFF, −101] (`S1MVBS`), speed starts at 300, X wraps every 8000 (16-entry panel ring).

Trench objects (`WPN`, `WGA/WGB`, `WFF/WFG`, `PORT`) are ground-type pictures: `.PH/.P` with `.S = 8`
("NOTE HALF SIZE DUE TO PSUB LACK OF DIV2"), rotated by `BJGROT` (left wall) or `BJFROT` (right wall –
model Y negated) with `PRESUB` (unhalved) and added to a `PRE2`-halved centre. Hence **1 model unit = 8
halved-view units = 16 world units**. Model axes: x forward, y = out from the wall toward the trench
centre, z up.

## 2. The objects (`WSOBJ.MAC`, PLOT/DRAWTO routines)

| JSON key | Table / picture | Panel value | Colour | Geometry |
|---|---|---|---|---|
| `wallPanel_WPN` | `.WP WPN` / `.WGD WPN` (1803) | 1 | GREEN 80 | outer rect ±32×±24 (±512×±384 world) with inner rect ±16×±8, in the wall plane |
| `wallGunTurret_WGA_WGB` | `.WP WGA` / `.WGD WGA`, `WGB` alias (1780) | 3 | RED 80 | 64×48 base rectangle on the wall, gun body box protruding 4..12 units (up to 192 world), nozzle |
| `catwalk_WFF` | `.WP WFF` / `.WGD WFF` (1818) | 2 | caller: YLW/TRQ/PRP cue, lum 88→40 | girder from the wall to y = 64 = **half the trench width**; front edge at x=−32 mid-height, top/bottom edges at x=0, z=±32 |
| `catwalkCollided_WFG` | alias of WFF / `.WGD WFG` (1830) | – | VJFLS flash | same points, drawn for the collision frame (contains a bogus index 6) |
| `exhaustPort_PORT` | `.WP PORT` / `.WGD PORT` (1855) | – | GREEN base / TRQ berm / RED FF porthole | three concentric squares ±32, ±20, ±12 (±512/±320/±192 world) flat on the floor with spokes |

Which is which: **WGA and WGB are the same picture** (WGB is a `.WPZ2/.WGD2` alias, "type B" never differs);
**WPN is the decorative panel** (shootable for 50 pts); **WFF is the catwalk** ("wall force field"), WFG its
flash variant. All line lists, draw order (which point `PLOT` starts from) and colour words are in the JSON.
`WPN/WGA/WFF` emit **no SCALE word** (unlike the surface towers) – no distance shrink; `PORT` emits `VGSCAL`.

No trench objects explode: `LZHPN` (laser hits a panel or turret) only clears the panel's 2-bit flag and
scores. `BGWGXP` is the same entry as `BGBKXP` and the `WG1..3` fragment shapes are never dispatched; they are
included in the JSON for completeness.

## 3. How the trench itself is drawn (`WSBASE.MAC VWBASE`, `WSPANL.MAC VWPANEL`)

Per frame (`VEWBS`): HUD → cursor/cockpit → `VWBASE` → fireballs → laser collisions (`CLBLZ`) → bolts →
torpedoes → windshield flash. There are **no stars, no floor grid and no ceiling** in the trench.

`VWBASE` = `VWPANEL` + `BSVBOT` + `BSVSID` + `BSVFAR` (+ `BSVPORT`, `BSVEND` when flagged):

* **Six longitudinal edges** (`BSVBOT`, GREEN lum 70): the two wall-top edges (Y=±400, Z=0) and four floor
  lines (Y=±400 and ±200, Z=−1000), each drawn from a far point 7000 ahead (or the trench end) back to a
  near point at X = max(200, |ΔY|, |ΔZ|) – i.e. clipped to the 45° cone.
* **Wall verticals** (`BSVSID`, GREEN 60): at every wedge boundary (spacing 800 for SHORT, 1000 for LONG
  wedges) a line from the floor to the top edge on each wall, up to 7000 ahead; the nearest, partly passed
  one has its bottom raised so it never drops more than ≈63° below the eye. These verticals are the
  "scrolling" structure of the trench.
* **Far cross-section** (`BSVFAR`, GREEN 50): the U (−400,0)→(−400,−1000)→(400,−1000)→(400,0) at 7000 ahead
  (or at the end).
* **End wall** (`BSVEND`, GREEN 80): a horizontal line at the end location between the walls, at Z = 0 once
  the end is within 7000 (rising from the floor before that).
* **Panels** (`VWPANEL`): three passes (WPN, WFF, WGA), each for the left then the right wall, walking the
  16-entry descriptor rings `PNLW`/`PNRW` from the player's segment for 14 segments (7000). Segment centre
  X = (X & F800) + 400, wall Y = ∓400, four levels with centres Z = −E00, −A00, −600, −200 (each 400 tall; the
  descriptor's 2-bit fields are read LSB-first = bottom level first; values 0/1/2/3 as above). Panels nearer
  than 1000 use `BJBCLP`, the rest `BJGPNT`; then `BJGDRW`.
* **Clipping** (`BJBCLP`): the divider quotient is forced to 7FFF when the unsigned result ≤ 100 (point at or
  behind the eye) and screen coordinates are clamped to the hard edges **±24**: X ∈ [−534, 534], Y (before the
  −104 offset) ∈ [−484, 728]. `BJGCLP` (surface) uses ±512 instead. No hidden-line removal or other depth
  tricks exist; the only depth cue is the catwalk colour: each successive catwalk-bearing wedge cycles the
  colour YLW→TRQ→PRP (`TFFCUE`, index bumped as wedges are passed) and is 8 dimmer (lum 88 nearest, min 40).

Trench layout data: a **pie** (`PIE1..11`, one per wave; random `RPIE` beyond) is a list of **wedges**
(`TWDG01..99`), each wedge a list of SHORT (800) / LONG (1000) rows `a1..a4 b1..b4` = left/right wall,
top→bottom panel values, ending in NEXT (continue with the pie's next wedge) or PORT+END. Every pie starts
with wedge 10 (24 decorative panels) and alternates divider wedges (92–97: catwalk dividers) with flying
sections, ending in 98 (easy port), 99 (hard port, 16 guns) or 29. All tables are in the JSON. Generation
keeps ≈6000 of trench ahead (`DOFAR/NWFAR`), clearing the ring slot behind the player (`VWBASE`).

## 4. Exhaust port, torpedoes, "the force"

* The PORT wedge sets `BS.PLC` (X of the port) and `BS.PFL`; `BSVPORT` draws `PORT` at (PLC, 0, −1000) while
  within 7000 halved ahead, switching it off 200 halved behind. It is drawn at normal scale (no LOD).
* Trigger (`CLBLZ`): a laser bolt whose floor hit lands within ±200 of the port in X and Y (port in view,
  `PT.LZF` clear) sets `PT.LZF` → `FRPTGN`: two proton torpedoes start at the player (+100 ahead), Y ±80,
  all base guns are killed. Motion (`MVPTGN`): X += 300 + VX up to PLC; Z = min(Z, (PLC−X) − 1000) (45° glide
  into the hole); |Y| ≤ (PLC−X)/16 (converges to the midline).
* Picture (`PTVW`): TURQUOISE lum FF, distance-scaled `VJGNT` pinwheel stamp (the fireball tip, GNT0..3 in
  `shapes-dogfight.json`), centred at the projected torpedo position.
* "Use the force": `Q.FRC` = 0 on entry; firing the lasers at all sets it −1; reaching the PORT wedge with
  it still 0 scores the level bonus (500/1000/2500/5000/10000) and shows the amount + " FOR USING THE FORCE".
  While it is 0 the text "USE THE FORCE" (cycling colour, lower-left (−152, 336)) is on screen.
* End (`PHEBS`): when the end wall is within 800: torpedo live → DX1; otherwise nose-bash (crash sound, glow,
  shield loss) and the trench repeats harder (`B0B`, force bonus disabled, "EXHAUST PORT MISSED" 2× for 4 s).

## 5. Death Star explosion (DX1 → DX2 → DX3 → NXT)

* **DX1** (`VEWDX1`): identity matrix; the detailed Death Star pictures (`VJBCIR`, `VJBTRN`, `VJBDSH`,
  `VJBNSD`, `VJBFRM` + city lights; strokes in `shapes-hud.json`) drawn by `VWDTHB` at SCALE `DT.SCL` from
  7304 (half default size) receding by the high byte of `DT.STP` (0A, −1 every 16 frames) per frame until
  ≥ 7680 (the player flies away). The force score text stays. No star streaks (stars are re-seeded but not drawn).
* **DX2** (`VEWDX2`): the miniature `VJBMIN` at (0, −104) at default scale, plus `VWXPLN` phase 0: growing
  count (1,3,…,3F) of RED concentric circles (`VJBCR2`, raw radius 1600) stamped at (0,−104) from scale word
  76F0 stepping −2 per circle ("dim to bright"). At 3F: `AUDDF`, phase 1.
* **DX3** (`VEWDX3`): phases 1–3 of `VWXPLN` – BLUE circles (FF) with RED remainder and RED expansion rings
  (`DRING`, 4 scale steps apart, base 7670 − 8·count), then WHITE circles with BLUE rings, then continuously
  expanding WHITE rings (scale 7500 + count, count 80→8 by 4). Formulas are in the JSON; the absolute sizes
  depend on the AVG linear-scale law ((256−L)/256 per the `SCAL` macro comment) and should be calibrated.
* **NXT** (`VEWNXT`): "DEATH STAR DESTROYED", energy bonus lines, star field with the player turned 180° and
  `ST.UX` advancing FRAME·128 per frame (fast dots – **no streak vectors exist**), then the next wave.

## 6. Messages (TCMES `.MESS` lower-left positions, VG units)

"USE THE FORCE" (−152, 336, cycling); "n FOR USING THE FORCE" after the score at (−320, 384); "EXHAUST PORT
AHEAD" (2×, (−212,156)→(−424,312), first wave only); "EXHAUST PORT MISSED" (2×, (−224,156)); "SHOOT
FIREBALLS" (WHT, (−176,384)) / "AVOID CATWALKS" (RED, (−164,384)) alternating for 8 s on the first wave;
"DEATH STAR DESTROYED" (−236,312); "BONUS FOR REMAINING ENERGY" (−308,192) + "5,000  X" (−128,144) + count at
(112,144); "n ADDED TO DEFLECTOR SHIELD" (−272,72) / "SHIELD AT FULL STRENGTH"; "STARTING WAVE BONUS"
(−224,−48). "GREAT SHOT KID" is speech only; "THE FORCE IS WITH YOU" belongs to the high-score screen.

## 7. Entry dive and player motion

From the surface: G0B drops the player by 180 per frame while above Z=380, then G1B drops 100 per frame to
−E00+100 while rolling 10.55°/frame for 17 frames per phase (two half rolls = the barrel roll into the
trench); the trench is drawn during G1B. From space (S0B) the trench starts directly. In the trench the stick
gives lateral/vertical velocity ∝ VX·|stick| (`S1MVBS`) within the clamps above; `VGTOSITE` keeps the cursor.

## 8. Conversion to Three.js

`three = (Y, Z, −X)`. Walls at three.x = ±400, floor three.y = −1000, top 0, running along −three.z.
Panel centres: three.x = ∓400 (left/right), three.y = level centre, three.z = −segX; model vertices
`modelUnits × 16` world units with y pointing toward the trench centre (mirror for the right wall). Port at
(0, −1000, −PLC). Camera = player matrix, focal 512, screen Y offset −104, plus the aspect caveat from
`shapes-dogfight.md` §4.

## 9. Open questions

1. `WFG` index 6 reads a stale projected point; the exact stray vector is undefined – drop it.
2. Catwalk vertical extent (z ±32 model = ±512 world, i.e. a 1024-tall girder in a 1024-tall panel cell) is
   what the table says; visually it looks like a slab because of the Y-squash – verify against MAME.
3. Explosion ring sizes depend on the AVG scale law; the JSON gives the scale words, not pixel radii.
4. Random pies (`RPIE`, waves ≥ 12) draw wedge numbers from `TWDGXX`; the table is included but the exact
   RNG use was not traced.
5. Laser/panel hit geometry (`LZCPNW`, panel 300 wide + 80 laser diameter per 800 segment) is summarised, not
   fully transcribed.
