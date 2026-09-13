import { PACE } from './config';
import type { GameState } from './types';

/**
 * How long the current Game Frame takes: the original's main loop ran once
 * per interrupt tick at best and slower whenever the vector generator took
 * longer than that to draw the screen, which the Trench, the text screens
 * and a close TIE Fighter all did. See PACE in config.ts for the figures.
 */
export function framePeriod(state: GameState): number {
  switch (state.mode) {
    case 'attract':
      return PACE.attract[state.attract.phase];
    case 'select':
      return PACE.select;
    case 'initials':
      return PACE.initials;
    case 'dying':
      return PACE.dying;
    case 'playing':
      break;
  }
  switch (state.stage) {
    case 'dogfight': {
      const d = state.dogfight;
      if (d.phase === 'turn') return PACE.dogfightApproach;
      if (d.phase === 'zoom') return PACE.dogfightFar;
      let load = 0;
      for (const a of d.aliens) {
        if (!a?.drawn || a.drawn.halfDistance <= 0) continue;
        const near = PACE.dogfightNearHalfDistance / a.drawn.halfDistance;
        load += near * near;
      }
      return PACE.dogfightFar + (PACE.dogfightNear - PACE.dogfightFar) * Math.min(1, load);
    }
    case 'surface':
      return PACE.surface;
    case 'trench': {
      const t = state.trench;
      if (t.phase === 'flying') return PACE.trench;
      if (t.phase === 'next') return PACE.nextWave;
      if (t.phase === 'explosion1') return PACE.deathStarPullAway;
      return PACE.deathStarExplosion;
    }
  }
}
