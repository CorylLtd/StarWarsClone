# Star Wars (Atari 1983) — TRENCH stage and what follows (phases `S0B`, `G0B/G1B`, `BS`, `B0B`, `DX1-3`, `NXT`, `B0D`)

Companion data: `trench-tables.json` (all 53 wedge tables row-by-row, the 11 pies + random pie, per-wave lengths, gun/catwalk counts, gun-probability and slot tables, force-bonus table, explosion timings, phase indices, RAM addresses). Conventions: decimal unless `0x`; frame = one pass of the mainline, nominally 20 Hz but **about 14.4 Hz in the trench** because the mainline also waits for the vector generator, which takes longer than a field to draw the trench (measured in MAME: `FRAME` advances 14.4 a second flying the trench, so 768 units a frame is ≈11,000 units a second and a trench takes ≈30 s, not 21.6); cites `FILE:label`. In the trench all coordinates in the code are **real universe units** (the halving of `PRE2` is compensated by half-size models, see §3).

---

## 1. Flow

| Step | Phase | Behaviour | Cite |
|---|---|---|---|
| Entry from space (displayed wave 1 only) | `S0B` init (=`PHIS0B`=`PHIG0B`) | `BS.RPT = 0`, `Q.FRC = 0` (Force allowed), `BS.WAV = min(31, GM.WAV)`, `WV.HRD = min(15, BS.WAV + GM.DIF)`, **`GNBASE`** (build the random pie — only used when `BS.WAV ≥ 11`), speech **"USE THE FORCE, LUKE"** (`SPKUSE`), `PH.TIM = 0`. `S0B` exec: `IPARM` (player at 0,0,0 facing +X), **`NWBASE`** (reset panels, pick the pie, pre-generate rows), phase ← `BS`. No descent animation from space. | WSMAIN.MAC:PHIS0B, PHES0B |
| Entry from the surface | `G0B` (17 frames) → `G1B` (17 frames) | same init as above, then the 359° roll while dropping: `G0B` drops to 896, `G1B` sets `TX = TY = 0`, `NWBASE`, drops 256/frame while `TZ > −3328`, then `IPARM` with position kept, `Q.FRC = 0`, phase ← `BS`. | WSMAIN.MAC:PHEG0B, PHIG1B, PHEG1B, SMVG1B |
| `BS` init (1 frame) | `PHIBS` | `Q.BSH = 0`, `PH.TIM = 0`, **`VX = 768`**. | WSMAIN.MAC:PHIBS |
| `BS` exec | `PHEBS` | per frame: `VEWBS` → die if `S.GAS < 0` (`B0D`) → `MVGUN`, `MVPTGN` (torpedo), `DOBASE` (wall guns fire), `DO1QGLW` (glow capped at 8 frames), `DO1GAS` → `VGTOSITE`, `S1TWBS` (empty: **no bank/yaw/pitch**), `IS1UV`, `S1MVBS` (move) → every 16 frames `PH.TIM++` with music/speech cues (§7) → **end-of-trench test** (§5.4). | WSMAIN.MAC:PHEBS |
| Miss | `B0B` | `BS.RPT = 1`, `IPARM` (player back to 0,0,0), `NWBASE` on the **same** pie (no `GNBASE`), `Q.FRC = −1` (no Force bonus on reruns), `WV.HRD = min(15, WV.HRD + GM.BMP)` (harder each pass), phase ← `BS`. Repeats indefinitely until the port is hit or the player dies; each miss costs one shield unit at the end wall. | WSMAIN.MAC:PHIB0B |
| Hit | `DX1` → `DX2` → `DX3` → `NXT` → `BGN` | §6 and §8. | WSMAIN.MAC:PHIDX1.. PHENXT |
| Death in trench | `B0D` (40 frames) | `VEWB0D`: trench, guns, "EXHAUST PORT MISSED" if `Q.BSH`, "EXHAUST PORT AHEAD" (first wave, port in view), growing GAME OVER; then `EGM`. | WSMAIN.MAC:PHEB0D, VEWB0D |

## 2. The player in the trench (WSMAIN.MAC:S1MVBS, PHIBS)

