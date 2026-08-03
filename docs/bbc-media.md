# BBC audio and media

## Sector images

Milestone 1.2 generalizes local sector media behind a geometry contract. SSD remains one-sided and backward compatible with `readSector(track, sector)`; DSD uses `readSector(track, side, sector)` and maps the standard track-major, side-interleaved layout. Both clone input bytes, return fresh sector copies, preserve the exact image on an unmodified export and isolate writes in memory.

The optional Acorn CP/M Utilities corpus image is 409,600 bytes with geometry 80 tracks × 2 sides × 10 sectors × 256 bytes and SHA-256 `9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a`. See `acorn-z80-media.md`; the local binary is not part of the repository.

Milestone 0.7 keeps host APIs at the browser boundary while exposing deterministic hardware and media models to the BBC machine.

## SN76489 sound

The SN76489 receives bytes from slow data bus port A when IC32 latch output 0 is asserted low. Its latched-register protocol tracks three ten-bit tone dividers, four attenuation registers and the noise-control register. The browser creates three square-wave voices and a noise source only after the user presses **Enable BBC sound**, satisfying browser autoplay rules.

## UEF cassette

`UefCassette` validates the `UEF File!` signature, walks length-delimited chunks and exposes bytes from standard Acorn data-stream chunks (`$0100`) through play, pause, rewind and byte-read operations. Other UEF waveform/security chunks remain preserved in the parsed chunk list but are not yet synthesized into ACIA waveforms.

## SSD/DSD and Intel 8271

`SectorDisk` models ten 256-byte sectors per track and clones its input so writes never alter the browser-selected source file. `Intel8271` exposes command/status at `$FE80`, parameter/result at `$FE81`, reset at `$FE82` and data transfers at `$FE84`. It owns two physical drive slots. Command bits 7–6 select BBC logical drives 0–3: logical 0/1 select physical drive 0/1 on side 0, while logical 2/3 select the same drives on side 1. Each physical drive retains its own current track and write-protect state.

The controller implements observed seek, drive-status, initialise, read/write special-register, verify and 128/256-byte single/multi-sector operations. Missing media, write protection and sector bounds return explicit 8271 results. Byte requests and command completion use edge-style NMI delivery, and an optional bounded trace records command decoding, selection, transfers, results and first-byte NMI request/acknowledgement. The Acorn Z80 shadow-ROM latch also follows instruction-fetch hardware: reset and NMI entry at `$0066` map the ROM, and the next opcode fetch at `$8000-$FFFF` restores RAM.

The browser can independently mount local SSD or DSD images in physical drives 0 and 1, toggle write protection and export each current image. Protected/nonstandard layouts, UEF waveform timing and direct MOS cassette loading remain explicit compatibility work.

## Hardware references

- Acorn Computers, *BBC Microcomputer Advanced User Guide*, SHEILA and 8271 register map: <https://manualzilla.com/doc/6893132/bbc-microcomputer-advanced-user-guide>
- Acorn Computers, *BBC Microcomputer Service Manual*, system VIA slow data bus and sound hardware: <https://acorn.huininga.nl/pub/docs/manuals/Acorn/BBC%20B/BBC%20Microcomputer%20Service%20Manual.pdf>
