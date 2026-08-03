import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BBC_STATE_FORMAT, BbcMicroModelB } from "../src/machine/bbc/model-b.js";

test("BBC portable state round-trips machine, devices and writable media", async () => {
  const machine = new BbcMicroModelB({ traceLimit: 32, accessLogLimit: 0 });
  machine.loadSidewaysRom(15, new Uint8Array(await readFile("ROM/basic2.rom")));
  machine.loadOsRom(new Uint8Array(await readFile("ROM/os12.rom")));
  for (let instruction = 0; instruction < 200_000; instruction += 1) machine.step();
  machine.bus.ram[0x1234] = 0x56; machine.bus.devices.sound.write(0x90);
  const disk = machine.mountSsd(new Uint8Array(40 * 10 * 256)); disk.writeSector(2, 3, new Uint8Array(256).fill(0xa5));
  const uef = new Uint8Array(21); uef.set(new TextEncoder().encode("UEF File!\0")); uef[10] = 10; uef.set([0, 1, 3, 0, 0, 0, 1, 2, 3], 12);
  machine.loadUef(uef).play(); machine.cassette.readByte();

  const portable = JSON.parse(JSON.stringify(machine.exportState()));
  assert.deepEqual({ format: portable.format, version: portable.version, machine: portable.machine }, BBC_STATE_FORMAT);
  const restored = new BbcMicroModelB({ traceLimit: 32, accessLogLimit: 0 }).importState(portable);
  assert.equal(restored.cpu.pc, machine.cpu.pc); assert.equal(restored.bus.ram[0x1234], 0x56); assert.equal(restored.bus.selectedRom, machine.bus.selectedRom);
  assert.deepEqual(restored.bus.devices.sound.saveState(), machine.bus.devices.sound.saveState());
  assert.equal(restored.bus.devices.fdc.disk.dirty, true); assert.equal(restored.bus.devices.fdc.disk.readSector(2, 3)[0], 0xa5);
  assert.equal(restored.cassette.position, 1); assert.equal(restored.cassette.playing, true);
  restored.step();
});

test("BBC stable state contract rejects unknown versions", () => {
  const machine = new BbcMicroModelB();
  assert.throws(() => machine.importState({ ...BBC_STATE_FORMAT, version: 2 }), /unsupported BBC state file/);
});
