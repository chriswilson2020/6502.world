import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

test("bundled OS 1.20 boots BASIC II and accepts matrix keyboard input", async () => {
  const machine = new BbcMicroModelB({ traceLimit: 0, accessLogLimit: 0 });
  machine.loadSidewaysRom(15, new Uint8Array(await readFile("ROM/basic2.rom")));
  machine.loadOsRom(new Uint8Array(await readFile("ROM/os12.rom")));

  for (let instruction = 0; instruction < 5_000_000; instruction += 1) machine.step();
  assert.match(machine.video.textSnapshot().join("\n"), /BBC Computer 32K[\s\S]*BASIC[\s\S]*>/);

  machine.bus.keyboard.press("1:4"); // A, internal key number $41
  for (let instruction = 0; instruction < 20_000; instruction += 1) machine.step();
  machine.bus.keyboard.release("1:4");
  for (let instruction = 0; instruction < 200_000; instruction += 1) machine.step();
  assert.match(machine.video.textSnapshot().join("\n"), />A/);
});
