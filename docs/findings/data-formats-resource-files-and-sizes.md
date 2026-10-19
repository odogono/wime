---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-graphics.ts#extractArchive
  - tool:tools/extract-text.ts#extractTextArchive
---
**Six resource files hold the game's graphics and text: five on Disk 1 and one, much the largest, on Disk 2.**

| Disk | File | Size in bytes | Resources |
|---|---|---|---|
| 1 | AMaps.res | 93,390 | 19 IMAG, CHAR 1 (map tiles), MMAP 1 (map grid) |
| 1 | AAnims.res | 95,583 | 5 FRML |
| 1 | ATitle.res | 70,729 | 4 IMAG |
| 1 | AScene.res | 129,250 | 11 IMAG |
| 1 | AText.res | 1,193 | 4 CSTR |
| 2 | BScene.res | 745,052 | 81 IMAG, 14 FRML, 57 CSTR |

In total there are 115 IMAG (bitmap), 19 FRML (frame list), 61 CSTR (text), one CHAR and one MMAP resource. The test suite (`tools/extract-graphics.test.ts`) pins the graphics file sizes and the IMAG, FRML and CSTR totals; the per-file breakdown and the size of AText.res come from running the tools' parser. None of the resources seen so far has a name. The FRML format is not decoded yet.
