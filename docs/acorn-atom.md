# Acorn Atom machine

Milestone 2.0 introduces an independent Acorn Atom machine around the existing cycle-stepped NMOS 6502 core.

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

## Deliberately deferred

- browser UI and modern-keyboard translation;
- pixel-accurate MC6847 rendering and graphics modes;
- sound and cassette transport;
- ATM program and tape loading;
- utility-ROM selection and DOS/FDC support;
- portable Atom states;
- BBC BASIC mode.
