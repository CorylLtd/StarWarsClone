# Input

The cabinet had one control: the Yoke, a two-axis spring-centred handle with four buttons, sampled by the interrupt and turned into the Cursor. In the browser the Yoke's deflection can come from the mouse, a gamepad or the keyboard. [yoke.ts](../../src/input/yoke.ts) folds all three into one `Input` snapshot, `{ x, y, fire }`, which [main.ts](../../src/main.ts) reads once per batch of simulation Fields and passes to `step`. The simulation then turns the deflection into the Cursor in [cursor.ts](../../src/game/cursor.ts), slewing it toward the Yoke every Field as the original's interrupt did. This page covers the snapshot, its sign conventions, why presses are latched, when `main.ts` reads it, and how the Cursor follows it.

## The Input snapshot

The type is in [types.ts](../../src/game/types.ts):

```ts
export interface Input {
  x: number;      // +1 pushed fully right, 0 at rest
  y: number;      // +1 pulled fully back (Cursor up), 0 at rest
  fire: boolean;  // any of the four Yoke buttons, which also start a game
}
```

Both axes are in -1..1. Positive `x` moves the Cursor right; positive `y` moves it up. The simulation never sees which device produced the values.

## YokeInput

`YokeInput` is constructed with the window to listen on and the screen frame element whose rectangle defines full deflection:

```ts
const input = new YokeInput(window, screen);
```

It registers `pointermove`, `pointerdown`, `pointerup`, `contextmenu`, `keydown`, `keyup` and `blur` listeners in the constructor and keeps a small amount of state between snapshots: the last mouse position, whether the button is down, a `mouseClicked` latch, the sets of `held` and `pressed` keys, and the keyboard's ramped deflection `key`. `snapshot()` reads the gamepad, combines everything and returns an `Input`.

### Mouse

The mouse is absolute. `updateMouse` maps the pointer's position across the frame element's bounding rectangle to -1..1 on each axis, clamped, with y inverted so the top of the frame is +1:

```ts
const r = this.frame.getBoundingClientRect();
this.mouse.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
this.mouse.y = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
```

So the Cursor sits where the pointer is, and the frame's edges are full deflection. Because `ScreenFrame` keeps `#screen` at 4:3 and centred, and `WorldRenderer` draws into the same element, the rectangle the mouse is measured against is the rectangle the Cursor is drawn in. The listener is on the window rather than the element, so the position keeps updating when the pointer leaves the frame, at the clamped edge value. `pointerdown` also updates the position, so a click at a new spot fires there. The context menu is suppressed so the right button can be a fire button.

### Gamepad

`firstGamepad()` returns the first non-null entry of `navigator.getGamepads()`, or null where the API is missing. If a pad is present, `axes[0]` is x and `-axes[1]` is y (a stick pushed up reads negative on the second axis, so the sign is flipped to match the `Input` convention). The stick overrides the mouse only when its magnitude exceeds `GAMEPAD_DEADZONE` (0.12); at rest the mouse position stands. Any of buttons 0 to 7 (`GAMEPAD_FIRE_BUTTONS`) pressed sets `fire`.

### Keyboard

The key sets are:

| Set | `KeyboardEvent.code` values | `KeyboardEvent.key` fallbacks |
|---|---|---|
| `UP` | `ArrowUp`, `KeyW` | `w`, `W` |
| `DOWN` | `ArrowDown`, `KeyS` | `s`, `S` |
| `LEFT` | `ArrowLeft`, `KeyA` | `a`, `A` |
| `RIGHT` | `ArrowRight`, `KeyD` | `d`, `D` |
| `FIRE` | `Space`, `ControlLeft`, `ControlRight`, `Enter` | `' '`, `Control` |

`keyId(e)` returns `e.code || e.key`. Some environments deliver key events with an empty `code` and only `key` set (the comment in the source names automation and virtual keyboards), so each set lists both forms and matching works whichever the browser supplies. Keys in `ALL` have their default action prevented, so Space does not scroll and arrows do not move the page; other keys pass through untouched.

Keyboard deflection is not instant. Each snapshot computes a target of -1, 0 or +1 per axis from the held keys and moves `key.x` and `key.y` toward it with `approach` at `KEY_RATE` (4, full deflection per second) times the time since the last snapshot (capped at 0.1 s). Releasing springs back at the same rate. The keyboard overrides the other sources while any direction key is held or while the deflection is still returning to zero, so a tapped key gives a short, smooth nudge and the mouse takes over again once the spring has settled.

### Press latching

A press shorter than one Field would be missed if `snapshot()` only looked at what is held at the instant it runs. Two latches prevent that:

| Latch | Set by | Cleared |
|---|---|---|
| `mouseClicked` | `pointerdown` | At the end of the next `snapshot()` |
| `pressed` (a set of key ids) | `keydown` | At the end of the next `snapshot()` |

