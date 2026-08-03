# BBC writable media persistence

Milestone 1.6 keeps source images immutable while allowing BBC and CP/M software to write normal sectors. `SectorDisk` clones every mount, marks itself dirty only after an accepted 256-byte sector write and increments a monotonic revision. The 8271 retains per-drive write protection and counts real read and write transfers for diagnostic gates.

## Browser storage boundary

The emulation core has no browser-storage dependency. `public/bbc-media-store.js` provides an IndexedDB adapter at the UI boundary and a memory adapter for deterministic tests. Each stored record contains:

- a stable per-drive working-copy id and filename;
- the SHA-256 of the original base image;
- SSD/DSD format and full geometry;
- complete current and base image bytes;
- dirty flag and media revision;
- last-modified timestamp and software-preset association;
- write-protect state.

Saving locally or exporting records the current revision as a safe point. Later accepted writes produce a newer revision, so profile changes, ejection and original reset warn only when bytes would actually be lost. Restore mounts the saved full image while retaining its separate original base. Duplicate makes the current bytes a new writable in-session base; reset original always remounts the preserved base bytes. Clearing browser storage never alters mounted media.

IndexedDB data remains in the current browser profile and is not uploaded. Export remains the portable path: the emitted `.ssd` or `.dsd` contains the complete current image and can be mounted in a fresh emulator.

## Validation

`npm run test:bbc-cpm-write` drives the unmodified CP/M Utilities system through the BBC keyboard and confirms a CP/M `SAVE` causes hardware 8271 writes. It then verifies the new file after warm boot and after exported-image remount, verifies its absence on the original image, and re-hashes the repository source before and after. Unit tests cover cloned persistence records, metadata normalization, dirty/revision serialization and write isolation.
