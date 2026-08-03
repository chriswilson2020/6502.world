const STATUS_BUSY = 0x80;
const STATUS_RESULT = 0x10;
const STATUS_NMI = 0x08;
const STATUS_DATA = 0x04;
// BBC DFS uses the 8271 in single-density FM mode: one encoded byte arrives
// every 64 microseconds, or 128 ticks on the BBC's 2 MHz CPU clock.
const BYTE_TRANSFER_TICKS = 128;

const RESULT_OK = 0x00;
const RESULT_NOT_READY = 0x10;
const RESULT_WRITE_PROTECT = 0x12;
const RESULT_SECTOR_NOT_FOUND = 0x18;

export class Intel8271 {
  constructor({ traceLimit = 256 } = {}) {
    this.name = "8271 FDC";
    this.traceLimit = traceLimit;
    this.drives = [createDrive(), createDrive()];
    this.trace = [];
    this.machineTicks = 0;
    this.reset();
  }

  // Compatibility aliases for callers written before dual-drive support.
  get disk() { return this.drives[0].disk; }
  set disk(value) { this.drives[0].disk = value; }
  get currentTrack() { return this.drives[0].currentTrack; }
  set currentTrack(value) { this.drives[0].currentTrack = value & 0xff; }

  mount(disk, { drive = 0, writeProtected = false } = {}) {
    const slot = this.#drive(drive);
    slot.disk = disk;
    slot.writeProtected = Boolean(writeProtected);
    this.#record("mount", { drive, format: disk.format, writeProtected: slot.writeProtected });
    return disk;
  }

  eject(drive = 0) {
    const slot = this.#drive(drive);
    const disk = slot.disk;
    slot.disk = null;
    slot.writeProtected = false;
    this.#record("eject", { drive });
    if (this.transfer?.drive === drive) this.#finish(RESULT_NOT_READY);
    return disk;
  }

  reset() {
    this.status = 0;
    this.result = 0;
    this.command = 0;
    this.rawCommand = 0;
    this.logicalDrive = 0;
    this.selectedDrive = 0;
    this.selectedSide = 0;
    this.driveControlOutputPort = 0;
    this.driveControlInputPort = 0;
    this.parameters = [];
    this.expectedParameters = 0;
    this.transfer = null;
    this.dataRegister = 0;
    this.nmiPending = false;
    this.nmiSignaled = false;
    this.nextDataTick = 0;
    this.nextNmiTick = 0;
    this.drives.forEach((drive) => { drive.currentTrack = 0; });
    this.#record("reset");
  }

  read(offset) {
    switch (offset & 7) {
      case 0: return this.status;
      case 1: {
        const value = this.result;
        this.status &= ~(STATUS_RESULT | STATUS_NMI);
        this.nmiPending = false;
        this.nmiSignaled = false;
        this.#record("result-read", { result: value });
        return value;
      }
      case 4: return this.#readData();
      default: return 0;
    }
  }

  write(offset, value) {
    const register = offset & 7;
    const data = value & 0xff;
    if (register === 0) this.#command(data);
    else if (register === 1) this.#parameter(data);
    else if (register === 2) this.reset();
    else if (register === 4) this.#writeData(data);
  }

  tick(machineTicks = this.machineTicks) {
    this.machineTicks = Number(machineTicks) || 0;
    if (this.nmiPending) {
      if (this.machineTicks < this.nextNmiTick) return false;
      if (this.nmiSignaled) return false;
      this.nmiSignaled = true;
      this.#record("nmi-request", this.#transferSummary());
      return true;
    }
    if (!this.transfer || (this.status & STATUS_DATA) || this.machineTicks < this.nextDataTick) return false;
    if (this.transfer.direction === "read" && this.transfer.index < this.transfer.bytes.length) this.dataRegister = this.transfer.bytes[this.transfer.index];
    this.status |= STATUS_DATA | STATUS_NMI;
    this.nmiPending = true;
    this.nmiSignaled = true;
    if (this.transfer.index === 0) this.#record("nmi-request", this.#transferSummary());
    return true;
  }

