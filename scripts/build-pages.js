import { cp, mkdir, readdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const entry of await readdir("public", { withFileTypes: true })) {
  await cp(`public/${entry.name}`, `dist/${entry.name}`, { recursive: true });
}

await cp("src", "dist/src", { recursive: true });
await cp("docs", "dist/docs", { recursive: true });
await cp("ROM", "dist/ROM", { recursive: true });

console.log("Built 6502 World into dist/");
