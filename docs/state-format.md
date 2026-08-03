# Stable BBC state format

BBC Model B state files use JSON with this identifying header:

```json
{
  "format": "6502-world-bbc-state",
  "version": 2,
  "machine": "bbc-model-b"
}
```

Version 2 records machine ticks; processor state; 32K RAM; OS and all populated sideways ROM banks; ROM selection; CRTC, Video ULA, system VIA, SN76489 and Tube state; 8271 registers and any in-progress drive/side-aware transfer; two physical drive slots with format, bytes, current track, write protection and dirty state; UEF source, position and transport state; and an attached Z80 parasite when present.

Version 1 remains importable. Its single writable SSD is migrated into physical drive 0 with side 0 selected, and its controller track becomes drive 0's current track. Export always emits version 2. Unknown versions and malformed binary fields are rejected.

| Version 1 field | Version 2 result |
|---|---|
| `devices.fdc.disk` | `devices.fdc.drives[0].disk`, format fixed to `ssd` |
| `devices.fdc.currentTrack` | `devices.fdc.drives[0].currentTrack` |
| implicit writable drive | drive 0 write protection defaults to off |
| no second slot | drive 1 is empty at track 0 |
| no media revision | clean media starts at revision 0; dirty media migrates to revision 1 |
| logical drive only | physical drive, selected side and drive-control port are derived deterministically |

No reverse conversion is performed. Importing version 1 and exporting it produces version 2, so callers should preserve an original file if they need the legacy representation.

States are exported and restored at an instruction boundary. Binary fields are base64 text. A loader must reject a different format, machine or unknown version. Additive metadata may be ignored; the tested version 1 migration is the only legacy schema conversion.

The format is portable between current browsers because it contains no object URLs, filesystem paths or host-specific handles. ROM and media bytes are embedded, so state files can be large and may contain copyrighted data supplied by the user.

The contract tests in `test/bbc-state.test.js` JSON-round-trip a running real-ROM machine, both media slots and an active side-aware FDC transfer, exercise version 1 migration, resume execution, and verify that unknown versions are rejected. The CP/M integration gate also exports at a real `A>` prompt, imports into a fresh machine and confirms both CPUs resume with the DSD still mounted.
