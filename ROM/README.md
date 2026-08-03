# Bundled BBC ROM images

The repository owner supplied and explicitly approved these images for inclusion in the repository. They are firmware inputs to the emulator and are not covered by the source code's MIT licence. Redistribution status must be reviewed independently of the source-code licence.

| File | Size | SHA-256 | Current use |
|---|---:|---|---|
| `os12.rom` | 16K | `2d9fea69017864f6962704481829f95fee08446c8c3a13826d5d4e44000ac9de` | Default Model B OS |
| `basic2.rom` | 16K | `45bd55dc0f6f0f8f1fe9e2481de7def206565eec8f600ba3068b849ca4132079` | Default bank 15 language ROM |
| `dnfs.rom` | 16K | `e745e34895225a6650b712c1dd0656cb0b0b15f072a8ae6d9ea8d1ac257eb3d6` | Tube host and DFS/NFS support when Z80 mode is selected |
| `adfs-1.30.rom` | 16K | `4f785bb4572bde31a93f12687dec501c9005b6a0decc6ac943c657447095a563` | Reserved for the media milestone |
| `ats-3.0-1.rom` | 16K | `ecff82f9a45b64939dfe26477fe271ba415c8edd65e12a00e50f0890e89ff69f` | Reserved for teletext/peripheral work |
| `z80.rom` | 4K | `c188be4d0abaeb7361e2b623f99270a618f0b75e72e2c71a69c2c7c7b9d4be73` | Acorn TUBE Z80 64K 1.20 parasite firmware |

The browser fetches OS, BASIC, DNFS and Z80 images from this directory. Normal startup remains BASIC; selecting the Z80 Tube processor restarts with DNFS in bank 14 and the bundled parasite firmware. Local replacement images remain supported.
