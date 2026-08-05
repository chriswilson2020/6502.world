import { AcornAtom } from "./src/machine/atom/atom.js";
import { atomKeyboardMappingForBrowserEvent } from "./src/machine/atom/ppi-8255.js";

const ids = ["atomScreen", "atomRunState", "atomStatus", "bootAtomButton", "resetAtomButton", "atomBasicInput", "atomFloatInput", "atomKernelInput", "atomUtilitySelect", "atomDosEnabled", "atomTextMirror", "atomPc", "atomCycles", "atomColumn", "atomSpeaker", "atomMode", "pauseAtomButton", "enableAtomAudioButton", "atomProgramInput", "atomDrive0Input", "atomDrive0Protect", "atomDrive0Export", "atomDrive1Input", "atomDrive1Protect", "atomDrive1Export", "atomMediaState", "atomMediaStatus", "atomBreakpointCount", "atomBreakpointInput", "toggleAtomBreakpointButton", "stepAtomButton", "atomDisassembly", "exportAtomStateButton", "atomStateInput", "atomDebuggerStatus"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.atomScreen.getContext("2d");
const hex = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, "0");
let machine = new AcornAtom({ traceLimit: 128, accessLogLimit: 0 });
let coreRoms = null; let running = false; let frame = null; let audio = null; let keyboardTimer = null;
const keyboardQueue = []; const breakpoints = new Set();
const mountedNames = ["atom-drive-0.ssd", "atom-drive-1.ssd"];

