import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";

const output = process.env.BUILD_OUTPUT ?? "dist";
const mediaSource = process.env.MEDIA_SOURCE ?? "MEDIA";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir("public", { withFileTypes: true })) {
  await cp(`public/${entry.name}`, `${output}/${entry.name}`, { recursive: true });
}

await cp("src", `${output}/src`, { recursive: true });
await cp("docs", `${output}/docs`, { recursive: true });
await cp("ROM", `${output}/ROM`, { recursive: true });
await cp("corpus", `${output}/corpus`, { recursive: true });
await mkdir(`${output}/MEDIA`, { recursive: true });
if (await exists(mediaSource)) await cp(mediaSource, `${output}/MEDIA`, { recursive: true });
else await writeFile(`${output}/MEDIA/UNAVAILABLE.txt`, "Optional Acorn Z80 media was not present at build time. Use the browser's local SSD/DSD import controls.\n");
await mkdir(`${output}/vendor/z80-world/src`, { recursive: true });
await cp("vendor/z80-world/src/z80.js", `${output}/vendor/z80-world/src/z80.js`);

console.log(`Built 6502 World into ${output}/ (${await exists(mediaSource) ? "bundled media included" : "optional media unavailable"})`);

async function exists(path) { try { await access(path); return true; } catch { return false; } }
