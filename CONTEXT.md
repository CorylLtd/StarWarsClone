# Star Wars Arcade

A browser recreation of Atari's 1983 vector arcade game *Star Wars*. The
language below follows the arcade's own manuals and on-screen text wherever the
original had a word for something.

## Language

### Game structure

**Wave**:
One complete pass through the three stages, ending with the Death Star's
destruction. Each wave is harder than the last.
_Avoid_: level, round, loop

**Stage**:
One of the three parts of a wave: the Dogfight, the Surface, and the Trench.
_Avoid_: level, phase, scene, section

**Dogfight**:
The stage fought in open space against TIE Fighters and Darth's Ship.
_Avoid_: space stage, space battle, first stage

**Surface**:
The stage flown over the Death Star's surface among Laser Towers and Laser
Bunkers.
_Avoid_: tower stage, second stage, Death Star stage

**Trench**:
The stage flown down the Death Star's trench, past Catwalks and Trench Turrets,
to the Exhaust Port.
_Avoid_: trench run, third stage, final stage

**Death Star Select**:
The screen after the start where the player shoots one of three Death Stars
to choose the starting wave (1, 3 or 5) before a countdown picks wave 1.
_Avoid_: difficulty select, menu, level select

**Retreat**:
The end of the Dogfight, when every enemy races back to the Death Star and
stops firing.
_Avoid_: run away, exit

**Approach**:
After the Retreat, the view turns to the Death Star and it swells until the
next stage begins.
_Avoid_: zoom, hyperspace, transition

**Attract**:
The sequence of screens shown when no game is in progress: the banner and
storyline, the flight instructions, the scoring page, and the high score table.
_Avoid_: title screen, menu, idle mode, demo

**Banner**:
The Attract screen where the logo recedes into the distance and the Storyline
rises after it.
_Avoid_: title screen, splash, logo screen

**Storyline**:
The eight lines of text in the Banner that set up the mission, each rising
from the bottom and shrinking away toward the vanishing point.
_Avoid_: crawl, intro text

**Initials Entry**:
The screen after a qualifying game where the player shoots letters to sign
the High Score Table.
_Avoid_: name entry, hi-score entry

**Credit**:
A play paid for; free play keeps one Credit on the cabinet at all times.
_Avoid_: coin, token, life

**High Score Table**:
The ten best scores with three-letter initials, headed "Princess Leia's Rebel
Force".
_Avoid_: leaderboard, hall of fame

### The player

**Red Five**:
The player, addressed as such by the arcade. Flies the X-Wing.
_Avoid_: player one, pilot, the ship

**Yoke**:
The two-axis, spring-centred flight control. In the browser its deflection comes
from the mouse, a gamepad stick, or the keyboard.
_Avoid_: joystick, stick, controller

**Cursor**:
The aiming mark that the Yoke moves across the screen. Lasers go where the
Cursor points.
_Avoid_: crosshair, reticle, gunsight, sight

**Laser**:
The player's weapon. Any of the Yoke's four buttons fires it.
_Avoid_: shot, bullet, blaster, gun

**Deflector Shield**:
The player's allowance of collisions. One is lost each time a Fireball impacts
or the X-Wing strikes a Laser Tower or Catwalk. The game ends when none remain.
Called "Shield" for short.
_Avoid_: life, lives, health, hit points, energy

**Starting Shields**:
The number of Deflector Shields at the start of a game, 6 to 9 by operator
option. Bonus shields never raise the count above this.
_Avoid_: max shields, max lives

**Play Difficulty**:
The operator's base difficulty setting: Easy, Moderate, Hard, or Hardest.
_Avoid_: skill level, DIP difficulty

**Hardness**:
The single number, wave plus Play Difficulty plus the per-wave bump, that sets
how often enemies fire.
_Avoid_: difficulty level, rank

**Game Frame**:
One tick of the game's logic: one pass of the original's main loop, at most
every twelfth interrupt (about 21 a second) and slower on screens the vector
generator took longer to draw, such as the Trench.
_Avoid_: tick, update, step

**Field**:
One refresh of the vector display, every sixth interrupt, about 42 a second.
The Cursor and sprite animation move once per Field.
_Avoid_: frame, vsync, refresh

**Choreography**:
The script an enemy follows: timed moves and turns, with branches on what the
player is doing.
_Avoid_: AI, behaviour tree, flight plan

