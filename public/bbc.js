import { BbcMicroModelB } from "../src/machine/bbc/model-b.js";
import { BBC_KEYBOARD_CODES } from "../src/machine/bbc/system-via.js";

const elements = Object.fromEntries(["bbcScreen", "bbcRunState", "bbcStatus", "osRomInput", "basicRomInput", "bootBbcButton", "demoBbcButton", "bbcRomBank", "bbcPc", "bbcCycles", "bbcTicks", "bbcIrq", "pauseBbcButton"].map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.bbcScreen.getContext("2d");
let machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
let osRom = null; let basicRom = null; let running = false; let frame = null; let demo = true;
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, "0");

async function readSelected(input, fallback) { const [file] = input.files; return file ? new Uint8Array(await file.arrayBuffer()) : fallback; }
async function fetchRom(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Unable to load ${path}.`); return new Uint8Array(await response.arrayBuffer()); }
function status(message, label = "READY") { elements.bbcStatus.textContent = message; elements.bbcRunState.textContent = label; elements.bbcRunState.className = `status ${label === "ERROR" ? "error" : "live"}`; }

function draw() {
  const rows = machine.video.textSnapshot();
  context.fillStyle = "#050706"; context.fillRect(0, 0, 640, 500);
  context.fillStyle = "#f4f4ec"; context.font = '18px "SFMono-Regular", Consolas, monospace'; context.textBaseline = "top";
  rows.forEach((row, index) => context.fillText(row, 12, 10 + index * 19));
  elements.bbcPc.textContent = hex(machine.cpu.pc);
  elements.bbcCycles.textContent = machine.cpu.cycles.toLocaleString();
  elements.bbcTicks.textContent = machine.machineTicks.toLocaleString();
  elements.bbcIrq.textContent = machine.cpu.irqLine ? "HIGH" : "LOW";
  elements.bbcRomBank.textContent = `ROM ${machine.bus.selectedRom}`;
}

function demoScreen() {
  stop(); demo = true; machine = new BbcMicroModelB();
  const text = ["BBC Computer 32K", "", "Acorn DFS", "", "BASIC", "", ">_"];
  text.forEach((line, row) => machine.bus.ram.set(new TextEncoder().encode(line), 0x7c00 + row * 40));
  status("Firmware-free renderer demo. Load OS and BASIC ROMs for a machine boot.", "DEMO"); draw(); elements.bbcScreen.focus();
}

async function boot() {
  try {
    osRom = await readSelected(elements.osRomInput, osRom); basicRom = await readSelected(elements.basicRomInput, basicRom);
    if (!osRom || osRom.length !== 0x4000) throw new Error("Choose a 16K BBC Model B OS ROM.");
    if (basicRom && basicRom.length !== 0x2000 && basicRom.length !== 0x4000) throw new Error("BASIC ROM must be 8K or 16K.");
    machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
    if (basicRom) machine.loadSidewaysRom(15, basicRom);
    machine.loadOsRom(osRom); demo = false; running = true;
    status(`Booting local OS${basicRom ? " + BASIC" : ""}. Click the display to type.`, "RUNNING");
    elements.bbcScreen.focus(); schedule();
  } catch (error) { status(error.message, "ERROR"); }
}

function schedule() { if (frame == null) frame = requestAnimationFrame(runFrame); }
function runFrame() {
  frame = null;
  if (!running) return;
  try { for (let count = 0; count < 50000; count += 1) machine.clock(); }
  catch (error) { running = false; status(error.message, "ERROR"); draw(); return; }
  draw(); schedule();
}
function stop() { running = false; if (frame != null) cancelAnimationFrame(frame); frame = null; }

elements.bootBbcButton.addEventListener("click", boot);
elements.demoBbcButton.addEventListener("click", demoScreen);
elements.pauseBbcButton.addEventListener("click", () => { if (demo) return; running = !running; status(running ? "Machine running." : "Machine paused.", running ? "RUNNING" : "PAUSED"); if (running) schedule(); });
elements.bbcScreen.addEventListener("keydown", (event) => { const key = BBC_KEYBOARD_CODES[event.code]; if (!key) return; event.preventDefault(); machine.bus.keyboard.press(`${key[0]}:${key[1]}`); });
elements.bbcScreen.addEventListener("keyup", (event) => { const key = BBC_KEYBOARD_CODES[event.code]; if (!key) return; event.preventDefault(); machine.bus.keyboard.release(`${key[0]}:${key[1]}`); });
elements.bbcScreen.addEventListener("blur", () => machine.bus.keyboard.clear());

async function startBundledMachine() {
  try {
    [osRom, basicRom] = await Promise.all([fetchRom("ROM/os12.rom"), fetchRom("ROM/basic2.rom")]);
    await boot();
  } catch (error) {
    demoScreen(); status(`${error.message} You can still choose local ROM files.`, "ERROR");
  }
}

startBundledMachine();
