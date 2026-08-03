import { M6502 } from "../../cpu/m6502.js";
import { BbcModelBBus } from "./model-b-bus.js";
import { BbcVideoOutput } from "./video.js";
import { SsdDisk, UefCassette } from "./media.js";

export class BbcMicroModelB {
  constructor({ traceLimit = 512, accessLogLimit = 4096 } = {}) {
    this.bus = new BbcModelBBus({ accessLogLimit });
    this.cpu = new M6502({ bus: this.bus, traceLimit });
    this.video = new BbcVideoOutput({ bus: this.bus });
    this.cassette = null;
    this.machineTicks = 0;
  }

  loadOsRom(bytes) { this.bus.loadOsRom(bytes); this.reset(); }
  loadSidewaysRom(bank, bytes) { this.bus.loadSidewaysRom(bank, bytes); }
  loadUef(bytes) { this.cassette = new UefCassette(bytes); return this.cassette; }
  mountSsd(bytes) { const disk = new SsdDisk(bytes); this.bus.devices.fdc.mount(disk); return disk; }
  ejectSsd() { return this.bus.devices.fdc.eject(); }

  exportState() {
    const fdc = this.bus.devices.fdc;
    return {
      format: "6502-world-bbc-state", version: 1, machine: "bbc-model-b", machineTicks: this.machineTicks,
      cpu: this.cpu.saveState(), ram: encodeBytes(this.bus.ram), osRom: encodeBytes(this.bus.osRom),
      sidewaysRoms: this.bus.sidewaysRoms.map((rom) => rom ? encodeBytes(rom) : null), selectedRom: this.bus.selectedRom,
      devices: {
        crtc: { registers: Array.from(this.bus.devices.crtc.registers), selectedRegister: this.bus.devices.crtc.selectedRegister },
        videoUla: this.bus.devices.videoUla.saveState(), systemVia: this.bus.devices.systemVia.saveState(), sound: this.bus.devices.sound.saveState(),
        fdc: { status: fdc.status, result: fdc.result, command: fdc.command, parameters: [...fdc.parameters], expectedParameters: fdc.expectedParameters, dataRegister: fdc.dataRegister, nmiPending: fdc.nmiPending, currentTrack: fdc.currentTrack, transfer: fdc.transfer ? { ...fdc.transfer, bytes: encodeBytes(fdc.transfer.bytes) } : null, disk: fdc.disk ? { bytes: encodeBytes(fdc.disk.export()), dirty: fdc.disk.dirty } : null },
      },
      cassette: this.cassette ? { source: encodeBytes(this.cassette.source), position: this.cassette.position, playing: this.cassette.playing } : null,
    };
  }

  importState(state) {
    if (!state || state.format !== "6502-world-bbc-state" || state.version !== 1 || state.machine !== "bbc-model-b") throw new TypeError("unsupported BBC state file");
    const bus = new BbcModelBBus({ accessLogLimit: this.bus.accessLogLimit });
    bus.ram.set(decodeBytes(state.ram, 0x8000, "RAM")); bus.loadOsRom(decodeBytes(state.osRom, 0x4000, "OS ROM"));
    state.sidewaysRoms.forEach((rom, bank) => { if (rom) bus.loadSidewaysRom(bank, decodeBytes(rom, 0x4000, `sideways ROM ${bank}`)); });
    bus.romSelect.write(0, state.selectedRom); bus.devices.crtc.registers.set(state.devices.crtc.registers); bus.devices.crtc.selectedRegister = state.devices.crtc.selectedRegister;
    bus.devices.videoUla.loadState(state.devices.videoUla); bus.devices.systemVia.loadState(state.devices.systemVia); bus.devices.sound.loadState(state.devices.sound);
    const savedFdc = state.devices.fdc; const fdc = bus.devices.fdc;
    Object.assign(fdc, { status: savedFdc.status, result: savedFdc.result, command: savedFdc.command, parameters: [...savedFdc.parameters], expectedParameters: savedFdc.expectedParameters, dataRegister: savedFdc.dataRegister, nmiPending: savedFdc.nmiPending, currentTrack: savedFdc.currentTrack });
    if (savedFdc.disk) { fdc.mount(new SsdDisk(decodeBytes(savedFdc.disk.bytes, null, "SSD"))); fdc.disk.dirty = Boolean(savedFdc.disk.dirty); }
    fdc.transfer = savedFdc.transfer ? { ...savedFdc.transfer, bytes: decodeBytes(savedFdc.transfer.bytes, null, "FDC transfer") } : null;
    this.bus = bus; this.cpu = new M6502({ bus, traceLimit: this.cpu.traceLimit }); this.cpu.loadState(state.cpu); this.video = new BbcVideoOutput({ bus }); this.machineTicks = Number(state.machineTicks) || 0;
    this.cassette = state.cassette ? new UefCassette(decodeBytes(state.cassette.source, null, "UEF")) : null;
    if (this.cassette) { this.cassette.position = state.cassette.position; this.cassette.playing = Boolean(state.cassette.playing); }
    return this;
  }
  reset() { this.bus.reset(); this.video.reset(); this.cpu.reset(); this.machineTicks = 0; }

  clock() {
    const before = this.bus.timingTicks;
    const cycle = this.cpu.clock();
    const ticks = this.bus.timingTicks - before;
    this.machineTicks += ticks;
    this.bus.devices.systemVia.tick(ticks);
    this.video.tick(ticks);
    if (this.bus.devices.fdc.tick(ticks)) this.cpu.requestNmi();
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

function encodeBytes(bytes) {
  let binary = ""; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)); return btoa(binary);
}
function decodeBytes(encoded, expectedLength, label) {
  if (typeof encoded !== "string") throw new TypeError(`${label} state must be base64 text`);
  let bytes; try { bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)); } catch { throw new TypeError(`${label} state is not valid base64`); }
  if (expectedLength != null && bytes.length !== expectedLength) throw new TypeError(`${label} state has the wrong size`); return bytes;
}
