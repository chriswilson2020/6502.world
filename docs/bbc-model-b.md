# BBC Micro Model B bootstrap

Milestone 0.5 introduces the first machine-specific layer without putting BBC behavior into the processor core.

## Memory map

| Range | Model B target | Timing domain |
| --- | --- | --- |
| `$0000–$7FFF` | 32K main RAM | 2 MHz |
| `$8000–$BFFF` | selected 16K sideways ROM | 2 MHz |
| `$C000–$FBFF` | operating-system ROM | 2 MHz |
| `$FC00–$FCFF` | FRED expansion page | 1 MHz |
| `$FD00–$FDFF` | JIM expansion page | 1 MHz |
| `$FE00–$FEFF` | SHEILA internal devices | 1 MHz |
| `$FF00–$FFFF` | operating-system ROM and vectors | 2 MHz |

`ROMSEL` at `$FE30–$FE3F` selects one of sixteen sideways banks. Both 8K and 16K images are accepted; an 8K image is mirrored through the 16K window.

The initial SHEILA decode provides register shells for the 6845 CRTC, 6850 ACIA, serial and video ULAs, system and user 6522 VIAs, 8271 FDC, Econet, ADC and Tube ULA. FRED and JIM each have a 256-byte expansion shell. These shells establish addresses, mirrors, trace identity and timing; interactive behavior belongs to later milestones.

Every bus access is classified into a 2 MHz or stretched 1 MHz timing domain. Machine clocks return both the CPU bus cycle and the number of half-microsecond machine ticks it consumed.

## Interactive 0.6 layer

The system VIA implements timer 1/2 interrupt state, the IC32 addressable latch and the keyboard path on slow data bus port A. Browser key codes map to the Model B's ten-column/eight-row internal matrix. The mode 7 renderer translates the CRTC's MA13-selected 1K window to `$7C00–$7FFF`, including hardware scrolling within that window.

The browser console boots bundled OS 1.20 and BASIC II images by default, while its file controls can replace either image locally. See [`../ROM/README.md`](../ROM/README.md) for the complete bundled set and checksums.

## ROM diagnostics

Load a 16K OS image, with optional sideways ROMs, into the headless diagnostic runner:

```sh
node scripts/diagnose-bbc-boot.js /path/to/os.rom 15:/path/to/basic.rom
```

The JSON report records the reset vector, terminal PC, selected ROM, machine ticks and cumulative per-device access counts. Automated tests include both a synthetic bootstrap and the bundled OS/BASIC prompt-and-keyboard path.

## Hardware references

- Acorn Computers, *BBC Microcomputer Service Manual*, hardware description and memory/address decoding: <https://acorn.huininga.nl/pub/docs/manuals/Acorn/BBC%20B/BBC%20Microcomputer%20Service%20Manual.pdf>
- Acorn Computers, *BBC Microcomputer Advanced User Guide*, memory map and sideways ROM system: <https://manualzilla.com/doc/6893132/bbc-microcomputer-advanced-user-guide>
