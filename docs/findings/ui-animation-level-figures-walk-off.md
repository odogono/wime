---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0284e
  - disasm:code+0x0b102
  - disasm:code+0x0b260
  - disasm:code+0x09ffa
  - observed:animation-level-opening
issue: 80
---

**The Animation Level shows the watched Force's figures crossing the scene, and goes up to the Campaign Level by itself once they have all walked off the right edge.**
The main loop (code+0x0284e) runs the Animation Level (code+0x0b102), then the Campaign Level, and back. Entering sets the mode byte data+0x5555 to 3 (code+0x09e06; 2 is the Campaign Level, 1 the Full Map). The Animation Level loop ends when the map icon or button 0xfb is pressed, when a fight is to be played out (fightState 1), or when the leftmost figure's x passes 330 and the watched Character is alive (code+0x0b260). In the opening capture, Frodo, Sam and Pippin walk right across the Hobbiton bridge and off the screen.

Each roster entry in the scene gives as many figures as the low byte of its strength, at most 10 (code+0x09ffa); riders (figure 13) at most 3 and figure 7 at most 5, and no more than 50 in all. Good figures stand from y 166 and Evil ones from y 165, two pixels lower per figure, and nearer figures are drawn later. A figure byte (roster byte 20) below 20 is the FRML figure set (finding:graphics-animation-level-figure-sets); 20 or more is a still IMAG with that id, used for large Encounter figures.
