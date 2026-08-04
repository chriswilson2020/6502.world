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

export async function runFilePlanGate() {
  const [utilities, filePlan] = await Promise.all([
    readFile(join(ROOT, "MEDIA", "CPM_Utilities_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
    readFile(join(ROOT, "MEDIA", "FilePlan_Program_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
  ]);
  const utilitiesHash = sha256(utilities); const applicationHash = sha256(filePlan);
  const commands = ["B:", "FILE", "open menu", "NAME WORKSHEET", "wait for dictionary", "create dictionary", "wait for worksheet name", "name worksheet", "wait for saved name", "open exit menu", "EXIT", "A:", "DIR DPDB.*"];
  const result = await runAcornCpm({
    drive1MediaBytes: filePlan,
    writeProtected: false,
    commands,
    commandInputs: [undefined, undefined, "\x1b", "8\r", "", "Y\r", "", "CODEX\r", "", "\x1b", "9\r", undefined, undefined],
    commandExpectations: ["B>", (screen) => screen.includes("CREATE WORKSHEET") && screen.includes("ENTER DATA:"), "CHOOSE A COMMAND", ">8 <", "CREATE DICT.", ">Y<", "NEW WORKSHEET NAME?", ">CODEX01 <", "WORKSHEET:CODEX01", "CHOOSE A COMMAND", "B>", "A>", /A:\s+DPDB/],
    commandInstructionLimit: 10_000_000,
    returnMedia: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const drive0 = result.machine?.bus.devices.fdc.drives[0]; const modified = result.exportedMedia;
  const remounted = modified ? await runAcornCpm({ mediaBytes: modified, writeProtected: true, commands: ["DIR DPDB.*"], commandExpectations: [/A:\s+DPDB/], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const remountedScreen = remounted.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const [utilitiesHashAfter, applicationHashAfter] = await Promise.all([
    readFile(join(ROOT, "MEDIA", "CPM_Utilities_Disc.dsd")).then((bytes) => sha256(bytes)),
    readFile(join(ROOT, "MEDIA", "FilePlan_Program_Disc.dsd")).then((bytes) => sha256(bytes)),
  ]);
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive0?.disk?.dirty) && screen.some((line) => /A:\s+DPDB/.test(line)) && remounted.passed && remountedScreen.some((line) => /A:\s+DPDB/.test(line)) && utilitiesHashAfter === utilitiesHash && applicationHashAfter === applicationHash && Boolean(modified) && sha256(modified) !== utilitiesHash,
    title: "FilePlan",
    systemDrive: "CPM_Utilities_Disc.dsd",
    applicationDrive: "FilePlan_Program_Disc.dsd",
    commands,
    marker: "CREATE WORKSHEET + ENTER DATA:",
    writeTransfers: result.fdc.writeTransfers,
    drive0Dirty: Boolean(drive0?.disk?.dirty),
    modifiedDrive0Bytes: modified?.length ?? 0,
    utilitiesHash,
    utilitiesHashAfter,
    applicationHash,
    applicationHashAfter,
    modifiedHash: modified ? sha256(modified) : null,
    exportRemountPreserved: remounted.passed && remountedScreen.some((line) => /A:\s+DPDB/.test(line)),
    hostInstructions: result.hostInstructions,
    machineTicks: result.machineTicks,
    z80TStates: result.z80TStates,
    screen,
    remountedScreen,
    reason: result.reason,
  };
}

export async function runCisCobolGate() {
  const cobol = new Uint8Array(await readFile(join(ROOT, "MEDIA", "CIS_Cobol_Program_Disc.dsd")));
  const originalHash = sha256(cobol);
  const commands = ["B:", "COBOL PI.CBL", "DIR PI.*"];
  const result = await runAcornCpm({
    drive1MediaBytes: cobol,
    writeProtected: false,
    commands,
    commandExpectations: ["B>", (screen) => screen.includes("**COMPILING PI.CBL") && screen.includes("** ERRORS=00000") && /B>\s*$/.test(screen), /B:\s+PI\s+CBL\s+:\s+PI\s+INT/],
    commandInstructionLimit: 25_000_000,
    returnDrive1Media: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const drive1 = result.machine?.bus.devices.fdc.drives[1];
  const modified = result.exportedDrive1Media;
  const remounted = modified ? await runAcornCpm({ drive1MediaBytes: modified, writeProtected: true, commands: ["B:", "DIR PI.*"], commandExpectations: ["B>", /B:\s+PI\s+CBL\s+:\s+PI\s+INT/], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const remountedScreen = remounted.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const sourceHashAfter = sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "CIS_Cobol_Program_Disc.dsd"))));
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive1?.disk?.dirty) && screen.some((line) => /PI\s+INT/.test(line)) && remounted.passed && remountedScreen.some((line) => /PI\s+INT/.test(line)) && sourceHashAfter === originalHash && Boolean(modified) && sha256(modified) !== originalHash,
    title: "CIS COBOL V4.5",
    systemDrive: "CPM_Utilities_Disc.dsd",
    applicationDrive: "CIS_Cobol_Program_Disc.dsd",
    commands,
    marker: "** CIS COBOL V4.5 + ** ERRORS=00000",
    writeTransfers: result.fdc.writeTransfers,
    drive1Dirty: Boolean(drive1?.disk?.dirty),
    modifiedDrive1Bytes: modified?.length ?? 0,
    originalHash,
    sourceHashAfter,
    modifiedHash: modified ? sha256(modified) : null,
    exportRemountPreserved: remounted.passed && remountedScreen.some((line) => /PI\s+INT/.test(line)),
    hostInstructions: result.hostInstructions,
    machineTicks: result.machineTicks,
    z80TStates: result.z80TStates,
    screen,
    remountedScreen,
    reason: result.reason,
  };
}

export async function runAccountantGate() {
  const [start, program, data] = await Promise.all([
    readFile(join(ROOT, "MEDIA", "Start_Of_Day_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
    readFile(join(ROOT, "MEDIA", "Accountant_Program_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
    readFile(join(ROOT, "MEDIA", "Accountant_Data_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
  ]);
  const sourceHashes = { start: sha256(start), program: sha256(program), data: sha256(data) };
  const commands = ["START", "enter date", "confirm date", "mount program A: and data B:", "select company", "open nominal ledger"];
  const result = await runAcornCpm({
    mediaBytes: start,
    expectedMediaHash: null,
    writeProtected: false,
    commands,
    commandInputs: [undefined, "040826\r", "Y\r", "\r", "1\r", "1\r"],
    commandExpectations: ["Please enter today's date", "Date OK ?", "Press 'ENTER' when ready", (screen) => screen.includes("COMPANY MENU") && screen.includes("Select number:"), (screen) => screen.includes("SYSTEM MENU") && screen.includes("Nominal ledger") && screen.includes("Select number:"), (screen) => screen.includes("PROGRAM MENU") && screen.includes("12. Monthend routine") && screen.includes("Select number:")],
    commandMediaSwaps: [undefined, undefined, undefined, { drive0MediaBytes: program, drive1MediaBytes: data }],
    commandInstructionLimit: 12_000_000,
    returnMedia: true,
    returnDrive1Media: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const modifiedProgram = result.exportedMedia;
  const remounted = modifiedProgram ? await runAcornCpm({ mediaBytes: modifiedProgram, expectedMediaHash: null, writeProtected: true, commands: ["DIR COMPMENU.DAT"], commandExpectations: [/A:\s+COMPMENU\s+DAT/], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const remountedScreen = remounted.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const sourceHashesAfter = {
    start: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "Start_Of_Day_Disc.dsd")))),
    program: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "Accountant_Program_Disc.dsd")))),
    data: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "Accountant_Data_Disc.dsd")))),
  };
  const drive0 = result.machine?.bus.devices.fdc.drives[0];
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive0?.disk?.dirty) && screen.some((line) => line.includes("PROGRAM MENU")) && screen.some((line) => line.includes("12. Monthend routine")) && remounted.passed && sourceHashesAfter.start === sourceHashes.start && sourceHashesAfter.program === sourceHashes.program && sourceHashesAfter.data === sourceHashes.data && Boolean(modifiedProgram),
    title: "Compact Accountant 1.0",
    initialDrive: "Start_Of_Day_Disc.dsd in A:",
    swap: ["Accountant_Program_Disc.dsd in A:", "Accountant_Data_Disc.dsd in B:"],
    commands,
    marker: "COMPACT MENU + Nominal ledger PROGRAM MENU",
    writeTransfers: result.fdc.writeTransfers,
    programDriveDirty: Boolean(drive0?.disk?.dirty),
    modifiedProgramBytes: modifiedProgram?.length ?? 0,
    sourceHashes,
    sourceHashesAfter,
    modifiedProgramHash: modifiedProgram ? sha256(modifiedProgram) : null,
    exportRemountPreserved: remounted.passed && remountedScreen.some((line) => /COMPMENU\s+DAT/.test(line)),
    hostInstructions: result.hostInstructions,
    machineTicks: result.machineTicks,
    z80TStates: result.z80TStates,
    screen,
    remountedScreen,
    reason: result.reason,
  };
}

