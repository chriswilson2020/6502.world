import assert from "node:assert/strict";
import test from "node:test";
import { runAcornCpmWriteGate } from "../scripts/run-acorn-cpm-write.js";

test("CP/M hardware writes survive warm boot and export without mutating source media", { timeout: 90_000 }, async () => {
  const result = await runAcornCpmWriteGate();
  assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.ok(result.writeTransfers > 0);
  assert.equal(result.warmBootPreserved, true); assert.equal(result.exportRemountPreserved, true); assert.equal(result.resetOriginalRemoved, true); assert.equal(result.originalHash, result.originalHashAfter);
});
