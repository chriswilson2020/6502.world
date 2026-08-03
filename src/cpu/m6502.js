const FLAG_C = 0x01;
const FLAG_Z = 0x02;
const FLAG_I = 0x04;
const FLAG_D = 0x08;
const FLAG_B = 0x10;
const FLAG_U = 0x20;
const FLAG_V = 0x40;
const FLAG_N = 0x80;

const hex = (value, width = 2) => (value >>> 0).toString(16).toUpperCase().padStart(width, "0");
const signed = (value) => value < 0x80 ? value : value - 0x100;

const OPCODES = new Array(256);
const define = (mnemonic, mode, ...opcodes) => {
  for (const opcode of opcodes) OPCODES[opcode] = Object.freeze({ mnemonic, mode });
};

define("BRK", "brk", 0x00); define("ORA", "inx", 0x01); define("ORA", "zp", 0x05);
define("ASL", "zp", 0x06); define("PHP", "imp", 0x08); define("ORA", "imm", 0x09);
define("ASL", "acc", 0x0a); define("ORA", "abs", 0x0d); define("ASL", "abs", 0x0e);
define("BPL", "rel", 0x10); define("ORA", "iny", 0x11); define("ORA", "zpx", 0x15);
define("ASL", "zpx", 0x16); define("CLC", "imp", 0x18); define("ORA", "aby", 0x19);
define("ORA", "abx", 0x1d); define("ASL", "abx", 0x1e);
define("JSR", "abs", 0x20); define("AND", "inx", 0x21); define("BIT", "zp", 0x24);
define("AND", "zp", 0x25); define("ROL", "zp", 0x26); define("PLP", "imp", 0x28);
define("AND", "imm", 0x29); define("ROL", "acc", 0x2a); define("BIT", "abs", 0x2c);
define("AND", "abs", 0x2d); define("ROL", "abs", 0x2e); define("BMI", "rel", 0x30);
define("AND", "iny", 0x31); define("AND", "zpx", 0x35); define("ROL", "zpx", 0x36);
define("SEC", "imp", 0x38); define("AND", "aby", 0x39); define("AND", "abx", 0x3d);
define("ROL", "abx", 0x3e); define("RTI", "imp", 0x40); define("EOR", "inx", 0x41);
define("EOR", "zp", 0x45); define("LSR", "zp", 0x46); define("PHA", "imp", 0x48);
define("EOR", "imm", 0x49); define("LSR", "acc", 0x4a); define("JMP", "abs", 0x4c);
define("EOR", "abs", 0x4d); define("LSR", "abs", 0x4e); define("BVC", "rel", 0x50);
define("EOR", "iny", 0x51); define("EOR", "zpx", 0x55); define("LSR", "zpx", 0x56);
define("CLI", "imp", 0x58); define("EOR", "aby", 0x59); define("EOR", "abx", 0x5d);
define("LSR", "abx", 0x5e); define("RTS", "imp", 0x60); define("ADC", "inx", 0x61);
define("ADC", "zp", 0x65); define("ROR", "zp", 0x66); define("PLA", "imp", 0x68);
define("ADC", "imm", 0x69); define("ROR", "acc", 0x6a); define("JMP", "ind", 0x6c);
define("ADC", "abs", 0x6d); define("ROR", "abs", 0x6e); define("BVS", "rel", 0x70);
define("ADC", "iny", 0x71); define("ADC", "zpx", 0x75); define("ROR", "zpx", 0x76);
define("SEI", "imp", 0x78); define("ADC", "aby", 0x79); define("ADC", "abx", 0x7d);
define("ROR", "abx", 0x7e); define("STA", "inx", 0x81); define("STY", "zp", 0x84);
define("STA", "zp", 0x85); define("STX", "zp", 0x86); define("DEY", "imp", 0x88);
define("TXA", "imp", 0x8a); define("STY", "abs", 0x8c); define("STA", "abs", 0x8d);
define("STX", "abs", 0x8e); define("BCC", "rel", 0x90); define("STA", "iny", 0x91);
define("STY", "zpx", 0x94); define("STA", "zpx", 0x95); define("STX", "zpy", 0x96);
define("TYA", "imp", 0x98); define("STA", "aby", 0x99); define("TXS", "imp", 0x9a);
define("STA", "abx", 0x9d); define("LDY", "imm", 0xa0); define("LDA", "inx", 0xa1);
define("LDX", "imm", 0xa2); define("LDY", "zp", 0xa4); define("LDA", "zp", 0xa5);
define("LDX", "zp", 0xa6); define("TAY", "imp", 0xa8); define("LDA", "imm", 0xa9);
define("TAX", "imp", 0xaa); define("LDY", "abs", 0xac); define("LDA", "abs", 0xad);
define("LDX", "abs", 0xae); define("BCS", "rel", 0xb0); define("LDA", "iny", 0xb1);
define("LDY", "zpx", 0xb4); define("LDA", "zpx", 0xb5); define("LDX", "zpy", 0xb6);
define("CLV", "imp", 0xb8); define("LDA", "aby", 0xb9); define("TSX", "imp", 0xba);
define("LDY", "abx", 0xbc); define("LDA", "abx", 0xbd); define("LDX", "aby", 0xbe);
define("CPY", "imm", 0xc0); define("CMP", "inx", 0xc1); define("CPY", "zp", 0xc4);
define("CMP", "zp", 0xc5); define("DEC", "zp", 0xc6); define("INY", "imp", 0xc8);
define("CMP", "imm", 0xc9); define("DEX", "imp", 0xca); define("CPY", "abs", 0xcc);
define("CMP", "abs", 0xcd); define("DEC", "abs", 0xce); define("BNE", "rel", 0xd0);
define("CMP", "iny", 0xd1); define("CMP", "zpx", 0xd5); define("DEC", "zpx", 0xd6);
define("CLD", "imp", 0xd8); define("CMP", "aby", 0xd9); define("CMP", "abx", 0xdd);
define("DEC", "abx", 0xde); define("CPX", "imm", 0xe0); define("SBC", "inx", 0xe1);
define("CPX", "zp", 0xe4); define("SBC", "zp", 0xe5); define("INC", "zp", 0xe6);
define("INX", "imp", 0xe8); define("SBC", "imm", 0xe9); define("NOP", "imp", 0xea);
define("CPX", "abs", 0xec); define("SBC", "abs", 0xed); define("INC", "abs", 0xee);
define("BEQ", "rel", 0xf0); define("SBC", "iny", 0xf1); define("SBC", "zpx", 0xf5);
define("INC", "zpx", 0xf6); define("SED", "imp", 0xf8); define("SBC", "aby", 0xf9);
define("SBC", "abx", 0xfd); define("INC", "abx", 0xfe);

