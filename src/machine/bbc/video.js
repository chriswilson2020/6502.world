export class VideoUla {
  constructor() { this.name = "Video ULA"; this.reset(); }
  reset() { this.control = 0; this.palette = new Uint8Array(16); this.lastPaletteWrite = 0; }
  read(offset) { return (offset & 1) === 0 ? this.control : this.lastPaletteWrite; }
  write(offset, value) {
    if ((offset & 1) === 0) this.control = value & 0xff;
    else { this.lastPaletteWrite = value & 0xff; this.palette[value >> 4] = value & 0x0f; }
  }
  get mode() { return (this.control >> 2) & 0x07; }
}

export class BbcVideoOutput {
  constructor({ bus }) { this.bus = bus; this.frameTicks = 0; }
  reset() { this.frameTicks = 0; }
  tick(machineTicks) {
    this.frameTicks += machineTicks;
    if (this.frameTicks < 40000) return false;
    this.frameTicks %= 40000;
    return true;
  }
  get screenBase() {
    const crtc = this.bus.devices.crtc.registers;
    const start = (crtc[12] << 8) | crtc[13];
    // MA13 selects the BBC's 1K teletext window; its ten low address bits
    // wrap within $7C00-$7FFF. This is the normal MOS/BASIC mode 7 display.
    if (start & 0x2000) return 0x7c00 | (start & 0x03ff);
    const configured = (start << 3) & 0x7fff;
    return configured || 0x7c00;
  }
  textSnapshot({ columns = 40, rows = 25 } = {}) {
    const lines = [];
    for (let row = 0; row < rows; row += 1) {
      let line = "";
      for (let column = 0; column < columns; column += 1) {
        const value = this.bus.ram[(this.screenBase + row * columns + column) & 0x7fff];
        line += value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : " ";
      }
      lines.push(line);
    }
    return lines;
  }
}
