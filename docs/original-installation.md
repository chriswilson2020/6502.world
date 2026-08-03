# Original Acorn Z80 installation status

The authentic seven-disc installation experience is unavailable because no identifiable original source set is present in the owner-approved 12-DSD corpus. The public catalogue therefore marks it `unsupported` with rights mode `metadata only`; it does not map prepared application images onto invented installer-disc roles.

The preservation UI can create an unformatted, writable 409,600-byte DSD target in either physical drive, import local DSD sources, swap the two drives, save a working image in IndexedDB and export the result. These are the hardware/media primitives an authentic installer will need, but they are not evidence that `PREPARE` works.

When the exact seven sources are supplied, implementation must record their hashes and permission modes, boot the real installer, drive its prompts through the emulated keyboard, perform source/target swaps in response to those prompts, and validate the generated working discs by launching their software. No host-side file reconstruction may substitute for that process.
