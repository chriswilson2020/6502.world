import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

for (const page of ["index.html", "cpu-lab.html"]) {
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