  #command(rawCommand) {
    this.rawCommand = rawCommand;
    this.command = rawCommand & 0x3f;
    this.#applyCommandSelects();
    this.parameters = [];
    this.result = 0;
    this.status = STATUS_BUSY;
    this.nmiPending = false;
    this.#record("command", { rawCommand, command: this.command, logicalDrive: this.logicalDrive, drive: this.selectedDrive, side: this.selectedSide });
    if (this.command === 0x29 || this.command === 0x3d) this.expectedParameters = 1;
    else if (this.command === 0x0a || this.command === 0x0e || this.command === 0x12 || this.command === 0x16 || this.command === 0x1e) this.expectedParameters = 2;
    else if (this.command === 0x0b || this.command === 0x0f || this.command === 0x13 || this.command === 0x17 || this.command === 0x1f) this.expectedParameters = 3;
    else if (this.command === 0x35) this.expectedParameters = 4;
    else if (this.command === 0x3a) this.expectedParameters = 2;
    else if (this.command === 0x2c) { this.expectedParameters = 0; this.#readDriveStatus(); }
    else this.#finish(RESULT_SECTOR_NOT_FOUND, { interrupt: false });
  }

  #parameter(value) {
    if (!(this.status & STATUS_BUSY) || this.expectedParameters === 0) return;
    this.parameters.push(value);
    if (this.parameters.length < this.expectedParameters) return;
    if (this.command === 0x29) {
      this.#selectedDrive().currentTrack = this.parameters[0];
      this.#finish(RESULT_OK);
      return;
    }
    if (this.command === 0x35) { this.#finish(RESULT_OK, { interrupt: false }); return; }
    if (this.command === 0x3d) { this.#readSpecialRegister(this.parameters[0]); return; }
    if (this.command === 0x3a) { this.#writeSpecialRegister(this.parameters[0], this.parameters[1]); return; }
    this.#startSectorCommand();
  }

  #startSectorCommand() {
    const slot = this.#selectedDrive();
    const drive = this.selectedDrive;
    const side = this.selectedSide;
    if (!slot.disk) { this.#finish(RESULT_NOT_READY); return; }
    const write = this.command === 0x0a || this.command === 0x0b || this.command === 0x0e || this.command === 0x0f;
    const verify = this.command === 0x1e || this.command === 0x1f;
    if (write && slot.writeProtected) { this.#finish(RESULT_WRITE_PROTECT); return; }
    const [track, sector, countAndSize = 1] = this.parameters;
    const multi = this.parameters.length === 3;
    const count = multi ? Math.max(1, countAndSize & 0x1f) : 1;
    const sectorSize = multi ? 128 << ((countAndSize >> 5) & 7) : 128;
    // Acorn DFS media uses 256-byte sectors; 128-byte commands transfer the
    // first half of the matching physical sector as specified by the 8271.
    if (sectorSize > slot.disk.sectorSize) { this.#finish(RESULT_SECTOR_NOT_FOUND); return; }
    try {
      const bytes = new Uint8Array(count * sectorSize);
      if (!write) {
        for (let index = 0; index < count; index += 1) bytes.set(slot.disk.readSector(track, side, sector + index).subarray(0, sectorSize), index * sectorSize);
      }
      slot.currentTrack = track;
      if (verify) { this.#record("verify", { drive, side, track, sector, count, sectorSize }); this.#finish(RESULT_OK); return; }
      this.transfer = { direction: write ? "write" : "read", drive, side, track, sector, count, sectorSize, bytes, index: 0 };
      this.nextDataTick = this.machineTicks;
      this.status = STATUS_BUSY;
      this.#record("transfer-start", this.#transferSummary());
    } catch {
      this.#finish(RESULT_SECTOR_NOT_FOUND);
    }
  }

  #readData() {
    if (!this.transfer || this.transfer.direction !== "read" || !(this.status & STATUS_DATA)) return this.dataRegister;
    const value = this.dataRegister;
    this.transfer.index += 1;
    this.status &= ~(STATUS_DATA | STATUS_NMI);
    this.nmiPending = false;
    this.nmiSignaled = false;
    if (this.transfer.index === 1) this.#record("nmi-ack", this.#transferSummary());
    if (this.transfer.index >= this.transfer.bytes.length) this.#finish(RESULT_OK, { delayTicks: BYTE_TRANSFER_TICKS });
    else this.nextDataTick = this.machineTicks + BYTE_TRANSFER_TICKS;
    return value;
  }

  #writeData(value) {
    if (!this.transfer || this.transfer.direction !== "write" || !(this.status & STATUS_DATA)) return;
    this.transfer.bytes[this.transfer.index++] = value;
    this.status &= ~(STATUS_DATA | STATUS_NMI);
    this.nmiPending = false;
    this.nmiSignaled = false;
    if (this.transfer.index === 1) this.#record("nmi-ack", this.#transferSummary());
    if (this.transfer.index < this.transfer.bytes.length) { this.nextDataTick = this.machineTicks + BYTE_TRANSFER_TICKS; return; }
    const { drive, side, track, sector, count, sectorSize, bytes } = this.transfer;
    const disk = this.drives[drive].disk;
    for (let index = 0; index < count; index += 1) {
      const data = bytes.subarray(index * sectorSize, (index + 1) * sectorSize);
      if (sectorSize === disk.sectorSize) disk.writeSector(track, side, sector + index, data);
      else { const physical = disk.readSector(track, side, sector + index); physical.set(data); disk.writeSector(track, side, sector + index, physical); }
    }
    this.#finish(RESULT_OK, { delayTicks: BYTE_TRANSFER_TICKS });
  }

  #readDriveStatus() {
    const selected = this.#selectedDrive();
    const ready0 = (this.rawCommand & 0x40) !== 0 ? 0x04 : 0;
    const ready1 = (this.rawCommand & 0x80) !== 0 ? 0x40 : 0;
    const writeProtected = selected.writeProtected ? 0x08 : 0;
    const trackZero = selected.currentTrack === 0 ? 0x02 : 0;
    this.#finish(0x80 | ready0 | ready1 | writeProtected | trackZero, { interrupt: false });
  }

  #readSpecialRegister(register) {
    let value = 0;
    if (register === 0x12) value = this.drives[0].currentTrack;
    else if (register === 0x1a) value = this.drives[1].currentTrack;
    else if (register === 0x17) value = 0xc1;
    else if (register === 0x22) value = this.driveControlInputPort;
    else if (register === 0x23) value = this.driveControlOutputPort;
    this.#finish(value, { interrupt: false });
  }

  #writeSpecialRegister(register, value) {
    if (register === 0x12) this.drives[0].currentTrack = value;
    else if (register === 0x1a) this.drives[1].currentTrack = value;
    else if (register === 0x22) this.driveControlInputPort = value;
    else if (register === 0x23) {
      this.driveControlOutputPort = value;
      this.selectedDrive = (value & 0x40) !== 0 ? 0 : (value & 0x80) !== 0 ? 1 : this.selectedDrive;
      this.selectedSide = (value >> 5) & 1;
      this.logicalDrive = this.selectedDrive | (this.selectedSide << 1);
    }
    this.#finish(RESULT_OK, { interrupt: false });
  }

