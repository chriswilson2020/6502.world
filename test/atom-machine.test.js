import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { AtomBus, ATOM_MEMORY_MAP } from "../src/machine/atom/atom-bus.js";
import { ATOM_KEYBOARD_CODES, AtomKeyboardMatrix, AtomPpi8255, atomKeyboardMappingForBrowserEvent } from "../src/machine/atom/ppi-8255.js";
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

test("Atom maps optional utility, DOS and original-address 8271 hardware", () => {
  const bus = new AtomBus(); bus.loadUtilityRom(filled(0x44)); bus.loadDosRom(filled(0x55));
  assert.equal(bus.read8(0xa000), 0x44); assert.equal(bus.read8(0xe000), 0x55);
  bus.write8(0xa000, 0); bus.write8(0xe000, 0); assert.equal(bus.read8(0xa000), 0x44); assert.equal(bus.read8(0xe000), 0x55);
  bus.write8(0x0a02, 0xff); assert.equal(bus.read8(0x0a00), 0);
});

test("ATM quickload validates its header and loads normal and BASIC programs", () => {
  const machine = new AcornAtom();
  const normal = atm("HELLO", 0x0280, 0x0280, Uint8Array.of(0xa9, 0x41, 0x00));
  assert.deepEqual(machine.loadAtm(normal), { name: "HELLO", start: 0x0280, run: 0x0280, size: 3 });
  assert.deepEqual(Array.from(machine.bus.ram.slice(0x0280, 0x0283)), [0xa9, 0x41, 0]); assert.equal(machine.cpu.pc, 0x0280);
  machine.loadAtm(atm("BASIC", 0x2900, 0xc2b2, Uint8Array.of(1, 2, 3, 4)));
  assert.equal(machine.bus.ram[0x0c] | (machine.bus.ram[0x0d] << 8), 0x2904);
  assert.throws(() => machine.loadAtm(normal.subarray(0, -1)), /payload length/);
});

test("Atom disk mounts are private writable copies and survive portable state", () => {
  const source = new Uint8Array(10 * 256); const machine = new AcornAtom(); const disk = machine.mountMedia(source, { format: "ssd" });
  disk.writeSector(0, 0, new Uint8Array(256).fill(0x5a)); assert.equal(source[0], 0); assert.equal(disk.export()[0], 0x5a);
  machine.cpu.instructionBoundary = true; const state = machine.exportState(); const restored = new AcornAtom().importState(state);
  assert.equal(restored.bus.fdc.drives[0].disk.export()[0], 0x5a); assert.equal(restored.bus.fdc.drives[0].disk.dirty, true);
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

test("modern printable characters translate to Atom legends", () => {
  assert.deepEqual(atomKeyboardMappingForBrowserEvent("Digit8", "*"), { matrix: ATOM_KEYBOARD_CODES.Colon, shift: true });
  assert.deepEqual(atomKeyboardMappingForBrowserEvent("Quote", '"'), { matrix: ATOM_KEYBOARD_CODES.Digit2, shift: true });
  assert.deepEqual(atomKeyboardMappingForBrowserEvent("KeyA", "A"), { matrix: ATOM_KEYBOARD_CODES.KeyA, shift: false });
  assert.deepEqual(atomKeyboardMappingForBrowserEvent("KeyA", "a"), { matrix: ATOM_KEYBOARD_CODES.KeyA, shift: false });
  assert.equal(atomKeyboardMappingForBrowserEvent("CapsLock", "CapsLock"), null);
  assert.deepEqual(atomKeyboardMappingForBrowserEvent("ArrowLeft", "ArrowLeft"), { matrix: ATOM_KEYBOARD_CODES.Horizontal, shift: true });
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

  const state = machine.exportState();
  machine.bus.ram[0x8000] = 0;
  machine.importState(state);
  assert.equal(machine.textSnapshot()[0].trim(), "ACORN ATOM");
  const before = machine.cpu.pc;
  machine.step();
  assert.notEqual(machine.cpu.pc, before);
});

function filled(value) { return new Uint8Array(0x1000).fill(value); }
function atm(name, start, run, payload) { const bytes = new Uint8Array(0x16 + payload.length); bytes.set(new TextEncoder().encode(name).subarray(0, 16)); bytes[0x10] = start; bytes[0x11] = start >> 8; bytes[0x12] = run; bytes[0x13] = run >> 8; bytes[0x14] = payload.length; bytes[0x15] = payload.length >> 8; bytes.set(payload, 0x16); return bytes; }