* Frame: trench axis = **+X**; the ship's matrix stays identity (no roll/yaw/pitch; `S1TWBS` is an `RTS`; the roll kick `S.ROL` written by collisions is not applied here).
* Position `TX` (along the trench), `TY` lateral clamped to **±511**, `TZ` vertical clamped to **−3583 .. −257** (floor at −4096, top edge at 0).
* Forward speed **`VX = 768`** units/frame, constant (set by `PHIBS`; `S1MVBS` never changes it). `TX += VX`.
* Yoke: `VY = VX·|RSX|/256` signed by `RSX` (max 336/frame), `VZ = VX·|RSY|/128` signed by `RSY` (max 720/frame; up = cursor up). Cursor and hood move as usual.
* Starting altitude: from the surface `−3328` (bottom band); from space or after a miss the player is put at `TZ = 0` and clamped to **−257** (top band) on the first frame.

## 3. Trench geometry and drawing (WSBASE.MAC:VWBASE, BSVBOT, BSVSID, BSVFAR, BSVEND, TBSBL, TBSBF; WSPANL.MAC:VWPANEL, PNVLW/PNVRW; WSOBJ.MAC:.WP WPN/WFF/WGA/PORT)

* **Walls** at `Y = ±1024`, **top edges** at `Z = 0`, **floor** at `Z = −4096`. Fixed lines (all green, dim): two top-edge lines and four floor lines at `Y = −1024, −512, +512, +1024` (`TBSBL`) from 28672 ahead (or the end wall if nearer) toward the viewer, each clipped near the viewer to the 45° cone; the **far end** rectangle (`TBSBF`, brightness 0x50) at 28672 ahead or at the end wall; per wedge-row boundary a **vertical line** on each wall from floor to top (`BSVSDW`, brightness 0x60; the row the player is inside gets a "generous drop" so it stays on screen); the **end wall** (`BSVEND`) as a horizontal line between the walls once `BS.EFL` is set. There is no ceiling; there are no stars in the trench (a comment notes "need new star view via top slot").
* **Panels** (WSPANL.MAC): each wall is a ring of 16 flag bytes (`PNLW`/`PNRW`), one per **2048-unit slot** (`slot = (X >> 11) & 15`, ring span 32768). A byte holds four 2-bit codes, bands from the **top** (bits 7-6, band centre `Z = −512`) to the **bottom** (bits 1-0, `Z = −3584`), bands 1024 tall. Codes: 1 = decorative panel (`TD$WPN`, green), 2 = force field / catwalk (`TD$WFF`), 3 = wall gun (`TD$WGA`, red). Panels are drawn for every slot from the player's slot to 28672 ahead, at the slot centre `X = (TX & 0xF800) + 1024`, `Y = ∓1024`, band centre Z; the right wall reuses the left model mirrored (`BJFROT`). Slots within 4096 ahead go through the tight clipper `BJBCLP` (screen coordinates clamped to ±534 X / −24..+624 Y, quotients ≤ 0x100 forced far).
* Model sizes (`.S = 8`, authored at half size): decorative panel outer rectangle 512 deep × 384 tall (inner 256 × 128); catwalk (`WFF`) three lines from the wall 640 units inward at the band's centre, top (+320) and bottom (−320); wall gun (`WGA`) a 1024 × 768 base plate with a gun body/nozzle protruding 192 from the wall. The catwalk therefore visibly spans only the outer 640 of the 1024 half-width, but its collision covers the whole half (§4.2).
* **Catwalk depth cue**: each catwalk gets the next colour of `TFFCUE` (yellow, turquoise, purple, repeating) and brightness starting at 0x88 and dropping 8 per catwalk down to 0x40, so successive catwalks read as depth; the cue index advances (`WG.FCU`) as the player passes a slot containing one.
* **Exhaust port** (`BSVPORT`): `TD$PORT` on the floor at `(BS.PLC, 0, −4096)`: green square base (640 wide), turquoise berm (400), bright red flashing hole (240), drawn when within 28672 ahead, removed once passed by 1024.

## 4. Trench generation, catwalks and wall guns

### 4.1 Pies, wedges, rows (WSBASE.MAC:TPIE, PIE1-11, PIEXX, TWDGxx, NWBASE, GNBASE, DOFAR, NWFAR, IWEDGE)

