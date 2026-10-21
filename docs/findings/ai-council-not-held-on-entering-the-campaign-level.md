---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0da5c
  - disasm:code+0x0e7d8
  - disasm:code+0x0ce40
  - disasm:code+0x0ce44
  - disasm:code+0x0cd88
issue: 171
---

**The Council of Elrond's test that the pointer is shown only keeps the Council from being held as the Campaign Level is entered; on the hour on the Campaign Level the pointer is always shown, so it never stands in the way there.**
The Council is held only while the pointer is shown, data+0x4c72 (code+0x0da5c; finding:ai-council-of-elrond-trigger). The routine that tests it is called on each hour of the Campaign Level (code+0x0e7d8) and once at the end of entering it (code+0x0ce40). Entering the Campaign Level hides the pointer first (code+0x0cd88) and shows it again only after that call (code+0x0ce44), so the Council can't be held on entering. The pointer is otherwise hidden only while a Level is set up or the game boots, so on the Campaign Level's hours the test always passes, and the Council comes on the first hour after the Ring-bearer and Gandalf meet at Rivendell.
