---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x0a0ca
  - disasm:code+0x038e8
  - disasm:code+0x0bcf4
  - disasm:code+0x02f94
  - disasm:data+0x0955
  - disasm:code+0x16904
  - disasm:code+0x17456
  - disasm:data+0x4bc8
  - observed:ending-figure-colours
issue: 119
supersedes: graphics-four-plane-figures-use-upper-colours
---

**Figures use a colour selector to route four source bitplanes into the five screen bitplanes; the winning picture supplies its own selector for each figure.** The Animation Level palette stays fixed. Roster byte 19 is the selector: `spawnFigures` reads it at code+0x0a0ca, passes it to `newFigure`, which stores it at figure-object byte 8 (code+0x038e8), and the ordinary draw passes that byte to the bitmap copy (code+0x0bcf4).

A zero selector takes the ordinary five-plane copy path. A nonzero selector uses four source planes (code+0x16904) and indexes the word table at data+0x4bc8. The five successive three-bit fields of the word, low field first, select the source for screen planes 0 to 4: values 0 to 3 copy that source plane, 4 clears the plane and 5 fills it inside the figure's mask (code+0x17456 to code+0x1758e). The mask is the union of the four source planes, so source colour 0 stays transparent even when an output plane is filled. Selector 1, word 0x5688, copies the four planes unchanged and fills screen plane 4: colours 16 to 31. Other selectors permute or repeat planes and can use either half of the palette.

The winning routine reads selectors from data+0x0955 (code+0x02f94). From the left, including the invisible dwarf, these are **4, 12, 2, 5, 6, 14, 3, 11, 24**. They are separate from the FRML sets and frames (finding:ui-ending-scenes-are-still-pictures). In particular the wizard uses selector 6 (word 0x3a50), and the two FRML 2 figures use 14 (0x2a58) and 24 (0x14e8). The losing picture uses selector 0 for its five-plane orcs, trolls and balrog, and selector 1 for its four-plane hooded figures (code+0x02c2c).

The `ending-figure-colours` reference run shows the wizard in blue and grey, the first FRML 2 figure bearded in blue and orange, and the rightmost FRML 2 figure blond in a blue cloak. See `docs/re/endings-reference.md` for the setup and gitignored captures. These are also the selectors used by ordinary Animation Level figures; correcting the shared colouring corrects both views.
