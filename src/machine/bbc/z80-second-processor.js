import { Z80 } from "../../../vendor/z80-world/src/z80.js";

export class Z80TubeSecondProcessor {
  constructor({ tube, bootRom = new Uint8Array() } = {}) {
    if (!tube) throw new TypeError("Z80 Tube second processor requires a Tube ULA");
    if (bootRom.length > 0x1000) throw new RangeError("Z80 Tube boot ROM must be at most 4K");
    this.tube = tube;
    this.ram = new Uint8Array(0x10000);
    this.bootRom = Uint8Array.from(bootRom);
    this.romEnabled = this.bootRom.length > 0;
    this.hostTicksScheduled = 0;
    this.resetHeld = false;
    this.memory = {
      read8: (address) => this.read8(address),
      write8: (address, value) => this.write8(address, value),
      read16: (address) => this.read16(address),
      write16: (address, value) => this.write16(address, value),
    };
    this.cpu = new Z80(this.memory, {
      read: (port) => this.tube.parasiteRead(port & 0x07),
      write: (port, value) => this.tube.parasiteWrite(port & 0x07, value),
    });
  }

  read8(address) {
    const mapped = address & 0xffff;
    if (mapped >= 0xfef8 && mapped <= 0xfeff) return this.tube.parasiteRead(mapped & 0x07);
    return this.romEnabled && mapped < this.bootRom.length ? this.bootRom[mapped] : this.ram[mapped];
  }
  write8(address, value) {
    const mapped = address & 0xffff;
    if (mapped >= 0xfef8 && mapped <= 0xfeff) { this.tube.parasiteWrite(mapped & 0x07, value); return; }
    this.ram[mapped] = value & 0xff;
  }
  read16(address) { const low = this.read8(address); return low | (this.read8(address + 1) << 8); }
  write16(address, value) { this.write8(address, value); this.write8(address + 1, value >> 8); }
  disableBootRom() { this.romEnabled = false; }
  load(address, bytes) { this.ram.set(Uint8Array.from(bytes), address & 0xffff); }

  step() {
    // Acorn's Z80 board uses M1 (instruction-fetch) address decoding as its
    // shadow-ROM latch: an opcode fetch at 0066 enables the boot ROM and the
    // first opcode fetch at 8000-FFFF disables it again. Writes always reach
    // the underlying RAM.
    if ((this.cpu.PC & 0xffff) === 0x0066 && this.bootRom.length) this.romEnabled = true;
    else if (this.romEnabled && (this.cpu.PC & 0xffff) >= 0x8000) this.romEnabled = false;
    if (this.tube.parasiteNmi) this.cpu.requestNmi();
    if (this.tube.parasiteIrq) this.cpu.requestInterrupt(); else this.cpu.clearInterrupt();
    return this.cpu.step();
  }

  runForHostTicks(hostTicks) {
    if (this.tube.parasiteReset) {
      if (!this.resetHeld) { this.cpu.reset(); this.romEnabled = this.bootRom.length > 0; this.hostTicksScheduled = 0; }
      this.resetHeld = true;
      return this.cpu.tStates;
    }
    this.resetHeld = false;
    this.hostTicksScheduled += hostTicks;
    const target = this.hostTicksScheduled * 3;
    while (this.cpu.tStates < target) this.step();
    return this.cpu.tStates;
  }

  saveState() {
    return { cpu: this.cpu.getState(), ram: Array.from(this.ram), bootRom: Array.from(this.bootRom), romEnabled: this.romEnabled, hostTicksScheduled: this.hostTicksScheduled, resetHeld: this.resetHeld };
  }

  loadState(state) {
    if (!state?.ram || state.ram.length !== 0x10000) throw new TypeError("Z80 Tube state requires 64K RAM");
    this.ram.set(state.ram); this.cpu.setState(state.cpu); this.romEnabled = Boolean(state.romEnabled); this.hostTicksScheduled = Number(state.hostTicksScheduled) || 0; this.resetHeld = Boolean(state.resetHeld);
  }
}
