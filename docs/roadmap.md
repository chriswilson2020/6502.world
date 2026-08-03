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

## 0.6 — Interactive BBC (implemented)

- display and Video ULA
- system VIA
- keyboard matrix
- timers and interrupts
- BASIC prompt and editing
- browser renderer

**Gate:** bundled OS 1.20 and BASIC II reach the prompt, and a browser key travels through the system VIA matrix into BASIC.

**Evidence:** the real-ROM integration test executes five million instructions, recognizes the mode 7 boot banner and prompt, presses internal key `$41`, and observes `>A` on screen. Focused tests cover timer interrupts, keyboard scanning and CRTC address translation. The browser console auto-boots the same images and exposes live machine state.

## 0.7 — Audio and media (implemented)

- SN76489 sound
- UEF cassette
- SSD disc images
- 8271 controller
- writable local media

**Gate:** VIA sound strobes program audible SN76489 channel state; a standard UEF data stream can be transported; and 8271 register transfers round-trip a writable SSD sector without mutating the source file.

**Evidence:** focused tests cover SN latch/data writes and attenuation, UEF signature/chunk parsing and transport, and complete 256-byte 8271 read/write transfers. The browser enables sound only after a user gesture, mounts UEF/SSD files locally, reports transport state and exports the current writable SSD image. See `bbc-media.md`.

## 0.8 — Public beta (implemented)

- save states
- debugger workbench
- responsive layout
- compatibility matrix
- performance and accessibility passes

**Gate:** a complete BBC state round-trips through JSON and resumes execution; browser debugger, breakpoint and state controls work at desktop and narrow widths; current compatibility claims and limitations are published.

**Evidence:** the portable-state test restores CPU, RAM, ROM selection, VIA, video, sound, UEF position, dirty SSD data and then executes the next instruction. Browser checks cover boot, stepping, breakpoint controls, export/import, focus-visible keyboard operation, text-screen mirroring and responsive layout. See `compatibility.md`.

## 1.0 — Stable BBC Model B (implemented)

- published validation evidence
- stable state format
- tested software corpus
- documented limitations

**Gate:** the pinned OS 1.20/BASIC II pair boots and executes a quoted BASIC program through the real keyboard matrix; portable states identify and round-trip the stable version 1 contract; validation evidence and limitations are published.

**Evidence:** `npm test` covers the CPU, machine, browser assets and state contract. `npm run test:bbc-software` reports the exact ROM hashes, reaches the BASIC prompt in 173,000 instructions and executes `PRINT "HI"`. See `bbc-validation.md`, `state-format.md` and `compatibility.md`.

## 1.1 — Tube bridge (implemented)

- Tube ULA
- host and parasite protocols
- multi-CPU scheduling
- reuse of the existing Z80 World core as a Z80 second processor

**Gate:** host and parasite exchange bytes through four Tube channels and hardware-style status flags; control writes assert host IRQ and parasite IRQ/NMI lines; the pinned Z80 World core executes through Tube ports at a scheduled 6MHz against the 2MHz host clock; the complete bridge round-trips in a BBC portable state.

**Evidence:** focused tests cover duplex FIFOs, Acorn R1/control semantics, `$FEE0-$FEEF` host and `$FEF8-$FEFF` parasite mapping, Z80 `IN`/`OUT`, clock scheduling and state resume. The bundled Acorn Z80 1.20 ROM boots through OS 1.20 and DNFS, emits its startup transcript through R1, and reaches its R2 command loop. The browser boots the same images and exposes the transcript, parasite PC and T-states. See `tube.md`.

## Scope rule

No Apple II, Commodore or NES machine implementation begins before BBC 1.0. The point of 6502 World is to prove reusable architecture, not to accumulate unfinished machine cards.