**Wave Set**:
The list of enemy groups a wave draws from, in order; the last group repeats
until the Dogfight ends.
_Avoid_: spawn table, level list

### Enemies and hazards

**TIE Fighter**:
The Empire's standard fighter, met in the Dogfight. Worth 1,000 points.
_Avoid_: enemy ship, fighter, TIE

**Darth's Ship**:
Darth Vader's own fighter, met in the Dogfight. Worth 2,000 points.
_Avoid_: Vader, TIE Advanced, boss

**Fireball**:
An enemy projectile. It costs a Deflector Shield on impact, and can be shot
down for 33 points.
_Avoid_: shot, bullet, missile, bolt, enemy laser

**Laser Tower**:
A tall structure on the Surface. Striking one costs a Deflector Shield. Its
Tower Top can be destroyed for 200 points; destroying every Tower Top in a
wave is worth 50,000.
_Avoid_: tower, turret, pylon

**Tower Top**:
The destructible top of a Laser Tower.
_Avoid_: tower head, tower cap

**Laser Bunker**:
A low gun emplacement on the Surface. Worth 200 points.
_Avoid_: bunker, gun, cannon

**Maze**:
The fixed layout of Laser Towers, Bishops and Laser Bunkers a wave's Surface
uses; it repeats every lap.
_Avoid_: map, level layout, tower field

**Lap**:
One pass over the Surface's repeating Maze. Buildings awaken by lap, and the
Surface ends after the fifth.
_Avoid_: loop, cycle, wrap

**Bishop**:
A Laser Tower that fires only diagonal shots.
_Avoid_: diagonal tower

**Hat**:
The white section at the top of a Laser Tower: the Tower Top the player shoots.
_Avoid_: cap, cannon, head

**Trench Turret**:
A gun mounted in the Trench walls. Worth 100 points.
_Avoid_: turret, wall gun, trench gun

**Catwalk**:
A barrier reaching from one Trench wall to the middle at one Band. Flying
into it on its side of the Trench costs a Deflector Shield.
_Avoid_: barrier, bridge, girder, obstacle, force field

**Pie**:
The sequence of Wedges that makes one wave's Trench; fixed for the first
eleven waves, assembled at random after.
_Avoid_: trench layout, course

**Wedge**:
A run of Trench rows with a set pattern of panels, catwalks and guns on each
wall.
_Avoid_: section, chunk

**Band**:
One of the four heights on a Trench wall where a panel, Catwalk or Trench
Turret can sit.
_Avoid_: level, row, lane

**Torpedo**:
The pair of shots that dive into the Exhaust Port once a Laser aimed at the
floor lands on it.
_Avoid_: proton torpedo, missile, bomb

**The Force**:
The bonus for firing no Lasers in the Trench until the Exhaust Port row is
laid out.
_Avoid_: force bonus, no-fire bonus

**Exhaust Port**:
The target at the end of the Trench. Hitting it destroys the Death Star and is
worth 25,000 points.
_Avoid_: port, vent, target, goal

**Death Star**:
The Empire's battle station. Its destruction ends a Wave and awards bonus
Deflector Shields.
_Avoid_: station, base

### Sound

**Sound Effect**:
One of the cabinet's synthesised sounds, played as the register sequence its
sound board's sequencer produced, beat by beat.
_Avoid_: sample, sfx, clip

**Beat**:
One step of the sound board's sequencer, about eight milliseconds.
_Avoid_: tick, frame

**Speech Line**:
A spoken phrase played at a fixed point in play, using the arcade's words in a
voice of our own. A line is one or more Words with pauses or breaths between.
_Avoid_: voice clip, sample, quote

**Word**:
One phrase as the sound board's speech chip spoke it: a stream of frames from
one command to its stop frame.
_Avoid_: clip, sample, utterance

**Speaker**:
Whose line it is (Luke, Han, Ben or Vader), which picks the voice it is
encoded in.
_Avoid_: character, actor, voice

**Music Cue**:
A piece of music played at a fixed point in play or in the Attract, composed
for this project.
_Avoid_: track, theme, song, tune

**Voice**:
One of the four 16-bit POKEY channels the music plays on: the lead, the
harmony, the inner voice and the bass.
_Avoid_: channel, track, part, instrument
