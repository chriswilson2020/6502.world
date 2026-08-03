# Implementation roadmap

## 0.1 — Foundation

- Static 6502 World identity
- GitHub Pages deployment
- Cycle-stepped CPU API
- Minimal 64K bus
- Interactive CPU Lab
- Ordered trace display
- Tests and documentation

## 0.2 — Complete legal NMOS instruction set (implemented)

- All documented opcodes
- All addressing modes
- Binary and decimal arithmetic
- Stack operations
- IRQ, NMI and reset sequencing
- State serialisation
- Disassembler coverage

**Gate:** functional, decimal and interrupt test suites pass.

**Evidence:** repository unit tests cover the opcode matrix, decimal arithmetic and interrupt entry/return; the core also reaches the `$3469` success loop in Klaus Dormann's 64K functional test after 30,646,177 instructions.

## 0.3 — Ordered-bus validation (implemented)

- Processor vector importer
- Dummy accesses
- Branch and page-cross timing
- Read-modify-write sequences
- Interrupt traces

**Gate:** complete legal-opcode bus corpus passes before any cycle-accuracy claim.

**Evidence:** 1,510,000 SingleStepTests scenarios pass across all 151 documented opcodes with exact ordered address, data and read/write comparisons. Repository tests separately assert reset, BRK, IRQ, NMI, branch, page-cross and RMW traces. See `validation.md` for pinned revisions.

## 0.4 — Minimal machine release (implemented)

- Binary loading
- Cycle and instruction debugger
- Memory inspector
- IRQ/NMI controls
- Portable state files

**Evidence:** the browser workbench loads raw binaries and hex programs at selectable origins, stops on address breakpoints, exposes cycle/instruction/chunked execution, navigates all 64K of memory, drives IRQ/NMI inputs, and round-trips versioned full-memory JSON states. Machine-model tests and browser interaction checks cover the release paths.

## 0.5 — BBC bootstrap (implemented)

- Model B memory map
- OS and sideways ROMs
- ROMSEL
- slow-access timing
- VIA and CRTC shells
- headless boot diagnostics

**Evidence:** synthetic-ROM tests reset through the OS vector, select sideways bank 15, read the paged ROM, write main RAM, access the system VIA shell and settle in an OS loop. Focused tests cover 8K/16K ROM banking, OS write protection, CRTC/VIA mirrors and 1 MHz timing classification. See `bbc-model-b.md`.

## 0.6 — Interactive BBC (implemented)

- display and Video ULA
- system VIA
- keyboard matrix
- timers and interrupts
- BASIC prompt and editing
- browser renderer

**Gate:** bundled OS 1.20 and BASIC II reach the prompt, and a browser key travels through the system VIA matrix into BASIC.

**Evidence:** the real-ROM integration test executes five million instructions, recognizes the mode 7 boot banner and prompt, presses internal key `$41`, and observes `>A` on screen. Focused tests cover timer interrupts, keyboard scanning and CRTC address translation. The browser console auto-boots the same images and exposes live machine state.

## 0.7 — Audio and media (implemented)

- SN76489 sound
- UEF cassette
- SSD disc images
- 8271 controller
- writable local media

**Gate:** VIA sound strobes program audible SN76489 channel state; a standard UEF data stream can be transported; and 8271 register transfers round-trip a writable SSD sector without mutating the source file.

**Evidence:** focused tests cover SN latch/data writes and attenuation, UEF signature/chunk parsing and transport, and complete 256-byte 8271 read/write transfers. The browser enables sound only after a user gesture, mounts UEF/SSD files locally, reports transport state and exports the current writable SSD image. See `bbc-media.md`.

## 0.8 — Public beta (implemented)

- save states
- debugger workbench
- responsive layout
- compatibility matrix
- performance and accessibility passes

**Gate:** a complete BBC state round-trips through JSON and resumes execution; browser debugger, breakpoint and state controls work at desktop and narrow widths; current compatibility claims and limitations are published.

