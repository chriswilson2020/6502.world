# Architecture

## Principle

6502 World separates four concerns:

```text
CPU core → mapped bus → machine → browser host
```

The CPU knows about registers, flags, vectors and bus cycles. It does not know about the BBC Micro, HTML, canvas, audio or files.

## CPU boundary

`M6502` receives a bus with:

```js
bus.read8(address)
bus.write8(address, value)
```

`cpu.clock()` performs exactly one visible cycle and returns the transaction. `cpu.step()` loops over `clock()` until the next instruction boundary.

This allows future machines to observe dummy reads, page-crossing activity, interrupt entry and slow-device accesses without adding machine-specific conditions to the processor.

## Current limitation

The initial pull request establishes the execution model with the instruction subset used by the CPU Lab. It is not a complete NMOS 6502 implementation.

The public accuracy language must therefore remain:

> Cycle-stepped 6502 foundation with an intentionally limited instruction set.

A cycle-accuracy claim is gated on complete legal-opcode support and ordered-bus validation.

## Planned BBC layer

The BBC Model B will own:

- 32K main RAM;
- OS and sideways ROM mapping;
- 6522 VIA devices;
- 6845 CRTC and Video ULA;
- keyboard matrix;
- sound chip;
- cassette and disc hardware;
- machine timing and state serialisation.

None of those concerns belong inside `M6502`.
