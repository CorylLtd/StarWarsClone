/**
 * Source of the AudioWorklet that models the sound board's four POKEY chips
 * sample by sample. Kept as a plain JavaScript string so it can be loaded
 * from a Blob URL without a build step of its own.
 *
 * Model: each channel is a down-counter on its selected clock (15 kHz,
 * 64 kHz, or the chip clock, with 16-bit pairs), whose underflow steps the
 * output through the chosen distortion: a 17- or 9-bit and a 4-bit polynomial
 * counter clocked at the chip clock, a 5-bit polynomial that gates the
 * channel clock, or a pure toggle. High-pass flip-flops and 4-bit volumes
 * follow, as on the chip. Register writes arrive with sample timestamps.
 */
export const POKEY_PROCESSOR_SOURCE = `
class Poly {
  constructor(bits, taps) {
    this.bits = bits; this.taps = taps; this.state = 0; this.mask = (1 << bits) - 1;
  }
  step() {
    let fb = 0;
    for (const t of this.taps) fb ^= (this.state >> t) & 1;
    this.state = ((this.state << 1) | (fb ^ 1)) & this.mask;
    return this.state & 1;
  }
}

class Pokey {
  constructor(clockHz) {
    this.clockHz = clockHz;
    this.audf = [0, 0, 0, 0];
    this.audc = [0, 0, 0, 0];
    this.audctl = 0;
    this.counter = [1, 1, 1, 1];
    this.out = [0, 0, 0, 0];
    this.hp = [0, 0];
    this.poly4 = new Poly(4, [3, 2]);
    this.poly5 = new Poly(5, [4, 2]);
    this.poly9 = new Poly(9, [8, 3]);
    this.poly17 = new Poly(17, [16, 11]);
    this.p4 = 0; this.p5 = 0; this.p9 = 0; this.p17 = 0;
    this.div15 = 0; this.div64 = 0;
    this.tick15 = false; this.tick64 = false;
  }
  write(reg, value) {
    if (reg < 8) {
      const ch = reg >> 1;
      if (reg & 1) this.audc[ch] = value; else this.audf[ch] = value;
    } else if (reg === 8) {
      this.audctl = value;
    }
  }
  period(ch) {
    const ctl = this.audctl;
    // A joined pair is one 16-bit divider: the low channel counts, the high channel's output toggles.
    if ((ch === 0 || ch === 1) && (ctl & 0x10)) return ((this.audf[1] << 8) | this.audf[0]) + ((ctl & 0x40) ? 7 : 1);
    if ((ch === 2 || ch === 3) && (ctl & 0x08)) return ((this.audf[3] << 8) | this.audf[2]) + ((ctl & 0x20) ? 7 : 1);
    if ((ch === 0 && (ctl & 0x40)) || (ch === 2 && (ctl & 0x20))) return this.audf[ch] + 4;
    return this.audf[ch] + 1;
  }
  clockKind(ch) {
    const ctl = this.audctl;
    if (ch === 1 && (ctl & 0x10)) return 'fast';
    if (ch === 3 && (ctl & 0x08)) return 'fast';
    if (ch === 0 && (ctl & 0x40)) return 'fast';
    if (ch === 2 && (ctl & 0x20)) return 'fast';
    return (ctl & 1) ? 'slow' : 'base';
  }
  // One chip clock tick.
  tick() {
    this.p4 = this.poly4.step();
    this.p5 = this.poly5.step();
    this.p9 = this.poly9.step();
    this.p17 = this.poly17.step();
    this.div64 = (this.div64 + 1) % 28;
    this.tick64 = this.div64 === 0;
    this.div15 = (this.div15 + 1) % 114;
    this.tick15 = this.div15 === 0;
    const ctl = this.audctl;
    for (let ch = 0; ch < 4; ch++) {
      const kind = this.clockKind(ch);
      // A joined low channel is clocked by its partner's underflow, handled below.
      if ((ch === 1 && (ctl & 0x10)) || (ch === 3 && (ctl & 0x08))) continue;
      let advance = kind === 'fast' ? true : kind === 'slow' ? this.tick15 : this.tick64;
      if (!advance) continue;
      this.counter[ch] -= 1;
      if (this.counter[ch] > 0) continue;
      this.counter[ch] = this.period(ch);
      const joinedHigh = (ch === 0 && (ctl & 0x10)) || (ch === 2 && (ctl & 0x08));
      const target = joinedHigh ? ch + 1 : ch;
      this.underflow(target);
    }
  }
  underflow(ch) {
    const c = this.audc[ch];
    // Distortion bits 7-5: bit 7 clear = 5-bit poly gates the clock.
    if (!(c & 0x80) && !this.p5) return;
    if (c & 0x20) this.out[ch] ^= 1;
    else if (c & 0x40) this.out[ch] = this.p4;
    else this.out[ch] = (this.audctl & 0x80) ? this.p9 : this.p17;
    // High-pass: channel 3's underflow latches channel 1, channel 4's latches channel 2.
    if (ch === 2 && (this.audctl & 0x04)) this.hp[0] = this.out[0];
    if (ch === 3 && (this.audctl & 0x02)) this.hp[1] = this.out[1];
  }
  mix() {
    let sum = 0;
    for (let ch = 0; ch < 4; ch++) {
      const c = this.audc[ch];
      const vol = c & 0x0f;
      if (!vol) continue;
      let o;
      if (c & 0x10) o = 1;
      else if (ch === 0 && (this.audctl & 0x04)) o = this.out[0] ^ this.hp[0];
      else if (ch === 1 && (this.audctl & 0x02)) o = this.out[1] ^ this.hp[1];
      else o = this.out[ch];
      sum += o ? vol : -vol;
    }
    return sum / 60;
  }
}

class PokeyProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const clock = (options.processorOptions && options.processorOptions.clockHz) || 1500000;
    this.chips = [0, 1, 2, 3].map(() => new Pokey(clock));
    this.ticksPerSample = clock / sampleRate;
    this.acc = 0;
    this.queue = [];
    this.sample = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'writes') {
        for (const w of m.writes) this.queue.push(w);
        this.queue.sort((a, b) => a.at - b.at);
      } else if (m.type === 'reset') {
        this.queue.length = 0;
        for (const chip of this.chips) { chip.audc = [0, 0, 0, 0]; chip.audf = [0, 0, 0, 0]; chip.audctl = 0; }
      } else if (m.type === 'clear') {
        // Drop queued writes for one chip's channel from a time on.
        this.queue = this.queue.filter((w) => !(w.chip === m.chip && (m.channel === undefined || (w.reg >> 1) === m.channel || w.reg === 8) && w.at >= m.at));
      }
    };
  }
  process(inputs, outputs) {
    // Output 0 is the two effect chips, output 1 the two music chips (the board low-passes those).
    const out = outputs[0][0];
    const music = outputs[1] && outputs[1][0];
    const n = out.length;
    let q = 0;
    for (let i = 0; i < n; i++) {
      const now = this.sample + i;
      while (q < this.queue.length && this.queue[q].at <= now) {
        const w = this.queue[q];
        this.chips[w.chip].write(w.reg, w.value);
        q += 1;
      }
      this.acc += this.ticksPerSample;
      while (this.acc >= 1) {
        for (const chip of this.chips) chip.tick();
        this.acc -= 1;
      }
      out[i] = (this.chips[0].mix() + this.chips[1].mix()) * 0.6;
      if (music) music[i] = (this.chips[2].mix() + this.chips[3].mix()) * 0.6;
    }
    if (q > 0) this.queue.splice(0, q);
    this.sample += n;
    return true;
  }
}
registerProcessor('pokey', PokeyProcessor);
`;
