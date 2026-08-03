# BBC Tube bridge

Milestone 1.1 replaces the absent `$FEE0-$FEEF` device with a stateful host/parasite bridge. Four channels expose even-address status and odd-address data registers. Status bit 7 reports incoming data and bit 6 reports room in the outgoing FIFO. R1 has the Acorn 24-byte parasite-to-host FIFO and a one-byte host-to-parasite latch. Control bit V selects one- or two-byte R3 operation. Host R1 control writes use bit 7 to set, or clear, the lower `Q/I/J/M/V/P` bits; Q, I, J and M gate host IRQ, parasite R1/R4 IRQ and parasite R3 NMI signals respectively.

`Z80TubeSecondProcessor` gives the parasite 64K RAM, an optional local boot ROM of up to 4K and Tube access through Z80 ports 0–7. The scheduler targets three Z80 T-states per BBC 2MHz machine tick, modelling a 6MHz second processor while allowing each CPU to finish its current instruction. P holds and releases the Z80 reset line. Tube queues, control state, Z80 registers, RAM, boot ROM mapping and scheduler position are included in portable BBC states.

## Shared-core provenance

The Z80 implementation is not forked into 6502 World. Git submodule `vendor/z80-world` pins [`chriswilson2020/zx-spectrum-emulator`](https://github.com/chriswilson2020/zx-spectrum-emulator) commit `7fec07ceb89d035891b93a1e602c185fa04ca02b`, the source deployed at [z80.world](https://z80.world). Its repository records 1,604,000 strict instruction-vector cases plus passing ZEXDOC and ZEXALL runs. The dependency is MIT licensed; see `THIRD_PARTY_NOTICES.md`.

## Current boundary

The bridge validates transport, interrupt signaling, scheduling and shared-core execution. It does not bundle Acorn Z80 second-processor firmware, claim an exhaustive electrical Tube ULA timing model, or publish a Z80 BBC software corpus. Users may attach a locally supplied boot ROM in the browser. Those limitations are deliberate and visible in the compatibility matrix.
