# Dogfight enemy choreography, auto-aim and retreat — exact rules from WSCPU.MAC / WSMAIN.MAC

Companion to `choreography.json` (which holds every script, level list, wave set and start spot as data). This file gives the semantics in words. Hex is written `0x..`; "frame" = one 20 Hz game frame. Cites are `FILE:label`.

## 1. Flag constants

Twirl byte (WSCPU.MAC:CPUAL `20$..25$`, `C$T9`, `C$T0`):

| Flag | Value | Effect (each is one 4.48° rotation of the alien's own matrix) |
|---|---|---|
| `C$RL` | 0x01 | roll left |
| `C$RR` | 0x02 | roll right |
| `C$PU` | 0x04 | pitch up |
| `C$PD` | 0x08 | pitch down |
| `C$YR` | 0x10 | yaw right |
| `C$YL` | 0x20 | yaw left |
| `C$T9` | 0x40 | aim at a point 4096 (0x1000) universe-X ahead of the player; also **suppresses firing** |
| `C$T0` | 0x80 | aim at the player (§4) |

Move byte (WSCPU.MAC:CPUMVL `20$..32$`):

| Flag | Value | Velocity added per frame (unit axes = 0x4000) |
|---|---|---|
| `C$MD` | 0x01 | −UP/64 = 256 units down along own up axis |
| `C$MD2` | 0x02 | −UP/32 = 512 down |
| `C$MU` | 0x04 | +UP/64 = 256 up |
| `C$MU2` | 0x08 | +UP/32 = 512 up |
| `C$MF` | 0x10 | +FWD/64 = 256 forward |
| `C$MF2` | 0x20 | +FWD/32 = 512 forward |
| `C$MF3`/`C$MU3`/`C$MD3` | 0x30/0x0C/0x03 | both bits = 768 |

Status word `A$CHST` (16-bit; masks in `.CUNTIL`/`.CIF`):

| Bit | Value | Set by | Meaning |
|---|---|---|---|
| `C$AH` | 0x0001 | WSCPU.MAC:CPHTSA | this alien was hit by the laser this frame |
| `C$AD` | 0x0002 | nobody ("please delete") | unused |
| `C$AS` | 0x0004 | CPUAL | alien has the player in its sights (player in front, XP < 0x4000 i.e. < 32768 units, `YPS+ZPS ≤ 0x20`) |
| `C$AV` | 0x0008 | CPUAL | player in the alien's front hemisphere and < 32768 away |
| `C$R1`,`C$R2` | 0x10, 0x20 | CPUAL | two random bits, refreshed every frame from `P.RND1` |
| `C$AG` | 0x0040 | CPUAL | alien fired this frame |
| `C$PN` | 0x0400 | WSMAIN.MAC:S2VW | player near (`XPS+YPS+ZPS ≤ 0x100`, ≈ ≤ 4096 units) |
| `C$PS` | 0x0800 | S2VW | player's cursor within 3× hit size of the alien (warning zone) |
| `C$PV` | 0x1000 | S2VW | alien inside the player's view this frame (persists into CPUAL) |
| `C$PM` | 0x2000 | S2VW | player "middling near" (`≤ 0x900`, ≈ ≤ 12288 units) |

## 2. `.CT` time byte → frames

Macro (WSCPU.MAC:.CT): `v = min(time, 0x73)`; `enc = (v & 0x70)*2 + (v & 3)*8`; op byte = `4 + enc`. Interpreter (CHTW.D): `timer = opByte >> 1` = `2 + (v & 0x70) + (v & 3)*4`. CHTW.E decrements once per frame and fetches the next op when the result goes negative, so the flags are applied on **timer + 1** consecutive frames (the decode frame plus `timer` more). Verified:

| `.CT` arg | op byte | timer | frames applied | seconds |
|---|---|---|---|---|
| 0x01 | 0x0C | 6 | 7 | 0.35 |
| 0x02 | 0x14 | 10 | 11 | 0.55 |
| 0x10 | 0x24 | 18 | 19 | 0.95 |
| 0x20 | 0x44 | 34 | 35 | 1.75 |
| 0x40 | 0x84 | 66 | 67 | 3.35 |
| 0x80 | (clamped to 0x73) 0xFC | 126 | 127 | 6.35 |

Worked example 1: `.CT 40,…`: v=0x40; enc=(0x40)*2+0=0x80; byte=0x84; timer=0x42=66; frames=67.
Worked example 2: `.CT 02,…`: v=2; enc=0+2*8=0x10; byte=0x14; timer=10; frames=11.
Exception: the first op decoded at spawn (inside `NWASHP`/`ADASHP` → `NWCHOR` → `CHNXT`, which runs at the *end* of the frame after `CPU`) is not applied on the spawn frame, and its timer is decremented on the next frame before the first application → `timer` frames, not `timer+1`.

## 3. Interpreter semantics (WSCPU.MAC:NWCHOR, CHNXT, CHOPDO, CHCN.D/E, CHIF.D, CHGO.D, CHGS.D, CHRT.D, CHTW.D/E)

Encoding: every op is 3 bytes `[opByte, word]`. `opByte`: 0 = UNTIL (word = mask), 0x80 = IF (word = mask), 1 = GOTO (word = address), 2 = GOSUB, 3 = RETURN (word 0), `4 + timerEnc` = CT (bytes = twirl, move). Dispatch uses `opByte & 7`: 0 → IF handler, 1..3 as named, 4 = CT decode, 5 = CT execute (CHTW.D bumps the stored op from 4 to 5).

Per-alien state: `A$CHPC` pc, `A$CHOP` current op byte, `A$CHTM` timer, `A$CHTW`/`A$CHMV` current twirl/move flags, `A$CHCN` control mask (16-bit), `A$CHST` status, `A$CHRT` one return address.

**Spawn** (`NWCHOR`): twirl = move = 0, timer 0, control mask 0, status 0, pc = script start, then `CHNXT` immediately.

**Every frame, per live alien** (`CPUAL`, called from `CPU` after `VIEW`):

1. `CHOPDO`:
   * **Control check first**: if `(status & controlMask) ≠ 0` → `CHCN.E`: from the current pc (which already points at the op *after* the running CT) scan forward in 3-byte steps until an op with `opByte == 0` (an UNTIL); set pc there; `CHNXT`. The running CT is abandoned this frame regardless of its timer.
   * Else dispatch `A$CHOP & 7`.
2. `status := (status & C$PV) | (random & (C$R1|C$R2))`; `CP.AC/RL/PT/YW := 0`.
3. If `A$ROL > 0` (Darth after a hit): `A$ROL--`, roll 20.34° (sin 5696, cos 15362), **skip step 4**.
4. Apply twirl flags in bit order RL, RR, PU, PD, YR, YL — each a separate 4.48° math-box rotation (`TSNGLE[5]`, sin 0x4FF, cos 0x3FCE); each increments/decrements `CP.RL/CP.PT/CP.YW`.
5. `CPUMVL`: unless glowing (`A$GLW ≠ 0`, keep old velocity), velocity := 0 then add move flags in bit order MD, MD2, MU, MU2, MF, MF2; `DOAMOV`: `T += V` per axis (an axis is skipped if the 16-bit add overflows); `CPCHKL`: per axis if high byte ≥ 0x7D → 0x7CFF, if ≤ 0x82 → 0x8300.
6. If alive: download the alien matrix as "ship 1", transform the player's position (X temporarily +0x1000 if `C$T9`) → XP,YP,ZP; if XP ≥ 0: `A$AIM=1`; if XP < 0x4000: set `C$AV`; if `YPS+ZPS ≤ 0x20`: set `C$AS`. Then the firing test (dogfight-rules.md §4.4) which sets `C$AG`.
7. If `C$T0`: aim-at-player (§4).
8. Clear `C$PV` from status.

**`CHNXT`**: read opByte at pc into `A$CHOP`. If it is 0 (UNTIL): `controlMask := word`, `pc += 3`, repeat `CHNXT`. Otherwise fall into `CHOPDO` (control check, then dispatch) **in the same frame**. Decoding therefore chains through any number of UNTIL/IF/GOTO/GOSUB/RETURN ops within one frame until a CT is decoded.

**CT decode** (`CHTW.D`): `timer := opByte >> 1`; flags := the two bytes; `pc += 3`; `A$CHOP := 5`; return to `CPUAL` → flags are applied this frame.
**CT execute** (`CHTW.E`, every following frame): `timer--`; if negative → `CHNXT` (the next op is decoded now, and if it is a CT its flags replace the old ones this same frame); else keep the flags.

**UNTIL when its bit is set mid-op**: handled by the control check at the top of `CHOPDO`, i.e. before the timer decrement, on every frame including the decode frame's successors. The current CT is dropped immediately; pc moves to the *next* UNTIL op (skipping CTs, IFs, GOTOs — any op whose byte ≠ 0) and that UNTIL becomes the new mask. `.CUNTIL 0` (mask 0) never triggers and serves as "end of guarded block". The mask survives GOTO/GOSUB/RETURN until another UNTIL is decoded. Note the abandoned CT's flags remain in `A$CHTW/A$CHMV` until the next CT decodes, which in every script happens in the same frame.

**IF** (`CHIF.D`): if `word == 0` or `(status & word) ≠ 0`: `pc += 3`, continue (`CHNXT`). Otherwise skip forward in 3-byte steps until an op with byte 0x80 (the next IF) and evaluate that one; **UNTIL ops are skipped too** while searching. There is no end-if: after a matching IF the following ops run until they hit another IF (evaluated as a new case) or a GOTO/RETURN. Scripts use the pattern `IF a … GOTO x / IF b … GOTO x / IF 0 …`. If no later IF exists the scan would run past the table (never happens in these scripts).

**GOTO**: `pc := word`, `CHNXT`. **GOSUB**: `A$CHRT := pc + 3`, `pc := word`, `CHNXT`. **RETURN**: `pc := A$CHRT`, `CHNXT`. A single return slot — no nesting. The only subroutine is `SPLIT`, called from each `TCH2xx` entry; it returns into the `TCH1xx` body that immediately follows the GOSUB.

**End of script**: no terminator exists. Every script ends in a GOTO loop (`TCH1AZ`/`1BZ`/`1CZ`/`1DZ` "be mean" loops) or RETURN. `TCH1C1` has no final GOTO: after its last `.CUNTIL 0` it runs into `TCH2C2` (GOSUB SPLIT, then the `TCH1C2` body, then `TCH1CZ`). Recorded in the JSON as `{"op":"fallthrough"}`.

**Timing of status bits as seen by masks**: `CHOPDO` runs at the start of `CPUAL`, so masks see `C$PV/PN/PM/PS` and `C$AH` from *this* frame's `VIEW`, and `C$AV/AS/AG` plus the random bits from the *previous* frame's `CPUAL`. `SPLIT` opens with a 7-frame `.CT 01` "to allow random to get set" because status is zero at spawn.

## 4. `C$T0` aim-at-player (WSCPU.MAC:CPUAL `40$..60$`)

Inputs: XP,YP,ZP = player position in the alien's frame (halved), computed in step 6 above; only the signed **high bytes** `YPhi`, `ZPhi` matter. `CP.YW`, `CP.RL`, `CP.PT` = net script commands this frame (YWL −1 / YWR +1, RLL −1 / RLR +1, PTU +1 / PTD −1).

Runs only when `C$T0` is in `A$CHTW` (also during Darth's forced roll, when the ordinary twirl flags are skipped):

1. **Yaw**: if `CP.YW ≠ 0` skip yaw and its roll assist. Else `YPhi ≥ 0` → yaw right (`SNYWR`), `YPhi < 0` → yaw left.
   Roll assist: skip if `CP.RL ≠ 0`; skip if `ZPhi ∈ {−1, 0}` (dead zone, |Z| < 256 half-units ≈ 512 units); else if `sign(ZPhi) XOR sign(YPhi)` is negative (signs differ) → roll right, else (same signs, "+Z up, +Y right quadrant") → roll left.
2. **Pitch**: if `CP.PT ≠ 0` skip. Else `ZPhi ≥ 0` → pitch up (`SNPTU`), else pitch down.
   Roll assist: skip if `CP.RL ≠ 0` (a roll from step 1 counts); skip if `YPhi ∈ {−1, 0}`; else if `sign(YPhi) XOR sign(ZPhi)` negative → roll **left**, else roll **right**.

Each call is a full 4.48° rotation applied immediately, in the order yaw, roll-assist, pitch, roll-assist. `C$YL+C$YR` in a script (TCH1D3) nets `CP.YW = 0`, so the aim yaw still runs.

## 5. Alien matrix, rotation order and motion (SWMP.DOC; WSCPU.MAC:SNRL/SNPT/SNYW, SNMVF/SNMVU/SNMVD, NWASHP; WSMATH.MAC:UNITV)

Matrix block: `[AX AY AZ / BX BY BZ / CX CY CZ]`, 0x4000 = 1.0. The math box computes ship-frame coordinates of a universe vector as `XP = AX·x + BX·y + CX·z` etc. (PRESUB/PRE2), so **column 1 `(AX,BX,CX)` is the ship's forward axis in universe coordinates, column 2 `(AY,BY,CY)` its right axis, column 3 `(AZ,BZ,CZ)` its up axis**. `SNMVF` adds column 1 >> 6 to the velocity ("move forward"), `SNMVU` adds column 3 >> 6 ("move up"). Row A is the universe X axis expressed in ship coordinates.

Initial orientation: `UNITV` = identity, then `NWASHP` stores 0xC0 into the high bytes of `AX` and `BY` → `AX = BY = 0xC000 = −1.0`, `CZ = +1.0`: a 180° yaw; forward = (−1,0,0), i.e. every alien spawns at X = +31744 flying toward −X, straight at the player at the origin. (The player's master matrix gets the same 180° at `PHISG2`/`PHINXT`.)

Rotation formulas (applied to all three rows R = A, B, C, with ½ LSB rounding):

| Op | Formula | Rotates about | sin > 0 means |
|---|---|---|---|
| ROLL | `Ry' = Ry·cos − Rz·sin; Rz' = Ry·sin + Rz·cos` | own forward axis | roll **right** (`SNRLR` +sin, `SNRLL` −sin) |
| PITCH | `Rz' = Rz·cos − Rx·sin; Rx' = Rz·sin + Rx·cos` | own right axis | pitch **up** (`SNPTU` +sin, `SNPTD` −sin) |
| YAW | `Rx' = Rx·cos − Ry·sin; Ry' = Rx·sin + Ry·cos` | own up axis | yaw **left** (`SNYWL` +sin, `SNYWR` −sin) |

(Sanity check for yaw: row A = (1,0,0) with sin>0 becomes (cos, sin, 0): the universe +X axis acquires a positive right-component, so the nose has turned left.) Angle constants: script/aim steps 4.48° (`TSNGLE[5]` sin 0x4FF=1279, cos 0x3FCE=16334); Darth hit roll 20.34° (sin 5696, cos 15362) for 31 frames. Full `TSNGLE`: 0.63°, 0.90°, 1.27°, 1.90°, 3.47°, 4.48°, 4.99°, 4.99° (only entry 5 is used by aliens).

Rotations are separate sequential math-box calls on the current matrix (no combining), in the frame order: script twirl bits RL, RR, PU, PD, YR, YL, then aim yaw, roll-assist, pitch, roll-assist. Motion is then computed from the *updated* matrix.

## 6. Player auto-aim (WSMAIN.MAC:AIM, AIMA, AIMDTH, RHTRIG, RHRSDU, RESIDU, TRHTIC; WSMATH.MAC:S1PT/S1YW)

Run in `STWSP1` every `SP1` frame after `CPU` (in `SP2`: `STWSP2` uses `AIMDTH` only).

**Target choice** (`AIM`): scan slots from `AM.PTR` (or slot 0 when none) to the last slot; take the first with `A$TYP == 1` and `A$GLW == 0`. Scanning past a non-target slot resets `Q.SHK` to 9 if it is > 0. None → `AIMDTH`.

**`AIMA`** — given XP, YP, ZP (target position in the player's frame from `M$PSB2` after `IS1UV(M$S1BC)` + `RESIDU`, i.e. the master matrix with residue applied), all 16-bit signed, halved units:

```
if hi(XP) > 0:                      # in front and ≥ 512 units away
    D = YP
    loop:
        XP <<= 1;  if sign changed (V): break          # exit A
        D  <<= 1;  if sign changed: D >>= 1; break     # exit B
        ZP <<= 1;  if sign changed: ZP >>= 1 (restore); break   # exit C
else:                               # behind, or closer than 512
    D = YP | 1
    loop:
        D  <<= 1;  if sign changed: D >>= 1; break
        ZP <<= 1;  if sign changed: ZP >>= 1; break
yawRate   = ~hi(D)       # one's complement of the shifted YP high byte (≈ −YPhi)
pitchRate =  hi(ZP)      # shifted ZP high byte
```
("sign changed" is the 6809 V flag on LSL/ROL = bit7 ⊕ bit6 before the shift.) In the normal case exit A fires when XP reaches 0x4000..0x7FFF, so YP and ZP have been scaled by the same power of two: the rates are ≈ `(YP/XP)·64..127` and `(ZP/XP)·64..127`. When the target is behind, YP/ZP are scaled to full magnitude (maximum-rate turn toward the target's side). `AM.PTR := target`.

**`AIMDTH`** (no alien): `AM.PTR := 0`; `pitchRate = hi(AZ)` if `hi(AX) ≥ 0` (Death Star in front) else `0x7F − hi(AZ)`; `yawRate = ~hi(AY)` if in front else `~(0x7F − hi(AY))`, using the player's master matrix row A.

**`RHTRIG`** (per axis, per frame; `X → RHEOP` pitch then `RHEOY` yaw): `a = rate; if a < 0: a = ~a; a >>= 1` (via `MUL #0x80`); `if rate ≥ 0: residue += a (saturate +127) else residue −= a (saturate −127)`. `residue` (`RH$RSD`) is a signed byte in tics of 0.064°.

**`RHRSDU`** (right after, same axis): `|residue| ≥ 78` → rotate the master matrix `M.S1` by ±4.99° (sin ±0x590 = 1424, cos 0x3FC2 = 16322), `residue ∓= 78`; else `|residue| ≥ 14` → ±0.895° (sin ±0x100, cos 0x3FFE), `residue ∓= 14`; else nothing. Pitch uses the PITCH formula (`S1PT`), yaw the YAW formula (`S1YW`) from §5, applied to the player's block.

**`RESIDU`** (whenever the view matrix is rebuilt: `VIEW`, `AIMA`): copy master → U1, then rotate U1 by the leftover pitch residue, then yaw residue, then roll residue, using `TRHTIC[|tics|]` = sin(n·0.064°)·16384 (n = 1..78: 18, 37, 55, 73, 91, 110, 128, 146, … 1424), negated for negative residue, cos = 0x4000 + table byte. Everything drawn and all collisions use U1.

**Net effect for an implementation**: the displayed/collision orientation equals master ⊕ residue exactly, so each frame the view turns by `(|rate| >> 1) × 0.064°` per axis toward the target (max 63 tics = 4.06°/frame ≈ 81°/s), and the 78/14-tic stepping is only how the master matrix absorbs the residue (saturation at ±127 tics cannot be reached since |rate| ≤ 127 → ≤ 63 tics/frame < 78). A faithful port can either reproduce master+residue or simply apply `(|rate|>>1)` tics per frame to one matrix — the visible result is the same up to the ½-LSB rounding of the two-step scheme.

**Sign conventions**: `yawRate > 0` → positive residue → +sin → YAW with sin>0 = turn **left** (§5). A target to the right (`YP > 0`) yields `~YPhi < 0` → turn right. `pitchRate > 0` (target above, `ZP > 0`) → pitch **up**. Pitch is applied before yaw each frame (`S1RHPT` then `S1RHYW`).

**Initial facing**: `PHISG2`/`PHINXT` write 0xC0 into the high bytes of `AX` and `BY` of the player's master matrix → `AX = BY = −1.0`: facing −X, i.e. away from the Death Star (+X infinity) and away from the spawn point (X = +31744). `OLD1SHP` (`PHIBGN`) zeroes the residues, roll, laser state and cursor but keeps that orientation, so the first frames of every wave run the "behind" branch of `AIMA` at full rate until the targets come round in front.

## 7. Retreat (`SP2`, WSCPU.MAC:CPURET)

Per frame, for each slot with `A$TYP == 1` (dead/exploded slots ignored):

1. `yhi = hi(TY)` (signed): if `yhi ≥ 9` → `yhi −= 2`; if `yhi ≤ −9` → `yhi += 2`; write back the high byte only. (Y converges toward 0 by 512 units/frame while |Y| ≥ 2304.)
2. `zhi = hi(TZ)`: same with step 3 (768 units/frame) while |Z| ≥ 2304.
3. `D = TX + 0x400`. If no signed overflow → `TX = D` (1024 units/frame toward +X). Else (TX would pass 0x7FFF): if `|yhi| ≤ 8` **and** `|zhi| ≤ 8` → `A$TYP := 0` (removed; `WV.LIV` is not touched — it is reset by `NWNSHP` at the next wave). Otherwise TX is left unchanged (stuck near +0x7Cxx..0x7FFF) and the test repeats each frame while Y/Z converge.

No matrix, velocity, choreography or firing updates happen in `SP2`; `MVGUN` still moves existing fireballs, the player can still shoot the ships, and `PHESP2` moves to `S0G` once every slot has `A$TYP == 0`.

## 8. Level lists, wave sets, start spots

See `choreography.json` → `levelLists`, `waveSets`, `startSpots`, `shapes`. Summary: spots are all at X = 31744 (0x7C00) with (Y,Z) ∈ {(0,+1024), (−1024,0), (+1024,0)} for the A/B/C trios and {(−2048,0), (+2048,0), (0,+2048)} for the D trio (Darth is always the third D entry, spot 1D3, script `TCH1D3`). `TWV1x` use scripts `TCH1x1..3`; `TWV2x` use `TCH2x1..3` = `GOSUB SPLIT` then the `TCH1x*` body; `TWV2Z` is 18 ships (2A×3, 2D×3, 2B×3, 2D×3, 2C×3, 2D×3) and is the last, endlessly repeated list of every set. Set selection: `TSPWAV[SP.WAV]` for `SP.WAV ≤ 5`; above that even → `SETA5`, odd → `SETA6`.

## 9. Uncertainties

* The `V`-flag exit conditions in `AIMA` were transcribed from the branch structure (`BVS`, `IFVS`, `VSEND`); the restore-after-overflow steps (`RORD`, `ROR M.ZP`) are included, but the exact value of the *other* registers at each exit (e.g. ZP one shift behind YP at exit B) is as described and should be tested against MAME for an off-axis target.
* `AIMDTH`'s use of row A (`AX, AY, AZ`) for the Death-Star direction is as coded; whether that row is the universe-X axis in ship coordinates (my reading of PRE2) or the ship's forward axis in universe coordinates does not change the code, only the interpretation.
* The spawn-frame timing exception in §2 (first CT gets `timer` frames) follows from `ADASHP` running after `CPU` in `PHESP1`; `NWNSHP` at wave start runs from `PHISP1` (an init frame), same effect.
* `C$AD` is defined but never set; scripts do not use it.
* Choreography data was machine-extracted from the listing and eyeballed against it script-by-script; commented-out lines in `TCH1D1` (three `;.CT` lines) and `TCH1DZ` (`;;;.CGOTO 10$`) were excluded as the assembler would.
