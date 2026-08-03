import { SSD_GEOMETRY } from "./media.js";

const STATUS_BUSY = 0x80;
const STATUS_RESULT = 0x10;
const STATUS_NMI = 0x08;
const STATUS_DATA = 0x04;

export class Intel8271 {
  constructor() { this.name = "8271 FDC"; this.disk = null; this.reset(); }
  mount(disk) { this.disk = disk; }
  eject() { const disk = this.disk; this.disk = null; this.reset(); return disk; }
  reset() {
    this.status = 0; this.result = 0; this.command = 0; this.parameters = []; this.expectedParameters = 0;
    this.transfer = null; this.dataRegister = 0; this.nmiPending = false; this.currentTrack = 0;
  }

  read(offset) {
    switch (offset & 7) {
      case 0: return this.status;
      case 1: { const value = this.result; this.status &= ~STATUS_RESULT; return value; }
      case 4: return this.#readData();
      default: return 0;
    }
  }

  write(offset, value) {
    const register = offset & 7; const data = value & 0xff;
    if (register === 0) this.#command(data);
    else if (register === 1) this.#parameter(data);
    else if (register === 2) this.reset();
    else if (register === 4) this.#writeData(data);
  }

  tick() {
    if (!this.transfer || (this.status & STATUS_DATA)) return false;
    if (this.transfer.direction === "read" && this.transfer.index < this.transfer.bytes.length) this.dataRegister = this.transfer.bytes[this.transfer.index];
    this.status |= STATUS_DATA | STATUS_NMI; this.nmiPending = true; return true;
  }

  #command(command) {
    this.command = command & 0x3f; this.parameters = []; this.result = 0; this.status = STATUS_BUSY;
    if (this.command === 0x29) this.expectedParameters = 1;
    else if (this.command === 0x13 || this.command === 0x0b) this.expectedParameters = 3;
    else this.#finish(0x18);
  }
  #parameter(value) {
    if (!(this.status & STATUS_BUSY) || this.expectedParameters === 0) return;
    this.parameters.push(value);
    if (this.parameters.length < this.expectedParameters) return;
    if (this.command === 0x29) { this.currentTrack = this.parameters[0]; this.#finish(0); return; }
    if (!this.disk) { this.#finish(0x10); return; }
    const [track, sector, countAndSize] = this.parameters;
    const count = Math.max(1, countAndSize & 0x1f);
    try {
      const bytes = new Uint8Array(count * SSD_GEOMETRY.sectorSize);
      if (this.command === 0x13) for (let index = 0; index < count; index += 1) bytes.set(this.disk.readSector(track, sector + index), index * SSD_GEOMETRY.sectorSize);
      this.transfer = { direction: this.command === 0x13 ? "read" : "write", track, sector, count, bytes, index: 0 };
      this.status = STATUS_BUSY;
    } catch { this.#finish(0x1e); }
  }
  #readData() {
    if (!this.transfer || this.transfer.direction !== "read" || !(this.status & STATUS_DATA)) return this.dataRegister;
    const value = this.dataRegister; this.transfer.index += 1; this.status &= ~(STATUS_DATA | STATUS_NMI); this.nmiPending = false;
    if (this.transfer.index >= this.transfer.bytes.length) this.#finish(0);
    return value;
  }
  #writeData(value) {
    if (!this.transfer || this.transfer.direction !== "write" || !(this.status & STATUS_DATA)) return;
    this.transfer.bytes[this.transfer.index++] = value; this.status &= ~(STATUS_DATA | STATUS_NMI); this.nmiPending = false;
    if (this.transfer.index < this.transfer.bytes.length) return;
    for (let index = 0; index < this.transfer.count; index += 1) this.disk.writeSector(this.transfer.track, this.transfer.sector + index, this.transfer.bytes.subarray(index * SSD_GEOMETRY.sectorSize, (index + 1) * SSD_GEOMETRY.sectorSize));
    this.#finish(0);
  }
  #finish(result) { this.result = result; this.transfer = null; this.status = STATUS_RESULT; this.nmiPending = false; }
}
