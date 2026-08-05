import { AtomKeyboardMatrix, AtomPpi8255 } from "./ppi-8255.js";
import { Intel8271 } from "../bbc/intel-8271.js";

const ROM_SIZE = 0x1000;

export const ATOM_MEMORY_MAP = Object.freeze([
  { start: 0x0000, end: 0x03ff, name: "System RAM" },
  { start: 0x0a00, end: 0x0a04, name: "Intel 8271 FDC" },
  { start: 0x2800, end: 0x3bff, name: "Text workspace RAM" },
  { start: 0x8000, end: 0x97ff, name: "MC6847 video RAM" },
  { start: 0xa000, end: 0xafff, name: "Utility ROM" },
  { start: 0xb000, end: 0xb3ff, name: "8255 PPI" },
  { start: 0xb800, end: 0xbbff, name: "6522 VIA expansion" },
  { start: 0xc000, end: 0xcfff, name: "Atom BASIC ROM" },
  { start: 0xd000, end: 0xdfff, name: "Floating-point ROM" },
  { start: 0xe000, end: 0xefff, name: "DOS ROM" },
  { start: 0xf000, end: 0xffff, name: "Atom kernel ROM" },
]);

export class AtomBus {
  constructor({ accessLogLimit = 1024 } = {}) {
    this.ram = new Uint8Array(0x10000);
    this.basicRom = emptyRom();
    this.floatingPointRom = emptyRom();
    this.kernelRom = emptyRom();
    this.utilityRom = null;
    this.dosRom = null;
    this.keyboard = new AtomKeyboardMatrix();
    this.ppi = new AtomPpi8255({ keyboard: this.keyboard });
    this.via = new AtomVia6522Shell();
    this.fdc = new Intel8271();
    this.accessLogLimit = accessLogLimit;
    this.accessLog = [];
    this.deviceAccessCounts = {};
  }

  read8(address) {
    const normalized = address & 0xffff;
    let data = 0xff;
    let device = null;
    if (normalized >= 0x0a00 && normalized <= 0x0a04) { data = this.fdc.read(normalized - 0x0a00); device = this.fdc.name; }
    else if (isRam(normalized)) data = this.ram[normalized];
    else if (normalized >= 0xa000 && normalized < 0xb000) data = this.utilityRom?.[normalized - 0xa000] ?? 0xff;
    else if (normalized >= 0xb000 && normalized < 0xb400) { data = this.ppi.read(normalized & 3); device = this.ppi.name; }
    else if (normalized >= 0xb800 && normalized < 0xbc00) { data = this.via.read(normalized & 0x0f); device = this.via.name; }
    else if (normalized >= 0xc000 && normalized < 0xd000) data = this.basicRom[normalized - 0xc000];
    else if (normalized >= 0xd000 && normalized < 0xe000) data = this.floatingPointRom[normalized - 0xd000];
    else if (normalized >= 0xe000 && normalized < 0xf000) data = this.dosRom?.[normalized - 0xe000] ?? 0xff;
    else if (normalized >= 0xf000) data = this.kernelRom[normalized - 0xf000];
    this.#record(normalized, "read", data, device);
    return data;
  }

  write8(address, value) {
    const normalized = address & 0xffff;
    const data = value & 0xff;
    let device = null;
    if (normalized >= 0x0a00 && normalized <= 0x0a04) { this.fdc.write(normalized - 0x0a00, data); device = this.fdc.name; }
    else if (isRam(normalized)) this.ram[normalized] = data;
    else if (normalized >= 0xb000 && normalized < 0xb400) { this.ppi.write(normalized & 3, data); device = this.ppi.name; }
    else if (normalized >= 0xb800 && normalized < 0xbc00) { this.via.write(normalized & 0x0f, data); device = this.via.name; }
    this.#record(normalized, "write", data, device);
  }

  loadCoreRoms({ basic, floatingPoint, kernel }) {
    this.basicRom = normalizeRom(basic, "Atom BASIC ROM");
    this.floatingPointRom = normalizeRom(floatingPoint, "Atom floating-point ROM");
    this.kernelRom = normalizeRom(kernel, "Atom kernel ROM");
  }

  loadUtilityRom(bytes) { this.utilityRom = normalizeRom(bytes, "Atom utility ROM"); }
  loadDosRom(bytes) { this.dosRom = normalizeRom(bytes, "Atom DOS ROM"); }

  reset() {
    this.ppi.reset();
    this.via.reset();
    this.fdc.reset();
    this.accessLog = [];
    this.deviceAccessCounts = {};
  }

  #record(address, operation, data, device) {
    if (device) this.deviceAccessCounts[device] = (this.deviceAccessCounts[device] ?? 0) + 1;
    if (this.accessLogLimit === 0) return;
    this.accessLog.push({ address, operation, data, device });
    if (this.accessLog.length > this.accessLogLimit) this.accessLog.splice(0, this.accessLog.length - this.accessLogLimit);
  }
}

function isRam(address) {
  return address <= 0x03ff || (address >= 0x2800 && address <= 0x3bff) || (address >= 0x8000 && address <= 0x97ff);
}

function emptyRom() { return new Uint8Array(ROM_SIZE).fill(0xff); }
function normalizeRom(bytes, label) {
  const rom = Uint8Array.from(bytes ?? []);
  if (rom.length !== ROM_SIZE) throw new RangeError(`${label} must be exactly 4K`);
  return rom;
}

class AtomVia6522Shell {
  constructor() { this.name = "6522 VIA"; this.reset(); }
  reset() { this.registers = new Uint8Array(16); }
  read(offset) { return this.registers[offset & 0x0f]; }
  write(offset, value) { this.registers[offset & 0x0f] = value & 0xff; }
}
