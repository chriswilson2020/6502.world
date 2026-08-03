# BBC Model B 1.0 compatibility

This matrix records what 6502 World 1.0 actually validates. “Implemented” does not imply complete timing compatibility with all historical software.

| Surface | Status | Evidence / limitation |
|---|---|---|
| Documented NMOS 6502 | Validated | 1,510,000 ordered SingleStepTests vectors plus functional, decimal and interrupt suites |
| Model B memory and ROMSEL | Implemented | 32K RAM, OS ROM and sixteen 8K/16K sideways banks |
| OS 1.20 + BASIC II | Validated | Bundled real-ROM test reaches the mode 7 prompt and accepts matrix input |
| System VIA | Partial | Port A/B, IC32, keyboard, timer 1/2 and IRQ behavior used by the boot path; serial/shift details remain |
| CRTC / Video ULA | Partial | Mode 7 text window, scrolling address and register state; bitmap modes and full teletext attributes remain |
| Keyboard | Implemented for browser use | BBC matrix, two-key chords and shifted double quote verified; international-layout coverage remains |
| SN76489 | Partial | Tone/noise registers and browser audio voices; waveform/timing corpus remains |
| UEF cassette | Partial | Standard `$0100` data chunks and transport; waveform/security chunks and MOS ACIA loading remain |
| SSD / Intel 8271 | Partial | Seek and normal sector read/write with NMI requests; protected/nonstandard layouts and full DFS corpus remain |
| Portable BBC state | Stable v1 | CPU, memory, ROMs, core devices and local media round-trip at instruction boundaries; incompatible future formats must use a new version |
| Tube | Not implemented | An absent interface is exposed today; host/parasite protocol is milestone 1.1 |

## Browser support

The static application uses standard ES modules, Canvas 2D, Web Audio, File/Blob APIs and `requestAnimationFrame`. Current Chromium is exercised in the browser checks. Controls have visible keyboard focus, the BBC canvas has a text alternative, audio starts only after a user gesture, and the workbench collapses to one column below 1050 pixels.
