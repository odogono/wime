---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x04dde
  - disasm:code+0x04bea
  - disasm:code+0x04fae
  - disasm:code+0x04c80
  - disasm:code+0x05190
  - disasm:code+0x050ac
  - disasm:code+0x04de6
  - disasm:code+0x0d08a
  - observed:combat-faramir-go-there
issue: 166
supersedes: combat-rows-merge-like-named-forces
---

**Every awake Leader within 9 pixels of the fight takes part, with its followers. Its side is set by roster order. Each Good Leader gets a row of its own, while a follower or an Evil Leader whose name matches an existing row of its side joins that row.**
Good rows come from entries 1 to 78 and Evil rows from 79 to 151, each an awake Leader within 9 pixels of the Good party, followed by its own followers (code+0x04dde, code+0x04bea). A Good Leader is always appended as a new row (code+0x04fae to code+0x04fe8), so two Leaders of "elves" standing at Thranduil's Palace make two rows. A follower is compared by name with the rows listed so far and added to the first that matches (code+0x04c80), and so is an Evil Leader (code+0x05190), so two Units of "orcs" make one row. Each side lists at most 19 rows: 9 on the Animation Level, and 7 against a Balrog (code+0x04de6).

An Encounter is added as the only Evil row (code+0x0d08a). Against Shelob only Shelob is listed (code+0x050ac). So a fight draws in every Force standing nearby, not just the two that met. In play Faramir brought the 200 Rangers following him.
