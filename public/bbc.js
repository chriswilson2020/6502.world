import { BbcMicroModelB } from "./src/machine/bbc/model-b.js";
import { bbcKeyboardCodeForBrowserEvent } from "./src/machine/bbc/system-via.js";

const elements = Object.fromEntries(["bbcScreen", "bbcRunState", "bbcStatus", "osRomInput", "basicRomInput", "bootBbcButton", "demoBbcButton", "bbcRomBank", "bbcPc", "bbcCycles", "bbcTicks", "bbcIrq", "pauseBbcButton", "enableAudioButton", "uefInput", "playTapeButton", "rewindTapeButton", "ssdInput", "drive1Input", "drive0WriteProtect", "drive1WriteProtect", "exportSsdButton", "exportDrive1Button", "mediaState", "mediaStatus", "bbcTextMirror", "bbcBreakpointCount", "bbcBreakpointInput", "toggleBbcBreakpointButton", "stepBbcButton", "bbcDisassembly", "exportBbcStateButton", "bbcStateInput", "bbcDebuggerStatus", "tubeRomInput", "attachTubeButton", "bootCpmButton", "tubeState", "tubeStatus", "tubePc", "tubeTstates", "tubeTranscript"].map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.bbcScreen.getContext("2d");
let machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
let osRom = null; let basicRom = null; let dnfsRom = null; let running = false; let frame = null; let demo = true; let cpmBoot = false;
const activeBrowserKeys = new Map();
const mountedMediaNames = ["drive-0.ssd", "drive-1.ssd"]; let audio = null; let tubeBootRom = null; let tubeEnabled = false; let tubeOutput = [];
const bbcBreakpoints = new Set();
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, "0");

