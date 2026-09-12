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

**Attract**:
The sequence of screens shown when no game is in progress: the banner and
storyline, the flight instructions, the scoring page, and the high score table.
_Avoid_: title screen, menu, idle mode, demo

**Storyline**:
The receding text in the Attract that sets up the mission.
_Avoid_: crawl, intro text

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

**Trench Turret**:
A gun mounted in the Trench walls. Worth 100 points.
_Avoid_: turret, wall gun, trench gun

**Catwalk**:
A barrier spanning the Trench. Striking one costs a Deflector Shield.
_Avoid_: barrier, bridge, girder, obstacle

**Exhaust Port**:
The target at the end of the Trench. Hitting it destroys the Death Star and is
worth 25,000 points.
_Avoid_: port, vent, target, goal

**Death Star**:
The Empire's battle station. Its destruction ends a Wave and awards bonus
Deflector Shields.
_Avoid_: station, base

### Sound

**Speech Line**:
A spoken phrase played at a fixed point in play, using the arcade's words in a
voice of our own.
_Avoid_: voice clip, sample, quote

**Music Cue**:
A piece of music played at a fixed point in play or in the Attract, composed
for this project.
_Avoid_: track, theme, song, tune