async function runNucleusProgramGate({ filename, systemTitle, finalItem, menuFile }) {
  const [start, program, parameter] = await Promise.all([
    readFile(join(ROOT, "MEDIA", "Start_Of_Day_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
    readFile(join(ROOT, "MEDIA", filename)).then((bytes) => new Uint8Array(bytes)),
    readFile(join(ROOT, "MEDIA", "Nucleus_Parameter_File_Program_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
  ]);
  const sourceHashes = { start: sha256(start), program: sha256(program), parameter: sha256(parameter) };
  const commands = ["START", "enter date", "confirm date", `mount ${filename} in A: and parameter file in B:`, "select company", `open ${systemTitle}`];
  const result = await runAcornCpm({
    mediaBytes: start,
    expectedMediaHash: null,
    writeProtected: false,
    commands,
    commandInputs: [undefined, "040826\r", "Y\r", "\r", "1\r", "1\r"],
    commandExpectations: ["Please enter today's date", "Date OK ?", "Press 'ENTER' when ready", (screen) => screen.includes("COMPANY MENU") && screen.includes("Select number:"), (screen) => screen.includes("SYSTEM MENU") && screen.includes(systemTitle) && screen.includes("Select number:"), (screen) => screen.includes(systemTitle) && screen.includes("PROGRAM MENU") && screen.includes(finalItem) && screen.includes("Select number:")],
    commandMediaSwaps: [undefined, undefined, undefined, { drive0MediaBytes: program, drive1MediaBytes: parameter }],
    commandInstructionLimit: 12_000_000,
    returnMedia: true,
    returnDrive1Media: true,
    returnMachine: true,
  });
  const screen = result.commands.at(-1)?.screen.map((line) => line.trimEnd()).filter(Boolean) ?? [];
  const exportedProgram = result.exportedMedia;
  const remounted = exportedProgram ? await runAcornCpm({ mediaBytes: exportedProgram, expectedMediaHash: null, writeProtected: true, commands: [`DIR ${menuFile}`], commandExpectations: [new RegExp(`A:\\s+${menuFile.replace(".", "\\s+")}`)], commandInstructionLimit: 5_000_000 }) : { passed: false, commands: [] };
  const sourceHashesAfter = {
    start: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "Start_Of_Day_Disc.dsd")))),
    program: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", filename)))),
    parameter: sha256(new Uint8Array(await readFile(join(ROOT, "MEDIA", "Nucleus_Parameter_File_Program_Disc.dsd")))),
  };
  const drive0 = result.machine?.bus.devices.fdc.drives[0];
  return {
    passed: result.passed && result.fdc.writeTransfers > 0 && Boolean(drive0?.disk?.dirty) && screen.some((line) => line.includes("PROGRAM MENU")) && screen.some((line) => line.includes(finalItem)) && remounted.passed && sourceHashesAfter.start === sourceHashes.start && sourceHashesAfter.program === sourceHashes.program && sourceHashesAfter.parameter === sourceHashes.parameter && Boolean(exportedProgram),
    program: filename,
    systemTitle,
    finalItem,
    menuFile,
    commands,
    writeTransfers: result.fdc.writeTransfers,
    programDriveDirty: Boolean(drive0?.disk?.dirty),
    exportedProgramBytes: exportedProgram?.length ?? 0,
    exportedProgramHash: exportedProgram ? sha256(exportedProgram) : null,
    sourceHashes,
    sourceHashesAfter,
    exportRemountPreserved: remounted.passed,
    screen,
    reason: result.reason,
  };
}

export async function runNucleusGate() {
  const definitions = await runNucleusProgramGate({ filename: "Nucleus_Definitions_Program_Disc.dsd", systemTitle: "Nucleus - Definition", finalItem: "6. Create update program", menuFile: "NDMENU.DAT" });
  const reporter = await runNucleusProgramGate({ filename: "Nucleus_Reporter_Program_Disc.dsd", systemTitle: "Nucleus - Reporting", finalItem: "5. Create document program", menuFile: "NRMENU.DAT" });
  return { passed: definitions.passed && reporter.passed, title: "Compact Nucleus Definition and Reporting", marker: "Nucleus Definition + Reporting PROGRAM MENU", definitions, reporter };
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const results = [await runBbcBasicZ80Gate(), await runMemoPlanGate(), await runGraphPlanGate(), await runFilePlanGate(), await runCisCobolGate(), await runAccountantGate(), await runNucleusGate()]; console.log(JSON.stringify(results, null, 2)); if (results.some(({ passed }) => !passed)) process.exitCode = 1; }
