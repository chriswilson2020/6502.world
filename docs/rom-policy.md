# ROM and software policy

The emulator source code is MIT licensed. Firmware, operating-system ROMs, games and applications are separate works and are not automatically covered by that licence.

6502 World should support three ROM paths:

1. openly licensed or redistributable ROMs with clear provenance;
2. user-supplied ROM files loaded locally in the browser;
3. development-only private files excluded by `.gitignore`.

The public site must remain usable when an optional ROM is absent. It should explain what is required and allow the user to provide a file without uploading it to a server.

No ROM should be committed merely because it is easily found online.

The repository owner supplied and explicitly approved the current BBC firmware set for temporary repository distribution. Its exact filenames and checksums are recorded in [`../ROM/README.md`](../ROM/README.md). This approval does not relicense the firmware under the source code's MIT licence; provenance and redistribution status must be reviewed before the 1.0 release.