**Evidence:** the portable-state test restores CPU, RAM, ROM selection, VIA, video, sound, UEF position, dirty SSD data and then executes the next instruction. Browser checks cover boot, stepping, breakpoint controls, export/import, focus-visible keyboard operation, text-screen mirroring and responsive layout. See `compatibility.md`.

## 1.0 — Stable BBC Model B (implemented)

- published validation evidence
- stable state format
- tested software corpus
- documented limitations

**Gate:** the pinned OS 1.20/BASIC II pair boots and executes a quoted BASIC program through the real keyboard matrix; portable states identify and round-trip the stable version 1 contract; validation evidence and limitations are published.

**Evidence:** `npm test` covers the CPU, machine, browser assets and state contract. `npm run test:bbc-software` reports the exact ROM hashes, reaches the BASIC prompt in 173,000 instructions and executes `PRINT "HI"`. See `bbc-validation.md`, `state-format.md` and `compatibility.md`.

## 1.1 — Tube bridge (implemented)

- Tube ULA
- host and parasite protocols
- multi-CPU scheduling
- reuse of the existing Z80 World core as a Z80 second processor

**Gate:** host and parasite exchange bytes through four Tube channels and hardware-style status flags; control writes assert host IRQ and parasite IRQ/NMI lines; the pinned Z80 World core executes through Tube ports at a scheduled 6MHz against the 2MHz host clock; the complete bridge round-trips in a BBC portable state.

**Evidence:** focused tests cover duplex FIFOs, Acorn R1/control semantics, `$FEE0-$FEEF` host and `$FEF8-$FEFF` parasite mapping, Z80 `IN`/`OUT`, clock scheduling and state resume. The bundled Acorn Z80 1.20 ROM boots through OS 1.20 and DNFS, emits its startup transcript through R1, and reaches its R2 command loop. The browser boots the same images and exposes the transcript, parasite PC and T-states. See `tube.md`.

## 1.2+ execution contract

The next releases extend the working BBC Model B and Tube implementation into a usable Acorn CP/M system. They are not permission to redesign already validated layers.

### Preserve the completed architecture

- Keep the existing NMOS 6502 core, the pinned Z80 World submodule, `TubeUla`, `Z80TubeSecondProcessor`, Model B memory map, scheduler and current ROM boot tests.
- Do not fork, copy or independently modify the Z80 CPU core inside 6502 World. Any genuine CPU-core defect must be fixed and validated in Z80 World, then consumed by updating the pinned dependency.
- Do not replace the Tube bridge with a software shortcut that copies files or console bytes directly between the host and parasite. CP/M must boot through the emulated BBC host, DNFS, 8271 and Tube path.
- Preserve all existing public BBC BASIC, SSD, state, Tube and browser behaviour. Each milestone must leave `npm test`, `npm run test:bbc-software` and `npm run test:bbc-z80` passing.
- Keep emulator hardware independent of browser UI and catalogue metadata. The machine core receives ROMs, attached processors and mounted media; it must not know product names such as “CP/M Utilities” or “MemoPlan”.
- Do not silently change the stable BBC state version 1 schema. A multi-drive or media-schema change that cannot be represented additively requires state version 2 plus a tested version 1 migration path.
- Prefer the smallest hardware-correct addition exposed by real software traces. Do not import a complete third-party emulator or add speculative controller features merely because they may be useful later.

### Use the project media as test inputs

The Codex project already contains the recovered Acorn Z80 disc images in `MEDIA/`. Treat that directory as source material for implementation and validation.

Before changing media code, inventory `MEDIA/` and record for every candidate image:

- relative filename;
- byte length;
- SHA-256;
- detected format and geometry;
- whether it is single- or double-sided;
- any embedded title or boot text that can be identified without modifying the image;
- likely role, with uncertainty stated where the image cannot be identified confidently.

The first required image is the CP/M Utilities system disc, expected to be a standard 409,600-byte `.dsd` image and to contain the sign-on text `Acorn CP/M 2.2 - Bios 1.20`. Identify it by content and hash rather than relying only on its filename. Other installation and prepared application discs remain out of scope until the first CP/M boot gate passes.

