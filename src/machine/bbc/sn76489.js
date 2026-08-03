const CLOCK_HZ = 4_000_000;

export class Sn76489 {
  constructor() { this.name = "SN76489"; this.reset(); }

  reset() {
    this.tone = new Uint16Array([0x3ff, 0x3ff, 0x3ff]);
    this.volume = new Uint8Array([15, 15, 15, 15]);
    this.noise = 0;
    this.latchedRegister = 0;
    this.writeCount = 0;
  }

  write(value) {
    const data = value & 0xff;
    if (data & 0x80) {
      this.latchedRegister = (data >> 4) & 7;
      this.#writeNibble(this.latchedRegister, data & 0x0f);
    } else if ((this.latchedRegister & 1) === 0 && this.latchedRegister < 6) {
      const channel = this.latchedRegister >> 1;
      this.tone[channel] = ((data & 0x3f) << 4) | (this.tone[channel] & 0x0f);
    } else {
      this.#writeNibble(this.latchedRegister, data & 0x0f);
    }
    this.writeCount += 1;
  }

  channelState() {
    const tones = Array.from({ length: 3 }, (_, channel) => ({
      frequency: CLOCK_HZ / (32 * Math.max(1, this.tone[channel])),
      gain: attenuation(this.volume[channel]),
    }));
    return { tones, noise: { mode: this.noise & 3, white: Boolean(this.noise & 4), gain: attenuation(this.volume[3]) } };
  }

  saveState() { return { tone: Array.from(this.tone), volume: Array.from(this.volume), noise: this.noise, latchedRegister: this.latchedRegister, writeCount: this.writeCount }; }
  loadState(state) { this.tone.set(state.tone); this.volume.set(state.volume); this.noise = state.noise; this.latchedRegister = state.latchedRegister; this.writeCount = state.writeCount; }

  #writeNibble(register, nibble) {
    if (register & 1) this.volume[register >> 1] = nibble & 0x0f;
    else if (register === 6) this.noise = nibble & 0x07;
    else {
      const channel = register >> 1;
      this.tone[channel] = (this.tone[channel] & 0x3f0) | (nibble & 0x0f);
    }
  }
}

function attenuation(value) { return value >= 15 ? 0 : 10 ** (-2 * value / 20); }
