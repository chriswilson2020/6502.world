import assert from "node:assert/strict";
import test from "node:test";
import { runBbcSoftwareCorpus } from "../scripts/run-bbc-software-corpus.js";

test("bundled BBC software corpus boots and executes quoted BASIC", async () => {
  const report = await runBbcSoftwareCorpus();
  assert.equal(report.passed, true);
  assert.ok(report.cases.every((entry) => entry.passed));
});