Do not rename, overwrite, normalize or regenerate the source images. The emulator must clone input bytes before any write. Do not add previously untracked commercial media to Git history merely to make tests convenient; use the existing project files locally unless the repository owner has already tracked or explicitly approved those binaries. Tests that require an optional local corpus must fail with a clear “corpus unavailable” message or skip under an explicit convention, while unit tests remain self-contained.

Create `docs/acorn-z80-media.md` from the inventory. It should distinguish:

- the one bootable CP/M Utilities image used for the first gate;
- prepared working/application discs;
- the original seven-disc installation set, if present;
- unknown or duplicate variants;
- source, copyright and redistribution uncertainty.

## 1.2 — General sector media and DSD images (implemented)

The current `SsdDisk` class assumes one side and exposes `readSector(track, sector)`. Generalize this without regressing existing SSD support.

### Required model

Introduce a small media contract, whether as a base class, protocol or shared implementation:

```text
readSector(track, side, sector) -> fresh 256-byte copy
writeSector(track, side, sector, 256-byte data)
export() -> complete image copy
dirty
geometry:
  tracks
  sides
  sectorsPerTrack
  sectorSize
  format
```

The core must support:

- SSD: 1 side, normally 80 tracks, 10 sectors per track, 256 bytes per sector;
- DSD: 2 sides, normally 80 tracks, 10 sectors per track, 256 bytes per sector;
- exact preservation of the original image length and unused bytes;
- read/write bounds checking;
- source-byte immutability;
- byte-identical export before the first write.

For standard interleaved BBC DSD images, map physical sectors in track-major, side-interleaved order:

```text
offset = (((track * 2) + side) * 10 + sector) * 256
```

Verify this mapping against the actual CP/M Utilities image and at least one independently constructed unit fixture before relying on it. Keep logical CP/M track or filesystem translation out of the generic DSD parser; the image class represents physical tracks, sides and sectors only.

### API and compatibility

- Replace format-specific assumptions in the FDC with the generic media contract.
- Keep `mountSsd()` as a compatibility wrapper if browser or test code already uses it.
- Add a format-aware mount entry point that accepts a filename or explicit format and rejects ambiguous invalid sizes.
- Do not infer DSD solely from “size is twice an SSD” when an explicit extension or format is available.
- Export with the original extension and preserve the current writable-in-memory behaviour.
- Add media serialization helpers suitable for state files without embedding UI metadata in the hardware object.

### Tests

Add focused tests for:

- SSD side 0 behaviour remaining unchanged;
- SSD rejecting side 1;
- DSD first and last sector on both sides;
- side-interleaving with marker-filled sectors;
- write isolation between adjacent tracks and sides;
- export before and after writes;
- rejection of truncated, oversized or geometrically impossible images;
- source arrays remaining unchanged.

**Gate:** the CP/M Utilities DSD mounts, sectors on both sides can be read and written deterministically, export is byte-identical before modification, and every existing SSD test remains green.

**Evidence to publish:** media geometry, image SHA-256 and focused test counts in `docs/bbc-media.md` and `docs/acorn-z80-media.md`.

**Implemented evidence:** the geometry-aware `SectorDisk`, compatible `SsdDisk`, interleaved `DsdDisk`, format-aware factory and serialization helpers pass focused source-immutability, side mapping, boundary, isolation, export and rejection tests. The optional utilities image is inventoried by content and hash without entering Git history.

## 1.3 — Two physical drives and 8271 drive/side fidelity

**Implemented:** the controller now exposes two physical media slots, maps command bits 7–6 to BBC logical drives and DSD sides, preserves independent track/write-protect state, uses bounded command/NMI traces, and reports explicit ready/protect/sector failures. Portable state version 2 round-trips both drives and active transfers while importing version 1 SSD states. The browser mounts and exports SSD/DSD media independently in either drive. The Z80 board's reset/NMI/high-fetch shadow-ROM latch is modeled and tested as a prerequisite for CP/M loading.

The current `Intel8271` has one `disk` property and a deliberately narrow command implementation. CP/M requires the controller to address the complete double-sided system disc and later a second physical drive.

