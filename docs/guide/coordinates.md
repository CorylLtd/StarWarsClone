# Coordinates, units and projection

The simulation works in the original's frame and units so that every traced number can be used as it was found. X is forward, Y is right and Z is up, a left-handed frame. Distances are the arcade's universe units, which were 16-bit in the 6809 code and are plain numbers of the same scale here. Anything on the screen is in vector-generator units, VG units, around the screen centre. The renderer converts to Three.js at the last moment. This page covers [frame.ts](../../src/game/frame.ts), [projection.ts](../../src/game/projection.ts), the `VG` and `CURSOR` groups of [config.ts](../../src/game/config.ts) and the camera in [arcadeCamera.ts](../../src/render/arcadeCamera.ts). The reference notes in [Projection](../reference/projection.md) show where each number comes from in the listing.

## The universe frame

```ts
interface Vec { x: number; y: number; z: number }   // forward, right, up
interface Basis { fwd: Vec; right: Vec; up: Vec }   // rows of the world-to-view matrix
```

A `Basis` is a ship's orientation as its three body axes written in universe coordinates. `identityBasis()` faces +X. `reversedBasis()` faces -X and is how every alien spawns and how the player starts every wave, facing away from the Death Star.

| Function | Meaning |
|---|---|
| `toView(b, v)` | Universe vector into the body frame: (forward, right, up) components. |
| `toWorld(b, v)` | Body-frame vector back into the universe. |
| `yaw(b, a)` | Rotate about up. Positive turns the nose toward the right wing. |
| `pitch(b, a)` | Rotate about right. Positive raises the nose. |
| `roll(b, a)` | Rotate about forward. Positive drops the right wing. |
| `normalizeBasis(b)` | Re-orthonormalise after many small rotations; `up` is recomputed as `fwd × right`. |
| `cross(a, b)` | The cross product in this left-handed frame. |
| `DEG` | Radians per degree, for the original's binary angle constants. |

Angles in the config are in degrees, converted with `DEG`. The original measured angles in tics, `360 / 5632` of a degree (`AIM.ticDeg`), and applied rotations in quanta of 14 or 78 tics with the remainder kept as a display-only residue; `aim.ts` keeps that residue in `player.yawResidue` and `player.pitchResidue`.

The universe wrapped at 16 bits in the original. The Surface keeps that behaviour deliberately: the player's forward position is treated as a signed 16-bit value, and a wrap is a Lap. Elsewhere positions are clamped (`DOGFIGHT.positionClamp`) rather than wrapped.

### Half-distances

Several places carry a `halfDistance`. The original's mathbox worked with halved coordinates for range checks, and the listing's thresholds are given as squared half-distances. Where the code needs the original's number for a comparison, such as the Dogfight's near, mid and passby ranges, `config.ts` converts it to a real distance and says so in the comment; where the number feeds the pace model or star visibility, the half-distance is kept as the original used it.

## The screen: VG units

The vector generator's screen is centred at (0, 0), +X right, +Y up. The visible window and the text rows are in `VG`.

| Constant | Value | Meaning |
|---|---|---|
| `halfWidth` | 495 | Half the visible width, X units. |
| `halfHeight` | 557 | Half the visible height, Y units. |
| `offsetY` | -104 | The 3-D vanishing point sits this far below the screen centre (`VGOFFY`). |
| `focal` | 512 | Perspective focal length: `screen = 512 * lateral / forward`. |
| `rowTop`, `rowHeight` | 552, 24 | Text rows from the top, 24 units high. |
| `charWidth` | 24 | One character cell. |
| `limitTop`, `limitBottom` | 408, -552 | The 3-D view's guaranteed-visible limits. |
| `limitLeft`, `limitRight` | -480, 480 | |

**A Y unit is physically two thirds of an X unit.** The monitor was 4:3, but the generator's coordinate range was taller than it was wide, so a circle drawn with equal X and Y radii came out squashed. The original multiplied Y by 3/2 where it wanted round circles and left everything else squashed; so does this project. Anything that mixes screen X and Y, such as the octagonal hit tests, works in raw VG units and inherits the squash, as the original's tests did.

