import assert from "node:assert/strict";
import test from "node:test";
import { runZ80TubeRom } from "../scripts/run-z80-tube-rom.js";

test("bundled Acorn Z80 Tube 1.20 ROM boots through the BBC host", async () => {
  const report = await runZ80TubeRom();
  assert.equal(report.passed, true);
  assert.match(report.transcript, /Acorn TUBE Z80 64K 1\.20/);
  assert.equal(report.tubeControl & 0x0f, 0x0f);
});