### Drive model

Refactor the controller to own two physical drive slots:

```text
drive 0: optional mounted media, write-protect state, current track
drive 1: optional mounted media, write-protect state, current track
```

Track controller-visible selection separately from mounted media:

- raw command byte;
- decoded command operation;
- selected physical drive;
- selected side/head;
- current track per physical drive;
- motor/head-loaded state only to the fidelity required by software;
- write-protect and ready status.

Do not equate “side” with a second independent image. A DSD in physical drive 0 contains side 0 and side 1. Under the BBC filing-system convention, user-facing drive numbers may encode both physical drive and side; under Acorn CP/M a double-sided disc can form one CP/M volume. Keep these translations in the appropriate host/BIOS path rather than flattening them in `DsdDisk`.

Preserve a compatibility accessor or migration path for code that currently expects one mounted SSD. Existing single-disc browser flows should continue to mount into physical drive 0.

### Instrument before broadening the controller

Add an optional bounded FDC trace that records, at minimum:

```text
machine tick
raw command
decoded operation
parameters
selected drive and side
track, sector and count
direction
result/status
NMI request and acknowledgement
```

Use this trace while attempting the real CP/M boot. Implement the commands and special-register effects the image actually exercises. Likely requirements include more than the current seek/read/write subset, but the observed trace is authoritative. Do not fake successful responses to unknown commands.

Areas to verify explicitly include:

- command-byte drive selection rather than discarding the upper command bits;
- side/head selection;
- seek and per-drive current-track state;
- read and write data, including multi-sector transfer boundaries;
- specify/configuration commands;
- read/write special-register behaviour used by DNFS or the CP/M loader;
- drive-ready, write-protect and result codes;
- byte-by-byte NMI handshaking and late-data behaviour;
- reset and command-abort behaviour;
- sector-not-found and missing-drive failures.

It is acceptable to implement only the hardware surface needed by the validated corpus, provided unsupported operations return explicit controller errors and the compatibility matrix remains honest.

### State format

If replacing the single serialized FDC disk with a two-drive array changes the stable contract:

- introduce BBC state version 2;
- continue importing version 1;
- migrate a version 1 mounted SSD into drive 0 with side 0 selected;
- reject malformed mixed-version states;
- round-trip both DSD images, current tracks, selection, write protection, dirty flags and in-progress transfers;
- document the migration in `docs/state-format.md`.

### Tests

Add tests for:

- independent drive 0 and drive 1 mounts;
- independent current tracks;
- both sides of a DSD;
- raw command selection reaching the correct physical drive and side;
- missing drive and write-protected results;
- a multi-sector read crossing no illegal boundary;
- a write changing only the selected image and side;
- state save/restore during an active transfer;
- version 1 state import, if state version 2 is introduced.

**Gate:** DNFS and the controller can read deterministic sectors from both sides of the CP/M Utilities DSD in physical drive 0, a second image can be mounted independently in drive 1, and no existing SSD or BBC BASIC regression appears.

## 1.4 — Real Acorn CP/M 2.2 boot

**Implemented:** the hash-pinned, unmodified Utilities DSD boots through OS 1.20, DNFS, the paced 8271 and Tube to the real 80-column `A>` screen. The deterministic integration runner types `DIR` and `STAT` through the BBC keyboard matrix, and the browser exposes a bundled **Boot Acorn CP/M 2.2** action.

This is the first user-visible Z80 software milestone. Do not add the application catalogue before it passes.

### Machine composition

The boot test must use the existing real components:

```text
BBC Micro Model B host
  OS 1.20
  BASIC II in sideways bank 15
  DNFS in sideways bank 14
  Intel 8271
  CP/M Utilities DSD in physical drive 0
  Tube ULA
Acorn Z80 second processor
  pinned Z80 World core at 6MHz
  64K parasite RAM
  4K Acorn TUBE Z80 64K 1.20 boot ROM
```

Boot through the normal host and parasite protocol. Do not preload CP/M into parasite RAM, intercept MOS file calls, patch the disc image or synthesize the `A>` prompt.

