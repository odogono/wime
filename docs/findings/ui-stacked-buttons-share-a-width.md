---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x03ad6
  - disasm:code+0x03b32
  - disasm:code+0x082ac
  - observed:provisions-menu
issue: 125
---

**A framed button drawn below another at the same x in the same box takes that button's width, so a column of framed buttons is as wide as its first label: in the Provisions menu all three are the width of "Put down an object".**
The button routine (code+0x03a54; finding:ui-message-box-text-colour) draws the label, then takes the label's width from the text routine. When it is to draw a frame (code+0x03ad6), it first compares the button's x and box with the last framed button's, kept at data+0x4f28 and data+0x4f24. If both match, it uses the width kept at data+0x4f2a in place of its own label's. It then keeps this button's width, x and box there (code+0x03b32) and draws the frame and clickable area from that width: the frame 6 wider than it, the area 4 wider.

The Provisions menu draws its buttons at x 20 in one box, in the order "Put down an object", "Take an object", "Use an object" (code+0x082ac; finding:ui-provisions-window). So all three take the first one's width. In lord/10 (finding:data-formats-lord-font-metrics) that is 67 pixels, which makes frames 73 wide and areas 71 wide. A capture of the menu shows three frames of the same width, about 73 pixels.
