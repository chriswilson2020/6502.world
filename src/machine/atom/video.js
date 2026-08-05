export const ATOM_GRAPHICS_MODES = Object.freeze([
  { width: 64, height: 64, bpp: 2 }, { width: 128, height: 64, bpp: 1 },
  { width: 128, height: 64, bpp: 2 }, { width: 128, height: 96, bpp: 1 },
  { width: 128, height: 96, bpp: 2 }, { width: 128, height: 192, bpp: 1 },
  { width: 128, height: 192, bpp: 2 }, { width: 256, height: 192, bpp: 1 },
]);

export class AtomVideoOutput {
  constructor({ bus }) { this.bus = bus; }
  get graphicsEnabled() { return Boolean(this.bus.ppi.portA & 0x10); }
  get modeNumber() { return (this.bus.ppi.portA >> 5) & 7; }
  get colourSet() { return (this.bus.ppi.portC >> 3) & 1; }

  graphicsFrame() {
    const mode = ATOM_GRAPHICS_MODES[this.modeNumber]; const pixels = new Uint8Array(mode.width * mode.height); const bytes = mode.width * mode.height * mode.bpp / 8;
    for (let offset = 0; offset < bytes; offset += 1) {
      const value = this.bus.ram[this.bus.videoBase + offset];
      if (mode.bpp === 1) for (let bit = 0; bit < 8; bit += 1) pixels[offset * 8 + bit] = (value >> (7 - bit)) & 1;
      else for (let pair = 0; pair < 4; pair += 1) pixels[offset * 4 + pair] = (value >> (6 - pair * 2)) & 3;
    }
    return { ...mode, mode: this.modeNumber, colourSet: this.colourSet, pixels };
  }

  textCells() {
    return Array.from({ length: 16 }, (_, row) => Array.from({ length: 32 }, (_, column) => {
      const value = this.bus.ram[this.bus.videoBase + row * 32 + column];
      return value & 0x40 ? { kind: "semigraphics", blocks: value & 0x3f, inverse: Boolean(value & 0x80) } : { kind: "text", character: decode(value), inverse: Boolean(value & 0x80) };
    }));
  }
}

function decode(value) { const code = value & 0x3f; return String.fromCharCode(code < 0x20 ? code + 0x40 : code); }
