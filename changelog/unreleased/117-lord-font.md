---
type: fix
scope: view
section: fixed
---

**Windows are lettered in the original's font.** Every window now draws its text in lord/10, the bitmap font the game loads from its disk, pixel for pixel in the palette's colours. Boxes are sized and text is wrapped by the font's real glyph widths, so the Palantír's longer vision fits its box rather than spilling below the frame (#117).
