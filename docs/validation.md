# Processor validation

6502 World keeps validation inputs outside the repository and records their provenance here. Third-party binaries and generated corpora retain their own licences and are not redistributed with the emulator.

## Functional validation

- Suite: Klaus Dormann's `6502_65C02_functional_tests`
- Revision: `7954e2dbb49c469ea286070bf46cdd71aeb29e4b`
- Image: `bin_files/6502_functional_test.bin`
- Result: success loop `$3469` reached after 30,646,177 instructions and 96,241,374 visible cycles
- Runner: `node scripts/run-functional-test.js /path/to/6502_functional_test.bin`

## Ordered-bus validation

- Suite: SingleStepTests `65x02`, `6502/v1`
- Revision: `2f6980a2d95757486c7bee24355c360e40e2a224`
- Scope: all 151 documented NMOS 6502 opcode files
- Volume: 10,000 scenarios per opcode; 1,510,000 total scenarios
- Comparison: final registers, status, memory, cycle count, and every ordered address/data/read-write tuple
- Result: all scenarios passed
- Runner: `node scripts/run-bus-vectors.js /path/to/legal-opcode-vectors`

## Repository trace tests

The fast local suite supplements the external corpus with explicit reset, IRQ and NMI entry traces. It also keeps focused regression cases for branch timing, page crossings, read-modify-write ordering, stack behavior, decimal arithmetic and the original indirect-`JMP` page wrap.

These results support cycle-accuracy claims for documented NMOS instruction execution. They do not cover undocumented opcodes or timing introduced by a future machine bus and its peripherals.
