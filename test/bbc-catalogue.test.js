import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { ACORN_Z80_CATALOGUE } from "../public/bbc-catalogue.js";
import { runBbcBasicZ80Gate } from "../scripts/run-acorn-z80-catalogue.js";

test("Acorn Z80 catalogue accounts for every bundled DSD with exact hashes and honest status", async () => {
  const declared = ACORN_Z80_CATALOGUE.flatMap(({ media }) => media); const names = declared.map(({ filename }) => filename);
  const bundled = (await readdir("MEDIA")).filter((name) => name.endsWith(".dsd")).sort(); assert.deepEqual([...names].sort(), bundled); assert.equal(new Set(names).size, names.length);
  for (const media of declared) assert.equal(createHash("sha256").update(await readFile(`MEDIA/${media.filename}`)).digest("hex"), media.sha256, media.filename);
  assert.ok(ACORN_Z80_CATALOGUE.filter(({ media }) => media.length).every(({ rightsMode }) => rightsMode === "bundled with documented permission"));
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "original-installer").status, "unsupported");
});

test("validated BBC BASIC for Z80 launches from B: through real keyboard input", { timeout: 45_000 }, async () => {
  const result = await runBbcBasicZ80Gate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "Acorn BBC BASIC Version 2.20"); assert.deepEqual(result.commands, ["B:", "BBCBASIC"]);
});
