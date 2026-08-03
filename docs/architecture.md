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

## Current accuracy boundary

The 0.3 processor implements the complete documented NMOS instruction set while preserving the cycle-stepped execution model. Undocumented opcodes remain deliberately unsupported.

The public accuracy language must remain:

> Cycle-accurate documented NMOS 6502 instruction execution with a cycle-stepped bus interface.

The claim covers the documented opcode surface validated by the ordered-bus corpus. Undocumented opcodes and machine-level peripheral timing are not included.

## Minimal machine layer

`MinimalMachine` composes the processor with a flat 64K bus. It owns program origins, breakpoints, run-stop policy and portable state files; none of those concerns are added to `M6502`.

State files use a versioned `6502-world-state` envelope and capture the instruction-boundary CPU state, all 64K of memory, the visible trace, interrupt level and debugger breakpoints. Loading a state reconstructs both the bus and CPU so the processor always retains the restored bus reference.

## BBC layer

The BBC Model B will own:

- 32K main RAM;
- OS and sideways ROM mapping;
- 6522 VIA devices;
- 6845 CRTC and Video ULA;
- keyboard matrix;
- sound chip;
- cassette and disc hardware;
- machine timing and state serialisation.

The 0.5 bus implements the memory map, ROM selection, timing domains and address-decoded device shells. Interactive behavior is filled in incrementally by later milestones. None of those concerns belong inside `M6502`.