### Headless integration runner

Add a dedicated runner, for example:

```text
npm run test:bbc-cpm
scripts/run-acorn-cpm.js
```

The runner should:

1. locate and hash the intended CP/M Utilities image in `MEDIA/`;
2. load the pinned OS, BASIC, DNFS and Z80 ROMs;
3. create a fresh `BbcMicroModelB`;
4. mount the DSD in physical drive 0;
5. attach the Z80 processor;
6. reset through the same sequence used by the browser;
7. execute deterministically until success, a known failure, a stable deadlock or an instruction/tick limit;
8. observe the actual BBC text screen as the primary user-visible result;
9. retain Tube and FDC traces for diagnostics, not as substitutes for the screen result.

The initial success condition is the presence of:

```text
Acorn CP/M 2.2 - Bios 1.20
A>
```

After reaching the prompt, inject keyboard input through the real BBC keyboard matrix and verify:

```text
DIR
```

returns a plausible directory and another `A>` prompt. Then exercise at least one transient utility present on the disc, preferably `STAT`, without assuming every archived image has exactly the same file list.

A read-only first boot is acceptable. Do not require write support to claim the initial boot gate, but report any attempted writes and their controller result.

### Failure report

On failure, print enough deterministic context for Codex or a maintainer to continue without adding random delays:

- ROM and disc SHA-256 values;
- host instruction count, PC and recent disassembly;
- Z80 instruction/T-state count, PC and recent disassembly;
- Tube control bits, FIFO lengths and pending IRQ/NMI lines;
- last bounded Tube transcript;
- last bounded BBC screen snapshot;
- last FDC commands, parameters, drive, side, track, sector, status and result;
- whether execution is progressing or repeating a stable loop.

Do not solve timing failures by increasing arbitrary browser frame counts. Fix the hardware state or scheduling cause and lock it with a focused test.

### Browser entry point

Once the headless gate passes, add a first-class action:

> Boot Acorn CP/M 2.2

It must select the correct hardware profile, mount the utilities image when it is legally available to the build or request a local file when it is not, reset the machine and focus the BBC display for keyboard input.

**Gate:** the real unmodified utilities image reaches the exact CP/M sign-on and `A>` prompt, `DIR` is typed through the BBC keyboard matrix and completes, and the run is repeatable in CI or in the documented local corpus mode.

**Evidence to publish:** hashes, instruction/tick counts, boot transcript, tested commands, controller limitations and exact invocation in a new `docs/acorn-z80-cpm.md`.

## 1.5 — Hardware profiles, software presets and switching

Do not present BBC BASIC, a Z80 processor and CP/M discs as peers in one flat selector. Separate the computer configuration from the software mounted in it.

### Hardware profiles

Introduce declarative profiles outside the emulator core:

```text
bbc-model-b
  6502 host
  OS 1.20
  BASIC II
  no parasite

bbc-model-b-acorn-z80
  same BBC host
  BASIC II
  DNFS
  Tube ULA
  Acorn Z80 parasite
  Z80 boot ROM
```

A profile defines hardware, ROM-bank placement and default peripherals. It does not name individual application discs.

Changing hardware profile is a cold restart:

1. pause the current machine;
2. warn about dirty media if it has not been persisted or exported;
3. create a fresh machine;
4. load the profile ROMs;
5. attach or omit the parasite;
6. remount the selected media;
7. reset;
8. start execution.

Do not attempt to hot-attach or detach the Z80 from a running user session as the normal interface. Retain the existing low-level attach controls under an advanced/developer section.

### Software presets

Create a separate catalogue whose entries declare compatibility and media, for example:

```text
BBC BASIC II
  profile: bbc-model-b
  no startup disc required

Local BBC disc
  profile: bbc-model-b
  user-selected SSD or DSD in physical drive 0

Acorn CP/M 2.2 Utilities
  profile: bbc-model-b-acorn-z80
  CP/M Utilities DSD in physical drive 0

Custom Acorn CP/M media
  profile: bbc-model-b-acorn-z80
  user-selected DSD in physical drive 0
```

