import { M6502 } from "../../cpu/m6502.js";
import { BbcModelBBus } from "./model-b-bus.js";
import { BbcVideoOutput } from "./video.js";
import { createSectorDisk, SsdDisk, UefCassette } from "./media.js";
import { Z80TubeSecondProcessor } from "./z80-second-processor.js";

export const BBC_STATE_FORMAT = Object.freeze({
  format: "6502-world-bbc-state",
  version: 2,
  machine: "bbc-model-b",
});

export class BbcMicroModelB {
  constructor({ traceLimit = 512, accessLogLimit = 4096 } = {}) {
    this.bus = new BbcModelBBus({ accessLogLimit });
    this.cpu = new M6502({ bus: this.bus, traceLimit });
    this.video = new BbcVideoOutput({ bus: this.bus });
    this.cassette = null;
    this.parasite = null;
    this.machineTicks = 0;
  }

  loadOsRom(bytes) { this.bus.loadOsRom(bytes); this.reset(); }
  loadSidewaysRom(bank, bytes) { this.bus.loadSidewaysRom(bank, bytes); }
  loadUef(bytes) { this.cassette = new UefCassette(bytes); return this.cassette; }
  mountMedia(bytes, { format, filename, drive = 0, writeProtected = false } = {}) { const disk = createSectorDisk(bytes, { format, filename }); this.bus.devices.fdc.mount(disk, { drive, writeProtected }); return disk; }
  mountSsd(bytes, options = {}) { const disk = new SsdDisk(bytes); this.bus.devices.fdc.mount(disk, options); return disk; }
  mountDsd(bytes, options = {}) { return this.mountMedia(bytes, { ...options, format: "dsd" }); }
  ejectMedia(drive = 0) { return this.bus.devices.fdc.eject(drive); }
  ejectSsd(drive = 0) { return this.ejectMedia(drive); }
  attachZ80SecondProcessor(options = {}) { this.parasite = new Z80TubeSecondProcessor({ tube: this.bus.devices.tube, ...options }); return this.parasite; }

  exportState() {
    const fdc = this.bus.devices.fdc;
    return {
      ...BBC_STATE_FORMAT, machineTicks: this.machineTicks,
      cpu: this.cpu.saveState(), ram: encodeBytes(this.bus.ram), osRom: encodeBytes(this.bus.osRom),
      sidewaysRoms: this.bus.sidewaysRoms.map((rom) => rom ? encodeBytes(rom) : null), selectedRom: this.bus.selectedRom,
      devices: {
        crtc: { registers: Array.from(this.bus.devices.crtc.registers), selectedRegister: this.bus.devices.crtc.selectedRegister }, acia: this.bus.devices.acia.saveState(),
        videoUla: this.bus.devices.videoUla.saveState(), systemVia: this.bus.devices.systemVia.saveState(), sound: this.bus.devices.sound.saveState(), tube: this.bus.devices.tube.saveState(),
        fdc: {
          status: fdc.status, result: fdc.result, command: fdc.command, rawCommand: fdc.rawCommand, logicalDrive: fdc.logicalDrive, selectedDrive: fdc.selectedDrive, selectedSide: fdc.selectedSide, driveControlOutputPort: fdc.driveControlOutputPort, driveControlInputPort: fdc.driveControlInputPort,
          parameters: [...fdc.parameters], expectedParameters: fdc.expectedParameters, dataRegister: fdc.dataRegister, nmiPending: fdc.nmiPending, nmiSignaled: fdc.nmiSignaled, nextDataTick: fdc.nextDataTick, nextNmiTick: fdc.nextNmiTick, readTransfers: fdc.readTransfers, writeTransfers: fdc.writeTransfers,
          transfer: fdc.transfer ? { ...fdc.transfer, bytes: encodeBytes(fdc.transfer.bytes) } : null,
          drives: fdc.drives.map((drive) => ({ currentTrack: drive.currentTrack, writeProtected: drive.writeProtected, disk: drive.disk ? { format: drive.disk.format, bytes: encodeBytes(drive.disk.export()), dirty: drive.disk.dirty, revision: drive.disk.revision } : null })),
        },
      },
      cassette: this.cassette ? { source: encodeBytes(this.cassette.source), position: this.cassette.position, playing: this.cassette.playing } : null,
      parasite: this.parasite ? this.parasite.saveState() : null,
    };
  }

