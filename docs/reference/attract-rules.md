# Star Wars (Atari 1983) — Attract mode, game over, high-score entry

Companion data: `attract-tables.json` (every `.MESS` text with position/colour, the storyline lines with their alarm frames and centring X, instruction/scoring/high-score/initials message sets, default table, alphabet positions, timings, RAM addresses, phase indices). Conventions as before: decimal unless `0x`; frame = 20 Hz tick; cites `FILE:label`. Message coordinates are VG units (X −512..+512, Y −512..+600), character cell 24 × 24, drawn at the stored position plus the scroll offset `MSYOFF` (no `VGOFFY`).

---

## 1. The attract cycle

Order after power-up: `RESET` → **`HIS`** (WSMAIN.MAC:PHERES sets `PHASE = PH$HIS`) → `BNR` → `INS` → `SCR` → `HIS` → … The whole loop ≈ **1636 frames ≈ 82 s**. There is **no demo game**; every attract phase draws the star field (`VWSTAR`) moving in a phase-specific direction (`SMVBNR` diagonal, `SMVINS` sideways, `SMVSCR` up, `SMVHIS` forward), the HUD (`VWMES`: red "SCORE"/"WAVE" labels from `VGTITL`, green "00" and the last wave number — this is why MAME shows `SCORE 00 / WAVE 0` in attract), and the coin/credit lines (`VWCOIN`).

| Phase | Init | Duration | Ends when | Cite |
|---|---|---|---|---|
| `HIS` high-score table | `PH.TIM = 256`, colour blue, `ALLOFF`, `CHKHIS` | **256 frames (12.8 s)**; brightness −1/frame during the last 80 | `PH.TIM < 0` → `BNR` | WSMAIN.MAC:PHIHIS, PHEHIS |
| `BNR` banner (`PHIBNR` = `PHICN1`) | `BGBNNR`, math/stars re-init, attract-music check | **512 frames (25.6 s)** (`BN.CNT`) | `SPMESS` sets `PH$INS` at `BN.CNT ≥ 512` | WSMAIN.MAC:PHIBNR, TCMES.MAC:SPMESS |
| `INS` flight instructions | `PH.TIM = 512`, `PH.YOF = 0`, red | ≈ **434 frames (21.7 s)**: 320 frames of display (a new line every 8 frames), then fade (brightness 0x80 → 0x0F at −1/frame, 113 frames) | `PH.TIM < 0` → `SCR` | WSMAIN.MAC:PHIINS, PHEINS, VWPAGE |
| `SCR` scoring page | `PH.TIM = 512`, `PH.YOF = 960` (scroll), purple | ≈ **434 frames**; text scrolls up 8 units/frame for 120 frames while lines appear every 8 frames; same fade | `PH.TIM < 0` → `HIS` | WSMAIN.MAC:PHISCR, PHESCR, VWPAGE |

`CN1` ("first coin") is the same code as `BNR` (`PHICN1`/`PHECN1` share the labels); it is never entered by a separate path — the phase table simply lists both names.

Shortcuts (WSMAIN.MAC:STRTCK, run every attract frame): cursor pushed to the far **left** (`SI.RSX ≤ −96`) jumps to `INS`; far **right** (`≥ +96`) jumps to `HIS`; the self-test switch → `STS` (statistics), AUX coin there → `OPT` (options). **Start**: credits > 0 (free play forces 1) and a falling edge on any trigger or thumb button → `SG1`, credit −1. The cycle itself is the same with or without credits; only the two coin lines change.

Coin/credit lines (WSMAIN.MAC:VWCOIN, TCMES.MAC): with **no credit** the top line flashes every 16 frames between **"INSERT COINS"** (blue, −140,480) and **"GAME OVER"** (turquoise, −104,480), and the second line shows the price from `OPTS0` bits 0-1: **"FREE PLAY" / "2 PLAYS 1 COIN" / "1 COIN 1 PLAY" / "2 COINS 1 PLAY"** (yellow, y 432); with a half credit the second line alternates the price and "CREDIT ½". With **credit**: **"PULL TRIGGER TO START"** (flashing colour, −248,480) and **"CREDITS"/"CREDIT"** (white, −60,432) followed by the count (max 18, `MAXCRD`) and a ½ glyph for a partial credit.

