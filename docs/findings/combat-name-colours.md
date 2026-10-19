---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10330
  - disasm:code+0x11c5a
  - disasm:code+0x1143e
  - observed:combat-faramir-go-there
issue: 45
---

**A row's name is drawn in colour 5 when its health is full and in a second colour when wounded: 10 on the Campaign Level, 18 on the Animation Level. A dead or destroyed row is drawn in colour 1 or 22, and its option marker goes.**
code+0x10330 compares the current health with the maximum and checks the row's strength. On the Campaign Level colour 5 showed as black and colour 1 as grey, which fits the manual's black, red and grey (finding:combat-health-shown-by-name-colour). Colour 10 is the red of the Evil header. Only Characters can be wounded (finding:combat-toughness-is-fighting-strength-times-health), so a Unit's name changes only when it is destroyed. Then its number goes too, and it shows as the grey name alone. A row with nothing left gets option "gone", and its buttons are redrawn with none marked (code+0x11c5a). In play Faramir's name turned grey when he fell, and the destroyed Rangers became a grey "Rangers".
