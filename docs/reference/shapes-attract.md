# Star Wars (Atari 1983) – Attract mode: STAR WARS logo, crawl, screens, message table

Companion to `shapes-attract.json` (built by `decode_attract.py` from `WSVROM.MAC` and `TCMES.MAC`).
Conventions: VG "screen units" = VCTR units at the default scale word `7200` (visible width ≈ ±512, Y
range ≈ −612..600); **scale-word factor relative to those units: f(7bLL) = 2^(2−b)·(256−L)/256**
("0 = full size, 80 = ½, FF = 1/256" per the `SCAL` macro doc; confirmed by GAME OVER "small is C0, large is
00" and the banner "F8 = too small"). Hex unless a trailing dot.

## 1. The STAR WARS logo (`WSVROM.MAC` pseudo-ROM `PSVJ SWST, SWSA, SWSR, SWWW, SWWA, SWRS`)

Six pictures ('ST', 'A', 'R' of STAR; 'W', 'A', 'RS' of WARS), `M.=10`, no ASPECT, outline intensity 7.
Each starts with its own `VOFFM` from the beam position and a `CXY` origin, so the JSON strokes are already
absolute **raw units relative to the vanishing point (0, 408)** (`VGLIMT`), where the caller leaves the beam:

* STAR: x −1100..1120, y −1740..−1290 (raw); WARS: x −1320..1280, y −2400..−1860.
* **Drop lines**: at most vertices a `DROP n,m` hangs a vertical line 40·n raw units straight down, drawn as
  n upward 40-unit segments with intensities m−n+1 … m (m = 5 for STAR, 6 for WARS): dim at the bottom,
  brightest at the top – the "extruded" 3-D look of the logo. The JSON lists each drop (`drops`) and the
  segment strokes (`dropLines`) with intensities.
* Colour BLUE; brightness from the banner timeline below. In MAME the letters look like big blue outlines
  with fading blue stalks below – that is these drop lines.

### Banner (`TCMES.MAC BGBNNR / VWBNNR`, phase BNR, also run after game over without a high score)
Per frame: `BN.CNT += 1`; one COLOR word `(BN.COL & FF) | BLU`; then for each of the six letters: blank long
vector from centre to (0, 408), SCALE `BN.SCL`, JSRL letter (each ends `SCAL, CNTR`).

* `BN.SCL = 7300 | L` (the code ORs `VGSCAL/100 + 1` = 73 → binary 3 = **half the default size**).
  L = 40 while BN.CNT < 40, then L = BN.CNT (40..F7). Screen = (0,408) + f·raw with
  **f = 0.5·(256−L)/256**: at the start 0.375 → STAR spans x −412..420, y −244..−76; WARS y −492..−290;
  it then shrinks toward the vanishing point (f = 1/64 at L = F8, when it is dropped).
* Brightness: `BN.COL` lum starts 18 and ramps +3 per frame for frames 1..3F (logo static, "fade in" to
  D5); from BN.CNT = 40 lum = (FF − BN.CNT + 18) & FF (D7 → 1F) while it recedes.
* Logo visible for BN.CNT 1..F7 (~4 s); the phase lasts until BN.CNT ≥ 200 (~8.5 s) and goes to the
  instruction page. Stars drift 45° up-forward behind it (`SMVBNR`); the coin lines and score row are drawn too.

## 2. The receding crawl (`TCMES.MAC SPMESS / VWSPMS`)

Eight `.SPMESS` lines ("OBI-WAN KENOBI IS GONE BUT HIS" … "ALWAYS"). Line i enters the special list when
BN.CNT reaches `TSPMAL[i]` = 41, 50, 60, 70, 80, 90, A0, B8, with size 0 and increment 100 (16-bit; the
high byte is the linear scale L).
* Size step: for 40 ≤ BN.CNT < E0, size += increment each frame (L +1/frame); from BN.CNT = E0 the head
  line's increment becomes 400 (L +4/frame) and when a line reaches size F000 (L = F0) it is removed and
  the next line is sped up to 400 as well.
* Drawing per line: `SCALE 7200`; blank vector centre → (0, 408); `SCALE 7100 | L` (binary 1 = 2× default);
  `COLOR GRN` lum = (FF − L + 10) & FF (bright near, dim far); blank vector (dy = −560 raw, dx = −12·chars + 4
  raw – centred); the characters (24 raw per cell); `SCALE 7200`; `VGCNTR`.
* Hence screen = (0, 408) + 2·(256−L)/256·raw: the baseline is 1120·(256−L)/256 below the vanishing point –
  off the bottom at L = 0 (y = −712), on-screen from L ≈ 25, y = −152 at L = 80 (normal text size), y = 338
  at L = F0 (⅛ size) – each line rises, shrinks and dims into the vanishing point. `dxRaw` per line is in the JSON.

## 3. Attract / game-over / initials screens

Cycle: reset → HIS (100 frames) → BNR (200) → INS (200) → SCR (200) → HIS … ; credit + fire → start →
SDS (select Death Star, 100 frames); game over → EGM → ENT (if a high score) → HIS/BNR.

* **Coin lines** (`VWCOIN`, every attract screen): y = 480: "GAME OVER" (TRQ, x −104) alternating every
  16 frames with "INSERT COINS" (BLU, x −140) when there is no credit, else "PULL TRIGGER TO START" (cycling
  colour, x −248); y = 432: the pricing line (YLW) or "CREDITS n" (WHT at −60, count at −128, `VJHALF` for ½).
* **High-score screen** (HIS): copyright block in GREEN at the bottom (y −420..−528; '@' = the © glyph),
  title "PRINCESS LEIA'S REBEL FORCE" (RED, (−320,316)), then `VWHSCR` at `SCALE 7140` (1.5×): 10 rows at
  y = 140, 100 … −220 (raw, ×1.5 on screen) with initials at x −128, rank+period at −200, 8-digit score at −16;
  colour BLUE lum 80 fading during the last 50 frames. Stars stream forward.
* **Instructions** (INS): RED paragraphs (`MS.FLI..FLZ`, positions in the JSON), one line switched on every
  8 frames, fading at the end; the shield-strength digit is inserted after line 3. Stars sideways.
* **Scoring** (SCR): PURPLE table (`MS.SCR..SCZ`); `PH.YOF` starts at 3C0 (960) and decreases 8 per frame, and
  `MOUT2` draws each line at y − PH.YOF, so the page scrolls up into place. Stars upward.
* **Select a Death Star** (SDS): three `VJBMIN` miniatures at (−400,100), (0,−300), (400,100) at default
  scale (`TDTH` stores Y then X), messages in the JSON (SELECT A DEATH STAR, FIRE LASER AT…, COUNTDOWN with
  the 16→0 count at (−16,200), EASY/MEDIUM/HARD, WAVE 1/3/5, BONUS/NO BONUS, 400,000/800,000), cursor TRQ
  turning YLW within |dy|<72, |dx|<52, |dx|+|dy|<80 of a miniature; fire selects (wave 0/2/4), timeout = EASY.
* **GAME OVER in play** (`VWMOVR`): message `MS.GO1` = "GAME OVER" RED lum FF at (−104, 0) (centred),
  preceded by `SCALE 7200 | L`, L = C0 − 6·min(PH.TIM+1, 32): grows from ¼ to full size in 32 frames
  about the screen centre over the frozen game view.
* **Enter initials** (ENT): messages MESSAGE FROM REBEL COMMAND POST (YLW), YOU ARE A TRUE REBEL PILOT
  (PRP), THE FORCE IS WITH YOU (cycling), SHOOT YOUR INITIALS (BLU), "PRINCESS LEIA'S REBEL FORCE" at
  (−320,0); the table at default scale on rows y −72..−402 (player's row WHITE, blanks shown as `_`, the
  current initial flashing on alternate frames); the alphabet in RED forming a U (A–I down x = −292, J–U along
  y = −476, V–Z up x = 284, 48 apart; `_`, RUB, END above on the right, RUB/END at 0.5× scale) with the pointed
  letter redrawn WHITE; cursor YELLOW. Selection: cursor centre within 24×24 (octagon 32) of a glyph; fire
  commits; 30 s limit. Exact positions in the JSON.

## 4. Message table

`shapes-attract.json → messageTable.messages` holds all 212 `.MESS/.NEXTMESS/.SPMESS` entries of
`TCMES.MAC` (index, `MS.*` name where defined, x, y = lower-left of the first 24-unit cell, colour, lum,
text) and `names` maps `MS.*` → index. `.NEXTMESS` entries are position/colour variants that display the
*following* entry's text (e.g. `MS.GO1` = "GAME OVER" at (−104,0) RED FF; `MS.RF1` = "PRINCESS LEIA'S
REBEL FORCE" at (−320,0) cycling). Scale words used with messages: `7100` (2×: SHIELD GONE, EXHAUST PORT
AHEAD/MISSED), `7140` (1.5×, high-score list), `71C0` (0.5×, RUB/END), `72C0→7200` (growing GAME OVER),
`7100|L` (crawl), `7300|L` (logo), `7240` (self-test alphabet).

