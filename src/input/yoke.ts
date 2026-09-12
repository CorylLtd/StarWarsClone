import type { Input } from '../game/types';
import { approach, clamp } from '../game/math';

// Each set lists KeyboardEvent.code values and, after them, the KeyboardEvent.key
// fallbacks for environments that deliver only `key` (some automation, some
// virtual keyboards).
const UP = new Set(['ArrowUp', 'KeyW', 'w', 'W']);
const DOWN = new Set(['ArrowDown', 'KeyS', 's', 'S']);
const LEFT = new Set(['ArrowLeft', 'KeyA', 'a', 'A']);
const RIGHT = new Set(['ArrowRight', 'KeyD', 'd', 'D']);
const FIRE = new Set(['Space', 'ControlLeft', 'ControlRight', ' ', 'Control']);
const START = new Set(['Enter']);
const ALL = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...FIRE, ...START]);

function keyId(e: KeyboardEvent): string {
  return e.code || e.key;
}

/** Keyboard deflection ramps at this rate (full deflection per second) and springs back the same way. */
const KEY_RATE = 4;
const GAMEPAD_DEADZONE = 0.12;
const GAMEPAD_FIRE_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7];
const GAMEPAD_START_BUTTON = 9;

/**
 * Produces the yoke snapshot from whichever source the player is using.
 * Mouse position over the screen frame is the primary source: the cursor sits
 * where the pointer is, and the frame's edges are full deflection. A gamepad
 * stick outside its deadzone overrides it; keyboard arrows override both while
 * held and spring back to centre when released.
 */
export class YokeInput {
  private mouse = { x: 0, y: 0 };
  private mouseButton = false;
  /** Mouse button pressed since the last snapshot, so a click shorter than a frame still fires. */
  private mouseClicked = false;
  private readonly held = new Set<string>();
  /** Keys pressed since the last snapshot, so a tap shorter than a frame still registers. */
  private readonly pressed = new Set<string>();
  private key = { x: 0, y: 0 };
  private lastSnapshot = performance.now();

  constructor(target: Window, private readonly frame: HTMLElement) {
    target.addEventListener('pointermove', (e) => this.updateMouse(e));
    target.addEventListener('pointerdown', (e) => {
      this.updateMouse(e);
      this.mouseButton = true;
      this.mouseClicked = true;
    });
    target.addEventListener('pointerup', () => (this.mouseButton = false));
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('keydown', (e) => {
      const id = keyId(e);
      if (!ALL.has(id)) return;
      e.preventDefault();
      this.held.add(id);
      this.pressed.add(id);
    });
    target.addEventListener('keyup', (e) => {
      const id = keyId(e);
      if (!ALL.has(id)) return;
      e.preventDefault();
      this.held.delete(id);
    });
    target.addEventListener('blur', () => {
      this.held.clear();
      this.mouseButton = false;
    });
  }

  private updateMouse(e: PointerEvent): void {
    const r = this.frame.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.mouse.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    this.mouse.y = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1);
  }

  private any(codes: Set<string>): boolean {
    for (const c of codes) if (this.held.has(c) || this.pressed.has(c)) return true;
    return false;
  }

  snapshot(): Input {
    const now = performance.now();
    const dt = Math.min((now - this.lastSnapshot) / 1000, 0.1);
    this.lastSnapshot = now;

    const keyTargetX = (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
    const keyTargetY = (this.any(UP) ? 1 : 0) - (this.any(DOWN) ? 1 : 0);
    this.key.x = approach(this.key.x, keyTargetX, KEY_RATE * dt);
    this.key.y = approach(this.key.y, keyTargetY, KEY_RATE * dt);

    let x = this.mouse.x;
    let y = this.mouse.y;
    let fire = this.mouseButton || this.mouseClicked || this.any(FIRE);
    let start = this.any(START);
    this.mouseClicked = false;

    const pad = firstGamepad();
    if (pad) {
      const px = pad.axes[0] ?? 0;
      const py = -(pad.axes[1] ?? 0);
      if (Math.hypot(px, py) > GAMEPAD_DEADZONE) {
        x = clamp(px, -1, 1);
        y = clamp(py, -1, 1);
      }
      if (GAMEPAD_FIRE_BUTTONS.some((b) => pad.buttons[b]?.pressed)) fire = true;
      if (pad.buttons[GAMEPAD_START_BUTTON]?.pressed) start = true;
    }

    if (keyTargetX !== 0 || keyTargetY !== 0 || this.key.x !== 0 || this.key.y !== 0) {
      x = this.key.x;
      y = this.key.y;
    }

    this.pressed.clear();
    return { x, y, fire, start };
  }
}

function firstGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const pad of navigator.getGamepads()) if (pad) return pad;
  return null;
}
