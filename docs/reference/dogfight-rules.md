# Star Wars (Atari, 1983) — Dogfight stage rules, from the 6809 source

Source: `swsrc/` (WSMAIN.MAC, WSCPU.MAC, WSGUNS.MAC, WSLAZR.MAC, WSOBJ.MAC, WSXPLD.MAC, WSGAS.MAC, WSGLOW.MAC, WSSITE.MAC, WSSTAR.MAC, WSINT.MAC, WSGLOB.MAC, WSVROM.MAC, TCMES.MAC, SNDSPK.MAC, SNDAUD.MAC, SNDPM.MAC, SWMP.DOC, SWOPTS.DOC).
All numbers below are converted to decimal unless written `0x..`. "Frame" means one *game* frame (see §2: 20 per second). Citations are `FILE:label`.

Reading aids used throughout:

* The assembler truncates symbols to 6 characters, so `BGAXPLD`/`BGAXPL`, `SCRTIES`/`SCRTIE`, `SCRSHLD`/`SCRSHL`, `SCRDARTH`/`SCRDAR` are the same routine.
* A `LDA`/`LDB` of a 16-bit variable reads its **high byte** (6809). Several rules below depend on that (e.g. `CPURET`, `PHES1G`).
* Math-box fixed point: `0x4000` = 1.0 for unit vectors / sin / cos (SWMP.DOC). X is forward, Y right, Z up (SWMP.DOC "Strange but true").
* The `PRE2` transform (`M$PSB2`) returns object position in the viewer's frame **halved**: `XP = (X - Xviewer)/2` etc. (SWMP.DOC PRE2). Screen projection: `screen = 512 * YP/XP` (derived: `M.DVN = 0x200` set in WSMAIN.MAC:IMATH is the perspective numerator; the field of view test `|YP| < XP` coincides with the ±480..512 screen limits `VGLIML/R`, WSGLOB.MAC). So an object at real distance D and lateral offset L lands at `512*L/D` screen units.
* Screen coordinates: X −512..+512, Y −512..+512; the "math view" is drawn with a Y offset `VGOFFY = -104` (WSGLOB.MAC:VGOFFY). Cursor and object centers are compared in the un-offset space.

---

## 1. Game flow around the Dogfight

Phase table: WSMAIN.MAC:TPHASE. Each phase has an init entry `PHIxxx` (runs one frame) and an execute entry `PHExxx` (runs every frame).

### 1.1 Start button → Dogfight

| Step | Phase | What happens | Cite |
|---|---|---|---|
| 1 | attract (`BNR/INS/SCR/HIS`) | `STRTCK` runs every attract frame: if credits > 0 and a falling edge on any fire/thumb button (`STRTBT` = both triggers + both thumbs), go to `SG1` and consume a credit. Free-play option forces 1 credit. | WSMAIN.MAC:STRTCK, WSGLOB.MAC:STRTBT |
| 2 | `SG1` (1 frame) | Speech **"RED FIVE STANDING BY"** (`SPKRED`, queued). Shields `S.GAS = 6 + (option bank-1 sw 1-2)` → 6..9. `GM.DIF` = play-difficulty option (0 Easy, 1 Moderate, 2 Hard, 3 Hardest). `GM.BMP=0`, score 0, `SC.FWV=0` (first wave), `Q.GHIT=0`, `FRAME=0`, `WV.LVL=0`. Rheostat calibration limits are nudged by 1. Then phase ← `SDS`. | WSMAIN.MAC:PHISG1, PHESG1; SWOPTS.DOC |
| 3 | `SDS` "Select a Death Star" | See §1.2. Ends with phase ← `SG2` and game timer cleared. | WSMAIN.MAC:PHISDS, PHESDS |
| 4 | `SG2` (1 frame) | Re-init math box, ship/alien/gun records (`IPARM` → `NWNSHP` builds the first alien group), stars. Player orientation set to **face backwards** (`AX = BY = 0xC0` high byte → −1.0: 180° yaw, i.e. facing −X, away from the Death Star). Bonus-coin counter cleared. Phase ← `BGN`. | WSMAIN.MAC:PHISG2, PHESG2 |
| 5 | `BGN` (1 frame) | `OLD1SHP` (keep orientation, clear roll/glow/laser state, center cursor). `GM.DWAV = BCD(GM.WAV+1)` (displayed wave). `SP.WAV = min(31, GM.WAV)`. `WV.HRD = min(15, SP.WAV + GM.DIF)`. Phase ← `SP1`, `WV.LVL = 0`. | WSMAIN.MAC:PHIBGN, PHEBGN |
| 6 | `SP1` **Dogfight** | See §1.3. | WSMAIN.MAC:PHISP1, PHESP1 |

`BGN` is also the entry point for every subsequent Death Star (from `NXT`), so steps 5-6 repeat each wave with the updated `GM.WAV`/`GM.DIF` (WSMAIN.MAC:PHENXT).

### 1.2 Select-a-Death-Star screen (`SDS`)

* Messages on: "SELECT A DEATH STAR", "FIRE LASER AT DESIRED DEATH STAR", "COUNTDOWN", "EASY / WAVE 1 / NO BONUS", "MEDIUM / WAVE 3 / 400,000", "HARD / WAVE 5 / BONUS 800,000" (TCMES.MAC messages `DS1`..`DSZ`, all red/purple/green/blue as listed there).
* Three miniature Death Stars (`VJBMIN`) at screen (X,Y): **(−400, +100)**, **(0, −300)**, **(+400, +100)** (WSMAIN.MAC:TDTH — note the table is stored Y-then-X).
* Countdown: `PH.TIM = 0x100 = 256 frames = 12.8 s`; the digit shown is `PH.TIM*8 >> 8` → counts **8 → 0** (WSMAIN.MAC:PHESDS). On expiry the game starts at **Easy** (`GM.WAV=0`).
* Cursor moves with the yoke (IRQ rheostat, §3.3); it turns **yellow** when over a Death Star, turquoise otherwise (`WV.LVL` used as a flag).
* Hit test per Death Star: `|cursorY + VGOFFY − Y| < 72` **and** `|cursorX − X| < 52` **and** (sum of both) `< 80`. Selecting = any trigger/thumb falling edge (`FIREBT!THMBT` in `GN.SWE`) while over one. Sets `GM.WAV = 0 / 2 / 4` (left / bottom / right) → displayed waves 1 / 3 / 5.
* Bonus for starting higher is paid at the end of the **first** Death Star only (`SCRWAV`, WSGAS.MAC:TSCBN1..4): GM.WAV 1→200,000, 2→400,000, 3→600,000, 4→800,000 (only 2 and 4 are reachable from this screen).

### 1.3 What starts and ends the Dogfight

`PHISP1` (WSMAIN.MAC): `IPGEN` (re-init alien & gun slots, `NWNSHP` spawns the first group), `IXPLD`, `PH.TIM = 0`, `Q.RTHV = 0` (Darth-first-seen flag), `Q.SHK = 9`. On the player's very first wave (`SC.FWV == 0`) `PH.TIM` starts at **39** ("start a bit ahead").

`PHESP1` per frame, in order: `VIEW` → (if `S.GAS < 0` → die, `PHIS0D`) → `MVGUN` → `DONGLW`,`DOXPLD`,`DO1GLW`,`DO1GAS` → `CPU` (aliens think/move/shoot) → `VGTOSITE` → `STWSP1` (roll-if-hit, **auto-aim**, pitch/yaw) → `IS1UV` → `SMVSP1` (stars) → `PH.TIM++` → music/phase timer → **if `WV.LIV < 3` → `ADASHP`** (spawn another alien).

