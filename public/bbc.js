import { BbcMicroModelB } from "./src/machine/bbc/model-b.js";
import { bbcKeyboardCodeForBrowserEvent } from "./src/machine/bbc/system-via.js";

const elements = Object.fromEntries(["bbcScreen", "bbcRunState", "bbcStatus", "osRomInput", "basicRomInput", "bootBbcButton", "demoBbcButton", "bbcRomBank", "bbcPc", "bbcCycles", "bbcTicks", "bbcIrq", "pauseBbcButton", "enableAudioButton", "uefInput", "playTapeButton", "rewindTapeButton", "ssdInput", "exportSsdButton", "mediaState", "mediaStatus", "bbcTextMirror", "bbcBreakpointCount", "bbcBreakpointInput", "toggleBbcBreakpointButton", "stepBbcButton", "bbcDisassembly", "exportBbcStateButton", "bbcStateInput", "bbcDebuggerStatus", "tubeRomInput", "attachTubeButton", "tubeState", "tubeStatus", "tubePc", "tubeTstates"].map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.bbcScreen.getContext("2d");
let machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
let osRom = null; let basicRom = null; let running = false; let frame = null; let demo = true;
const activeBrowserKeys = new Map();
let mountedSsdName = "disc.ssd"; let audio = null; let tubeBootRom = null;
const bbcBreakpoints = new Set();
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, "0");

