import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

const KEYS = Object.freeze({ P: [7, 3], R: [3, 3], I: [5, 2], N: [5, 5], T: [3, 2], H: [4, 5], Space: [2, 6], Quote: [1, 3], Enter: [9, 4] });

export async function runBbcSoftwareCorpus({ osPath = "ROM/os12.rom", basicPath = "ROM/basic2.rom" } = {}) {
  const os = new Uint8Array(await readFile(osPath)); const basic = new Uint8Array(await readFile(basicPath));
  const machine = new BbcMicroModelB({ traceLimit: 0, accessLogLimit: 0 }); machine.loadSidewaysRom(15, basic); machine.loadOsRom(os);
  const boot = machine.diagnoseBoot({ maxInstructions: 1_000_000 });
  const cases = [{ name: "OS 1.20 boots BASIC II", passed: boot.passed && boot.reason === "basic-prompt", instructions: boot.instructions }];
  for (const key of [KEYS.P, KEYS.R, KEYS.I, KEYS.N, KEYS.T, KEYS.Space]) press(machine, key);
  press(machine, KEYS.Quote, true); press(machine, KEYS.H); press(machine, KEYS.I); press(machine, KEYS.Quote, true); press(machine, KEYS.Enter);
  runInstructions(machine, 300_000);
  const screen = machine.video.textSnapshot().join("\n");
  cases.push({ name: 'BASIC executes PRINT "HI"', passed: screen.includes('>PRINT "HI"') && /\nHI\s+\n>/.test(screen) });
  return { passed: cases.every((entry) => entry.passed), roms: { os12: sha256(os), basic2: sha256(basic) }, cases, finalPc: machine.cpu.pc, machineTicks: machine.machineTicks };
}

function press(machine, [column, row], shift = false) {
  if (shift) { machine.bus.keyboard.press("0:0"); runInstructions(machine, 10_000); }
  const code = `${column}:${row}`; machine.bus.keyboard.press(code); runInstructions(machine, 25_000); machine.bus.keyboard.release(code); runInstructions(machine, 25_000);
  if (shift) { machine.bus.keyboard.release("0:0"); runInstructions(machine, 10_000); }
}
function runInstructions(machine, count) { for (let index = 0; index < count; index += 1) machine.step(); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runBbcSoftwareCorpus(); console.log(JSON.stringify({ ...report, finalPc: `$${report.finalPc.toString(16).toUpperCase().padStart(4, "0")}` }, null, 2)); if (!report.passed) process.exitCode = 1;
}
