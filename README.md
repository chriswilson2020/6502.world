# 6502 World

**6502 World** is a browser-based virtual hardware project built around a transparent, reusable MOS 6502 CPU core.

The long-term proposition is simple:

> One carefully validated 6502 core powering multiple classic machines.

This repository begins with a deliberately small but complete vertical slice:

- a cycle-stepped NMOS 6502 foundation;
- a flat 64K memory bus;
- an interactive browser CPU Lab;
- ordered bus traces for every visible cycle;
- automated tests and GitHub Pages deployment;
- architecture, ROM-policy and implementation-roadmap documentation.

The first full machine target is the **BBC Micro Model B**. Apple II, Acorn Atom and Commodore-family targets remain future work until the BBC implementation is stable.

## Current release — 1.7

The 1.7 release turns the stable, writable Acorn CP/M path into an evidence-backed software catalogue:

- the 32K RAM, sideways ROM, OS ROM, FRED, JIM and SHEILA map;
- sixteen sideways banks selected by `ROMSEL` at `$FE30`;
- 1 MHz access classification and stretched machine timing;
- system VIA timers, IRQs, IC32 latch behavior and the Model B keyboard matrix;
- CRTC/Video ULA state and a browser-rendered 40-column mode 7 display;
- bundled OS 1.20 and BASIC II booting to an editable prompt;
- SN76489 tone/noise register behavior driven through the system VIA sound strobe;
- UEF standard-stream parsing with play, pause and rewind transport;
- writable SSD images transferred through an 8271 register/NMI model and exportable from the browser;
- full-machine portable states, instruction stepping, disassembly and address breakpoints;
- responsive keyboard-accessible controls, a screen-reader text mirror and an explicit compatibility matrix;
- a repeatable real-ROM software corpus plus the headless boot diagnostic;
- a stable version 1 full-machine state contract;
- four duplex Tube channels with status/control and host/parasite interrupt lines;
- a stateful 6MHz Z80 second processor scheduled beside the 2MHz BBC host;
- bundled Acorn TUBE Z80 64K 1.20 firmware, local replacement loading and parasite telemetry;
- a real OS 1.20 + DNFS + Z80 ROM integration gate that observes the startup transcript and command loop;
- backward-compatible SSD plus interleaved two-sided DSD images with immutable sources and byte-exact export;
- the owner-approved, hash-pinned Acorn Z80 media corpus bundled under `MEDIA/`;
- an unmodified Acorn CP/M 2.2 boot through OS 1.20, DNFS, the paced 8271 and Tube;
- a deterministic `DIR` and `STAT` gate driven through the BBC keyboard matrix;
- a first-class browser action and 80-column MOS-font screen decoding;
- separate declarative hardware profiles and compatible software presets;
- cold profile switching, independent per-drive controls and dirty-media warnings;
- stable BASIC and CP/M deep links with visible safe fallback behavior;
- advanced ROM and Tube controls moved behind keyboard-accessible disclosures.
- hardware-mediated CP/M file creation that survives warm boot and exported-image remount;
- revision-aware dirty tracking, per-drive write protection and immutable bundled source images;
- IndexedDB working copies with base hashes, geometry, full image bytes and catalogue association;
- local save, restore, duplicate, clear, reset-original and `.ssd`/`.dsd` export controls.
- exact SHA-256 catalogue coverage for all 12 owner-approved Acorn Z80 DSDs;
- explicit validated, identified and unsupported statuses instead of filename-based availability claims;
- a two-drive BBC BASIC for Z80 preset that boots CP/M on A:, selects B: through the BBC keyboard and launches `BBCBASIC`;
- a repeatable BBC BASIC 2.20 title gate and committed bounded text transcript;
- coherent Accountant and Nucleus multi-disc metadata with writable-disc guidance;
- an explicit metadata-only record for the absent original seven-disc installation set.

The minimal machine wraps the validated processor in a portable 64K workbench with:

- raw binary and hexadecimal loading at a selectable origin;
- cycle, instruction and chunked run controls;
- address breakpoints and a live disassembly window;
- a navigable 128-byte memory inspector;
- IRQ level and NMI edge controls;
- versioned JSON state files containing the CPU, full memory, trace and debugger state.

The core implements all 151 documented NMOS 6502 opcodes and addressing modes, including:

- binary and NMOS decimal `ADC`/`SBC`;
- stack operations, subroutines and returns;
- reset, `BRK`, IRQ and NMI sequencing;
- the original indirect-`JMP` page-wrap behavior;
- instruction-boundary state save and restore;
- disassembly of every documented opcode;
- one externally visible bus transaction per `clock()` call;
- instruction stepping layered on top of cycle stepping.

Documented instruction execution is validated cycle by cycle against 1,510,000 SingleStepTests scenarios, including dummy accesses, page crossings and read-modify-write sequences. Reset, IRQ and NMI entry have explicit ordered-trace tests. Undocumented opcodes remain outside the supported and validated surface.

## Run locally

```sh
npm test
npm run dev
```

Open `http://localhost:3000`.

## Build the static site

```sh
npm run build:pages
```

The deployable site is written to `dist/`.

## External CPU validation

The repository does not redistribute third-party processor-test binaries. After obtaining Klaus Dormann's `6502_functional_test.bin`, run:

```sh
node scripts/run-functional-test.js /path/to/6502_functional_test.bin
```

The runner loads the 64K image, starts it at `$0400`, and reports success only when the suite reaches its `$3469` completion loop.

After obtaining the SingleStepTests `6502/v1` JSON corpus, run the ordered-bus validator against a single opcode file or a directory containing the 151 documented-opcode files:

```sh
node scripts/run-bus-vectors.js /path/to/6502/v1/a9.json
node scripts/run-bus-vectors.js /path/to/legal-opcode-vectors
```

See [`docs/validation.md`](docs/validation.md) for the pinned corpus revisions and published evidence.

Run the bundled BBC software corpora separately with `npm run test:bbc-software`, `npm run test:bbc-z80`, `npm run test:bbc-cpm`, `npm run test:bbc-cpm-write` and `npm run test:bbc-catalogue`. See [`docs/bbc-validation.md`](docs/bbc-validation.md) for BASIC results, [`docs/tube.md`](docs/tube.md) for Z80 evidence, [`docs/acorn-z80-cpm.md`](docs/acorn-z80-cpm.md) for CP/M evidence, [`docs/acorn-z80-media.md`](docs/acorn-z80-media.md) for catalogue status, [`docs/bbc-media-persistence.md`](docs/bbc-media-persistence.md) for writable-media behavior, and [`docs/state-format.md`](docs/state-format.md) for the stable state contract.

## Project structure

```text
src/cpu/       processor core
src/bus/       machine-independent bus implementations
src/machine/   minimal machine composition and portable state
src/machine/bbc/ Model B bus, devices, Tube bridge and machine composition
vendor/z80-world/ pinned shared Z80 World source dependency
ROM/           bundled BBC firmware and checksum/provenance notes
public/        static website and CPU Lab
scripts/       local server and Pages build
test/          CPU and website tests
docs/          architecture, roadmap and ROM policy
```

## Relationship to Z80 World

6502 World is a sibling to [Z80 World](https://z80.world), not a replacement for it. The 1.1 BBC Tube implementation pins and directly imports Z80 World's validated CPU core, while the projects retain independent machine layers and validation suites.
