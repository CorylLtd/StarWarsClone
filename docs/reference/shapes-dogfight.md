# Star Wars (Atari 1983) – Dogfight stage shapes, decoded from the 6809 source

Companion to `shapes-dogfight.json` (machine readable) and `decode_shapes.py` / `assemble.py`
(the scripts that produced it – re-run them against the source tree to regenerate).

All numbers below are hex unless written with a trailing dot or explicitly called decimal, matching
the assembler convention (`24.` = decimal 24, `100` = 0x100).

## 1. Where things live

| What | File : label | Notes |
|---|---|---|
| TIE fighter 3-D model | `WSOBJ.MAC` : `.WP TIE` (points, line 146) / `.WL TIE` (draw list, line 1351) | `.S=13.` |
| TIE explosion fragments | `WSOBJ.MAC` : `TI1` (port fin + strut), `TI2` (starboard fin, pre-rotated), `TI3` (cabin) | `.S=13.`, TI1/TI2 share one draw list |
| Darth Vader's TIE Advanced | `WSOBJ.MAC` : `RTH` (line 302 / 1427) | `.S=10.` |
| Object draw routines | `WSOBJ.MAC` : `INOBJ, ADOBJ, OBJCEN, OBJPNT, OBJDRW, BJLNV/BJLNB` | overlay bank |
| Alien view / colour | `WSMAIN.MAC` : `SNVW`, `S2VW`, table `TVWCL` (line 3963) | |
| Explosion spawning / colours | `WSXPLD.MAC` : `BGAXP`, `VWXPLD`, `VWTIN`, table `TVWCLE`, `MUNGE` | |
| Aiming cursor | `WSVROM.MAC` : `VGSITE` / `VJ LZA` (line 1414); drawn by `WSSITE.MAC` `VWCURS/VWCURC`; position by `WSINT.MAC` `GNSITE` | |
| Player laser bolts | `WSLAZR.MAC` : `VWLAZ`, `LAZVW`; colours `WSVROM.MAC` `LZF0..F`, splash `LZS0..3`/`VGLZS0..3` | 2-D screen lines |
| Enemy fireball | `WSVROM.MAC` : `GNB0..3`, `GNT0..3`, `GNX0..3`; drawn by `WSGUNS.MAC` `VWGUN/GN1DRW/GLOWVW` | 2-D stamps at projected centre |
| Star field | `WSSTAR.MAC` : `VWSTAR`, `STARNW`; `WSMAIN.MAC` `ISTAR`; dot `WSVROM.MAC` `VGSTAR` | procedural, not a table |
| Mathbox microcode | `SWMP.MAC` / `SWMP.DOC` (Jed Margolin) | PRE2, CONCAT, POSTADD, PERS |
| VG opcodes / constants | `WSVGMC.MAC`, `WSGLOB.MAC` | |

`XW` (X-wing) and `YW` (Y-wing) tables also exist in `WSOBJ.MAC` but their point and line data is
wrapped in `.IF NE,0 … .ENDC` and is assembled out – they are empty (one centre point) in the shipped game.

## 2. The 3-D object table format (`WSOBJ.MAC`)

### 2.1 Points
```
    .S=13.          ; scale factor (assembly-time)
    .WP TIE         ; start shape, allocates TD$TIE = next id, records PC
    .P 0,0,0        ; point 0 -- ALWAYS the object centre
    .P -10,-16,18   ; point 1 ...  (.P args are DECIMAL: macro appends '.')
    ...
    .WPZ            ; end: TD$nnNM = number of points rounded UP to even
```
* `.P x,y,z` emits three 16-bit words `x*S, y*S, z*S` (6 bytes per point). `.PH` is the same with hex
  arguments; `.PGND` subtracts `GD$MDT` (0F00) from z (ground objects only).
* The ROM therefore stores *already scaled* integers. The JSON gives both: `modelUnits` (as written in
  the source) and `vertices` (= modelUnits × `scale`, what the mathbox actually multiplies).
