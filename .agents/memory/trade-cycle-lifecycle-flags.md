---
name: Trade cycle lifecycle flags
description: How to resolve lifecycle flags that contradict a funded, incomplete Trade Market cycle
---

A genuinely completed cycle is authoritative from its configured day count. A genuinely completed early exit atomically clears Trade balance and locked principal. If either completion flag is set while a cycle remains funded, has locked principal, and has not reached its plan day count, the flag is stale and the funded cycle remains activatable.

**Why:** Legacy data contained both completion flags on a funded day-30/90 cycle, blocking bot activation even though neither lifecycle operation had actually completed.

**How to apply:** Gate activation on the day-count completion and real account restrictions. Repair contradictory completion flags under the same wallet lock or during startup reconciliation; never reopen a zeroed early-exit wallet or a cycle whose day count reached its plan.