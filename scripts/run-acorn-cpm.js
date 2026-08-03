import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";
import { BBC_KEYBOARD_CODES } from "../src/machine/bbc/system-via.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UTILITIES_HASH = "9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a";
const KEY_FOR_CHARACTER = Object.freeze({
  A: "KeyA", B: "KeyB", C: "KeyC", D: "KeyD", E: "KeyE", F: "KeyF", G: "KeyG", H: "KeyH", I: "KeyI", J: "KeyJ", K: "KeyK", L: "KeyL", M: "KeyM",
  N: "KeyN", O: "KeyO", P: "KeyP", Q: "KeyQ", R: "KeyR", S: "KeyS", T: "KeyT", U: "KeyU", V: "KeyV", W: "KeyW", X: "KeyX", Y: "KeyY", Z: "KeyZ",
  " ": "Space", "\r": "Enter", "\n": "Enter",
});

export async function runAcornCpm({ bootInstructionLimit = 6_000_000, commandInstructionLimit = 3_000_000 } = {}) {
  const names = ["os12.rom", "basic2.rom", "dnfs.rom", "z80.rom"];
  const [os, basic, dnfs, z80, utilities] = await Promise.all([
    ...names.map(async (name) => new Uint8Array(await readFile(join(ROOT, "ROM", name)))),
    readFile(join(ROOT, "MEDIA", "CPM_Utilities_Disc.dsd")).then((bytes) => new Uint8Array(bytes)),
  ]);
  const hashes = Object.fromEntries([...names.map((name, index) => [name, sha256([os, basic, dnfs, z80][index])]), ["CPM_Utilities_Disc.dsd", sha256(utilities)]]);
  if (hashes["CPM_Utilities_Disc.dsd"] !== UTILITIES_HASH) throw new Error(`CP/M Utilities DSD hash mismatch: ${hashes["CPM_Utilities_Disc.dsd"]}`);

  const machine = new BbcMicroModelB({ traceLimit: 64, accessLogLimit: 0 });
  machine.loadSidewaysRom(15, basic); machine.loadSidewaysRom(14, dnfs);
  machine.mountDsd(utilities, { drive: 0, writeProtected: true });
  const parasite = machine.attachZ80SecondProcessor({ bootRom: z80 });
  const tubeTranscript = []; const tube = machine.bus.devices.tube; const parasiteWrite = tube.parasiteWrite.bind(tube);
  tube.parasiteWrite = (offset, value) => {
    const before = tube.parasiteToHost[0].length; parasiteWrite(offset, value);
    if ((offset & 7) === 1 && tube.parasiteToHost[0].length > before) tubeTranscript.push(value & 0xff);
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
  for (const command of ["DIR", "STAT"]) {
    const promptsBefore = promptCount(screenText(machine));
    typeThroughKeyboard(machine, command + "\r", () => { hostInstructions += 1; });
    const completed = runUntil((screen) => promptCount(screen) > promptsBefore, commandInstructionLimit);
    commands.push({ command, completed, screen: machine.video.textSnapshot() });
    if (!completed) return report({ passed: false, reason: `${command.toLowerCase()}-limit`, machine, parasite, hashes, hostInstructions, tubeTranscript, commands });
  }
  const screen = screenText(machine);
  const directoryPlausible = /(?:\.COM|\.ASM|\.SUB|\bSTAT\b|\bDIR\b)/.test(commands[0].screen.join("\n"));
  const statPlausible = /(?:STAT|Bytes|K\s|Read Only|R\/O)/i.test(commands[1].screen.join("\n"));
  return report({ passed: booted && directoryPlausible && statPlausible && promptCount(screen) >= 3, reason: "complete", machine, parasite, hashes, hostInstructions, tubeTranscript, commands });
}

function typeThroughKeyboard(machine, text, onInstruction) {
  for (const character of text) {
    const code = KEY_FOR_CHARACTER[character.toUpperCase() === character ? character : character.toUpperCase()];
    const matrix = BBC_KEYBOARD_CODES[code];
    if (!matrix) throw new Error(`No BBC keyboard mapping for ${JSON.stringify(character)}`);
    const key = `${matrix[0]}:${matrix[1]}`;
    machine.bus.keyboard.press(key); runInstructions(machine, 12_000, onInstruction);
    machine.bus.keyboard.release(key); runInstructions(machine, 12_000, onInstruction);
  }
}
function runInstructions(machine, count, onInstruction) { for (let index = 0; index < count; index += 1) { machine.step(); onInstruction(); } }
function screenText(machine) { return machine.video.textSnapshot().map((line) => line.replace(/\s+$/, "")).join("\n"); }
function promptCount(text) { return text.match(/A>/g)?.length ?? 0; }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function cleanTranscript(bytes) { return new TextDecoder().decode(Uint8Array.from(bytes)).replace(/[^\x20-\x7e\r\n]/g, ""); }
function report({ passed, reason, machine, parasite, hashes, hostInstructions, tubeTranscript, commands }) {
  const fdc = machine.bus.devices.fdc; const tube = machine.bus.devices.tube;
  return {
    passed, reason, hashes, hostInstructions, machineTicks: machine.machineTicks, hostPc: machine.cpu.pc,
    z80Pc: parasite.cpu.PC, z80TStates: parasite.cpu.tStates, z80Instructions: parasite.cpu.instructionFetches,
    screen: machine.video.textSnapshot(), transcript: cleanTranscript(tubeTranscript), commands,
    tube: { control: tube.control, fifoLengths: { hostToParasite: tube.hostToParasite.map((queue) => queue.length), parasiteToHost: tube.parasiteToHost.map((queue) => queue.length) }, hostIrq: tube.hostIrq, parasiteIrq: tube.parasiteIrq, parasiteNmi: tube.parasiteNmi },
    fdc: { status: fdc.status, result: fdc.result, trace: fdc.trace.slice(-32) },
    hostTrace: machine.cpu.trace.slice(-32), z80Bytes: Array.from(parasite.ram.slice(parasite.cpu.PC, parasite.cpu.PC + 16)),
  };
}
function hex(value) { return `$${value.toString(16).toUpperCase().padStart(4, "0")}`; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runAcornCpm();
  console.log(JSON.stringify({ ...result, hostPc: hex(result.hostPc), z80Pc: hex(result.z80Pc), screen: result.screen.map((line) => line.replace(/\s+$/, "")), commands: result.commands.map(({ command, completed, screen }) => ({ command, completed, screen: screen.map((line) => line.replace(/\s+$/, "").trimEnd()).filter(Boolean) })) }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