Coin-up speech (WSMAIN.MAC:IFRAME, every frame in every phase): when credits go from 0 to >0 → **"THE FORCE WILL BE WITH YOU"**; when a further credit arrives while credits exist → **"ALWAYS"** (once, until credits return to 0).

Attract music (WSMAIN.MAC:PHIBNR, option bank-1 switch 7): at every banner start, if `TIMER+2` (the BCD "total time on" digit that advances every 100 × 4 s = **400 s ≈ 6.7 min**) differs from `MUSTIM`, play one **random** tune from the nine (`PMBEN`, `PMCNT`, `PMEND`, `PMRRP`, `PMTHB`, `PMTH5`, `PMREB`, `PM4TH`, `PMDAR`) and remember the digit; `MUSTIM = 0xFF` (set at power-up and at every game start) suppresses the next comparison. So "every 7 minutes" is really: at most once per 400-s clock tick, quantised to banner starts (every ~82 s), never right after a game.

## 2. The banner (TCMES.MAC:BGBNNR, VWBNNR, SPMESS, VWSPMS, TSPMAL; WSVROM.MAC:VJSW*)

Everything recedes toward a **vanishing point at (0, 408)** (`VGLIMT`): each element is drawn as an offset from that point under a VG scale word, so increasing the linear scale value shrinks the offset and the glyph together — the "Star Wars crawl" effect.

