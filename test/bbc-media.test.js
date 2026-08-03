import assert from "node:assert/strict";
import test from "node:test";
import { Intel8271 } from "../src/machine/bbc/intel-8271.js";
import { createSectorDisk, DsdDisk, restoreSectorDisk, serializeSectorDisk, SsdDisk, UefCassette } from "../src/machine/bbc/media.js";
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
  for (let index = 0; index < read.length; index += 1) { assert.equal(fdc.tick(index * 128), true); read[index] = fdc.read(4); }
  assert.deepEqual(read, image.subarray(2 * 256, 3 * 256)); assert.equal(fdc.read(1), 0);

  fdc.write(0, 0x0b); fdc.write(1, 1); fdc.write(1, 3); fdc.write(1, 0x21);
  for (let index = 0; index < 256; index += 1) { assert.equal(fdc.tick(40000 + index * 128), true); fdc.write(4, 255 - index); }
  assert.equal(disk.dirty, true); assert.equal(disk.readSector(1, 3)[0], 255); assert.equal(disk.readSector(1, 3)[255], 0);
});

test("SSD retains side-zero compatibility and rejects side one", () => {
  const source = new Uint8Array(80 * 10 * 256); source[256] = 0x41;
  const disk = new SsdDisk(source); source[256] = 0;
  assert.equal(disk.readSector(0, 1)[0], 0x41); assert.equal(disk.readSector(0, 0, 1)[0], 0x41);
  assert.throws(() => disk.readSector(0, 1, 0), /out of range/);
  const read = disk.readSector(0, 1); read[0] = 0; assert.equal(disk.readSector(0, 1)[0], 0x41);
});

test("DSD maps track-major interleaved sides and isolates writes", () => {
  const source = new Uint8Array(80 * 2 * 10 * 256);
  for (let track = 0; track < 80; track += 1) for (let side = 0; side < 2; side += 1) for (let sector = 0; sector < 10; sector += 1) source[(((track * 2 + side) * 10 + sector) * 256)] = (track ^ (side << 7) ^ sector) & 0xff;
  const original = source.slice(); const disk = new DsdDisk(source);
  assert.equal(disk.readSector(0, 0, 0)[0], 0); assert.equal(disk.readSector(0, 1, 0)[0], 0x80);
  assert.equal(disk.readSector(79, 0, 9)[0], 79 ^ 9); assert.equal(disk.readSector(79, 1, 9)[0], 79 ^ 0x80 ^ 9);
  disk.writeSector(10, 1, 4, new Uint8Array(256).fill(0xa5));
  assert.equal(disk.readSector(10, 1, 4)[0], 0xa5); assert.notEqual(disk.readSector(10, 0, 4)[0], 0xa5); assert.notEqual(disk.readSector(10, 1, 5)[0], 0xa5);
  assert.deepEqual(source, original); assert.equal(disk.dirty, true);
});

test("8271 command selects drives and drive-control bit 5 selects the DSD side", () => {
  const first = new Uint8Array(40 * 2 * 10 * 256); const second = new Uint8Array(40 * 2 * 10 * 256);
  first[10 * 256] = 0xa2; second[0] = 0xb1;
  const fdc = new Intel8271({ traceLimit: 32 });
  fdc.mount(new DsdDisk(first), { drive: 0 }); fdc.mount(new DsdDisk(second), { drive: 1, writeProtected: true });
  fdc.write(0, 0x7a); fdc.write(1, 0x23); fdc.write(1, 0x60); // drive 0, side 1
  fdc.write(0, 0x53); fdc.write(1, 0); fdc.write(1, 0); fdc.write(1, 0x21);
  assert.equal(fdc.tick(100), true); assert.equal(fdc.read(4), 0xa2);
  for (let index = 1; index < 256; index += 1) { fdc.tick(100 + index * 128); fdc.read(4); }
  assert.equal(fdc.read(1), 0);
  fdc.write(0, 0xba); fdc.write(1, 0x23); fdc.write(1, 0x80); // drive 1, side 0
  fdc.write(0, 0x8b); fdc.write(1, 0); fdc.write(1, 0); fdc.write(1, 0x21);
  assert.equal(fdc.read(1), 0x12);
  fdc.write(0, 0x69); fdc.write(1, 7); fdc.read(1);
  fdc.write(0, 0xa9); fdc.write(1, 12); fdc.read(1);
  assert.equal(fdc.drives[0].currentTrack, 7); assert.equal(fdc.drives[1].currentTrack, 12);
  assert.ok(fdc.trace.some((entry) => entry.event === "command" && entry.drive === 0 && entry.side === 1));
  assert.ok(fdc.trace.length <= 32); assert.ok(fdc.trace.every((entry) => Number.isFinite(entry.ticks)));
});

test("8271 reports missing media and keeps multi-sector DSD writes on the selected side", () => {
  const fdc = new Intel8271();
  fdc.write(0, 0x53); fdc.write(1, 0); fdc.write(1, 0); fdc.write(1, 0x21); assert.equal(fdc.read(1), 0x10);
  const disk = new DsdDisk(new Uint8Array(40 * 2 * 10 * 256)); fdc.mount(disk);
  fdc.write(0, 0x7a); fdc.write(1, 0x23); fdc.write(1, 0x60);
  fdc.write(0, 0x4b); fdc.write(1, 2); fdc.write(1, 8); fdc.write(1, 0x22);
  for (let index = 0; index < 512; index += 1) { assert.equal(fdc.tick(index * 128), true); fdc.write(4, index < 256 ? 0x41 : 0x42); }
  assert.equal(fdc.read(1), 0); assert.equal(disk.readSector(2, 1, 8)[0], 0x41); assert.equal(disk.readSector(2, 1, 9)[0], 0x42); assert.equal(disk.readSector(2, 0, 8)[0], 0);
});

test("sector images export byte-identically and serialize format", () => {
  const source = new Uint8Array(409600); source[409599] = 0x7e;
  const disk = createSectorDisk(source, { filename: "utilities.dsd" }); assert.deepEqual(disk.export(), source);
  const state = serializeSectorDisk(disk); const restored = restoreSectorDisk(state);
  assert.equal(restored.format, "dsd"); assert.deepEqual(restored.export(), source); assert.equal(restored.dirty, false);
});

test("sector image geometry rejects incomplete, oversized and ambiguous data", () => {
  assert.throws(() => new DsdDisk(new Uint8Array(409599)), /geometry/);
  assert.throws(() => new DsdDisk(new Uint8Array(81 * 2 * 10 * 256)), /1-80/);
  assert.throws(() => createSectorDisk(new Uint8Array(40 * 10 * 256)), /ambiguous/);
  assert.ok(createSectorDisk(new Uint8Array(80 * 10 * 256)) instanceof SsdDisk);
  assert.ok(createSectorDisk(new Uint8Array(80 * 2 * 10 * 256)) instanceof DsdDisk);
});
