# Acorn Z80 CP/M 2.2 validation

Milestone 1.4 boots the unmodified recovered Acorn CP/M Utilities DSD through the emulated BBC Model B, OS 1.20, DNFS, Intel 8271, Tube ULA and Acorn Z80 second processor. No CP/M bytes are preloaded into parasite RAM and no prompt or MOS call is synthesized.

Run the deterministic gate with:

```sh
npm run test:bbc-cpm
```

The pinned inputs are:

| Input | SHA-256 |
|---|---|
| `ROM/os12.rom` | `2d9fea69017864f6962704481829f95fee08446c8c3a13826d5d4e44000ac9de` |
| `ROM/basic2.rom` | `45bd55dc0f6f0f8f1fe9e2481de7def206565eec8f600ba3068b849ca4132079` |
| `ROM/dnfs.rom` | `e745e34895225a6650b712c1dd0656cb0b0b15f072a8ae6d9ea8d1ac257eb3d6` |
| `ROM/z80.rom` | `c188be4d0abaeb7361e2b623f99270a618f0b75e72e2c71a69c2c7c7b9d4be73` |
| `MEDIA/CPM_Utilities_Disc.dsd` | `9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a` |

A reference run reaches the first prompt and completes `DIR` and `STAT` in 2,285,003 host instructions, 8,753,298 BBC ticks and 26,259,901 Z80 T-states. Input is pressed and released through the BBC keyboard matrix. The primary assertion decodes the real 80-column bitmap display using the MOS font; bounded Tube and FDC traces are retained only for diagnostics.

```text
Acorn CP/M 2.2 - Bios 1.20

A>DIR
A: UNLIST   COM : CONVERT  COM : CRC      COM : CRCKLIST CRC
...
A: DDOKI84  PRL : MOVCPM   COM
A>STAT
A: R/W, Space: 224k

A>
```

The boot exposed and locked three hardware details: Z80 Tube access is I/O-only with an `$FE` IM2 acknowledge vector, 8271 FM bytes are paced at 128 BBC ticks so its NMI handler cannot re-enter, and the 6850 status register must not echo its control byte. The controller remains a compatibility implementation rather than a protected/nonstandard-format model.

Milestone 1.6 adds a separate writable gate:

```sh
npm run test:bbc-cpm-write
```

The gate mounts a clone of the Utilities DSD read/write, enters `SAVE 1 CODEX.COM` through the BBC keyboard, observes three hardware 8271 write transfers, warm-boots with Control-C, and verifies `CODEX.COM` in `DIR`. It exports the modified 409,600-byte DSD into a fresh machine and verifies the file again, then mounts the original bytes and proves the file is absent. Before and after SHA-256 checks prove that `MEDIA/CPM_Utilities_Disc.dsd` remains unchanged.
