import { SURFACE } from '../config';
import { add, DEG, identityBasis, pitch, roll, scale, type Vec, vec } from '../frame';
import { nextFloat } from '../random';
import type { Building, GameState, GroundFragment } from '../types';
import { relativeTo } from './buildings';

/** Three slabs fly off a destroyed hat or bunker toward the player, tumbling, then fall to the ground. */
export function spawnGroundFragments(state: GameState, b: Building): void {
  const s = state.surface;
  const rel = relativeTo(state, b);
  const origin = add(s.pos, vec(rel.x, rel.y, 0));
  const tower = b.type !== 'bunker';
  const height = tower ? SURFACE.towerFragmentHeight : SURFACE.bunkerFragmentHeight;
  const lift = () => ((tower ? 0x200 : 0x300) | Math.floor(nextFloat(state.rng) * 256)) * 4;
  const toward = (offY: number): Vec => {
    const target = vec(s.pos.x + 0x7f00, s.pos.y + offY, 0);
    const d = scale(vec(target.x - origin.x, target.y - origin.y, 0), 1 / 32);
    d.x += nextFloat(state.rng) * 8;
    return d;
  };
  const shapes: GroundFragment['shape'][] = tower ? ['towerLeft', 'towerCentre', 'towerRight'] : ['bunkerLeft', 'bunkerCentre', 'bunkerRight'];
  const pieces: GroundFragment[] = [
    { shape: shapes[0], pos: vec(origin.x, origin.y - 0x200, height), vel: { ...toward(-0x3f00), z: lift() }, timer: SURFACE.fragmentFrames },
    { shape: shapes[1], pos: vec(origin.x + 0x200, origin.y, height), vel: { ...toward(0), z: lift() }, timer: SURFACE.fragmentFrames },
    { shape: shapes[2], pos: vec(origin.x, origin.y + 0x200, height), vel: { ...toward(0x3f00), z: lift() }, timer: SURFACE.fragmentFrames },
  ];
  for (const piece of pieces) {
    if (s.fragments.length >= 8) s.fragments.shift();
    s.fragments.push(piece);
  }
}

export function stepGroundFragments(state: GameState): void {
  const s = state.surface;
  if (s.fragments.length === 0) {
    s.munge = identityBasis();
    return;
  }
  roll(s.munge, 19.04 * DEG);
  pitch(s.munge, 4.99 * DEG);
  s.fragments = s.fragments.filter((f) => {
    f.timer -= 1;
    f.pos = add(f.pos, f.vel);
    f.vel.x -= f.vel.x * SURFACE.fragmentFriction;
    f.vel.y -= f.vel.y * SURFACE.fragmentFriction;
    f.vel.z -= SURFACE.fragmentGravity;
    if (f.pos.z < 0) f.pos.z = 0;
    return f.timer > 0;
  });
}
