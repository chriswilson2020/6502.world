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

The initial core implements the instructions needed by the bundled CPU Lab program and establishes the public API that the complete core will retain:

- reset sequencing;
- `LDA #`, `LDX #`, `LDY #`;
- `STA abs`, `STX abs`, `STY abs`;
- `INX`, `INY`, `DEX`, `DEY`;
- `CPX #`, `CPY #`, `CMP #`;
- `BNE`, `BEQ`, `BCC`, `BCS`, `BMI`, `BPL`;
- `JMP abs`, `NOP`, flag operations and `BRK`;
- one externally visible bus transaction per `clock()` call;
- instruction stepping layered on top of cycle stepping.

This is intentionally **not yet described as a complete or cycle-accurate 6502**. The next CPU milestone is complete legal-opcode coverage followed by ordered-bus validation against established test corpora.

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