Later entries may mount an application disc in physical drive 1, but must not be added until the corresponding software has a passing launch test.

Catalogue metadata may include:

- stable id and title;
- required hardware profile;
- drive 0 and drive 1 media ids;
- writable/read-only default;
- optional launch instructions or auto-typed commands;
- known hashes and aliases;
- rights/distribution mode;
- documentation link;
- validation status.

The hardware core must receive already-resolved bytes and configuration, never a catalogue id.

### UI

The normal BBC page should expose:

```text
System
  BBC Micro Model B
  BBC Micro Model B + Acorn Z80 Second Processor

Startup
  options filtered by the selected system

Physical drive 0
Physical drive 1
Boot system
Reset
```

In the Z80 profile, labels may additionally explain the usual CP/M mapping, such as “physical drive 0 / CP/M A:” and “physical drive 1 / CP/M B:”, but the code must use the BIOS-observed mapping rather than assume the label is universally correct.

Per-drive controls:

- select/import image;
- eject;
- write-protect toggle;
- modified indicator;
- export current image;
- reset to original;
- swap physical drives where safe.

Changing a disc should not rebuild the machine. Changing the hardware profile should.

Keep ROM replacement, raw Tube telemetry, FDC trace and manual parasite controls in an “Advanced hardware” disclosure so the default experience remains understandable.

### Deep links

Support deterministic URL parameters once the preset ids are stable, for example:

```text
bbc.html?system=bbc-model-b&software=bbc-basic
bbc.html?system=bbc-model-b-acorn-z80&software=acorn-cpm-utilities
```

Invalid or incompatible combinations must fall back safely with a visible explanation, not silently substitute another machine.

### Tests

Add browser tests for:

- default BBC BASIC boot unchanged;
- selecting the Z80 profile restarts with DNFS and the parasite;
- selecting CP/M mounts the correct image;
- changing only a disc preserves the running hardware profile;
- changing profile performs a cold restart;
- dirty-media warning;
- advanced controls remain keyboard accessible;
- deep links resolve to the same configuration as manual selection.

**Gate:** a non-expert can deliberately choose BBC BASIC or Acorn CP/M, understand which machine is running, change media independently and return to the other system without stale state leaking across profiles.

## 1.6 — Writable CP/M media and browser persistence

After the read-only boot gate is stable, make CP/M genuinely usable without risking source images.

### Write behaviour

- Complete the 8271 write path exercised by CP/M.
- Respect per-drive write protection.
- Clone every mounted source image.
- Mark media dirty only after an accepted sector write.
- Preserve changes across warm resets and disc changes within the session.
- Confirm that a CP/M-created or copied file survives a warm boot and appears in `DIR`.

### Persistence

Use IndexedDB for browser persistence rather than localStorage for 400K images and multiple discs.

A persisted media record should include:

- media id or user-provided name;
- base-image SHA-256;
- format and geometry;
- either the current full image or a sector-level copy-on-write overlay;
- dirty state;
- last modified time;
- optional catalogue association.

Do not require persistence for the emulation core or headless tests. Provide an adapter at the browser boundary.

Controls:

- save changes locally;
- discard changes;
- reset to original image;
- export modified `.ssd` or `.dsd`;
- duplicate as a working copy;
- clear stored copy.

Warn before profile changes, ejection or reset only when an unsaved browser-layer change would actually be lost.

### Validation

At minimum:

1. boot CP/M;
2. create or copy a small file using normal CP/M tools;
3. warm boot;
4. verify the file remains;
5. export the DSD;
6. mount the exported bytes in a fresh machine;
7. verify the file again;
8. reset to the original and prove the file disappears.

**Gate:** CP/M sector writes are hardware-mediated, survive reset and export/import, and never mutate the original `MEDIA/` image.

## 1.7 — Acorn Z80 software catalogue

Only begin after CP/M Utilities is a stable, writable system.

### Inventory and classification

Use `docs/acorn-z80-media.md` and the `MEDIA/` hashes to classify:

