# Implementation roadmap

## 0.1 — Foundation

- Static 6502 World identity
- GitHub Pages deployment
- Cycle-stepped CPU API
- Minimal 64K bus
- Interactive CPU Lab
- Ordered trace display
- Tests and documentation

## 0.2 — Complete legal NMOS instruction set

- All documented opcodes
- All addressing modes
- Binary and decimal arithmetic
- Stack operations
- IRQ, NMI and reset sequencing
- State serialisation
- Disassembler coverage

**Gate:** functional, decimal and interrupt test suites pass.

## 0.3 — Ordered-bus validation

- Processor vector importer
- Dummy accesses
- Branch and page-cross timing
- Read-modify-write sequences
- Interrupt traces

**Gate:** complete legal-opcode bus corpus passes before any cycle-accuracy claim.

## 0.4 — Minimal machine release

- Binary loading
- Cycle and instruction debugger
- Memory inspector
- IRQ/NMI controls
- Portable state files

## 0.5 — BBC bootstrap

- Model B memory map
- OS and sideways ROMs
- ROMSEL
- slow-access timing
- VIA and CRTC shells
- headless boot diagnostics

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
