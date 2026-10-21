---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0528c
  - disasm:code+0x0345a
  - disasm:code+0x037d8
  - disasm:code+0x0a196
  - disasm:code+0x0617c
  - observed:animation-level-figure-click
issue: 161
---

**A click on the Animation Level goes to the frontmost thing under the pointer's fingertip: the screen's objects are kept in order of depth, highest first, and the click takes the first one whose rectangle holds the point. A figure's rectangle is its current frame, and a lower figure is in front.**
Everything that can be clicked, figures, icons and message boxes, is in one list at data+0x5100, counted by data+0x50fe. Adding an object (code+0x0345a) keeps the list sorted by its depth, byte 6, highest first; an object of equal depth goes after those already there. The click routine (code+0x0528c) walks the list from the start and stops at the first hit.

The point tested is the pointer's top-left (data+0x5026, data+0x5028) plus its width less one across and 6 down (the width is the byte at data+0x5024). On the Animation Level the pointer is a hand 24 by 13 pointing right, so the point is the tip of its finger, 23 across and 6 down. A point hits when it is at or right of the left edge and above the right edge (x ≤ point < x + width), and the same for y. For a figure, x and y are its top-left, the standing position less the frame's hot spot (finding:data-formats-frml-frame-lists), and the width and height are those of the frame it shows now, so the box follows the animation. Other objects use their stored width and height, at least 6 by 4.

The scene builder gives each figure a depth 15 less than the y it stands on (code+0x0a196: y 165 + k at depth 150 + k for Good figures, 166 + k at 151 + k for Evil ones), so of two overlapping figures the lower, nearer one wins, the one drawn on top (finding:ui-animation-level-figures-walk-off). The icons have their button number as depth (0xf0 to 0xf9) and an open message box has depth 180 (code+0x0617c), so both lie above every figure: a click inside an open box never reaches a figure behind it.

An object whose byte 4 has bit 0 set flashes when clicked, six times 4 frames apart (code+0x0555e). The icons have it; figures are created with byte 4 clear (code+0x038d0), so a clicked figure does not flash.

In FS-UAE the list held the three icons, a box at (8, 5), 208 by 24, at depth 180, and Pippin, Sam and Frodo at depths 154, 152 and 150 with tops at y 142, 140 and 138, each 24 by 28 or 29. Their stored widths shrank as they walked past x 300, to 16, 8 and then 0; how the drawing code clips them was not traced. With the fingertip at (150, 169), below Sam's and Frodo's rectangles, the click took Pippin.