* Three global tables are generated at the end of the file, indexed by the shape id `TD$xxx`
  (TIE=0, TI1=1, TI2=2, TI3=3, RTH=4, XW=5, YW=6, GND=7, … WG3=25):
  `TDRWPC` (word: address of the 6-byte ROM points), `TDRWNM` (byte: point count, even),
  `TDRWLN` (word: address of the draw list).
* `ADOBJ` copies a shape's points from ROM into mathbox shared RAM at `M.OBJ` (8 bytes per point:
  X, Y, Z, pad – the mathbox addresses RAM as 4-word blocks) the first time it is needed and records the
  block index in `BJBIC[id]`. `INOBJ` clears that cache at the start of a phase.

### 2.2 Draw list (interpreted by `OBJDRW`)
```
    .WL TIE                     ; TD$TIE's list; emits a leading type byte 0
    .BD 1,2,3,4,5,6,1           ; Blank move to 1, then visible lines 1-2,2-3,...,6-1
    .LD 7,8,9,10,11,12,7        ; visible Lines: FIRST element is drawn FROM THE CURRENT vertex (1->7)
    .LEND                       ; 0FF terminator
```
One byte per entry: `index*4 + flag`.
* flag `0` → draw a visible line from the current beam position to point `index` (intensity 7).
* flag `1` → blank move to point `index`.
* flag `2` → damage marker `.D n` (byte = n*4+2): if `n <= BJ.DMC` the list stops here (damaged ships
  lose their tail). None of the dogfight shapes use it.
* `0FF` → end.
* The beam starts at the projected object centre, which is point 0. So a list that begins with `.LD`
  draws from the centre; every `.LD` chain begins with a visible line from wherever the previous chain
  stopped. The JSON `lines` / `polylines` arrays already have this resolved.
* `.WL2 NAME` makes a second id share the preceding list (`TI2` shares `TI1`'s; the tower/bunker pieces
  share one). `.WPZ2 NAME` likewise aliases a point table.

### 2.3 Per-frame drawing pipeline (`WSMAIN.MAC S2VW` → `WSOBJ.MAC`)
1. `M$PSB2` (microcode `PRE2`) with the alien's position block: `view = M1 · (P_alien − P_player) / 2`.
   Note the **/2** – PRE2 multiplies by ONE then accumulates ×(−½) (`HALF = 0E000`), so all view-space
   centre coordinates are half the world distance. It also outputs the squares `XPS, YPS, ZPS`.
2. Visibility: `10 < XP <= 7F00`, `YP² < XP²`, `ZP² < XP²` (a 90° cone; ±45° each way).
3. `IS2UV` downloads the alien's 3×3 matrix + position into the "ship 2" slot; `OBJCEN` projects the
   centre (divider + `M$PERS`) and emits one blank long vector from screen centre to it, remembering the
   screen position in `BJ.CX/BJ.CY`.
4. A COLOR word is written (see §5).
5. `M$CNCT` (microcode `CONCAT`): `[A B C] = M1 · M2ᵀ` – the matrix that takes model coordinates into
   the viewer's frame.
6. `OBJPNT`: for every point, `M$PAD` (microcode `POSTADD`): `p' = [A B C]·p + (XT,YT,ZT)` where
   `XT,YT,ZT` = the (halved) centre from step 1; then the hardware divider computes
   `Q = 0x200 / XP'` (15-bit fractional: Q = (N/D)·0x4000, numerator `M.DVN = 200` set once in `IMATH`),
   then `M$PERS`: `YP' = YP'·Q`, `ZP' = ZP'·Q` (products are `(a·b) >> 14`).
   Net effect: **screen_x = 512·Y/X, screen_y = 512·Z/X** in VG units. Results go to `BJ.PNT`
   (4 bytes per point: screen X, screen Y).
