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

export class Mc6850Acia {
  constructor() { this.name = "6850 ACIA"; this.reset(); }
  reset() { this.control = 0; this.status = 0x02; this.receiveData = 0; this.transmitData = 0; }
  get irq() { return (this.status & 0x80) !== 0; }
  read(offset) {
    if ((offset & 1) === 0) return this.status;
    const value = this.receiveData; this.status &= ~(0x01 | 0x20 | 0x40 | 0x80); return value;
  }
  write(offset, value) {
    const data = value & 0xff;
    if ((offset & 1) === 0) {
      this.control = data;
      if ((data & 0x03) === 0x03) this.status = 0x02;
      return;
    }
    this.transmitData = data;
    // Transmission is instantaneous until the cassette waveform layer is
    // connected, so the transmit-data register remains empty.
    this.status |= 0x02;
  }
  saveState() { return { control: this.control, status: this.status, receiveData: this.receiveData, transmitData: this.transmitData }; }
  loadState(state) { this.control = state.control & 0xff; this.status = state.status & 0xff; this.receiveData = state.receiveData & 0xff; this.transmitData = state.transmitData & 0xff; }
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
