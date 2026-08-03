import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createVectorMachine, formatVectorFailure, loadProcessorVectors, runProcessorVector } from "./processor-vectors.js";

const args = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args.splice(limitIndex, 2)[1]) : Infinity;
if (args.length !== 1 || (!Number.isFinite(limit) && limit !== Infinity) || limit <= 0) {
  throw new Error("usage: node scripts/run-bus-vectors.js <file-or-directory> [--limit count]");
}

const input = resolve(args[0]);
let files;
if (input.endsWith(".json")) {
  files = [input];
} else {
  files = (await readdir(input)).filter((name) => /^[0-9a-f]{2}\.json$/i.test(name)).sort().map((name) => resolve(input, name));
}
if (files.length === 0) throw new Error(`no opcode JSON files found in ${input}`);

const machine = createVectorMachine();
let passed = 0;
for (const file of files) {
  const vectors = await loadProcessorVectors(file);
  const selected = vectors.slice(0, limit);
  for (const vector of selected) {
    const result = runProcessorVector(machine, vector);
    if (!result.passed) throw new Error(`${basename(file)}: ${formatVectorFailure(vector, result)}`);
    passed += 1;
  }
  console.log(`${basename(file)}: ${selected.length.toLocaleString()} passed`);
}
console.log(`Ordered-bus vectors passed: ${passed.toLocaleString()} scenarios across ${files.length} opcode file${files.length === 1 ? "" : "s"}.`);
