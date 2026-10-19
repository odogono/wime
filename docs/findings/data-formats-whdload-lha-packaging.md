---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-graphics.ts#loadLhaMember
  - tool:tools/extract-graphics.ts#extractArchive
  - tool:tools/extract-text.ts#extractTextArchive
---
**The Reference Build comes as a WHDLoad LHA archive, `WarInMiddleEarth_v1.0_0968.lha`, holding two raw floppy disk images, `WarInMiddleEarth/data/Disk.1` and `WarInMiddleEarth/data/Disk.2`, plus three plain text files.**
The text members are `WarInMiddleEarth/ReadMe`, `WarInMiddleEarth/Hints` and `WarInMiddleEarth/Docs`, a typed-in copy of the manual. The game's own files live inside the disk images. Disk 1 holds the executable `WarInMiddleEarth` and the resource files `AMaps.res`, `AAnims.res`, `ATitle.res`, `AScene.res` and `AText.res`. Disk 2 holds `BScene.res`. The tools read members straight out of the archive with `lha pq`, which prints a member to standard output.
