import assert from "node:assert/strict";
import test from "node:test";
import { createVectorMachine, runProcessorVector } from "../scripts/processor-vectors.js";

test("processor vector importer validates state, memory and ordered cycles", () => {
  const vector = {
    name: "a9 cc 21",
    initial: { pc: 45930, s: 172, a: 67, x: 145, y: 150, p: 237, ram: [[45930, 169], [45931, 204], [45932, 33]] },
    final: { pc: 45932, s: 172, a: 204, x: 145, y: 150, p: 237, ram: [[45930, 169], [45931, 204], [45932, 33]] },
    cycles: [[45930, 169, "read"], [45931, 204, "read"]],
  };
  const result = runProcessorVector(createVectorMachine(), vector);
  assert.equal(result.passed, true, result.failures.join("\n"));
});

test("processor vector importer reports ordered-cycle mismatches", () => {
  const vector = {
    name: "a9 cc 21",
    initial: { pc: 45930, s: 172, a: 67, x: 145, y: 150, p: 237, ram: [[45930, 169], [45931, 204], [45932, 33]] },
    final: { pc: 45932, s: 172, a: 204, x: 145, y: 150, p: 237, ram: [[45930, 169], [45931, 204], [45932, 33]] },
    cycles: [[45930, 169, "read"], [45931, 0, "read"]],
  };
  const result = runProcessorVector(createVectorMachine(), vector);
  assert.equal(result.passed, false);
  assert.match(result.failures.join("\n"), /cycle 2: expected read \$B36B = \$00, got read \$B36B = \$CC/);
});
