# Bundled BBC ROM images

These files were supplied by the repository owner as emulator inputs and approved for the current repository distribution. Every row below has the same provenance: repository-owner upload. Every image remains a third-party firmware work, is not covered by the source code's MIT licence, and is not relicensed by inclusion. Copyright ownership and broader redistribution rights remain unverified and must be reviewed independently.

| File | Size | SHA-256 | Identification / current use |
|---|---:|---|---|
| `os12.rom` | 16K | `2d9fea69017864f6962704481829f95fee08446c8c3a13826d5d4e44000ac9de` | Acorn MOS 1.20; default Model B OS |
| `basic2.rom` | 16K | `45bd55dc0f6f0f8f1fe9e2481de7def206565eec8f600ba3068b849ca4132079` | BBC BASIC II; default bank 15 language ROM |
| `dnfs.rom` | 16K | `e745e34895225a6650b712c1dd0656cb0b0b15f072a8ae6d9ea8d1ac257eb3d6` | Acorn DNFS; Tube host and DFS/NFS support |
| `adfs-1.30.rom` | 16K | `4f785bb4572bde31a93f12687dec501c9005b6a0decc6ac943c657447095a563` | Acorn ADFS 1.30; bundled but not in a validated preset |
| `ats-3.0-1.rom` | 16K | `ecff82f9a45b64939dfe26477fe271ba415c8edd65e12a00e50f0890e89ff69f` | ATS 3.0-1; bundled but not in a validated preset |
| `z80.rom` | 4K | `c188be4d0abaeb7361e2b623f99270a618f0b75e72e2c71a69c2c7c7b9d4be73` | Acorn TUBE Z80 64K 1.20 parasite firmware |
| `Atom_Basic.rom` | 4K | `e4d3e17c81d1926b3180c32e2246873bbfab601693bb4c08461e1ffeae77420b` | Acorn Atom BASIC at `$C000-$CFFF` |
| `Atom_FloatingPoint2.rom` | 4K | `391ba8f8734469ed276cc60b8a9932feac13d59dea81b1693058abb0bc5f1a85` | Canonical Acorn Atom floating-point ROM at `$D000-$DFFF` |
| `Atom_Kernel.rom` | 4K | `38036a558dbc1e809387336a2bb408b8f4754446b94412f9c9d1f5a35b25b7b7` | Acorn Atom kernel at `$F000-$FFFF` |
| `Atom_DOS.rom` | 4K | `7be2584f45b0452a6fc37a74a79f5b3a45d60c93888fba9606ad4a77819b324a` | Optional Atom DOS at `$E000-$EFFF` |
| `Atom_axr1.rom` | 4K | `e4c75ab0ebe0ff8dab22b8c0f3bfc510c6479f6a3f6d6b9f9c4ae0bfd67d241a` | AXR1 utility ROM |
| `Atom_Combox.rom` | 4K | `09dc76e86ea76d159d3a30313124bdf0cafe1143d7620b07c0e7c954ac39171a` | Combox utility ROM |
| `Atom_gags.rom` | 4K | `d36e2e7147389ab706e5402232f3bacece183e858fe4b24c72ffda13b4bee582` | GAGS 2.3 utility ROM |
| `Atom_pcharme.rom` | 4K | `11dd2a7a2d5579aabebddc12db3dae05e4f460a6736a150201bf31ee2901d760` | PCharme utility ROM |
| `Atom_salfaa.rom` | 4K | `5c01a7b2b164589323bf9f5fc2bb149952b9d73a9b6e792f56d35348f7ab3511` | SALFAA 2.6 assembler ROM |
| `Atom_Toolkit.rom` | 4K | `96095cf1d5e2be76702449abeb066fdbe4d2c7568a22ee3dde91e6fee40dc3cb` | Programmer's Toolkit utility ROM |
| `Atom_werom.rom` | 4K | `307e26f29dfabc91a60422b5dae871e1556c6761783d87ff018579169e0bf1c5` | WE utility ROM |
| `Atom_Windows.rom` | 4K | `7f68c79d7b66d3ce1aebd72ead3399718beb04965a51f1a09a41910bb511d888` | Atomic Windows utility ROM |

The browser fetches the BBC OS, BASIC, DNFS and Z80 images from this directory. Normal BBC startup remains BASIC; selecting the Z80 Tube processor restarts with DNFS in bank 14 and the bundled parasite firmware. The Atom machine layer uses the three checksum-pinned Atom core images. Local replacement images remain supported.
