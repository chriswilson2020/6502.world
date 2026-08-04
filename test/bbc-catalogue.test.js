import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { ACORN_Z80_CATALOGUE } from "../public/bbc-catalogue.js";
import { runAccountantGate, runBbcBasicZ80Gate, runCisCobolGate, runFilePlanGate, runGraphPlanGate, runMemoPlanGate } from "../scripts/run-acorn-z80-catalogue.js";

test("Acorn Z80 catalogue accounts for every bundled DSD with exact hashes and honest status", async () => {
  const declared = ACORN_Z80_CATALOGUE.flatMap(({ media }) => media); const names = declared.map(({ filename }) => filename);
  const bundled = (await readdir("MEDIA")).filter((name) => name.endsWith(".dsd")).sort(); assert.deepEqual([...names].sort(), bundled); assert.equal(new Set(names).size, names.length);
  for (const media of declared) assert.equal(createHash("sha256").update(await readFile(`MEDIA/${media.filename}`)).digest("hex"), media.sha256, media.filename);
  assert.ok(ACORN_Z80_CATALOGUE.filter(({ media }) => media.length).every(({ rightsMode }) => rightsMode === "bundled with documented permission"));
  assert.ok(ACORN_Z80_CATALOGUE.filter(({ media }) => media.length).every(({ writeMode }) => /writable session cop(?:y|ies); published source/.test(writeMode)));
  assert.doesNotMatch(JSON.stringify(ACORN_Z80_CATALOGUE), /seven[- ]disc|installer/i);
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "memoplan").status, "validated");
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "graphplan").status, "validated");
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "fileplan").status, "validated");
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "cis-cobol").status, "validated");
  assert.equal(ACORN_Z80_CATALOGUE.find(({ id }) => id === "accountant").status, "validated");
});

test("validated BBC BASIC for Z80 launches from B: through real keyboard input", { timeout: 45_000 }, async () => {
  const result = await runBbcBasicZ80Gate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "Acorn BBC BASIC Version 2.20"); assert.deepEqual(result.commands, ["B:", "BBCBASIC"]);
});

test("validated MemoPlan launches, writes a document and survives export remount", { timeout: 90_000 }, async () => {
  const result = await runMemoPlanGate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "MemoPlan V1.30"); assert.equal(result.drive1Dirty, true); assert.equal(result.exportRemountPreserved, true); assert.equal(result.originalHash, result.sourceHashAfter);
});

test("validated GraphPlan launches, saves a table and survives export remount", { timeout: 90_000 }, async () => {
  const result = await runGraphPlanGate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "MODE=NORMAL + ENTER COMMAND:"); assert.equal(result.drive1Dirty, true); assert.equal(result.exportRemountPreserved, true); assert.equal(result.originalHash, result.sourceHashAfter);
});

test("validated FilePlan creates its worksheet dictionary and survives export remount", { timeout: 90_000 }, async () => {
  const result = await runFilePlanGate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "CREATE WORKSHEET + ENTER DATA:"); assert.equal(result.drive0Dirty, true); assert.equal(result.exportRemountPreserved, true); assert.equal(result.utilitiesHash, result.utilitiesHashAfter); assert.equal(result.applicationHash, result.applicationHashAfter);
});

test("validated CIS COBOL compiles PI.CBL without errors and preserves PI.INT after export remount", { timeout: 120_000 }, async () => {
  const result = await runCisCobolGate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "** CIS COBOL V4.5 + ** ERRORS=00000"); assert.equal(result.drive1Dirty, true); assert.equal(result.exportRemountPreserved, true); assert.equal(result.originalHash, result.sourceHashAfter);
});

test("validated Accountant follows its prompted disc swap into the nominal-ledger menu", { timeout: 120_000 }, async () => {
  const result = await runAccountantGate(); assert.equal(result.passed, true, JSON.stringify(result, null, 2)); assert.equal(result.marker, "COMPACT MENU + Nominal ledger PROGRAM MENU"); assert.equal(result.programDriveDirty, true); assert.equal(result.exportRemountPreserved, true); assert.deepEqual(result.sourceHashesAfter, result.sourceHashes);
});
