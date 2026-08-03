# Bundled BBC ROM images

The repository owner supplied and explicitly approved these images for temporary inclusion in the repository. They are firmware inputs to the emulator and are not covered by the source code's MIT licence. Redistribution status must be reviewed before the 1.0 release.

| File | Size | SHA-256 | Current use |
|---|---:|---|---|
| `os12.rom` | 16K | `2d9fea69017864f6962704481829f95fee08446c8c3a13826d5d4e44000ac9de` | Default Model B OS |
| `basic2.rom` | 16K | `45bd55dc0f6f0f8f1fe9e2481de7def206565eec8f600ba3068b849ca4132079` | Default bank 15 language ROM |
| `dnfs.rom` | 16K | `e745e34895225a6650b712c1dd0656cb0b0b15f072a8ae6d9ea8d1ac257eb3d6` | Available for DFS compatibility work; not auto-loaded |
| `adfs-1.30.rom` | 16K | `4f785bb4572bde31a93f12687dec501c9005b6a0decc6ac943c657447095a563` | Reserved for the media milestone |
| `ats-3.0-1.rom` | 16K | `ecff82f9a45b64939dfe26477fe271ba415c8edd65e12a00e50f0890e89ff69f` | Reserved for teletext/peripheral work |

The browser fetches `os12.rom` and `basic2.rom` from this directory and still permits local replacement images through its file controls.
