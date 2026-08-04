import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";
import { BBC_KEYBOARD_CODES } from "../src/machine/bbc/system-via.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UTILITIES_HASH = "9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a";
const TUBE_TRANSCRIPT_LIMIT = 8192;
const KEY_FOR_CHARACTER = Object.freeze({
  A: "KeyA", B: "KeyB", C: "KeyC", D: "KeyD", E: "KeyE", F: "KeyF", G: "KeyG", H: "KeyH", I: "KeyI", J: "KeyJ", K: "KeyK", L: "KeyL", M: "KeyM",
  N: "KeyN", O: "KeyO", P: "KeyP", Q: "KeyQ", R: "KeyR", S: "KeyS", T: "KeyT", U: "KeyU", V: "KeyV", W: "KeyW", X: "KeyX", Y: "KeyY", Z: "KeyZ",
  "0": "Digit0", "1": "Digit1", "2": "Digit2", "3": "Digit3", "4": "Digit4", "5": "Digit5", "6": "Digit6", "7": "Digit7", "8": "Digit8", "9": "Digit9",
  " ": "Space", ".": "Period", ":": "Colon", "/": "Slash", "-": "Minus", "\r": "Enter", "\n": "Enter",
});

export async function runAcornCpm({ bootInstructionLimit = 6_000_000, commandInstructionLimit = 3_000_000, commands: requestedCommands = ["DIR", "STAT"], commandExpectations = [], writeProtected = true, mediaBytes, drive1MediaBytes, expectedMediaHash = mediaBytes ? null : UTILITIES_HASH, returnMedia = false, returnMachine = false } = {}) {
  const names = ["os12.rom", "basic2.rom", "dnfs.rom", "z80.rom"];
  const [os, basic, dnfs, z80, utilities] = await Promise.all([
    ...names.map(async (name) => new Uint8Array(await readFile(join(ROOT, "ROM", name)))),
    mediaBytes ? Uint8Array.from(mediaBytes) : readFile(join(ROOT, "MEDIA", "CPM_Utilities_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
  ]);
  const hashes = Object.fromEntries([...names.map((name, index) => [name, sha256([os, basic, dnfs, z80][index])]), ["CPM_Utilities_Disc.dsd", sha256(utilities)]]);
  if (expectedMediaHash && hashes["CPM_Utilities_Disc.dsd"] !== expectedMediaHash) throw new Error(`CP/M Utilities DSD hash mismatch: ${hashes["CPM_Utilities_Disc.dsd"]}`);

  const machine = new BbcMicroModelB({ traceLimit: 64, accessLogLimit: 0 });
  machine.loadSidewaysRom(15, basic); machine.loadSidewaysRom(14, dnfs);
  machine.mountDsd(utilities, { drive: 0, writeProtected });
  if (drive1MediaBytes) machine.mountDsd(drive1MediaBytes, { drive: 1, writeProtected });
  const parasite = machine.attachZ80SecondProcessor({ bootRom: z80 });
  const tubeTranscript = []; const tube = machine.bus.devices.tube; const parasiteWrite = tube.parasiteWrite.bind(tube);
  tube.parasiteWrite = (offset, value) => {
    const before = tube.parasiteToHost[0].length; parasiteWrite(offset, value);
    if ((offset & 7) === 1 && tube.parasiteToHost[0].length > before) { tubeTranscript.push(value & 0xff); if (tubeTranscript.length > TUBE_TRANSCRIPT_LIMIT) tubeTranscript.splice(0, tubeTranscript.length - TUBE_TRANSCRIPT_LIMIT); }
  };
  // Loading the OS performs the same machine reset used by the browser.
  machine.loadOsRom(os);

  let hostInstructions = 0;
  const runUntil = (predicate, limit) => {
    for (let count = 0; count < limit; count += 1) {
      machine.step(); hostInstructions += 1;
      if (count % 1000 === 0 && predicate(screenText(machine))) return true;
    }
    return predicate(screenText(machine));
  };
  const booted = runUntil((screen) => screen.includes("Acorn CP/M 2.2 - Bios 1.20") && promptCount(screen) >= 1, bootInstructionLimit);
  if (!booted) return report({ passed: false, reason: "boot-limit", machine, parasite, hashes, hostInstructions, tubeTranscript, commands: [] });

  const commands = [];
  for (let index = 0; index < requestedCommands.length; index += 1) {
    const command = requestedCommands[index]; const expectation = commandExpectations[index];
    const promptsBefore = promptCount(screenText(machine));
    typeThroughKeyboard(machine, command === "\x03" ? command : command + "\r", () => { hostInstructions += 1; });
    const completed = runUntil((screen) => expectation ? matchesExpectation(screen, expectation) : promptCount(screen) > promptsBefore, commandInstructionLimit);
    commands.push({ command, completed, screen: machine.video.textSnapshot() });
    if (!completed) return report({ passed: false, reason: `${command.toLowerCase()}-limit`, machine, parasite, hashes, hostInstructions, tubeTranscript, commands });
  }
  const screen = screenText(machine);
  const defaultGate = requestedCommands.length === 2 && requestedCommands[0] === "DIR" && requestedCommands[1] === "STAT";
  const directoryPlausible = !defaultGate || /(?:\.COM|\.ASM|\.SUB|\bSTAT\b|\bDIR\b)/.test(commands[0].screen.join("\n"));
  const statPlausible = !defaultGate || /(?:STAT|Bytes|K\s|Read Only|R\/O)/i.test(commands[1].screen.join("\n"));
  const promptGate = commandExpectations.some(Boolean) || promptCount(screen) >= requestedCommands.length + 1;
  const result = report({ passed: booted && commands.every(({ completed }) => completed) && directoryPlausible && statPlausible && promptGate, reason: "complete", machine, parasite, hashes, hostInstructions, tubeTranscript, commands });
  if (returnMedia) result.exportedMedia = machine.bus.devices.fdc.drives[0].disk.export();
  if (returnMachine) result.machine = machine;
  return result;
}

function typeThroughKeyboard(machine, text, onInstruction) {
  for (const character of text) {
    if (character === "\x03") { pressChord(machine, [BBC_KEYBOARD_CODES.ControlLeft, BBC_KEYBOARD_CODES.KeyC], onInstruction); continue; }
    const code = KEY_FOR_CHARACTER[character.toUpperCase() === character ? character : character.toUpperCase()];
    const matrix = BBC_KEYBOARD_CODES[code];
    if (!matrix) throw new Error(`No BBC keyboard mapping for ${JSON.stringify(character)}`);
    const key = `${matrix[0]}:${matrix[1]}`;
    machine.bus.keyboard.press(key); runInstructions(machine, 12_000, onInstruction);
    machine.bus.keyboard.release(key); runInstructions(machine, 12_000, onInstruction);
  }
}
function pressChord(machine, matrices, onInstruction) { const keys = matrices.map(([column, row]) => `${column}:${row}`); keys.forEach((key) => machine.bus.keyboard.press(key)); runInstructions(machine, 12_000, onInstruction); keys.reverse().forEach((key) => machine.bus.keyboard.release(key)); runInstructions(machine, 12_000, onInstruction); }
function runInstructions(machine, count, onInstruction) { for (let index = 0; index < count; index += 1) { machine.step(); onInstruction(); } }
function screenText(machine) { return machine.video.textSnapshot().map((line) => line.replace(/\s+$/, "")).join("\n"); }
function promptCount(text) { return text.match(/A>/g)?.length ?? 0; }
function matchesExpectation(text, expectation) { if (typeof expectation === "string") return text.includes(expectation); if (expectation instanceof RegExp) { expectation.lastIndex = 0; return expectation.test(text); } if (typeof expectation === "function") return Boolean(expectation(text)); throw new TypeError("CP/M command expectation must be a string, RegExp or function"); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function cleanTranscript(bytes) { return new TextDecoder().decode(Uint8Array.from(bytes)).replace(/[^\x20-\x7e\r\n]/g, ""); }
function report({ passed, reason, machine, parasite, hashes, hostInstructions, tubeTranscript, commands }) {
  const fdc = machine.bus.devices.fdc; const tube = machine.bus.devices.tube;
  return {
    passed, reason, hashes, hostInstructions, machineTicks: machine.machineTicks, hostPc: machine.cpu.pc,
    z80Pc: parasite.cpu.PC, z80TStates: parasite.cpu.tStates, z80Instructions: parasite.cpu.instructionFetches,
    screen: machine.video.textSnapshot(), transcript: cleanTranscript(tubeTranscript), commands,
    tube: { control: tube.control, fifoLengths: { hostToParasite: tube.hostToParasite.map((queue) => queue.length), parasiteToHost: tube.parasiteToHost.map((queue) => queue.length) }, hostIrq: tube.hostIrq, parasiteIrq: tube.parasiteIrq, parasiteNmi: tube.parasiteNmi },
    mediaDirty: Boolean(fdc.drives[0].disk?.dirty), fdc: { status: fdc.status, result: fdc.result, readTransfers: fdc.readTransfers, writeTransfers: fdc.writeTransfers, trace: fdc.trace.slice(-32) },
    hostTrace: machine.cpu.trace.slice(-32), z80Bytes: Array.from(parasite.ram.slice(parasite.cpu.PC, parasite.cpu.PC + 16)),
  };
}
function hex(value) { return `$${value.toString(16).toUpperCase().padStart(4, "0")}`; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runAcornCpm();
  console.log(JSON.stringify({ ...result, hostPc: hex(result.hostPc), z80Pc: hex(result.z80Pc), screen: result.screen.map((line) => line.replace(/\s+$/, "")), commands: result.commands.map(({ command, completed, screen }) => ({ command, completed, screen: screen.map((line) => line.replace(/\s+$/, "").trimEnd()).filter(Boolean) })) }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
