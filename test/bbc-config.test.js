import assert from "node:assert/strict";
import test from "node:test";
import { configurationFromSearch, configurationUrl, defaultSoftwareForProfile, resolveBbcConfiguration, shouldWarnForDirtyMedia, softwareForProfile } from "../public/bbc-config.js";

test("BBC hardware profiles filter compatible software presets", () => {
  assert.deepEqual(softwareForProfile("bbc-model-b").map(({ id }) => id), ["bbc-basic", "local-bbc-media"]);
  assert.deepEqual(softwareForProfile("bbc-model-b-acorn-z80").map(({ id }) => id), ["acorn-cpm-utilities", "acorn-cpm-bbc-basic", "acorn-cpm-memoplan", "acorn-cpm-graphplan", "acorn-cpm-fileplan", "custom-acorn-cpm"]);
  assert.equal(defaultSoftwareForProfile("bbc-model-b-acorn-z80"), "acorn-cpm-utilities");
  for (const preset of ["acorn-cpm-utilities", "acorn-cpm-bbc-basic", "acorn-cpm-memoplan", "acorn-cpm-graphplan", "acorn-cpm-fileplan"]) {
    const software = resolveBbcConfiguration({ system: "bbc-model-b-acorn-z80", software: preset }).software;
    assert.ok(software.drives.filter((drive) => drive && drive !== "preserve").every(({ writeProtected }) => writeProtected === false));
  }
});

test("dirty-media warning is limited to configuration changes that replace media", () => {
  const replace = resolveBbcConfiguration({ system: "bbc-model-b", software: "bbc-basic" }).software;
  const preserve = resolveBbcConfiguration({ system: "bbc-model-b", software: "local-bbc-media" }).software;
  assert.equal(shouldWarnForDirtyMedia({ dirty: true, currentSoftwareId: "local-bbc-media", nextSoftware: replace }), true);
  assert.equal(shouldWarnForDirtyMedia({ dirty: true, currentSoftwareId: "local-bbc-media", nextSoftware: preserve }), false);
  assert.equal(shouldWarnForDirtyMedia({ dirty: false, currentSoftwareId: "local-bbc-media", nextSoftware: replace }), false);
});

test("BBC deep links resolve deterministically and reject incompatible pairs visibly", () => {
  const cpm = configurationFromSearch("?system=bbc-model-b-acorn-z80&software=acorn-cpm-utilities");
  assert.equal(cpm.profile.parasite, "acorn-z80"); assert.equal(cpm.software.id, "acorn-cpm-utilities"); assert.equal(cpm.message, "");
  const basic = configurationFromSearch("?system=bbc-model-b-acorn-z80&software=acorn-cpm-bbc-basic"); assert.equal(basic.software.launchMarker, "Acorn BBC BASIC Version 2.20"); assert.equal(basic.software.drives.length, 2);
  const memoPlan = configurationFromSearch("?system=bbc-model-b-acorn-z80&software=acorn-cpm-memoplan"); assert.equal(memoPlan.software.launchMarker, "MemoPlan V1.30"); assert.equal(memoPlan.software.drives[1].filename, "MemoPlan_Program_Disc.dsd");
  const graphPlan = configurationFromSearch("?system=bbc-model-b-acorn-z80&software=acorn-cpm-graphplan"); assert.equal(graphPlan.software.launchMarker, "MODE=NORMAL"); assert.equal(graphPlan.software.drives[1].filename, "GraphPlan_Program_Disc.dsd");
  const filePlan = configurationFromSearch("?system=bbc-model-b-acorn-z80&software=acorn-cpm-fileplan"); assert.equal(filePlan.software.launchMarker, "CREATE WORKSHEET"); assert.equal(filePlan.software.drives[1].filename, "FilePlan_Program_Disc.dsd");
  const fallback = resolveBbcConfiguration({ system: "bbc-model-b", software: "acorn-cpm-utilities" });
  assert.equal(fallback.software.id, "bbc-basic"); assert.match(fallback.message, /unavailable/);
  assert.equal(configurationUrl(cpm.profile.id, cpm.software.id), "bbc.html?system=bbc-model-b-acorn-z80&software=acorn-cpm-utilities");
});
