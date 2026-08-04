# BBC Model B 1.0 compatibility

This matrix records what 6502 World 1.0 actually validates. “Implemented” does not imply complete timing compatibility with all historical software.

| Surface | Status | Evidence / limitation |
|---|---|---|
| Documented NMOS 6502 | Validated | 1,510,000 ordered SingleStepTests vectors plus functional, decimal and interrupt suites |
| Model B memory and ROMSEL | Implemented | 32K RAM, OS ROM and sixteen 8K/16K sideways banks |
| OS 1.20 + BASIC II | Validated | Bundled real-ROM test reaches the mode 7 prompt and accepts matrix input |
| System VIA | Partial | Port A/B, IC32, keyboard, timer 1/2 and IRQ behavior used by the boot path; serial/shift details remain |
| CRTC / Video ULA | Partial | Mode 7 text plus MOS-font decoding of the 80-column bitmap screen used by CP/M; pixel rendering and full teletext attributes remain |
| Keyboard | Implemented for browser use | BBC matrix, two-key chords and shifted double quote verified; international-layout coverage remains |
| SN76489 | Partial | Tone/noise registers and browser audio voices; waveform/timing corpus remains |
| UEF cassette | Partial | Standard `$0100` data chunks and transport; waveform/security chunks and MOS ACIA loading remain |
| SSD / Intel 8271 | Partial | Seek and normal sector read/write with NMI requests; protected/nonstandard layouts and full DFS corpus remain |
| DSD / Intel 8271 | CP/M read/write validated | Two physical drives, both DSD sides, observed commands/special registers, FM-paced NMI transfers, CP/M-created files, warm-boot survival and exact export |
| Browser media persistence | Implemented | IndexedDB full-image working copies with SHA-256 base identity, revision-aware warnings, restore, duplicate, clear and original reset |
| Acorn Z80 software catalogue | Four entries validated | All 12 bundled DSDs hash-accounted; Utilities, BBC BASIC, MemoPlan and GraphPlan have repeatable launch gates; MemoPlan and GraphPlan also have native save and exported-image remount evidence |
| Pages / optional media | Validated | CI builds with the approved corpus and with `MEDIA_SOURCE` absent; local imports and blank DSD targets remain available |
| Portable BBC state | Stable v2 | CPU, memory, ROMs, core devices, two drives and active FDC transfers round-trip; version 1 SSD states migrate |
| Tube | Acorn CP/M validated | Four duplex channels, Acorn control/FIFO behavior, interrupts, state resume and 6MHz scheduling; real CP/M 2.2 boots and runs `DIR`/`STAT` |

## Browser support

The static application uses standard ES modules, Canvas 2D, Web Audio, File/Blob and IndexedDB APIs and `requestAnimationFrame`. Current Chromium is exercised at desktop and 390-pixel widths. Explicit hardware profiles and compatible software presets support deterministic deep links, cold switching and independent two-drive controls. Controls have visible keyboard focus, advanced controls use native disclosures, the BBC canvas has a text alternative, audio starts only after a user gesture, and the console collapses without horizontal document overflow. Protected/nonstandard disc layouts remain unsupported.
