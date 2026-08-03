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

## Current CPU slice

The 0.2 core implements all 151 documented NMOS 6502 opcodes and addressing modes, including:

- binary and NMOS decimal `ADC`/`SBC`;
- stack operations, subroutines and returns;
- reset, `BRK`, IRQ and NMI sequencing;
- the original indirect-`JMP` page-wrap behavior;
- instruction-boundary state save and restore;
- disassembly of every documented opcode;
- one externally visible bus transaction per `clock()` call;
- instruction stepping layered on top of cycle stepping.

The core is **not yet described as cycle-accurate**. That claim remains gated on ordered-bus validation against established processor test corpora in milestone 0.3.

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

## Project structure

```text
src/cpu/       processor core
src/bus/       machine-independent bus implementations
public/        static website and CPU Lab
scripts/       local server and Pages build
test/          CPU and website tests
docs/          architecture, roadmap and ROM policy
```

## Relationship to Z80 World

6502 World is a sibling to [Z80 World](https://z80.world), not a replacement for it. The sites share a design language while keeping CPU cores, validation suites and machine implementations independent. A future BBC Tube implementation is the intended technical bridge between the two projects.