7. `OBJDRW` walks the draw list emitting *relative* long vectors between consecutive `BJ.PNT` entries,
   visible ones with intensity 7 (`ORA #0E0` in the X word), blank ones with intensity 0. Finally a
   `VGCNTR` recentres the beam.

Because step 6 adds unhalved model coordinates to a halved centre, **one ROM model unit equals two
world-position units**. Equivalently: in the halved "view space" used everywhere for positions (trench
walls at Y=±400, floor at Z=−1000, alien gun-range test 4000 …) the TIE is exactly `modelUnits×13` wide.
If your recreation keeps world positions in the source's units, multiply TIE vertices by 13×2 = 26 and
Darth's by 10×2 = 20; if you keep the halved convention, use 13 and 10 with a focal length of 512.

## 3. Coordinate conventions

From `SWMP.DOC`: *"Strange but true: X is straight ahead, Z is up, and Y is to the right."*
Confirmed by the code: `OBJCEN/BJLNV` write `M.YP` as the VG X (screen right) word and `M.ZP` as the VG Y
(screen up) word; VG +Y is up (`VGRW0 = 552.` is the top text row, `VGLIMB = -552.` the bottom).

* Model frame == mathbox frame: **+X forward (nose), +Y right, +Z up**. This triple is **left-handed**
  (forward × right = down). Darth's "FRONT WINDOW" is at x = +5..+8; the TIE's fins are the hexagons in
  the planes y = ±16 (vertical panels port/starboard) spanning x ∈ [−16, 14], z ∈ [−18, 18].
* `NWASHP` initialises every alien with `AX = BY = 0C000 (= −1.0)`: a 180° yaw, so the model's +X nose
  points at the player (who starts looking down world +X).
* Rotation microcode (all "cyclic", from the first axis toward the second):
  ROLL: y' = y·cos − z·sin, z' = y·sin + z·cos; PITCH: z' = z·cos − x·sin, x' = z·sin + x·cos;
  YAW: x' = x·cos − y·sin, y' = x·sin + y·cos. Angles: 4000 = 1.0.
* Matrix storage: `(AX,BX,CX)` is the ship's forward axis in world coordinates, `(AY,BY,CY)` its right
  axis, `(AZ,BZ,CZ)` its up axis; `PRESUB/PRE2` compute `XP = (P−T)·(AX,BX,CX)` etc. Identity = AX=BY=CZ=4000.

### Conversion to a right-handed, Y-up, camera-looks-down-−Z frame (Three.js)
```
three.x =  +Y_mb   (right)
three.y =  +Z_mb   (up)
three.z =  -X_mb   (forward becomes -Z)
```
This is a pure relabelling that preserves the physical meaning of right/up/forward, so models are not
mirrored and line connectivity is unchanged. Apply the same mapping to positions and to the matrix rows
if you port the flight code. Multiply by the scale factor discussed in §2.3.

Projection check: with focal 512 and the mapping above, `screen_x = 512·three.x/(-three.z)`,
`screen_y = 512·three.y/(-three.z)` – a pinhole camera with tan(half-FOV) = 480/512 ≈ 0.94 (≈ 43° half
angle) horizontally within the `VGLIML..VGLIMR` limits.

## 4. Screen (VG) space

* Long vector = two 16-bit words: `DY & 1FFF` then `(ZZZ<<13) | (DX & 1FFF)`; ZZZ = intensity 0..7.
  Coordinates are relative to the beam; `VGCNTR` (8040) recentres to (0,0).
* Default scale word `VGSCAL = 7200` (binary scale 2 = ¼ of the raw 13-bit range). At this scale the
  hard edges are X ∈ [−510, 510] (`VGEDGL/R`), Y ∈ [−612, 600] (`VGEDGB/T`); the guaranteed-visible 3-D
  window is X ∈ [−480, 480] (`VGLIML/R`), Y ∈ [−552, 408] (`VGLIMB/T`); rows above 408 hold score text.
