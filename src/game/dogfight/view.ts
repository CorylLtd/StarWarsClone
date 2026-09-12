import { CURSOR, DOGFIGHT, FIREBALL, LASER } from '../config';
import { length } from '../frame';
import { hitSize, projectRelative } from '../projection';
import type { GameState } from '../types';
import { fireballImpact } from './guns';
import { resolveLaser } from './lasers';

/**
 * The original's VIEW: project every alien and shot through the player's
 * basis, remember where they landed and how big their hit boxes are, set the
 * status bits the choreography reads, judge fireball impacts, then resolve
 * the laser against the nearest thing under the cursor.
 */
export function view(state: GameState, lasersActive: boolean): void {
  const d = state.dogfight;
  const p = state.player;
  for (let i = 0; i < d.aliens.length; i++) {
    const a = d.aliens[i];
    if (!a) continue;
    const proj = projectRelative(a.pos, p.basis);
    const dist = length(a.pos);
    a.status.inView = proj !== null;
    a.status.playerNear = dist <= DOGFIGHT.nearDistance;
    a.status.playerMid = dist <= DOGFIGHT.midDistance;
    if (!proj) {
      a.drawn = null;
      a.status.playerAimingAtMe = false;
      continue;
    }
    const size = hitSize(proj.view.x, LASER.hitRadius, LASER.hitPad);
    a.drawn = { at: proj.at, halfDistance: proj.view.x / 2, hitSize: size };
    const dx = Math.abs(proj.at.x - p.cursor.x);
    const dy = Math.abs(proj.at.y - p.cursor.y);
    a.status.playerAimingAtMe = dx + dy <= 3 * size;
    if (dist <= DOGFIGHT.passbyDistance && !d.passbySlot && d.passbySlot !== i) {
      d.passbySlot = i;
      state.events.push({ type: 'passby', receding: false });
    }
  }
  if (d.passbySlot !== null) {
    const a = d.aliens[d.passbySlot];
    if (!a || length(a.pos) > DOGFIGHT.passbyDistance) d.passbySlot = null;
  }

  for (let i = 0; i < d.fireballs.length; i++) {
    const fb = d.fireballs[i];
    if (!fb || fb.kind !== 'live') continue;
    const proj = projectRelative(fb.pos, p.basis);
    if (!proj) {
      d.fireballs[i] = null;
      continue;
    }
    fb.at = proj.at;
    fb.halfDistance = proj.view.x / 2;
    if (proj.view.x <= FIREBALL.impactDistance) {
      const inBox =
        proj.at.x >= CURSOR.potLeft * CURSOR.potToScreen &&
        proj.at.x <= CURSOR.potRight * CURSOR.potToScreen &&
        proj.at.y >= CURSOR.potBottom * CURSOR.potToScreen &&
        proj.at.y <= CURSOR.potTop * CURSOR.potToScreen;
      if (inBox) {
        // If the laser is on it this frame the laser wins; resolveLaser handles that. Mark for impact otherwise.
        fb.impacting = true;
      }
    }
  }

  if (lasersActive) resolveLaser(state);

  for (let i = 0; i < d.fireballs.length; i++) {
    const fb = d.fireballs[i];
    if (fb && fb.kind === 'live' && fb.impacting) {
      fb.impacting = false;
      fireballImpact(state, i);
    }
  }
}
