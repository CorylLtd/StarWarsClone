# Star Wars (Atari 1983) — Death Star SURFACE stage (phase `GD`) rules from source

Companion data: `surface-tables.json` (all mazes, wave→maze table, gun tables, speeds/limits, phase indices, RAM addresses). Conventions as in `dogfight-rules.md`: decimal unless `0x`, "frame" = 20 Hz game tick, cites `FILE:label`. Reminder: `PRE2`/`M$PSB2` returns positions **halved** (`XP` = real/2); `PSUB` does not halve; ground models are drawn at `.S = 120` in *halved* units, so every collision constant in WSGRND.MAC carries a `×2` (a tower is 58×120×2 = 13920 real units tall).

---

## 1. Flow

| Step | Phase | What happens | Cite |
|---|---|---|---|
| Approach | `S1G` | Death Star zoom (57 frames), stars dimming. Exits to **`GD` unless `SP.WAV == 0`** (displayed wave 1 → `S0B`, trench directly). No hyperspace/star-streak phase exists between `S1G` and `GD`. | WSMAIN.MAC:PHES1G |
| `GD` init (1 frame) | `PHIGD` | `GD.WAV = min(31, GM.WAV−1)`; `WV.HRD = min(15, GD.WAV + GM.DIF)` (one notch easier than the dogfight's); `IPARM` (player matrix = identity → facing +X, level, position 0), `ISTARG` (ground stars), `IGRND` (maze select, `GD.TWL`, `TWRMUL`), `IXPLD`; `VX = 256`, `TX = 128`, `TZ = 8192`; `GD.SEQ = Q.ATP = Q.KTW = 0`; `PH.TIM = 0`; music **`PM4TH`** ("battle music in fourths"). | WSMAIN.MAC:PHIGD |
| `GD` exec | `PHEGD` | per frame: `VEWGD` → die if `S.GAS < 0` (`G0D`) → `MVGUN`, `DO1GLW`, `DO1GAS`, `DOXPLD` → `VGTOSITE` → `S1TWGD` (bank) → `IS1UV` → `S1MVGD` (move) → `VX = min(1024, VX+1)` → every 16 frames `PH.TIM++`, at `PH.TIM == 14` music **`PMREB`** ("finish ground with Rebel theme") → if `GD.SEQ ≥ 5`: `Q.KTW = 1` and when `TX ≥ 0` (high byte < 0x80) → phase **`G0B`**. | WSMAIN.MAC:PHEGD |
| `G0B` init | `PHIG0B` (= `PHIS0B`) | `BS.RPT = 0`, `Q.FRC = 0`, `BS.WAV`, `WV.HRD` recomputed from `GM.WAV` (back to the dogfight value), `GNBASE` (trench generated), speech **"USE THE FORCE, LUKE"** (`SPKUSE`, queued), `PH.TIM = 0`. | WSMAIN.MAC:PHIG0B |
| `G0B` exec (17 frames) | `PHEG0B` | `VEWG0B` (ground stars, no buildings, HUD + "TOWERS nn"/"CLEARED ALL LASER TOWERS" + flashing **"USE THE FORCE"**), `SMVG0B`: if `TZ > 896` drop 384/frame; `SMVG9B`: `TX += VX`, `VX` eases to 768 (⅛ of the difference per frame), **roll 10.55°/frame** (sin ±3000, cos 16107; sign + when `GM.WAV` odd) and unwind the bank (`UNTWGD`). After `PH.TIM ≥ 17` → `G1B`. | WSMAIN.MAC:PHEG0B, SMVG0B, SMVG9B |
| `G1B` (17 frames) | `PHIG1B`/`PHEG1B` | `TX = TY = 0` (start of trench), `NWBASE`; `VEWG1B` draws the trench (`VWBASE`); `SMVG1B`: while `TZ > −3328` drop 256/frame, plus the same roll/forward motion. After 17 frames: `IPARM` (position preserved), `Q.FRC = 0`, phase **`BS`**. Total roll 34 × 10.55° ≈ 359°. | WSMAIN.MAC:PHIG1B, PHEG1B |
| Death on the ground | `G0D` | 40 frames, `VEWG0D` (ground, buildings, growing GAME OVER), then `EGM`. | WSMAIN.MAC:PHEG0D |

Wave/difficulty differences: maze by `GD.WAV` (§4.1), gun-slot count by `WV.HRD` (§5), the roll direction of the trench transition by `GM.WAV` parity; nothing else. `GD.WAV == 0` (wave 2) is the bunker-only wave and shows no tower messages/counter (`VWMTWR` requires `GD.WAV > 0`).

## 2. The player on the ground

(WSMAIN.MAC:S1MVGD, S1TWGD, PHIGD, PHEGD; constants `GD$MNT/GD$MXT/GD$MDT`.)

* **Position**: `TX` forward (universe X), `TY` lateral (+right), `TZ` altitude. Starts (128, 0, 8192); altitude is clamped to **512..7168** after every move, so it is 7168 from the first frame. No lateral limit.
* **Forward speed** `VX`: starts 256/frame, **+1 per frame**, max **1024** (reached after 768 frames = 38 s — later than the stage ends, see §6). `TX += VX` every frame.
* **Yoke → translation** (per frame, `RSX`/`RSY` = cursor position −112..112 / −104..120, same IRQ slew as the dogfight):
  * lateral `VY = VX × |RSX| / 128` signed by `RSX` (max 0.875 × VX), `TY += VY`;
  * vertical `VZ = VX × |RSY| / 256` signed by `RSY` (max ≈ 0.47 × VX), `TZ += VZ` then clamp. Pushing the cursor up climbs.
  * The cursor itself still moves on screen with the yoke, and the X-wing hood/gun tips shift as in the dogfight.
* **Bank** (`S1TWGD`): target roll (tics of 0.064°) = `2 × RSX` (yoke, max ±254 tics ≈ ±16.3°) + `32 × S.ROL` (collision roll, `S.ROL` decays toward 0 by 1/frame; ±32 → 65° at the moment of impact). Each frame `delta = target − GD.ACT`, clamped to **±16 tics (1.02°)** normally or **±80 tics (5.1°)** while `S.ROL ≠ 0`; `GD.ACT += delta`; the roll residue `RHEOR` gets `delta` and `RHRSDU` applies 4.99°/0.895° steps to the master matrix (remainder via `RESIDU`). So full yoke bank takes ≈16 frames. The ship never yaws or pitches on the surface: `XP` of any object equals its forward offset exactly.
* **Ground plane / horizon**: there is **no drawn horizon line and no grid**. The "ground" is (a) the field of green ground stars (§3) and (b) the buildings. The math view is offset by `VGOFFY = −104` as usual.
* **Camera/projection differences**: buildings use `BJGROT` (model points rotated by the player's matrix through `PSUB` at centre 0 — pure rotation, not halved), `M$PSB2` for the building centre (halved, with the 32768 wrap), then **per-vertex perspective** (`BJGPNT`: divider per point with `X = Xr + Xp`, microcode `PER2I/PER2`), a VG **linear scale** `0x72LL` with `LL = 4 × XPhi` (far objects drawn smaller by `(256 − LL)/256`, i.e. ≈ `1 − XP/16384`: an object at the far visibility edge is drawn at ≈6 % of its perspective size and grows in — the laser test compensates with `1/X − 0x100`, WSGRND.MAC:GRLZCL), and base brightness `0x40 + (255 − 4·XPhi)·0x40/256` (dim far, 0x80 near). Objects closer than `XP < 0x900` (real 4608) go through `BJGCLP`: quotients ≤ 0x100 forced to 0x7FFF and screen coordinates clamped to ±1022 in X and `VGEDGB−VGOFFY−512 .. VGEDGT−VGOFFY+512` in Y ("generous" clipping; the trench uses `BJBCLP` with ±24). (WSOBJ.MAC:BJGROT, BJGPNT, BJGCLP, BJBCLP; WSGRND.MAC:GDVIEW.)

## 3. Ground stars ("the surface")

`VWSTRG`/`STRNWG` (WSSTAR.MAC), `ISTARG` (WSMAIN.MAC): the 50 star slots are used as **green dots on the plane z = 0**. Initially random (X, Y) with Z = 0. Each frame a star is shown if `XP > 0x100` (real > 512) and inside the FOV; otherwise it is respawned "way out there": `X = TX + ((rnd & 0x7F) | 0x70) << 8 + rnd` (28672..32767 ahead), `Y = TY ± (rnd & 0x7F) << 8` (sign opposite to the current `YP`), `Z = 0`. Colour green, fixed brightness; drawn with the standard `VGOFFY` horizon offset. The stars therefore stream past at the player's speed and the density thins toward the horizon. `M.GD` (the 32-point block at math RAM 0x5E00) is **not** a ground grid: it is the per-object transform work area (rotated points + screen results, 16 bytes/point) used by `BJGROT`/`BJGPNT`.

## 4. Towers and bunkers

### 4.1 Mazes and selection (WSGRND.MAC:TGDPTR, IGRND, TTWRS)

`GD.WAV = GM.WAV − 1` → `TGDPTR[GD.WAV]`, 19 maps for displayed waves 2..20; `GD.WAV ≥ 19` → random one of the last six (`13 + (rnd×6)>>8`). All maps are in `surface-tables.json` (`mazes`, `waveToMaze`). Each entry: `forward` (0..0x8000), `lateral` (signed, ±32768 is the same word), type (TOWER shoots forward+diagonals; BISHOP shoots diagonals only; BUNKER), and awakening `seq` 0..3. A base map has 28 entries; the `T3*` variants add 4 towers (32 = `TGD$EQ`, the max). `GD.TWL` = BCD count of TOWER+BISHOP entries (0 on wave 2, 16..32 later).

| Displayed wave | Maze | Towers |
|---|---|---|
| 2 | TBUNK (28 bunkers) | 0 |
| 3 / 12 | TSQUARE / T3SQUARE | 16 / 20 |
| 4 / 13 | TCLUSTR / T3CLUSTR | 16 / 20 |
| 5 / 14 | TTURNON / T3TURNON | 20 / 24 |
| 6 / 15 | TWEDGE / T3WEDGE | 20 / 24 |
| 7 / 16 | TDIFF / T3DIFF | 20 / 24 |
| 8 / 17 | TTRAP / T3TRAP | 21 / 25 |
| 9 / 18 | TSYMTRC / T3SYMTRC | 21 / 25 |
| 10 / 19 | TVALLEY / T3VALLEY | 27 / 31 |
| 11 / 20 | TTWRCTY / T3TWRCTY | 28 / 32 |
| ≥21 | random of T3WEDGE, T3DIFF, T3TRAP, T3SYMTRC, T3VALLEY, T3TWRCTY | |

Placement is fixed by table (no randomness inside a map). Rows are typically 4096 apart in `forward`, columns 4096/8192 apart laterally (see the data).

### 4.2 The wrapping field and sequences (WSGRND.MAC:VWGRND; WSMAIN.MAC:S1MVGD, PHEGD)

* An object with map forward coordinate `F` is seen at distance `d = (F − TX) mod 32768` ahead (the halved `XP` is masked with `0x3FFF` when negative: "map wraps every 8000"). So the **whole maze repeats every 32768 units** as the ship flies on; visible when `512 ≤ d < 30720` and within the 45° cone.
* `GD.SEQ` increments each time the 16-bit `TX` overflows past +32767: first after 32640 units (one lap), then every 65536 (two laps). An object is active only while `GD.SEQ ≥ seq`, so laps progressively add objects: lap 0 seq-0 objects only; laps 1-2 seq ≤ 1; laps 3-4 seq ≤ 2; laps 5-8 everything; lap 9 (`GD.SEQ = 5`) → `Q.KTW`: every object that is off-screen ("backstage") is switched off, so the field empties as it scrolls past, and the stage ends when `TX` becomes positive again.
* **Recycling**: when an active object is out of range it is put "backstage": `GD$TYP = LV+AM+VW`, plus `DM` if it was already damaged (a damaged **bunker** loses `VW` = never drawn again; a damaged **tower** keeps `VW` and is drawn as a stub), plus `BK` (bunker/hat visible) if undamaged. Damage therefore persists across laps; nothing respawns as new.

### 4.3 Geometry (WSOBJ.MAC:`.WP GND`, `.PGND`; `.S = 120`, halved units → real = ×2)

| Object | Real dimensions |
|---|---|
| Tower / bishop | base front/left/right points at ±1920; "near bottom" ±1440 at z 1440; midline ±1200 at z 3360; cannon bottom ±960 at z 12480; top ±960 at z **13920**. Drawn: base (yellow, brightness by distance) up the right side, **top section (points 4-9, z 12480..13920) in white** = the "tower top"/hat, then the left side. Destroyed top → `TD$STB` stub drawn only to z 12480, top colour off. |
| Bunker | base ±1920, top ±1440 at z **1440** (points 1-3, 13-15), red at brightness 0x60; damaged → drawn in colour 0 (invisible) this pass, never again after. |

Since max altitude is 7168 and towers are 13920 tall, towers cannot be overflown; bunkers (1440) can.

### 4.4 Shooting them (WSGRND.MAC:GRLZIN, GRLZCL; WSLAZR.MAC:CLGLZ; WSGRND.MAC:GDHTGB)

Lasers work exactly as in the dogfight (8-frame bolt, cursor `LZ.CX/CY`), but the hit test is done in **un-banked screen space**: `GRLZIN` maps the cursor through the transposed player matrix (undoing the roll). If that un-banked cursor is below the screen centre while lasers are on, a green ground splash is shown (`LZ.HIT = −1`, "sweeping dirt").

Per visible object (`GRLZCL`), with `D` = real distance, `Q = 1/X` (numerator 0x200) minus 0x100 (clamped ≥ 0, matching the drawn linear scale): screen X of the object `YT = 512·(lateral − TY)/D`, screen Y of its base `ZT = 512·(0 − TZ)/D`; scaled half-width `R'` and height `H'` from real radius/height (tower 960 / 13920; bunker 1680 / 1440) via `Q`. Hit if

1. `|LY − YT| ≤ R' + 10` (10 = sight fudge), and
2. `0 ≤ LZ − ZT ≤ H'` (cursor between base and top), then
3. bunker (undamaged) → candidate `CL.BP` (nearest kept); tower: if `LZ + 10 ≥ ZT + h52'` (h52' from real 12480, i.e. the cursor is on the white hat) and the hat is undamaged → candidate `CL.BP`; otherwise `CL.TP` (tower body: yellow splash, no damage).

`CLGLZ`: a fireball under the cursor always wins (`GNHTSG`, 33 pts); else a `CL.BP` closer than any `CL.TP` → `LZ.HIT = 4`, **`GDHTGB`**: `TYP$DM` set; explosion centred at the object (forward placed ahead of the player via the wrap), z = 720 (bunker) or 14400 (tower top); **bunker = 200** (`SCRBNK`); **tower top = `TWRMUL`**, which starts at 200 and grows by 200 after each top (200, 400, 600, …, WSGAS.MAC:SCRTWR — the HUD shows the next value); `GD.TWL` decrements (BCD) and at 0 → **50,000** (`TSCATP`) and `Q.ATP = 1` (message). Sound `AUDSX`. A tower body hit only splashes (`LZ.HIT = −1`, yellow, scale from distance).

Explosions (WSXPLD.MAC:BGTWXP/BGBKXP): 3 pieces (`TW1-3` white / `BK1-3` red), life 32 frames, thrown toward a point 0x7F00 ahead and ∓0x3F00 to the sides of the player (velocity = distance/32 + random low byte), vertical velocity `(2|3)<<8 | rnd` ×4 (towers 2048..3068, bunkers 3072..4092), gravity −200/frame², friction 1/32, stop at z = 0, with a shadow drawn on the ground; fade over the last 7 frames.

### 4.5 Colliding with them (WSGRND.MAC:GDVIEW)

Evaluated every frame for every **visible** object (so only objects inside the 45° cone can hit you):

* **Tower/bishop**: "pffft" `AUDPF` while `2·VX + 1024 ≥ XP` (halved); **crash when `XP ≤ 512 + VX`** (halved) → real distance ≤ 1024 + 2·VX. **Altitude is ignored** and there is no lateral test beyond the view cone (|lateral| < distance): passing within ≈1.5–3k units of a tower's centre at the last moment counts. Effects: tower flashes (`VJFLS`), `BG1GLW` (one shield unit, subject to the gauge-animation window: `GS.GLW` must be 0, see dogfight §8 — this is the only invulnerability), `AUDCR`, `S.ROL = ±32` (sign away from the tower unless already rolling), giving a 65° bank kick that decays over 32 frames.
* **Bunker**: pffft when `TZ ≤ 1952`; **crash when undamaged and `TZ < 1440` and `XP ≤ 1024 + VX`** (halved; real ≤ 2048 + 2·VX). Effects: flash, `BG1GLW`, `AUDCR`, `S.ROL = ±19` only if `S.ROL == 0`.
* The same crash condition holds on consecutive frames while the object passes; only the first frame costs a shield because of `GS.GLW`.

## 5. Ground guns (WSGRND.MAC:GDGUN, GDTWRGN, GDBSHGN, GDBNKGN; WSGUNS.MAC)

Fire only while the object is visible, undamaged, and `S.GAS ≥ 0`; a shot needs a free slot among the first `n` of the 6 gun records, `n = TGNGD[min(WV.HRD, 11)]`: HRD 0-1 → 1, 2-3 → 2, 4-5 → 3, 6-7 → 4, 8-9 → 5, ≥10 → 6 (WSGUNS.MAC:TGNGD, GNGDAVAIL). (`TGNBS` — 1,1,2,2,3,3,3,4 for HRD 0..7 — is the trench table.) `Q.KTW` (last lap) kills all guns.

* **Tower / bishop**: fires **once per lap, when its top "crosses the horizon"**: scale `f = 2·(0x4000 − XP)/0x4000`; `top' = 6960·f`, `hat' = 720·f`. If `top' < TZ` → arm (`TYP$AM`). If `0 ≤ top' − TZ ≤ hat'`, or armed and now past → disarm and fire: tower → forward gun 50 %, right diagonal 50 %, left diagonal 50 % (independent random bytes); bishop → right 50 %, left 50 %. Low altitude → they fire as soon as they appear; at 7168 → at about half the visible range. Shot (`TOWRIN`): timer 112 frames, universe coordinates, starts at the tower's position (forward wrapped in front) at the **player's altitude**; `MOV$WF`: `X −= 256`/frame (closing at 256 + VX); `MOV$WL/WR`: additionally `Y ∓= 256`/frame. Sound `AUDTL`.
* **Bunker**: every visible frame, fire chance `(64 − XPhi)/256` (≈2 % far, ≈24 % adjacent); kind: rnd < 0x50 (31 %) "forward" else right/left 50/50 — all three go through the same code (`FRBFGN=FRBLGN=FRBRGN`): mover `MOV$BR` if the bunker is right of the player else `MOV$BL` (swapped when the yoke already points away from the bunker beyond the bunker's bearing, byte 6/7 logic in WSGUNS.MAC:FRBFGN); starts at the bunker at height 512; each frame: `X −= 4·(hi(X) − hi(TX))` (creeps toward the player, plus the player's own closing speed), lateral: follows the player's `VY·7/8` one-way and slews toward `TY ± 256` (preferred side) with gain ⅛ (max 384/frame) in the preferred direction, 1/32 otherwise; vertical: toward `TZ + 256` with gain ⅛, max 512/frame, upward only — a rising, homing fireball. Timer 112, sound `AUDTL`.
* **Impact** (WSGUNS.MAC:VWGUN, same code as the dogfight): live, visible, real distance ≤ `max(VX, 512) + 272`, shot centre inside the cursor box (X ±448, Y −416..+480) → shield hit (`GNAHIT`: 15-frame white glow, `BG1GLW`, `S.ROL = ±32`, `AUDSH`), unless the cursor overlaps it with lasers on → destroyed for 33. Shots outside the cursor box never hit. Ground shots are drawn in universe coordinates (`TYP$UN`), so they do not move with the view.

## 6. Timing

The stage is **distance-limited**: `GD.SEQ` must reach 5 (after 32640 + 4·65536 = 294784 units) and then `TX` must come back to ≥ 0 (+32768) → **327552 units**. With `VX` ramping 256 → +1/frame: `256n + n²/2 = 327552` → **≈593 frames ≈ 29.6 s**, ending at `VX ≈ 849`. `PH.TIM` is only a 16-frame "pseudo-second" counter used for the music cue at 14 (224 frames = 11.2 s). No speech during `GD` other than shield lines; **"USE THE FORCE, LUKE"** is spoken at `G0B` (not "THE FORCE WILL BE WITH YOU", which is the coin-up/game-over line).

## 7. HUD, messages, colours, sounds

* HUD as in the dogfight (score, added points, wave, shield gauge/"SHIELD GONE", cursor, hood), plus (WSMAIN.MAC:VWMTWR/VWMTWZ; TCMES.MAC): for `GD.WAV > 0` while `GD.TWL ≠ 0`: **"nnn,nnn POINTS NEXT TOWER"** (`MS.NXT`, red, `VGRW7`, value = `TWRMUL`) for 48 of every 64 frames and **"50,000 FOR SHOOTING ALL TOWERS"** (`MS.RWD`) for the other 16; **"TOWERS nn"** (`MS.TWR`, top right, `VGRW6`) with `GD.TWL`; **"CLEARED ALL LASER TOWERS"** (`MS.ATP`, flashing colour) once `Q.ATP`. During `G0B/G1B`: "TOWERS nn"/"CLEARED…" remain and **"USE THE FORCE"** (`MS.USE`, `VGRW9`, flashing) is shown.
* Colours: ground stars green; tower base yellow (brightness 0x40..0x80 by distance), tower hat white, stub top off; bunker red (0x60); collision flash `VJFLS`; explosion pieces white (tower) / red (bunker); laser splash green on the ground, yellow on a tower body.
* Sounds: `AUDPF` pffft passing towers/bunkers, `AUDCR` crash, `AUDTL` ground shots, `AUDSX` building explosion, `AUDSH` shield hit, `AUDXL` laser; music `PM4TH` at start, `PMREB` at 11.2 s; speech `SPKUSE` at `G0B`, shield lines as in the dogfight.

## 8. MAME poke addresses (from WSROOT.MAP; all in the 6809 address space)

| Variable | Address | Notes |
|---|---|---|
| `PHASE` | **0x4841** | index into `TPHASE`; write an **init** index to force a phase (see below) |
| `FRAME` | 0x4842-43 | 16-bit big-endian |
| `PH.TIM` | 0x4B0E-0F | 16-bit BE |
| `S.GAS` | **0x4860** | shields, signed; −1 = dead |
| score | 0x485C..0x485F | BCD, most-significant byte first |
| `GM.WAV` | **0x4B15** | 0-based wave; `GM.DWAV` 0x4B16 is the BCD display copy |
| `SP.WAV` | 0x4B14 | `GD.WAV` 0x4B13, `BS.WAV` 0x4B12, `GM.BMP` 0x4B17, `GM.DIF` 0x4B18, `WV.HRD` 0x4B19, `GD.TWL` 0x4B1A (BCD) |
| `GD.SEQ` | 0x48A7 | `GD.ACT` 0x48A3 (16-bit), `Q.ATP` 0x4B35, `Q.KTW` 0x4B3D, `TWRMUL` 0x4B2E (3 BCD bytes), `GDRAM` 0x49C2..0x49E1 |
| player position | **`TX` 0x5098, `TY` 0x509A, `TZ` 0x509C** | 16-bit BE in math RAM (0x5000-0x5FFF); `VX` 0x5086, `VY` 0x508E, `VZ` 0x5096; matrix `AX` 0x5080 … `CZ` 0x5094 (`M.S1` = 0x5090, `M$TX = +8`) |
| view copy `M.U1` | 0x5038 | rebuilt from `M.S1` every frame |
| misc | `S.ROL` 0x4863, `S.GLW` 0x4862, `GS.GLW` 0x488B, `GS.HIT` 0x488C, `WV.LIV` 0x48E6, `WV.LVL` 0x48DD, `AM.PTR` 0x4B32, `$$CRDT` 0x4814, `GTIME` 0x4819, `SI.RSX` 0x487D, `LZ.ON` 0x48BC, `ALIEN` 0x4900, `GUN` 0x494B |

Phase indices (`PH$xxx`, WSROOT.MAP, = init entry; exec = +1): `SDS` **13**, `SG1` 25, `SG2` 27, `BGN` 29, `SP1` **31**, `SP2` 33, `S0G` 35, `S1G` 37, `S0B` **39** (trench from space), `GD` **41**, `G0B` 43, `G1B` 45, `BS` 47 (trench), `B0B` 49, `NXT` 51, `S0D` 53, `G0D` 55, `B0D` 57, `EGM` 59, attract `BNR` 5, `HIS` 11. Full list in the JSON.

**Forcing a phase**: write the init index to 0x4841 between frames; `MAIN` (WSMAIN.MAC:MAIN) dispatches `TPHASE[PHASE]` next frame, the `PHIxxx` routine sets up and increments to the exec entry. Practical notes: `PHIGD` (41) re-initialises the player, stars, maze and explosions itself and only needs a sane `GM.WAV` (≥1 for a real maze; 0 gives `GD.WAV = 0xFF` → random top map) and `S.GAS ≥ 0`; `PHIS0B` (39) generates a trench and needs `GM.WAV`/`GM.DIF`; `PHISP1` (31) expects `IPARM`/`ISTAR` to have run (use 27 = `SG2` or 29 = `BGN` instead to get a clean dogfight); 13 = `SDS` works from attract. Never write an odd (exec) index. `WV.HRD`/`GD.WAV` can be poked after the init frame to change guns/maze; poking `TX` high byte to 0x7F makes the next `GD.SEQ` increment immediate.

## 9. Open questions

1. **AVG linear scale semantics** — `(256 − LL)/256` is inferred from the `1/X − 0x100` compensation in `GRLZCL`; confirm in the AVG docs/MAME (`avgdvg`) that Star Wars' scale word `0x7BLL` shrinks by that factor.
2. The per-vertex divider path (`PER2I/PER2`, `M$PRS2`) mixes `Xr` (rotated, un-halved model units) with `Xp` (halved distance); since the models are authored in halved units this is consistent, but the exact screen formula was not re-derived from the microcode.
3. Tower crash needs no lateral/altitude test beyond the 45° view cone — surprising but that is the code (WSGRND.MAC:GDVIEW); verify in MAME by passing a tower at 4000 units lateral.
4. The bunker fireball's steering (`MOVBL/MOVBR`, bytes 6/7) is summarised, not transcribed; port from WSGUNS.MAC if exact trajectories matter.
5. Whether `AUDPF` retriggers every frame while in range (the sound routine is called each frame) is a sound-driver detail (SNDAUD.MAC) not examined.
6. `M.GD` contents/`GD$MDT` vertical offset: models are stored as `z − 3840` and placed at centre height `2×3840`; the net effect (ground at z = 0) is asserted from the collision constants, not by simulating the math box.
