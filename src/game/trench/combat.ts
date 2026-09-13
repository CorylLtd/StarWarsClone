import { LASER, SCORING, TRENCH } from '../config';
import { vec } from '../frame';
import { nextFloat } from '../random';
import { projectRelative } from '../projection';
import { fireballImpact, hurtFireball, shieldHit } from '../dogfight/guns';
import { addScore } from '../dogfight/aliens';
import { hardness } from '../dogfight/waves';
import type { Fireball, GameState } from '../types';
import { slotIndex } from './layout';

/** Which band (0 top .. 3 bottom) a height falls in, or -1. */
export function bandAt(z: number): number {
  for (let i = 0; i < TRENCH.bandCentres.length; i++) {
    if (Math.abs(z - TRENCH.bandCentres[i]) <= TRENCH.bandHalfHeight) return i;
  }
  return -1;
}

/** A catwalk in the player's slot blocks its whole side of the trench at its band, for the first part of the slot. */
export function checkCatwalks(state: GameState): void {
  const t = state.trench;
  const slot = t.slots[slotIndex(t.pos.x)];
  const into = t.pos.x - Math.floor(t.pos.x / TRENCH.slotLength) * TRENCH.slotLength;
  if (into >= TRENCH.catwalkHitDepth) return;
  const band = bandAt(t.pos.z);
  if (band < 0) return;
  const side = t.pos.y <= 0 ? slot.left : slot.right;
  const other = t.pos.y >= 0 ? slot.right : slot.left;
  const hit = side[band] === 2 || (t.pos.y === 0 && other[band] === 2);
  if (!hit || slot.struck > 0) return;
  slot.struck = 4;
  state.events.push({ type: 'catwalkHit' });
  state.events.push({ type: 'sound', name: 'crash' });
  const p = state.player;
  const before = p.gaugeFrames;
  shieldHit(state);
  if (p.gaugeFrames > before) p.gaugeFrames = Math.min(p.gaugeFrames, TRENCH.catwalkQuickGlowFrames);
}

/** WV.HRD for this trench: the wave's hardness plus GM.BMP for each repeat pass (PHIB0B bumps WV.HRD, never GM.DIF). */
export function trenchHardness(state: GameState): number {
  return Math.min(15, hardness(state.wave, state.difficulty) + state.trench.repeat * state.difficultyBump);
}

function usableSlots(state: GameState): number {
  if (state.trench.portX !== null) return 6;
  const h = Math.min(trenchHardness(state), 7);
  return TRENCH.gunSlotsByHardness[h];
}

function freeSlot(state: GameState): number {
  const n = usableSlots(state);
  for (let i = 0; i < n; i++) if (state.dogfight.fireballs[i] === null) return i;
  return -1;
}

/** Wall guns fire on window frames at a player above them, from the player's slot to the generation distance ahead. */
export function stepWallGuns(state: GameState): void {
  const t = state.trench;
  if (t.torpedoFired) return;
  const row = TRENCH.gunWindow[Math.min(trenchHardness(state), 7)];
  if ((t.frame & row.mask) !== 0) return;
  const startSlot = Math.floor(t.pos.x / TRENCH.slotLength);
  const endSlot = Math.floor((t.pos.x + TRENCH.generateAhead) / TRENCH.slotLength);
  for (let s = startSlot; s <= endSlot; s++) {
    const slot = t.slots[s & (TRENCH.ringSlots - 1)];
    for (const wall of ['left', 'right'] as const) {
      const codes = slot[wall];
      for (let band = 0; band < 4; band++) {
        if (codes[band] !== 3) continue;
        const above = t.pos.z - TRENCH.bandCentres[band];
        if (above < 0) continue;
        const r = Math.floor(nextFloat(state.rng) * 256);
        let fire = false;
        if (above < TRENCH.gunAboveNear) fire = r >= row.prob;
        else if (above < TRENCH.gunAboveFar) fire = (r * r) >> 8 >= row.prob;
        if (!fire) continue;
        const free = freeSlot(state);
        if (free < 0) return;
        const fb: Fireball = {
          kind: 'live',
          mover: 'wall',
          pos: vec(s * TRENCH.slotLength + TRENCH.slotLength / 2, wall === 'left' ? -TRENCH.shotStartY : TRENCH.shotStartY, TRENCH.bandCentres[band]),
          timer: TRENCH.shotFrames,
          at: { x: 0, y: 0 },
          halfDistance: 0,
          impacting: false,
        };
        state.dogfight.fireballs[free] = fb;
        state.events.push({ type: 'alienFired' });
        state.events.push({ type: 'sound', name: 'groundShot' });
      }
    }
  }
}

/** Wall shots creep toward the player as the player closes on them. */
export function stepWallShots(state: GameState): void {
  const t = state.trench;
  const easy = trenchHardness(state) === 0;
  for (const fb of state.dogfight.fireballs) {
    if (!fb || fb.kind !== 'live' || fb.mover !== 'wall') continue;
    fb.pos.x -= 4 * (Math.floor(fb.pos.x / 256) - Math.floor(t.pos.x / 256));
    const dz = t.pos.z - fb.pos.z;
    if (dz > 0) fb.pos.z += dz / 16;
    const targetY = easy ? (fb.pos.y < 0 ? -384 : 384) : t.pos.y;
    const dy = targetY - fb.pos.y;
    if (Math.sign(dy) === -Math.sign(fb.pos.y) || fb.pos.y === 0) fb.pos.y += dy / 16;
  }
}

