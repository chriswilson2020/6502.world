import assert from "node:assert/strict";
import test from "node:test";
import { BbcModelBBus } from "../src/machine/bbc/model-b-bus.js";
import { BBC_KEYBOARD_CODES, bbcKeyboardCodeForBrowserEvent } from "../src/machine/bbc/system-via.js";
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
