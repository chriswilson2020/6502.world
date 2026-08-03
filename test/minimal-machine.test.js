import assert from "node:assert/strict";
import test from "node:test";
import { MinimalMachine, parseHexAddress } from "../src/machine/minimal-machine.js";

const sample = [0xa2, 0x00, 0xe8, 0x8e, 0x00, 0x02, 0xe0, 0x0a, 0xd0, 0xf8, 0x00];

test("minimal machine loads binaries and runs to BRK", () => {
  const machine = new MinimalMachine();
  machine.load(sample, 0x0600);
  const result = machine.run();
  assert.equal(result.reason, "brk");
  assert.equal(machine.memory.read8(0x0200), 10);
});

test("minimal machine stops before executing a breakpoint", () => {
  const machine = new MinimalMachine();
  machine.load(sample, 0x0600);
  while (!machine.cpu.instructionBoundary) machine.cpu.clock();
  machine.setBreakpoint(0x0602);
  const result = machine.run();
  assert.equal(result.reason, "breakpoint");
  assert.equal(result.pc, 0x0602);
  assert.equal(machine.cpu.x, 0);
  assert.equal(machine.toggleBreakpoint(0x0602), false);
});

test("binary images keep supplied vectors while short programs receive safe defaults", () => {
  const short = new MinimalMachine();
  short.load([0xea, 0x00], 0x2000);
  assert.equal(short.memory.read16(0xfffa), 0x2001);
  assert.equal(short.memory.read16(0xfffc), 0x2000);
  assert.equal(short.memory.read16(0xfffe), 0x2001);

  const image = new Uint8Array(0x10000);
  image[0xfffa] = 0x34; image[0xfffb] = 0x12;
  image[0xfffc] = 0x78; image[0xfffd] = 0x56;
  image[0xfffe] = 0xbc; image[0xffff] = 0x9a;
  const full = new MinimalMachine();
  full.load(image, 0x0000);
  assert.equal(full.memory.read16(0xfffa), 0x1234);
  assert.equal(full.memory.read16(0xfffc), 0x5678);
  assert.equal(full.memory.read16(0xfffe), 0x9abc);
});

test("portable state round-trips CPU, full memory, origin and breakpoints", () => {
  const source = new MinimalMachine({ traceLimit: 64 });
  source.load(sample, 0x0800);
  while (!source.cpu.instructionBoundary) source.cpu.clock();
  source.cpu.step();
  source.memory.write8(0xcafe, 0x5a);
  source.setBreakpoint(0x0802);
  const encoded = JSON.stringify(source.exportState());

  const restored = new MinimalMachine({ traceLimit: 64 });
  restored.importState(JSON.parse(encoded));
  assert.equal(restored.cpu.x, 0);
  assert.equal(restored.cpu.pc, 0x0802);
  assert.equal(restored.memory.read8(0xcafe), 0x5a);
  assert.equal(restored.loadAddress, 0x0800);
  assert.deepEqual([...restored.breakpoints], [0x0802]);
});

test("hex address parser accepts common forms and rejects overflow", () => {
  assert.equal(parseHexAddress("0600"), 0x0600);
  assert.equal(parseHexAddress("$CAFE"), 0xcafe);
  assert.equal(parseHexAddress("0xffff"), 0xffff);
  assert.throws(() => parseHexAddress("10000"), /invalid 16-bit address/);
});
