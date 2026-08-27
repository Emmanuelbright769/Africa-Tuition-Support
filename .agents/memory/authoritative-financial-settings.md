---
name: Authoritative financial settings
description: Rules for exchange rates, fees, and administrator changes that affect future money movements.
---

All currency conversions for new transactions must read the current persisted platform rate at transaction time. Do not introduce new transaction paths that calculate from exported fallback constants or retain stale rates after an administrator saves a change.

**Why:** Administrators expect a saved rate to affect the next eligible transaction immediately. Multiple constants and caches can otherwise produce conflicting customer charges and payouts.

**How to apply:** Route every money-moving conversion through the shared live-rate accessor, invalidate affected caches immediately after writes, and require a reason plus before/after audit evidence for administrative pricing changes.