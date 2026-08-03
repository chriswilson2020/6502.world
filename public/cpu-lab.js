import { MinimalMachine, parseHexAddress } from "./src/machine/minimal-machine.js";

const SAMPLE = "A2 00 E8 8E 00 02 E0 0A D0 F8 00";
const elements = Object.fromEntries([
  "programInput", "loadAddress", "loadButton", "binaryInput", "sampleButton", "programNote",
  "cycleButton", "stepButton", "runButton", "resetButton", "runState", "statusMessage",
  "irqToggle", "nmiButton", "interruptState", "exportStateButton", "stateInput",
  "breakpointAddress", "addBreakpointButton", "breakpointCount", "debuggerList",
  "memoryAddress", "memoryGo", "memoryPrevious", "memoryNext", "memoryRange", "memoryHeader", "memoryBody",
  "traceBody", "cycleCount", "boundaryPill", "nextInstruction", "memory0200",
  "regA", "regX", "regY", "regSP", "regPC",
].map((id) => [id, document.querySelector(`#${id}`)]));

let machine = new MinimalMachine({ traceLimit: 256 });
let memoryPage = 0x0200;
let running = false;
let runInstructions = 0;
let runFrame = null;

const hex = (value, width = 2) => (value >>> 0).toString(16).toUpperCase().padStart(width, "0");

function parseHexProgram(source) {
  const cleaned = source.replace(/;.*$/gm, " ").trim();
  if (!cleaned) throw new Error("Enter at least one hexadecimal byte.");
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  return Uint8Array.from(tokens.map((token) => {
    const normalized = token.replace(/^\$/, "").replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,2}$/i.test(normalized)) throw new Error(`Invalid byte: ${token}`);
    return Number.parseInt(normalized, 16);
  }));
}

function loadBytes(bytes, label = "hex program") {
  stopRunning();
  const origin = parseHexAddress(elements.loadAddress.value);
  const loaded = machine.load(bytes, origin);
  elements.loadAddress.value = hex(loaded.address, 4);
  elements.programInput.scrollLeft = 0;
  memoryPage = loaded.address & 0xff80;
  elements.memoryAddress.value = hex(loaded.address, 4);
  elements.irqToggle.checked = false;
  elements.programNote.textContent = `${label} · ${loaded.length.toLocaleString()} bytes at $${hex(loaded.address, 4)}`;
  setStatus(`Loaded ${loaded.length.toLocaleString()} bytes at $${hex(loaded.address, 4)}. Reset sequence queued.`, "READY");
}

function safeAction(action) {
  try {
    const result = action();
    if (result?.then) result.catch(handleError);
    render();
  } catch (error) { handleError(error); }
}

function handleError(error) {
  stopRunning();
  setStatus(error instanceof Error ? error.message : String(error), "ERROR");
  render();
}

function setStatus(message, label = "READY") {
  elements.statusMessage.textContent = message;
  elements.runState.textContent = label;
  const style = label === "ERROR" ? "error" : ["BRK", "BREAK", "PAUSED"].includes(label) ? "planned" : "live";
  elements.runState.className = `status ${style}`;
}

function render() {
  const state = machine.cpu.getState();
  elements.regA.textContent = hex(state.a);
  elements.regX.textContent = hex(state.x);
  elements.regY.textContent = hex(state.y);
  elements.regSP.textContent = hex(state.sp);
  elements.regPC.textContent = hex(state.pc, 4);
  elements.cycleCount.textContent = `${state.cycles.toLocaleString()} CYCLES`;
  elements.boundaryPill.textContent = state.instructionBoundary ? "BOUNDARY" : "MID-CYCLE";
  elements.memory0200.textContent = hex(machine.memory.read8(0x0200));
  elements.breakpointCount.textContent = `${machine.breakpoints.size} BREAKPOINT${machine.breakpoints.size === 1 ? "" : "S"}`;
  elements.runButton.textContent = running ? "Pause" : "Run";
  elements.interruptState.textContent = `${state.irqLine ? "IRQ HIGH" : "IRQ LOW"}${state.nmiPending ? " · NMI PENDING" : ""}`;

  for (const [flag, enabled] of Object.entries(state.flags)) document.querySelector(`[data-flag="${flag}"]`)?.classList.toggle("active", enabled);
  try {
    if (!state.instructionBoundary && state.currentInstructionAddress == null) {
      elements.nextInstruction.textContent = "RESET SEQUENCE";
    } else {
      const address = state.instructionBoundary ? state.pc : state.currentInstructionAddress;
      const next = machine.cpu.disassemble(address);
      elements.nextInstruction.textContent = `$${hex(next.address, 4)}  ${next.text}${state.instructionBoundary ? "" : " · MID-CYCLE"}`;
    }
  } catch { elements.nextInstruction.textContent = "—"; }

  renderDebugger();
  renderMemory();
  renderTrace();
}