/** Project the wall shots, judge impacts and the laser against them (a fireball under the cursor always wins). */
export function viewWallShots(state: GameState, lasersOn: boolean): boolean {
  const t = state.trench;
  const p = state.player;
  const g = state.dogfight.fireballs;
  let bestShot = -1;
  let bestDist = Infinity;
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (!fb || fb.kind !== 'live') continue;
    const rel = vec(fb.pos.x - t.pos.x, fb.pos.y - t.pos.y, fb.pos.z - t.pos.z);
    const proj = projectRelative(rel, p.basis);
    if (!proj) {
      g[i] = null;
      continue;
    }
    fb.at = proj.at;
    fb.halfDistance = proj.view.x / 2;
    if (lasersOn) {
      const size = (512 * 80) / Math.max(1, fb.halfDistance) + LASER.hitPad;
      const dx = Math.abs(fb.at.x - p.laserAt.x);
      const dy = Math.abs(fb.at.y - p.laserAt.y);
      if (dx <= size && dy <= size && dx + dy <= LASER.octagonFactor * size && fb.halfDistance < bestDist) {
        bestShot = i;
        bestDist = fb.halfDistance;
      }
    }
    const inBox = Math.abs(proj.at.x) <= 448 && proj.at.y >= -416 && proj.at.y <= 480;
    fb.impacting = proj.view.x <= TRENCH.speed + TRENCH.impactPad && inBox;
  }
  if (bestShot >= 0) {
    hurtFireball(state, bestShot);
    p.laserHit = LASER.hitFreezeFrames;
    g[bestShot]!.impacting = false;
    return true;
  }
  for (let i = 0; i < g.length; i++) {
    const fb = g[i];
    if (fb && fb.kind === 'live' && fb.impacting) {
      fb.impacting = false;
      fireballImpact(state, i);
    }
  }
  return false;
}

/**
 * The laser as a ray from the ship to a far point ahead, offset by the
 * cursor: a wall hit destroys a turret (100) or a panel (50) in the band it
 * strikes; a floor hit splashes and, near the port, launches the torpedo.
 */
export function resolveTrenchLaser(state: GameState): void {
  const t = state.trench;
  const p = state.player;
  if (p.laserFrames === 0 || p.laserHit !== 0) return;
  if (t.force === 0) t.force = -1;
  const dirX = TRENCH.rayAhead;
  const dirY = TRENCH.rayPerPot * p.cursorPot.x;
  const dirZ = TRENCH.rayPerPot * p.cursorPot.y;
  // Wall crossing.
  let wallT = Infinity;
  if (dirY !== 0) {
    const wallY = dirY > 0 ? TRENCH.wallY : -TRENCH.wallY;
    wallT = (wallY - t.pos.y) / dirY;
  }
  let floorT = Infinity;
  if (dirZ < 0) floorT = (TRENCH.floorZ - t.pos.z) / dirZ;
  if (wallT <= 1 && wallT < floorT) {
    const hitX = t.pos.x + dirX * wallT;
    const hitZ = t.pos.z + dirZ * wallT;
    const slot = t.slots[slotIndex(hitX)];
    const into = hitX - Math.floor(hitX / TRENCH.slotLength) * TRENCH.slotLength;
    const band = bandAt(hitZ);
    const codes = dirY > 0 ? slot.right : slot.left;
    if (band >= 0 && into >= 512 - TRENCH.laserRadius && into <= 1536 + TRENCH.laserRadius) {
      if (codes[band] === 3) {
        codes[band] = 0;
        addScore(state, SCORING.trenchTurret);
        state.events.push({ type: 'turretHit' });
        state.events.push({ type: 'sound', name: 'explosion' });
        p.laserHit = LASER.hitFreezeFrames;
        return;
      }
      if (codes[band] === 1) {
        codes[band] = 0;
        addScore(state, 50);
        state.events.push({ type: 'panelHit' });
        state.events.push({ type: 'sound', name: 'explosion' });
        p.laserHit = LASER.hitFreezeFrames;
        return;
      }
    }
    state.events.push({ type: 'laserSplash' });
    return;
  }
  if (floorT <= 1) {
    const hitX = t.pos.x + dirX * floorT;
    const hitY = t.pos.y + dirY * floorT;
    if (Math.abs(hitY) > TRENCH.wallY) return;
    state.events.push({ type: 'laserSplash' });
    if (t.portX !== null && !t.torpedoFired && Math.abs(hitY) <= TRENCH.portHitRadius && Math.abs(hitX - t.portX) <= TRENCH.portHitRadius) {
      t.torpedoFired = true;
      t.torpedo = { pos: vec(t.pos.x + 256, t.pos.y, t.pos.z), live: true };
      state.dogfight.fireballs = [null, null, null, null, null, null];
      state.events.push({ type: 'torpedoFired' });
      state.events.push({ type: 'music', cue: 'torpedo' });
      state.events.push({ type: 'sound', name: 'torpedo' });
    }
  }
}

/** The torpedo pair glides to the port and dives in. */
export function stepTorpedo(state: GameState): void {
  const t = state.trench;
  if (!t.torpedo || !t.torpedo.live || t.portX === null) return;
  const tp = t.torpedo.pos;
  tp.x = Math.min(t.portX, tp.x + TRENCH.torpedoSpeed + TRENCH.speed);
  tp.z = Math.min(tp.z, t.portX - tp.x + TRENCH.floorZ);
  const limit = (t.portX - tp.x) / 16;
  tp.y = Math.max(-limit, Math.min(limit, tp.y));
  if (tp.x - t.pos.x <= -0x4000) t.torpedo.live = false;
}
