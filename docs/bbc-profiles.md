# BBC hardware profiles and software presets

Milestone 1.5 separates machine composition from mounted software. Declarative metadata lives in `public/bbc-config.js`; the emulator core never receives profile or catalogue ids.

The two hardware profiles are:

- `bbc-model-b`: OS 1.20, BASIC II and no parasite;
- `bbc-model-b-acorn-z80`: the same host plus DNFS, Tube ULA, the 6MHz Z80 core and Acorn Z80 1.20 firmware.

Changing profile creates a fresh `BbcMicroModelB`, loads the declared ROM banks, attaches or omits the parasite, remounts the resolved media and resets. Software presets are filtered by profile. Changing, ejecting, resetting or swapping a disc operates on the existing machine and never hot-attaches hardware. A destructive preset change prompts only when it would discard a dirty in-memory image.

Stable deep links are:

```text
bbc.html?system=bbc-model-b&software=bbc-basic
bbc.html?system=bbc-model-b-acorn-z80&software=acorn-cpm-utilities
```

Unknown systems and incompatible system/software pairs fall back to a compatible default and explain the substitution in the page status. ROM replacement and manual Tube telemetry remain available under keyboard-accessible **Advanced hardware** disclosures.
