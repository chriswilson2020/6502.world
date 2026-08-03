import assert from "node:assert/strict";
import test from "node:test";
import { runAcornCpm } from "../scripts/run-acorn-cpm.js";

test("unmodified Acorn CP/M boots and accepts DIR and STAT through the BBC keyboard", { timeout: 30_000 }, async () => {
  const result = await runAcornCpm();
  assert.equal(result.passed, true, JSON.stringify({ reason: result.reason, screen: result.screen, fdc: result.fdc }, null, 2));
  assert.match(result.screen.join("\n"), /Acorn CP\/M 2\.2 - Bios 1\.20/);
  assert.deepEqual(result.commands.map(({ command, completed }) => [command, completed]), [["DIR", true], ["STAT", true]]);
});