function renderDebugger() {
  const state = machine.cpu.getState();
  const focusAddress = state.instructionBoundary ? state.pc : state.currentInstructionAddress ?? machine.loadAddress;
  let address = focusAddress;
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const instruction = machine.cpu.disassemble(address);
    const bytes = Array.from({ length: instruction.length }, (_, offset) => hex(machine.memory.read8((address + offset) & 0xffff))).join(" ");
    const breakpoint = machine.breakpoints.has(address);
    rows.push(`<button class="debug-row${address === focusAddress ? " current" : ""}${breakpoint ? " breakpoint" : ""}" data-address="${address}" type="button"><span class="debug-marker">${breakpoint ? "●" : "○"}</span><span class="debug-address">$${hex(address, 4)}</span><span class="debug-bytes">${bytes}</span><span>${instruction.text}</span></button>`);
    address = (address + instruction.length) & 0xffff;
  }
  elements.debuggerList.innerHTML = rows.join("");
}

function renderMemory() {
  memoryPage &= 0xff80;
  elements.memoryRange.textContent = `$${hex(memoryPage, 4)}–$${hex((memoryPage + 0x7f) & 0xffff, 4)}`;
  elements.memoryHeader.innerHTML = '<th scope="col">ADDR</th>' + Array.from({ length: 16 }, (_, index) => `<th scope="col">${hex(index, 1)}</th>`).join("");
  const rows = [];
  for (let row = 0; row < 8; row += 1) {
    const address = (memoryPage + row * 16) & 0xffff;
    const cells = Array.from({ length: 16 }, (_, column) => {
      const cellAddress = (address + column) & 0xffff;
      return `<td${cellAddress === machine.cpu.pc ? ' class="changed"' : ""} title="$${hex(cellAddress, 4)}">${hex(machine.memory.read8(cellAddress))}</td>`;
    }).join("");
    rows.push(`<tr><th scope="row">$${hex(address, 4)}</th>${cells}</tr>`);
  }
  elements.memoryBody.innerHTML = rows.join("");
}

function renderTrace() {
  const rows = machine.cpu.trace.slice(-18).reverse().map((cycle) => {
    const rw = cycle.operation === "write" ? "W" : "R";
    return `<tr><td>${cycle.cycle}</td><td>$${hex(cycle.address, 4)}</td><td>${rw}</td><td>$${hex(cycle.data)}</td><td>${cycle.kind}${cycle.sync ? " · SYNC" : ""}</td></tr>`;
  });
  elements.traceBody.innerHTML = rows.join("") || '<tr><td colspan="5" class="empty-row">No cycles yet</td></tr>';
}

function startRunning() {
  if (running) { stopRunning("Execution paused."); return; }
  running = true;
  runInstructions = 0;
  setStatus("Running in debugger chunks…", "RUNNING");
  render();
  runFrame = requestAnimationFrame(runChunk);
}

function runChunk() {
  if (!running) return;
  try {
    for (let count = 0; count < 400; count += 1) {
      if (machine.cpu.instructionBoundary && machine.breakpoints.has(machine.cpu.pc)) {
        stopRunning(`Breakpoint reached at $${hex(machine.cpu.pc, 4)}.`, "BREAK");
        render();
        return;
      }
      machine.cpu.step();
      runInstructions += 1;
      if (machine.cpu.currentOpcode === 0x00) {
        stopRunning(`Stopped at BRK after ${runInstructions.toLocaleString()} instructions.`, "BRK");
        render();
        return;
      }
      if (runInstructions >= 1_000_000) {
        stopRunning("Safety limit reached after 1,000,000 instructions.", "PAUSED");
        render();
        return;
      }
    }
    render();
    runFrame = requestAnimationFrame(runChunk);
  } catch (error) { handleError(error); }
}

function stopRunning(message, label = "PAUSED") {
  const wasRunning = running;
  running = false;
  if (runFrame != null) cancelAnimationFrame(runFrame);
  runFrame = null;
  if (message && wasRunning) setStatus(message, label);
}