const READ_OPS = new Set(["ORA", "AND", "EOR", "ADC", "LDA", "LDX", "LDY", "CMP", "CPX", "CPY", "BIT", "SBC"]);
const WRITE_OPS = new Set(["STA", "STX", "STY"]);
const RMW_OPS = new Set(["ASL", "ROL", "LSR", "ROR", "DEC", "INC"]);
const MODE_LENGTH = { imp: 1, acc: 1, brk: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, inx: 2, iny: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };

/** A cycle-stepped NMOS MOS 6502 implementing all 151 documented opcodes. */
export class M6502 {
  constructor({ bus, traceLimit = 256 } = {}) {
    if (!bus || typeof bus.read8 !== "function" || typeof bus.write8 !== "function") {
      throw new TypeError("M6502 requires a bus with read8() and write8()");
    }
    this.bus = bus;
    this.traceLimit = traceLimit;
    this.trace = [];
    this.microOps = [];
    this.irqLine = false;
    this.nmiPending = false;
    this.reset();
  }

  reset() {
    this.a = 0; this.x = 0; this.y = 0; this.sp = 0xfd; this.pc = 0;
    this.p = FLAG_U | FLAG_I; this.cycles = 0; this.currentOpcode = null;
    this.currentInstructionAddress = null; this.instructionBoundary = false;
    this.brkSeen = false; this.microOps = []; this.trace = []; this.nmiPending = false;
    let low = 0;
    this.#queue(
      () => this.#read(this.pc, { kind: "reset-dummy" }),
      () => this.#read(this.pc, { kind: "reset-dummy" }),
      () => this.#read(0x0100 | this.sp, { kind: "reset-stack" }),
      () => { const c = this.#read(0x0100 | this.sp, { kind: "reset-stack" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "reset-stack" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { low = this.bus.read8(0xfffc); return this.#record({ address: 0xfffc, operation: "read", data: low, kind: "reset-vector-low" }); },
      () => { const high = this.bus.read8(0xfffd); this.pc = low | (high << 8); return this.#record({ address: 0xfffd, operation: "read", data: high, kind: "reset-vector-high" }); },
    );
  }

  setIrq(level = true) { this.irqLine = Boolean(level); }
  requestNmi() { this.nmiPending = true; }

  clock() {
    if (this.microOps.length === 0 && (this.nmiPending || (this.irqLine && !this.#flag(FLAG_I)))) {
      const nmi = this.nmiPending;
      this.nmiPending = false;
      this.currentOpcode = null;
      this.currentInstructionAddress = this.pc;
      this.instructionBoundary = false;
      this.#interrupt(nmi ? 0xfffa : 0xfffe, nmi ? "nmi" : "irq");
    }
    if (this.microOps.length > 0) {
      const cycle = this.microOps.shift()();
      if (this.microOps.length === 0) this.instructionBoundary = true;
      return cycle;
    }
    this.instructionBoundary = false;
    this.currentInstructionAddress = this.pc;
    const opcode = this.bus.read8(this.pc);
    this.currentOpcode = opcode;
    const cycle = this.#record({ address: this.pc, operation: "read", data: opcode, kind: "opcode-fetch", sync: true });
    this.pc = (this.pc + 1) & 0xffff;
    this.#decode(opcode);
    if (this.microOps.length === 0) this.instructionBoundary = true;
    return cycle;
  }

  step(maxCycles = 32) {
    let consumed = 0;
    do { this.clock(); consumed += 1; if (consumed > maxCycles) throw new Error(`instruction exceeded ${maxCycles} cycles`); }
    while (!this.instructionBoundary);
    return consumed;
  }

  run({ maxInstructions = 100000, stopOnBrk = true } = {}) {
    let instructions = 0;
    while (instructions < maxInstructions) {
      this.step(); instructions += 1;
      if (stopOnBrk && this.currentOpcode === 0x00) break;
    }
    return instructions;
  }

  getState() {
    return {
      a: this.a, x: this.x, y: this.y, sp: this.sp, pc: this.pc, p: this.p,
      cycles: this.cycles, currentOpcode: this.currentOpcode,
      currentInstructionAddress: this.currentInstructionAddress,
      instructionBoundary: this.instructionBoundary, brkSeen: this.brkSeen,
      irqLine: this.irqLine, nmiPending: this.nmiPending,
      flags: { n: this.#flag(FLAG_N), v: this.#flag(FLAG_V), d: this.#flag(FLAG_D), i: this.#flag(FLAG_I), z: this.#flag(FLAG_Z), c: this.#flag(FLAG_C) },
    };
  }

  saveState() {
    if (!this.instructionBoundary) throw new Error("CPU state can only be saved at an instruction boundary");
    return { version: 1, ...this.getState(), trace: this.trace.map((entry) => ({ ...entry })) };
  }

  loadState(state) {
    if (!state || state.version !== 1) throw new TypeError("unsupported CPU state");
    for (const name of ["a", "x", "y", "sp", "p"]) this[name] = Number(state[name]) & 0xff;
    this.pc = Number(state.pc) & 0xffff;
    this.p = (this.p | FLAG_U) & ~FLAG_B;
    this.cycles = Number(state.cycles) >>> 0;
    this.currentOpcode = state.currentOpcode == null ? null : Number(state.currentOpcode) & 0xff;
    this.currentInstructionAddress = state.currentInstructionAddress == null ? null : Number(state.currentInstructionAddress) & 0xffff;
    this.instructionBoundary = true; this.brkSeen = Boolean(state.brkSeen);
    this.irqLine = Boolean(state.irqLine); this.nmiPending = Boolean(state.nmiPending);
    this.microOps = [];
    this.trace = Array.isArray(state.trace) ? state.trace.slice(-this.traceLimit).map((entry) => ({ ...entry })) : [];
  }

  disassemble(address = this.pc) {
    const opcode = this.bus.read8(address);
    const spec = OPCODES[opcode];
    if (!spec) return { address, opcode, text: `DB $${hex(opcode)}`, length: 1 };
    const operand = this.bus.read8((address + 1) & 0xffff);
    const absolute = operand | (this.bus.read8((address + 2) & 0xffff) << 8);
    const forms = {
      imp: spec.mnemonic, brk: spec.mnemonic, acc: `${spec.mnemonic} A`, imm: `${spec.mnemonic} #$${hex(operand)}`,
      zp: `${spec.mnemonic} $${hex(operand)}`, zpx: `${spec.mnemonic} $${hex(operand)},X`, zpy: `${spec.mnemonic} $${hex(operand)},Y`,
      abs: `${spec.mnemonic} $${hex(absolute, 4)}`, abx: `${spec.mnemonic} $${hex(absolute, 4)},X`, aby: `${spec.mnemonic} $${hex(absolute, 4)},Y`,
      ind: `${spec.mnemonic} ($${hex(absolute, 4)})`, inx: `${spec.mnemonic} ($${hex(operand)},X)`, iny: `${spec.mnemonic} ($${hex(operand)}),Y`,
      rel: `${spec.mnemonic} $${hex((address + 2 + signed(operand)) & 0xffff, 4)}`,
    };
    return { address, opcode, text: forms[spec.mode], length: MODE_LENGTH[spec.mode] };
  }

  #decode(opcode) {
    const spec = OPCODES[opcode];
    if (!spec) throw new Error(`Unsupported opcode $${hex(opcode)} at $${hex(this.currentInstructionAddress, 4)} (undocumented NMOS opcode)`);
    const { mnemonic, mode } = spec;
    if (READ_OPS.has(mnemonic)) return this.#readOperand(mode, mnemonic, (value) => this.#applyRead(mnemonic, value));
    if (WRITE_OPS.has(mnemonic)) return this.#writeOperand(mode, mnemonic, () => this[mnemonic === "STA" ? "a" : mnemonic === "STX" ? "x" : "y"]);
    if (RMW_OPS.has(mnemonic)) {
      if (mode === "acc") return this.#implied(() => { this.a = this.#applyRmw(mnemonic, this.a); }, mnemonic);
      return this.#rmwOperand(mode, mnemonic, (value) => this.#applyRmw(mnemonic, value));
    }
    if (mode === "rel") return this.#branch(mnemonic);
    switch (mnemonic) {
      case "BRK": return this.#brk(); case "JSR": return this.#jsr(); case "JMP": return mode === "ind" ? this.#jmpIndirect() : this.#jmpAbsolute();
      case "RTS": return this.#rts(); case "RTI": return this.#rti(); case "PHA": return this.#push(() => this.a, "PHA");
      case "PHP": return this.#push(() => this.p | FLAG_B | FLAG_U, "PHP"); case "PLA": return this.#pull((v) => { this.a = v; this.#setNZ(v); }, "PLA");
      case "PLP": return this.#pull((v) => { this.p = (v | FLAG_U) & ~FLAG_B; }, "PLP");
      default: return this.#implied(() => this.#applyImplied(mnemonic), mnemonic);
    }
  }

  #applyRead(mnemonic, value) {
    switch (mnemonic) {
      case "ORA": this.a |= value; this.#setNZ(this.a); break;
      case "AND": this.a &= value; this.#setNZ(this.a); break;
      case "EOR": this.a ^= value; this.#setNZ(this.a); break;
      case "ADC": this.#adc(value); break; case "SBC": this.#sbc(value); break;
      case "LDA": this.a = value; this.#setNZ(value); break; case "LDX": this.x = value; this.#setNZ(value); break; case "LDY": this.y = value; this.#setNZ(value); break;
      case "CMP": this.#compare(this.a, value); break; case "CPX": this.#compare(this.x, value); break; case "CPY": this.#compare(this.y, value); break;
      case "BIT": this.#setFlag(FLAG_Z, (this.a & value) === 0); this.#setFlag(FLAG_N, value & 0x80); this.#setFlag(FLAG_V, value & 0x40); break;
    }
    this.a &= 0xff;
  }

  #applyRmw(mnemonic, value) {
    let result;
    switch (mnemonic) {
      case "ASL": this.#setFlag(FLAG_C, value & 0x80); result = value << 1; break;
      case "LSR": this.#setFlag(FLAG_C, value & 1); result = value >>> 1; break;
      case "ROL": { const carry = this.#flag(FLAG_C) ? 1 : 0; this.#setFlag(FLAG_C, value & 0x80); result = (value << 1) | carry; break; }
      case "ROR": { const carry = this.#flag(FLAG_C) ? 0x80 : 0; this.#setFlag(FLAG_C, value & 1); result = (value >>> 1) | carry; break; }
      case "DEC": result = value - 1; break; case "INC": result = value + 1; break;
    }
    result &= 0xff; this.#setNZ(result); return result;
  }

  #applyImplied(mnemonic) {
    switch (mnemonic) {
      case "CLC": this.#setFlag(FLAG_C, false); break; case "SEC": this.#setFlag(FLAG_C, true); break;
      case "CLI": this.#setFlag(FLAG_I, false); break; case "SEI": this.#setFlag(FLAG_I, true); break;
      case "CLV": this.#setFlag(FLAG_V, false); break; case "CLD": this.#setFlag(FLAG_D, false); break; case "SED": this.#setFlag(FLAG_D, true); break;
      case "TAX": this.x = this.a; this.#setNZ(this.x); break; case "TAY": this.y = this.a; this.#setNZ(this.y); break;
      case "TXA": this.a = this.x; this.#setNZ(this.a); break; case "TYA": this.a = this.y; this.#setNZ(this.a); break;
      case "TSX": this.x = this.sp; this.#setNZ(this.x); break; case "TXS": this.sp = this.x; break;
      case "DEX": this.x = (this.x - 1) & 0xff; this.#setNZ(this.x); break; case "DEY": this.y = (this.y - 1) & 0xff; this.#setNZ(this.y); break;
      case "INX": this.x = (this.x + 1) & 0xff; this.#setNZ(this.x); break; case "INY": this.y = (this.y + 1) & 0xff; this.#setNZ(this.y); break;
    }
  }

  #adc(value) {
    const carry = this.#flag(FLAG_C) ? 1 : 0;
    const binary = this.a + value + carry;
    const binaryResult = binary & 0xff;
    if (this.#flag(FLAG_D)) {
      let low = (this.a & 0x0f) + (value & 0x0f) + carry;
      if (low > 9) low += 6;
      let high = (this.a >> 4) + (value >> 4) + (low > 0x0f ? 1 : 0);
      this.#setFlag(FLAG_Z, binaryResult === 0);
      this.#setFlag(FLAG_N, high & 0x08);
      this.#setFlag(FLAG_V, (~(this.a ^ value) & (this.a ^ (high << 4)) & 0x80) !== 0);
      if (high > 9) high += 6;
      this.#setFlag(FLAG_C, high > 0x0f);
      this.a = ((high << 4) | (low & 0x0f)) & 0xff;
    } else {
      this.#setFlag(FLAG_V, (~(this.a ^ value) & (this.a ^ binaryResult) & 0x80) !== 0);
      this.#setNZ(binaryResult);
      this.#setFlag(FLAG_C, binary > 0xff);
      this.a = binaryResult;
    }
  }

  #sbc(value) {
    const carry = this.#flag(FLAG_C) ? 1 : 0;
    const difference = this.a - value - (1 - carry);
    const binaryResult = difference & 0xff;
    this.#setFlag(FLAG_V, ((this.a ^ binaryResult) & (this.a ^ value) & 0x80) !== 0);
    this.#setNZ(binaryResult); this.#setFlag(FLAG_C, difference >= 0);
    if (this.#flag(FLAG_D)) {
      let low = (this.a & 0x0f) - (value & 0x0f) - (1 - carry);
      let high = (this.a >> 4) - (value >> 4);
      if (low < 0) { low -= 6; high -= 1; }
      if (high < 0) high -= 6;
      this.a = ((high << 4) | (low & 0x0f)) & 0xff;
    } else this.a = binaryResult;
  }

