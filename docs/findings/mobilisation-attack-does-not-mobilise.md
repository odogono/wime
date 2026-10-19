---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0e6e0
  - disasm:code+0x0f376
  - disasm:code+0x12fd6
issue: 45
---

**Being attacked never mobilises a Force or its Nation. An unmobilised Force fights back when attacked but stays outside the player's command.**
The only code that turns allegiance 1 into 99 for any entry is the trigger (code+0x0e6e0; finding:ai-trigger-conditions). The Token scenes also write 99, to fixed roster entries. Neither the fight code nor the combat code changes the allegiance, the trigger byte or the War Events. The one exception is a follower taking over its dead Leader's allegiance (code+0x12fd6; finding:forces-followers-of-a-dead-leader). An Evil Force attacks unmobilised Forces like any other non-Evil Force (code+0x0f376), and they fight with their own strength.

The manual's "unless Evil attacks them first" (finding:mobilisation-nations-wait-for-token) comes about another way: Evil reaching the Fords of Isen sets the War Events that mobilise Rohan and Gondor (finding:mobilisation-evil-at-the-fords-of-isen).
