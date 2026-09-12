import { describe, expect, it } from 'vitest';
import { ENTRY } from '../../data/choreography';
import { ctFrames, F, S, SCRIPT_PROGRAM, startScript, stepScript, type Op } from './scripts';

describe('ct time byte', () => {
  it('decodes the original examples', () => {
    expect(ctFrames(0x01)).toBe(7);
    expect(ctFrames(0x02)).toBe(11);
    expect(ctFrames(0x10)).toBe(19);
    expect(ctFrames(0x20)).toBe(35);
    expect(ctFrames(0x40)).toBe(67);
    expect(ctFrames(0x80)).toBe(127);
  });
});

describe('interpreter', () => {
  const program: Op[] = [
    /* 0 */ { op: 'ct', frames: 2, flags: F.MF },
    /* 1 */ { op: 'until', mask: S.hit },
    /* 2 */ { op: 'ct', frames: 100, flags: F.MF2 },
    /* 3 */ { op: 'until', mask: 0 },
    /* 4 */ { op: 'ct', frames: 3, flags: F.MF | F.MF2 },
    /* 5 */ { op: 'if', mask: S.random1 },
    /* 6 */ { op: 'ct', frames: 1, flags: F.MU },
    /* 7 */ { op: 'if', mask: 0 },
    /* 8 */ { op: 'gosub', target: 10 },
    /* 9 */ { op: 'goto', target: 0 },
    /* 10 */ { op: 'ct', frames: 1, flags: F.RL },
    /* 11 */ { op: 'return' },
  ];
  const fresh = () => ({ pc: 0, timer: 0, untilMask: 0, returnPc: -1, flags: 0 });

  it('holds timed ops for their frame count', () => {
    const r = fresh();
    stepScript(r, 0, program);
    expect(r.flags).toBe(F.MF);
    stepScript(r, 0, program);
    expect(r.flags).toBe(F.MF);
    stepScript(r, 0, program);
    expect(r.flags).toBe(F.MF2);
  });

  it('until skips ahead when a masked status bit is set', () => {
    const r = fresh();
    for (let i = 0; i < 3; i++) stepScript(r, 0, program);
    expect(r.flags).toBe(F.MF2);
    stepScript(r, S.hit, program);
    expect(r.flags).toBe(F.MF | F.MF2);
    expect(r.untilMask).toBe(0);
  });

  it('a failing if skips to the next if; gosub returns; goto loops', () => {
    const r = fresh();
    for (let i = 0; i < 3; i++) stepScript(r, 0, program);
    stepScript(r, S.hit, program);
    stepScript(r, 0, program);
    stepScript(r, 0, program);
    stepScript(r, 0, program);
    expect(r.flags).toBe(F.RL);
    stepScript(r, 0, program);
    expect(r.flags).toBe(F.MF);
  });

  it('takes the if branch when the bit is set', () => {
    const r = fresh();
    for (let i = 0; i < 3; i++) stepScript(r, 0, program);
    stepScript(r, S.hit, program);
    stepScript(r, 0, program);
    stepScript(r, 0, program);
    stepScript(r, S.random1, program);
    expect(r.flags).toBe(F.MU);
  });
});

describe('the original program', () => {
  it('has every script entry inside the program and every jump in range', () => {
    for (const pc of Object.values(ENTRY)) expect(pc).toBeLessThan(SCRIPT_PROGRAM.length);
    for (const op of SCRIPT_PROGRAM) {
      if (op.op === 'goto' || op.op === 'gosub') expect(op.target).toBeLessThan(SCRIPT_PROGRAM.length);
    }
  });

  it('TCH1A1 flies straight in at 256 then 512 units per frame for 67 frames each', () => {
    const r = startScript('TCH1A1');
    stepScript(r, 0);
    expect(r.flags).toBe(F.MF);
    for (let i = 0; i < 66; i++) stepScript(r, 0);
    expect(r.flags).toBe(F.MF);
    stepScript(r, 0);
    expect(r.flags).toBe(F.MF2);
  });

  it('every script keeps running for a thousand frames without falling off the program', () => {
    for (const name of Object.keys(ENTRY)) {
      const r = startScript(name);
      for (let i = 0; i < 1000; i++) stepScript(r, i % 7 === 0 ? S.random1 | S.fired : 0);
      expect(r.pc).toBeLessThan(SCRIPT_PROGRAM.length);
    }
  });
});