async function fetchRom(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Unable to load ${path}.`); return new Uint8Array(await response.arrayBuffer()); }
async function selectedRom(input, fallback) { const [file] = input.files; return file ? new Uint8Array(await file.arrayBuffer()) : fallback; }
function status(message, label = "READY") { elements.atomStatus.textContent = message; elements.atomRunState.textContent = label; elements.atomRunState.className = `status ${label === "ERROR" ? "error" : "live"}`; }

function draw() {
  const rows = machine.textSnapshot();
  context.fillStyle = "#050706"; context.fillRect(0, 0, elements.atomScreen.width, elements.atomScreen.height);
  context.fillStyle = "#f4f4ec"; context.font = '20px "SFMono-Regular", Consolas, monospace'; context.textBaseline = "top";
  rows.forEach((row, index) => context.fillText(row, 10, 8 + index * 23));
  const text = rows.join("\n"); if (elements.atomTextMirror.textContent !== text) elements.atomTextMirror.textContent = text;
  elements.atomPc.textContent = hex(machine.cpu.pc); elements.atomCycles.textContent = machine.machineCycles.toLocaleString(); elements.atomColumn.textContent = String(machine.bus.ppi.keyColumn);
  const speaker = Boolean(machine.bus.ppi.portC & 4); elements.atomSpeaker.textContent = speaker ? "HIGH" : "LOW"; elements.atomMode.textContent = machine.bus.ppi.portA & 0x10 ? `GRAPHICS ${machine.bus.ppi.portA >> 5}` : "TEXT";
  audio?.set(speaker); renderDebugger();
}

async function boot() {
  try {
    stop();
    const basic = await selectedRom(elements.atomBasicInput, coreRoms?.basic); const floatingPoint = await selectedRom(elements.atomFloatInput, coreRoms?.floatingPoint); const kernel = await selectedRom(elements.atomKernelInput, coreRoms?.kernel);
    if (![basic, floatingPoint, kernel].every((rom) => rom?.length === 0x1000)) throw new Error("BASIC, floating-point and kernel ROMs must each be exactly 4K.");
    const mounted = machine.bus.fdc.drives.map(({ disk, writeProtected }) => ({ disk, writeProtected }));
    coreRoms = { basic, floatingPoint, kernel }; machine = new AcornAtom({ traceLimit: 128, accessLogLimit: 0 }); machine.loadCoreRoms(coreRoms);
    if (elements.atomUtilitySelect.value) machine.loadUtilityRom(await fetchRom(`ROM/${elements.atomUtilitySelect.value}`));
    if (elements.atomDosEnabled.checked) machine.loadDosRom(await fetchRom("ROM/Atom_DOS.rom"));
    mounted.forEach(({ disk, writeProtected }, drive) => { if (disk) machine.bus.fdc.mount(disk, { drive, writeProtected }); });
    running = true; status("Atom running. Click the display to type; F12 performs BREAK.", "RUNNING"); elements.atomScreen.focus(); schedule();
  } catch (error) { status(error.message, "ERROR"); }
}

function reset() { clearKeyboardQueue(); machine.reset(); machine.bus.keyboard.reset(); running = true; status("BREAK reset asserted; Atom restarting.", "RUNNING"); elements.atomScreen.focus(); schedule(); }
function schedule() { if (frame == null) frame = requestAnimationFrame(runFrame); }
function runFrame() {
  frame = null; if (!running) return;
  try { for (let count = 0; count < 16667; count += 1) { if (machine.cpu.instructionBoundary && breakpoints.has(machine.cpu.pc)) { running = false; status(`Breakpoint reached at $${hex(machine.cpu.pc)}.`, "BREAK"); break; } machine.clock(); } }
  catch (error) { running = false; status(error.message, "ERROR"); draw(); return; }
  draw(); schedule();
}
function stop() { running = false; if (frame != null) cancelAnimationFrame(frame); frame = null; }
function boundary() { while (!machine.cpu.instructionBoundary) machine.clock(); }

elements.atomScreen.addEventListener("keydown", (event) => {
  if (event.code === "F12") { event.preventDefault(); reset(); return; }
  if (event.code.startsWith("Control")) { event.preventDefault(); machine.bus.keyboard.setControl(true); return; }
  if (event.code === "AltRight") { event.preventDefault(); machine.bus.keyboard.setRepeat(true); return; }
  if (event.code.startsWith("Shift") || event.repeat) { event.preventDefault(); return; }
  const mapping = atomKeyboardMappingForBrowserEvent(event.code, event.key); if (!mapping) return;
  event.preventDefault(); keyboardQueue.push(mapping); pumpKeyboardQueue();
});
elements.atomScreen.addEventListener("keyup", (event) => {
  if (event.code.startsWith("Control")) { event.preventDefault(); machine.bus.keyboard.setControl(false); return; }
  if (event.code === "AltRight") { event.preventDefault(); machine.bus.keyboard.setRepeat(false); return; }
  if (atomKeyboardMappingForBrowserEvent(event.code, event.key)) event.preventDefault();
});
elements.atomScreen.addEventListener("blur", () => { clearKeyboardQueue(); machine.bus.keyboard.reset(); });

function pumpKeyboardQueue() {
  if (keyboardTimer != null || !keyboardQueue.length) return;
  const mapping = keyboardQueue.shift(); machine.bus.keyboard.setShift(mapping.shift); machine.bus.keyboard.press(...mapping.matrix);
  keyboardTimer = setTimeout(() => {
    machine.bus.keyboard.release(...mapping.matrix); machine.bus.keyboard.setShift(false);
    keyboardTimer = setTimeout(() => { keyboardTimer = null; pumpKeyboardQueue(); }, 100);
  }, 100);
}
function clearKeyboardQueue() { keyboardQueue.length = 0; if (keyboardTimer != null) clearTimeout(keyboardTimer); keyboardTimer = null; }

function renderDebugger() {
  let address = machine.cpu.instructionBoundary ? machine.cpu.pc : machine.cpu.currentInstructionAddress ?? machine.cpu.pc; const lines = [];
  for (let index = 0; index < 7; index += 1) { try { const instruction = machine.cpu.disassemble(address); lines.push(`${breakpoints.has(address) ? "●" : " "} $${hex(address)}  ${instruction.text}`); address = (address + instruction.length) & 0xffff; } catch { break; } }
  elements.atomDisassembly.textContent = lines.join("\n"); elements.atomBreakpointCount.textContent = `${breakpoints.size} BREAKPOINT${breakpoints.size === 1 ? "" : "S"}`;
}
function parseAddress(value) { const normalized = String(value).trim().replace(/^\$/, "").replace(/^0x/i, ""); if (!/^[0-9a-f]{1,4}$/i.test(normalized)) throw new Error("Enter a four-digit hexadecimal address."); return Number.parseInt(normalized, 16); }

elements.bootAtomButton.addEventListener("click", boot); elements.resetAtomButton.addEventListener("click", reset);
elements.pauseAtomButton.addEventListener("click", () => { running = !running; status(running ? "Atom running." : "Atom paused.", running ? "RUNNING" : "PAUSED"); if (running) schedule(); });
elements.toggleAtomBreakpointButton.addEventListener("click", () => { try { const address = parseAddress(elements.atomBreakpointInput.value); if (breakpoints.has(address)) breakpoints.delete(address); else breakpoints.add(address); elements.atomDebuggerStatus.textContent = `Breakpoint ${breakpoints.has(address) ? "set" : "cleared"} at $${hex(address)}.`; draw(); } catch (error) { elements.atomDebuggerStatus.textContent = error.message; } });
elements.stepAtomButton.addEventListener("click", () => { stop(); boundary(); const at = machine.cpu.pc; const result = machine.step(); elements.atomDebuggerStatus.textContent = `Stepped $${hex(at)} in ${result.cycles} cycles.`; status("Atom paused after one instruction.", "PAUSED"); draw(); });
elements.exportAtomStateButton.addEventListener("click", () => { stop(); boundary(); const state = machine.exportState(); state.debugger = { breakpoints: [...breakpoints] }; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: "application/json" })); link.download = `6502-world-atom-${hex(machine.cpu.pc)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); status("Portable Atom state exported.", "PAUSED"); });
elements.atomStateInput.addEventListener("change", async () => { try { const [file] = elements.atomStateInput.files; if (!file) return; stop(); const state = JSON.parse(await file.text()); machine.importState(state); coreRoms = { basic: machine.bus.basicRom, floatingPoint: machine.bus.floatingPointRom, kernel: machine.bus.kernelRom }; breakpoints.clear(); for (const address of state.debugger?.breakpoints ?? []) breakpoints.add(address & 0xffff); status(`${file.name} restored.`, "PAUSED"); draw(); } catch (error) { status(error.message, "ERROR"); } finally { elements.atomStateInput.value = ""; } });
elements.enableAtomAudioButton.addEventListener("click", async () => { audio ??= new AtomAudio(); await audio.enable(); elements.enableAtomAudioButton.textContent = "Atom sound enabled"; });
elements.atomProgramInput.addEventListener("change", async () => { try { const [file] = elements.atomProgramInput.files; if (!file) return; stop(); boundary(); const result = machine.loadAtm(new Uint8Array(await file.arrayBuffer())); elements.atomMediaStatus.textContent = `${result.name || file.name}: ${result.size} bytes loaded at $${hex(result.start)}${result.run === 0xc2b2 ? " into BASIC" : `; running at $${hex(result.run)}`}.`; elements.atomMediaState.textContent = "ATM"; elements.atomMediaState.className = "status live"; running = true; schedule(); } catch (error) { elements.atomMediaStatus.textContent = error.message; elements.atomMediaState.textContent = "ERROR"; elements.atomMediaState.className = "status error"; } finally { elements.atomProgramInput.value = ""; } });

