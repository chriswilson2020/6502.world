import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AcornAtom } from "../src/machine/atom/atom.js";
import { atomKeyboardMappingForBrowserEvent } from "../src/machine/atom/ppi-8255.js";

export async function runAtomSoftwareCorpus({ basicPath = "ROM/Atom_Basic.rom", floatingPointPath = "ROM/Atom_FloatingPoint2.rom", kernelPath = "ROM/Atom_Kernel.rom" } = {}) {
  const [basic, floatingPoint, kernel] = await Promise.all([basicPath, floatingPointPath, kernelPath].map(async (path) => new Uint8Array(await readFile(path))));
  const machine = new AcornAtom({ traceLimit: 0, accessLogLimit: 0 });
  machine.loadCoreRoms({ basic, floatingPoint, kernel });
  const boot = machine.diagnoseBoot();
  const cases = [{ name: "canonical Atom firmware boots to BASIC", passed: boot.passed, instructions: boot.instructions }];
  runInstructions(machine, 25_000);
  typeText(machine, 'PRINT "HI"\r');
  runInstructions(machine, 100_000);
  const screen = machine.textSnapshot().join("\n");
  cases.push({ name: 'Atom BASIC executes PRINT "HI" through the keyboard matrix', passed: screen.includes('>PRINT "HI"') && screen.includes("HI>") });
  return { passed: cases.every(({ passed }) => passed), cases, roms: { basic: sha256(basic), floatingPoint: sha256(floatingPoint), kernel: sha256(kernel) }, finalPc: machine.cpu.pc, machineCycles: machine.machineCycles, screen };
}

function typeText(machine, text) {
  for (const character of text) {
    const key = character === "\r" ? "Enter" : character;
    const mapping = atomKeyboardMappingForBrowserEvent(key, key);
    if (!mapping) throw new Error(`No Atom keyboard mapping for ${JSON.stringify(character)}`);
    machine.bus.keyboard.setShift(mapping.shift);
    machine.bus.keyboard.press(...mapping.matrix);
    runInstructions(machine, 25_000);
    machine.bus.keyboard.release(...mapping.matrix);
    machine.bus.keyboard.setShift(false);
    runInstructions(machine, 25_000);
  }
}

function runInstructions(machine, count) { for (let index = 0; index < count; index += 1) machine.step(); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runAtomSoftwareCorpus();
  console.log(JSON.stringify({ ...report, finalPc: `$${report.finalPc.toString(16).toUpperCase().padStart(4, "0")}` }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
