---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:data+0x4b48
  - disasm:code+0x0acea
  - observed:animation-level-opening
issue: 80
---

**The Animation Level has one fixed palette of 32 colours, the RGB4 words at data+0x4b48, loaded each time a scene is built.**
The scene builder loads it at code+0x0acea through the palette routine at code+0x15d38. The words are `000 dca 2ae 27c 426 466 794 ac7 452 672 04b 27c 2ae 8df da3 ee6 122 544 900 c00 a2a d8d 89a cde b50 e70 410 731 964 c96 d86 fc8` (finding:data-formats-rgb4-palette-words). No code changes it with the time of day: the sky changes by drawing in a different colour instead (finding:graphics-animation-level-sky-by-hour). Next to it, data+0x4b88 holds the title screens' palette, data+0x4b08 the Campaign Level's and data+0x4ac8 the Full Map Level's. AAnims.res, AScene.res and BScene.res decode in these colours to match the captured opening scene.
