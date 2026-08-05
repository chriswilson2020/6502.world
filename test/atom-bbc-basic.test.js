import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AcornAtom } from "../src/machine/atom/atom.js";
import { AtomBus } from "../src/machine/atom/atom-bus.js";

test("BBC BASIC conversion card remaps RAM, video, ROM and Atom I/O", () => {
  const bus = new AtomBus({ profile: "bbc-basic" });
  bus.loadBbcBasicConversion({ basic: filled(0x4000, 0x42), mos: filled(0x1000, 0x4d) }); bus.loadUtilityRom(filled(0x1000, 0x60));
  bus.write8(0x4000, 0x11); assert.equal(bus.read8(0x4000), 0x11); assert.equal(bus.videoBase, 0x4000);
  assert.equal(bus.read8(0x6000), 0x60); assert.equal(bus.read8(0x8000), 0x42); assert.equal(bus.read8(0xbfff), 0x42); assert.equal(bus.read8(0xf000), 0x4d);
  bus.write8(0x7000, 7); assert.equal(bus.ppi.keyColumn, 7); bus.write8(0x780e, 0xc0); assert.equal(bus.read8(0x7bfe), 0xc0);
  bus.write8(0x8000, 0); bus.write8(0xf000, 0); assert.equal(bus.read8(0x8000), 0x42); assert.equal(bus.read8(0xf000), 0x4d);
});

test("Atom 6522 timer asserts and clears its maskable interrupt", () => {
  const machine = new AcornAtom(); machine.bus.via.write(14, 0xc0); machine.bus.via.write(4, 1); machine.bus.via.write(5, 0);
  machine.bus.via.tick(2); assert.equal(machine.bus.via.irq, true); assert.equal(machine.bus.via.read(13) & 0xc0, 0xc0); machine.bus.via.read(4); assert.equal(machine.bus.via.irq, false);
});

test("owner-supplied Atom BBC BASIC MOS is a stable 4K conversion image", async () => {
  const mos = new Uint8Array(await readFile("ROM/Atom_BBC_BASIC_OS.rom")); assert.equal(mos.length, 0x1000); assert.equal(sha256(mos), "8419bc5e8c39aaa72445754879ca15de2a7fca3e0334bb7852312537bc9f1112");
  assert.equal(mos[0xffc] | (mos[0xffd] << 8), 0xff18);
});

test("BBC BASIC conversion profile and full VIA state round-trip", () => {
  const machine = new AcornAtom({ profile: "bbc-basic" }); machine.loadBbcBasicConversion({ basic: filled(0x4000, 0x42), mos: filled(0x1000, 0x4d) }); machine.bus.via.write(14, 0xc0); machine.bus.via.write(4, 3); machine.bus.via.write(5, 0); machine.cpu.instructionBoundary = true;
  const restored = new AcornAtom().importState(machine.exportState()); assert.equal(restored.bus.profile, "bbc-basic"); assert.equal(restored.bus.read8(0x8000), 0x42); assert.equal(restored.bus.via.ier, 0x40); assert.equal(restored.bus.via.timer1Latch, 3);
});

function filled(size, value) { return new Uint8Array(size).fill(value); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