  #readOperand(mode, mnemonic, apply) {
    if (mode === "imm") return this.#fetchByte((value) => apply(value), "operand", mnemonic);
    this.#address(mode, mnemonic, false, (address) => this.#queue(() => { const c = this.#read(address, { kind: "data-read", mnemonic }); apply(c.data); return c; }));
  }

  #writeOperand(mode, mnemonic, getValue) {
    this.#address(mode, mnemonic, true, (address) => this.#queue(() => this.#write(address, getValue(), { kind: "data-write", mnemonic })));
  }

  #rmwOperand(mode, mnemonic, apply) {
    this.#address(mode, mnemonic, true, (address) => {
      let oldValue = 0; let newValue = 0;
      this.#queue(
        () => { const c = this.#read(address, { kind: "rmw-read", mnemonic }); oldValue = c.data; newValue = apply(oldValue); return c; },
        () => this.#write(address, oldValue, { kind: "rmw-dummy-write", mnemonic }),
        () => this.#write(address, newValue, { kind: "rmw-write", mnemonic }),
      );
    });
  }

  #address(mode, mnemonic, write, ready) {
    let low = 0; let pointer = 0;
    if (mode === "zp") return this.#fetchByte((value) => ready(value), "address-zp", mnemonic);
    if (mode === "zpx" || mode === "zpy") {
      return this.#fetchByte((value) => { const index = mode === "zpx" ? this.x : this.y; this.#queue(() => { const c = this.#read(value, { kind: "indexed-dummy", mnemonic }); ready((value + index) & 0xff); return c; }); }, "address-zp", mnemonic);
    }
    if (mode === "abs") {
      this.#fetchByte((value) => { low = value; this.#fetchByte((high) => ready(low | (high << 8)), "address-high", mnemonic); }, "address-low", mnemonic); return;
    }
    if (mode === "abx" || mode === "aby") {
      this.#fetchByte((value) => { low = value; this.#fetchByte((high) => {
        const base = low | (high << 8); const index = mode === "abx" ? this.x : this.y; const address = (base + index) & 0xffff;
        if (write || (base & 0xff00) !== (address & 0xff00)) this.#queue(() => this.#read((base & 0xff00) | (address & 0xff), { kind: "indexed-dummy", mnemonic }));
        ready(address);
      }, "address-high", mnemonic); }, "address-low", mnemonic); return;
    }
    if (mode === "inx") {
      this.#fetchByte((value) => { pointer = value; this.#queue(
        () => this.#read(pointer, { kind: "indexed-dummy", mnemonic }),
        () => { const address = (pointer + this.x) & 0xff; low = this.bus.read8(address); return this.#record({ address, operation: "read", data: low, kind: "pointer-low", mnemonic }); },
        () => { const address = (pointer + this.x + 1) & 0xff; const high = this.bus.read8(address); ready(low | (high << 8)); return this.#record({ address, operation: "read", data: high, kind: "pointer-high", mnemonic }); },
      ); }, "pointer", mnemonic); return;
    }
    if (mode === "iny") {
      this.#fetchByte((value) => { pointer = value; this.#queue(
        () => { low = this.bus.read8(pointer); return this.#record({ address: pointer, operation: "read", data: low, kind: "pointer-low", mnemonic }); },
        () => { const zp = (pointer + 1) & 0xff; const high = this.bus.read8(zp); const base = low | (high << 8); const address = (base + this.y) & 0xffff;
          if (write || (base & 0xff00) !== (address & 0xff00)) this.#queue(() => this.#read((base & 0xff00) | (address & 0xff), { kind: "indexed-dummy", mnemonic }));
          ready(address); return this.#record({ address: zp, operation: "read", data: high, kind: "pointer-high", mnemonic }); },
      ); }, "pointer", mnemonic);
    }
  }

  #fetchByte(apply, kind, mnemonic) {
    this.#queue(() => { const address = this.pc; const value = this.bus.read8(address); this.pc = (this.pc + 1) & 0xffff; apply(value); return this.#record({ address, operation: "read", data: value, kind, mnemonic }); });
  }

  #implied(apply, mnemonic) { this.#queue(() => { const c = this.#read(this.pc, { kind: "implied-dummy", mnemonic }); apply(); return c; }); }

  #branch(mnemonic) {
    const conditions = { BPL: () => !this.#flag(FLAG_N), BMI: () => this.#flag(FLAG_N), BVC: () => !this.#flag(FLAG_V), BVS: () => this.#flag(FLAG_V), BCC: () => !this.#flag(FLAG_C), BCS: () => this.#flag(FLAG_C), BNE: () => !this.#flag(FLAG_Z), BEQ: () => this.#flag(FLAG_Z) };
    this.#fetchByte((raw) => {
      if (!conditions[mnemonic]()) return;
      const oldPc = this.pc; const target = (oldPc + signed(raw)) & 0xffff;
      this.#queue(() => { const c = this.#read(oldPc, { kind: "branch-taken", mnemonic }); this.pc = target;
        if ((oldPc & 0xff00) !== (target & 0xff00)) this.#queue(() => this.#read((oldPc & 0xff00) | (target & 0xff), { kind: "branch-page-cross", mnemonic })); return c; });
    }, "branch-offset", mnemonic);
  }

  #push(getValue, mnemonic) {
    this.#queue(
      () => this.#read(this.pc, { kind: "implied-dummy", mnemonic }),
      () => { const c = this.#write(0x0100 | this.sp, getValue(), { kind: "stack-write", mnemonic }); this.sp = (this.sp - 1) & 0xff; return c; },
    );
  }

  #pull(apply, mnemonic) {
    this.#queue(
      () => this.#read(this.pc, { kind: "implied-dummy", mnemonic }),
      () => { this.sp = (this.sp + 1) & 0xff; return this.#read(0x0100 | ((this.sp - 1) & 0xff), { kind: "stack-dummy", mnemonic }); },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read", mnemonic }); apply(c.data); return c; },
    );
  }

  #jsr() {
    let low = 0;
    this.#queue(
      () => { const c = this.#read(this.pc, { kind: "address-low", mnemonic: "JSR" }); low = c.data; this.pc = (this.pc + 1) & 0xffff; return c; },
      () => this.#read(0x0100 | this.sp, { kind: "stack-dummy", mnemonic: "JSR" }),
      () => { const c = this.#write(0x0100 | this.sp, this.pc >> 8, { kind: "stack-write-pch", mnemonic: "JSR" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { const c = this.#write(0x0100 | this.sp, this.pc, { kind: "stack-write-pcl", mnemonic: "JSR" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { const c = this.#read(this.pc, { kind: "address-high", mnemonic: "JSR" }); this.pc = low | (c.data << 8); return c; },
    );
  }

  #rts() {
    let low = 0;
    this.#queue(
      () => this.#read(this.pc, { kind: "implied-dummy", mnemonic: "RTS" }),
      () => { this.sp = (this.sp + 1) & 0xff; return this.#read(0x0100 | ((this.sp - 1) & 0xff), { kind: "stack-dummy", mnemonic: "RTS" }); },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read-pcl", mnemonic: "RTS" }); low = c.data; this.sp = (this.sp + 1) & 0xff; return c; },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read-pch", mnemonic: "RTS" }); this.pc = low | (c.data << 8); return c; },
      () => { const c = this.#read(this.pc, { kind: "return-dummy", mnemonic: "RTS" }); this.pc = (this.pc + 1) & 0xffff; return c; },
    );
  }

  #rti() {
    let low = 0;
    this.#queue(
      () => this.#read(this.pc, { kind: "implied-dummy", mnemonic: "RTI" }),
      () => { this.sp = (this.sp + 1) & 0xff; return this.#read(0x0100 | ((this.sp - 1) & 0xff), { kind: "stack-dummy", mnemonic: "RTI" }); },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read-p", mnemonic: "RTI" }); this.p = (c.data | FLAG_U) & ~FLAG_B; this.sp = (this.sp + 1) & 0xff; return c; },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read-pcl", mnemonic: "RTI" }); low = c.data; this.sp = (this.sp + 1) & 0xff; return c; },
      () => { const c = this.#read(0x0100 | this.sp, { kind: "stack-read-pch", mnemonic: "RTI" }); this.pc = low | (c.data << 8); return c; },
    );
  }

  #jmpAbsolute() { let low = 0; this.#fetchByte((v) => { low = v; this.#fetchByte((high) => { this.pc = low | (high << 8); }, "address-high", "JMP"); }, "address-low", "JMP"); }
  #jmpIndirect() {
    let pointerLow = 0; let pointer = 0; let targetLow = 0;
    this.#fetchByte((v) => { pointerLow = v; this.#fetchByte((high) => { pointer = pointerLow | (high << 8); this.#queue(
      () => { const c = this.#read(pointer, { kind: "pointer-low", mnemonic: "JMP" }); targetLow = c.data; return c; },
      () => { const wrapped = (pointer & 0xff00) | ((pointer + 1) & 0xff); const c = this.#read(wrapped, { kind: "pointer-high", mnemonic: "JMP" }); this.pc = targetLow | (c.data << 8); return c; },
    ); }, "address-high", "JMP"); }, "address-low", "JMP");
  }

  #brk() { this.brkSeen = true; this.#interrupt(0xfffe, "brk", true); }
  #interrupt(vector, kind, brk = false) {
    let low = 0;
    this.#queue(
      () => { const c = this.#read(this.pc, { kind: `${kind}-dummy` }); if (brk) this.pc = (this.pc + 1) & 0xffff; return c; },
      ...(!brk ? [() => this.#read(this.pc, { kind: `${kind}-dummy` })] : []),
      () => { const c = this.#write(0x0100 | this.sp, this.pc >> 8, { kind: "stack-write-pch" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { const c = this.#write(0x0100 | this.sp, this.pc, { kind: "stack-write-pcl" }); this.sp = (this.sp - 1) & 0xff; return c; },
      () => { const status = brk ? this.p | FLAG_B | FLAG_U : (this.p | FLAG_U) & ~FLAG_B; const c = this.#write(0x0100 | this.sp, status, { kind: "stack-write-p" }); this.sp = (this.sp - 1) & 0xff; this.#setFlag(FLAG_I, true); return c; },
      () => { low = this.bus.read8(vector); return this.#record({ address: vector, operation: "read", data: low, kind: `${kind}-vector-low` }); },
      () => { const high = this.bus.read8(vector + 1); this.pc = low | (high << 8); return this.#record({ address: vector + 1, operation: "read", data: high, kind: `${kind}-vector-high` }); },
    );
  }

  #compare(register, value) { const result = (register - value) & 0xff; this.#setFlag(FLAG_C, register >= value); this.#setNZ(result); }
  #setNZ(value) { this.#setFlag(FLAG_Z, (value & 0xff) === 0); this.#setFlag(FLAG_N, value & 0x80); }
  #flag(mask) { return (this.p & mask) !== 0; }
  #setFlag(mask, enabled) { if (enabled) this.p |= mask; else this.p &= ~mask; this.p |= FLAG_U; }
  #queue(...operations) { this.microOps.push(...operations); }
  #read(address, metadata = {}) { const normalized = address & 0xffff; return this.#record({ address: normalized, operation: "read", data: this.bus.read8(normalized), ...metadata }); }
  #write(address, value, metadata = {}) { const normalized = address & 0xffff; const data = value & 0xff; this.bus.write8(normalized, data); return this.#record({ address: normalized, operation: "write", data, ...metadata }); }
  #record(cycle) {
    const entry = { cycle: this.cycles, address: cycle.address & 0xffff, operation: cycle.operation, data: cycle.data & 0xff, kind: cycle.kind ?? "bus", sync: Boolean(cycle.sync), mnemonic: cycle.mnemonic ?? null };
    this.cycles += 1; this.trace.push(entry); if (this.trace.length > this.traceLimit) this.trace.splice(0, this.trace.length - this.traceLimit); return entry;
  }
}

export const M6502_FLAGS = Object.freeze({ C: FLAG_C, Z: FLAG_Z, I: FLAG_I, D: FLAG_D, B: FLAG_B, U: FLAG_U, V: FLAG_V, N: FLAG_N });
export const M6502_LEGAL_OPCODES = Object.freeze(OPCODES.map((entry) => entry ?? null));
