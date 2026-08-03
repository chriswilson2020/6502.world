# BBC + Z80 + FDC performance

Run the deterministic dual-CPU workload with:

```sh
npm run measure:bbc-cpm
```

The workload boots OS 1.20, DNFS, the Acorn Z80 ROM and the unmodified CP/M Utilities DSD, then enters `DIR` and `STAT` through the BBC keyboard. It reports emulated work separately from host elapsed time, so correctness counters remain comparable when host speed changes.

Reference run on arm64 macOS 26.5.2 with Node.js 24.15.0:

| Metric | Result |
|---|---:|
| Host elapsed | 3,425 ms |
| 6502 instructions | 2,285,003 |
| 6502 instructions/second | 667,238 |
| BBC machine ticks | 8,753,298 |
| Z80 T-states | 26,259,901 |
| Z80 T-states / BBC tick | 3.000001 |
| 8271 read transfers | 20 |
| 8271 write transfers | 0 |

Elapsed time is evidence, not a pass threshold. The gate passes on the software transcript and hardware behavior; the stable counters also confirm the scheduled 6MHz-to-2MHz ratio under FDC load.
