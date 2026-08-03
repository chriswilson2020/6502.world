import assert from "node:assert/strict";
import test from "node:test";
import { Intel8271 } from "../src/machine/bbc/intel-8271.js";
import { SsdDisk, UefCassette } from "../src/machine/bbc/media.js";
import { BbcModelBBus } from "../src/machine/bbc/model-b-bus.js";

test("system VIA sound strobe programs SN76489 tone and attenuation", () => {
  const bus = new BbcModelBBus();
  bus.write8(0xfe43, 0xff); // DDRA output
  bus.write8(0xfe41, 0x85); // latch tone channel 0, low nibble 5
  bus.write8(0xfe42, 0x0f); // DDRB latch controls output
  bus.write8(0xfe40, 0x00); // IC32 bit 0 low: sound write
  bus.write8(0xfe41, 0x90); // channel 0 volume, loudest
  bus.write8(0xfe40, 0x00);
  assert.equal(bus.devices.sound.tone[0] & 0x0f, 5);
  assert.equal(bus.devices.sound.volume[0], 0);
  assert.equal(bus.devices.sound.writeCount, 2);
  assert.ok(bus.devices.sound.channelState().tones[0].gain > 0);
});

test("UEF cassette exposes standard Acorn stream chunks through transport", () => {
  const bytes = new Uint8Array(12 + 6 + 3);
  bytes.set(new TextEncoder().encode("UEF File!\0")); bytes[10] = 10; bytes[11] = 0;
  bytes.set([0x00, 0x01, 3, 0, 0, 0, 0x2a, 0x41, 0x42], 12);
  const cassette = new UefCassette(bytes);
  assert.equal(cassette.version, "0.10");
  assert.equal(cassette.readByte(), null);
  cassette.play(); assert.deepEqual([cassette.readByte(), cassette.readByte(), cassette.readByte()], [0x2a, 0x41, 0x42]);
  cassette.rewind(); assert.equal(cassette.readByte(), 0x2a);
});

test("8271 reads and writes SSD sectors through FE80-style registers", () => {
  const image = new Uint8Array(40 * 10 * 256);
  for (let index = 0; index < 256; index += 1) image[2 * 256 + index] = index;
  const disk = new SsdDisk(image); const fdc = new Intel8271(); fdc.mount(disk);

  fdc.write(0, 0x13); fdc.write(1, 0); fdc.write(1, 2); fdc.write(1, 0x21);
  const read = new Uint8Array(256);
  for (let index = 0; index < read.length; index += 1) { assert.equal(fdc.tick(), true); read[index] = fdc.read(4); }
  assert.deepEqual(read, image.subarray(2 * 256, 3 * 256)); assert.equal(fdc.read(1), 0);

  fdc.write(0, 0x0b); fdc.write(1, 1); fdc.write(1, 3); fdc.write(1, 0x21);
  for (let index = 0; index < 256; index += 1) { assert.equal(fdc.tick(), true); fdc.write(4, 255 - index); }
  assert.equal(disk.dirty, true); assert.equal(disk.readSector(1, 3)[0], 255); assert.equal(disk.readSector(1, 3)[255], 0);
});