The Dogfight is **time-limited, not kill-limited**:

| `PH.TIM` | Event | Cite |
|---|---|---|
| 40 (2.0 s) | Main theme `PMTH5`, or **Vader's theme `PMDAR`** when `GM.WAV ≥ 3` and odd (displayed waves 4, 6, 8, …) | WSMAIN.MAC:PHESP1 |
| 200 (10.0 s) | Theme B `PMTHB` | |
| 400 (20.0 s) | Descent music `PMDES` | |
| ≥ 420 (21.0 s) | Phase ← `SP2` | |

(Expressions `2+7+1*20.` etc. evaluate left-to-right: 200, 400, 420.) First wave: 420−39 = **381 frames ≈ 19.05 s**.

`SP2` "aliens run away" (WSMAIN.MAC:PHISP2/PHESP2, WSCPU.MAC:CPURET): same frame body but `CPURET` replaces `CPU` (no choreography, **no firing**, no new spawns), and the auto-aim targets the Death Star (`AIMDTH`). Every live alien: `X += 0x400` (1024 units/frame back toward +X = the Death Star); Y high byte moves toward 0 by 2 (512 units) per frame while `|Y| ≥ 0x900`, Z by 3 (768 units) while `|Z| ≥ 0x900`. When `X` overflows past +0x7FFF **and** `|Yhi| ≤ 8` and `|Zhi| ≤ 8`, the alien is switched off (`A$TYP=0`). The player can still shoot them during the retreat (`VIEW` still runs `CLSLZ`). When **all three slots are dead** → phase ← `S0G`. Existing fireballs keep flying during `SP2`.

### 1.4 Transition to the Death Star ("approaching")

| Phase | Behaviour | Cite |
|---|---|---|
| `S0G` init | `DT.SCL = VGSCAL+0x580` (miniature size), `DT.STP = 0x100`. Speech **"THIS IS RED FIVE, I'M GOING IN"** (`SPKTHI`, queued) + R2 "yes" beep (`AUDRY`) — **except** on the first wave when wave 5 was selected (`SC.FWV==0 && SP.WAV==4`), where nothing is said here. | WSMAIN.MAC:PHIS0G |
| `S0G` exec | `VEWHPA` (still draws aliens, guns, lasers, collisions, miniature Death Star). Player view turns toward the Death Star (`S1TW` → `AIMDTH`), stars stream at `FRAME<<8` = 256 units/frame (`S1MVHP`). Ends when player forward vector `AX ≥ 0x3F00` (within ≈10° of the Death Star). | WSMAIN.MAC:PHES0G |
| `S1G` init | If first wave and wave-5 selected: speech **"LOOK AT THE SIZE OF THAT THING"** (`SPKSIZ`). Thrust sound `AUDTH`. | WSMAIN.MAC:PHIS1G |
| `S1G` exec | `VEWHPB`: Death Star drawn with growing scale (`VWDTHB`/`DTHVW` — circle, trench, dish, inside, farm, city blocks; city set depends on `SP.WAV` parity). Each frame `DT.SCL −= hi(DT.STP)` (low byte masked to 7 bits), `DT.STP += 0x60`; exits when `DT.SCL ≤ VGSCAL+0x110`. Simulated: **57 frames ≈ 2.85 s**. Stars dim `ST.BRT −= 2`/frame (128 → 14 at exit). | WSMAIN.MAC:PHES1G |
| next | **`SP.WAV == 0` → `S0B` (straight to the trench, Surface skipped). Otherwise → `GD` (Surface).** | WSMAIN.MAC:PHES1G |

So the Surface stage is skipped **only on displayed wave 1**, i.e. the first Death Star of a game started on Easy (`GM.WAV=0`). Difficulty option does not affect this. `PHIGD` uses `GD.WAV = GM.WAV − 1` ("always skipped on first game wave").

### 1.5 Between Death Stars (for completeness)

`NXT` (WSMAIN.MAC:PHINXT/PHENXT): player turned away from the new Death Star again (`AX=BY=0xC0`), `PH.TIM=4` counting down one step every 16 frames; port score, shield bonus (`SCRSHL`: 5,000 × shields left), bonus shields (`ADCGAS`, capped at starting level), first-wave selection bonus (`SCRWAV`); at `PH.TIM == −2`: `GM.WAV = min(98, GM.WAV+1)`; if `GM.WAV < 5` then `GM.BMP = min(4, GM.BMP+1)`; `GM.DIF = min(15, GM.DIF + GM.BMP)`; `SC.FWV = 0xFF`; phase ← `BGN`.

---

## 2. Timing

| Item | Value | Cite |
|---|---|---|
| Hardware IRQ | periodic, ≈4.0–4.2 ms (source comments: "12.*4.2MS==>50. MS" and "250. * 16 ms = 4 SECONDS" i.e. 4 IRQs = 16 ms). (External note, not in source: MAME uses 3.024 MHz/12 = 252 Hz.) | WSINT.MAC:IRQ |
| **Game frame** | `GMTIMR` reloads with 11 → every **12 IRQs ≈ 50 ms → 20 frames/s**. The mainline `WAITFRAME` spins until the IRQ bumps `GMSYNC`; if the mainline falls a whole frame behind it traps (`SWI`). | WSINT.MAC:IRQ, WSMAIN.MAC:WAITFRAME |
| Vector-generator field | `VGTIMR` reloads with 5 → the VG is restarted at most every **6 IRQs ≈ 25 ms (~40 Hz)**, only if it has halted and a new buffer is ready (double-buffered `VGSYNC`). The mainline draws one buffer per game frame; the VG re-displays the last buffer in between. | WSINT.MAC:DOVG |
| Cursor / rheostat slew | runs in the IRQ at VG-field rate (`RHCTRL` inside `DOVG`), i.e. ~40 Hz, independent of the 20 Hz game logic. | WSINT.MAC:DOVG, RHPOS |
| Fireball / laser / flash sprite animation | also IRQ/VG-field rate (`VG.LZF`, `VG.GNB` every 4 fields, `VG.GNT` every field, `VG.FLS`, `VG.MFL`). Not frozen by the freeze switch (SWOPTS.DOC). | WSINT.MAC:DOVG |
| Game clock `GTIME` | ticks every 4 IRQs (16 ms), 250 ticks = 4 s. | WSINT.MAC:IRQ |
| `FRAME` counter | 16-bit, +1 per game frame, sticks at 0x8000 on overflow. Code often uses `FRAMEL & 0x0F == 0` as "about a second" (really 0.8 s). | WSMAIN.MAC:IFRAME |

**Conclusion for the recreation:** run cursor slew and sprite animation at ~40 Hz (or per display frame), and game logic at the mainline's rate. *(Revised 2026-09-13.)* That rate is **not a fixed 20 Hz**: after `WAITFRAME` the mainline also spins until the vector generator has finished the previous buffer (`VGSYNC`), and `LSR GMSYNC` drops any game ticks it missed. Screens the VG draws slowly therefore run slower. Measured in MAME (`FRAME` at 0x4842 against emulated time): banner and scoring page ≈ 20.5 and 20 frames/s, high score table ≈ 13.6, flight instructions ≈ 12.3, trench ≈ 14.4 (15.7 with the yoke hard over). All per-frame constants in this document are per frame; the recreation reproduces the measured rates per screen.

