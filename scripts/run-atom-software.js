import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AcornAtom } from "../src/machine/atom/atom.js";
import { atomKeyboardMappingForBrowserEvent } from "../src/machine/atom/ppi-8255.js";

const BCDTEST_SHA256 = "1afc39aa5e6ebe497d428543a9325ff61e3aa83bf8bbb8244a194ba4fa7fa0b1";

export async function runAtomSoftwareCorpus({
  basicPath = "ROM/Atom_Basic.rom",
  floatingPointPath = "ROM/Atom_FloatingPoint2.rom",
  kernelPath = "ROM/Atom_Kernel.rom",
  archiveProgramPath = "corpus/atom/BCDTEST.atm.b64",
} = {}) {
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

  const archiveProgram = await readBase64File(archiveProgramPath);
  const archiveHash = sha256(archiveProgram);
  const archiveMachine = new AcornAtom({ traceLimit: 0, accessLogLimit: 0 });
  archiveMachine.loadCoreRoms({ basic, floatingPoint, kernel });
  const archiveBoot = archiveMachine.diagnoseBoot();
  const loaded = archiveMachine.loadAtm(archiveProgram);
  runInstructions(archiveMachine, 120_000);
  const archiveScreen = archiveMachine.textSnapshot().join("\n");
  cases.push({
    name: "independently sourced AtomSoftwareArchive BCDTEST executes through Atom hardware",
    passed: archiveBoot.passed
      && archiveHash === BCDTEST_SHA256
      && loaded.name === "BCDTEST"
      && loaded.start === 0x2900
      && loaded.run === 0x2900
      && archiveScreen.includes("CPU:  RANGE: FLAGS:")
      && archiveScreen.includes("(H) 65C02   00-FF   NVZC"),
    sha256: archiveHash,
    loaded,
  });

  return {
    passed: cases.every(({ passed }) => passed),
    cases,
    roms: { basic: sha256(basic), floatingPoint: sha256(floatingPoint), kernel: sha256(kernel) },
    archiveProgram: { name: loaded.name, sha256: archiveHash, source: "hoglet67/AtomSoftwareArchive@13cdf0f0ec5621a6965ee2acb92c88efd3f15e75/tests/clark/BCDTEST_atom" },
    finalPc: archiveMachine.cpu.pc,
    machineCycles: archiveMachine.machineCycles,
    screen: archiveScreen,
  };
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
async function readBase64File(path) { return new Uint8Array(Buffer.from((await readFile(path, "utf8")).replace(/\s/g, ""), "base64")); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runAtomSoftwareCorpus();
  console.log(JSON.stringify({ ...report, finalPc: `$${report.finalPc.toString(16).toUpperCase().padStart(4, "0")}` }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
