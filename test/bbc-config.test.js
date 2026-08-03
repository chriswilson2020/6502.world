import assert from "node:assert/strict";
import test from "node:test";
import { configurationFromSearch, configurationUrl, defaultSoftwareForProfile, resolveBbcConfiguration, shouldWarnForDirtyMedia, softwareForProfile } from "../public/bbc-config.js";

test("BBC hardware profiles filter compatible software presets", () => {
  assert.deepEqual(softwareForProfile("bbc-model-b").map(({ id }) => id), ["bbc-basic", "local-bbc-media"]);
  assert.deepEqual(softwareForProfile("bbc-model-b-acorn-z80").map(({ id }) => id), ["acorn-cpm-utilities", "acorn-cpm-bbc-basic", "custom-acorn-cpm"]);
  assert.equal(defaultSoftwareForProfile("bbc-model-b-acorn-z80"), "acorn-cpm-utilities");
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
  const fallback = resolveBbcConfiguration({ system: "bbc-model-b", software: "acorn-cpm-utilities" });
  assert.equal(fallback.software.id, "bbc-basic"); assert.match(fallback.message, /unavailable/);
  assert.equal(configurationUrl(cpm.profile.id, cpm.software.id), "bbc.html?system=bbc-model-b-acorn-z80&software=acorn-cpm-utilities");
});
