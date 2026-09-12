import { EXPLOSION } from '../config';
import { add, DEG, identityBasis, length, pitch, roll, scale, toView, type Vec } from '../frame';
import { nextFloat } from '../random';
import { inCone } from '../projection';
import type { Alien, ExplosionPiece, GameState } from '../types';

/** Queue the three tumbling pieces of a destroyed TIE. */
export function spawnExplosion(state: GameState, a: Alien): void {
  const d = state.dogfight;
  const wingOffset = scale(a.basis.right, EXPLOSION.wingOffset);
  const away = scale(a.pos, 1 / Math.max(1, length(a.pos)));
  const drift = scale(away, 32767 / 16);
  drift.x += (nextFloat(state.rng) - 0.5) * 256;
  const pieces: ExplosionPiece[] = [
    { shape: 'portWing', pos: add(a.pos, scale(wingOffset, -1)), vel: add(a.vel, scale(wingOffset, -1)), timer: EXPLOSION.wingFrames },
    { shape: 'stbdWing', pos: add(a.pos, wingOffset), vel: add(a.vel, wingOffset), timer: EXPLOSION.wingFrames },
    { shape: 'cabin', pos: { ...a.pos }, vel: drift, timer: EXPLOSION.cabinFrames },
  ];
  for (const piece of pieces) {
    if (d.explosions.length >= EXPLOSION.queueSize) d.explosions.shift();
    d.explosions.push(piece);
  }
}

/** Move the pieces, tumble the shared munge matrix, and drop pieces that expire or leave the view. */
export function stepExplosions(state: GameState): void {
  const d = state.dogfight;
  if (d.explosions.length === 0) {
    d.munge = identityBasis();
    return;
  }
  roll(d.munge, EXPLOSION.mungeRollDeg * DEG);
  pitch(d.munge, EXPLOSION.mungePitchDeg * DEG);
  d.explosions = d.explosions.filter((piece) => {
    piece.timer -= 1;
    piece.pos = add(piece.pos, piece.vel);
    const view: Vec = toView(state.player.basis, piece.pos);
    return piece.timer > 0 && inCone(view);
  });
}
