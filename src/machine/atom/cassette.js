import { UefCassette } from "../bbc/media.js";

export class AtomUefCassette {
  constructor(bytes) { this.uef = new UefCassette(bytes); this.reset(); }
  get source() { return this.uef.source; } get version() { return this.uef.version; } get data() { return this.uef.data; }
  reset() { this.position = 0; this.bit = -1; this.bitCycles = 0; this.carrierCycles = 0; this.level = false; this.playing = false; }
  play() { this.playing = true; } pause() { this.playing = false; } rewind() { this.reset(); }
  tick(cycles = 1) {
    if (!this.playing || this.position >= this.data.length) return this.level;
    for (let count = 0; count < cycles; count += 1) {
      this.bitCycles += 1; this.carrierCycles += 1; const current = this.#currentBit(); const halfPeriod = current ? 208 : 417;
      if (this.carrierCycles >= halfPeriod) { this.carrierCycles -= halfPeriod; this.level = !this.level; }
      if (this.bitCycles >= 3333) { this.bitCycles -= 3333; this.carrierCycles = 0; this.bit += 1; if (this.bit > 9) { this.bit = -1; this.position += 1; if (this.position >= this.data.length) { this.playing = false; this.level = false; break; } } }
    }
    return this.level;
  }
  #currentBit() { if (this.bit < 0) return 0; if (this.bit === 8 || this.bit === 9) return 1; return (this.data[this.position] >> this.bit) & 1; }
}
