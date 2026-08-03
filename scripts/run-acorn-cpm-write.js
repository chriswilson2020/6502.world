import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runAcornCpm } from "./run-acorn-cpm.js";

const ORIGINAL_HASH = "9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a";

export async function runAcornCpmWriteGate() {
  const original = new Uint8Array(await readFile("MEDIA/CPM_Utilities_Disc.dsd")); const originalBefore = sha256(original);
  const writable = await runAcornCpm({ commands: ["SAVE 1 CODEX.COM", "DIR", "\x03", "DIR"], writeProtected: false, returnMedia: true, commandInstructionLimit: 5_000_000 });
  const modified = writable.exportedMedia; const modifiedHash = sha256(modified); const originalAfter = sha256(new Uint8Array(await readFile("MEDIA/CPM_Utilities_Disc.dsd")));
  const remounted = await runAcornCpm({ commands: ["DIR"], mediaBytes: modified, writeProtected: true, commandInstructionLimit: 5_000_000 });
  const resetOriginal = await runAcornCpm({ commands: ["DIR"], mediaBytes: original, writeProtected: true, commandInstructionLimit: 5_000_000 });
  const writableText = writable.commands.map(({ screen }) => screen.join("\n")).join("\n");
  const remountedText = remounted.commands[0]?.screen.join("\n") ?? ""; const originalText = resetOriginal.commands[0]?.screen.join("\n") ?? "";
  const passed = writable.passed && writable.mediaDirty && writable.fdc.writeTransfers > 0 && /CODEX\s+COM/.test(writableText) && remounted.passed && /CODEX\s+COM/.test(remountedText) && resetOriginal.passed && !/CODEX\s+COM/.test(originalText) && originalBefore === ORIGINAL_HASH && originalAfter === ORIGINAL_HASH && modifiedHash !== ORIGINAL_HASH;
  return { passed, originalHash: originalBefore, originalHashAfter: originalAfter, modifiedHash, modifiedBytes: modified.length, writeTransfers: writable.fdc.writeTransfers, warmBootPreserved: /CODEX\s+COM/.test(writable.commands.at(-1)?.screen.join("\n") ?? ""), exportRemountPreserved: /CODEX\s+COM/.test(remountedText), resetOriginalRemoved: !/CODEX\s+COM/.test(originalText), writableInstructions: writable.hostInstructions, remountInstructions: remounted.hostInstructions, resetInstructions: resetOriginal.hostInstructions };
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const result = await runAcornCpmWriteGate(); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }
