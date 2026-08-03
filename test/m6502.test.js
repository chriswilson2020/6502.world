import assert from "node:assert/strict";
import test from "node:test";
import { FlatMemory } from "../src/bus/flat-memory.js";
import { M6502 } from "../src/cpu/m6502.js";

function makeCpu(program, start = 0x0600) {
  const memory = new FlatMemory();
  memory.load(program, start);
  memory.write16(0xfffc, start);
  memory.write16(0xfffe, start);
  const cpu = new M6502({ bus: memory });
  return { cpu, memory };
}

function finishReset(cpu) {
  while (!cpu.instructionBoundary) cpu.clock();
}

test("reset is expressed as seven visible bus cycles", () => {
  const { cpu } = makeCpu([0xea]);
  finishReset(cpu);
  assert.equal(cpu.cycles, 7);
  assert.equal(cpu.pc, 0x0600);
  assert.equal(cpu.trace.at(-2).address, 0xfffc);
  assert.equal(cpu.trace.at(-1).address, 0xfffd);
});

test("sample loop reaches ten and writes it to $0200", () => {
  const { cpu, memory } = makeCpu([0xa2, 0x00, 0xe8, 0x8e, 0x00, 0x02, 0xe0, 0x0a, 0xd0, 0xf8, 0x00]);
  finishReset(cpu);
  const instructions = cpu.run();
  assert.equal(memory.read8(0x0200), 10);
  assert.equal(cpu.x, 10);
  assert.equal(cpu.currentOpcode, 0x00);
  assert.ok(instructions > 30);
});

test("one clock call produces one ordered trace entry", () => {
  const { cpu } = makeCpu([0xa2, 0x07]);
  finishReset(cpu);
  const before = cpu.trace.length;
  const fetch = cpu.clock();
  const operand = cpu.clock();
  assert.equal(cpu.trace.length, before + 2);
  assert.equal(fetch.kind, "opcode-fetch");
  assert.equal(fetch.sync, true);
  assert.equal(operand.kind, "operand");
  assert.equal(cpu.x, 7);
});

test("taken branches add a cycle and update the program counter", () => {
  const { cpu } = makeCpu([0xa2, 0x00, 0xe0, 0x01, 0xd0, 0x02, 0xea, 0xea, 0x00]);
  finishReset(cpu);
  cpu.step();
  cpu.step();
  const cycles = cpu.step();
  assert.equal(cycles, 3);
  assert.equal(cpu.pc, 0x0608);
});

test("unsupported opcodes fail explicitly", () => {
  const { cpu } = makeCpu([0x02]);
  finishReset(cpu);
  assert.throws(() => cpu.step(), /Unsupported opcode \$02/);
});
