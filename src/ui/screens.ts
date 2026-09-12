import type { GameState } from '../game/types';

/**
 * Placeholder cards for the attract and game over. The real Attract sequence
 * (banner, storyline, flight instructions, scoring page, high score table)
 * replaces this in its own milestone.
 */
export class Screens {
  private readonly attract: HTMLElement;
  private readonly gameOver: HTMLElement;
  private readonly finalScore: HTMLElement;

  constructor(container: HTMLElement) {
    this.attract = document.createElement('div');
    this.attract.className = 'screen overlay';
    this.attract.innerHTML = `
      <div class="card">
        <h1>STAR WARS</h1>
        <p class="blink">PRESS START</p>
        <p class="controls">MOUSE, GAMEPAD OR ARROWS AIM · CLICK, SPACE OR ANY PAD BUTTON FIRES · ENTER OR PAD START BEGINS</p>
      </div>`;
    container.appendChild(this.attract);

    this.gameOver = document.createElement('div');
    this.gameOver.className = 'screen overlay';
    this.gameOver.innerHTML = `
      <div class="card">
        <h1>GAME OVER</h1>
        <p>SCORE <span id="final-score">0</span></p>
      </div>`;
    container.appendChild(this.gameOver);
    this.finalScore = this.gameOver.querySelector<HTMLElement>('#final-score')!;
  }

  update(state: GameState): void {
    this.attract.hidden = state.mode !== 'attract';
    this.gameOver.hidden = state.mode !== 'gameOver';
    if (state.mode === 'gameOver') this.finalScore.textContent = String(state.score);
  }
}
