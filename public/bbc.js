import { BbcMicroModelB } from "./src/machine/bbc/model-b.js";
import { BBC_KEYBOARD_CODES, bbcKeyboardCodeForBrowserEvent } from "./src/machine/bbc/system-via.js";
import { configurationFromSearch, configurationUrl, defaultSoftwareForProfile, resolveBbcConfiguration, shouldWarnForDirtyMedia, softwareForProfile } from "./bbc-config.js";
import { IndexedDbBbcMediaStore } from "./bbc-media-store.js";
import { ACORN_Z80_CATALOGUE } from "./bbc-catalogue.js";

const elements = Object.fromEntries(["bbcScreen", "bbcRunState", "bbcStatus", "systemSelect", "softwareSelect", "bootSystemButton", "resetSystemButton", "configurationStatus", "osRomInput", "basicRomInput", "bootBbcButton", "demoBbcButton", "bbcRomBank", "bbcPc", "bbcCycles", "bbcTicks", "bbcIrq", "pauseBbcButton", "enableAudioButton", "uefInput", "playTapeButton", "rewindTapeButton", "ssdInput", "drive1Input", "drive0WriteProtect", "drive1WriteProtect", "exportSsdButton", "exportDrive1Button", "ejectDrive0Button", "ejectDrive1Button", "resetDrive0Button", "resetDrive1Button", "swapDrivesButton", "mediaState", "mediaStatus", "persistenceState", "persistenceDriveSelect", "saveMediaButton", "restoreMediaButton", "duplicateMediaButton", "clearStoredMediaButton", "persistenceStatus", "catalogueList", "catalogueStatus", "bbcTextMirror", "bbcBreakpointCount", "bbcBreakpointInput", "toggleBbcBreakpointButton", "stepBbcButton", "bbcDisassembly", "exportBbcStateButton", "bbcStateInput", "bbcDebuggerStatus", "tubeRomInput", "attachTubeButton", "bootCpmButton", "tubeState", "tubeStatus", "tubePc", "tubeTstates", "tubeTranscript"].map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.bbcScreen.getContext("2d");
let machine = new BbcMicroModelB({ traceLimit: 128, accessLogLimit: 0 });
let osRom = null; let basicRom = null; let dnfsRom = null; let running = false; let frame = null; let demo = true; let cpmBoot = false;
let currentSystemId = "bbc-model-b"; let currentSoftwareId = "bbc-basic"; let machineGeneration = 0;
const activeBrowserKeys = new Map();
const mountedMediaNames = ["drive-0.ssd", "drive-1.ssd"]; const mountedOriginals = [null, null]; let audio = null; let tubeBootRom = null; let tubeEnabled = false; let tubeOutput = [];
const mediaStore = new IndexedDbBbcMediaStore(); const persistedRevisions = [null, null];
let pendingLaunchSteps = []; let automaticLaunchQueue = []; let automaticLaunchPressed = null; let activeLaunchMarker = null; let activeLaunchTitle = null;
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
  if (running && activeLaunchMarker && textScreen.includes(activeLaunchMarker)) status(`${activeLaunchTitle} is ready. Click the display to type.`, "RUNNING");
  else if (running && cpmBoot && !activeLaunchMarker && textScreen.includes("Acorn CP/M 2.2 - Bios 1.20") && textScreen.includes("A>")) status("Acorn CP/M 2.2 is ready. Click the display to type.", "RUNNING");
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
  stop(); cancelAutomaticLaunch(); demo = true; cpmBoot = false; machine = new BbcMicroModelB();
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
    machineGeneration += 1; elements.bbcScreen.dataset.machineGeneration = String(machineGeneration);
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

function hasUnsavedDriveChanges(drive) { const disk = machine.bus.devices.fdc.drives[drive].disk; return Boolean(disk?.dirty && persistedRevisions[drive] !== disk.revision); }
function mediaIsDirty() { return machine.bus.devices.fdc.drives.some((_, drive) => hasUnsavedDriveChanges(drive)); }
function confirmMediaReplacement() { return !mediaIsDirty() || window.confirm("Mounted media has unsaved changes. Continue and discard those in-memory changes?"); }
function updateSoftwareOptions(profileId, preferred = defaultSoftwareForProfile(profileId)) {
  elements.softwareSelect.replaceChildren(...softwareForProfile(profileId).map((entry) => new Option(entry.title, entry.id)));
  elements.softwareSelect.value = softwareForProfile(profileId).some(({ id }) => id === preferred) ? preferred : defaultSoftwareForProfile(profileId);
}
function restoreConfigurationControls() { elements.systemSelect.value = currentSystemId; updateSoftwareOptions(currentSystemId, currentSoftwareId); }
function updateConfigurationUrl() { history.replaceState(null, "", configurationUrl(currentSystemId, currentSoftwareId)); }
async function configureSystem(resolved, { askBeforeDiscard = true, updateUrl = true } = {}) {
  const replacingMedia = resolved.software.mediaPolicy === "replace";
  if (askBeforeDiscard && shouldWarnForDirtyMedia({ dirty: mediaIsDirty(), currentSoftwareId, nextSoftware: resolved.software }) && !confirmMediaReplacement()) { restoreConfigurationControls(); elements.configurationStatus.textContent = "System change cancelled; dirty media remains mounted."; return false; }
  stop(); cancelAutomaticLaunch(); currentSystemId = resolved.profile.id; currentSoftwareId = resolved.software.id;
  tubeEnabled = resolved.profile.parasite === "acorn-z80"; cpmBoot = Boolean(resolved.software.bootsCpm); prepareAutomaticLaunch(resolved.software);
  if (replacingMedia) {
    for (let drive = 0; drive < 2; drive += 1) { machine.ejectMedia(drive); mountedOriginals[drive] = null; persistedRevisions[drive] = null; }
    for (let drive = 0; drive < resolved.software.drives.length; drive += 1) {
      const media = resolved.software.drives[drive]; if (!media) continue;
      const bytes = await fetchRom(media.path); mountDriveSource(drive, bytes, { filename: media.filename, writeProtected: media.writeProtected });
    }
  }
  const started = await boot(); if (!started) return false;
  for (let drive = 0; drive < 2; drive += 1) updateDriveButtons(drive);
  elements.tubeState.textContent = tubeEnabled ? (cpmBoot ? "CP/M BOOT" : "Z80 6MHz") : "DETACHED";
  elements.tubeState.className = `status ${tubeEnabled ? "live" : "planned"}`;
  elements.mediaState.textContent = machine.bus.devices.fdc.drives.some(({ disk }) => disk) ? "MEDIA" : "EMPTY";
  elements.mediaState.className = `status ${machine.bus.devices.fdc.drives.some(({ disk }) => disk) ? "live" : "planned"}`;
  elements.configurationStatus.textContent = resolved.message || `${resolved.profile.title} · ${resolved.software.title}.`;
  if (cpmBoot) elements.mediaStatus.textContent = resolved.software.drives.map((media, drive) => media && media !== "preserve" ? `${media.filename} in physical drive ${drive} / CP/M ${String.fromCharCode(65 + drive)}:` : null).filter(Boolean).join(" · ") + " · bundled sources are read-only.";
  else if (!machine.bus.devices.fdc.drives.some(({ disk }) => disk)) elements.mediaStatus.textContent = "No startup disc mounted; choose a local SSD or DSD at any time.";
  if (updateUrl) updateConfigurationUrl(); draw(); return true;
}
async function configureFromControls() { try { return await configureSystem(resolveBbcConfiguration({ system: elements.systemSelect.value, software: elements.softwareSelect.value })); } catch (error) { restoreConfigurationControls(); status(error.message, "ERROR"); elements.configurationStatus.textContent = error.message; return false; } }

function schedule() { if (frame == null) frame = requestAnimationFrame(runFrame); }
function runFrame() {
  frame = null;
  if (!running) return;
  try { for (let count = 0; count < 50000; count += 1) { if (machine.cpu.instructionBoundary && bbcBreakpoints.has(machine.cpu.pc)) { running = false; status(`Breakpoint reached at $${hex(machine.cpu.pc)}.`, "BREAK"); break; } machine.clock(); } serviceAutomaticLaunch(); }
  catch (error) { running = false; status(error.message, "ERROR"); draw(); return; }
  draw(); schedule();
}
function stop() { running = false; if (frame != null) cancelAnimationFrame(frame); frame = null; }
const automaticCodeForCharacter = (character) => character === "\r" ? "Enter" : character === ":" ? "Semicolon" : `Key${character.toUpperCase()}`;
function cancelAutomaticLaunch() { if (automaticLaunchPressed) machine.bus.keyboard.release(automaticLaunchPressed); automaticLaunchPressed = null; automaticLaunchQueue = []; pendingLaunchSteps = []; activeLaunchMarker = null; activeLaunchTitle = null; }
function prepareAutomaticLaunch(software) { pendingLaunchSteps = [...(software.launchSteps ?? [])]; activeLaunchMarker = software.launchMarker ?? null; activeLaunchTitle = software.title; }
function serviceAutomaticLaunch() {
  if (automaticLaunchPressed) { machine.bus.keyboard.release(automaticLaunchPressed); automaticLaunchPressed = null; return; }
  if (automaticLaunchQueue.length) { const character = automaticLaunchQueue.shift(); const matrix = BBC_KEYBOARD_CODES[automaticCodeForCharacter(character)]; if (!matrix) throw new Error(`No BBC keyboard mapping for automatic launch character ${character}`); automaticLaunchPressed = `${matrix[0]}:${matrix[1]}`; machine.bus.keyboard.press(automaticLaunchPressed); return; }
  const screen = machine.video.textSnapshot().join("\n"); const next = pendingLaunchSteps[0]; if (!next || !screen.includes(next.prompt)) return;
  pendingLaunchSteps.shift(); automaticLaunchQueue = [...next.command, "\r"]; status(`Entering ${next.command} through the BBC keyboard matrix.`, "RUNNING");
}
function captureTubeOutput() {
  tubeOutput = []; const tube = machine.bus.devices.tube; const parasiteWrite = tube.parasiteWrite.bind(tube);
  tube.parasiteWrite = (offset, value) => { if ((offset & 7) === 1) tubeOutput.push(value & 0xff); parasiteWrite(offset, value); };
  elements.tubeTranscript.textContent = "Z80 Tube starting…";
}

elements.bootBbcButton.addEventListener("click", boot);
elements.bootSystemButton.addEventListener("click", configureFromControls);
elements.resetSystemButton.addEventListener("click", () => { const resolved = resolveBbcConfiguration({ system: currentSystemId, software: currentSoftwareId }); cancelAutomaticLaunch(); prepareAutomaticLaunch(resolved.software); boot(); });
elements.systemSelect.addEventListener("change", () => { updateSoftwareOptions(elements.systemSelect.value); configureFromControls(); });
elements.softwareSelect.addEventListener("change", configureFromControls);
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
elements.bbcStateInput.addEventListener("change", async () => { try { const [file] = elements.bbcStateInput.files; if (!file) return; stop(); cancelAutomaticLaunch(); const state = JSON.parse(await file.text()); machine.importState(state); tubeEnabled = Boolean(machine.parasite); currentSystemId = tubeEnabled ? "bbc-model-b-acorn-z80" : "bbc-model-b"; currentSoftwareId = tubeEnabled ? "custom-acorn-cpm" : "local-bbc-media"; elements.systemSelect.value = currentSystemId; updateSoftwareOptions(currentSystemId, currentSoftwareId); updateConfigurationUrl(); if (tubeEnabled) { captureTubeOutput(); elements.tubeState.textContent = "Z80 6MHz"; elements.tubeState.className = "status live"; } bbcBreakpoints.clear(); for (const address of state.debugger?.breakpoints ?? []) bbcBreakpoints.add(address & 0xffff); demo = false; for (let drive = 0; drive < 2; drive += 1) { const disk = machine.bus.devices.fdc.drives[drive].disk; mountedMediaNames[drive] = `restored-drive-${drive}.${disk?.format ?? "ssd"}`; mountedOriginals[drive] = disk ? { bytes: disk.export(), filename: mountedMediaNames[drive], writeProtected: machine.bus.devices.fdc.drives[drive].writeProtected } : null; persistedRevisions[drive] = disk?.revision ?? null; updateDriveButtons(drive); } elements.bbcDebuggerStatus.textContent = `${file.name} restored at $${hex(machine.cpu.pc)}.`; status("Portable BBC state restored.", "PAUSED"); draw(); } catch (error) { elements.bbcDebuggerStatus.textContent = error.message; status(error.message, "ERROR"); } finally { elements.bbcStateInput.value = ""; } });

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
function mountDriveSource(drive, bytes, { filename, writeProtected }) {
  const source = Uint8Array.from(bytes); const disk = machine.mountMedia(source, { filename, drive, writeProtected });
  mountedMediaNames[drive] = filename; mountedOriginals[drive] = { bytes: source, filename, writeProtected }; persistedRevisions[drive] = disk.revision; updateDriveButtons(drive); return disk;
}
function updateDriveButtons(drive) {
  const mounted = Boolean(machine.bus.devices.fdc.drives[drive].disk);
  (drive ? elements.exportDrive1Button : elements.exportSsdButton).disabled = !mounted;
  (drive ? elements.resetDrive1Button : elements.resetDrive0Button).disabled = !mountedOriginals[drive];
}
function confirmDriveDiscard(drive) { return !hasUnsavedDriveChanges(drive) || window.confirm(`Physical drive ${drive} has unsaved changes. Discard them?`); }
function markCustomMediaSelection() { cancelAutomaticLaunch(); currentSoftwareId = tubeEnabled ? "custom-acorn-cpm" : "local-bbc-media"; updateSoftwareOptions(currentSystemId, currentSoftwareId); updateConfigurationUrl(); elements.configurationStatus.textContent = `${tubeEnabled ? "Acorn Z80" : "BBC Model B"} hardware preserved; media changed without a cold restart.`; }
function bindDriveControls({ drive, input, writeProtect, exportButton, ejectButton, resetButton }) {
  input.addEventListener("change", async () => {
    try { const [file] = input.files; if (!file) return; if (!confirmDriveDiscard(drive)) return; const disk = mountDriveSource(drive, new Uint8Array(await file.arrayBuffer()), { filename: file.name, writeProtected: writeProtect.checked }); markCustomMediaSelection(); elements.mediaStatus.textContent = `${file.name}: ${disk.tracks} tracks × ${disk.sides} side${disk.sides === 1 ? "" : "s"} mounted in physical drive ${drive}${writeProtect.checked ? " read-only" : " read/write"}.`; elements.mediaState.textContent = disk.format.toUpperCase(); elements.mediaState.className = "status live"; }
    catch (error) { elements.mediaStatus.textContent = error.message; elements.mediaState.textContent = "ERROR"; elements.mediaState.className = "status error"; }
    finally { input.value = ""; }
  });
  writeProtect.addEventListener("change", () => { machine.bus.devices.fdc.drives[drive].writeProtected = writeProtect.checked; });
  exportButton.addEventListener("click", () => {
    const disk = machine.bus.devices.fdc.drives[drive].disk; if (!disk) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([disk.export()], { type: "application/octet-stream" })); link.download = mountedMediaNames[drive]; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); persistedRevisions[drive] = disk.revision;
  });
  ejectButton.addEventListener("click", () => { if (!confirmDriveDiscard(drive)) return; machine.ejectMedia(drive); persistedRevisions[drive] = null; markCustomMediaSelection(); updateDriveButtons(drive); elements.mediaStatus.textContent = `Physical drive ${drive} ejected.`; draw(); });
  resetButton.addEventListener("click", () => { const original = mountedOriginals[drive]; if (!original || !confirmDriveDiscard(drive)) return; const disk = mountDriveSource(drive, original.bytes, original); elements.mediaStatus.textContent = `${original.filename} reset to its original ${disk.format.toUpperCase()} bytes in physical drive ${drive}.`; draw(); });
}
bindDriveControls({ drive: 0, input: elements.ssdInput, writeProtect: elements.drive0WriteProtect, exportButton: elements.exportSsdButton, ejectButton: elements.ejectDrive0Button, resetButton: elements.resetDrive0Button });
bindDriveControls({ drive: 1, input: elements.drive1Input, writeProtect: elements.drive1WriteProtect, exportButton: elements.exportDrive1Button, ejectButton: elements.ejectDrive1Button, resetButton: elements.resetDrive1Button });
elements.swapDrivesButton.addEventListener("click", () => {
  if (machine.bus.devices.fdc.transfer) { elements.mediaStatus.textContent = "Pause after the active disc transfer before swapping drives."; return; }
  stop(); [machine.bus.devices.fdc.drives[0], machine.bus.devices.fdc.drives[1]] = [machine.bus.devices.fdc.drives[1], machine.bus.devices.fdc.drives[0]];
  [mountedMediaNames[0], mountedMediaNames[1]] = [mountedMediaNames[1], mountedMediaNames[0]]; [mountedOriginals[0], mountedOriginals[1]] = [mountedOriginals[1], mountedOriginals[0]]; [persistedRevisions[0], persistedRevisions[1]] = [persistedRevisions[1], persistedRevisions[0]];
  updateDriveButtons(0); updateDriveButtons(1); elements.mediaStatus.textContent = "Physical drives 0 and 1 swapped; the machine remains paused."; status("Drives swapped with the current hardware profile preserved.", "PAUSED"); draw();
});

