import assert from "node:assert/strict";
import test from "node:test";
import { runAcornCpm } from "../scripts/run-acorn-cpm.js";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

test("unmodified Acorn CP/M boots and accepts DIR and STAT through the BBC keyboard", { timeout: 30_000 }, async () => {
  const result = await runAcornCpm({ returnMachine: true });
  assert.equal(result.passed, true, JSON.stringify({ reason: result.reason, screen: result.screen, fdc: result.fdc }, null, 2));
  assert.match(result.screen.join("\n"), /Acorn CP\/M 2\.2 - Bios 1\.20/);
  assert.ok(new TextEncoder().encode(result.transcript).length <= 8192);
  assert.deepEqual(result.commands.map(({ command, completed }) => [command, completed]), [["DIR", true], ["STAT", true]]);
  const state = JSON.parse(JSON.stringify(result.machine.exportState())); const restored = new BbcMicroModelB({ traceLimit: 64, accessLogLimit: 0 }).importState(state); const before = restored.parasite.cpu.tStates;
  assert.match(restored.video.textSnapshot().join("\n"), /A>/); assert.equal(restored.bus.devices.fdc.drives[0].disk.format, "dsd"); for (let index = 0; index < 1000; index += 1) restored.step(); assert.ok(restored.parasite.cpu.tStates > before);
});
