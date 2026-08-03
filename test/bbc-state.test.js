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
  assert.throws(() => machine.importState({ ...BBC_STATE_FORMAT, version: 3 }), /unsupported BBC state file/);
});

test("BBC state v2 preserves two drive formats and migrates v1 SSD state", () => {
  const machine = new BbcMicroModelB();
  machine.step();
  machine.mountDsd(new Uint8Array(40 * 2 * 10 * 256), { drive: 0 });
  machine.mountSsd(new Uint8Array(40 * 10 * 256), { drive: 1, writeProtected: true });
  const portable = JSON.parse(JSON.stringify(machine.exportState()));
  const restored = new BbcMicroModelB().importState(portable);
  assert.equal(restored.bus.devices.fdc.drives[0].disk.format, "dsd");
  assert.equal(restored.bus.devices.fdc.drives[1].disk.format, "ssd");
  assert.equal(restored.bus.devices.fdc.drives[1].writeProtected, true);

  const v1 = { ...portable, version: 1, devices: { ...portable.devices, fdc: { ...portable.devices.fdc, currentTrack: 7, disk: { bytes: portable.devices.fdc.drives[1].disk.bytes, dirty: true } } } };
  const migrated = new BbcMicroModelB().importState(v1);
  assert.equal(migrated.bus.devices.fdc.currentTrack, 7); assert.equal(migrated.bus.devices.fdc.disk.format, "ssd"); assert.equal(migrated.bus.devices.fdc.disk.dirty, true);
});

test("BBC state v2 resumes an active side-aware FDC transfer", () => {
  const machine = new BbcMicroModelB(); machine.step();
  const source = new Uint8Array(40 * 2 * 10 * 256); source.fill(0x5a, 10 * 256, 11 * 256);
  machine.mountDsd(source);
  const fdc = machine.bus.devices.fdc; fdc.write(0, 0x93); fdc.write(1, 0); fdc.write(1, 0); fdc.write(1, 0x21);
  fdc.tick(20); assert.equal(fdc.read(4), 0x5a); fdc.tick(21); assert.equal(fdc.read(4), 0x5a);
  const restored = new BbcMicroModelB().importState(JSON.parse(JSON.stringify(machine.exportState())));
  assert.equal(restored.bus.devices.fdc.transfer.drive, 0); assert.equal(restored.bus.devices.fdc.transfer.side, 1); assert.equal(restored.bus.devices.fdc.transfer.index, 2);
  for (let index = 2; index < 256; index += 1) { assert.equal(restored.bus.devices.fdc.tick(20 + index), true); assert.equal(restored.bus.devices.fdc.read(4), 0x5a); }
  assert.equal(restored.bus.devices.fdc.read(1), 0);
});
