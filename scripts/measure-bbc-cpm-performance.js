import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { runAcornCpm } from "./run-acorn-cpm.js";

export async function measureBbcCpmPerformance() {
  const started = performance.now(); const result = await runAcornCpm(); const elapsedMs = performance.now() - started;
  return { passed: result.passed, workload: "Acorn CP/M boot + DIR + STAT", elapsedMs: Math.round(elapsedMs), hostInstructions: result.hostInstructions, hostInstructionsPerSecond: Math.round(result.hostInstructions / (elapsedMs / 1000)), bbcTicks: result.machineTicks, z80TStates: result.z80TStates, z80ToBbcTickRatio: Number((result.z80TStates / result.machineTicks).toFixed(6)), fdcReadTransfers: result.fdc.readTransfers, fdcWriteTransfers: result.fdc.writeTransfers };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const result = await measureBbcCpmPerformance(); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }
