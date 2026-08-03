import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";

const [osPath, ...romArguments] = process.argv.slice(2);
if (!osPath) throw new Error("usage: node scripts/diagnose-bbc-boot.js <16K-os.rom> [bank:path ...]");

const machine = new BbcMicroModelB({ traceLimit: 1024, accessLogLimit: 8192 });
for (const argument of romArguments) {
  const match = /^(\d|1[0-5]):(.+)$/.exec(argument);
  if (!match) throw new Error(`invalid sideways ROM argument: ${argument}; expected bank:path`);
  machine.loadSidewaysRom(Number(match[1]), new Uint8Array(await readFile(resolve(match[2]))));
}
machine.loadOsRom(new Uint8Array(await readFile(resolve(osPath))));
const report = machine.diagnoseBoot({ maxInstructions: 1_000_000 });

console.log(JSON.stringify({
  ...report,
  pc: `$${report.pc.toString(16).toUpperCase().padStart(4, "0")}`,
  resetVector: `$${report.resetVector.toString(16).toUpperCase().padStart(4, "0")}`,
  deviceAccesses: report.deviceAccesses.reduce((counts, access) => ({ ...counts, [access.device]: (counts[access.device] ?? 0) + 1 }), {}),
}, null, 2));
if (!report.passed) process.exitCode = 1;
