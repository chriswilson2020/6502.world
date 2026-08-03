import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runAcornCpm } from "./run-acorn-cpm.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export async function runBbcBasicZ80Gate() {
  const basic = new Uint8Array(await readFile(join(ROOT, "MEDIA", "Basic_Program_Disc.dsd")));
  const result = await runAcornCpm({ drive1MediaBytes: basic, commands: ["B:", "BBCBASIC"], commandExpectations: ["B>", "Acorn BBC BASIC Version 2.20"], commandInstructionLimit: 5_000_000 });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  return { passed: result.passed && screen.some((line) => line.includes("Acorn BBC BASIC Version 2.20")), title: "BBC BASIC for Z80", systemDrive: "CPM_Utilities_Disc.dsd", applicationDrive: "Basic_Program_Disc.dsd", driveSequence: ["A:", "B:"], commands: ["B:", "BBCBASIC"], marker: "Acorn BBC BASIC Version 2.20", hostInstructions: result.hostInstructions, machineTicks: result.machineTicks, z80TStates: result.z80TStates, screen };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const result = await runBbcBasicZ80Gate(); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }
