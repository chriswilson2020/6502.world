import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FlatMemory } from "../src/bus/flat-memory.js";
import { M6502 } from "../src/cpu/m6502.js";

const binaryPath = process.argv[2];
if (!binaryPath) {
  throw new Error("usage: node scripts/run-functional-test.js <6502_functional_test.bin>");
}

const bytes = new Uint8Array(await readFile(resolve(binaryPath)));
if (bytes.length !== 0x10000) throw new Error("Klaus functional test image must be exactly 64K");

const memory = new FlatMemory();
memory.load(bytes);
const cpu = new M6502({ bus: memory, traceLimit: 32 });
while (!cpu.instructionBoundary) cpu.clock();
cpu.loadState({ ...cpu.saveState(), pc: 0x0400, trace: [] });

const successAddress = 0x3469;
const maxInstructions = 100_000_000;
let instructions = 0;
let loopAddress = null;

while (instructions < maxInstructions) {
  const address = cpu.pc;
  cpu.step();
  instructions += 1;
  if (cpu.pc === address) {
    loopAddress = address;
    break;
  }
}

if (loopAddress !== successAddress) {
  const location = loopAddress == null ? "instruction limit" : `$${loopAddress.toString(16).toUpperCase().padStart(4, "0")}`;
  throw new Error(`Klaus functional test failed at ${location} after ${instructions.toLocaleString()} instructions`);
}

console.log(`Klaus functional test passed at $3469 after ${instructions.toLocaleString()} instructions and ${cpu.cycles.toLocaleString()} cycles.`);