async function readSelected(input, fallback) { const [file] = input.files; return file ? new Uint8Array(await file.arrayBuffer()) : fallback; }
async function fetchRom(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Unable to load ${path}.`); return new Uint8Array(await response.arrayBuffer()); }
function status(message, label = "READY") { elements.bbcStatus.textContent = message; elements.bbcRunState.textContent = label; elements.bbcRunState.className = `status ${label === "ERROR" ? "error" : "live"}`; }

function draw() {
  const rows = machine.video.textSnapshot();
  context.fillStyle = "#050706"; context.fillRect(0, 0, 640, 500);
  context.fillStyle = "#f4f4ec"; context.font = '18px "SFMono-Regular", Consolas, monospace'; context.textBaseline = "top";
  rows.forEach((row, index) => context.fillText(row, 12, 10 + index * 19));
  const textScreen = rows.join("\n"); if (elements.bbcTextMirror.textContent !== textScreen) elements.bbcTextMirror.textContent = textScreen;
  elements.bbcPc.textContent = hex(machine.cpu.pc);
  elements.bbcCycles.textContent = machine.cpu.cycles.toLocaleString();
  elements.bbcTicks.textContent = machine.machineTicks.toLocaleString();
  elements.bbcIrq.textContent = machine.cpu.irqLine ? "HIGH" : "LOW";
  elements.bbcRomBank.textContent = `ROM ${machine.bus.selectedRom}`;
  elements.tubePc.textContent = machine.parasite ? hex(machine.parasite.cpu.PC) : "0000";
  elements.tubeTstates.textContent = machine.parasite ? machine.parasite.cpu.tStates.toLocaleString() : "0";
  renderBbcDebugger();
  audio?.sync(machine.bus.devices.sound.channelState());
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
    if (tubeBootRom) machine.attachZ80SecondProcessor({ bootRom: tubeBootRom });
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
  try { for (let count = 0; count < 50000; count += 1) { if (machine.cpu.instructionBoundary && bbcBreakpoints.has(machine.cpu.pc)) { running = false; status(`Breakpoint reached at $${hex(machine.cpu.pc)}.`, "BREAK"); break; } machine.clock(); } }
  catch (error) { running = false; status(error.message, "ERROR"); draw(); return; }
  draw(); schedule();
}
function stop() { running = false; if (frame != null) cancelAnimationFrame(frame); frame = null; }

elements.bootBbcButton.addEventListener("click", boot);
elements.demoBbcButton.addEventListener("click", demoScreen);
elements.pauseBbcButton.addEventListener("click", () => { if (demo) return; running = !running; status(running ? "Machine running." : "Machine paused.", running ? "RUNNING" : "PAUSED"); if (running) schedule(); });
elements.bbcScreen.addEventListener("keydown", (event) => { const key = bbcKeyboardCodeForBrowserEvent(event.code, event.key); if (!key) return; event.preventDefault(); const matrixCode = `${key[0]}:${key[1]}`; activeBrowserKeys.set(event.code, matrixCode); machine.bus.keyboard.press(matrixCode); });
elements.bbcScreen.addEventListener("keyup", (event) => { const matrixCode = activeBrowserKeys.get(event.code); if (!matrixCode) return; event.preventDefault(); machine.bus.keyboard.release(matrixCode); activeBrowserKeys.delete(event.code); });
elements.bbcScreen.addEventListener("blur", () => { machine.bus.keyboard.clear(); activeBrowserKeys.clear(); });

function renderBbcDebugger() {
  let address = machine.cpu.instructionBoundary ? machine.cpu.pc : machine.cpu.currentInstructionAddress ?? machine.cpu.pc; const lines = [];
  for (let index = 0; index < 7; index += 1) { try { const instruction = machine.cpu.disassemble(address); lines.push(`${bbcBreakpoints.has(address) ? "●" : " "} $${hex(address)}  ${instruction.text}`); address = (address + instruction.length) & 0xffff; } catch { break; } }
  elements.bbcDisassembly.textContent = lines.join("\n"); elements.bbcBreakpointCount.textContent = `${bbcBreakpoints.size} BREAKPOINT${bbcBreakpoints.size === 1 ? "" : "S"}`;
}
function parseBbcAddress(value) { const normalized = String(value).trim().replace(/^\$/, "").replace(/^0x/i, ""); if (!/^[0-9a-f]{1,4}$/i.test(normalized)) throw new Error("Enter a four-digit hexadecimal address."); return Number.parseInt(normalized, 16); }
function boundary() { while (!machine.cpu.instructionBoundary) machine.clock(); }

elements.toggleBbcBreakpointButton.addEventListener("click", () => { try { const address = parseBbcAddress(elements.bbcBreakpointInput.value); if (bbcBreakpoints.has(address)) bbcBreakpoints.delete(address); else bbcBreakpoints.add(address); elements.bbcDebuggerStatus.textContent = `Breakpoint ${bbcBreakpoints.has(address) ? "set" : "cleared"} at $${hex(address)}.`; draw(); } catch (error) { elements.bbcDebuggerStatus.textContent = error.message; } });
elements.stepBbcButton.addEventListener("click", () => { stop(); boundary(); const at = machine.cpu.pc; const result = machine.step(); elements.bbcDebuggerStatus.textContent = `Stepped $${hex(at)} in ${result.cycles} cycles.`; status("Machine paused after one instruction.", "PAUSED"); draw(); });
elements.exportBbcStateButton.addEventListener("click", () => { stop(); boundary(); const state = machine.exportState(); state.debugger = { breakpoints: [...bbcBreakpoints] }; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: "application/json" })); link.download = `6502-world-bbc-${hex(machine.cpu.pc)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); elements.bbcDebuggerStatus.textContent = `Portable BBC state captured at $${hex(machine.cpu.pc)}.`; status("Machine paused for state export.", "PAUSED"); draw(); });
elements.bbcStateInput.addEventListener("change", async () => { try { const [file] = elements.bbcStateInput.files; if (!file) return; stop(); const state = JSON.parse(await file.text()); machine.importState(state); bbcBreakpoints.clear(); for (const address of state.debugger?.breakpoints ?? []) bbcBreakpoints.add(address & 0xffff); demo = false; mountedSsdName = "restored-disc.ssd"; elements.exportSsdButton.disabled = !machine.bus.devices.fdc.disk; elements.bbcDebuggerStatus.textContent = `${file.name} restored at $${hex(machine.cpu.pc)}.`; status("Portable BBC state restored.", "PAUSED"); draw(); } catch (error) { elements.bbcDebuggerStatus.textContent = error.message; status(error.message, "ERROR"); } finally { elements.bbcStateInput.value = ""; } });

