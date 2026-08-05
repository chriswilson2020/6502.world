import assert from "node:assert/strict"; import test from "node:test";
import { AcornAtom } from "../src/machine/atom/atom.js"; import { ATOM_GRAPHICS_MODES } from "../src/machine/atom/video.js";

test("all eight MC6847 graphics modes decode deterministic pixel geometry", () => {
  const machine = new AcornAtom();
  ATOM_GRAPHICS_MODES.forEach((mode, number) => { machine.bus.ppi.portA = 0x10 | (number << 5); machine.bus.ram[0x8000] = 0x9c; const frame = machine.video.graphicsFrame(); assert.deepEqual({ width: frame.width, height: frame.height, bpp: frame.bpp }, mode); assert.deepEqual(Array.from(frame.pixels.slice(0, mode.bpp === 1 ? 8 : 4)), mode.bpp === 1 ? [1,0,0,1,1,1,0,0] : [2,1,3,0]); });
});

test("MC6847 text cells distinguish characters, inverse and semigraphics", () => { const machine = new AcornAtom(); machine.bus.ram.set([1, 0x82, 0x55], 0x8000); const cells = machine.video.textCells()[0]; assert.deepEqual(cells[0], { kind: "text", character: "A", inverse: false }); assert.deepEqual(cells[1], { kind: "text", character: "B", inverse: true }); assert.deepEqual(cells[2], { kind: "semigraphics", blocks: 0x15, inverse: false }); });

test("Atom UEF transport drives cassette input and round-trips state", () => { const machine = new AcornAtom(); const tape = machine.loadUef(uef([0x41])); assert.equal(tape.version, "0.10"); tape.play(); machine.bus.ppi.cassetteInput = tape.tick(500); assert.equal(machine.bus.ppi.read(2) & 0x20, tape.level ? 0x20 : 0); machine.cpu.instructionBoundary = true; const restored = new AcornAtom().importState(machine.exportState()); assert.equal(restored.cassette.position, tape.position); assert.equal(restored.cassette.playing, true); assert.equal(restored.bus.ppi.cassetteInput, tape.level); restored.cassette.rewind(); assert.equal(restored.cassette.position, 0); assert.equal(restored.cassette.playing, false); });

test("Atom cassette stops cleanly at the end of its standard data stream", () => { const tape = new AcornAtom().loadUef(uef([0])); tape.play(); assert.equal(tape.tick(11 * 3333), false); assert.equal(tape.position, 1); assert.equal(tape.playing, false); });

function uef(data) { const bytes = new Uint8Array(18 + data.length); bytes.set(new TextEncoder().encode("UEF File!\0")); bytes[10]=10; bytes[12]=0; bytes[13]=1; bytes[14]=data.length; bytes.set(data,18); return bytes; }
