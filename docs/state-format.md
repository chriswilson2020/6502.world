# Stable BBC state format

BBC Model B state files use JSON with this identifying header:

```json
{
  "format": "6502-world-bbc-state",
  "version": 1,
  "machine": "bbc-model-b"
}
```

Version 1 records machine ticks; processor state; 32K RAM; OS and all populated sideways ROM banks; ROM selection; CRTC, Video ULA, system VIA, SN76489 and Tube state; 8271 registers and any in-progress transfer; mounted writable SSD data; UEF source, position and transport state; and an attached Z80 parasite when present.

States are exported and restored at an instruction boundary. Binary fields are base64 text. A loader must reject a different format, machine or version instead of interpreting it as version 1. Additive metadata may be ignored, but changing or removing a version 1 field requires a new state version and an explicit migration path.

The format is portable between current browsers because it contains no object URLs, filesystem paths or host-specific handles. ROM and media bytes are embedded, so state files can be large and may contain copyrighted data supplied by the user.

The contract test in `test/bbc-state.test.js` JSON-round-trips a running real-ROM machine, local media and devices, resumes execution, and verifies that unknown versions are rejected.