  #finish(result, { interrupt = true, delayTicks = 0 } = {}) {
    const summary = this.#transferSummary();
    this.result = result;
    this.transfer = null;
    this.status = STATUS_RESULT | (interrupt ? STATUS_NMI : 0);
    this.nmiPending = interrupt;
    this.nmiSignaled = false;
    this.nextNmiTick = this.machineTicks + delayTicks;
    this.#record("finish", { ...summary, parameters: [...this.parameters], result, interrupt });
  }

  #applyCommandSelects() {
    this.driveControlOutputPort = (this.driveControlOutputPort & 0x3f) | (this.rawCommand & 0xc0);
    if (this.rawCommand & 0x40) this.selectedDrive = 0;
    else if (this.rawCommand & 0x80) this.selectedDrive = 1;
    this.selectedSide = (this.driveControlOutputPort >> 5) & 1;
    this.logicalDrive = this.selectedDrive | (this.selectedSide << 1);
  }
  #selectedDrive() { return this.drives[this.selectedDrive]; }
  #drive(drive) {
    if (!Number.isInteger(drive) || drive < 0 || drive >= this.drives.length) throw new RangeError("FDC drive must be 0 or 1");
    return this.drives[drive];
  }
  #transferSummary() {
    if (!this.transfer) return {};
    const { direction, drive, side, track, sector, count, sectorSize, index } = this.transfer;
    return { direction, drive, side, track, sector, count, sectorSize, index };
  }
  #record(event, detail = {}) {
    if (this.traceLimit <= 0 || !this.trace) return;
    this.trace.push({ ticks: this.machineTicks, event, ...detail });
    if (this.trace.length > this.traceLimit) this.trace.splice(0, this.trace.length - this.traceLimit);
  }
}

function createDrive() { return { disk: null, writeProtected: false, currentTrack: 0 }; }