`any(set)` checks both `held` and `pressed`, so a key that went down and up between two snapshots still counts as held for the snapshot that follows, and a click that was released before the next snapshot still fires. The environments that send only `key` also tend to release the key at once, which is why the latch matters for them in particular. `fire` is `mouseButton || mouseClicked || any(FIRE)`, then gamepad buttons on top.

A `blur` on the window clears `held` and `mouseButton`, so a key held while switching tabs does not stay down for ever; `pressed` and `mouseClicked` are left to drain on the next snapshot.

## When main.ts reads the snapshot

`snapshot()` has side effects: it clears the latches and advances the keyboard ramp. If it were called on an animation frame that steps no Field, a tap latched in `pressed` would be consumed and never reach the simulation. The loop in [main.ts](../../src/main.ts) therefore reads it only when at least one Field will run, and shares one snapshot across every Field stepped in that animation frame:

```ts
if (accumulator >= DT) {
  const snapshot = input.snapshot();
  while (accumulator >= DT) {
    step(state, snapshot, DT);
    for (const e of state.events) dispatch(e);
    accumulator -= DT;
  }
}
```

The render that follows happens whether or not a Field ran, subject to the `MAX_RENDER_FPS` cap. The simulation has its own latch for the same reason one level up: `step` in [update.ts](../../src/game/update.ts) ORs `input.fire` into `state.fireLatch` every Field and hands the latched value to the Game Frame when one runs, so a press on any Field of a slow screen such as the Trench is not lost between Game Frames.

## Fire as the start button

As on the cabinet, the trigger starts a game. In `stepFrame` the Attract mode runs `if (input.fire && !state.fireHeld) startGame(state)`, an edge detect on `fireHeld`. `startGame`, `beginWave` and the Initials Entry set `fireHeld` to true when they begin, so the press that started a game, chose a Death Star or ended initials is not also the first Laser of the next screen. Death Star Select uses the same edge detect to pick the Death Star under the Cursor, and holding the button down does not fire the Laser repeatedly in play either; `fireHeld` is compared each Game Frame.

## From the Yoke to the Cursor

`stepCursor(player, input)` in [cursor.ts](../../src/game/cursor.ts) runs every Field from `step`, before the Game Frame test, as the original's interrupt routine did. It works in the original's pot units, a signed -127..127 range:

1. The deflection becomes a target: `round(input.x * 127)` and `round(input.y * 127)`, clamped to the Cursor box `CURSOR.potLeft..potRight` (-112..112) and `CURSOR.potBottom..potTop` (-104..120). The box is asymmetric vertically because the original's text rows take the top of the screen and the vanishing point sits low.
2. `player.cursorPot` slews toward the target by `slew`: a fraction of the remaining distance each Field, `CURSOR.slewFar` (0x60/256, 0.375) when the distance is at least `CURSOR.slewFarFrom` (64 pot units, a quarter of the screen) and `CURSOR.slewNear` (0x30/256, 0.1875) when closer; at least one unit; never past the target.
3. `player.cursor` is the rounded pot position times `CURSOR.potToScreen` (4): VG screen units, without the -104 vanishing-point offset, which the renderer adds when it draws.

So the Cursor follows the Yoke as a first-order lag at the Field rate, with a time constant of about 50 ms far from the target and 115 ms near it (`-DT / ln(1 - fraction)` with `DT` just under 24 ms). `player.cursorTarget` keeps the clamped target for the simulation's own use. Mouse users feel this as a short trailing glide rather than a locked pointer; it is the cabinet's behaviour, not smoothing added here. See [Projection](../reference/projection.md), section 4.3, for where the numbers come from, and [Coordinates](./coordinates.md) for pot units against VG units.

The `CURSOR` block in [config.ts](../../src/game/config.ts) also holds `hoodShiftX` and `hoodShiftY` (55 and 40 VG units), used by an exported `hoodShift(player)` in `cursor.ts` that nothing currently calls; the renderer computes the cockpit shift from `COCKPIT_SHIFT` in [hud.ts](../../src/data/hud.ts) instead, with the same result at full deflection.

## Where to change things

| To change | Look in |
|---|---|
| Which keys do what | The key sets at the top of [yoke.ts](../../src/input/yoke.ts) |
| Keyboard ramp speed | `KEY_RATE` in `yoke.ts` |
| Gamepad dead zone or fire buttons | `GAMEPAD_DEADZONE`, `GAMEPAD_FIRE_BUTTONS` in `yoke.ts` |
| Mouse sensitivity | There is none to change: the frame rectangle is full deflection by design |
| Cursor travel limits and slew | `CURSOR` in [config.ts](../../src/game/config.ts) |
| What a press does on each screen | `stepFrame`, `stepSelect` and the stage modules under [update.ts](../../src/game/update.ts) |
