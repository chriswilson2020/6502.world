import { createHash } from "node:crypto";
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

export async function runMemoPlanGate() {
  const memoPlan = new Uint8Array(await readFile(join(ROOT, "MEDIA", "MemoPlan_Program_Disc.dsd")));
  const originalHash = sha256(memoPlan);
  const commands = ["B:", "MEMO CODEX.ME", "wait for editor", "enter document text", "open command menu", "open extra commands", "write file", "confirm filename", "open exit menu", "exit editor", "DIR CODEX.ME"];
  const result = await runAcornCpm({
    drive1MediaBytes: memoPlan,
    writeProtected: false,
    commands,
    commandInputs: [undefined, undefined, "", "CODEX MEMOPLAN SAVE TEST", "\x18", "X", "W", "\r", "\x18", "E", undefined],
    commandExpectations: ["B>", "MemoPlan V1.30", "Forward", "CODEX MEMOPLAN SAVE TEST", "X - eXtra commands", "Write file", "File To Write", "File Written", "X - eXtra commands", "B>", /B:\s+CODEX\s+ME/],
    commandInstructionLimit: 8_000_000,
    returnDrive1Media: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const drive1 = result.machine?.bus.devices.fdc.drives[1];
  const modified = result.exportedDrive1Media;
  const remounted = modified ? await runAcornCpm({ drive1MediaBytes: modified, writeProtected: true, commands: ["B:", "DIR CODEX.ME"], commandExpectations: ["B>", /B:\s+CODEX\s+ME/], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const remountedScreen = remounted.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const sourceHashAfter = sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "MemoPlan_Program_Disc.dsd"))));
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive1?.disk?.dirty) && screen.some((line) => /B:\s+CODEX\s+ME/.test(line)) && remounted.passed && remountedScreen.some((line) => /B:\s+CODEX\s+ME/.test(line)) && sourceHashAfter === originalHash && Boolean(modified) && sha256(modified) !== originalHash,
    title: "MemoPlan 1.30",
    systemDrive: "CPM_Utilities_Disc.dsd",
    applicationDrive: "MemoPlan_Program_Disc.dsd",
    commands,
    marker: "MemoPlan V1.30",
    writeTransfers: result.fdc.writeTransfers,
    drive1Dirty: Boolean(drive1?.disk?.dirty),
    modifiedDrive1Bytes: result.exportedDrive1Media?.length ?? 0,
    originalHash,
    sourceHashAfter,
    modifiedHash: modified ? sha256(modified) : null,
    exportRemountPreserved: remounted.passed && remountedScreen.some((line) => /B:\s+CODEX\s+ME/.test(line)),
    hostInstructions: result.hostInstructions,
    machineTicks: result.machineTicks,
    z80TStates: result.z80TStates,
    screen,
    remountedScreen,
    reason: result.reason,
  };
}

export async function runGraphPlanGate() {
  const graphPlan = new Uint8Array(await readFile(join(ROOT, "MEDIA", "GraphPlan_Program_Disc.dsd")));
  const originalHash = sha256(graphPlan);
  const commands = ["B:", "GRAPH", "SAVE TBL", "name table", "STOP", "confirm stop", "DIR CODEX.TBL"];
  const result = await runAcornCpm({
    drive1MediaBytes: graphPlan,
    writeProtected: false,
    commands,
    commandInputs: [undefined, undefined, "112\r", "CODEX\r", "9\r", "Y\r", undefined],
    commandExpectations: ["B>", (screen) => screen.includes("MODE=NORMAL") && screen.includes("ENTER COMMAND:"), "TABLE NAME:", /saved\./i, "VERIFY (Y OR N):", "B>", /B:\s+CODEX\s+TBL/],
    commandInstructionLimit: 10_000_000,
    returnDrive1Media: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const drive1 = result.machine?.bus.devices.fdc.drives[1];
  const modified = result.exportedDrive1Media;
  const remounted = modified ? await runAcornCpm({ drive1MediaBytes: modified, writeProtected: true, commands: ["B:", "DIR CODEX.TBL"], commandExpectations: ["B>", /B:\s+CODEX\s+TBL/], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const remountedScreen = remounted.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const sourceHashAfter = sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "GraphPlan_Program_Disc.dsd"))));
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive1?.disk?.dirty) && screen.some((line) => /B:\s+CODEX\s+TBL/.test(line)) && remounted.passed && remountedScreen.some((line) => /B:\s+CODEX\s+TBL/.test(line)) && sourceHashAfter === originalHash && Boolean(modified) && sha256(modified) !== originalHash,
    title: "GraphPlan",
    systemDrive: "CPM_Utilities_Disc.dsd",
    applicationDrive: "GraphPlan_Program_Disc.dsd",
    commands,
    marker: "MODE=NORMAL + ENTER COMMAND:",
    writeTransfers: result.fdc.writeTransfers,
    drive1Dirty: Boolean(drive1?.disk?.dirty),
    modifiedDrive1Bytes: modified?.length ?? 0,
    originalHash,
    sourceHashAfter,
    modifiedHash: modified ? sha256(modified) : null,
    exportRemountPreserved: remounted.passed && remountedScreen.some((line) => /B:\s+CODEX\s+TBL/.test(line)),
    hostInstructions: result.hostInstructions,
    machineTicks: result.machineTicks,
    z80TStates: result.z80TStates,
    screen,
    remountedScreen,
    reason: result.reason,
  };
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const results = [await runBbcBasicZ80Gate(), await runMemoPlanGate(), await runGraphPlanGate()]; console.log(JSON.stringify(results, null, 2)); if (results.some(({ passed }) => !passed)) process.exitCode = 1; }
