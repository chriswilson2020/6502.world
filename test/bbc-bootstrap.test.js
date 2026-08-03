import assert from "node:assert/strict";
import test from "node:test";
import { BbcModelBBus, BBC_MODEL_B_MEMORY_MAP } from "../src/machine/bbc/model-b-bus.js";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

function syntheticOsRom() {
  const rom = new Uint8Array(0x4000).fill(0xea);
  rom.set([
    0xa9, 0x0f,       // LDA #15
    0x8d, 0x30, 0xfe, // STA ROMSEL
    0xad, 0x00, 0x80, // LDA $8000
    0x8d, 0x00, 0x02, // STA $0200
    0xa9, 0x55,       // LDA #$55
    0x8d, 0x40, 0xfe, // STA system VIA ORB
    0x4c, 0x10, 0xc0, // JMP $C010
  ], 0);
  for (const offset of [0x3ffa, 0x3ffc, 0x3ffe]) {
    rom[offset] = 0x00;
    rom[offset + 1] = 0xc0;
  }
  return rom;
}

test("Model B bus maps RAM, OS ROM and all sixteen sideways banks", () => {
  const bus = new BbcModelBBus();
  bus.write8(0x1234, 0x56);
  assert.equal(bus.read8(0x1234), 0x56);

  const os = syntheticOsRom();
  bus.loadOsRom(os);
  assert.equal(bus.read8(0xc000), 0xa9);
  bus.write8(0xc000, 0x00);
  assert.equal(bus.read8(0xc000), 0xa9);

  const rom8k = new Uint8Array(0x2000).fill(0x3c);
  bus.loadSidewaysRom(15, rom8k);
  bus.write8(0xfe30, 15);
  assert.equal(bus.selectedRom, 15);
  assert.equal(bus.read8(0x8000), 0x3c);
  assert.equal(bus.read8(0xa000), 0x3c);
  assert.equal(BBC_MODEL_B_MEMORY_MAP.length, 7);
});

test("Model B I/O shells decode mirrors and report 1MHz timing", () => {
  const bus = new BbcModelBBus();
  bus.write8(0xfe00, 5);
  bus.write8(0xfe01, 0x44);
  assert.equal(bus.read8(0xfe01), 0x44);
  bus.write8(0xfe42, 0xff);
  bus.write8(0xfe40, 0x77);
  assert.equal(bus.read8(0xfe50), 0x77);
  assert.equal(bus.read8(0xfee0), 0x40);

  bus.reset();
  bus.read8(0x0000);
  bus.read8(0xfc00);
  bus.read8(0xfe40);
  bus.read8(0xff00);
  assert.equal(bus.timingTicks, 6);
  assert.deepEqual(bus.accessLog.map(({ domain }) => domain), ["2MHz", "1MHz", "1MHz", "2MHz"]);
});

test("headless BBC bootstrap selects a ROM, touches the VIA and reaches an OS loop", () => {
  const machine = new BbcMicroModelB();
  const sideways = new Uint8Array(0x4000).fill(0xff);
  sideways[0] = 0xa5;
  machine.loadSidewaysRom(15, sideways);
  machine.loadOsRom(syntheticOsRom());
  const report = machine.diagnoseBoot({ maxInstructions: 100 });
  assert.equal(report.passed, true);
  assert.equal(report.reason, "stable-loop");
  assert.equal(report.resetVector, 0xc000);
  assert.equal(report.selectedRom, 15);
  assert.equal(machine.bus.ram[0x0200], 0xa5);
  assert.equal(machine.bus.devices.systemVia.outputB, 0x55);
  assert.ok(report.machineTicks > machine.cpu.cycles);
  assert.ok(report.deviceAccesses.ROMSEL > 0);
  assert.ok(report.deviceAccesses["System 6522 VIA"] > 0);
});
