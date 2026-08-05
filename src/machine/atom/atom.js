import { M6502 } from "../../cpu/m6502.js";
import { AtomBus } from "./atom-bus.js";
import { createSectorDisk } from "../bbc/media.js";

export const ATOM_STATE_FORMAT = Object.freeze({ format: "6502-world-atom-state", version: 1, machine: "acorn-atom" });

export class AcornAtom {
  constructor({ traceLimit = 512, accessLogLimit = 4096 } = {}) {
    this.bus = new AtomBus({ accessLogLimit });
    this.cpu = new M6502({ bus: this.bus, traceLimit });
    this.machineCycles = 0;
  }

  loadCoreRoms(roms) { this.bus.loadCoreRoms(roms); this.reset(); }
  loadUtilityRom(bytes) { this.bus.loadUtilityRom(bytes); }
  loadDosRom(bytes) { this.bus.loadDosRom(bytes); }
  mountMedia(bytes, { format, filename, drive = 0, writeProtected = false } = {}) { const disk = createSectorDisk(bytes, { format, filename }); this.bus.fdc.mount(disk, { drive, writeProtected }); return disk; }
  ejectMedia(drive = 0) { return this.bus.fdc.eject(drive); }

  loadAtm(bytes) {
    const source = Uint8Array.from(bytes);
    if (source.length < 0x16) throw new Error("ATM file is shorter than its 22-byte header");
    const start = word(source, 0x10); const run = word(source, 0x12); const size = word(source, 0x14);
    if (source.length !== 0x16 + size) throw new Error("ATM payload length does not match its header");
    for (let index = 0; index < size; index += 1) this.bus.write8(start + index, source[0x16 + index]);
    if (run === 0xc2b2) { this.bus.ram[0x0c] = (start + size) & 0xff; this.bus.ram[0x0d] = (start + size) >> 8; }
    else { while (!this.cpu.instructionBoundary) this.clock(); this.cpu.pc = run; }
    return { name: new TextDecoder("latin1").decode(source.subarray(0, 16)).replace(/\0.*$/, "").trim(), start, run, size };
  }

  exportState() {
    return {
      ...ATOM_STATE_FORMAT,
      machineCycles: this.machineCycles,
      cpu: this.cpu.saveState(),
      ram: encodeBytes(this.bus.ram),
      roms: {
        basic: encodeBytes(this.bus.basicRom), floatingPoint: encodeBytes(this.bus.floatingPointRom), kernel: encodeBytes(this.bus.kernelRom),
        utility: this.bus.utilityRom ? encodeBytes(this.bus.utilityRom) : null, dos: this.bus.dosRom ? encodeBytes(this.bus.dosRom) : null,
      },
      ppi: { portA: this.bus.ppi.portA, portC: this.bus.ppi.portC, control: this.bus.ppi.control, keyColumn: this.bus.ppi.keyColumn, cycles: this.bus.ppi.cycles },
      via: { registers: Array.from(this.bus.via.registers) },
      fdc: { drives: this.bus.fdc.drives.map((drive) => ({ currentTrack: drive.currentTrack, writeProtected: drive.writeProtected, disk: drive.disk ? { format: drive.disk.format, bytes: encodeBytes(drive.disk.export()), dirty: drive.disk.dirty, revision: drive.disk.revision } : null })) },
    };
  }