## 5. Other pictures – inventory

`pictureInventory` in the JSON lists every `VJ/PSVJ/LABL` picture in `WSVROM.MAC` with a one-line
description and where it was decoded. Besides the logo, the only pictures not previously extracted are the
self-test patterns (intensity bars, crosshatch, checkerboard, boundary box, scale square, raster lines, pot
pattern – described, not needed for play) and the **Death Star city lights**: dot-matrix letters (`B.A..B.Y`,
bright dots joined by intensity-1 lines, decoded in `cityLightLetters`) that the hyperspace approach draws on
the dark side of the Death Star (`UB1..4`/`LB1..4`) spelling **MAY THE FORCE / BE WITH YOU** and the
programmers' names **MARGOLIN, RIVERA, HALLY, AVELLAR, VICKERS, DURFEY**. **There are no X-wing or TIE
fighter vector-ROM pictures**: ships are mathbox objects only, and the attract mode draws none (the X-wing's
`XW`/`YW` object tables are assembled out). The high-score screen has no decorations beyond text and stars.

## 6. Open questions

1. The AVG linear-scale law (256−L)/256 is from the macro documentation and consistent with every use in the
   game code; MAME's implementation should be checked for the exact rounding.
2. Crawl x-centring uses the `.ASCIN` byte length (`-(len·12)+4`); if `.ASCIN` appends a terminator the
   offset is 12 units further left – verify visually.
3. The self-test pictures and the default high-score initials (`DOINTS`) were not decoded.
4. City-light blocks: only the words and the letter strokes are given; the per-word `AOFF` offsets
   (M.=4, ASPECT) are in `WSVROM.MAC` lines 1009–1160 if the growing Death Star needs them.
