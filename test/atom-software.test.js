import assert from "node:assert/strict";
import test from "node:test";
import { runAtomSoftwareCorpus } from "../scripts/run-atom-software.js";

test("bundled Atom software corpus executes quoted BASIC through the matrix", async () => {
  const report = await runAtomSoftwareCorpus();
  assert.equal(report.passed, true, JSON.stringify(report));
});
