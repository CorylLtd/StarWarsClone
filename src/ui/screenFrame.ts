import { SCREEN } from '../game/config';

/**
 * Keeps the screen frame at the monitor's aspect ratio, as large as fits,
 * centred in the window with black around it. Everything visible lives inside
 * this element.
 */
export class ScreenFrame {
  constructor(
    private readonly window: Window,
    readonly element: HTMLElement,
    private readonly onResize: () => void,
  ) {
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  fit(): void {
    const w = this.window.innerWidth;
    const h = this.window.innerHeight;
    let width = w;
    let height = w / SCREEN.aspect;
    if (height > h) {
      height = h;
      width = h * SCREEN.aspect;
    }
    this.element.style.width = `${Math.floor(width)}px`;
    this.element.style.height = `${Math.floor(height)}px`;
    this.onResize();
  }
}
