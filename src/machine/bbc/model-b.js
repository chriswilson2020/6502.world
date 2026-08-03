import { M6502 } from "../../cpu/m6502.js";
import { BbcModelBBus } from "./model-b-bus.js";
import { BbcVideoOutput } from "./video.js";

export class BbcMicroModelB {
  constructor({ traceLimit = 512, accessLogLimit = 4096 } = {}) {
    this.bus = new BbcModelBBus({ accessLogLimit });
    this.cpu = new M6502({ bus: this.bus, traceLimit });
    this.video = new BbcVideoOutput({ bus: this.bus });
    this.machineTicks = 0;
  }

  loadOsRom(bytes) { this.bus.loadOsRom(bytes); this.reset(); }
  loadSidewaysRom(bank, bytes) { this.bus.loadSidewaysRom(bank, bytes); }
  reset() { this.bus.reset(); this.video.reset(); this.cpu.reset(); this.machineTicks = 0; }

  clock() {
    const before = this.bus.timingTicks;
    const cycle = this.cpu.clock();
    const ticks = this.bus.timingTicks - before;
    this.machineTicks += ticks;
    this.bus.devices.systemVia.tick(ticks);
    this.video.tick(ticks);
    this.cpu.setIrq(this.bus.devices.systemVia.irq);
    return { ...cycle, ticks, machineTicks: this.machineTicks, domain: ticks === 2 ? "1MHz" : "2MHz" };
  }

  step(maxCycles = 32) {
    let cycles = 0; let ticks = 0;
    do {
      const cycle = this.clock();
      cycles += 1; ticks += cycle.ticks;
      if (cycles > maxCycles) throw new Error(`instruction exceeded ${maxCycles} cycles`);
    } while (!this.cpu.instructionBoundary);
    return { cycles, ticks };
  }

  diagnoseBoot({ maxInstructions = 100000 } = {}) {
    let instructions = 0;
    let enteredOs = false;
    let reason = "limit";
    while (instructions < maxInstructions) {
      const address = this.cpu.pc;
      this.step();
      if (this.cpu.currentInstructionAddress >= 0xc000) enteredOs = true;
      instructions += 1;
      if (instructions % 1000 === 0) {
        const screen = this.video.textSnapshot().join("\n");
        if (screen.includes("BBC Computer 32K") && screen.includes("BASIC") && screen.includes(">")) { reason = "basic-prompt"; break; }
      }
      if (this.cpu.instructionBoundary && this.cpu.pc === address) { reason = "stable-loop"; break; }
      if (this.cpu.currentOpcode === 0x00) { reason = "brk"; break; }
    }
    return {
      passed: enteredOs && reason !== "limit",
      reason,
      instructions,
      pc: this.cpu.pc,
      resetVector: this.bus.osRom[0x3ffc] | (this.bus.osRom[0x3ffd] << 8),
      enteredOs,
      selectedRom: this.bus.selectedRom,
      machineTicks: this.machineTicks,
      deviceAccesses: { ...this.bus.deviceAccessCounts },
    };
  }
}
