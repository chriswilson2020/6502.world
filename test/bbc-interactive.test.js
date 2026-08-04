import assert from "node:assert/strict";
import test from "node:test";
import { BbcModelBBus } from "../src/machine/bbc/model-b-bus.js";
import { BBC_KEYBOARD_CODES, BBC_PRINTABLE_KEYBOARD, bbcKeyboardCodeForBrowserEvent, bbcKeyboardMappingForBrowserEvent } from "../src/machine/bbc/system-via.js";
import { BbcVideoOutput } from "../src/machine/bbc/video.js";

test("system VIA timers raise and clear maskable interrupts", () => {
  const bus = new BbcModelBBus();
  const via = bus.devices.systemVia;
  via.write(14, 0xc0); // enable timer 1 IRQ
  via.write(4, 0x01);
  via.write(5, 0x00);
  via.tick(4);
  assert.equal(via.irq, true);
  assert.ok(via.read(13) & 0x80);
  via.read(4);
  assert.equal(via.irq, false);
});

test("6850 control writes do not masquerade as an asserted serial IRQ", () => {
  const bus = new BbcModelBBus();
  bus.write8(0xfe08, 0x96);
  assert.equal(bus.read8(0xfe08), 0x02);
  assert.equal(bus.devices.acia.irq, false);
  bus.write8(0xfe09, 0x41);
  assert.equal(bus.read8(0xfe08), 0x02);
});

test("system VIA scans the browser-backed keyboard matrix", () => {
  const bus = new BbcModelBBus();
  const via = bus.devices.systemVia;
  const [column, row] = BBC_KEYBOARD_CODES.KeyA;
  via.write(2, 0x0f); // port B low nibble drives IC32
  via.write(0, 0x03); // select latch 3, drive it low: keyboard scan load
  via.write(3, 0x7f); // port A low seven bits are outputs
  via.write(1, (row << 4) | column);
  bus.keyboard.press(`${column}:${row}`);
  assert.ok(via.read(1) & 0x80);
  bus.keyboard.release(`${column}:${row}`);
  assert.equal(via.read(1) & 0x80, 0);
});

test("browser double quote maps to the BBC Shift+2 matrix key", () => {
  assert.deepEqual(bbcKeyboardCodeForBrowserEvent("Quote", '"'), BBC_KEYBOARD_CODES.Digit2);
  assert.equal(bbcKeyboardMappingForBrowserEvent("Quote", '"').shift, true);
});

test("modern punctuation translates by character to BBC key pairs", () => {
  const pairs = [[";", "+", "Semicolon"], [":", "*", "Colon"], ["-", "=", "Minus"], ["[", "{", "BracketLeft"], ["]", "}", "BracketRight"], [",", "<", "Comma"], [".", ">", "Period"], ["/", "?", "Slash"], ["^", "~", "Caret"], ["\\", "|", "Backslash"]];
  for (const [lower, upper, code] of pairs) {
    assert.deepEqual(BBC_PRINTABLE_KEYBOARD[lower], { matrix: BBC_KEYBOARD_CODES[code], shift: false });
    assert.deepEqual(BBC_PRINTABLE_KEYBOARD[upper], { matrix: BBC_KEYBOARD_CODES[code], shift: true });
  }
  assert.deepEqual(bbcKeyboardMappingForBrowserEvent("Semicolon", ":"), { matrix: BBC_KEYBOARD_CODES.Colon, shift: false });
  assert.deepEqual(bbcKeyboardMappingForBrowserEvent("Digit8", "*"), { matrix: BBC_KEYBOARD_CODES.Colon, shift: true });
  assert.equal(bbcKeyboardMappingForBrowserEvent("Backquote", "`"), null);
});

test("keyboard matrix revisions interrupt for a second key in a chord", () => {
  const bus = new BbcModelBBus(); const via = bus.devices.systemVia;
  via.write(14, 0x81); bus.keyboard.press("0:0"); via.tick(2); via.write(13, 1);
  bus.keyboard.press("1:3"); via.tick(2);
  assert.equal(via.irq, true);
});

test("CRTC start address feeds a 40-column browser text snapshot", () => {
  const bus = new BbcModelBBus();
  bus.write8(0xfe00, 12); bus.write8(0xfe01, 0x0f);
  bus.write8(0xfe00, 13); bus.write8(0xfe01, 0x80);
  bus.ram.set(new TextEncoder().encode("BBC BASIC"), 0x7c00);
  const video = new BbcVideoOutput({ bus });
  assert.equal(video.screenBase, 0x7c00);
  assert.equal(video.textSnapshot()[0].slice(0, 9), "BBC BASIC");
});

test("bitmap text snapshot decodes the MOS font from an 80-column screen", () => {
  const bus = new BbcModelBBus(); const glyph = Uint8Array.of(0x18, 0x24, 0x42, 0x7e, 0x42, 0x42, 0x42, 0);
  bus.osRom.set(glyph, (0x41 - 0x20) * 8);
  bus.write8(0xfe00, 1); bus.write8(0xfe01, 80);
  bus.write8(0xfe00, 6); bus.write8(0xfe01, 32);
  bus.write8(0xfe00, 12); bus.write8(0xfe01, 0x06);
  bus.write8(0xfe00, 13); bus.write8(0xfe01, 0x00);
  bus.ram.set(glyph, 0x3000);
  const rows = new BbcVideoOutput({ bus }).textSnapshot();
  assert.equal(rows.length, 32); assert.equal(rows[0].length, 80); assert.equal(rows[0][0], "A");
});
