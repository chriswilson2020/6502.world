import { M6502 } from "../../cpu/m6502.js";
import { AtomBus } from "./atom-bus.js";

export class AcornAtom {
  constructor({ traceLimit = 512, accessLogLimit = 4096 } = {}) {
    this.bus = new AtomBus({ accessLogLimit });
    this.cpu = new M6502({ bus: this.bus, traceLimit });
    this.machineCycles = 0;
  }

  loadCoreRoms(roms) { this.bus.loadCoreRoms(roms); this.reset(); }
  loadUtilityRom(bytes) { this.bus.loadUtilityRom(bytes); }
  loadDosRom(bytes) { this.bus.loadDosRom(bytes); }

  reset() {
    this.bus.reset();
    this.cpu.reset();
    this.machineCycles = 0;
  }

  clock() {
    const cycle = this.cpu.clock();
    this.machineCycles += 1;
    this.bus.ppi.tick(1);
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