async function readSelected(input, fallback) { const [file] = input.files; return file ? new Uint8Array(await file.arrayBuffer()) : fallback; }
async function fetchRom(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Unable to load ${path}.`); return new Uint8Array(await response.arrayBuffer()); }
function status(message, label = "READY") { elements.bbcStatus.textContent = message; elements.bbcRunState.textContent = label; elements.bbcRunState.className = `status ${label === "ERROR" ? "error" : "live"}`; }

function draw() {
  const rows = machine.video.textSnapshot();
  context.fillStyle = "#050706"; context.fillRect(0, 0, 640, 500);
  const wide = rows.some((row) => row.length > 40); const lineHeight = wide ? 15 : 19;
  context.fillStyle = "#f4f4ec"; context.font = `${wide ? 9 : 18}px "SFMono-Regular", Consolas, monospace`; context.textBaseline = "top";
  rows.forEach((row, index) => context.fillText(row, wide ? 4 : 12, 10 + index * lineHeight));
  const textScreen = rows.join("\n"); if (elements.bbcTextMirror.textContent !== textScreen) elements.bbcTextMirror.textContent = textScreen;
  if (cpmBoot && textScreen.includes("Acorn CP/M 2.2 - Bios 1.20") && textScreen.includes("A>")) status("Acorn CP/M 2.2 is ready. Click the display to type.", "RUNNING");
  for (let drive = 0; drive < 2; drive += 1) {
    const slot = machine.bus.devices.fdc.drives[drive];
    const protect = drive ? elements.drive1WriteProtect : elements.drive0WriteProtect;
    if (protect.checked !== slot.writeProtected) protect.checked = slot.writeProtected;
  }
  elements.bbcPc.textContent = hex(machine.cpu.pc);
  elements.bbcCycles.textContent = machine.cpu.cycles.toLocaleString();
  elements.bbcTicks.textContent = machine.machineTicks.toLocaleString();
  elements.bbcIrq.textContent = machine.cpu.irqLine ? "HIGH" : "LOW";
  elements.bbcRomBank.textContent = `ROM ${machine.bus.selectedRom}`;
  elements.tubePc.textContent = machine.parasite ? hex(machine.parasite.cpu.PC) : "0000";
  elements.tubeTstates.textContent = machine.parasite ? machine.parasite.cpu.tStates.toLocaleString() : "0";
  if (tubeOutput.length) elements.tubeTranscript.textContent = new TextDecoder().decode(Uint8Array.from(tubeOutput)).replace(/[^\x20-\x7e\r\n]/g, "").trim() || "Z80 Tube starting…";
  renderBbcDebugger();
  audio?.sync(machine.bus.devices.sound.channelState());
}

function demoScreen() {
  stop(); demo = true; cpmBoot = false; machine = new BbcMicroModelB();
  const text = ["BBC Computer 32K", "", "Acorn DFS", "", "BASIC", "", ">_"];
  text.forEach((line, row) => machine.bus.ram.set(new TextEncoder().encode(line), 0x7c00 + row * 40));
  status("Firmware-free renderer demo. Load OS and BASIC ROMs for a machine boot.", "DEMO"); draw(); elements.bbcScreen.focus();
}

async function boot() {
  try {
    stop();
    const mountedDrives = machine.bus.devices.fdc.drives.map(({ disk, writeProtected }) => ({ disk, writeProtected }));
    osRom = await readSelected(elements.osRomInput, osRom); basicRom = await readSelected(elements.basicRomInput, basicRom);
    if (!osRom || osRom.length !== 0x4000) throw new Error("Choose a 16K BBC Model B OS ROM.");
    if (basicRom && basicRom.length !== 0x2000 && basicRom.length !== 0x4000) throw new Error("BASIC ROM must be 8K or 16K.");
    machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
    mountedDrives.forEach(({ disk, writeProtected }, drive) => { if (disk) machine.bus.devices.fdc.mount(disk, { drive, writeProtected }); });
    if (basicRom) machine.loadSidewaysRom(15, basicRom);
    if (tubeEnabled) {
      if (!tubeBootRom || !dnfsRom) throw new Error("Z80 Tube mode requires the Z80 and DNFS ROMs.");
      machine.loadSidewaysRom(14, dnfsRom); machine.attachZ80SecondProcessor({ bootRom: tubeBootRom }); captureTubeOutput();
    }
    machine.loadOsRom(osRom); demo = false; running = true;
    status(tubeEnabled ? "Booting OS + DNFS with the Acorn Z80 Tube processor." : `Booting local OS${basicRom ? " + BASIC" : ""}. Click the display to type.`, "RUNNING");
    elements.bbcScreen.focus(); schedule(); return true;
  } catch (error) { status(error.message, "ERROR"); return false; }
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
function captureTubeOutput() {
  tubeOutput = []; const tube = machine.bus.devices.tube; const parasiteWrite = tube.parasiteWrite.bind(tube);
  tube.parasiteWrite = (offset, value) => { if ((offset & 7) === 1) tubeOutput.push(value & 0xff); parasiteWrite(offset, value); };
  elements.tubeTranscript.textContent = "Z80 Tube starting…";
}

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
elements.bbcStateInput.addEventListener("change", async () => { try { const [file] = elements.bbcStateInput.files; if (!file) return; stop(); const state = JSON.parse(await file.text()); machine.importState(state); tubeEnabled = Boolean(machine.parasite); if (tubeEnabled) { captureTubeOutput(); elements.tubeState.textContent = "Z80 6MHz"; elements.tubeState.className = "status live"; } bbcBreakpoints.clear(); for (const address of state.debugger?.breakpoints ?? []) bbcBreakpoints.add(address & 0xffff); demo = false; mountedMediaNames[0] = "restored-drive-0.ssd"; mountedMediaNames[1] = "restored-drive-1.ssd"; elements.exportSsdButton.disabled = !machine.bus.devices.fdc.drives[0].disk; elements.exportDrive1Button.disabled = !machine.bus.devices.fdc.drives[1].disk; elements.bbcDebuggerStatus.textContent = `${file.name} restored at $${hex(machine.cpu.pc)}.`; status("Portable BBC state restored.", "PAUSED"); draw(); } catch (error) { elements.bbcDebuggerStatus.textContent = error.message; status(error.message, "ERROR"); } finally { elements.bbcStateInput.value = ""; } });

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
function bindDriveControls({ drive, input, writeProtect, exportButton }) {
  input.addEventListener("change", async () => {
    try { const [file] = input.files; if (!file) return; mountedMediaNames[drive] = file.name; const disk = machine.mountMedia(new Uint8Array(await file.arrayBuffer()), { filename: file.name, drive, writeProtected: writeProtect.checked }); exportButton.disabled = false; elements.mediaStatus.textContent = `${file.name}: ${disk.tracks} tracks × ${disk.sides} side${disk.sides === 1 ? "" : "s"} mounted in physical drive ${drive}${writeProtect.checked ? " read-only" : " read/write"}.`; elements.mediaState.textContent = disk.format.toUpperCase(); elements.mediaState.className = "status live"; }
    catch (error) { elements.mediaStatus.textContent = error.message; elements.mediaState.textContent = "ERROR"; elements.mediaState.className = "status error"; }
  });
  writeProtect.addEventListener("change", () => { machine.bus.devices.fdc.drives[drive].writeProtected = writeProtect.checked; });
  exportButton.addEventListener("click", () => {
    const disk = machine.bus.devices.fdc.drives[drive].disk; if (!disk) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([disk.export()], { type: "application/octet-stream" })); link.download = mountedMediaNames[drive]; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
}
bindDriveControls({ drive: 0, input: elements.ssdInput, writeProtect: elements.drive0WriteProtect, exportButton: elements.exportSsdButton });
bindDriveControls({ drive: 1, input: elements.drive1Input, writeProtect: elements.drive1WriteProtect, exportButton: elements.exportDrive1Button });

elements.attachTubeButton.addEventListener("click", async () => {
  try {
    cpmBoot = false;
    tubeBootRom = await readSelected(elements.tubeRomInput, tubeBootRom);
    tubeEnabled = true; if (!await boot()) throw new Error(elements.bbcStatus.textContent);
    elements.tubeState.textContent = "Z80 6MHz"; elements.tubeState.className = "status live";
    elements.tubeStatus.textContent = `${tubeBootRom.length.toLocaleString()}-byte ${elements.tubeRomInput.files.length ? "local" : "bundled"} Z80 ROM booting through DNFS.`;
    draw();
  } catch (error) { elements.tubeState.textContent = "ERROR"; elements.tubeState.className = "status error"; elements.tubeStatus.textContent = error.message; }
});

elements.bootCpmButton.addEventListener("click", async () => {
  try {
    stop(); cpmBoot = true; const utilities = await fetchRom("MEDIA/CPM_Utilities_Disc.dsd");
    machine.mountDsd(utilities, { drive: 0, writeProtected: true }); mountedMediaNames[0] = "CPM_Utilities_Disc.dsd";
    elements.drive0WriteProtect.checked = true; elements.exportSsdButton.disabled = false; tubeEnabled = true;
    if (!await boot()) throw new Error(elements.bbcStatus.textContent);
    elements.tubeState.textContent = "CP/M BOOT"; elements.tubeState.className = "status live";
    elements.mediaState.textContent = "DSD"; elements.mediaState.className = "status live";
    elements.mediaStatus.textContent = "Bundled CP/M Utilities DSD mounted read-only in physical drive 0 / CP/M A:.";
    elements.tubeStatus.textContent = "Acorn CP/M is booting through OS 1.20, DNFS, the 8271 and the real Tube protocol."; draw();
  } catch (error) { status(error.message, "ERROR"); elements.tubeStatus.textContent = error.message; }
});

async function startBundledMachine() {
  try {
    [osRom, basicRom, dnfsRom, tubeBootRom] = await Promise.all([fetchRom("ROM/os12.rom"), fetchRom("ROM/basic2.rom"), fetchRom("ROM/dnfs.rom"), fetchRom("ROM/z80.rom")]);
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