Freeze/single-step option: option bank-1 switch 8 freezes the mainline; left trigger edge advances one game frame (WSMAIN.MAC:WAITFRAME).

---

## 3. Player: view, yoke, cursor

### 3.1 The player does not move in the Dogfight

`SMVSP1`/`S1MV` only writes `ST.UX = FRAME << 7` (128 units/frame) for star parallax (WSMAIN.MAC:S1MV, WSSTAR.MAC:VWSTAR). The player's universe position `M$TX/TY/TZ+M.S1` stays at (0,0,0) (`NW1SHP`). Aliens move; the player only rotates.

### 3.2 View rotation is automatic ("auto-aim"), not from the yoke

`STWSP1` (WSMAIN.MAC:S1TW): (1) forced roll if recently hit (§6.4), (2) `AIM`, (3) `S1RHPT`, `S1RHYW`.

`AIM` (WSMAIN.MAC:AIM): starting at the current target `AM.PTR` (or slot 0), take the first alien slot with `A$TYP == 1` (alive) **and not glowing** (`A$GLW == 0`) → `AIMA`. If none from that slot to the end → `AIMDTH` (aim at the Death Star, `AM.PTR = 0`; the next frame restarts the scan from slot 0). While scanning past a non-target slot, `Q.SHK` (if > 0) is reset to 9.

`AIMA`: transform the target into the player's frame (`M$PSB2`); if in front, left-shift X,Y,Z together until X is normalised (≥0x4000); if behind, shift Y,Z to max. Then **yaw rate** `RH$RAT(RHEOY) = ~YPhi` and **pitch rate** `RH$RAT(RHEOP) = ZPhi` (signed bytes, roughly ±64..127 × lateral-fraction).

`AIMDTH`: rates from the Death-Star direction (`AY`, `AZ` of the player matrix, or `0x7F − …` when it is behind).

`S1RHPT/S1RHYW` → `RHTRIG`: residue `RH$RSD += ±|rate|/2` per frame (saturating ±127). `RHRSDU`: per frame consume **one** rotation step: if `|residue| ≥ 78` rotate **4.99°** (sin 0x590, cos 0x3FC2) and subtract 78; else if `≥ 14` rotate **0.895°** (sin 0x100, cos 0x3FFE) and subtract 14; else none. Leftover residue (<14) is applied as a fractional rotation to the *downloaded* matrix each frame (`RESIDU`, table `TRHTIC`, 0.064°/tic). Net effect: the view slews toward the target at up to ≈100°/s, with slow fine tracking; there is no yoke input to the rotation in space.

Because the ship starts facing 180° away (§1.1 step 4) and the first group spawns at +X, the opening seconds of every wave are the view swinging round to the incoming TIEs.

### 3.3 Yoke → cursor (IRQ side)

WSINT.MAC:RHCTRL/RHLIM/RHPOS/GNSITE, run every VG field (~40 Hz):

1. Pot filter: needs two consecutive samples on the same side of the current value (`DOPOTS`, one pot per IRQ).
2. `RHLIM`: `v = pot − RH$LO` (self-calibrating minimum from NVRAM `POTSAV`, WSMAIN.MAC:PHERES), `v = v + (v*RH$SP)/256` (spread, self-reducing if it saturates twice), clamp 1..255, then `−128` → signed **NML** −127..+127.
3. Clamp NML to the cursor box: yaw **±112**, pitch **−104..+120** (`VGCURL/R/B/T` = (−512+30+32)/4 etc., WSVROM.MAC:VGCURB..VGCURT).
4. `RHPOS`: slew the 16-bit position `RH$POS` (NML in the high byte) toward `NML.5`: `delta = target − pos`; per field `pos += hi(|delta|) × 0x60/256` (37.5 %) if `hi(|delta|) ≥ 0x40`, else `× 0x30/256` (18.75 %); always at least 1 (rounded up). Exponential approach, no overshoot.
5. `GNSITE`: `VG.CX/CY = pos >> 6` as 10-bit → **cursor screen coords = NML × 4**: X −448..+448, Y −416..+480 (drawn at Y+`VGOFFY`).

The mainline copies these once per frame (`VGTOSITE` → `SI.CX/CY`, `SI.RSX/RSY`). In space, `SI.RSX/RSY` (±128 scale) only (a) shift the drawn X-wing nose/gun tips by up to ±55 (X) / ±40 (Y) screen units (`LZ.GX/GY`, WSSITE.MAC:VWPLAN) and (b) move the laser start points by the same amount. **Enemies do not move in the player's frame when the yoke turns**; only the cursor and hood graphics move.

Cursor stamp: 4 corner brackets (`VGSITE`/"LZA", WSVROM.MAC), turquoise; `VJSITE` positions it from `VRSITE` written by the IRQ.

### 3.4 Stars

50 stars (`M$STNM`) at fixed universe points; the viewer position used for them is (`ST.UX`, `ST.UY`, `ST.UZ`) = (128×FRAME, 0, 0), rotated by the player's matrix (so they swing with the auto-aim). A star is shown when `0x100 < XP ≤ 0xFFF` (real distance 512..8190) and inside the FOV; otherwise it is regenerated at a random spot in front (`STARNW`). Brightness `ST.BRT` (0x80 normally). (WSSTAR.MAC:VWSTAR, STARNW; WSMAIN.MAC:ISTAR)

---

## 4. TIE fighters

### 4.1 Slots, counts, spawning

| Constant | Value | Cite |
|---|---|---|
| Alien record slots `A$EQ` | **3** → at most 3 enemy ships alive at once (Darth counts as one) | WSGLOB.MAC:ALIEN, WSCPU.MAC:A$EQ |
| Live count `WV.LIV` | +1 on spawn (`NWNSHP`/`ADASHP`), −1 on death (`CPUGON` from `BGAXPLD`), floor 0 | WSCPU.MAC:CPUGON, WSXPLD.MAC:BGAXPLD |
| Respawn rule | every `SP1` frame: if `WV.LIV < 3` call `ADASHP` once → the next ship in the current level list is put in the first free slot (`A$TYP==0`). A destroyed ship's slot is free the same frame it explodes. | WSMAIN.MAC:PHESP1, WSCPU.MAC:ADASHP |
| Level lists | when a level's list is exhausted, `WV.LVL++` (clamped to the set's last entry, which is always `TWV2Z`, so it repeats forever) | WSCPU.MAC:ADASHP, SET macro |

So the number of TIEs per wave is unbounded; the player fights a continuous stream, 3 at a time, for ~21 s.

**Wave sets** (WSCPU.MAC:TSPWAV, indexed by `SP.WAV` = GM.WAV clamped to 31; for `SP.WAV ≥ 6`: even → set A5, odd → set A6):

| SP.WAV (displayed wave) | Level 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 0 (1) A1 | TWV1A | TWV2B | TWV2C | TWV2Z | | | |
| 1 (2) A2 | TWV1B | **TRTH1D** | TWV2D | TWV2C | TWV2Z | | |
| 2 (3) A3 | TWV1C | **TRTH1D** | TWV2D | TWV2A | TWV2B | TWV2C | TWV2Z |
| 3 (4) A4 | **TRTH1D** | TWV2D | TWV2A | TWV2B | TWV2C | TWV2Z | |
| 4 (5) A5 | TWV1D | **TRTH1D** | TWV2C | TWV2D | TWV2B | TWV2Z | |
| 5 (6) A6 | **TRTH1D** | TWV2D | TWV2B | TWV2D | TWV2C | TWV2Z | |
| ≥6 even (7, 9, …) | as A5 | | | | | | |
| ≥7 odd (8, 10, …) | as A6 | | | | | | |