function downloadState() {
  const state = machine.exportState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `6502-world-${hex(machine.cpu.pc, 4)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus(`Portable state captured at PC $${hex(machine.cpu.pc, 4)}.`, "READY");
}

elements.loadButton.addEventListener("click", () => safeAction(() => loadBytes(parseHexProgram(elements.programInput.value))));
elements.sampleButton.addEventListener("click", () => safeAction(() => { elements.programInput.value = SAMPLE; elements.loadAddress.value = "0600"; loadBytes(parseHexProgram(SAMPLE), "sample loop"); }));
elements.binaryInput.addEventListener("change", () => safeAction(async () => {
  const [file] = elements.binaryInput.files;
  if (!file) return;
  loadBytes(new Uint8Array(await file.arrayBuffer()), file.name);
  elements.binaryInput.value = "";
  render();
}));
elements.resetButton.addEventListener("click", () => safeAction(() => { stopRunning(); machine.cpu.reset(); setStatus("Processor reset sequence queued."); }));
elements.cycleButton.addEventListener("click", () => safeAction(() => { stopRunning(); const cycle = machine.cpu.clock(); setStatus(`Cycle ${cycle.cycle}: ${cycle.operation.toUpperCase()} $${hex(cycle.address, 4)} = $${hex(cycle.data)}.`); }));
elements.stepButton.addEventListener("click", () => safeAction(() => {
  stopRunning();
  const address = machine.cpu.pc;
  const instruction = machine.cpu.instructionBoundary ? machine.cpu.disassemble(address).text : "pending micro-operations";
  const cycles = machine.cpu.step();
  setStatus(`${instruction} completed in ${cycles} cycle${cycles === 1 ? "" : "s"}.`, machine.cpu.currentOpcode === 0x00 ? "BRK" : "READY");
}));
elements.runButton.addEventListener("click", startRunning);
elements.irqToggle.addEventListener("change", () => safeAction(() => { machine.cpu.setIrq(elements.irqToggle.checked); setStatus(`IRQ line ${elements.irqToggle.checked ? "asserted" : "released"}.`); }));
elements.nmiButton.addEventListener("click", () => safeAction(() => { machine.cpu.requestNmi(); setStatus("NMI edge queued for the next instruction boundary."); }));
elements.addBreakpointButton.addEventListener("click", () => safeAction(() => { const address = parseHexAddress(elements.breakpointAddress.value); const enabled = machine.toggleBreakpoint(address); setStatus(`Breakpoint ${enabled ? "set" : "cleared"} at $${hex(address, 4)}.`); }));
elements.debuggerList.addEventListener("click", (event) => safeAction(() => {
  const row = event.target.closest("[data-address]");
  if (!row) return;
  const address = Number(row.dataset.address);
  const enabled = machine.toggleBreakpoint(address);
  elements.breakpointAddress.value = hex(address, 4);
  setStatus(`Breakpoint ${enabled ? "set" : "cleared"} at $${hex(address, 4)}.`);
}));
elements.memoryGo.addEventListener("click", () => safeAction(() => { memoryPage = parseHexAddress(elements.memoryAddress.value) & 0xff80; }));
elements.memoryPrevious.addEventListener("click", () => safeAction(() => { memoryPage = (memoryPage - 0x80) & 0xffff; elements.memoryAddress.value = hex(memoryPage, 4); }));
elements.memoryNext.addEventListener("click", () => safeAction(() => { memoryPage = (memoryPage + 0x80) & 0xffff; elements.memoryAddress.value = hex(memoryPage, 4); }));
elements.exportStateButton.addEventListener("click", () => safeAction(downloadState));
elements.stateInput.addEventListener("change", () => safeAction(async () => {
  const [file] = elements.stateInput.files;
  if (!file) return;
  stopRunning();
  machine.importState(JSON.parse(await file.text()));
  elements.loadAddress.value = hex(machine.loadAddress, 4);
  elements.irqToggle.checked = machine.cpu.irqLine;
  memoryPage = machine.cpu.pc & 0xff80;
  elements.memoryAddress.value = hex(memoryPage, 4);
  elements.stateInput.value = "";
  setStatus(`Restored ${file.name} at PC $${hex(machine.cpu.pc, 4)}.`, "READY");
  render();
}));

loadBytes(parseHexProgram(SAMPLE), "sample loop");
render();
