export class RegisterDevice {
  constructor(name, registerCount = 0x100) {
    this.name = name;
    this.registers = new Uint8Array(registerCount);
  }

  read(offset) { return this.registers[offset % this.registers.length]; }
  write(offset, value) { this.registers[offset % this.registers.length] = value & 0xff; }
  reset() { this.registers.fill(0); }
  saveState() { return Array.from(this.registers); }
  loadState(state) {
    if (!Array.isArray(state) || state.length !== this.registers.length) throw new TypeError(`invalid ${this.name} state`);
    this.registers.set(state);
  }
}

export class AbsentDevice {
  constructor(name) { this.name = name; }
  read() { return 0xff; }
  write() {}
  reset() {}
}

export class Crtc6845Shell extends RegisterDevice {
  constructor() { super("6845 CRTC", 18); this.selectedRegister = 0; }
  read(offset) { return (offset & 1) === 0 ? this.selectedRegister : super.read(this.selectedRegister); }
  write(offset, value) {
    if ((offset & 1) === 0) this.selectedRegister = value & 0x1f;
    else if (this.selectedRegister < this.registers.length) super.write(this.selectedRegister, value);
  }
  reset() { super.reset(); this.selectedRegister = 0; }
}

export class RomSelectLatch {
  constructor(onSelect) { this.name = "ROMSEL"; this.value = 0; this.onSelect = onSelect; }
  read() { return this.value; }
  write(_offset, value) { this.value = value & 0x0f; this.onSelect(this.value); }
  reset() { this.write(0, 0); }
}