- CP/M Utilities;
- BBC BASIC for Z80 and Mallard BASIC;
- CIS COBOL;
- MemoPlan;
- GraphPlan;
- FilePlan;
- Accountant and related data discs;
- Nucleus components;
- the original seven installation discs;
- duplicate or unknown variants.

Do not infer that the seven original distribution images correspond one-to-one with seven finished applications. The original set may require `PREPARE` to construct a larger working-disc set. Prefer prepared working discs for normal launch presets and reserve the original installation flow for an advanced preservation experience.

### Per-title validation

For every public catalogue entry:

- identify exact image hashes;
- define required profile and drive placement;
- document whether it is read-only or needs a writable working copy;
- boot CP/M from a known system disc;
- select the appropriate CP/M drive using real keyboard input;
- launch the documented command;
- detect a title-specific screen or prompt;
- save a bounded screenshot/text transcript as evidence;
- record known limitations and disc-swapping requirements.

Do not add an “available” card merely because a filename resembles an application. Use statuses such as:

```text
validated
boots with limitations
media identified, not yet validated
unsupported
```

### Multi-disc applications

Model disc sets explicitly. Accountant/Nucleus and the original installer may require:

- multiple named images;
- ordered swaps;
- writable data/working discs;
- prompts that pause until the user changes media.

The UI should present a coherent disc-set workflow rather than exposing a directory of anonymous files.

### Rights mode

Each catalogue entry must declare one of:

```text
bundled with documented permission
user-supplied import
external source reference
metadata only
```

Hash recognition and launch metadata may be committed even when the binary cannot be redistributed. Do not treat presence in another emulator or archive as a licence.

**Gate:** at least BBC BASIC for Z80 launches from a prepared application disc after booting CP/M, and every displayed catalogue status corresponds to a repeatable test.

## 1.8 — Original installation experience and release hardening

This is an advanced preservation milestone, not part of the first CP/M release.

### Original installation

Where the seven-disc source set is present:

- identify the exact distribution images;
- boot the original installer;
- run the authentic preparation process;
- provide blank writable DSD targets;
- support prompted source/target swaps;
- verify the generated working discs by booting or launching their software;
- retain an explicit distinction between original source images and generated user copies.

Do not automate by reconstructing files outside the emulated machine and then claim the installer works.

### Release hardening

- Expand the compatibility matrix with DSD, two-drive 8271, Acorn Z80 CP/M and validated applications.
- Publish state-version migration details.
- Add performance measurements for dual-CPU plus FDC workloads.
- Confirm narrow-screen and keyboard-only operation for system and disc selectors.
- Test save states at the CP/M prompt and during an active disc transfer.
- Bound all diagnostic traces to prevent browser memory growth.
- Verify GitHub Pages builds without requiring local `MEDIA/` binaries; public builds must either include only approved media or present local import controls.
- Add clear provenance and copyright notices for every bundled ROM or disc.
- Keep unsupported protected/nonstandard disc layouts outside the compatibility claim.

**Gate:** the public site boots BBC BASIC and Acorn CP/M through explicit profiles, preserves writable user media, restores versioned states, exposes only honestly validated software and builds successfully with and without the optional local media corpus.

## Recommended implementation order

Codex should execute this work as a sequence of reviewable changes rather than one broad rewrite:

1. inventory `MEDIA/` and add `docs/acorn-z80-media.md`;
2. generalize SSD media and add DSD with unit tests;
3. add two physical drives and drive/side-aware controller state;
4. instrument the real CP/M boot and implement only observed missing 8271 behaviour;
5. add the deterministic `test:bbc-cpm` integration gate;
6. add machine profiles and the BBC BASIC/CP/M switching UI;
7. add CP/M writes, IndexedDB persistence and export/import;
8. validate application discs one title at a time;
9. add the original seven-disc installation experience last.

Every change should state which gate it advances, include focused tests, update the relevant documentation and leave existing validated machine paths working.

## Scope rule

No Apple II, Commodore or NES machine implementation begins before BBC 1.0. The point of 6502 World is to prove reusable architecture, not to accumulate unfinished machine cards.