* **Logo** (six blue pieces "ST", "A", "R", "W", "A", "RS"): frames 0-63: fixed linear scale 0x40, brightness ramps from 0x18 by **+3 per frame**; frames 64-247: scale word `0x7300 | BN.CNT` (linear scale = frame count 64 → 247, i.e. shrinking away), brightness `(255 − BN.CNT) + 0x18` (dimming); from frame **248** the logo is no longer drawn.
* **Storyline** (8 green lines, `SPMS1..`): line *n* starts at alarm frame **65, 80, 96, 112, 128, 144, 160, 184** (`TSPMAL`) with linear scale 0 (largest) and grows **+1 per frame** while `64 ≤ BN.CNT < 224` (brightness = `(255 − scale) + 0x10`, so far lines are dimmer); **hold from frame 224 to 351** (128 frames = 6.4 s — the "read it" pause; SWTEXT.DOC's "about 20 seconds" is not what the code does); from frame **352** every line resumes +1/frame and the *first* line gets **+4/frame**; when a line's scale reaches **240** it is removed and the *next* line switches to +4/frame — so the lines vanish one after another about 20 frames apart while the rest keep drifting. At `BN.CNT ≥ 512` → `INS`. Each line is centred by `x = −12 × (characters) + 4` from the vanishing point with a vertical offset of −560 (scaled). Text: "OBI-WAN KENOBI IS GONE BUT HIS / PRESENCE IS FELT WITHIN THE FORCE. / THE EMPIRE'S DEATH STAR, UNDER THE / COMMAND OF DARTH VADER, NEARS THE / REBEL PLANET.  YOU MUST JOIN THE / REBELLION TO STOP THE EMPIRE. / THE FORCE WILL BE WITH YOU. / ALWAYS".
* Stars drift diagonally (`SMVBNR`: +128 X and +128 Z per frame).

## 3. Flight instructions page (WSMAIN.MAC:PHIINS, VWPAGE; TCMES.MAC `MS.FLI..MS.FLZ`)

18 red lines (`MS.FLI` "FLIGHT INSTRUCTIONS TO RED FIVE" at (−396, 288) down to "UP THE DEATH STAR." at (−420, −432); full text/positions in the JSON). One line is switched on every 8 frames from the top; when the 4th line ("WILL PROTECT YOU FOR   COLLISIONS.") is switched on, the digit message **"6"/"7"/"8"/"9"** (index `MS.FLZ+1+option`, at (84, 144)) is added according to the starting-shield option. No scroll (`PH.YOF = 0`). After 320 frames the whole page fades (colour word brightness −1/frame from 0x80; the page ends at 0x0F). Stars move sideways.

## 4. Scoring page (WSMAIN.MAC:PHISCR; `MS.SCR..MS.SCZ`)

9 purple lines: "SCORING" (−60, 280), then "TIE FIGHTERS 1,000", "DARTH VADER'S SHIP 2,000", "LASER BUNKERS 200", "LASER TOWERS 200", "TRENCH TURRETS 100", "FIREBALLS 33" (x −372, y 180 down to −120 in 60s), "EXHAUST PORT 25,000" (−280), "DESTROYING ALL TOWER TOPS 50,000" (−350). The block starts 960 units low (`PH.YOF = 0x3C0`) and scrolls up 8/frame (120 frames) while lines appear every 8 frames; same fade as `INS`. Stars move up. (Note the page does not mention the tower-top progression 200/400/600… or the Force bonus.)

## 5. High-score table (WSMAIN.MAC:PHEHIS, CPYRGHT; TCHSCR.MAC:VWHSCR, THSY2; TCMES.MAC)

Drawn in this order: copyright block first ("STAR WARS" green at (−104, −420); "@ 1983 LUCASFILM LTD. AND ATARI,INC." (−404, −456); "ALL RIGHTS RESERVED." (−224, −492); "LUCASFILM TRADEMARKS USED UNDER LICENSE." (−464, −528) — all green), stars, HUD, coin lines, then in the phase colour (blue, fading in the last 80 frames): title **"PRINCESS LEIA'S REBEL FORCE"** (red, −320, 316) and the 10 rows at Y = 140, 100, 60, 20, −20, −60, −100, −140, −180, −220 (`THSY2`), enlarged (scale `VGSCAL − 0xC0`): rank number + "." at x −512 (1 leading zero suppressed → "1." … "10."), three initials at x −128 (blank = space), score at x −16 with commas and 6 leading zeros suppressed.

Default table (TCHSCR.MAC:INTINT/INTSCR): OBI 1,285,353; WAN 1,110,936; HAN 1,024,650; GJR 872,551; MLH 813,553; JED 704,899; NLA 518,000; EJD 492,159; EAR 384,766; RLM 380,655. Validation (`CHKHIS`, run at `HIS` init and `ENT` init): any initial > 26 or non-BCD score digit → whole table reset to defaults.

**Persistence**: NVRAM area 1 stores only the **top three** rows (`SAVSCR` 12 bytes = 3 scores, `SAVINT` 9 bytes = 3 × 3 initials, as nibbles) with a checksum; loaded at `RESET` (`SETINT`) when the checksum is valid, written after every initials entry. Rows 4-10 live in RAM only and return to the defaults at power-up. NVRAM also holds options (area 3), pot calibration, coin counts, games played, total game time, time-on, the game-time histogram and highest wave (area 2) (WSGLOB.MAC EEROM layout).

## 6. Game over, end of game, initials

### 6.1 Death phases (WSMAIN.MAC:PHES0D/G0D/B0D, VWMOVR)

All three run **40 frames (2 s)**: speech queue skipped; guns keep moving, the shield flash keeps cycling (`KPGLOW`); in space the view rolls −4.48°/frame; the trench shows "EXHAUST PORT MISSED"/"EXHAUST PORT AHEAD" if applicable. **"GAME OVER"** (`MS.GO1`, bright red, at (−104, 0)) is drawn with scale word `0x70LL`, `LL = 0xC0 − 6·min(PH.TIM, 32)`: from 25 % (0xC0) to 100 % (0x00) of binary-scale-0 size over **32 frames** — i.e. it grows to four times normal text size (normal text is drawn under `0x7200`, binary scale 2) and then holds for the remaining 8 frames.

### 6.2 `EGM` (WSMAIN.MAC:PHIEGM, PHEEGM; TCEROM.MAC:EEACCT; TCHSCR.MAC:UPDATE)

Init: speech **"REMEMBER"** then **"THE FORCE WILL BE WITH YOU … ALWAYS"** (queued). Exec (one frame): math/params/stars re-init; **`EEACCT`**: total game time += `GTIME`, games played +1, highest wave reached (`GM.DWAV`) recorded, game-length histogram bucket incremented (halving all buckets on overflow), pot values saved; **`UPDATE`**: the score is compared with rows 1..10 from the top — a score **greater than or equal** to a row takes that row (`PUTHI` shifts the lower rows down, row 10 drops), blank initials are inserted and `UPDFLG` points at the row → phase **`ENT`**; otherwise Ben's theme (`PMBEN`) and phase **`BNR`** (the attract restarts at the banner, not the table).

### 6.3 Initials entry (`ENT`; WSMAIN.MAC:PHIENT, PHEENT; TCHSCR.MAC:VWHSCR, GETINT, TINTXY)

* Init: `PH.TIM = 0`, colour blue, messages **"MESSAGE FROM REBEL COMMAND POST"** (yellow, −368, 340), **"YOU ARE A TRUE REBEL PILOT"** (purple, −308, 280), **"THE FORCE IS WITH YOU"** (flashing colour, −248, 220), **"SHOOT YOUR INITIALS"** (blue, −224, 120); music **Cantina** (`PMCNT`); `CHKHIS`.
* Screen: HUD and coin lines; **"PRINCESS LEIA'S REBEL FORCE"** in flashing colour at (−320, 0) (`MS.RF1`); the table at normal scale on the lower half (rows Y −72, −108, −142, −190, −226, −260, −296, −330, −366, −402), the player's row in **white** with the initial being entered flashing every other frame and blanks shown as underscores; the alphabet in red: **A..I** down the left column (x −292, y −92 to −476 in steps of 48), **J..U** along the bottom (y −476, x −244 to 284 step 48), **V..Z** up the right column (x 284), **RUB** at (284, −140) and **END** at (284, −92) in smaller dim red, the blank/underscore at (284, −188); the selected item is drawn white; the cursor is yellow.
* Selection (`GETINT`, every frame): the item whose centre is within 24 units of the cursor in X and Y and `|dx| + |dy| < 32` (cursor taken at `SI.CX − 8`, `SI.CY − 116`) becomes the current character and is shown live in the row. A trigger/thumb **falling edge** commits: letter/blank → next initial (laser sound); **RUB** → blank the current initial and step back (enemy-shot sound); **END** → finish (port-shot sound). After the third initial only RUB/END are selectable and the selector jumps to END.
* Timeout: `PH.TIM` counts up; at **640 frames (32 s)** entry ends with whatever is entered; the self-test switch also ends it. On finishing: top-3 rows → NVRAM with a fresh area-1 checksum, phase **`HIS`**.

## 7. RAM map for tooling

`HSCORS` 0x4A8E (10 × 4 BCD, MSB first), `INITLS` 0x4AB6 (10 × 3, 0 = blank, 1..26 = A..Z), NVRAM copies `SAVSCR` 0x4508 / `SAVINT` 0x4520 (nibbles), `$$CRDT` 0x4814, `$CNCT` (half credit) 0x4812, `$BCCNT` 0x4813, `PH.TIM` 0x4B0E, `PH.YOF` 0x4B0C, `PH.COL` 0x4B10, `BN.CNT` 0x4AE4, `BN.COL` 0x4AE6, `SPMALM` 0x4AE2, `SPMNXT` 0x4ADF, `MESLST` 0x4AD9, `MSYOFF` 0x48AF, `MUSTIM` 0x4B34, `TIMER` 0x4B04, `GTIME` 0x4819, `UPDFLG` 0x4AEC, `UPDINT` 0x4AEE, `INITL` 0x4AEF, `OPTS0` 0x4590 / `OPTS1` 0x4592 (NVRAM), `GAMES` 0x454E, `TTIME` 0x4554, `HISTOG` 0x4564, `ENDGAM` 0x4588, `PHASE` 0x4841. Phase init indices: `BNR` 5, `INS` 7, `SCR` 9, `HIS` 11, `SDS` 13, `ENT` 15, `CN1` 23, `SG1` 25, `S0D` 53, `G0D` 55, `B0D` 57, `EGM` 59 (exec = +1). To test initials entry: set a score in 0x485C..0x485F and write 59 to `PHASE`.

## 8. Open questions

1. Storyline centring uses `−12 × (MESn+1 − MESn) + 4`; I assumed `.ASCIN` stores exactly the characters (no terminator byte). If it adds one, every line sits 12 units further left.
2. The VG linear-scale semantics (larger value = smaller) are inferred from usage (as in earlier docs); the exact size ratios of the logo/storyline recession and of the GAME OVER growth depend on the AVG scale formula.
3. `TIMER+2` advancing every 400 s is derived from the IRQ (`TIMER+3` += 1 per 4 s, BCD); SWOPTS.DOC says "every 7 minutes".
4. The flash colour `VJMFL` cycles through the seven colours once per VG field (`VTMFL` rotated by the IRQ); the visible flash rate therefore depends on the ~40 Hz VG rate.
5. `STS`/`OPT` (statistics and operator option pages) were not documented beyond their entry conditions.
