---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x109c2
  - disasm:code+0x12698
  - disasm:code+0x0e712
  - observed:combat-faramir-go-there
issue: 45
---

**Game time stands still while a fight is fought: the whole fight runs inside one call that never advances the clock or moves a Force.**
The combat code (code+0x109c2) loops until a side is gone (code+0x12698). Only the Campaign and Animation Level loops call the tick (code+0x0e712), and they wait inside that call. In play a watched fight took about 45 seconds of real time and the clock stayed at 5 a.m. throughout. While a fight's announcement waits for an answer the clock is stopped too (finding:combat-unanswered-announcement-ignores-the-fight).
