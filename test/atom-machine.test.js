import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { AtomBus, ATOM_MEMORY_MAP } from "../src/machine/atom/atom-bus.js";
import { AtomKeyboardMatrix, AtomPpi8255 } from "../src/machine/atom/ppi-8255.js";
import { AcornAtom } from "../src/machine/atom/atom.js";

const paths = {
  basic: "ROM/Atom_Basic.rom",
  floatingPoint: "ROM/Atom_FloatingPoint2.rom",
  kernel: "ROM/Atom_Kernel.rom",
};

test("Atom memory map protects ROM and mirrors the 8255", () => {
  const bus = new AtomBus();
  const roms = { basic: filled(0x11), floatingPoint: filled(0x22), kernel: filled(0x33) };
  bus.loadCoreRoms(roms);
  assert.equal(bus.read8(0xc000), 0x11);
  assert.equal(bus.read8(0xdfff), 0x22);
  assert.equal(bus.read8(0xffff), 0x33);
  bus.write8(0xc000, 0xaa);
  assert.equal(bus.read8(0xc000), 0x11);
  bus.write8(0xb000, 7);
  assert.equal(bus.ppi.keyColumn, 7);
  bus.write8(0xb3fc, 4);
  assert.equal(bus.ppi.keyColumn, 4);
  bus.write8(0xb80c, 0x0e);
  assert.equal(bus.read8(0xbbfc), 0x0e);
  assert.ok(ATOM_MEMORY_MAP.some(({ start, end }) => start === 0xb000 && end === 0xb3ff));
});

test("Atom 8255 scans active-low keys and exposes timing inputs", () => {
  const keyboard = new AtomKeyboardMatrix();
  const ppi = new AtomPpi8255({ keyboard });
  ppi.write(0, 6);
  keyboard.press(6, 3);
  assert.equal(ppi.read(1) & 0x08, 0);
  keyboard.release(6, 3);
  assert.equal(ppi.read(1) & 0x08, 0x08);
  keyboard.setShift(true);
  assert.equal(ppi.read(1) & 0x80, 0);
  ppi.tick(16000);
  assert.equal(ppi.read(2) & 0x80, 0x80);
});

test("bundled Atom core is the canonical ROM set and reaches BASIC", async () => {
  const roms = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, new Uint8Array(await readFile(path))])));
  const combined = Buffer.concat([roms.basic, roms.kernel]);
  assert.equal(createHash("sha1").update(combined).digest("hex"), "0072c83458a9690a3ea1f6094f0f38cf8e96a445");
  assert.equal(createHash("sha1").update(roms.floatingPoint).digest("hex"), "ebcde5b36cb3a3344567cbba4c7b9fde015f4802");
  const machine = new AcornAtom({ accessLogLimit: 0 });
  machine.loadCoreRoms(roms);
  const report = machine.diagnoseBoot();
  assert.equal(report.passed, true, JSON.stringify(report));
});

function filled(value) { return new Uint8Array(0x1000).fill(value); }
