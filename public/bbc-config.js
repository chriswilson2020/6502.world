export const BBC_HARDWARE_PROFILES = Object.freeze({
  "bbc-model-b": Object.freeze({ id: "bbc-model-b", title: "BBC Micro Model B", parasite: null, roms: Object.freeze({ os: "ROM/os12.rom", basic: "ROM/basic2.rom" }) }),
  "bbc-model-b-acorn-z80": Object.freeze({ id: "bbc-model-b-acorn-z80", title: "BBC Micro Model B + Acorn Z80 Second Processor", parasite: "acorn-z80", roms: Object.freeze({ os: "ROM/os12.rom", basic: "ROM/basic2.rom", dnfs: "ROM/dnfs.rom", z80: "ROM/z80.rom" }) }),
});

export const BBC_SOFTWARE_PRESETS = Object.freeze({
  "bbc-basic": Object.freeze({ id: "bbc-basic", title: "BBC BASIC II", profile: "bbc-model-b", drives: Object.freeze([null, null]), mediaPolicy: "replace", status: "validated" }),
  "local-bbc-media": Object.freeze({ id: "local-bbc-media", title: "Local BBC disc", profile: "bbc-model-b", drives: Object.freeze(["preserve", "preserve"]), mediaPolicy: "preserve", status: "local" }),
  "acorn-cpm-utilities": Object.freeze({ id: "acorn-cpm-utilities", title: "Acorn CP/M 2.2 Utilities", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, null]), mediaPolicy: "replace", status: "validated", bootsCpm: true }),
  "acorn-cpm-bbc-basic": Object.freeze({ id: "acorn-cpm-bbc-basic", title: "BBC BASIC for Z80", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, { id: "bbc-basic-z80", path: "MEDIA/Basic_Program_Disc.dsd", filename: "Basic_Program_Disc.dsd", writeProtected: false }]), mediaPolicy: "replace", status: "validated", bootsCpm: true, launchSteps: Object.freeze([Object.freeze({ prompt: "A>", command: "B:" }), Object.freeze({ prompt: "B>", command: "BBCBASIC" })]), launchMarker: "Acorn BBC BASIC Version 2.20" }),
  "acorn-cpm-memoplan": Object.freeze({ id: "acorn-cpm-memoplan", title: "MemoPlan 1.30", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, { id: "memoplan", path: "MEDIA/MemoPlan_Program_Disc.dsd", filename: "MemoPlan_Program_Disc.dsd", writeProtected: false }]), mediaPolicy: "replace", status: "validated", bootsCpm: true, launchSteps: Object.freeze([Object.freeze({ prompt: "A>", command: "B:" }), Object.freeze({ prompt: "B>", command: "MEMO" })]), launchMarker: "MemoPlan V1.30" }),
  "acorn-cpm-graphplan": Object.freeze({ id: "acorn-cpm-graphplan", title: "GraphPlan", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, { id: "graphplan", path: "MEDIA/GraphPlan_Program_Disc.dsd", filename: "GraphPlan_Program_Disc.dsd", writeProtected: false }]), mediaPolicy: "replace", status: "validated", bootsCpm: true, launchSteps: Object.freeze([Object.freeze({ prompt: "A>", command: "B:" }), Object.freeze({ prompt: "B>", command: "GRAPH" })]), launchMarker: "MODE=NORMAL" }),
  "acorn-cpm-fileplan": Object.freeze({ id: "acorn-cpm-fileplan", title: "FilePlan", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, { id: "fileplan", path: "MEDIA/FilePlan_Program_Disc.dsd", filename: "FilePlan_Program_Disc.dsd", writeProtected: false }]), mediaPolicy: "replace", status: "validated", bootsCpm: true, launchSteps: Object.freeze([Object.freeze({ prompt: "A>", command: "B:" }), Object.freeze({ prompt: "B>", command: "FILE" })]), launchMarker: "CREATE WORKSHEET" }),
  "acorn-cpm-cis-cobol": Object.freeze({ id: "acorn-cpm-cis-cobol", title: "CIS COBOL V4.5", profile: "bbc-model-b-acorn-z80", drives: Object.freeze([{ id: "cpm-utilities", path: "MEDIA/CPM_Utilities_Disc.dsd", filename: "CPM_Utilities_Disc.dsd", writeProtected: false }, { id: "cis-cobol", path: "MEDIA/CIS_Cobol_Program_Disc.dsd", filename: "CIS_Cobol_Program_Disc.dsd", writeProtected: false }]), mediaPolicy: "replace", status: "validated", bootsCpm: true, launchSteps: Object.freeze([Object.freeze({ prompt: "A>", command: "B:" }), Object.freeze({ prompt: "B>", command: "COBOL" })]), launchMarker: "** CIS COBOL V4.5" }),
  "custom-acorn-cpm": Object.freeze({ id: "custom-acorn-cpm", title: "Custom Acorn CP/M media", profile: "bbc-model-b-acorn-z80", drives: Object.freeze(["preserve", "preserve"]), mediaPolicy: "preserve", status: "local" }),
});

export function softwareForProfile(profileId) { return Object.values(BBC_SOFTWARE_PRESETS).filter((entry) => entry.profile === profileId); }
export function defaultSoftwareForProfile(profileId) { return profileId === "bbc-model-b-acorn-z80" ? "acorn-cpm-utilities" : "bbc-basic"; }

export function resolveBbcConfiguration({ system, software } = {}) {
  const fallbackSystem = "bbc-model-b"; const requestedSystem = BBC_HARDWARE_PROFILES[system] ? system : fallbackSystem;
  const requestedSoftware = BBC_SOFTWARE_PRESETS[software];
  const compatible = requestedSoftware?.profile === requestedSystem;
  const softwareId = compatible ? requestedSoftware.id : defaultSoftwareForProfile(requestedSystem);
  const messages = [];
  if (system && !BBC_HARDWARE_PROFILES[system]) messages.push(`Unknown system “${system}”; using BBC Micro Model B.`);
  if (software && !compatible) messages.push(`Startup “${software}” is unavailable for ${BBC_HARDWARE_PROFILES[requestedSystem].title}; using ${BBC_SOFTWARE_PRESETS[softwareId].title}.`);
  return { profile: BBC_HARDWARE_PROFILES[requestedSystem], software: BBC_SOFTWARE_PRESETS[softwareId], message: messages.join(" ") };
}

export function configurationFromSearch(search = "") {
  const parameters = new URLSearchParams(search);
  return resolveBbcConfiguration({ system: parameters.get("system") ?? undefined, software: parameters.get("software") ?? undefined });
}

export function configurationUrl(profileId, softwareId, base = "bbc.html") {
  const resolved = resolveBbcConfiguration({ system: profileId, software: softwareId });
  const parameters = new URLSearchParams({ system: resolved.profile.id, software: resolved.software.id });
  return `${base}?${parameters}`;
}

export function shouldWarnForDirtyMedia({ dirty, currentSoftwareId, nextSoftware }) { return Boolean(dirty && nextSoftware?.mediaPolicy === "replace" && nextSoftware.id !== currentSoftwareId); }
