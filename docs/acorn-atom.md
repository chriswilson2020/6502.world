# Acorn Atom machine

Milestones 2.0 and 2.1 introduce an independent, interactive Acorn Atom machine around the existing cycle-stepped NMOS 6502 core.

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

`atom.html` boots the bundled core ROMs automatically and renders the 32 × 16 alphanumeric display with an accessible text mirror. Local 4K replacements remain available for all three core sockets. The console exposes BREAK/reset, pause/run, single-instruction stepping, address breakpoints, buzzer audio after a user gesture and a versioned full-machine JSON state.

Modern printable characters are translated by the character they represent rather than their host key position. This is important for Atom punctuation: `*` maps to Atom Shift+`:`, while `"` maps to Atom Shift+`2`. Browser key events enter a bounded pacing queue because the original firmware debounce loop requires longer press and release intervals than automation or very fast host typing supplies.

The deterministic software corpus and a real Chromium workflow both enter:

```text
PRINT "HI"
```

through the matrix and observe `HI>` on the Atom display.

## Software and expansion

The ATM loader validates the 22-byte header and exact payload length, loads normal programs at their declared address and execution vector, and updates Atom BASIC's end pointer for the conventional `$C2B2` BASIC run address. It does not guess that arbitrary `.rom` data is an ATM file.

Eight owner-approved utility ROMs can be selected for `$A000`; Atom DOS can independently occupy `$E000`. The original Atom 8271 register window at `$0A00-$0A04` reuses the tested sector controller and supports two SSD/DSD drives. Browser mounts clone all input bytes, writes affect only the private session copy, and users can export that copy. Mounted copies also round-trip in Atom portable state.

## Deliberately deferred

- pixel-accurate MC6847 rendering and graphics modes;
- cassette transport;
- tape/cassette loading;
- real Atom disk and ATM software corpus validation;
- BBC BASIC mode.
