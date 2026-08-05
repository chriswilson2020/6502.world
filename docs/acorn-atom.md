# Acorn Atom machine

Milestones 2.0 through 2.4 introduce an independent, interactive Acorn Atom machine around the existing cycle-stepped NMOS 6502 core.

## Implemented hardware boundary

The machine maps system RAM at `$0000-$03FF`, text workspace RAM at `$2800-$3BFF`, MC6847 video RAM at `$8000-$97FF`, the optional utility socket at `$A000-$AFFF`, the 8255 PPI at mirrored addresses `$B000-$B3FF`, the 6522 expansion VIA at `$B800-$BBFF`, BASIC at `$C000-$CFFF`, floating point at `$D000-$DFFF`, optional DOS at `$E000-$EFFF` and the kernel at `$F000-$FFFF`.

The 8255 exposes the Atom's ten-column, six-row active-low keyboard matrix, active-low Control, Shift and Repeat inputs, the approximately 2400 Hz cassette timing input and a 60 Hz MC6847 frame-sync pulse. Port A selects the keyboard column and records the graphics-mode output bits. The first VIA boundary supplies mirrored registers and the inactive printer-busy level required by the kernel; timer, interrupt and printer behavior remains future work.

## Firmware validation

The owner-supplied BASIC and kernel images concatenate to SHA-1 `0072c83458a9690a3ea1f6094f0f38cf8e96a445`, matching the canonical Atom `abasic.ic20` definition. `Atom_FloatingPoint2.rom` has SHA-1 `ebcde5b36cb3a3344567cbba4c7b9fde015f4802`, matching canonical `afloat.ic21`.

`npm run test:atom` checks those identities, ROM protection, device mirroring, keyboard/timing inputs and real firmware execution. The real machine reaches:

```text
ACORN ATOM
>
```

after 3,000 instructions while accessing both the 8255 and 6522 boundaries. No firmware-specific program-counter shortcut is used.

## Interactive browser gate

`atom.html` boots the bundled core ROMs automatically and renders the 32 × 16 alphanumeric display with an accessible text mirror. It also renders six-block semigraphics and all eight PPI-selected MC6847 bitmap modes at their native decoded geometry, scaled without interpolation. The four-colour sets are green/yellow/blue/red and buff/cyan/magenta/orange; the high-resolution modes use black plus green or buff. Local 4K replacements remain available for all three core sockets. The console exposes BREAK/reset, pause/run, single-instruction stepping, address breakpoints, buzzer audio after a user gesture and a versioned full-machine JSON state.

Modern printable characters are translated by the character they represent rather than their host key position. Because the standard Atom character set has no lowercase letters, both lowercase and uppercase host letter events map to the normal unshifted Atom letter; this avoids shifted inverse-video keywords that BASIC rejects with error 94. Modern Caps Lock is consumed by the browser layer instead of being forwarded to the Atom's inverse-character LOCK key. Atom punctuation remains positional to the original legends: `*` maps to Atom Shift+`:`, while `"` maps to Atom Shift+`2`. Browser key events enter a bounded pacing queue because the original firmware debounce loop requires longer press and release intervals than automation or very fast host typing supplies.

The deterministic software corpus and a real Chromium workflow both enter:

```text
PRINT "HI"
```

through the matrix and observe `HI>` on the Atom display.

The preservation corpus additionally runs Bruce Clark's independently sourced `BCDTEST_atom` from the Atom Software Archive. The exact upstream file is pinned to SHA-256 `1afc39aa5e6ebe497d428543a9325ff61e3aa83bf8bbb8244a194ba4fa7fa0b1`; the gate verifies its ATM header, `$2900` load/run address and complete CPU/range/flags selection menu after execution through the real Atom ROM calls and display memory.

## Software and expansion

The ATM loader validates the 22-byte header and exact payload length, loads normal programs at their declared address and execution vector, and updates Atom BASIC's end pointer for the conventional `$C2B2` BASIC run address. It does not guess that arbitrary `.rom` data is an ATM file.

Eight owner-approved utility ROMs can be selected for `$A000`; Atom DOS can independently occupy `$E000`. The original Atom 8271 register window at `$0A00-$0A04` reuses the tested sector controller and supports two SSD/DSD drives. Browser mounts clone all input bytes, writes affect only the private session copy, and users can export that copy. Mounted copies also round-trip in Atom portable state.

Local UEF cassette images are signature- and chunk-length validated. Standard `$0100` data-stream bytes are serialized with one start bit, eight least-significant-bit-first data bits and two stop bits. At the Atom's 1 MHz machine rate, each bit lasts 3,333 cycles; zero and one bits synthesize 1200 Hz and 2400 Hz levels into PPI port C bit 5. Play, pause, rewind, byte/bit position and waveform phase round-trip in portable state. Other UEF chunk types are parsed but are not yet interpreted as Atom tape data.

## BBC BASIC conversion card

The optional profile follows Acorn conversion-card documentation and schematic 102-007/C. In BBC BASIC mode, RAM/video occupies `$0000-$5FFF` with the 6K MC6847 window at `$4000`, the utility socket moves to `$6000`, the 8255 and 6522 move to `$7000` and `$7800`, the 16K BBC BASIC ROM occupies `$8000-$BFFF`, and the conversion MOS occupies `$F000-$FFFF`. The 6522 now supplies timer 1/2, interrupt flags/enables and CPU IRQ delivery required by TIME, ESC and SOUND.

The owner-supplied, checksum-pinned conversion pair is BASIC I (SHA-256 `6dccf62d34a90fc16f102f9dbb3431bbf084e4edcbc21a5f059bbdf6af35b566`) plus Atom BBC BASIC MOS variant 1 (SHA-256 `8419bc5e8c39aaa72445754879ca15de2a7fca3e0334bb7852312537bc9f1112`). The browser boots that pair automatically, reaches `BBC BASIC`, accepts `PRINT "HI"` through the Atom matrix and prints `HI`; the file input remains an optional local replacement. The uploaded `BBC_BASIC_4.rom` exactly matches the canonical Master-era BASIC 4 archive image, but with this MOS variant it prints the banner and then falls through an uninitialised BRK vector, so it is not shipped or claimed compatible.

## Deliberately deferred

- real Atom disk software corpus validation and broader ATM title coverage;
- protected or nonstandard Atom disk layouts;
- UEF waveform/security chunks and cassette recording;

Primary conversion references: [Acornsoft, *BBC BASIC Conversion Unit for the Acorn ATOM*](https://acorn.huininga.nl/pub/mirrors/ftp.nvg.org/pub/bbc/doc/AtomBBCBASIC.zip) and [Acorn conversion-card schematic 102-007/C](https://theoddys.com/acorn/acorn_system_computers/atom/atom_bbc_basic/Acorn%20Atom%20BBC%20BASIC%20Conversion%20Card%20102.007%20Schematic.jpg).
