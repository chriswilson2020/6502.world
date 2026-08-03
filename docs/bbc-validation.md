# BBC Model B 1.0 validation

The 1.0 release gate is reproducible with:

```sh
npm test
npm run test:bbc-software
npm run build:pages
```

## Bundled real-ROM corpus

The corpus runner boots the same images served by the browser, waits for the mode 7 BASIC prompt, types a quoted program through the system VIA keyboard matrix, and checks the rendered BBC screen.

| Image | SHA-256 |
|---|---|
| OS 1.20 (`os12.rom`) | `2d9fea69017864f6962704481829f95fee08446c8c3a13826d5d4e44000ac9de` |
| BASIC II (`basic2.rom`) | `45bd55dc0f6f0f8f1fe9e2481de7def206565eec8f600ba3068b849ca4132079` |

Recorded 1.0 results:

| Case | Result |
|---|---|
| OS 1.20 boots BASIC II | Pass; prompt detected after 173,000 instructions |
| BASIC executes `PRINT "HI"` | Pass; command and `HI` detected on the emulated screen |

The runner exits nonzero on failure and prints machine ticks and the final PC for diagnosis. It is part of the normal Node test suite as well as the separate `test:bbc-software` command.

## Validation layers

- The CPU core passes 1,510,000 ordered legal-opcode vectors and the Klaus Dormann functional test at pinned revisions documented in `validation.md`.
- Focused machine tests cover memory mapping, ROMSEL, slow-bus timing, VIA timers/IRQs and keyboard chords, CRTC display addressing, sound, UEF parsing, SSD transfers and complete portable-state restoration.
- Static-page tests protect the deployable module paths and required browser controls. Release smoke checks exercise the live GitHub Pages build.

## 1.0 support boundary

Stable means that the tested browser workflow and version 1 state contract are release surfaces. It does not claim a cycle-perfect complete BBC Model B. Bitmap display modes, complete teletext attributes, cassette waveform loading, protected/nonstandard disks, complete 8271 and VIA behavior, and broad commercial software compatibility remain outside the 1.0 evidence. The current matrix in `compatibility.md` is authoritative.
