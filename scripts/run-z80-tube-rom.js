import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

export async function runZ80TubeRom({ instructions = 800_000 } = {}) {
  const [os, basic, dnfs, z80] = await Promise.all(["os12.rom", "basic2.rom", "dnfs.rom", "z80.rom"].map(async (name) => new Uint8Array(await readFile(`ROM/${name}`))));
  const machine = new BbcMicroModelB({ traceLimit: 0, accessLogLimit: 0 });
  machine.loadSidewaysRom(15, basic); machine.loadSidewaysRom(14, dnfs);
  const parasite = machine.attachZ80SecondProcessor({ bootRom: z80 });
  const output = []; const parasiteWrite = machine.bus.devices.tube.parasiteWrite.bind(machine.bus.devices.tube);
  machine.bus.devices.tube.parasiteWrite = (offset, value) => { if ((offset & 7) === 1) output.push(value & 0xff); parasiteWrite(offset, value); };
  machine.loadOsRom(os);
  for (let instruction = 0; instruction < instructions; instruction += 1) machine.step();
  const transcript = new TextDecoder().decode(Uint8Array.from(output));
  const tube = machine.bus.devices.tube;
  const passed = transcript.includes("Acorn TUBE Z80 64K 1.20") && parasite.cpu.PC >= 0xf69a && parasite.cpu.PC <= 0xf6a3 && tube.parasiteToHost[0].length === 0;
  return { passed, transcript, hostPc: machine.cpu.pc, z80Pc: parasite.cpu.PC, z80TStates: parasite.cpu.tStates, tubeControl: tube.control, hashes: { os12: sha256(os), dnfs: sha256(dnfs), z80: sha256(z80) } };
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function hex(value) { return `$${value.toString(16).toUpperCase().padStart(4, "0")}`; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runZ80TubeRom();
  console.log(JSON.stringify({ ...report, transcript: report.transcript.replace(/[^\x20-\x7e\r\n]/g, ""), hostPc: hex(report.hostPc), z80Pc: hex(report.z80Pc) }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
