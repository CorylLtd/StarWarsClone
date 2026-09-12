/**
 * Source of the AudioWorklet that models the sound board's TMS5220 speech
 * chip, and the chip core it wraps, both as plain JavaScript strings so they
 * can be loaded from a Blob URL (and the core evaluated in tests).
 *
 * Model: a frame every 200 samples at 8 kHz carries an energy, a pitch and
 * ten reflection coefficients as indices into the chip's tables. Over the
 * eight 25-sample interpolation periods of a frame the working parameters
 * close on the frame's targets by the chip's shifts, except that a frame that
 * starts from silence or changes voicing takes effect at once. A voiced frame
 * excites a ten-stage lattice filter with the chirp once per pitch period;
 * an unvoiced frame excites it with a random bit sequence. Output is clipped
 * as the chip's DAC did, AC-coupled as the board's output was, and resampled
 * to the context rate by interpolation.
 */
export const TMS5220_CORE_SOURCE = `
class Tms5220 {
  constructor(tables) {
    this.t = tables;
    this.reset();
  }
  reset() {
    this.data = null; this.bitPos = 0;
    this.speaking = false;
    this.ip = 0; this.periodSample = 0;
    this.pitchCount = 0; this.rng = 0x1fff;
    this.target = { energy: 0, pitch: 0, k: new Array(10).fill(0) };
    this.current = { energy: 0, pitch: 0, k: new Array(10).fill(0) };
    this.oldEnergyIndex = 0; this.oldUnvoiced = true;
    this.inhibit = false;
    this.x = new Array(10).fill(0); this.u = new Array(11).fill(0);
  }
  /** Start speaking a packed frame stream (an array of bytes). */
  speak(bytes) {
    this.data = bytes; this.bitPos = 0;
    this.speaking = true;
    this.ip = 0; this.periodSample = 0;
    this.oldEnergyIndex = 0; this.oldUnvoiced = true;
  }
  bits(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.data[this.bitPos >> 3];
      if (byte === undefined) return -1;
      v = (v << 1) | ((byte >> (7 - (this.bitPos & 7))) & 1);
      this.bitPos += 1;
    }
    return v;
  }
  parseFrame() {
    const t = this.t;
    const e = this.bits(4);
    if (e <= 0 || e === 15) {
      // Silence keeps the filter's shape; a stop frame (or running out of data) ends the word.
      if (e !== 0) this.speaking = false;
      this.target.energy = 0;
      this.inhibit = false;
      this.oldEnergyIndex = 0;
      return;
    }
    const repeat = this.bits(1);
    const p = this.bits(6);
    const unvoiced = p === 0;
    this.target.energy = t.ENERGY[e];
    this.target.pitch = t.PITCH[p];
    if (!repeat) {
      const n = unvoiced ? 4 : 10;
      for (let i = 0; i < 10; i++) this.target.k[i] = i < n ? t.K_TABLES[i][this.bits(t.K_BITS[i])] : 0;
    }
    this.inhibit = this.oldEnergyIndex === 0 || this.oldUnvoiced !== unvoiced;
    this.oldEnergyIndex = e;
    this.oldUnvoiced = unvoiced;
  }
  /** Move the working parameters at the start of an interpolation period. */
  interpolate() {
    const c = this.current, g = this.target;
    if (this.ip === 0) {
      c.energy = g.energy; c.pitch = g.pitch;
      for (let i = 0; i < 10; i++) c.k[i] = g.k[i];
      if (this.speaking) this.parseFrame();
      if (this.inhibit) {
        c.energy = g.energy; c.pitch = g.pitch;
        for (let i = 0; i < 10; i++) c.k[i] = g.k[i];
        this.pitchCount = 0;
      }
      return;
    }
    if (this.inhibit) return;
    const s = this.t.INTERP_SHIFT[this.ip];
    c.energy += (g.energy - c.energy) >> s;
    c.pitch += (g.pitch - c.pitch) >> s;
    for (let i = 0; i < 10; i++) c.k[i] += (g.k[i] - c.k[i]) >> s;
  }
  /** One 8 kHz output sample in -1..1. */
  sample() {
    if (this.periodSample === 0) this.interpolate();
    this.periodSample += 1;
    if (this.periodSample >= this.t.PERIOD_SAMPLES) {
      this.periodSample = 0;
      this.ip = (this.ip + 1) & 7;
    }
    const c = this.current;
    if (!this.speaking && c.energy === 0 && this.target.energy === 0) {
      // Idle: the chip is quiet, and the filter's integer residue with it.
      this.x.fill(0); this.u.fill(0);
      return 0;
    }
    let excitation;
    if (c.pitch === 0) {
      const bit = ((this.rng >> 12) ^ (this.rng >> 3) ^ (this.rng >> 2) ^ this.rng) & 1;
      this.rng = ((this.rng << 1) | bit) & 0x1fff;
      excitation = bit ? -64 : 64;
      this.pitchCount = 0;
    } else {
      excitation = this.pitchCount < this.t.CHIRP.length ? this.t.CHIRP[this.pitchCount] : 0;
      this.pitchCount += 1;
      if (this.pitchCount >= c.pitch) this.pitchCount = 0;
    }
    const x = this.x, u = this.u, k = c.k;
    u[10] = ((excitation << 6) * c.energy) >> 9;
    for (let i = 9; i >= 0; i--) u[i] = u[i + 1] - ((k[i] * x[i]) >> 9);
    for (let i = 9; i >= 1; i--) x[i] = x[i - 1] + ((k[i - 1] * u[i - 1]) >> 9);
    x[0] = u[0];
    const out = u[0] > 2047 ? 2047 : u[0] < -2048 ? -2048 : u[0];
    return out / 2048;
  }
}
`;

export const TMS5220_PROCESSOR_SOURCE = `${TMS5220_CORE_SOURCE}
class Tms5220Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chip = new Tms5220(options.processorOptions.tables);
    this.step = this.chip.t.SAMPLE_RATE / sampleRate;
    this.acc = 1;
    this.last = 0; this.next = 0;
    this.dcIn = 0; this.dcOut = 0;
    this.queue = [];
    this.sample = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'speak') {
        this.queue.push(m);
        this.queue.sort((a, b) => a.at - b.at);
      } else if (m.type === 'stop') {
        this.queue.length = 0;
        this.chip.reset();
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    const n = out.length;
    for (let i = 0; i < n; i++) {
      const now = this.sample + i;
      if (this.queue.length && this.queue[0].at <= now && !this.chip.speaking) this.chip.speak(this.queue.shift().data);
      this.acc += this.step;
      while (this.acc >= 1) {
        this.last = this.next;
        // The board's output stage was AC-coupled: block any offset the lattice leaves behind.
        const raw = this.chip.sample();
        this.dcOut = raw - this.dcIn + 0.99 * this.dcOut;
        this.dcIn = raw;
        this.next = this.dcOut;
        this.acc -= 1;
      }
      out[i] = this.last + (this.next - this.last) * this.acc;
    }
    this.sample += n;
    return true;
  }
}
registerProcessor('tms5220', Tms5220Processor);
`;
