const FLAG_C = 0x01;
const FLAG_Z = 0x02;
const FLAG_I = 0x04;
const FLAG_D = 0x08;
const FLAG_B = 0x10;
const FLAG_U = 0x20;
const FLAG_V = 0x40;
const FLAG_N = 0x80;

const hex = (value, width = 2) => (value >>> 0).toString(16).toUpperCase().padStart(width, "0");

/**
 * Cycle-stepped MOS 6502 foundation.
 *
 * Every call to clock() performs exactly one externally visible bus cycle.
 * step() is a convenience wrapper that repeatedly calls clock() until the next
 * instruction boundary. The instruction set is intentionally incomplete in
 * this first project slice; unsupported opcodes fail loudly.
 */
export class M6502 {
  constructor({ bus, traceLimit = 256 } = {}) {
    if (!bus || typeof bus.read8 !== "function" || typeof bus.write8 !== "function") {
      throw new TypeError("M6502 requires a bus with read8() and write8()");
    }

    this.bus = bus;
    this.traceLimit = traceLimit;
    this.trace = [];
    this.microOps = [];
    this.reset();
  }

  reset() {
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xfd;
    this.pc = 0;
    this.p = FLAG_U | FLAG_I;
    this.cycles = 0;
    this.currentOpcode = null;
    this.currentInstructionAddress = null;
    this.instructionBoundary = false;
    this.brkSeen = false;
    this.microOps = [];
    this.trace = [];

    let vectorLow = 0;
    this.#queue(
      () => this.#read(this.pc, { kind: "reset-dummy" }),
      () => this.#read(this.pc, { kind: "reset-dummy" }),
      () => this.#read(0x0100 | this.sp, { kind: "reset-stack" }),
      () => {
        const cycle = this.#read(0x0100 | this.sp, { kind: "reset-stack" });
        this.sp = (this.sp - 1) & 0xff;
        return cycle;
      },
      () => {
        const cycle = this.#read(0x0100 | this.sp, { kind: "reset-stack" });
        this.sp = (this.sp - 1) & 0xff;
        return cycle;
      },
      () => {
        vectorLow = this.bus.read8(0xfffc);
        return this.#record({ address: 0xfffc, operation: "read", data: vectorLow, kind: "reset-vector-low" });
      },
      () => {
        const high = this.bus.read8(0xfffd);
        this.pc = vectorLow | (high << 8);
        return this.#record({ address: 0xfffd, operation: "read", data: high, kind: "reset-vector-high" });
      },
    );
  }

  clock() {
    if (this.microOps.length > 0) {
      const operation = this.microOps.shift();
      const cycle = operation();
      if (this.microOps.length === 0) {
        this.instructionBoundary = true;
      }
      return cycle;
    }

    this.instructionBoundary = false;
    this.currentInstructionAddress = this.pc;
    const opcode = this.bus.read8(this.pc);
    this.currentOpcode = opcode;
    const cycle = this.#record({
      address: this.pc,
      operation: "read",
      data: opcode,
      kind: "opcode-fetch",
      sync: true,
    });
    this.pc = (this.pc + 1) & 0xffff;
    this.#decode(opcode);

    if (this.microOps.length === 0) {
      this.instructionBoundary = true;
    }

    return cycle;
  }

  step(maxCycles = 32) {
    let consumed = 0;
    do {
      this.clock();
      consumed += 1;
      if (consumed > maxCycles) {
        throw new Error(`instruction exceeded ${maxCycles} cycles`);
      }
    } while (!this.instructionBoundary);
    return consumed;
  }

  run({ maxInstructions = 100000, stopOnBrk = true } = {}) {
    let instructions = 0;
    while (instructions < maxInstructions) {
      this.step();
      instructions += 1;
      if (stopOnBrk && this.currentOpcode === 0x00) {
        break;
      }
    }
    return instructions;
  }

  getState() {
    return {
      a: this.a,
      x: this.x,
      y: this.y,
      sp: this.sp,
      pc: this.pc,
      p: this.p,
      cycles: this.cycles,
      currentOpcode: this.currentOpcode,
      currentInstructionAddress: this.currentInstructionAddress,
      instructionBoundary: this.instructionBoundary,
      brkSeen: this.brkSeen,
      flags: {
        n: this.#flag(FLAG_N),
        v: this.#flag(FLAG_V),
        d: this.#flag(FLAG_D),
        i: this.#flag(FLAG_I),
        z: this.#flag(FLAG_Z),
        c: this.#flag(FLAG_C),
      },
    };
  }

  disassemble(address = this.pc) {
    const opcode = this.bus.read8(address);
    const operand = this.bus.read8((address + 1) & 0xffff);
    const absolute = operand | (this.bus.read8((address + 2) & 0xffff) << 8);
    const relative = operand < 0x80 ? operand : operand - 0x100;
    const branchTarget = (address + 2 + relative) & 0xffff;

    const map = {
      0x00: ["BRK", 1], 0x18: ["CLC", 1], 0x38: ["SEC", 1],
      0x58: ["CLI", 1], 0x78: ["SEI", 1], 0xb8: ["CLV", 1],
      0xd8: ["CLD", 1], 0xf8: ["SED", 1], 0xea: ["NOP", 1],
      0xa9: [`LDA #$${hex(operand)}`, 2], 0xa2: [`LDX #$${hex(operand)}`, 2],
      0xa0: [`LDY #$${hex(operand)}`, 2], 0xc9: [`CMP #$${hex(operand)}`, 2],
      0xe0: [`CPX #$${hex(operand)}`, 2], 0xc0: [`CPY #$${hex(operand)}`, 2],
      0x8d: [`STA $${hex(absolute, 4)}`, 3], 0x8e: [`STX $${hex(absolute, 4)}`, 3],
      0x8c: [`STY $${hex(absolute, 4)}`, 3], 0x4c: [`JMP $${hex(absolute, 4)}`, 3],
      0xe8: ["INX", 1], 0xc8: ["INY", 1], 0xca: ["DEX", 1], 0x88: ["DEY", 1],
      0xd0: [`BNE $${hex(branchTarget, 4)}`, 2], 0xf0: [`BEQ $${hex(branchTarget, 4)}`, 2],
      0x90: [`BCC $${hex(branchTarget, 4)}`, 2], 0xb0: [`BCS $${hex(branchTarget, 4)}`, 2],
      0x10: [`BPL $${hex(branchTarget, 4)}`, 2], 0x30: [`BMI $${hex(branchTarget, 4)}`, 2],
    };

    const [text, length] = map[opcode] ?? [`DB $${hex(opcode)}`, 1];
    return { address, opcode, text, length };
  }

  #decode(opcode) {
    switch (opcode) {
      case 0xa9: return this.#immediate((value) => { this.a = value; this.#setNZ(this.a); });
      case 0xa2: return this.#immediate((value) => { this.x = value; this.#setNZ(this.x); });
      case 0xa0: return this.#immediate((value) => { this.y = value; this.#setNZ(this.y); });
      case 0xc9: return this.#immediate((value) => this.#compare(this.a, value));
      case 0xe0: return this.#immediate((value) => this.#compare(this.x, value));
      case 0xc0: return this.#immediate((value) => this.#compare(this.y, value));

      case 0x8d: return this.#absoluteWrite(() => this.a, "STA");
      case 0x8e: return this.#absoluteWrite(() => this.x, "STX");
      case 0x8c: return this.#absoluteWrite(() => this.y, "STY");
      case 0x4c: return this.#absoluteAddress((address) => { this.pc = address; }, "JMP");

      case 0xe8: return this.#implied(() => { this.x = (this.x + 1) & 0xff; this.#setNZ(this.x); }, "INX");
      case 0xc8: return this.#implied(() => { this.y = (this.y + 1) & 0xff; this.#setNZ(this.y); }, "INY");
      case 0xca: return this.#implied(() => { this.x = (this.x - 1) & 0xff; this.#setNZ(this.x); }, "DEX");
      case 0x88: return this.#implied(() => { this.y = (this.y - 1) & 0xff; this.#setNZ(this.y); }, "DEY");

      case 0xd0: return this.#branch(() => !this.#flag(FLAG_Z), "BNE");
      case 0xf0: return this.#branch(() => this.#flag(FLAG_Z), "BEQ");
      case 0x90: return this.#branch(() => !this.#flag(FLAG_C), "BCC");
      case 0xb0: return this.#branch(() => this.#flag(FLAG_C), "BCS");
      case 0x10: return this.#branch(() => !this.#flag(FLAG_N), "BPL");
      case 0x30: return this.#branch(() => this.#flag(FLAG_N), "BMI");

      case 0x18: return this.#implied(() => this.#setFlag(FLAG_C, false), "CLC");
      case 0x38: return this.#implied(() => this.#setFlag(FLAG_C, true), "SEC");
      case 0x58: return this.#implied(() => this.#setFlag(FLAG_I, false), "CLI");
      case 0x78: return this.#implied(() => this.#setFlag(FLAG_I, true), "SEI");
      case 0xb8: return this.#implied(() => this.#setFlag(FLAG_V, false), "CLV");
      case 0xd8: return this.#implied(() => this.#setFlag(FLAG_D, false), "CLD");
      case 0xf8: return this.#implied(() => this.#setFlag(FLAG_D, true), "SED");
      case 0xea: return this.#implied(() => {}, "NOP");
      case 0x00: return this.#brk();

      default:
        throw new Error(
          `Unsupported opcode $${hex(opcode)} at $${hex(this.currentInstructionAddress, 4)}. ` +
          "This first slice intentionally implements only the CPU Lab instruction set.",
        );
    }
  }

  #immediate(apply) {
    this.#queue(() => {
      const address = this.pc;
      const value = this.bus.read8(address);
      this.pc = (this.pc + 1) & 0xffff;
      apply(value);
      return this.#record({ address, operation: "read", data: value, kind: "operand" });
    });
  }

  #implied(apply, mnemonic) {
    this.#queue(() => {
      const cycle = this.#read(this.pc, { kind: "implied-dummy", mnemonic });
      apply();
      return cycle;
    });
  }

  #absoluteAddress(apply, mnemonic) {
    let low = 0;
    this.#queue(
      () => {
        const address = this.pc;
        low = this.bus.read8(address);
        this.pc = (this.pc + 1) & 0xffff;
        return this.#record({ address, operation: "read", data: low, kind: "address-low", mnemonic });
      },
      () => {
        const address = this.pc;
        const high = this.bus.read8(address);
        this.pc = (this.pc + 1) & 0xffff;
        apply(low | (high << 8));
        return this.#record({ address, operation: "read", data: high, kind: "address-high", mnemonic });
      },
    );
  }

  #absoluteWrite(getValue, mnemonic) {
    let low = 0;
    let address = 0;
    this.#queue(
      () => {
        const operandAddress = this.pc;
        low = this.bus.read8(operandAddress);
        this.pc = (this.pc + 1) & 0xffff;
        return this.#record({ address: operandAddress, operation: "read", data: low, kind: "address-low", mnemonic });
      },
      () => {
        const operandAddress = this.pc;
        const high = this.bus.read8(operandAddress);
        this.pc = (this.pc + 1) & 0xffff;
        address = low | (high << 8);
        return this.#record({ address: operandAddress, operation: "read", data: high, kind: "address-high", mnemonic });
      },
      () => this.#write(address, getValue(), { kind: "data-write", mnemonic }),
    );
  }

  #branch(condition, mnemonic) {
    this.#queue(() => {
      const operandAddress = this.pc;
      const rawOffset = this.bus.read8(operandAddress);
      this.pc = (this.pc + 1) & 0xffff;
      const cycle = this.#record({ address: operandAddress, operation: "read", data: rawOffset, kind: "branch-offset", mnemonic });

      if (!condition()) {
        return cycle;
      }

      const offset = rawOffset < 0x80 ? rawOffset : rawOffset - 0x100;
      const oldPc = this.pc;
      const target = (oldPc + offset) & 0xffff;
      this.#queue(() => {
        const dummy = this.#read(oldPc, { kind: "branch-taken", mnemonic });
        this.pc = target;
        if ((oldPc & 0xff00) !== (target & 0xff00)) {
          const crossedAddress = (oldPc & 0xff00) | (target & 0x00ff);
          this.#queue(() => this.#read(crossedAddress, { kind: "branch-page-cross", mnemonic }));
        }
        return dummy;
      });

      return cycle;
    });
  }

  #brk() {
    this.brkSeen = true;
    let vectorLow = 0;
    this.#queue(
      () => {
        const cycle = this.#read(this.pc, { kind: "brk-padding" });
        this.pc = (this.pc + 1) & 0xffff;
        return cycle;
      },
      () => {
        const address = 0x0100 | this.sp;
        const cycle = this.#write(address, this.pc >> 8, { kind: "stack-write-pch" });
        this.sp = (this.sp - 1) & 0xff;
        return cycle;
      },
      () => {
        const address = 0x0100 | this.sp;
        const cycle = this.#write(address, this.pc, { kind: "stack-write-pcl" });
        this.sp = (this.sp - 1) & 0xff;
        return cycle;
      },
      () => {
        const address = 0x0100 | this.sp;
        const cycle = this.#write(address, this.p | FLAG_B | FLAG_U, { kind: "stack-write-p" });
        this.sp = (this.sp - 1) & 0xff;
        this.#setFlag(FLAG_I, true);
        return cycle;
      },
      () => {
        vectorLow = this.bus.read8(0xfffe);
        return this.#record({ address: 0xfffe, operation: "read", data: vectorLow, kind: "brk-vector-low" });
      },
      () => {
        const high = this.bus.read8(0xffff);
        this.pc = vectorLow | (high << 8);
        return this.#record({ address: 0xffff, operation: "read", data: high, kind: "brk-vector-high" });
      },
    );
  }

  #compare(register, value) {
    const result = (register - value) & 0xff;
    this.#setFlag(FLAG_C, register >= value);
    this.#setNZ(result);
  }

  #setNZ(value) {
    this.#setFlag(FLAG_Z, (value & 0xff) === 0);
    this.#setFlag(FLAG_N, (value & 0x80) !== 0);
  }

  #flag(mask) {
    return (this.p & mask) !== 0;
  }

  #setFlag(mask, enabled) {
    if (enabled) this.p |= mask;
    else this.p &= ~mask;
    this.p |= FLAG_U;
  }

  #queue(...operations) {
    this.microOps.push(...operations);
  }

  #read(address, metadata = {}) {
    const normalized = address & 0xffff;
    const data = this.bus.read8(normalized);
    return this.#record({ address: normalized, operation: "read", data, ...metadata });
  }

  #write(address, value, metadata = {}) {
    const normalized = address & 0xffff;
    const data = value & 0xff;
    this.bus.write8(normalized, data);
    return this.#record({ address: normalized, operation: "write", data, ...metadata });
  }

  #record(cycle) {
    const entry = {
      cycle: this.cycles,
      address: cycle.address & 0xffff,
      operation: cycle.operation,
      data: cycle.data & 0xff,
      kind: cycle.kind ?? "bus",
      sync: Boolean(cycle.sync),
      mnemonic: cycle.mnemonic ?? null,
    };
    this.cycles += 1;
    this.trace.push(entry);
    if (this.trace.length > this.traceLimit) {
      this.trace.splice(0, this.trace.length - this.traceLimit);
    }
    return entry;
  }
}

export const M6502_FLAGS = Object.freeze({
  C: FLAG_C,
  Z: FLAG_Z,
  I: FLAG_I,
  D: FLAG_D,
  B: FLAG_B,
  U: FLAG_U,
  V: FLAG_V,
  N: FLAG_N,
});
