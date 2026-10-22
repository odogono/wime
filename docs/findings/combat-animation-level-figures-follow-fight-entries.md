---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0b37c
  - disasm:code+0x0b398
  - disasm:code+0x0a5ce
  - disasm:code+0x0a7a0
  - disasm:code+0x1101c
  - disasm:code+0x117f6
  - disasm:code+0x118de
  - disasm:code+0x117ca
  - disasm:code+0x11b10
  - disasm:code+0x126b2
  - disasm:data+0x095e
issue: 169
---

**In a fight on the Animation Level the figures act out the rounds through fixed entries of their scripts: they walk to the battle lines, swing each round as their row's option allows, recoil and lunge when an individual is wounded, and play a fall when the row loses men.**
The battle lines are 25 and 85 pixels past the rightmost Good figure; when the first Evil row is a balrog (entries 183 to 187) that x is taken as 100, giving lines at 125 and 185 (code+0x0b37c). Each side's figures are reset to entry 0x18, frame 7 then stop, and then called to entry 0xa0 (Good) or 0xb8 (Evil), which walk them to their line and post events 6 and 7; the fight begins when both have arrived (code+0x0b398). The walk is the script's own: for most sets five pixels a step at speed 10, about 25 pixels a second; hobbits, dwarves and Ents slower or faster, riders 50 pixels a second.

A call (code+0x0a5ce) replaces a running entry and keeps the old one as its return; in append mode (code+0x0a7a0) an idle figure starts the entry at once and a busy one takes it as its next return. Figures already lying (script offsets 0x4e to 0x52) are skipped. Each round every Charging row's figures are queued entry 0x2a three times and every Engaging row's twice (code+0x1101c): a swing on frames 8, 9, 8 and 7. When an individual is wounded (code+0x117f6, code+0x118de), every row on its side plays entry 0x4c, a recoil seven pixels back, and the first Charging or Engaging row on the other side entry 0x1a, a lunge six pixels forward.

Entry 0x4f is the fall: frames 12, 13 and 14 and then the body lying on frame 14 for good; the wizard and wight sets and the balrog fade instead. After each hit message (code+0x11b10) a row loses x/2 figures, rounded down to whole pairs, where x is the losses times 20 over the row's starting strength when that is over 10, and otherwise the losses times 2; a killed Character's row falls entire (code+0x117ca). At the end (code+0x126b2) a Good win stands the Good figures on entry 0 and sends every Evil figure to the fall; an Evil win stands the Evil figures on entry 0. Riders have no swing, lunge or fall entries.