  importState(state) {
    if (!state || state.format !== ATOM_STATE_FORMAT.format || state.version !== ATOM_STATE_FORMAT.version || state.machine !== ATOM_STATE_FORMAT.machine) throw new TypeError("unsupported Atom state file");
    const bus = new AtomBus({ accessLogLimit: this.bus.accessLogLimit });
    bus.loadCoreRoms({ basic: decodeBytes(state.roms?.basic, 0x1000, "BASIC ROM"), floatingPoint: decodeBytes(state.roms?.floatingPoint, 0x1000, "floating-point ROM"), kernel: decodeBytes(state.roms?.kernel, 0x1000, "kernel ROM") });
    if (state.roms.utility) bus.loadUtilityRom(decodeBytes(state.roms.utility, 0x1000, "utility ROM"));
    if (state.roms.dos) bus.loadDosRom(decodeBytes(state.roms.dos, 0x1000, "DOS ROM"));
    bus.ram.set(decodeBytes(state.ram, 0x10000, "RAM"));
    Object.assign(bus.ppi, { portA: state.ppi.portA & 0xff, portC: state.ppi.portC & 0xff, control: state.ppi.control & 0xff, keyColumn: state.ppi.keyColumn & 0x0f, cycles: Number(state.ppi.cycles) || 0 });
    bus.ppi.tick(0);
    bus.via.registers.set(state.via?.registers ?? []);
    state.fdc?.drives?.forEach((saved, drive) => { if (saved.disk) { const disk = createSectorDisk(decodeBytesAny(saved.disk.bytes, `drive ${drive} media`), { format: saved.disk.format }); disk.dirty = Boolean(saved.disk.dirty); disk.revision = saved.disk.revision ?? 0; bus.fdc.mount(disk, { drive, writeProtected: saved.writeProtected }); } bus.fdc.drives[drive].currentTrack = saved.currentTrack & 0xff; });
    this.bus = bus;
    this.cpu = new M6502({ bus, traceLimit: this.cpu.traceLimit });
    this.cpu.loadState(state.cpu);
    this.machineCycles = Number(state.machineCycles) || 0;
    return this;
  }

  reset() {
    this.bus.reset();
    this.cpu.reset();
    this.machineCycles = 0;
  }

  clock() {
    const cycle = this.cpu.clock();
    this.machineCycles += 1;
    this.bus.ppi.tick(1);
    if (this.bus.fdc.tick(this.machineCycles)) this.cpu.requestNmi();
    return { ...cycle, machineCycles: this.machineCycles };
  }

  step(maxCycles = 32) {
    let cycles = 0;
    do {
      this.clock();
      cycles += 1;
      if (cycles > maxCycles) throw new Error(`instruction exceeded ${maxCycles} cycles`);
    } while (!this.cpu.instructionBoundary);
    return { cycles };
  }

  textSnapshot() {
    const rows = [];
    for (let row = 0; row < 16; row += 1) {
      let line = "";
      for (let column = 0; column < 32; column += 1) line += decodeMc6847(this.bus.ram[0x8000 + row * 32 + column]);
      rows.push(line);
    }
    return rows;
  }

  diagnoseBoot({ maxInstructions = 500000 } = {}) {
    let instructions = 0;
    let enteredKernel = false;
    let reason = "limit";
    while (instructions < maxInstructions) {
      this.step();
      instructions += 1;
      if (this.cpu.currentInstructionAddress >= 0xf000) enteredKernel = true;
      if (instructions % 1000 === 0) {
        const screen = this.textSnapshot().join("\n");
        if (screen.includes("ACORN ATOM") && screen.includes(">")) { reason = "basic-prompt"; break; }
      }
    }
    return {
      passed: enteredKernel && reason === "basic-prompt",
      reason,
      instructions,
      pc: this.cpu.pc,
      resetVector: this.bus.kernelRom[0xffc] | (this.bus.kernelRom[0xffd] << 8),
      enteredKernel,
      machineCycles: this.machineCycles,
      deviceAccesses: { ...this.bus.deviceAccessCounts },
      screen: this.textSnapshot(),
    };
  }
}

function decodeMc6847(value) {
  const code = value & 0x3f;
  return String.fromCharCode(code < 0x20 ? code + 0x40 : code);
}

function encodeBytes(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function decodeBytes(encoded, expectedLength, label) {
  if (typeof encoded !== "string") throw new TypeError(`${label} state must be base64 text`);
  let bytes;
  try { bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)); } catch { throw new TypeError(`${label} state is not valid base64`); }
  if (bytes.length !== expectedLength) throw new TypeError(`${label} state has the wrong size`);
  return bytes;
}

function decodeBytesAny(encoded, label) {
  if (typeof encoded !== "string") throw new TypeError(`${label} state must be base64 text`);
  try { return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)); } catch { throw new TypeError(`${label} state is not valid base64`); }
}
function word(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
