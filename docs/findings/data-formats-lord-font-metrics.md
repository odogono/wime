---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - resource:Disk.1#FONTS:lord/10
  - tool:tools/extract-font.ts#parseDiskFont
issue: 117
---

**lord/10 is a standard AmigaOS proportional bitmap font, 10 pixels high with its baseline on row 7, for characters 32 to 126. Most letters and digits are 3 pixels wide and advance 4, and nothing is kerned.**
FONTS:lord/10 is a load file with one 1200-byte hunk: a DiskFontHeader (file ID 0x0f80, revision 1) and its TextFont, then the strike bitmap and three tables. The TextFont gives a height of 10, a nominal width of 7, a baseline of 7, a bold smear of 1 and the flags proportional, designed and disk font. The strike is one bitmap 256 pixels wide (a 32-byte modulo) and 10 rows deep holding every glyph side by side. For each of the 95 characters, and a last "not defined" glyph, the char location table gives the glyph's x and width in the strike and the spacing table how far the pen moves. The kerning table is all zeros.

| Characters                             | Glyph width | Advance |
| -------------------------------------- | ----------- | ------- |
| space                                  | 0           | 2       |
| `! . : '`, `i l`                       | 2           | 2       |
| `( ) , ;`, `j`                         | 2           | 3       |
| digits, the other letters and symbols  | 3           | 4       |
| `% < > K N ]`                          | 4           | 5       |
| `?`                                    | 3           | 5       |
| `M W m w`                              | 5           | 6       |
| `# @ [ _ { }` and undefined characters | 0           | 7       |
| ``$ & ` ~``                            | 0           | 0       |

Lower case g, j, p, q and y descend below the baseline into rows 8 and 9. Capital O has no glyph of its own: its location entry points at the digit 0's. tools/extract-font.ts decodes the font, and `bun run export:web` writes the strike as a glyph sheet and the tables as JSON for the port.
