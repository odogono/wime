---
kind: fact
topic: graphics
confidence: provisional
sources:
  - tool:tools/extract-graphics.ts#decodeFrmlResource
  - resource:AAnims.res#FRML 7
  - resource:BScene.res#FRML 0
issue: 80
---

**The 19 FRML resources are the Animation Level's figure sets: one set of frames for each kind of individual, walking, fighting, falling and standing.**
Read by eye from the decoded frames, AAnims.res holds an Ent (FRML 7), a giant spider (11), a troll-like creature (12), a soldier with a shield (14) and a spearman (15). BScene.res holds a hobbit (0), an elf archer (1), a man with a sword (2), a dwarf with an axe (3), a wizard with a staff (4), a small orc (5), an orc with a shield (6), a hooded figure in a red cloak (8), a large troll (9), a warg (10), a rider on horseback (13), a figure fading away (16), arrows in flight (18) and four small figures (19). Most sets run from walking frames through attacks to a fall and a body lying on the ground. The six BScene.res sets of the Free Peoples (0 to 4 and 8) have 4 planes; the rest have 5. A roster entry's figure byte names its set (finding:ui-animation-level-figures-walk-off), and a script moves it through the frames (finding:graphics-figure-animation-scripts).