elements.enableAudioButton.addEventListener("click", async () => {
  audio ??= new BrowserSnAudio(); await audio.enable();
  elements.enableAudioButton.textContent = "BBC sound enabled"; elements.mediaState.textContent = "AUDIO"; elements.mediaState.className = "status live";
});
elements.uefInput.addEventListener("change", async () => {
  try { const bytes = await readSelected(elements.uefInput, null); const tape = machine.loadUef(bytes); elements.mediaStatus.textContent = `UEF ${tape.version}: ${tape.data.length.toLocaleString()} decoded data bytes.`; elements.mediaState.textContent = "TAPE"; elements.mediaState.className = "status live"; }
  catch (error) { elements.mediaStatus.textContent = error.message; elements.mediaState.textContent = "ERROR"; elements.mediaState.className = "status error"; }
});
elements.playTapeButton.addEventListener("click", () => { if (!machine.cassette) return; machine.cassette.playing ? machine.cassette.pause() : machine.cassette.play(); elements.playTapeButton.textContent = machine.cassette.playing ? "Pause" : "Play"; });
elements.rewindTapeButton.addEventListener("click", () => { machine.cassette?.rewind(); elements.mediaStatus.textContent = machine.cassette ? "Cassette rewound to the first decoded block." : "Choose a UEF cassette first."; });
elements.ssdInput.addEventListener("change", async () => {
  try { const [file] = elements.ssdInput.files; if (!file) return; mountedSsdName = file.name; const disk = machine.mountSsd(new Uint8Array(await file.arrayBuffer())); elements.exportSsdButton.disabled = false; elements.mediaStatus.textContent = `${file.name}: ${disk.tracks} tracks mounted read/write.`; elements.mediaState.textContent = "SSD"; elements.mediaState.className = "status live"; }
  catch (error) { elements.mediaStatus.textContent = error.message; elements.mediaState.textContent = "ERROR"; elements.mediaState.className = "status error"; }
});
elements.exportSsdButton.addEventListener("click", () => {
  const disk = machine.bus.devices.fdc.disk; if (!disk) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([disk.export()], { type: "application/octet-stream" })); link.download = mountedSsdName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
});

elements.attachTubeButton.addEventListener("click", async () => {
  try {
    tubeBootRom = await readSelected(elements.tubeRomInput, tubeBootRom ?? new Uint8Array());
    const parasite = machine.attachZ80SecondProcessor({ bootRom: tubeBootRom });
    elements.tubeState.textContent = "Z80 6MHz"; elements.tubeState.className = "status live";
    elements.tubeStatus.textContent = `${tubeBootRom.length ? `${tubeBootRom.length.toLocaleString()}-byte boot ROM loaded; ` : "No boot ROM; "}shared Z80 World core attached at PC $${hex(parasite.cpu.PC)}.`;
    draw();
  } catch (error) { elements.tubeState.textContent = "ERROR"; elements.tubeState.className = "status error"; elements.tubeStatus.textContent = error.message; }
});

async function startBundledMachine() {
  try {
    [osRom, basicRom] = await Promise.all([fetchRom("ROM/os12.rom"), fetchRom("ROM/basic2.rom")]);
    await boot();
  } catch (error) {
    demoScreen(); status(`${error.message} You can still choose local ROM files.`, "ERROR");
  }
}

startBundledMachine();

class BrowserSnAudio {
  async enable() {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = 0.08; this.master.connect(this.context.destination);
      this.voices = Array.from({ length: 3 }, () => { const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); oscillator.type = "square"; oscillator.connect(gain).connect(this.master); gain.gain.value = 0; oscillator.start(); return { oscillator, gain }; });
      const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate); const data = buffer.getChannelData(0); for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      this.noise = this.context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true; this.noiseGain = this.context.createGain(); this.noiseGain.gain.value = 0; this.noise.connect(this.noiseGain).connect(this.master); this.noise.start();
    }
    await this.context.resume();
  }
  sync(state) {
    if (!this.context) return; const now = this.context.currentTime;
    state.tones.forEach((tone, index) => { this.voices[index].oscillator.frequency.setTargetAtTime(Math.min(20000, tone.frequency), now, 0.005); this.voices[index].gain.gain.setTargetAtTime(tone.gain, now, 0.005); });
    this.noiseGain.gain.setTargetAtTime(state.noise.gain * 0.5, now, 0.005);
  }
}
