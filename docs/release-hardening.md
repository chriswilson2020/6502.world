# Preservation release hardening

Milestone 1.8 closes the public BBC/Acorn Z80 roadmap with evidence-backed boundaries:

- version 2 portable states resume at a real CP/M prompt and in a side-aware active 8271 transfer; version 1 migration is documented field by field;
- CPU trace, Model B bus access history, 8271 diagnostics and the browser Tube transcript all have fixed limits;
- `npm run measure:bbc-cpm` records dual-CPU and FDC work without imposing a host-speed pass threshold;
- the Pages builder accepts `MEDIA_SOURCE` and `BUILD_OUTPUT`; CI builds once with approved media and once with a deliberately absent media directory;
- the no-media build retains local SSD/DSD import, blank-target creation and custom Acorn Z80 controls;
- ROM and DSD manifests state per-corpus provenance, exact hashes, current permission and third-party copyright boundaries;
- protected and nonstandard disc layouts remain outside the compatibility claim;
- the original installer remains unavailable metadata until its authentic source set exists.

The narrow/keyboard browser check uses a 390×844 Chromium viewport. Keyboard focus, arrow-key and Enter operation selects the Z80 profile, selects the BBC BASIC preset, reaches the 2.20 prompt, changes the persistence target to drive 1 and creates a blank writable DSD without pointer input. The page has no horizontal document overflow and reports no console errors.
