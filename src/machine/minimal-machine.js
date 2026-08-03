import { FlatMemory } from "../bus/flat-memory.js";
import { M6502 } from "../cpu/m6502.js";

const STATE_FORMAT = "6502-world-state";
const STATE_VERSION = 1;

export class MinimalMachine {
  constructor({ traceLimit = 256, loadAddress = 0x0600 } = {}) {
    this.traceLimit = traceLimit;
    this.loadAddress = normalizeAddress(loadAddress);
    this.breakpoints = new Set();
    this.memory = new FlatMemory();
    this.memory.write16(0xfffc, this.loadAddress);
    this.cpu = new M6502({ bus: this.memory, traceLimit });
  }

  load(bytes, address = this.loadAddress) {
    if (!(bytes instanceof Uint8Array) && !Array.isArray(bytes)) throw new TypeError("program must be an array of bytes");
    if (bytes.length === 0) throw new Error("program must contain at least one byte");
    const origin = normalizeAddress(address);
    if (origin + bytes.length > 0x10000) throw new RangeError("program does not fit in 64K memory");
    this.loadAddress = origin;
    this.memory = new FlatMemory();
    this.memory.load(bytes, origin);
    const end = origin + bytes.length;
    const covers = (address) => origin <= address && end > address + 1;
    const fallbackVector = end - 1;
    if (!covers(0xfffa)) this.memory.write16(0xfffa, fallbackVector);
    if (!covers(0xfffc)) this.memory.write16(0xfffc, origin);
    if (!covers(0xfffe)) this.memory.write16(0xfffe, fallbackVector);
    this.cpu = new M6502({ bus: this.memory, traceLimit: this.traceLimit });
    return { address: origin, length: bytes.length };
  }

  setBreakpoint(address, enabled = true) {
    const normalized = normalizeAddress(address);
    if (enabled) this.breakpoints.add(normalized);
    else this.breakpoints.delete(normalized);
    return enabled;
  }

  toggleBreakpoint(address) {
    const normalized = normalizeAddress(address);
    return this.setBreakpoint(normalized, !this.breakpoints.has(normalized));
  }

  run({ maxInstructions = 100000, stopOnBrk = true } = {}) {
    let instructions = 0;
    let reason = "limit";
    while (instructions < maxInstructions) {
      if (this.cpu.instructionBoundary && this.breakpoints.has(this.cpu.pc)) {
        reason = "breakpoint";
        break;
      }
      this.cpu.step();
      instructions += 1;
      if (stopOnBrk && this.cpu.currentOpcode === 0x00) {
        reason = "brk";
        break;
      }
    }
    return { instructions, reason, pc: this.cpu.pc };
  }

  exportState() {
    return {
      format: STATE_FORMAT,
      version: STATE_VERSION,
      machine: "minimal-64k",
      loadAddress: this.loadAddress,
      breakpoints: [...this.breakpoints].sort((a, b) => a - b),
      cpu: this.cpu.saveState(),
      memory: encodeBytes(this.memory.snapshot()),
    };
  }

  importState(state) {
    if (!state || state.format !== STATE_FORMAT || state.version !== STATE_VERSION || state.machine !== "minimal-64k") {
      throw new TypeError("unsupported 6502 World state file");
    }
    const snapshot = decodeBytes(state.memory);
    if (snapshot.length !== 0x10000) throw new TypeError("state memory must contain exactly 64K");
    this.memory = new FlatMemory();
    this.memory.restore(snapshot);
    this.cpu = new M6502({ bus: this.memory, traceLimit: this.traceLimit });
    this.cpu.loadState(state.cpu);
    this.loadAddress = normalizeAddress(state.loadAddress);
    this.breakpoints = new Set((state.breakpoints ?? []).map(normalizeAddress));
    return this;
  }
}

export function parseHexAddress(value) {
  const normalized = String(value).trim().replace(/^\$/, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{1,4}$/i.test(normalized)) throw new TypeError(`invalid 16-bit address: ${value}`);
  return Number.parseInt(normalized, 16);
}

function normalizeAddress(value) {
  if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 0xffff) throw new RangeError("address must be between $0000 and $FFFF");
  return Number(value) & 0xffff;
}

function encodeBytes(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function decodeBytes(encoded) {
  if (typeof encoded !== "string") throw new TypeError("state memory must be base64 text");
  let binary;
  try { binary = atob(encoded); } catch { throw new TypeError("state memory is not valid base64"); }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export const MINIMAL_MACHINE_STATE = Object.freeze({ format: STATE_FORMAT, version: STATE_VERSION });
