import assert from "node:assert/strict";
import test from "node:test";
import { FlatMemory } from "../src/bus/flat-memory.js";
import { M6502, M6502_FLAGS, M6502_LEGAL_OPCODES } from "../src/cpu/m6502.js";

function makeCpu(program, { start = 0x0600, irq = 0x0800, nmi = 0x0900 } = {}) {
  const memory = new FlatMemory();
  memory.load(program, start);
  memory.write16(0xfffc, start);
  memory.write16(0xfffe, irq);
  memory.write16(0xfffa, nmi);
  const cpu = new M6502({ bus: memory, traceLimit: 1024 });
  while (!cpu.instructionBoundary) cpu.clock();
  return { cpu, memory };
}

test("opcode table contains all 151 documented NMOS opcodes", () => {
  assert.equal(M6502_LEGAL_OPCODES.filter(Boolean).length, 151);
  for (const [opcode, spec] of M6502_LEGAL_OPCODES.entries()) {
    if (!spec) continue;
    const { cpu } = makeCpu([opcode, 0x00, 0x06]);
    assert.doesNotThrow(() => cpu.step(), `${spec.mnemonic} opcode $${opcode.toString(16)}`);
  }
});

test("load and store addressing modes wrap zero page and cross pages", () => {
  const { cpu, memory } = makeCpu([
    0xa2, 0x02,       // LDX #$02
    0xa0, 0x01,       // LDY #$01
    0xa9, 0x42,       // LDA #$42
    0x95, 0xfe,       // STA $FE,X -> $00
    0xbd, 0xff, 0x06, // LDA $06FF,X -> $0701
    0x91, 0x10,       // STA ($10),Y
  ]);
  memory.write8(0x0701, 0x7e);
  memory.write16(0x0010, 0x20ff);
  for (let index = 0; index < 6; index += 1) cpu.step();
  assert.equal(memory.read8(0x0000), 0x42);
  assert.equal(cpu.a, 0x7e);
  assert.equal(memory.read8(0x2100), 0x7e);
  assert.ok(cpu.trace.some((cycle) => cycle.kind === "indexed-dummy"));
});

test("binary ALU, shifts, rotates, BIT and comparisons update flags", () => {
  const { cpu, memory } = makeCpu([
    0xa9, 0x40, 0x69, 0x40, // LDA #$40; ADC #$40 -> $80, overflow
    0x2c, 0x00, 0x02,       // BIT $0200
    0x0a, 0x6a,             // ASL A; ROR A
    0xc9, 0x80,             // CMP #$80
    0x38, 0xe9, 0x01,       // SEC; SBC #$01
  ]);
  memory.write8(0x0200, 0xc0);
  cpu.step(); cpu.step();
  assert.equal(cpu.a, 0x80);
  assert.ok(cpu.p & M6502_FLAGS.V);
  cpu.step();
  assert.ok(cpu.p & M6502_FLAGS.N);
  assert.ok(cpu.p & M6502_FLAGS.V);
  cpu.step(); cpu.step(); cpu.step();
  assert.ok(cpu.p & M6502_FLAGS.C);
  cpu.step(); cpu.step();
  assert.equal(cpu.a, 0x7f);
  assert.equal(cpu.p & M6502_FLAGS.N, 0);
});

test("NMOS decimal ADC and SBC produce packed BCD results", () => {
  const { cpu } = makeCpu([
    0xf8,             // SED
    0x18,             // CLC
    0xa9, 0x45,
    0x69, 0x55,       // 45 + 55 = 00 carry
    0x38,             // SEC
    0xe9, 0x01,       // 00 - 01 = 99 no carry
  ]);
  cpu.step(); cpu.step(); cpu.step(); cpu.step();
  assert.equal(cpu.a, 0x00);
  assert.ok(cpu.p & M6502_FLAGS.C);
  cpu.step(); cpu.step();
  assert.equal(cpu.a, 0x99);
  assert.equal(cpu.p & M6502_FLAGS.C, 0);
});

test("stack operations and JSR/RTS preserve values and return address", () => {
  const { cpu, memory } = makeCpu([
    0xa9, 0x5a,       // LDA #$5A
    0x48,             // PHA
    0xa9, 0x00,       // LDA #$00
    0x68,             // PLA
    0x20, 0x0a, 0x06, // JSR $060A
    0xea,             // NOP (return target)
    0xe8,             // $060A INX
    0x60,             // RTS
  ]);
  cpu.step(); cpu.step(); cpu.step(); cpu.step();
  assert.equal(cpu.a, 0x5a);
  assert.equal(cpu.sp, 0xfb);
  cpu.step();
  assert.equal(cpu.pc, 0x060a);
  cpu.step(); cpu.step();
  assert.equal(cpu.x, 1);
  assert.equal(cpu.pc, 0x0609);
  assert.equal(cpu.sp, 0xfb);
  assert.equal(memory.read8(0x01fb), 0x06);
  assert.equal(memory.read8(0x01fa), 0x08);
});

test("JMP indirect reproduces the NMOS page-wrap hardware behavior", () => {
  const { cpu, memory } = makeCpu([0x6c, 0xff, 0x20]);
  memory.write8(0x20ff, 0x34);
  memory.write8(0x2000, 0x12);
  memory.write8(0x2100, 0x99);
  cpu.step();
  assert.equal(cpu.pc, 0x1234);
});

test("IRQ and NMI push state, select vectors, and RTI restores execution", () => {
  const { cpu, memory } = makeCpu([0x58, 0xea, 0xea]);
  memory.load([0x40], 0x0800);
  memory.load([0x40], 0x0900);
  cpu.step(); // CLI
  cpu.setIrq(true);
  const irqTraceStart = cpu.trace.length;
  assert.equal(cpu.step(), 7);
  assert.equal(cpu.pc, 0x0800);
  assert.equal(memory.read8(0x01fb) & M6502_FLAGS.B, 0);
  assert.deepEqual(cpu.trace.slice(irqTraceStart).map(({ address, operation }) => [address, operation]), [
    [0x0601, "read"], [0x0601, "read"],
    [0x01fb, "write"], [0x01fa, "write"], [0x01f9, "write"],
    [0xfffe, "read"], [0xffff, "read"],
  ]);
  cpu.setIrq(false);
  cpu.step(); // RTI
  assert.equal(cpu.pc, 0x0601);
  cpu.requestNmi();
  const nmiTraceStart = cpu.trace.length;
  assert.equal(cpu.step(), 7);
  assert.equal(cpu.pc, 0x0900);
  assert.deepEqual(cpu.trace.slice(nmiTraceStart).map(({ address, operation }) => [address, operation]), [
    [0x0601, "read"], [0x0601, "read"],
    [0x01fb, "write"], [0x01fa, "write"], [0x01f9, "write"],
    [0xfffa, "read"], [0xfffb, "read"],
  ]);
});

test("boundary state round-trips and disassembler covers addressing syntax", () => {
  const { cpu, memory } = makeCpu([0xa9, 0x2a, 0x91, 0x10, 0xd0, 0xfc]);
  cpu.step();
  const state = cpu.saveState();
  cpu.a = 0;
  cpu.loadState(state);
  assert.equal(cpu.a, 0x2a);
  assert.equal(cpu.pc, 0x0602);
  assert.equal(cpu.disassemble(0x0600).text, "LDA #$2A");
  assert.equal(cpu.disassemble(0x0602).text, "STA ($10),Y");
  assert.equal(cpu.disassemble(0x0604).text, "BNE $0602");
  memory.write8(0x0700, 0x02);
  assert.equal(cpu.disassemble(0x0700).text, "DB $02");
});