Level lists (WSCPU.MAC:TWV*): `TWV1x` = 3 TIEs with choreography `1x1,1x2,1x3` at start spots `1x1..1x3`; `TWV2x` = same spots with choreography `2x1..2x3` (which = `SPLIT` subroutine then `1x*`); `TRTH1D` = TIE(1D1), TIE(1D2), **Darth (RTH) at 1D3**; `TWV2Z` = 18 TIEs: 2A1-3, 2D1-3, 2B1-3, 2D1-3, 2C1-3, 2D1-3.

**Start positions** (WSCPU.MAC:TBG*, universe units; X forward toward the Death Star, Y right, Z up; player at origin):

| Spot | X | Y | Z |
|---|---|---|---|
| 1A1/1B1/1C1 | 31744 (0x7C00) | 0 | +1024 |
| 1A2/1B2/1C2 | 31744 | −1024 | 0 |
| 1A3/1B3/1C3 | 31744 | +1024 | 0 |
| 1D1 | 31744 | −2048 | 0 |
| 1D2 | 31744 | +2048 | 0 |
| 1D3 (Darth) | 31744 | 0 | +2048 |

All spawn **facing the player** (`AX = BY = −1.0`, i.e. yawed 180°, flying −X) (WSCPU.MAC:NWASHP). Shapes: `TS.TIE` = 1 hit, `TS.RTH` = 4 hits (WSCPU.MAC:.WS).

### 4.2 Motion primitives (per frame, WSCPU.MAC)

| Flag | Meaning | Amount |
|---|---|---|
| `C$MF` / `C$MF2` / `C$MF3` | move along own forward axis | 256 / 512 / 768 units (`ASRD6`/`ASRD5` of the 1.0 = 0x4000 axis) |
| `C$MU`,`C$MU2`,`C$MU3` | move along own up axis | 256 / 512 / 768 |
| `C$MD`,`C$MD2`,`C$MD3` | move along own down | 256 / 512 / 768 |
| `C$RL`,`C$RR` / `C$PU`,`C$PD` / `C$YL`,`C$YR` | roll / pitch / yaw own matrix | **4.48°** per frame (`TSNGLE` entry 5: sin 0x4FF, cos 0x3FCE) |
| `C$T0` (0x80) | aim at player: yaw toward player's Y sign, pitch toward Z sign (4.48°/frame each), plus a roll to help whichever axis is idle, with a ±1 (high-byte) dead zone | WSCPU.MAC:CPUAL 40$..60$ |
| `C$T9` (0x40) | aim at a point 4096 units (0x1000) **in front** of the player; also suppresses firing | WSCPU.MAC:CPUAL |
| Velocity is rebuilt from flags each frame (zeroed first), except while glowing from a hit (keeps the thrown velocity). | | WSCPU.MAC:CPUMVL |
| Position clamp | each coordinate kept within about −32000..+31999 (`CPCHKL`: high byte < 0x7D / > 0x82) | WSCPU.MAC:CPCHKL |

Time-to-player at 256/frame from 31744: 124 frames (6.2 s); at 512: 3.1 s; at 768: 2.07 s. Aliens fly **through** the player's position and beyond, then loop/turn (`C$PU` "turnover") and re-attack using `C$T0`.

### 4.3 Choreography interpreter

Ops (WSCPU.MAC: `.CT`, `.CUNTIL`, `.CIF`, `.CGOTO`, `.CGOSUB`, `.CRETURN`; interpreter `CHOPDO`, `CHTW.D/E`, `CHIF.D`, `CHCN.*`):

* `.CT time,twirl,move` — hold the twirl/move flags for the time. Time byte is BCD-ish `s*16 + q*4` frames (s = 0..7 seconds nibble, q = quarter-seconds bits, clamped at 0x73) plus 3: **0x01→7, 0x02→11, 0x10→19, 0x20→35, 0x40→67, 0x80(clamped 0x73)→127 frames** (0.35/0.55/0.95/1.75/3.35/6.35 s).
* `.CUNTIL mask` — while executing the following ops, if any status bit in `mask` is set, skip forward to the next `.CUNTIL` and continue. `.CUNTIL 0` clears the mask.
* `.CIF mask` — case: executes the following ops if a bit matches (mask 0 = always); otherwise skips to the next `.CIF`.

Status bits `A$CHST` (set each frame; all but `C$PV` cleared at the start of `CPUAL`):

| Bit | Meaning | Set where / rule |
|---|---|---|
| `C$AH` 0x0001 | this alien was hit by the laser | WSCPU.MAC:CPHTSA |
| `C$AS` 0x0004 | alien has the player in its sights: player in front of it, closer than 32768, and lateral offset² test `YPS+ZPS ≤ 0x20` (≈ within 1448 units of its forward axis) | CPUAL |
| `C$AV` 0x0008 | player is in the alien's front hemisphere and < 32768 away | CPUAL |
| `C$R1`,`C$R2` 0x10,0x20 | fresh random bits every frame | CPUAL |
| `C$AG` 0x0040 | alien fired this frame | CPUAL |
| `C$PN` 0x0400 | player near: distance ≤ ≈4096 (`XPS+YPS+ZPS ≤ 0x100`) | WSMAIN.MAC:S2VW |
| `C$PS` 0x0800 | player has the alien in the cursor warning zone (§7.3) | S2VW |
| `C$PV` 0x1000 | alien is inside the player's view (drawn this frame) — persists for the gun logic | S2VW |
| `C$PM` 0x2000 | player "middling near": distance ≤ ≈12288 (`≤ 0x900`) | S2VW |

Choreography scripts `TCH1A1 … TCH1DZ`, `SPLIT` are listed verbatim in WSCPU.MAC ("CHOREOGRAPHY TABLES"); the recreation should copy them as data. Summary of behaviours: **A** group: straight in (one 3.35 s leg at 256 then 3.35 s at 512), pitch-up turnover, aim & hover, then "be mean" loop (`TCH1AZ`: aim+roll+forward 512 until a shot is fired, roll back, repeat, occasionally climb). **B**: weave up/down while closing ("partners pass player"). **C**: short weaves then climbing passes. **D**: wait until the player is near, long aimed climbing turns, random left/right choice (`C$R1`), jinking (`TCH1D3`) until hit. `SPLIT` (used by all `2xx` scripts): 7-frame settle, then a random 4-way split (up/down × straight/rolling) at 768 units/frame for 35 frames, optionally an extra 35-frame `C$T9` leg.

### 4.4 Firing rule (fireball launch)

Per alien per frame (WSCPU.MAC:CPUAL, `140$`):

1. alive (`A$TYP==1`), and `C$PV` (on screen last `VIEW`),
2. not aiming-in-front (`C$T9` clear),
3. player distance in the alien's frame `XP > 0x800` → real distance **> 4096**,
4. not glowing from a hit (`A$GLW == 0`),
5. timing window: `(FRAMEL & mask) == 0` **and** `random byte > prob`, from `TGPROB[min(WV.HRD,10)]`,
6. a free gun slot among the last `n` of the 6 (`G$EQ`) gun records.