Two screen spaces exist and it matters which one a number is in.

- **Math view**: 3-D projections come out relative to the vanishing point. The player's `cursor` is in this space.
- **Screen**: text, the HUD and the select screen's Death Star positions are relative to the screen centre. The 104-unit offset is applied when the two meet, for instance `c.y - 104` in `selectTarget`.

## Projection

`projectRelative(rel, basis)` is the simulation's projection, used for hit tests and for every place the simulation needs to know where something is on screen.

```ts
const view = toView(basis, rel);           // eye-relative, body frame
if (!inCone(view)) return null;
at = { x: 512 * view.y / view.x, y: 512 * view.z / view.x };
```

`inCone` is the original's visibility test: forward distance more than 32 and at most `0x7f00 * 2`, and both lateral components smaller in magnitude than the forward one. That is a 90-degree cone, which fills the screen from the text area down to the bottom edge around the vanishing point.

| Function | Use |
|---|---|
| `hitSize(distance, radius, pad)` | The half size in VG units of a sphere of `radius` at `distance`, plus a pad: `512 * radius / distance + pad`. |
| `withinOctagon(a, b, size, factor)` | The original's overlap test: `|dx| <= size`, `|dy| <= size`, `|dx| + |dy| <= factor * size`. |
| `toNdc(p)` | VG units to normalised device coordinates by dividing by the half sizes; the renderer's flat overlays use this. |

The stages project through the player's basis in the Dogfight and through a fixed basis on the Surface and in the Trench, where the yoke translates the ship rather than turning it. Each stage keeps what its view computed on the object (`alien.drawn`, `building.seen`) so that hit tests, the pace model and the renderer all agree with what was visible.

## Pot units and the Cursor

The yoke's deflection is a pot reading in the range ±127, and the Cursor's position on screen is `pot * 4`. The Cursor box is smaller than the screen.

| Constant | Value | On screen |
|---|---|---|
| `potLeft`, `potRight` | -112, 112 | ±448 |
| `potBottom`, `potTop` | -104, 120 | -416 to 480 |
| `potToScreen` | 4 | |

`stepCursor` clamps the target to the box and slews `player.cursorPot` toward it every Field by a fraction of the remaining distance, `slewFar` (0x60/256) beyond `slewFarFrom` (0x40 pot units) and `slewNear` (0x30/256) inside it, always moving at least one unit and never overshooting. `player.cursor` is the rounded pot position times four, in the math view.

The Trench's Laser ray uses the pot on a different scale. The original stored the yoke as a 16-bit value, the pot times 256, and offset the ray's far point by 7/8 of that, so `TRENCH.rayPerPot` is `(7 / 8) * 256`. Getting this scale wrong makes the ray miss what the Cursor is over.

## From the simulation to Three.js

The renderer maps the original's `(x, y, z)` to Three.js `(y, z, -x)`: right stays right, up stays up, and forward becomes the camera's -Z. `ArcadeCamera.setBasis` builds the camera matrix from a `Basis` with that mapping.

The camera reproduces the mathbox and monitor rather than a conventional perspective. `updateProjectionMatrix` builds an asymmetric frustum from `VG`:

| Edge | Tangent |
|---|---|
| left, right | `∓ halfWidth / focal` |
| top | `(halfHeight - offsetY) / focal` |
| bottom | `-(halfHeight + offsetY) / focal` |

Rendered into a 4:3 viewport, that puts the vanishing point 104 Y units below the centre and makes a Y unit two thirds the size of an X unit, so a shape projected by the simulation and one projected by the camera land in the same place. That is what makes aiming honest: the hit test in `src/game` and the picture in `src/render` are the same projection.

The full derivation, including the alternative geometrically correct camera that was not chosen, is in [Projection](../reference/projection.md) §2.6.
