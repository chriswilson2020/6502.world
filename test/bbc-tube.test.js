import assert from "node:assert/strict";
import test from "node:test";
import { BbcModelBBus } from "../src/machine/bbc/model-b-bus.js";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";
import { TubeUla } from "../src/machine/bbc/tube-ula.js";
import { Z80TubeSecondProcessor } from "../src/machine/bbc/z80-second-processor.js";

test("Tube ULA carries bytes in both directions with hardware-style status", () => {
  const tube = new TubeUla();
  assert.equal(tube.read(0) & 0xc0, 0x40);
  assert.equal(tube.read(2) & 0x3f, 0x3f);
  tube.write(1, 0x42);
  assert.equal(tube.parasiteRead(0) & 0xc0, 0xc0);
  assert.equal(tube.parasiteRead(1), 0x42);
  tube.parasiteWrite(7, 0x99);
  assert.equal(tube.read(6) & 0x80, 0x80);
  assert.equal(tube.read(7), 0x99);
});

test("Tube control set/clear protocol drives host, parasite IRQ and NMI lines", () => {
  const tube = new TubeUla();
  tube.write(0, 0x8f); tube.write(1, 1); tube.write(5, 2); tube.write(7, 4); tube.parasiteWrite(7, 3);
  assert.equal(tube.parasiteIrq, true); assert.equal(tube.parasiteNmi, true); assert.equal(tube.hostIrq, true);
  tube.write(0, 0x07);
  assert.equal(tube.parasiteIrq, false); assert.equal(tube.hostIrq, false); assert.equal(tube.parasiteNmi, true);
});

test("Tube R1 provides the Acorn 24-byte parasite-to-host FIFO", () => {
  const tube = new TubeUla();
  for (let value = 0; value < 24; value += 1) tube.parasiteWrite(1, value);
  assert.equal(tube.parasiteRead(0) & 0x40, 0);
  for (let value = 0; value < 24; value += 1) assert.equal(tube.read(1), value);
  assert.equal(tube.read(0) & 0x80, 0);
});

test("BBC host maps Tube registers at FEE0-FEEF", () => {
  const bus = new BbcModelBBus();
  bus.write8(0xfee1, 0x5a);
  assert.equal(bus.devices.tube.parasiteRead(1), 0x5a);
  bus.devices.tube.parasiteWrite(3, 0xa5);
  assert.equal(bus.read8(0xfee3), 0xa5);
});

test("shared Z80 World core exchanges a byte through Tube ports", () => {
  const tube = new TubeUla();
  const parasite = new Z80TubeSecondProcessor({ tube });
  parasite.load(0, [0xdb, 0x01, 0x32, 0x00, 0x40, 0x3e, 0x42, 0xd3, 0x01, 0x76]);
  tube.write(1, 0x99);
  for (let instruction = 0; instruction < 5; instruction += 1) parasite.step();
  assert.equal(parasite.ram[0x4000], 0x99);
  assert.equal(tube.read(1), 0x42);
  assert.ok(parasite.cpu.tStates > 0);
});

test("Acorn Z80 FEF8-FEFF is RAM and Tube access is I/O-only", () => {
  const tube = new TubeUla();
  const parasite = new Z80TubeSecondProcessor({ tube });
  for (let offset = 0; offset < 8; offset += 1) parasite.write8(0xfef8 + offset, 0x80 + offset);
  assert.deepEqual(Array.from(parasite.ram.slice(0xfef8, 0xff00)), [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87]);
  assert.deepEqual(tube.parasiteToHost.map((queue) => queue.length), [0, 0, 1, 0]);
});

test("Acorn Z80 Tube IRQ supplies the board's FE mode-2 vector", () => {
  const tube = new TubeUla();
  const parasite = new Z80TubeSecondProcessor({ tube });
  parasite.load(0x0000, [0xfb, 0x76]); // EI; HALT
  parasite.load(0x1234, [0x76]);
  parasite.ram[0xfffe] = 0x34; parasite.ram[0xffff] = 0x12;
  parasite.cpu.I = 0xff; parasite.cpu.interruptMode = 2; parasite.cpu.SP = 0x8000;
  parasite.step(); parasite.step();
  tube.write(0, 0x84); tube.write(7, 0x01);
  parasite.step();
  assert.equal(parasite.cpu.PC, 0x1234);
});

test("Z80 parasite scheduler maintains a 6MHz-to-2MHz clock ratio", () => {
  const parasite = new Z80TubeSecondProcessor({ tube: new TubeUla() });
  parasite.load(0, [0x00, 0xc3, 0x00, 0x00]);
  parasite.runForHostTicks(100);
  assert.ok(parasite.cpu.tStates >= 300);
  assert.ok(parasite.cpu.tStates < 311);
});

test("Tube P control holds and releases the Z80 reset line", () => {
  const tube = new TubeUla(); const parasite = new Z80TubeSecondProcessor({ tube });
  parasite.load(0, [0x00, 0xc3, 0x00, 0x00]); parasite.runForHostTicks(20); assert.ok(parasite.cpu.tStates > 0);
  tube.write(0, 0xa0); parasite.runForHostTicks(20); assert.equal(parasite.cpu.tStates, 0); assert.equal(parasite.cpu.PC, 0);
  tube.write(0, 0x20); parasite.runForHostTicks(20); assert.ok(parasite.cpu.tStates >= 60);
});

test("Acorn Z80 shadow ROM unmaps on high fetch, remaps on NMI fetch, and resets mapped", () => {
  const tube = new TubeUla();
  const rom = new Uint8Array(0x1000);
  rom.set([0xc3, 0x00, 0x80], 0x0000); // JP 8000
  rom.set([0xc3, 0x00, 0x90], 0x0066); // NMI shadow-ROM entry
  const parasite = new Z80TubeSecondProcessor({ tube, bootRom: rom });
  parasite.ram[0x8000] = 0x76; parasite.ram[0x9000] = 0x76;
  parasite.step(); assert.equal(parasite.cpu.PC, 0x8000); assert.equal(parasite.romEnabled, true);
  parasite.step(); assert.equal(parasite.romEnabled, false);
  parasite.cpu.requestNmi(); parasite.step(); assert.equal(parasite.cpu.PC, 0x0066);
  parasite.step(); assert.equal(parasite.cpu.PC, 0x9000); assert.equal(parasite.romEnabled, true);
  parasite.step(); assert.equal(parasite.romEnabled, false);
  tube.write(0, 0xa0); parasite.runForHostTicks(1); assert.equal(parasite.romEnabled, true);
});

test("BBC portable state resumes Tube FIFOs and the Z80 parasite", () => {
  const machine = new BbcMicroModelB();
  const parasite = machine.attachZ80SecondProcessor();
  parasite.load(0, [0x00, 0xc3, 0x00, 0x00]);
  machine.bus.devices.tube.write(1, 0x5a);
  parasite.runForHostTicks(20);
  while (!machine.cpu.instructionBoundary) machine.clock();
  const restored = new BbcMicroModelB().importState(JSON.parse(JSON.stringify(machine.exportState())));
  assert.equal(restored.bus.devices.tube.parasiteRead(1), 0x5a);
  assert.equal(restored.parasite.cpu.PC, parasite.cpu.PC);
  assert.equal(restored.parasite.cpu.tStates, parasite.cpu.tStates);
  restored.parasite.step();
});
