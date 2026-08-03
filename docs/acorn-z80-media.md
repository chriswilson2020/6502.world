# Recovered Acorn Z80 media inventory

This inventory describes the `MEDIA/` corpus supplied by the repository owner. The owner explicitly approved publishing the complete folder and its disc images in this repository. Generate the mechanical inventory with:

```sh
node scripts/inventory-acorn-z80-media.js /path/to/MEDIA
```

Every current image is a 409,600-byte, 80-track, two-sided DSD with ten 256-byte sectors per track in track-major, side-interleaved order. Each contains the Acorn CP/M 2.2 BIOS sign-on, consistent with prepared working/application media rather than raw single-sided DFS discs.

| Local filename | SHA-256 | Identification | Classification |
|---|---|---|---|
| `CPM_Utilities_Disc.dsd` | `9147393d301af384c0c2cea1dc3299b8c98877180515ec0f4d87a71787332b3a` | Acorn CP/M 2.2 utilities and system strings | Boot/system gate |
| `Basic_Program_Disc.dsd` | `983f28d1a789563f2b06cff2675f6971e55630df20db03a13cdbd6a11a65805b` | BBC BASIC 2.20 and Mallard-80 BASIC 1.11 | Prepared application |
| `CIS_Cobol_Program_Disc.dsd` | `c109becb293f294b0cbd73febbe9b412215c44311b05b8b0eb1908f1146c7952` | CIS COBOL / Micro Focus forms strings | Prepared application |
| `MemoPlan_Program_Disc.dsd` | `8dbfa12dc6608f08495360efc3eaa178b689c46363c1b033c9bf3bab83f0e428` | MemoPlan 1.30 | Prepared application |
| `GraphPlan_Program_Disc.dsd` | `959216eacb1edebf767033560f7c0cd19077f6552bf8e05ea75678d84905b057` | GraphPlan | Prepared application |
| `FilePlan_Program_Disc.dsd` | `59edae34c3db0f00d64ca26c8f1791629e45326b972b59aa64329fe9a6b63e4c` | FilePlan / Chang Laboratories | Prepared application |
| `Accountant_Program_Disc.dsd` | `54164eea90df0819d4e4832db8fffe30ff0350fd1fb7e796337928a4e902d743` | Mallard Compact components | Prepared application, role inferred |
| `Accountant_Data_Disc.dsd` | `c948eaf9db6d82ec9b93173a8f62aa80dde66213f2cfebaa628281c584356bae` | CP/M system strings; product role from filename | Writable data candidate, uncertain |
| `Start_Of_Day_Disc.dsd` | `ca597a3bf8ec029164d4e106ada3e494ff8bd9a0e2129a475f1f193f45ea7b01` | Mallard-80 / Compact Software strings | Prepared workflow disc |
| `Nucleus_Definitions_Program_Disc.dsd` | `1857e4ae3ba416ed24b9f990acfa31ca2ccc15f7d09cdf1a6d1eaf1e96f520a6` | Nucleus Definition and Reporting | Prepared application component |
| `Nucleus_Parameter_File_Program_Disc.dsd` | `ed7dad42305974b0bcf48b8b911b0480240e054c3dda5004d9d96e1451300101` | Compact Nucleus parameter strings | Prepared application component |
| `Nucleus_Reporter_Program_Disc.dsd` | `01c134d0cf4648e38b19d8ef8b4418db5d252db6af03d88627ede14b67873bd4` | Nucleus Reporting | Prepared application component |

The current corpus does not contain an identifiable original seven-disc installation set or obvious byte-for-byte duplicates. Filenames are treated as hints until a title passes its launch gate. Rights mode is `bundled with repository-owner permission`; inclusion does not change any underlying third-party copyright.