function renderCatalogue() {
  elements.catalogueList.replaceChildren(...ACORN_Z80_CATALOGUE.map((entry) => {
    const details = document.createElement("details"); details.className = "catalogue-entry";
    const summary = document.createElement("summary"); summary.append(entry.title); const badge = document.createElement("span"); badge.textContent = entry.status; summary.append(badge); details.append(summary);
    const description = document.createElement("p"); description.textContent = `${entry.evidence}. ${entry.writeMode}. Rights: ${entry.rightsMode}.`; details.append(description);
    if (entry.media.length) { const media = document.createElement("p"); media.append("Media: "); entry.media.forEach((image, index) => { if (index) media.append(" · "); const code = document.createElement("code"); code.textContent = `${image.filename} ${image.sha256.slice(0, 12)}…`; media.append(code); }); details.append(media); }
    if (entry.preset) { const launch = document.createElement("button"); launch.type = "button"; launch.className = "wide-action"; launch.textContent = entry.id === "bbc-basic-z80" ? "Launch BBC BASIC for Z80" : "Boot validated utilities"; launch.addEventListener("click", async () => { elements.systemSelect.value = entry.profile; updateSoftwareOptions(entry.profile, entry.preset); const started = await configureFromControls(); elements.catalogueStatus.textContent = started ? `${entry.title}: ${entry.command}.` : `Unable to start ${entry.title}.`; }); details.append(launch); }
    return details;
  }));
}