* A **pie** = 16 wedge references. `BS.WAV = min(31, GM.WAV)` → `TPIE[BS.WAV]` for displayed waves 1..11 (`PIE1`..`PIE11`); wave 12+ uses the **random pie** `PIEXX` (`10,95,XX,94,XX,97,XX,94,XX,97,XX,94,XX,97,XX,29`) whose 7 `XX` slots are filled at `GNBASE` (once per Death Star, not on repeats) from the 17 candidates `TWDG03,06,09,15,14,16,18,20,24,25,26,30,32,35,36,37,55`.
* A **wedge** = list of rows; each row is `SHORT` (2048 units) or `LONG` (4096 units, panels only in its first 2048) with a left and right wall band pattern; wedges end with `NEXT`; the last wedge of a pie ends with a `PORT` row (4096, sets `BS.PLC`) then `END` (sets `BS.ELC`, `BS.EFL`). All 53 wedges are transcribed in the JSON. Every content wedge is exactly **32768** units, every divider (`92-97`) **6144**, the intro wedge `TWDG10` 28672, the port wedges (`29`, `98`, `99`) 30720, so **every trench is 331776 units = 432 frames = 21.6 s** (all pies, including the random one).
* Generation: `NWBASE` clears the rings, pre-generates the first row plus up to 8 more; then `DOFAR` (from `BSVSID` every frame) appends the next row whenever its end would lie within **24576** of the near row (`WG.NRL`). Each new row writes its two flag bytes into slot `WG.FRL >> 11` (so a LONG row's second slot stays 0). `VWBASE` zeroes a slot's bytes when the player leaves it and advances the catwalk colour cue if that slot had one.

### 4.2 Catwalk (force-field) collision (WSPANL.MAC:PNVLW/PNVRW)

While drawing catwalks (`PN.DES = 2`) in the **player's current slot** (the panel centre is ahead: `XP ≥ 0`, i.e. the player is in the first 1024 of the slot — "half of FF depth, more than max speed"): if the player is on that wall's side (`TY ≤ 0` for left, `≥ 0` for right) and `bandZ − 512 ≤ TZ ≤ bandZ + 512` → **hit**: the panel is drawn as `TD$WFG` (bright), `BG1GLW` (one shield unit, gated by the gauge animation; the trench uses the 8-frame quick glow), `AUDCR`, `S.ROL = ±78` (random sign) if `S.ROL == 0` (no visible effect in the trench). Lateral position within the half does not matter: a catwalk blocks its whole side of the trench at its band. Rows with code 2 on both walls at the same band ("singles"/"doubles"/"triples" in the wedge comments) must be passed at another band; "halves" block one side only ("jog left/right"). Walls, floor and top are never collided with (positions are simply clamped).

### 4.3 Wall guns (WSBASE.MAC:DOBASE, TGPROB, BSGUN; WSGUNS.MAC:FRPLGN/FRPRGN, GNBSAVAIL, TGNBS, PANLIN, MOVPL/MOVPR)

* Not while the torpedo is live. On frames where `(FRAMEL & mask) == 0` (`TGPROB[min(WV.HRD,7)]`: mask 15 for HRD 0-3, 7 for 4-5, 3 for 6+; prob byte 128/96/64/32/96/32/96/32 → chance `(256−p)/256` = 50/62/75/87/62/87/62/87 %), `BSGUN` walks every slot from the player's to 24576 ahead and every gun panel (code 3) on both walls, top band first: if the player is **above** the gun's band centre by less than 1024 → fire when `rnd ≥ p`; by 1024..2047 → fire when `(rnd·rnd) >> 8 ≥ p` (rare); **players below a gun are never fired at**.
* A shot needs a free slot: `TGNBS[min(WV.HRD,7)]` = 1,1,2,2,3,3,3,4 of the 6 gun records; while the port is in view (`BS.PFL`) all 6 may be used. Shot (`PANLIN`): starts at the slot centre X, `Y = ∓896`, band centre Z; timer 64 frames; universe coordinates; per frame `X −= 4·(hi(X) − hi(TX))` (drifts toward the player while the player closes at 768), `Z` toward `TZ` with gain 1/16 upward only, `Y` toward `TY` (or toward `∓384` on `WV.HRD = 0`, i.e. wave 1 Easy) with gain 1/16 inward only. Impact/cursor-box/33-point rules as in the dogfight (impact distance ≤ 768 + 272 = 1040).
* **Shooting turrets** (WSLAZR.MAC:CLBLZ, LZCPNW, LZHPN): the laser is a 3-D ray from the ship to `(TX + 28672, TY + ⅞·LZ.RSX, TZ + ⅞·LZ.RSY)`, where `LZ.RSX/RSY` are the yoke's **16-bit** slewed positions (`VG.RSX/RSY`, the pot value times 256, so ±28672 at full deflection: the ray passes exactly through the cursor, `512 · ⅞ · 256 · pot / 28672 = 4 · pot` screen units). *(Corrected 2026-09-13: an earlier draft read this as 7 × the 8-bit pot, which would never reach a wall.)* If it crosses a wall (`|Y| ≥ 1024`) before the floor: hit point on the wall → slot `(hitX >> 11) & 15`, X within the slot's 512..1536 (±64 laser radius), band by `hitZ + 4096` (first band edge at 128, 768 per band + 256 gaps); code **3 → turret destroyed, 100 pts** (`SCRTRT`), code **1 → panel destroyed, 50 pts** (`SCRPNL`); either sets `LZ.HIT = 4` (beam freezes, splash) and `AUDSX`; catwalks (2) cannot be shot. A fireball under the cursor is always hit first. If the ray reaches the floor (`Z = −4096`) it makes a green floor splash (`LZ.HIT = −1`) and may trigger the torpedo (§5.2).

## 5. The exhaust port and "Use the Force"

### 5.1 Where and when

`BS.PLC` = X of the port row; generated when the pie's last wedge is reached (≈24576 ahead, `IWEDGE`), which sets `BS.PFL` and (first wave only) shows **"EXHAUST PORT AHEAD"**. The end wall is 4096 beyond the port (`BS.ELC = BS.PLC + 4096`).

### 5.2 Torpedo trigger (WSLAZR.MAC:CLBLZ `10$`; WSGUNS.MAC:FRPTGN, MVPTGN, VWPTGN)

There is no separate torpedo button. Every frame the lasers are on, the ray's floor intersection is computed: the far point is `(TX+28672, TY+⅞·LZ.RSX, TZ+⅞·LZ.RSY)` (16-bit yoke positions, §4.3); if it is below the floor, `hitX = TX + 28672·(TZ+4096)/(−⅞·LZ.RSY)`, `hitY = TY + ⅞·LZ.RSX·(TZ+4096)/(−⅞·LZ.RSY)`, valid when `|hitY| ≤ 1024`. If the port exists (`BS.PFL`), `PT.LZF == 0`, `|hitY| ≤ 512` and `|hitX − BS.PLC| ≤ 512` → `PT.LZF = 1` → `FRPTGN`: `PT.LIV = 1`, all gun shots destroyed, music `PMSF2` + `AUDPH`. The torpedo pair (turquoise sparklers at `Y ± 128`) flies from `TX + 256` at 768 + VX per frame to `BS.PLC`, dives (`Z ≤ BS.PLC − X − 4096`) and glides to the midline. Once `PT.LIV` is set the hit is decided — the animation is cosmetic. Because the ray passes through the cursor, the floor point is simply where the cursor sits on the floor in perspective: `128 · h / |pot|` ahead (h = height above floor, pot the 8-bit yoke value). Shooting the port thus means aiming the cursor at the port and firing while the lasers' floor point is within ±512 of it in X and Y.

### 5.3 Use the Force (`Q.FRC`; WSBASE.MAC:IWEDGE, WSLAZR.MAC:TSTLAZ, WSGAS.MAC:SCRFRC/TSCFRC/GETFRP)

`Q.FRC = 0` at trench entry ("trying"); the first laser fire while it is 0 sets it to −1 (failed); a repeat pass starts at −1. When the **port row is generated** with `Q.FRC` still 0 → `Q.FRC = 1` and the bonus is scored immediately: `TSCFRC[GM.WAV]` = **5,000 / 10,000 / 25,000 / 50,000 / 100,000** for displayed waves 1 / 2 / 3 / 4 / 5+. So the rule is: fire no lasers from the start of the trench until the last wedge (≈24576 before the port) has been generated — about 90 % of the run; firing after that (including the port shot) keeps the bonus. HUD: **"USE THE FORCE"** (flashing, `VGRW9`) while `Q.FRC == 0`; after success the bonus value + **"FOR USING THE FORCE"** (`VWFRC`) during the trench and `DX1`.

### 5.4 End of trench: hit or miss (WSMAIN.MAC:PHEBS)

When `BS.EFL` and `BS.ELC − TX ≤ 2048`: if `PT.LIV` → **`DX1`** (and speech **"GREAT SHOT KID, THAT WAS ONE IN A MILLION"** when `GM.WAV ≥ 3` and odd, i.e. displayed even waves ≥ 4). Otherwise **miss**: `Q.BSH = 1`, `AUDCR`, `BG1GLW` (one shield); if `S.GAS` was already ≤ 0 → `B0D` (death), else phase ← `B0B` and speech **"R2 NO"**.

## 6. Death Star explosion (`DX1`-`DX3`; WSMAIN.MAC:PHIDX1..PHEDX3, WSXPLD.MAC:BGXPLN, VWXPLN, XP.PH0-3)

| Phase | Duration | What is drawn / heard |
|---|---|---|
| `DX1` | ≈42 frames | music **`PMEND`**; the full Death Star (`VWDTHB`) starting very large (`VGSCAL+0x104`) and shrinking by `hi(DT.STP)` scale steps per frame (10, then 9, 8 … as `DT.STP −= 16`/frame) until `VGSCAL+0x680` — the ship pulling away; force-bonus text if earned. Stars re-initialised, matrix identity. |
| `DX2` | 1 frame | miniature Death Star + start of the burst (`XP.PHS = 1`). |
| `DX3` | ≈119 frames | `XP.PH0` red concentric circles growing in count 1→63 (+2/frame, 31 frames), `AUDDF`; `PH1` blue circles from the centre + expanding red rings (31 frames), `AUDDF`; `PH2` white circles + blue rings (+3/frame to ≥ 80, 27 frames), `AUDDF`; `PH3` expanding white rings (count 128 → <8 by 4/frame, 30 frames). Then `XP.PHS = 0` → `NXT`. |

Total ≈ 162 frames ≈ 8 s. Score for the port (25,000) is added in `NXT`, not here.

## 7. HUD, messages, speech, music in the trench (WSMAIN.MAC:VEWBS, PHEBS; TCMES.MAC)

* Timeline (`PH.TIM` = 16-frame pseudo-seconds): 2 → music **`PMRRP`** (Rebel theme with repeats); even `BS.WAV` (displayed odd waves): 16 → **"LUKE, TRUST ME"**, 24 → **"YAHOO, YOU'RE ALL CLEAR KID"**; odd `BS.WAV`: 16 → **"LET GO, LUKE"**, 22 → **"THE FORCE IS STRONG WITH THIS ONE"**. Trench entry: **"USE THE FORCE, LUKE"** (not on repeats). Shield lines as in the dogfight.
* Messages: first 4 pseudo-seconds: "TOWERS nn"/"CLEARED ALL LASER TOWERS" (first pass) **or** double-size **"EXHAUST PORT MISSED"** (repeat pass). First wave, first 8 pseudo-seconds, first pass, no all-tops bonus: **"SHOOT FIREBALLS"** (wave 1) or alternating with **"AVOID CATWALKS"** every 16 frames (later waves). **"EXHAUST PORT AHEAD"** (double size, first wave, port in view). **"USE THE FORCE"** / bonus text (§5.3). Score, added-points, wave, shield gauge, cursor and hood as usual.
* Sounds: `AUDTL` wall shots, `AUDXL` laser, `AUDSX` turret/panel destroyed, `AUDSS`/`AUDTCZ` fireball shot down, `AUDSH` shield hit, `AUDCR` catwalk/end-wall crash, `PMSF2`+`AUDPH` torpedo, `AUDDF` ×3 explosion.

## 8. `NXT` — next-wave accounting (WSMAIN.MAC:PHINXT, PHENXT, VEWNXT; WSGAS.MAC:SCRPORT, SCRSHLD, ADCGAS, SCRWAV)

`PH.TIM = 4`, decremented every 16 frames; player turned 180° (`AX = BY = −1`), stars streaming (`SMVNXT`), message **"DEATH STAR DESTROYED"**:

| `PH.TIM` | Event | Message |
|---|---|---|
| 3 | **+25,000** exhaust port (`PT.LIV` always set here) | |
| 2 | **+5,000 × shields remaining** (`SCRSHL`) | "BONUS FOR REMAINING ENERGY", "5,000 X n" |
| 1 | bonus shields `ADCGAS`: + option (0..3), capped at the starting level | "n ADDED TO DEFLECTOR SHIELD" or "SHIELD AT FULL STRENGTH" |
| 0 | first Death Star only: selection bonus 200,000 × `GM.WAV` (`TSCBN1-4`) | "STARTING WAVE BONUS" |
| −2 | `GM.WAV = min(98, GM.WAV+1)`; if `GM.WAV < 5`: `GM.BMP = min(4, GM.BMP+1)`; `GM.DIF = min(15, GM.DIF + GM.BMP)`; `SC.FWV = 0xFF`; phase ← `BGN` (new dogfight) | |

≈100 frames total. (`NXT` is only reachable via `DX3`, so the shield bonus is paid only when the Death Star is destroyed.)

## 9. Difficulty summary

| Knob | Effect in the trench |
|---|---|
| `BS.WAV` (= wave−1, clamp 31) | pie choice (11 fixed, then random); speech set parity |
| `WV.HRD` (= BS.WAV + GM.DIF, clamp 15; +`GM.BMP` per repeat) | fire window/probability (`TGPROB`, rows ≥ 7 identical), gun slots (`TGNBS`, ≥ 7 → 4), `WV.HRD = 0` makes shots aim at the sideline instead of the player |
| `GM.WAV` | Force bonus size; "GREAT SHOT KID" parity |
| constants | speed 768, length 331776 (21.6 s), limits, catwalk/gun geometry |

## 10. MAME addresses and a quick trench recipe

`BS.RPT` **0x4898**, `Q.FRC` **0x4B36**, `BS.WAV` **0x4B12**, `Q.BSH` 0x4B3E, `PT.LZF` 0x4844, `PT.LIV` **0x4845**, `BS.EFL` 0x4892, `BS.ELC` 0x4893 (16-bit BE), `BS.PFL` 0x4895, `BS.PLC` 0x4896 (16-bit), `PNLW` 0x4989 / `PNRW` 0x4999 (16 bytes each), `WG.NRL` 0x49B1, `WG.FRL` 0x49B5, `RPIE` 0x4B3F, `XP.PHS` 0x48A1, `DT.SCL` 0x4856; plus `PHASE` 0x4841, `GM.WAV` 0x4B15, `GM.DIF` 0x4B18, `WV.HRD` 0x4B19, `S.GAS` 0x4860, `SC.FWV` 0x4B2D, `TX/TY/TZ` 0x5098/0x509A/0x509C, `VX` 0x5086. Phase init indices: `S0B` **39**, `G0B` 43, `G1B` 45, `BS` **47**, `B0B` **49**, `DX1` **17**, `DX2` 19, `DX3` 21, `NXT` 51, `B0D` 57 (exec = +1).

Recipe (between frames): set `0x4B15` (GM.WAV) = wave−1, `0x4B18` (GM.DIF) = 0..3, `0x4860` (S.GAS) = 6..9, `0x4B2D` = 0xFF (skip first-wave hints) or 0; write **`0x27` (39) to `0x4841`** → next frame `PHIS0B` builds the trench for `BS.WAV` and `PHES0B` enters `BS`. Use 43 (`G0B`) instead to get the roll-in. To test the ending: poke `0x4845` (PT.LIV) = 1 and `TX` (0x5098-99) = `BS.ELC − 0x0900` → `DX1` next frame; or write 17 to `0x4841` with `PT.LIV = 1` to jump straight to the explosion and the 25,000. To test a miss: `TX = BS.ELC − 0x0900` with `PT.LIV = 0` → `B0B`. Never write odd (exec) indices.

## 11. Open questions

1. The wall-hit band mapping in `LZCPNW` (`LZ.PNW − 128`, then 768 + 256 per band with a 64-unit laser radius) is transcribed from the arithmetic; the exact inclusive edges are worth a MAME check.
2. The torpedo hit is decided by the floor-intersection square (±512 in X and Y about `BS.PLC`) — verify that the visible port (640 base) matches this in play and whether a shot that reaches the floor beyond the end wall is possible (the ray is not clipped to `BS.ELC`).
3. `S.ROL` is set by catwalk hits (±78) but `S1TWBS` is empty; I found no consumer of it in the trench — confirm there is no roll effect (the doc says none).
4. `B0B` re-enters with `TZ` clamped to −257 (top band) — check the arcade actually restarts a missed trench at the top; the code path (`IPARM` → `NW1SHP` zeroes `TZ`) says so.
5. `DX1` duration (≈42 frames) computed from the `DT.STP` high-byte stepping with the 7-bit linear wrap; not simulated exactly.
