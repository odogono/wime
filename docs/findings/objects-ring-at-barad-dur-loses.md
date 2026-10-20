---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x0efa8
  - disasm:code+0x0efc8
  - disasm:code+0x0296c
  - disasm:code+0x02d06
  - resource:BScene.res#CSTR 49
  - observed:ending-ring-at-barad-dur
  - observed:ending-ring-at-isengard
issue: 103
---

**The game is lost when an Evil Leader carrying the Ring steps onto Barad-dûr, (1856, 1120): "The Dark Lord's servant has reached Barad-dur with the Ring." Reaching Orthanc does nothing.**
The test is in a Leader's movement step on the Campaign Level, with the tripwires, each time the Leader lands on a tile origin (finding:mobilisation-tripwires-follow-arrival). If the Leader's allegiance is 0, Evil, and its own objects word holds the Ring (bit 0), and it stands on (1856, 1120), it calls the losing ending with argument 1 (code+0x0efa8, code+0x0efc8). Argument 1 shows BScene CSTR 49 in place of the Strongholds' CSTR 50 (code+0x02d06), and the common pages, CSTR 51 and 52, follow, closing "YOU HAVE LOST THE WAR IN MIDDLE EARTH." (finding:places-stronghold-falls-with-its-garrison).

This is the only call of the losing ending with argument 1, and no other Place is tested, so the Orthanc of finding:ai-nazgul-carry-captured-ring plays no part: a Ring-carrying Nazgûl walked onto Isengard in play and nothing happened. An Evil Ring-bearer is sent towards Barad-dûr when it takes the Ring (finding:objects-ring-passes-after-a-fight), and can be fought on the way to win the Ring back. The test reads the Leader's own objects, so an Evil follower carrying the Ring does not lose the game; Evil Ring-bearers are the last-listed Evil row of a fight, a Leader in practice.
