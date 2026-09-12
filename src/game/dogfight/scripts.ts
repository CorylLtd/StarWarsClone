/**
 * The choreography interpreter: runs the original's script program one op at
 * a time for each alien. The program itself is data in src/data/choreography.
 */
import { ENTRY, PROGRAM, type FlagName, type RomOp, type StatusName } from '../../data/choreography';
import type { AlienStatus, ScriptState } from '../types';

/** Twirl and move flags an op can hold, as a bitmask. */
export const F = {
  MF: 1 << 0,
  MF2: 1 << 1,
  MU: 1 << 2,
  MU2: 1 << 3,
  MD: 1 << 4,
  MD2: 1 << 5,
  RL: 1 << 6,
  RR: 1 << 7,
  PU: 1 << 8,
  PD: 1 << 9,
  YL: 1 << 10,
  YR: 1 << 11,
  /** Aim at the player. */
  T0: 1 << 12,
  /** Aim at a point 4096 units in front of the player; suppresses firing. */
  T9: 1 << 13,
} as const;

/** The original's "3" strengths are both bits set. */
const FLAG_BITS: Record<FlagName, number> = {
  MF: F.MF,
  MF2: F.MF2,
  MF3: F.MF | F.MF2,
  MU: F.MU,
  MU2: F.MU2,
  MU3: F.MU | F.MU2,
  MD: F.MD,
  MD2: F.MD2,
  MD3: F.MD | F.MD2,
  RL: F.RL,
  RR: F.RR,
  PU: F.PU,
  PD: F.PD,
  YL: F.YL,
  YR: F.YR,
  T0: F.T0,
  T9: F.T9,
};

/** Status bits a script can test. */
export const S = {
  hit: 1 << 0,
  damaged: 1 << 1,
  playerInSights: 1 << 2,
  playerAhead: 1 << 3,
  random1: 1 << 4,
  random2: 1 << 5,
  fired: 1 << 6,
  playerNear: 1 << 10,
  playerAimingAtMe: 1 << 11,
  inView: 1 << 12,
  playerMid: 1 << 13,
} as const;

const STATUS_BITS: Record<StatusName, number> = S;

export function statusBits(st: AlienStatus): number {
  return (
    (st.hit ? S.hit : 0) |
    (st.playerInSights ? S.playerInSights : 0) |
    (st.playerAhead ? S.playerAhead : 0) |
    (st.random1 ? S.random1 : 0) |
    (st.random2 ? S.random2 : 0) |
    (st.fired ? S.fired : 0) |
    (st.playerNear ? S.playerNear : 0) |
    (st.playerAimingAtMe ? S.playerAimingAtMe : 0) |
    (st.inView ? S.inView : 0) |
    (st.playerMid ? S.playerMid : 0)
  );
}

export type Op =
  | { op: 'ct'; frames: number; flags: number }
  | { op: 'until'; mask: number }
  | { op: 'if'; mask: number }
  | { op: 'goto'; target: number }
  | { op: 'gosub'; target: number }
  | { op: 'return' };

function compile(op: RomOp): Op {
  switch (op.op) {
    case 'ct':
      return { op: 'ct', frames: op.frames, flags: op.flags.reduce((m, f) => m | FLAG_BITS[f], 0) };
    case 'until':
      return { op: 'until', mask: op.mask.reduce((m, f) => m | STATUS_BITS[f], 0) };
    case 'if':
      return { op: 'if', mask: op.mask.reduce((m, f) => m | STATUS_BITS[f], 0) };
    default:
      return op;
  }
}

/** The compiled program: the original's tables with names turned into bits. */
export const SCRIPT_PROGRAM: readonly Op[] = PROGRAM.map(compile);

/** Decode the original's .CT time byte: high nibble * 16 + low nibble * 4, plus 3 frames, byte clamped at 0x73. */
export function ctFrames(byte: number): number {
  const b = Math.min(byte, 0x73);
  return (b >> 4) * 16 + (b & 0xf) * 4 + 3;
}

export function startScript(name: string): ScriptState {
  const pc = ENTRY[name];
  if (pc === undefined) throw new Error(`unknown script ${name}`);
  return { pc, timer: 0, untilMask: 0, returnPc: -1, flags: 0 };
}

/**
 * Advance the script by one frame given this frame's status bits, leaving the
 * flags to apply in `r.flags`. The until-mask check runs before the timer:
 * a match abandons the running op and jumps to the next .CUNTIL, which
 * installs its mask. A timed op holds for its frame count. A .CIF that does
 * not match skips to the next .CIF, which is then evaluated itself. Decoding
 * chains within one frame until a timed op is decoded.
 */
export function stepScript(r: ScriptState, status: number, program: readonly Op[] = SCRIPT_PROGRAM): void {
  if (r.untilMask !== 0 && (status & r.untilMask) !== 0) {
    r.timer = 0;
    while (r.pc < program.length && program[r.pc].op !== 'until') r.pc += 1;
  } else if (r.timer > 0) {
    r.timer -= 1;
    return;
  }
  for (let guard = 0; guard < 128; guard++) {
    if (r.pc >= program.length) return;
    const op = program[r.pc];
    switch (op.op) {
      case 'ct':
        r.flags = op.flags;
        r.timer = op.frames - 1;
        r.pc += 1;
        return;
      case 'until':
        r.untilMask = op.mask;
        r.pc += 1;
        break;
      case 'if':
        r.pc += 1;
        if (op.mask !== 0 && (status & op.mask) === 0) {
          while (r.pc < program.length && program[r.pc].op !== 'if') r.pc += 1;
        }
        break;
      case 'goto':
        r.pc = op.target;
        break;
      case 'gosub':
        r.returnPc = r.pc + 1;
        r.pc = op.target;
        break;
      case 'return':
        if (r.returnPc < 0) return;
        r.pc = r.returnPc;
        r.returnPc = -1;
        break;
    }
  }
}