function bindDrive(drive, input, protect, exportButton) {
  input.addEventListener("change", async () => { try { const [file] = input.files; if (!file) return; mountedNames[drive] = file.name; const disk = machine.mountMedia(new Uint8Array(await file.arrayBuffer()), { filename: file.name, drive, writeProtected: protect.checked }); exportButton.disabled = false; elements.atomMediaStatus.textContent = `${file.name} mounted in drive ${drive} as a ${disk.dirty ? "modified" : "clean"} private session copy.`; elements.atomMediaState.textContent = disk.format.toUpperCase(); elements.atomMediaState.className = "status live"; } catch (error) { elements.atomMediaStatus.textContent = error.message; elements.atomMediaState.textContent = "ERROR"; elements.atomMediaState.className = "status error"; } finally { input.value = ""; } });
  protect.addEventListener("change", () => { machine.bus.fdc.drives[drive].writeProtected = protect.checked; });
  exportButton.addEventListener("click", () => { const disk = machine.bus.fdc.drives[drive].disk; if (!disk) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([disk.export()], { type: "application/octet-stream" })); link.download = mountedNames[drive]; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); });
}
bindDrive(0, elements.atomDrive0Input, elements.atomDrive0Protect, elements.atomDrive0Export); bindDrive(1, elements.atomDrive1Input, elements.atomDrive1Protect, elements.atomDrive1Export);

class AtomAudio {
  async enable() { this.context ??= new AudioContext(); if (!this.oscillator) { this.oscillator = this.context.createOscillator(); this.gain = this.context.createGain(); this.oscillator.type = "square"; this.oscillator.frequency.value = 1200; this.gain.gain.value = 0; this.oscillator.connect(this.gain).connect(this.context.destination); this.oscillator.start(); } await this.context.resume(); }
  set(level) { if (this.context) this.gain.gain.setTargetAtTime(level ? 0.06 : 0, this.context.currentTime, 0.003); }
}

async function start() { try { const [basic, floatingPoint, kernel] = await Promise.all([fetchRom("ROM/Atom_Basic.rom"), fetchRom("ROM/Atom_FloatingPoint2.rom"), fetchRom("ROM/Atom_Kernel.rom")]); coreRoms = { basic, floatingPoint, kernel }; await boot(); } catch (error) { status(error.message, "ERROR"); draw(); } }
start();
