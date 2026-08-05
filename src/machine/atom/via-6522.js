const IFR_T1 = 0x40;
const IFR_T2 = 0x20;

export class AtomVia6522 {
  constructor() { this.name = "6522 VIA"; this.reset(); }

  reset() {
    this.registers = new Uint8Array(16); this.outputA = 0xff; this.outputB = 0xff; this.ddra = 0; this.ddrb = 0;
    this.timer1 = 0xffff; this.timer1Latch = 0xffff; this.timer1Running = false; this.timer2 = 0xffff; this.timer2Running = false; this.ifr = 0; this.ier = 0;
  }

  get irq() { return Boolean(this.ifr & this.ier & 0x7f); }

  read(offset) {
    const register = offset & 0x0f;
    switch (register) {
      case 0: return (this.outputB & this.ddrb) | (0xff & ~this.ddrb);
      case 1: case 15: return (this.outputA & this.ddra) | (0xff & ~this.ddra);
      case 2: return this.ddrb; case 3: return this.ddra;
      case 4: { const value = this.timer1 & 0xff; this.ifr &= ~IFR_T1; return value; }
      case 5: return this.timer1 >> 8; case 6: return this.timer1Latch & 0xff; case 7: return this.timer1Latch >> 8;
      case 8: { const value = this.timer2 & 0xff; this.ifr &= ~IFR_T2; return value; }
      case 9: return this.timer2 >> 8; case 13: return this.ifr | (this.irq ? 0x80 : 0); case 14: return this.ier | 0x80;
      default: return this.registers[register];
    }
  }

  write(offset, value) {
    const register = offset & 0x0f; const data = value & 0xff; this.registers[register] = data;
    switch (register) {
      case 0: this.outputB = data; break; case 1: case 15: this.outputA = data; break; case 2: this.ddrb = data; break; case 3: this.ddra = data; break;
      case 4: case 6: this.timer1Latch = (this.timer1Latch & 0xff00) | data; break;
      case 5: this.timer1Latch = data << 8 | (this.timer1Latch & 0xff); this.timer1 = this.timer1Latch; this.timer1Running = true; this.ifr &= ~IFR_T1; break;
      case 7: this.timer1Latch = data << 8 | (this.timer1Latch & 0xff); break;
      case 8: this.timer2 = (this.timer2 & 0xff00) | data; break;
      case 9: this.timer2 = data << 8 | (this.timer2 & 0xff); this.timer2Running = true; this.ifr &= ~IFR_T2; break;
      case 13: this.ifr &= ~(data & 0x7f); break; case 14: if (data & 0x80) this.ier |= data & 0x7f; else this.ier &= ~(data & 0x7f); break;
    }
  }

  tick(cycles = 1) {
    for (let count = 0; count < cycles; count += 1) {
      if (this.timer1Running && this.timer1-- === 0) { this.ifr |= IFR_T1; if (this.registers[11] & 0x40) this.timer1 = this.timer1Latch; else this.timer1Running = false; }
      if (this.timer2Running && this.timer2-- === 0) { this.ifr |= IFR_T2; this.timer2Running = false; }
    }
  }

  saveState() { return { registers: Array.from(this.registers), outputA: this.outputA, outputB: this.outputB, ddra: this.ddra, ddrb: this.ddrb, timer1: this.timer1, timer1Latch: this.timer1Latch, timer1Running: this.timer1Running, timer2: this.timer2, timer2Running: this.timer2Running, ifr: this.ifr, ier: this.ier }; }
  loadState(state = {}) { this.registers.set(state.registers ?? []); Object.assign(this, { outputA: state.outputA ?? 0xff, outputB: state.outputB ?? 0xff, ddra: state.ddra ?? 0, ddrb: state.ddrb ?? 0, timer1: state.timer1 ?? 0xffff, timer1Latch: state.timer1Latch ?? 0xffff, timer1Running: Boolean(state.timer1Running), timer2: state.timer2 ?? 0xffff, timer2Running: Boolean(state.timer2Running), ifr: state.ifr ?? 0, ier: state.ier ?? 0 }); }
}
