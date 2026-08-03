# Implementation roadmap

## 0.1 — Foundation

- Static 6502 World identity
- GitHub Pages deployment
- Cycle-stepped CPU API
- Minimal 64K bus
- Interactive CPU Lab
- Ordered trace display
- Tests and documentation

## 0.2 — Complete legal NMOS instruction set (implemented)

- All documented opcodes
- All addressing modes
- Binary and decimal arithmetic
- Stack operations
- IRQ, NMI and reset sequencing
- State serialisation
- Disassembler coverage

**Gate:** functional, decimal and interrupt test suites pass.

**Evidence:** repository unit tests cover the opcode matrix, decimal arithmetic and interrupt entry/return; the core also reaches the `$3469` success loop in Klaus Dormann's 64K functional test after 30,646,177 instructions.

## 0.3 — Ordered-bus validation (implemented)

- Processor vector importer
- Dummy accesses
- Branch and page-cross timing
- Read-modify-write sequences
- Interrupt traces

**Gate:** complete legal-opcode bus corpus passes before any cycle-accuracy claim.

**Evidence:** 1,510,000 SingleStepTests scenarios pass across all 151 documented opcodes with exact ordered address, data and read/write comparisons. Repository tests separately assert reset, BRK, IRQ, NMI, branch, page-cross and RMW traces. See `validation.md` for pinned revisions.

## 0.4 — Minimal machine release (implemented)

- Binary loading
- Cycle and instruction debugger
- Memory inspector
- IRQ/NMI controls
- Portable state files

**Evidence:** the browser workbench loads raw binaries and hex programs at selectable origins, stops on address breakpoints, exposes cycle/instruction/chunked execution, navigates all 64K of memory, drives IRQ/NMI inputs, and round-trips versioned full-memory JSON states. Machine-model tests and browser interaction checks cover the release paths.

## 0.5 — BBC bootstrap (implemented)

- Model B memory map
- OS and sideways ROMs
- ROMSEL
- slow-access timing
- VIA and CRTC shells
- headless boot diagnostics

**Evidence:** synthetic-ROM tests reset through the OS vector, select sideways bank 15, read the paged ROM, write main RAM, access the system VIA shell and settle in an OS loop. Focused tests cover 8K/16K ROM banking, OS write protection, CRTC/VIA mirrors and 1 MHz timing classification. See `bbc-model-b.md`.

## 0.6 — Interactive BBC

- display and Video ULA
- system VIA
- keyboard matrix
- timers and interrupts
- BASIC prompt and editing
- browser renderer

## 0.7 — Audio and media

- SN76489 sound
- UEF cassette
- SSD disc images
- 8271 controller
- writable local media

## 0.8 — Public beta

- save states
- debugger workbench
- responsive layout
- compatibility matrix
- performance and accessibility passes

## 1.0 — Stable BBC Model B

- published validation evidence
- stable state format
- tested software corpus
- documented limitations

## 1.1 — Tube bridge

- Tube ULA
- host and parasite protocols
- multi-CPU scheduling
- reuse of the existing Z80 World core as a Z80 second processor

## Scope rule

No Apple II, Commodore or NES machine implementation begins before BBC 1.0. The point of 6502 World is to prove reusable architecture, not to accumulate unfinished machine cards.
