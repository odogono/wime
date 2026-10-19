---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10d7a
  - disasm:code+0x11764
  - disasm:code+0x117a2
  - disasm:code+0x1181c
  - disasm:code+0x118f2
  - disasm:code+0x119bc
  - disasm:code+0x11f66
  - disasm:code+0x11fa4
  - disasm:code+0x120f6
  - disasm:code+0x121f8
  - observed:combat-faramir-go-there
issue: 45
---

**A watched fight opens with "<A> and <B> move grimly into battle." Each loss is then reported with a fixed phrase, chosen by side and by how the blow fell for a Character, and at random from three for a Unit.**
Unit losses give the head count, or "all" when the whole row goes (code+0x119bc):

- "<n> of the <Unit> have been cut down!"
- "<n> of the <Unit> have been slain in a frenzied assault!"
- "The blood of <n> of the <Unit> flows red on the stones."

| Who            | Struck by       | Killed                                    | Wounded                                                                            |
| -------------- | --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Good Character | its share       | " is killed by a foul blow!"              | " is struck a grave wound!"                                                        |
| Evil Character | its share       | " is felled by a mighty attack!"          | " staggers back as if wounded!"                                                    |
| Good Character | blows left over | " is struck down by a frenzied attack!"   | " staggers back from an insidious blow!" or " is caught by the fell enemy's blow!" |
| Evil Character | blows left over | " is clove asunder by a skillful stroke!" | " cries in bitter pain from a swift thrust!"                                       |

The Character's name comes first. "Share" and "left over" are the two ways losses are dealt (finding:combat-toughness-is-fighting-strength-times-health). In play the window read "FARAMIR and orcs move grimly into battle.", "The blood of 27 of the Rangers flows red on the stones.", "66 of the orcs have been cut down!" and "FARAMIR is struck down by a frenzied attack!". None of these appear in an ignored fight.
