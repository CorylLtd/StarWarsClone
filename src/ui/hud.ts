import type { GameState } from '../game/types';

/**
 * Placeholder cursor until the arcade's shape is traced from the vector ROM:
 * a small open square with four ticks.
 */
const CURSOR = `
<svg id="cursor" viewBox="-50 -50 100 100">
  <path d="M-20 -20 H20 V20 H-20 Z"/>
  <path d="M0 -45 V-28 M0 28 V45 M-45 0 H-28 M28 0 H45"/>
</svg>`;

/** Score, shields, wave and the cursor, drawn over the world. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly hiEl: HTMLElement;
  private readonly shieldsEl: HTMLElement;
  private readonly waveEl: HTMLElement;
  private readonly cursorEl: SVGElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'overlay';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-item"><span class="label">SCORE</span><span id="score">0</span></div>
        <div class="hud-item"><span class="label">HIGH SCORE</span><span id="hiscore">0</span></div>
        <div class="hud-item"><span class="label">SHIELDS</span><span id="shields">0</span></div>
        <div class="hud-item"><span class="label">WAVE</span><span id="wave">1</span></div>
      </div>
      ${CURSOR}`;
    container.appendChild(this.root);
    this.scoreEl = this.root.querySelector<HTMLElement>('#score')!;
    this.hiEl = this.root.querySelector<HTMLElement>('#hiscore')!;
    this.shieldsEl = this.root.querySelector<HTMLElement>('#shields')!;
    this.waveEl = this.root.querySelector<HTMLElement>('#wave')!;
    this.cursorEl = this.root.querySelector<SVGElement>('#cursor')!;
  }

  update(state: GameState): void {
    this.scoreEl.textContent = String(state.score);
    this.hiEl.textContent = String(state.highScore);
    this.shieldsEl.textContent = String(state.shields);
    this.waveEl.textContent = String(state.wave);
    // Normalised screen coordinates to percentages of the frame; y is up in the game, down in CSS.
    this.cursorEl.style.left = `${(state.cursor.x + 1) * 50}%`;
    this.cursorEl.style.top = `${(1 - state.cursor.y) * 50}%`;
    this.root.classList.toggle('playing', state.mode === 'playing');
  }
}
