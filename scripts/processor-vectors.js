import { readFile } from "node:fs/promises";
import { FlatMemory } from "../src/bus/flat-memory.js";
import { M6502 } from "../src/cpu/m6502.js";

export async function loadProcessorVectors(path) {
  const vectors = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(vectors)) throw new TypeError(`${path} must contain a JSON array`);
  return vectors;
}

export function createVectorMachine() {
  const memory = new FlatMemory();
  const cpu = new M6502({ bus: memory, traceLimit: 32 });
  while (!cpu.instructionBoundary) cpu.clock();
  return { cpu, memory };
}

export function runProcessorVector(machine, vector) {
  const { cpu, memory } = machine;
  for (const [address, value] of vector.initial.ram) memory.write8(address, value);
  cpu.loadState({
    version: 1,
    a: vector.initial.a,
    x: vector.initial.x,
    y: vector.initial.y,
    sp: vector.initial.s,
    pc: vector.initial.pc,
    p: vector.initial.p,
    cycles: 0,
    currentOpcode: null,
    currentInstructionAddress: null,
    instructionBoundary: true,
    brkSeen: false,
    irqLine: false,
    nmiPending: false,
    trace: [],
  });

  cpu.step();
  const state = cpu.getState();
  const failures = [];
  for (const [field, actual] of [["pc", state.pc], ["s", state.sp], ["a", state.a], ["x", state.x], ["y", state.y], ["p", state.p]]) {
    if (actual !== vector.final[field]) failures.push(`${field}: expected $${hex(vector.final[field], field === "pc" ? 4 : 2)}, got $${hex(actual, field === "pc" ? 4 : 2)}`);
  }

  for (const [address, expected] of vector.final.ram) {
    const actual = memory.read8(address);
    if (actual !== expected) failures.push(`RAM $${hex(address, 4)}: expected $${hex(expected)}, got $${hex(actual)}`);
  }

  const actualCycles = cpu.trace.map(({ address, data, operation }) => [address, data, operation]);
  if (actualCycles.length !== vector.cycles.length) {
    failures.push(`cycles: expected ${vector.cycles.length}, got ${actualCycles.length}`);
  }
  const count = Math.min(actualCycles.length, vector.cycles.length);
  for (let index = 0; index < count; index += 1) {
    const expected = vector.cycles[index];
    const actual = actualCycles[index];
    if (actual[0] !== expected[0] || actual[1] !== expected[1] || actual[2] !== expected[2]) {
      failures.push(`cycle ${index + 1}: expected ${formatCycle(expected)}, got ${formatCycle(actual)}`);
    }
  }

  return { passed: failures.length === 0, failures, actualCycles };
}

export function formatVectorFailure(vector, result) {
  return `${vector.name}\n${result.failures.map((failure) => `  ${failure}`).join("\n")}`;
}

const hex = (value, width = 2) => (value >>> 0).toString(16).toUpperCase().padStart(width, "0");
const formatCycle = ([address, value, operation]) => `${operation} $${hex(address, 4)} = $${hex(value)}`;
