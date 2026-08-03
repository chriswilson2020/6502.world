import { Crtc6845Shell, RegisterDevice, RomSelectLatch } from "./register-device.js";
import { BbcKeyboardMatrix, SystemVia6522 } from "./system-via.js";
import { VideoUla } from "./video.js";
import { Sn76489 } from "./sn76489.js";
import { Intel8271 } from "./intel-8271.js";
import { TubeUla } from "./tube-ula.js";

const OS_ROM_SIZE = 0x4000;
const SIDEWAYS_ROM_SIZE = 0x4000;

export class BbcModelBBus {
  constructor({ accessLogLimit = 1024 } = {}) {
    this.ram = new Uint8Array(0x8000);
    this.osRom = new Uint8Array(OS_ROM_SIZE).fill(0xff);
    this.sidewaysRoms = new Array(16).fill(null);
    this.selectedRom = 0;
    this.timingTicks = 0;
    this.accessLogLimit = accessLogLimit;
    this.accessLog = [];
    this.deviceAccessCounts = {};
    this.keyboard = new BbcKeyboardMatrix();
    const sound = new Sn76489();
    this.devices = {
      crtc: new Crtc6845Shell(),
      acia: new RegisterDevice("6850 ACIA", 4),
      serialUla: new RegisterDevice("Serial ULA", 16),
      videoUla: new VideoUla(),
      systemVia: new SystemVia6522({ keyboard: this.keyboard, onSoundWrite: (value) => sound.write(value) }),
      userVia: new RegisterDevice("User 6522 VIA", 16),
      fdc: new Intel8271(),
      econet: new RegisterDevice("Econet", 32),
      adc: new RegisterDevice("uPD7002 ADC", 32),
      tube: new TubeUla(),
      fred: new RegisterDevice("FRED 1MHz expansion", 256),
      jim: new RegisterDevice("JIM 1MHz expansion", 256),
      sound,
    };
    this.romSelect = new RomSelectLatch((bank) => { this.selectedRom = bank; });
  }

  read8(address) {
    const normalized = address & 0xffff;
    let data;
    let device = null;
    if (normalized < 0x8000) data = this.ram[normalized];
    else if (normalized < 0xc000) data = this.sidewaysRoms[this.selectedRom]?.[normalized - 0x8000] ?? 0xff;
    else if (normalized < 0xfc00 || normalized >= 0xff00) data = this.osRom[normalized - 0xc000];
    else ({ data, device } = this.#readIo(normalized));
    this.#record(normalized, "read", data, device);
    return data;
  }

  write8(address, value) {
    const normalized = address & 0xffff;
    const data = value & 0xff;
    let device = null;
    if (normalized < 0x8000) this.ram[normalized] = data;
    else if (normalized >= 0xfc00 && normalized < 0xff00) device = this.#writeIo(normalized, data);
    this.#record(normalized, "write", data, device);
  }

  loadOsRom(bytes) {
    const rom = normalizeRom(bytes, OS_ROM_SIZE, "OS ROM");
    this.osRom.set(rom);
  }

  loadSidewaysRom(bank, bytes) {
    if (!Number.isInteger(bank) || bank < 0 || bank > 15) throw new RangeError("sideways ROM bank must be 0-15");
    const source = Uint8Array.from(bytes);
    if (source.length !== 0x2000 && source.length !== SIDEWAYS_ROM_SIZE) throw new RangeError("sideways ROM must be 8K or 16K");
    const rom = new Uint8Array(SIDEWAYS_ROM_SIZE);
    rom.set(source);
    if (source.length === 0x2000) rom.set(source, 0x2000);
    this.sidewaysRoms[bank] = rom;
  }

  reset() {
    this.timingTicks = 0;
    this.accessLog = [];
    this.deviceAccessCounts = {};
    this.romSelect.reset();
    for (const device of Object.values(this.devices)) device.reset();
  }

  timingFor(address) {
    return address >= 0xfc00 && address < 0xff00 ? { domain: "1MHz", ticks: 2 } : { domain: "2MHz", ticks: 1 };
  }

  #readIo(address) {
    const target = this.#deviceFor(address);
    return { data: target.device.read(target.offset), device: target.device.name };
  }

  #writeIo(address, value) {
    const target = this.#deviceFor(address);
    target.device.write(target.offset, value);
    return target.device.name;
  }

  #deviceFor(address) {
    if (address < 0xfd00) return { device: this.devices.fred, offset: address - 0xfc00 };
    if (address < 0xfe00) return { device: this.devices.jim, offset: address - 0xfd00 };
    if (address < 0xfe08) return { device: this.devices.crtc, offset: address - 0xfe00 };
    if (address < 0xfe10) return { device: this.devices.acia, offset: address - 0xfe08 };
    if (address < 0xfe20) return { device: this.devices.serialUla, offset: address - 0xfe10 };
    if (address < 0xfe30) return { device: this.devices.videoUla, offset: address - 0xfe20 };
    if (address < 0xfe40) return { device: this.romSelect, offset: address - 0xfe30 };
    if (address < 0xfe60) return { device: this.devices.systemVia, offset: address - 0xfe40 };
    if (address < 0xfe80) return { device: this.devices.userVia, offset: address - 0xfe60 };
    if (address < 0xfea0) return { device: this.devices.fdc, offset: address - 0xfe80 };
    if (address < 0xfec0) return { device: this.devices.econet, offset: address - 0xfea0 };
    if (address < 0xfee0) return { device: this.devices.adc, offset: address - 0xfec0 };
    return { device: this.devices.tube, offset: address - 0xfee0 };
  }

  #record(address, operation, data, device) {
    const timing = this.timingFor(address);
    this.timingTicks += timing.ticks;
    if (device) this.deviceAccessCounts[device] = (this.deviceAccessCounts[device] ?? 0) + 1;
    if (this.accessLogLimit === 0) return;
    this.accessLog.push({ address, operation, data, device, ...timing, totalTicks: this.timingTicks });
    if (this.accessLog.length > this.accessLogLimit) this.accessLog.splice(0, this.accessLog.length - this.accessLogLimit);
  }
}

function normalizeRom(bytes, size, label) {
  const source = Uint8Array.from(bytes);
  if (source.length !== size) throw new RangeError(`${label} must be exactly ${size / 1024}K`);
  return source;
}

export const BBC_MODEL_B_MEMORY_MAP = Object.freeze([
  { start: 0x0000, end: 0x7fff, name: "32K RAM", speed: "2MHz" },
  { start: 0x8000, end: 0xbfff, name: "Sideways ROM", speed: "2MHz" },
  { start: 0xc000, end: 0xfbff, name: "OS ROM", speed: "2MHz" },
  { start: 0xfc00, end: 0xfcff, name: "FRED", speed: "1MHz" },
  { start: 0xfd00, end: 0xfdff, name: "JIM", speed: "1MHz" },
  { start: 0xfe00, end: 0xfeff, name: "SHEILA", speed: "1MHz" },
  { start: 0xff00, end: 0xffff, name: "OS ROM", speed: "2MHz" },
]);
