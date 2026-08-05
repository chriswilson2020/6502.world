import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

for (const page of ["index.html", "cpu-lab.html", "bbc.html", "atom.html"]) {
  test(`${page} has the shared identity and valid core assets`, async () => {
    const html = await readFile(`public/${page}`, "utf8");
    assert.match(html, /6502 World/i);
    assert.match(html, /styles\.css/);
    assert.match(html, /6502-mark\.svg/);
  });
}

test("landing page leads with recognisable machine context", async () => {
  const html = await readFile("public/index.html", "utf8");
  assert.match(html, /BBC Micro/);
  assert.match(html, /Apple II/);
  assert.match(html, /Commodore/);
});

test("CPU workbench exposes the milestone 0.4 debugger surfaces", async () => {
  const html = await readFile("public/cpu-lab.html", "utf8");
  for (const id of ["binaryInput", "debuggerList", "memoryBody", "irqToggle", "nmiButton", "exportStateButton", "stateInput"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /0\.4 · MINIMAL MACHINE/);
});

test("BBC console exposes the debugger, persistent dual-drive media and Tube controls", async () => {
  const html = await readFile("public/bbc.html", "utf8");
  for (const id of ["bbcScreen", "bbcTextMirror", "systemSelect", "softwareSelect", "bootSystemButton", "resetSystemButton", "configurationStatus", "advancedHardware", "osRomInput", "basicRomInput", "bootBbcButton", "bbcPc", "bbcIrq", "enableAudioButton", "uefInput", "ssdInput", "drive1Input", "drive0WriteProtect", "drive1WriteProtect", "exportSsdButton", "exportDrive1Button", "ejectDrive0Button", "ejectDrive1Button", "resetDrive0Button", "resetDrive1Button", "swapDrivesButton", "persistenceDriveSelect", "saveMediaButton", "restoreMediaButton", "duplicateMediaButton", "createBlankDsdButton", "clearStoredMediaButton", "persistenceStatus", "catalogueList", "catalogueStatus", "bbcBreakpointInput", "stepBbcButton", "exportBbcStateButton", "bbcStateInput", "advancedTube", "tubeRomInput", "attachTubeButton", "bootCpmButton", "tubePc", "tubeTranscript"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /1\.8 · PRESERVATION RELEASE/);
  assert.match(html, /aria-describedby=["']bbcKeyboardHelp bbcTextMirror["']/);
  assert.match(html, /<summary>Advanced hardware<\/summary>/);
});

test("Atom console exposes firmware, matrix input, debugger and portable states", async () => {
  const [html, source] = await Promise.all([readFile("public/atom.html", "utf8"), readFile("public/atom.js", "utf8")]);
  for (const id of ["atomScreen", "atomTextMirror", "bootAtomButton", "resetAtomButton", "atomProfileSelect", "atomBbcBasicInput", "atomBasicInput", "atomFloatInput", "atomKernelInput", "atomUtilitySelect", "atomDosEnabled", "runAtomBcdTest", "atomProgramInput", "atomUefInput", "atomTapePlay", "atomTapeRewind", "atomDrive0Input", "atomDrive0Export", "atomDrive1Input", "atomDrive1Export", "atomPc", "atomCycles", "pauseAtomButton", "enableAtomAudioButton", "atomBreakpointInput", "stepAtomButton", "exportAtomStateButton", "atomStateInput"]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /2\.5 · PRESERVATION CORPUS/);
  assert.match(html, /aria-describedby=["']atomKeyboardHelp atomTextMirror["']/);
  assert.match(source, /keyboardQueue/); assert.match(source, /atomKeyboardMappingForBrowserEvent/); assert.match(source, /100\);/);
  assert.match(source, /ROM\/basic1\.rom/);
  assert.match(source, /corpus\/atom\/BCDTEST\.atm\.b64/);
});

test("BBC browser diagnostics and responsive controls have bounded accessible contracts", async () => {
  const [source, styles] = await Promise.all([readFile("public/bbc.js", "utf8"), readFile("public/styles.css", "utf8")]); assert.match(source, /TUBE_OUTPUT_LIMIT = 8192/); assert.match(source, /tubeOutput\.length > TUBE_OUTPUT_LIMIT/); assert.match(source, /bindKeyboardSelect/); assert.match(source, /mountCatalogueMedia/); assert.match(source, /writeProtected: false, catalogueFilename/); assert.match(source, /temporary browser-session copy/); assert.match(source, /restoreRunStateAfterMediaMount\(wasRunning\)/); assert.match(source, /machine resumed\. Type into the focused display/); assert.match(styles, /@media \(max-width: 720px\)/); assert.match(styles, /\.bbc-console-grid/); assert.match(styles, /\.catalogue-mount-row/);
});

test("browser modules stay inside the GitHub Pages project path", async () => {
  for (const script of ["cpu-lab.js", "bbc.js", "atom.js"]) {
    const source = await readFile(`public/${script}`, "utf8");
    assert.doesNotMatch(source, /from ["']\.\.\/src\//);
    assert.match(source, /from ["']\.\/src\//);
  }
});