const storedMediaId = (drive) => `bbc-drive-${drive}-working-copy`;
async function sha256(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function refreshPersistenceStatus(message) {
  const stored = await mediaStore.list(); elements.persistenceState.textContent = stored.length ? `${stored.length} SAVED` : "LOCAL"; elements.persistenceState.className = `status ${stored.length ? "live" : "planned"}`;
  if (message) elements.persistenceStatus.textContent = message;
}
async function saveWorkingMedia() {
  const drive = Number(elements.persistenceDriveSelect.value); const slot = machine.bus.devices.fdc.drives[drive]; const disk = slot.disk; if (!disk) throw new Error(`Physical drive ${drive} has no media to save.`);
  stop(); const baseBytes = mountedOriginals[drive]?.bytes ?? disk.export(); const bytes = disk.export();
  await mediaStore.put({ id: storedMediaId(drive), name: mountedMediaNames[drive], baseImageSha256: await sha256(baseBytes), format: disk.format, geometry: { tracks: disk.tracks, sides: disk.sides, sectorsPerTrack: disk.sectorsPerTrack, sectorSize: disk.sectorSize }, bytes, baseBytes, dirty: disk.dirty, revision: disk.revision, lastModified: new Date().toISOString(), catalogueAssociation: currentSoftwareId, writeProtected: slot.writeProtected });
  persistedRevisions[drive] = disk.revision; await refreshPersistenceStatus(`${mountedMediaNames[drive]} saved locally for physical drive ${drive} at revision ${disk.revision}.`); status("Machine paused after saving working media.", "PAUSED");
}
async function restoreWorkingMedia() {
  const drive = Number(elements.persistenceDriveSelect.value); if (!confirmDriveDiscard(drive)) return; const record = await mediaStore.get(storedMediaId(drive)); if (!record) throw new Error(`No stored working copy exists for physical drive ${drive}.`);
  stop(); const disk = machine.mountMedia(record.bytes, { filename: record.name, drive, writeProtected: record.writeProtected }); disk.dirty = record.dirty; disk.revision = record.revision;
  mountedMediaNames[drive] = record.name; mountedOriginals[drive] = { bytes: record.baseBytes ?? record.bytes, filename: record.name, writeProtected: record.writeProtected }; persistedRevisions[drive] = disk.revision; updateDriveButtons(drive); markCustomMediaSelection();
  elements.mediaStatus.textContent = `${record.name} restored into physical drive ${drive} from local storage.`; await refreshPersistenceStatus(elements.mediaStatus.textContent); status("Stored working media restored; machine remains paused.", "PAUSED"); draw();
}
function duplicateWorkingMedia() {
  const drive = Number(elements.persistenceDriveSelect.value); const disk = machine.bus.devices.fdc.drives[drive].disk; if (!disk) throw new Error(`Physical drive ${drive} has no media to duplicate.`); if (machine.bus.devices.fdc.transfer) throw new Error("Pause after the active disc transfer before duplicating media.");
  stop(); const extension = disk.format; const name = `copy-of-${mountedMediaNames[drive].replace(/\.(ssd|dsd)$/i, "")}.${extension}`; mountDriveSource(drive, disk.export(), { filename: name, writeProtected: false }); (drive ? elements.drive1WriteProtect : elements.drive0WriteProtect).checked = false; markCustomMediaSelection(); elements.persistenceStatus.textContent = `${name} is an independent writable copy in physical drive ${drive}; choose Save locally to persist it.`; elements.mediaStatus.textContent = elements.persistenceStatus.textContent; status("Writable media copy created; machine remains paused.", "PAUSED"); draw();
}
async function runPersistenceAction(action) { try { await action(); } catch (error) { elements.persistenceStatus.textContent = error.message; elements.persistenceState.textContent = "ERROR"; elements.persistenceState.className = "status error"; } }
elements.saveMediaButton.addEventListener("click", () => runPersistenceAction(saveWorkingMedia));
elements.restoreMediaButton.addEventListener("click", () => runPersistenceAction(restoreWorkingMedia));
elements.duplicateMediaButton.addEventListener("click", () => runPersistenceAction(duplicateWorkingMedia));
elements.clearStoredMediaButton.addEventListener("click", () => runPersistenceAction(async () => { const drive = Number(elements.persistenceDriveSelect.value); await mediaStore.delete(storedMediaId(drive)); if (persistedRevisions[drive] === machine.bus.devices.fdc.drives[drive].disk?.revision) persistedRevisions[drive] = null; await refreshPersistenceStatus(`Stored working copy for physical drive ${drive} cleared; mounted media was not changed.`); }));

elements.attachTubeButton.addEventListener("click", async () => {
  try {
    cancelAutomaticLaunch(); cpmBoot = false;
    currentSystemId = "bbc-model-b-acorn-z80"; currentSoftwareId = "custom-acorn-cpm"; elements.systemSelect.value = currentSystemId; updateSoftwareOptions(currentSystemId, currentSoftwareId);
    tubeBootRom = await readSelected(elements.tubeRomInput, tubeBootRom);
    tubeEnabled = true; if (!await boot()) throw new Error(elements.bbcStatus.textContent);
    updateConfigurationUrl(); elements.configurationStatus.textContent = "Acorn Z80 hardware · custom media preserved.";
    elements.tubeState.textContent = "Z80 6MHz"; elements.tubeState.className = "status live";
    elements.tubeStatus.textContent = `${tubeBootRom.length.toLocaleString()}-byte ${elements.tubeRomInput.files.length ? "local" : "bundled"} Z80 ROM booting through DNFS.`;
    draw();
  } catch (error) { elements.tubeState.textContent = "ERROR"; elements.tubeState.className = "status error"; elements.tubeStatus.textContent = error.message; }
});

elements.bootCpmButton.addEventListener("click", async () => {
  try {
    elements.systemSelect.value = "bbc-model-b-acorn-z80"; updateSoftwareOptions(elements.systemSelect.value, "acorn-cpm-utilities");
    if (!await configureSystem(resolveBbcConfiguration({ system: elements.systemSelect.value, software: elements.softwareSelect.value }))) return;
    elements.tubeStatus.textContent = "Acorn CP/M is booting through OS 1.20, DNFS, the 8271 and the real Tube protocol.";
  } catch (error) { status(error.message, "ERROR"); elements.tubeStatus.textContent = error.message; }
});

async function startBundledMachine() {
  try {
    [osRom, basicRom, dnfsRom, tubeBootRom] = await Promise.all([fetchRom("ROM/os12.rom"), fetchRom("ROM/basic2.rom"), fetchRom("ROM/dnfs.rom"), fetchRom("ROM/z80.rom")]);
    const resolved = configurationFromSearch(location.search); elements.systemSelect.value = resolved.profile.id; updateSoftwareOptions(resolved.profile.id, resolved.software.id);
    await configureSystem(resolved, { askBeforeDiscard: false }); await refreshPersistenceStatus();
  } catch (error) {
    demoScreen(); status(`${error.message} You can still choose local ROM files.`, "ERROR");
  }
}

renderCatalogue(); startBundledMachine();

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
