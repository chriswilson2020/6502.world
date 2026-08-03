import { FlatMemory } from "../src/bus/flat-memory.js";
import { M6502 } from "../src/cpu/m6502.js";

const SAMPLE = "A2 00 E8 8E 00 02 E0 0A D0 F8 00";
const LOAD_ADDRESS = 0x0600;

const elements = {
  programInput: document.querySelector("#programInput"),
  loadButton: document.querySelector("#loadButton"),
  sampleButton: document.querySelector("#sampleButton"),
  cycleButton: document.querySelector("#cycleButton"),
  stepButton: document.querySelector("#stepButton"),
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  traceBody: document.querySelector("#traceBody"),
  cycleCount: document.querySelector("#cycleCount"),
  runState: document.querySelector("#runState"),
  statusMessage: document.querySelector("#statusMessage"),
  boundaryPill: document.querySelector("#boundaryPill"),
  nextInstruction: document.querySelector("#nextInstruction"),
  memory0200: document.querySelector("#memory0200"),
  regA: document.querySelector("#regA"),
  regX: document.querySelector("#regX"),
  regY: document.querySelector("#regY"),
  regSP: document.querySelector("#regSP"),
  regPC: document.querySelector("#regPC"),
};

let memory;
let cpu;

const hex = (value, width = 2) => value.toString(16).toUpperCase().padStart(width, "0");

function parseHexProgram(source) {
  const cleaned = source.replace(/;.*$/gm, " ").trim();
  if (!cleaned) throw new Error("Enter at least one hexadecimal byte.");
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  return Uint8Array.from(tokens.map((token) => {
    const normalized = token.replace(/^\$/, "").replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,2}$/i.test(normalized)) {
      throw new Error(`Invalid byte: ${token}`);
    }
    return Number.parseInt(normalized, 16);
  }));
}

function loadProgram() {
  const bytes = parseHexProgram(elements.programInput.value);
  memory = new FlatMemory();
  memory.load(bytes, LOAD_ADDRESS);
  memory.write16(0xfffc, LOAD_ADDRESS);
  memory.write16(0xfffe, LOAD_ADDRESS + bytes.length - 1);
  cpu = new M6502({ bus: memory, traceLimit: 96 });
  setStatus(`Loaded ${bytes.length} bytes at $${hex(LOAD_ADDRESS, 4)}.`, "READY");
  render();
}

function safeAction(action) {
  try {
    action();
    render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "ERROR");
    render();
  }
}

function setStatus(message, label = "READY") {
  elements.statusMessage.textContent = message;
  elements.runState.textContent = label;
  elements.runState.className = `status ${label === "ERROR" ? "error" : label === "BRK" ? "planned" : "live"}`;
}

function render() {
  const state = cpu.getState();
  elements.regA.textContent = hex(state.a);
  elements.regX.textContent = hex(state.x);
  elements.regY.textContent = hex(state.y);
  elements.regSP.textContent = hex(state.sp);
  elements.regPC.textContent = hex(state.pc, 4);
  elements.cycleCount.textContent = `${state.cycles} CYCLES`;
  elements.boundaryPill.textContent = state.instructionBoundary ? "BOUNDARY" : "MID-CYCLE";
  elements.memory0200.textContent = hex(memory.read8(0x0200));

  for (const [flag, enabled] of Object.entries(state.flags)) {
    const node = document.querySelector(`[data-flag="${flag}"]`);
    node?.classList.toggle("active", enabled);
  }

  try {
    const next = cpu.disassemble(state.pc);
    elements.nextInstruction.textContent = `$${hex(next.address, 4)}  ${next.text}`;
  } catch {
    elements.nextInstruction.textContent = "—";
  }

  const rows = cpu.trace.slice(-14).reverse().map((cycle) => {
    const rw = cycle.operation === "write" ? "W" : "R";
    const sync = cycle.sync ? " · SYNC" : "";
    return `<tr><td>${cycle.cycle}</td><td>$${hex(cycle.address, 4)}</td><td>${rw}</td><td>$${hex(cycle.data)}</td><td>${cycle.kind}${sync}</td></tr>`;
  });
  elements.traceBody.innerHTML = rows.join("") || '<tr><td colspan="5" class="empty-row">No cycles yet</td></tr>';
}

elements.loadButton.addEventListener("click", () => safeAction(loadProgram));
elements.sampleButton.addEventListener("click", () => {
  elements.programInput.value = SAMPLE;
  safeAction(loadProgram);
});
elements.resetButton.addEventListener("click", () => safeAction(() => {
  cpu.reset();
  setStatus("Processor reset sequence queued.");
}));
elements.cycleButton.addEventListener("click", () => safeAction(() => {
  const cycle = cpu.clock();
  setStatus(`Cycle ${cycle.cycle}: ${cycle.operation.toUpperCase()} $${hex(cycle.address, 4)} = $${hex(cycle.data)}.`);
}));
elements.stepButton.addEventListener("click", () => safeAction(() => {
  const address = cpu.getState().pc;
  const instruction = cpu.disassemble(address).text;
  const cycles = cpu.step();
  const isBrk = cpu.currentOpcode === 0x00;
  setStatus(`${instruction} completed in ${cycles} cycle${cycles === 1 ? "" : "s"}.`, isBrk ? "BRK" : "READY");
}));
elements.runButton.addEventListener("click", () => safeAction(() => {
  let executed = 0;
  while (executed < 10000) {
    cpu.step();
    executed += 1;
    if (cpu.currentOpcode === 0x00) break;
  }
  if (executed >= 10000) throw new Error("Run stopped after 10,000 instructions without BRK.");
  setStatus(`Stopped at BRK after ${executed} instructions. $0200 now contains $${hex(memory.read8(0x0200))}.`, "BRK");
}));

loadProgram();