  importState(state) {
    if (!state || state.format !== BBC_STATE_FORMAT.format || ![1, BBC_STATE_FORMAT.version].includes(state.version) || state.machine !== BBC_STATE_FORMAT.machine) throw new TypeError("unsupported BBC state file");
    const bus = new BbcModelBBus({ accessLogLimit: this.bus.accessLogLimit });
    bus.ram.set(decodeBytes(state.ram, 0x8000, "RAM")); bus.loadOsRom(decodeBytes(state.osRom, 0x4000, "OS ROM"));
    state.sidewaysRoms.forEach((rom, bank) => { if (rom) bus.loadSidewaysRom(bank, decodeBytes(rom, 0x4000, `sideways ROM ${bank}`)); });
    bus.romSelect.write(0, state.selectedRom); bus.devices.crtc.registers.set(state.devices.crtc.registers); bus.devices.crtc.selectedRegister = state.devices.crtc.selectedRegister; if (state.devices.acia) bus.devices.acia.loadState(state.devices.acia);
    bus.devices.videoUla.loadState(state.devices.videoUla); bus.devices.systemVia.loadState(state.devices.systemVia); bus.devices.sound.loadState(state.devices.sound); if (state.devices.tube) bus.devices.tube.loadState(state.devices.tube);
    const savedFdc = state.devices.fdc; const fdc = bus.devices.fdc;
    Object.assign(fdc, { status: savedFdc.status, result: savedFdc.result, command: savedFdc.command, rawCommand: savedFdc.rawCommand ?? savedFdc.command, logicalDrive: savedFdc.logicalDrive ?? 0, selectedDrive: savedFdc.selectedDrive ?? ((savedFdc.logicalDrive ?? 0) & 1), selectedSide: savedFdc.selectedSide ?? ((savedFdc.logicalDrive ?? 0) >> 1), driveControlOutputPort: savedFdc.driveControlOutputPort ?? ((((savedFdc.logicalDrive ?? 0) & 1) === 0 ? 0x40 : 0x80) | (((savedFdc.logicalDrive ?? 0) >> 1) << 5)), driveControlInputPort: savedFdc.driveControlInputPort ?? 0, parameters: [...savedFdc.parameters], expectedParameters: savedFdc.expectedParameters, dataRegister: savedFdc.dataRegister, nmiPending: savedFdc.nmiPending, nmiSignaled: Boolean(savedFdc.nmiSignaled), nextDataTick: savedFdc.nextDataTick ?? 0, nextNmiTick: savedFdc.nextNmiTick ?? 0, readTransfers: savedFdc.readTransfers ?? 0, writeTransfers: savedFdc.writeTransfers ?? 0 });
    if (state.version === 1) {
      fdc.currentTrack = savedFdc.currentTrack;
      if (savedFdc.disk) { fdc.mount(new SsdDisk(decodeBytes(savedFdc.disk.bytes, null, "SSD"))); fdc.disk.dirty = Boolean(savedFdc.disk.dirty); fdc.disk.revision = fdc.disk.dirty ? 1 : 0; }
    } else {
      savedFdc.drives.forEach((savedDrive, drive) => {
        fdc.drives[drive].currentTrack = savedDrive.currentTrack & 0xff;
        fdc.drives[drive].writeProtected = Boolean(savedDrive.writeProtected);
        if (savedDrive.disk) {
          const disk = createSectorDisk(decodeBytes(savedDrive.disk.bytes, null, `drive ${drive} media`), { format: savedDrive.disk.format });
          disk.dirty = Boolean(savedDrive.disk.dirty); disk.revision = savedDrive.disk.revision ?? (disk.dirty ? 1 : 0); fdc.drives[drive].disk = disk;
        }
      });
    }
    fdc.transfer = savedFdc.transfer ? { ...savedFdc.transfer, bytes: decodeBytes(savedFdc.transfer.bytes, null, "FDC transfer") } : null;
    this.bus = bus; this.cpu = new M6502({ bus, traceLimit: this.cpu.traceLimit }); this.cpu.loadState(state.cpu); this.video = new BbcVideoOutput({ bus }); this.machineTicks = Number(state.machineTicks) || 0;
    this.cassette = state.cassette ? new UefCassette(decodeBytes(state.cassette.source, null, "UEF")) : null;
    if (this.cassette) { this.cassette.position = state.cassette.position; this.cassette.playing = Boolean(state.cassette.playing); }
    this.parasite = null;
    if (state.parasite) { this.attachZ80SecondProcessor({ bootRom: Uint8Array.from(state.parasite.bootRom ?? []) }); this.parasite.loadState(state.parasite); }
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
    this.parasite?.runForHostTicks(ticks);
    if (this.bus.devices.fdc.tick(this.machineTicks)) this.cpu.requestNmi();
    this.cpu.setIrq(this.bus.devices.systemVia.irq || this.bus.devices.acia.irq || this.bus.devices.tube.hostIrq);
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