* **`VGOFFY = −104.`**: the 3-D centre of projection (and the cursor's zero) is drawn 104 units below
  screen centre. `OBJCEN` adds it to the centre's Y; the cursor and lasers add it too.
* COLOR word = `6000 + (colour&7)<<8 + lum` (lum 0..FF, 80 = normal). Colours: BLU 1, GRN 2, TRQ 3,
  RED 4, PRP 5, YLW 6, WHT 7.
* **Aspect**: `WSVROM.MAC`'s `ASPECT` macro multiplies 2-D Y coordinates by 3/2 "to give round gunshots"
  and "want round" Death-Star circles, and the visible Y range (±600) is ~1.18× the X range (±510) on a
  4:3 monitor. Both say one VG Y unit is physically ≈ ⅔ of an X unit. The 3-D projection uses the same
  512 focal length for both axes with no correction, so on the arcade monitor 3-D objects appear
  vertically compressed to ≈ ⅔ of true perspective height. A faithful recreation should map
  X ∈ [−512, 512] to the full width and Y ∈ ≈[−576, 576] to the full height (or scale the camera's
  vertical projection by ⅔); a "corrected" one can use square units – flag this choice.

## 5. Colours and intensities

* Every visible object line has vector intensity 7; colour/brightness come only from the COLOR word.
* TIE and Darth (`TVWCL`, indexed by the glow counter `A$GLW`): unhurt = **GREEN, lum 80**. After a hit
  `A$GLW = 1F` and counts down one per frame: indices 31,30 = WHITE C0, then even = GREEN 80, odd =
  WHITE with lum 80 (29..17), 70 (15,13), 60 (11,9), 50 (7,5), 40 (3), 30 (1) – a green/white flicker
  whose white component fades.
* Explosion pieces (`TVWCLE`, indexed by the piece timer counting down): 31..24 YELLOW A0; 23..16
  GREEN A0 alternating with WHITE C0/A0/90/80; 15..0 GREEN fading A0,A0,90,90,80,80,70,70,60,60,50,50,
  40,40,30,30. Fin pieces start at timer 18 (24.), the cabin at 10 (16.). Timer > 1F → `VJFLS` flash colour.
* Cursor: TURQUOISE 80. Lasers: see JSON (`romColourSequence`, animated). Fireball: RED FF with
  flash-coloured fuse tips. Stars: WHITE, lum `ST.BRT` (80).

## 6. TIE destruction (`WSCPU.MAC CPHTSA/XPSA` → `WSXPLD.MAC BGAXP`)

A TIE has 1 hit (`.WS TIE,1`). `XPSA` → `BGAXPLD`: the alien record is set dead and three explosion
records are queued: TI1 (timer 18, centre offset −(AY,BY,CY)/64 from the ship, velocity = ship velocity +
that offset), TI2 (timer 18, +(AY,BY,CY)/64), TI3 (timer 10, at the ship centre, velocity = (unit
direction from the player)/16 with a random low byte, so it drifts away). All pieces are viewed through
the shared `M.MUN` matrix, which `MUNGE` rolls by 19.04° and pitches by 4.99° every frame while any piece
is alive (so the fragments tumble together), then drawn with the same ADOBJ/OBJPNT/OBJDRW path (`VWXPL2`).
Darth (`RTH`, `.WS RTH,4`) is never destroyed: `CPHTSA` resets his hit counter to 5, forces a 31-frame
roll and glow, and flings the ship.

## 7. Cursor, lasers, fireballs, stars (summary; details and coordinates in the JSON)

* **Cursor** (`VJ LZA`, M.=10): four corner brackets, each the closed stroke
  (10,10)→(20,30)→(20,20)→(30,20)→(10,10) mirrored into the four quadrants; units are VG units, ON=7.
  Position (`VG.CX`, `VG.CY`) is the yaw/pitch rheostat value (±128) ×4, clamped to X ±448, Y ≈ [−416, 480];
  drawn at (`VG.CX`, `VG.CY + VGOFFY`). Sequence: COLOR TRQ 80, JSRL VRSITE (blank vector to the position),
  JSRL LZA, CNTR.
* **Lasers** are pure 2-D: on each fire edge either the two left guns or the two right guns fire
  (`LZ.ALT` alternates). Start points (before the cockpit-shift `LZ.GX/LZ.GY`): upper-left (−390, −104),
  lower-left (−395, −517), lower-right (395, −517), upper-right (390, −104); end = cursor
  (`LZ.CX`, `LZ.CY + VGOFFY`). Each bolt is emitted as successive halves of the remaining delta, each half
  preceded by a colour word from the animated `VRLZF` table (ROM order TRQ FF, BLU FF, BLU CC, BLU 80,
  BLU 40, BLU 00 ×3; rotated one entry per frame so the bright head travels). Shot lasts `LZ.EDG = 8`
  frames. On a hit (`LZ.HIT` 4→0) the bolt is one turquoise segment with lum `LZ.HIT×3F` plus the animated
  splash stamp (`LZS0..3`: white bar, white plus, yellow 7-unit circle, yellow 14-unit circle).
* **Fireball** (alien gun shot): the shot's position is projected exactly like a ship centre (`OBJCEN`),
  then a distance-dependent SCALE word and `JSRL VRGNB` draw one of four red 8-spoke sparkle stamps
  (`GNB0..3`, M.=5, Y×3/2, cycled every 4 frames); at five of the spoke tips a flash-colour word
  (`VRFLS`, cycles colours 1..7 at FF every frame) and a small pinwheel (`GNT0..3`, M.=10, cycled every
  frame) are stamped. Hurt shots use `GNX0..3` (tips only) in PURPLE; a shot that hits the windshield is
  re-stamped WHITE at its last screen position, shrinking over 15 frames (`GLOWVW`), and the whole screen
  frame flashes white (`VWGLW`, `VJFCWN` box at scale 7100).
* **Stars**: 50 random 3-D points in mathbox RAM, transformed with PRE2 each frame using the player's
  matrix (translation replaced by the slower `ST.UX/UY/UZ`), drawn as white intensity-7 dots
  (`VGSTAR` = `VON 0,0`) when inside the 90° cone and `100 < XP <= FFF`; a star that leaves the cone is
  respawned ahead on the opposite side (`STARNW`). There is no fixed table.

## 8. Uncertain / open

1. **Monitor aspect** (§4): the ⅔ Y-unit inference is strong (two independent clues) but not stated in a
   document; verify against MAME or a cabinet before baking it into the camera.
2. `VGCURB = (−512+30+64)/4`: −104 or −105 depending on the assembler's rounding of negative division
   (cursor bottom clamp −416 vs −420). Immaterial.
3. `TVWBYT` builds colour words as `VGCOPC&F000 + (v&F)<<8 + (v&F0)`: I read the low nibble as the colour
   and the high nibble as brightness×16; the table comment "converts old vals to new hardware" supports this.
4. Integer truncation direction in the 2-D `AON` macro (Y×3/2 for odd values) – off by at most one unit.
5. The laser colour animation is described from `WSINT.MAC`'s table rotation; the exact phase relative to
   the fire edge was not traced.
6. Fireball on-screen size: the binary-scale loop in `GN1DRW` is documented in the JSON; the linear byte
   uses the top 7 bits after normalisation. The stamp is drawn at `M.XT` (halved distance) so tune by eye.
7. Not extracted (out of scope): the cockpit/gun frame pictures `VGSTTR/STBR/STBM/STTL/STBL`, the
   Death-Star miniature `VJBMIN`, and the ground-phase objects (GND/TWR/BNK/WPN/WGA/WFF/PORT and the
   tower/bunker/wall-gun fragments) – all present in `raw_decoded.json` (points and, for the OBJDRW-type
   ones, lines) if needed later. Ground objects use different routines (`BJGROT/BJGDRW`, `PLOT/DRAWTO`
   macros with per-point 16-byte blocks and clipping).
