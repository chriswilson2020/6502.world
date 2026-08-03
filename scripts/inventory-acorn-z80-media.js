import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2] ?? "MEDIA";
const entries = [];
for (const name of (await readdir(directory)).filter((entry) => entry.toLowerCase().endsWith(".dsd")).sort()) {
  const bytes = new Uint8Array(await readFile(join(directory, name))); const text = new TextDecoder("latin1").decode(bytes);
  entries.push({ name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), format: bytes.length === 409600 ? "DSD" : "unknown", geometry: bytes.length === 409600 ? { tracks: 80, sides: 2, sectorsPerTrack: 10, sectorSize: 256 } : null, cpm22: text.includes("Acorn CP/M 2.2 - Bios 1.20") });
}
console.log(JSON.stringify(entries, null, 2));
