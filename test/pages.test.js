import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

for (const page of ["index.html", "cpu-lab.html", "bbc.html"]) {
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
  for (const id of ["bbcScreen", "bbcTextMirror", "systemSelect", "softwareSelect", "bootSystemButton", "resetSystemButton", "configurationStatus", "advancedHardware", "osRomInput", "basicRomInput", "bootBbcButton", "bbcPc", "bbcIrq", "enableAudioButton", "uefInput", "ssdInput", "drive1Input", "drive0WriteProtect", "drive1WriteProtect", "exportSsdButton", "exportDrive1Button", "ejectDrive0Button", "ejectDrive1Button", "resetDrive0Button", "resetDrive1Button", "swapDrivesButton", "persistenceDriveSelect", "saveMediaButton", "restoreMediaButton", "duplicateMediaButton", "clearStoredMediaButton", "persistenceStatus", "bbcBreakpointInput", "stepBbcButton", "exportBbcStateButton", "bbcStateInput", "advancedTube", "tubeRomInput", "attachTubeButton", "bootCpmButton", "tubePc", "tubeTranscript"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /1\.6 · WRITABLE MEDIA/);
  assert.match(html, /aria-describedby=["']bbcKeyboardHelp bbcTextMirror["']/);
  assert.match(html, /<summary>Advanced hardware<\/summary>/);
});

test("browser modules stay inside the GitHub Pages project path", async () => {
  for (const script of ["cpu-lab.js", "bbc.js"]) {
    const source = await readFile(`public/${script}`, "utf8");
    assert.doesNotMatch(source, /from ["']\.\.\/src\//);
    assert.match(source, /from ["']\.\/src\//);
  }
});