| WV.HRD | mask (window every N frames) | prob byte (P(fire) in window) | guns usable | expected shots/s per on-screen alien |
|---|---|---|---|---|
| 0 | 0x0F (16) | 0x80 (49.6 %) | 1 | 0.62 |
| 1 | 16 | 0x80 (49.6 %) | 1 | 0.62 |
| 2 | 16 | 0x80 (49.6 %) | 2 | 0.62 |
| 3 | 16 | 0x40 (74.6 %) | 3 | 0.93 |
| 4 | 0x07 (8) | 0x80 (49.6 %) | 4 | 1.24 |
| 5 | 8 | 0x20 (87.1 %) | 5 | 2.18 |
| 6 | 8 | 0x20 (87.1 %) | 6 | 2.18 |
| 7 | 0x03 (4) | 0x80 (49.6 %) | 6 | 2.48 |
| 8 | 4 | 0x60 (62.1 %) | 6 | 3.11 |
| 9 | 4 | 0x40 (74.6 %) | 6 | 3.73 |
| ≥10 | 4 | 0x30 (80.9 %) | 6 | 4.04 |

(WSCPU.MAC:TGPROB; the `.PROB` macro's third field becomes `GUNZ − n×6`, i.e. the alien may only use the *last* n slots.) All aliens share the same `FRAME`, so on a window frame every eligible alien rolls the dice. Firing sets `C$AG` and calls `FRAGUN` (§6.1).

### 4.5 Being hit / destroyed

`CPHTSA` (WSCPU.MAC), entered from `CLSLZ`→`HTSA` when the laser test (§7) picked this alien:

* Ignored if not alive or already glowing ("no double jeopardy").
* Sets `C$AH`, `A$DMC++`, `A$HTA--`. TIE: `A$HTA` 1→0 → **`XPSA`**: small-explosion sound `AUDSX`, passby sound cancelled if it was the passby ship, `BGAXPLD` (slot freed: `A$TYP=0`, `WV.LIV--`, 3 explosion pieces), **score 1,000** (`SCRTIES` → `TSCA1D` = 001000).
* Survivors (only Darth, §5) get the glow/throw treatment.

**Explosion** (WSXPLD.MAC:BGAXP, MVTI1-3, VWTIN): three pieces — left wing+strut (`TI1`), right wing+strut (`TI2`), centre globe (`TI3`) — life **24, 24, 16 frames**. Wings start at the ship centre ± the ship's Y axis/64 and inherit the ship's velocity plus that offset per frame (they fly apart along the wing axis). The globe moves 1/16 of the way from the ship toward the far edge of space (away from the player, along the player→ship line, ±random low byte) per frame. All pieces are drawn through an extra "munge" matrix that rolls 19.04° and pitches 4.99° per frame (tumbling), colour ramp `TVWCLE` by remaining timer, and are dropped when they leave the FOV. Queue `XPQUE` holds 8 pieces (circular; a third simultaneous kill overwrites the oldest).

### 4.6 Passby audio (no damage)

`S2VW`: when an alien's distance ≤ ≈3238 (`XPS+YPS+ZPS ≤ 0xA0`) and no passby is active: `Q.PBB` = its BIC, speech-chip "elephant" pass-by (`SPKELE`, only if no speech queued) + `AUDPB`; when that ship starts moving away → `AUDPS` (short doppler), once. Cleared when the ship leaves the near zone. There is **no ship-to-ship collision** in the Dogfight.

### 4.7 Drawing

TIE model `TD$TIE` scale 13: wings span Y ±208, height ±234, length −208..+182 (WSOBJ.MAC:TPNT). Drawn only when `0x10 < XP ≤ 0x7F00` and `|YP| < XP`, `|ZP| < XP` (90° FOV). Colour from `TVWCL[A$GLW]`: normal = green at brightness 0x80; glowing alternates green/white-ish (WSMAIN.MAC:TVWCL, S2VW).

---

## 5. Darth's ship

* Appears as the third ship of level list `TRTH1D` at spot 1D3 (X 31744, Y 0, Z +2048), choreography `TCH1D3` (jink up/down aimed at the player until hit; then a 35-frame aimed climb per `C$AH`). First appearance by wave: never on displayed wave 1; wave 2, 3, 5 → after the first 3 TIEs die (level 1); wave 4, 6 → in the very first group (level 0); 7+ alternate (odd displayed waves: second group; even: first group). (WSCPU.MAC:TSPWAV, SET A1..A6, NWNSHP/ADASHP.)
* Model `TD$RTH` scale 10: wings ±270 wide (Y), ±180 long, ±130 tall. Hits available `A$HTA = 4`.
* **Cannot be destroyed.** `CPHTSA`: after `A$HTA--` (4→3, never ≤ 0) the code sets `A$HTA = 5` ("KEEP DARTH ALIVE") and every later hit repeats this. Each hit scores **2,000** (`SCRDARTH` → `TSCA2D` "CHASED DARTH OFF"), forces `A$ROL = A$GLW = 0x1F` (31 frames): the ship **rolls 20.34°/frame** (sin 5696, cos 15362) for 31 frames (≈630°), glows (colour table), and while glowing **cannot be hit again, does not fire, and gets no new script velocity** (`CPUMVL` keeps the thrown velocity; `CPUAL` skips the script's twirl flags while `A$ROL > 0` but the `C$T0` aim-at-player turning still runs, and the script timer keeps advancing), and is **thrown**: velocity zeroed then, for the player's forward/right/up axes, `+= (0x4000 − CL.ADS) × axis_x` along forward (bigger push when closer) and `± (random|0x80) × axis` along the other two — knocked away with random sideways spin. Sound `AUDSX`.
* First time Darth is drawn in a wave (`Q.RTHV`): even `SP.WAV` (displayed odd waves): random 50/50 **"STAY IN ATTACK FORMATION"** or **"I'M ON THE LEADER"**; odd `SP.WAV`: **"I HAVE YOU NOW"** (all queued, with breath before/after). Not spoken in `SP2` (`Q.RTHV` forced non-zero). (WSMAIN.MAC:S2VW, PHISP2.)
* He occupies one of the 3 slots until the retreat (`SP2`) removes him, so after he appears only two TIE slots cycle.

---

## 6. Fireballs (alien gun shots)

Gun records: 6 (`G$EQ`) shared by all shooters; TIEs use the last `n` (§4.4). (WSGLOB.MAC:GUN, WSGUNS.MAC.)

### 6.1 Launch (`FRAGUN`)

Type `TYP$LV` (live), mover `MOV$AM` ("aim at player"), timer **`G$TMR = 0x40` = 64 frames (3.2 s)**. Position = alien position − player position (i.e. relative to the player, in universe axes). Sound `AUDTC` (TIE cannons). If the firing alien is the one the view is locked on (`AM.PTR`), `Q.SHK--`; at 0 → speech **"I CAN'T SHAKE HIM"** (`SPKSHK`, only if no speech pending). `Q.SHK` starts at 9 per wave and is reset to 9 when the aim target changes.

### 6.2 Motion (`MOVAM`)

Every frame: `pos = pos − pos/8` on each axis (rounded via `ASRD3` of `−pos`), i.e. **the shot homes exponentially on the player's eye point** (0,0,0): distance × 7/8 per frame, straight line, so its screen position stays fixed except for the view rotation. Dies when the timer expires (64 frames), or when it is no longer inside the player's FOV/in front (`VWGUN` `90$`: live shots that go out of view are simply removed), or on impact. From launch distance 8192 it reaches the impact radius in ~18 frames (0.9 s); from 16384 in 23 (1.15 s); from 31744 in 28 (1.4 s) (simulated).

### 6.3 Impact test (`VWGUN`, WSGUNS.MAC)

For each visible live shot, after computing its screen centre (`BJ.CX/CY`) and hit-size (`TMPSIZ`, same formula as ships: `512×80/XP + 10` screen units ≈ a 160-unit radius sphere + 10):

1. Cursor overlap (for the player shooting it): `|dx| ≤ TMPSIZ`, `|dy| ≤ TMPSIZ`, `|dx|+|dy| ≤ 1.5×TMPSIZ` (octagon); the nearest such shot becomes `CL.GP`.
2. Impact: real distance `2×XT ≤ 0x310 = 784` units (0x200 minimum-speed allowance + 0x100 gun speed + 0x10 fudge; player speed `M$VX` is 0 in space). Then, only if the shot's screen centre lies inside the cursor's reachable box (X within ±448, Y −416..+480): if it is `CL.GP` **and** the lasers are on this frame → the laser kills it instead (§6.5); otherwise **`GNAHIT`**: shield hit.
   * A shot whose centre is outside the cursor box never registers an impact; it keeps shrinking toward the eye and vanishes when `XP ≤ 1`.

### 6.4 Effect on the player (`GNAHIT`)

* Shot becomes `TYP$GL` ("glowing against the shields"): stays at its screen position, white sparkler `VJGNX` (the five tip pinwheels, no spokes) drawn with scale word binary 0, linear `G$TMR×16` and brightness `G$TMR×16`, so it starts small (linear 0xF0 ≈ a quarter of normal size) and **expands** past the screen edges as it fades over **15 frames** (`G$TMR = 0x0F`). It ignores the shot's distance.
* `BG1GLW`: if `GS.GLW == 0` (previous hit fully processed) → `S.GLW = 0x10` (**16 frames**) of full-screen white flash box (`VWGLW` draws `VJFCWN` at max white whenever `S.GLW & 3 ≠ 0`, i.e. 3 of every 4 frames), and `GS.GLW = 1` → shield loss (§8).
* Forced roll: `S.ROL = ±0x20` (sign random if not already rolling) → `S1TW` rolls the view **4.48°/frame for 32 frames ≈ 143°**, and it is *not* un-rolled afterwards (the auto-aim only corrects yaw/pitch).
* Sound `AUDSH`. First hit of the game (`Q.GHIT`) with shields > 3: speech **"I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT"** (`SPKHIT`, only if nothing pending) + R2 sound `AUDRS`.

### 6.5 Shooting a fireball down (`GNHTSG`)

Shot type → `TYP$HR` (hurt) at its current place (`MOV$ST`), fade timer 15 frames, drawn as a purple exploding sparkler; sounds `AUDTCZ` (cannon stop) + `AUDSS`; **score 33** (`SCRSHT` → `TSCSHT` = 000033). In space the laser only kills the shot if it is closer than the closest alien under the cursor (§7.3).

### 6.6 Drawing

`GN1DRW`: scale from distance (binary scale up to 8 halvings, linear remainder), sparkler base `VJGNB` (frame changes every 4 VG fields) with fuse tips `VJGNT` (every field). Hurt shots: purple `VJGNX`, brightness = timer×16, scale clamped between binary 3 and 6.

---

## 7. Player lasers

### 7.1 Firing

* IRQ (`WSINT.MAC:IRQ`): on the **falling edge** of any of left/right trigger or left/right thumb button, bits are OR-ed into `VG.LON`.
* Mainline `TSTLAZ` (WSLAZR.MAC), once per frame: if `VG.LON ≠ 0`: `LZ.ALT++` (alternate gun pair), `LZ.HIT = 0`, **`LZ.EDG = 8`**, clear `VG.LON`. While `LZ.EDG > 0`: `LZ.EDG--`, `LZ.ON = 1`, and the laser end point is re-sampled from the IRQ cursor (`LZ.CX/CY ← VG.CX/CY`). On the first of the 8 frames the X-wing laser sound `AUDXL` starts.
* So: **no rate limit** other than one press per 50 ms frame; a bolt "lives" **8 frames = 0.4 s**; a new press restarts the 8 frames (and re-alternates sides). There is no projectile — the beam is instantaneous and is re-tested against targets **every one of the 8 frames, following the cursor**.
* Which guns: `LZ.ALT` odd → the two **left** guns; even → the two **right** guns (WSLAZR.MAC:VWLAZ).

### 7.2 Drawing

From the gun tips to the cursor: upper gun at (`VGLIML+90` / `VGLIMR−90`, `VGOFFY`) = (∓390, −104); lower gun at (`VGLIML+85` / `VGLIMR−85`, `VGLIMB+35`) = (∓395, −517); both shifted by the yoke hood offset `LZ.GX/GY` (§3.3). Each beam is a chain of segments each half the remaining distance, coloured from the 16-entry `VJLZF0..F` table rotated by the IRQ (`VG.LZF`) — the "pom-pom" pulse. After a hit (`LZ.HIT > 0`) the beam is drawn turquoise with brightness `LZ.HIT×0x3F` and ends in the splash stamp `VJLZS`.

### 7.3 Hit judgement — screen-space cursor overlap, nearest wins

Done in `VIEW` each frame while `LZ.ON` (WSMAIN.MAC:VIEW → `TSTLAZ`, `SNVW`, `VWGUN`, `CLSLZ`):

1. `TSTLAZ` resets `CL.ADS = CL.GDS = 0xFF00`-ish (negative = none).
2. For every drawn alien (`S2VW`) and live/pretty fireball (`VWGUN`): compute the screen centre and `TMPSIZ = perspective(80) + 10` = `512×80/XP + 10` screen units (XP = half the real distance → equivalent to a **160-unit world radius** around the object centre, plus 10 screen units). Test **in screen units, with the *laser* cursor position `LZ.CX/CY`** (sampled from the IRQ cursor this frame):
   * `|BJ.CX − LZ.CX| ≤ TMPSIZ` ("LE for liberality"),
   * `|BJ.CY − LZ.CY| ≤ TMPSIZ`,
   * `|dx| + |dy| ≤ 1.5 × TMPSIZ` (octagon).
   If it passes and the object's `XT` is smaller than the best so far → remember it (`CL.AP`/`CL.ADS` for aliens, `CL.GP`/`CL.GDS` for shots).
   Example sizes: alien at 16384 units → TMPSIZ 15; at 4096 → 30; at 1024 → 90 screen units (TIE wings at those ranges project to 6.5 / 26 / 104 units, so the box is roughly the ship's body, generous when far).
3. `CLSLZ` (WSLAZR.MAC): if lasers on: if a shot candidate exists and is **closer** than the alien candidate → `HTSG` (kill the fireball, §6.5); else if an alien candidate exists → `HTSA` (hit the alien, §4.5/§5). Either sets **`LZ.HIT = 4`**.
4. While `LZ.HIT > 0` (next 4 frames): `LZ.EDG` and `LZ.ON` are forced to 0 (the beam freezes where it hit, shows the splash, no further hits until the next trigger press).

No 3-D ray test is used in space; distance only breaks ties. The "warning zone" `C$PS` (alien in sights, used by choreography) is `|dx|+|dy| ≤ 3×TMPSIZ`.

---

## 8. Deflector shields (`S.GAS`)

| Rule | Value | Cite |
|---|---|---|
| Start | 6 + option (6/7/8/9) | WSMAIN.MAC:PHESG1 |
| Loss trigger | `GS.GLW` set by `BG1GLW` (fireball impact; in other stages also tower/catwalk strikes). `DO1GAS` then, **only if no gauge animation is running** (`GS.HIT ≤ 0`): `GS.HIT=1`, `S.GAS--`. | WSGAS.MAC:DO1GAS, WSGLOW.MAC:BG1GLW |
| Invulnerability window | `BG1GLW` refuses while `GS.GLW ≠ 0`, and `GS.GLW` is cleared only at the end of the gauge redraw animation: (10 − old) + 1 + 2×new + 1 = **10 + old frames** (9→8: 19 frames ≈ 0.95 s; 6→5: 16; 3→2: 13; 1→0: 11). A fireball impact during that window costs no shield and produces no screen flash (`BG1GLW` is a no-op), but `GNAHIT` still rolls the ship, plays `AUDSH` and dissolves the shot. | WSGAS.MAC:GSVNEW, WSGLOW.MAC:BG1GLW |
| Death | when `S.GAS` would go below 0: `S.GAS = −1`, no animation; `PHESP1` sees `S.GAS < 0` at the start of the next frame → `PHIS0D`. **So the game ends on the hit *after* the gauge reads 0.** With 0 shields the HUD shows flashing double-size **"SHIELD GONE"**. | WSGAS.MAC:DO1GAS, VWGAS, WSMAIN.MAC:PHESP1 |
| Voice at levels | reaching 2: **"R2, TRY AND INCREASE THE POWER"** + `AUDRD`; reaching 1: `AUDRC`; reaching 0: **"I'VE LOST R2"** + `AUDDR`. | WSGAS.MAC:DO1GAS |
| Gauge | top of screen, title `VJFUEL`, bar `VJGA0..9` + digit; colour by level: 5-9 green, 3-4 yellow, 1-2 red, 0 off; flashing redraw animation on loss; bright for 20 frames after a refill. | WSGAS.MAC:VWGAS, TGCLR |
| Bonus shields | at the end of a destroyed Death Star (`NXT`): `+ option bank-1 sw 5-6 (0..3)`, capped at the starting level. End-of-wave score 5,000 per unit left. | WSGAS.MAC:ADCGAS, SCRSHLD |

---

## 9. Difficulty

Two knobs reach the Dogfight (WSMAIN.MAC:PHIBGN, PHENXT):

* `SP.WAV` (= `GM.WAV` clamped 31): selects the **wave set** (which level lists / when Darth appears, §4.1), the Death-Star city drawing, Darth's voice line, and whether the Surface is skipped (`SP.WAV==0`).
* `WV.HRD = min(15, SP.WAV + GM.DIF)`: selects the **fire-rate row** (§4.4, rows ≥10 identical). `GM.DIF` starts at the operator option (0..3) and grows after each Death Star by `GM.BMP`, which itself grows by 1 per Death Star while `GM.WAV < 5` (max 4) — so Easy starters ramp hard, Hard starters ramp +1 per wave.

Resulting `WV.HRD` per Death Star (w = displayed wave, h = WV.HRD):

| Start / option | DS1 | DS2 | DS3 | DS4 | DS5 | DS6 | DS7 | DS8 |
|---|---|---|---|---|---|---|---|---|
| Easy (w1) / Easy | w1 h0 | w2 h2 | w3 h5 | w4 h9 | w5 h14 | w6 h15 | w7 h15 | w8 h15 |
| Easy / Moderate | w1 h1 | w2 h3 | w3 h6 | w4 h10 | w5 h15 | … | | |
| Easy / Hard | w1 h2 | w2 h4 | w3 h7 | w4 h11 | w5 h15 | | | |
| Easy / Hardest | w1 h3 | w2 h5 | w3 h8 | w4 h12 | w5 h15 | | | |
| Medium (w3) / Easy | w3 h2 | w4 h4 | w5 h7 | w6 h10 | w7 h13 | w8 h15 | | |
| Medium / Moderate | w3 h3 | w4 h5 | w5 h8 | w6 h11 | w7 h14 | w8 h15 | | |
| Medium / Hard | w3 h4 | w4 h6 | w5 h9 | w6 h12 | w7 h15 | | | |
| Medium / Hardest | w3 h5 | w4 h7 | w5 h10 | w6 h13 | w7 h15 | | | |
| Hard (w5) / Easy | w5 h4 | w6 h5 | w7 h6 | w8 h7 | w9 h8 | w10 h9 | w11 h10 | w12 h11 |
| Hard / Moderate | w5 h5 | w6 h6 | w7 h7 | w8 h8 | w9 h9 | w10 h10 | w11 h11 | w12 h12 |
| Hard / Hard | w5 h6 | w6 h7 | w7 h8 | w8 h9 | w9 h10 | w10 h11 | w11 h12 | w12 h13 |
| Hard / Hardest | w5 h7 | w6 h8 | w7 h9 | w8 h10 | w9 h11 | w10 h12 | w11 h13 | w12 h14 |

Nothing else in the Dogfight scales with difficulty: alien speeds, turn rates, spawn positions, laser hit sizes, fireball speed, dogfight length and shield loss are constants. (Ground/trench stages additionally use `WV.HRD` for gun counts, `TGNGD`/`TGNBS`.)

Option summary (SWOPTS.DOC, read in WSMAIN.MAC:PHESG1, WSGAS.MAC:ADCGAS): bank-1 sw1-2 starting shields 6/7/8/9 (`OPTS1+1 & 3`); sw3-4 difficulty (`(OPTS1+1 >> 2) & 3`); sw5-6 bonus shields 0-3 (`OPTS1 & 3`); sw7 attract music; sw8 freeze.

---

## 10. Speech, sounds, music and on-screen text during the Dogfight

Speech driver (SNDSPK.MAC): `SPKNEW` queues a sentence (16-deep FIFO); `SPITE`-type lines ("if I can't be first I won't be at all") are dropped unless the queue is empty and nothing is playing; `SPKSKP` discards queued lines (used on death).

| Trigger | Line | Kind | Cite |
|---|---|---|---|
| Game start (`SG1`) | "RED FIVE STANDING BY" | queue | WSMAIN.MAC:PHISG1 |
| Coin inserted (first / again) | "THE FORCE WILL BE WITH YOU" / "ALWAYS" | queue | WSMAIN.MAC:IFRAME |
| Darth first drawn, even `SP.WAV` | random: "STAY IN ATTACK FORMATION" or "I'M ON THE LEADER" (with breaths) | queue | WSMAIN.MAC:S2VW |
| Darth first drawn, odd `SP.WAV` | "I HAVE YOU NOW" | queue | S2VW |
| 9th shot from the locked-on alien in a wave | "I CAN'T SHAKE HIM" | drop-if-busy | WSGUNS.MAC:FRAGUN |
| alien within ≈3238 units | elephant pass-by roar (speech chip) + `AUDPB`; `AUDPS` when it recedes | drop-if-busy | S2VW |
| first shield hit of the game, shields > 3 | "I'M HIT BUT NOT BAD, R2 SEE WHAT YOU CAN DO WITH IT" + `AUDRS` | drop-if-busy | WSGUNS.MAC:GNAHIT |
| shields → 2 / 1 / 0 | "R2, TRY AND INCREASE THE POWER"+`AUDRD` / `AUDRC` / "I'VE LOST R2"+`AUDDR` | queue / — / drop-if-busy (1.75 s pause first) | WSGAS.MAC:DO1GAS |
| `S0G` (retreat done) | "THIS IS RED FIVE, I'M GOING IN" + `AUDRY` | queue | WSMAIN.MAC:PHIS0G |
| `S1G`, first wave & wave 5 chosen | "LOOK AT THE SIZE OF THAT THING" (instead of the above) | drop-if-busy | PHIS1G |
| death (`S0D`) → `EGM` | skip queue; "REMEMBER", "THE FORCE WILL BE WITH YOU … ALWAYS" | queue | PHIS0D, PHIEGM |

Sound effects: `AUDTC` TIE cannon on launch, `AUDTCZ`/`AUDSS` shot destroyed, `AUDSH` shield hit, `AUDSX` ship explosion / Darth hit, `AUDXL` X-wing laser, `AUDPB/AUDPS` pass-by, `AUDTH` thrust (`S1G`) (SNDAUD.MAC labels).

Music (SNDPM.MAC): §1.3 table; `PMTH5` main theme (2 s in), `PMTHB` (10 s), `PMDES` descent (20 s); `PMDAR` Vader theme replaces the main theme on displayed even waves ≥ 4.

On-screen text/HUD (WSMAIN.MAC:VIEW, VWMES; TCMES.MAC):

* Score, 8 digits with commas, green, top-left (`VGRW3`, x = −480); last amount added (yellow, fading, 6 digits) below it for ≈30 frames (`SC.ADT` 255 − 8/frame, off below 32).
* Wave number (`GM.DWAV`), green, top-right.
* Shield gauge + digit, top centre; "SHIELD GONE" (flashing colour `VJMFL`, double size) when 0.
* First wave only (`SC.FWV==0`), for `PH.TIM < 100` (5 s): **"SHOOT FIREBALLS"** (white) and **"SHOOT TIE FIGHTERS"** (red) alternate every 16 frames at `VGRW7`.
* Miniature Death Star (`VJBMIN`, scale `VGSCAL+0x100`) when it is in front (`AX > 0` and within the FOV).
* Cursor, X-wing hood + four gun tips, stars, explosions, fireballs, lasers, hit flash.

---

## 11. Death in space

`PHIS0D`/`PHES0D` (WSMAIN.MAC): speech queue skipped; for **40 frames (2 s)**: `VEWS0D` (no cursor, no laser test; aliens, guns, explosions still drawn), guns still move, `KPGLOW` keeps the white flash cycling, view rolls **−4.48°/frame** continuously, **"GAME OVER"** grows from scale byte 0xC0 to 0 at 6 per frame (32 frames). Then `EGM`: accounting, high-score check → initials entry or attract with Ben's theme.

---

## 12. Constants quick reference

| Symbol | Value | Meaning |
|---|---|---|
| game frame | 50 ms (12 IRQs) | WSINT.MAC:IRQ |
| Dogfight length | 420 frames (21 s); 381 on the first wave | WSMAIN.MAC:PHESP1 |
| alien slots | 3 | A$EQ |
| gun slots | 6 (TIEs use last n per WV.HRD) | G$EQ, TGPROB |
| spawn X | 31744 (0x7C00) | TBG |
| alien forward speed | 256 / 512 / 768 per frame | SNMVF/SNMVF2 |
| alien turn step | 4.48°/frame | TSNGLE[5] |
| alien position clamp | ≈ ±32000 | CPCHKL |
| min firing distance | 4096 | CPUAL `SUBD #800` |
| alien "in sights" lateral | ≈1448 units cylinder | CPUAL `CMPD #20` |
| near / mid distances | 4096 / 12288 | S2VW |
| pass-by distance | ≈3238 | S2VW |
| fireball life | 64 frames | FRAGUN |
| fireball homing | ×7/8 per frame | MOVAM |
| fireball impact distance | 784 units | VWGUN |
| laser bolt life | 8 frames, re-tested each frame | TSTLAZ |
| hit freeze | 4 frames | CLSLZ |
| hit box | 160-unit sphere → `512×160/D + 10` screen units, octagon 1.5× | S2VW, VWGUN |
| cursor box (screen units) | X ±448, Y −416..+480 | VGCUR* |
| cursor slew | 37.5 % / 18.75 % of remaining per VG field | RHPOS |
| view slew | 4.99° or 0.895° steps per frame from rate residue | RHRSDU |
| hit roll | 32 frames × 4.48° | GNAHIT, S1TW |
| screen flash | 16 frames | BG1GLW |
| Darth glow/roll | 31 frames, 20.34°/frame | CPHTSA, CPUAL |
| TIE explosion | 24/24/16 frames | BGAXP |
| scores | TIE 1000, Darth hit 2000, fireball 33 | WSGAS.MAC:TSC* |
| shields | start 6-9; game over on the hit after 0 | DO1GAS |
| select screen countdown | 256 frames | PHISDS |
| DS approach zoom | ≈57 frames | PHES1G |

---

## 13. Open questions / not determined

1. **Projection constant.** `screen = 512×YP/XP` is inferred from `M.DVN = 0x200`, the FOV tests and the ±480/512 screen limits; the divider's exact fixed-point format is in the math-box microcode/hardware (not in these files). Verify against MAME (e.g. a TIE at known distance).
2. **Initial 180° facing.** `PHISG2`/`PHINXT` set `AX=BY=0xC0` ("face backwards"); with spawns at +X this means every wave opens with the auto-aim swinging the view round. Confirm visually that this matches the arcade (it may be masked by the hyperspace star streak of `NXT`).
3. **Auto-aim rate scaling.** `AIMA`'s normalisation loop (shift until XP overflows) gives a rate of roughly `YP/XP × 64..127`; I did not derive the exact function. Copy the shift loop rather than a formula.
4. **VG scale opcode semantics** (`VGSCAL = 0x7200`, binary/linear fields) for the Death-Star zoom sizes and fireball sizes are in the AVG hardware docs, not here; only the frame counts were computed.
5. **Rheostat calibration** (`RH$LO`, `RH$SP` from NVRAM `POTSAV`) is adaptive; a recreation should just map the yoke linearly to NML −127..127 then clamp to the cursor box.
6. **`RHPOS` unit detail**: the slew multiplies the high byte of |delta| (with the 0xFF rounding) — treat as "fraction of remaining distance per VG field"; exact sub-pixel behaviour was not modelled.
7. **Fireball vs. player when out of the cursor box**: per `VWGUN` such shots never damage the player; worth confirming in MAME since it materially affects difficulty.
8. `CPURET`'s Y/Z convergence works on the high byte (steps of 512/768 units); the exact frame at which the last alien disappears (and thus `S0G` starts) depends on where the retreat began — not tabulated.
9. Choreography scripts were summarised, not transcribed; the recreation should port `TCH*`/`SPLIT` from WSCPU.MAC as data with the interpreter rules in §4.3 (note the `.CUNTIL`/`.CIF` skipping semantics in `CHCN.E`/`CHIF.D`).
10. The exact `TVWCL`/`TVWCLE` colour ramps and stamp shapes (`VJGNB`, `VJGNX`, `VJLZS`, `VJFCWN`) are in WSVROM.MAC and were not documented beyond their role.
