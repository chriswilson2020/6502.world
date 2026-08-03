import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

test("Pages build succeeds without the optional MEDIA corpus and retains local import controls", async () => {
  const root = await mkdtemp(join(tmpdir(), "6502-world-pages-")); const output = join(root, "site");
  try {
    const result = await run(process.execPath, ["scripts/build-pages.js"], { ...process.env, BUILD_OUTPUT: output, MEDIA_SOURCE: join(root, "missing-media") }); assert.equal(result.code, 0, result.stderr);
    const html = await readFile(join(output, "bbc.html"), "utf8"); assert.match(html, /id="ssdInput"/); assert.match(html, /id="drive1Input"/);
    assert.deepEqual(await readdir(join(output, "MEDIA")), ["UNAVAILABLE.txt"]); assert.match(await readFile(join(output, "MEDIA", "UNAVAILABLE.txt"), "utf8"), /local SSD\/DSD import/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function run(command, arguments_, env) { return new Promise((resolve, reject) => { const child = spawn(command, arguments_, { env }); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; }); child.on("error", reject); child.on("close", (code) => resolve({ code, stdout, stderr })); }); }
