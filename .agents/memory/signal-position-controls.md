---
name: Signal position controls
description: Financial semantics for live signal P&L, adding money, and user-directed close settlement
---

Open signal trades show unrealized P&L from the latest provider price. Adding money executes at the latest provider price and recalculates one blended entry from the combined purchased units, rather than applying new funds to the original price. Closing settles the stake plus signed P&L once into the isolated Signals wallet.

**Why:** Treating added money as if it entered at the original price creates profit or loss the user never earned. User controls also need wallet isolation, row locking, and replay protection so retries cannot debit or settle twice.

**How to apply:** Any future signal-trade control must use provider prices, lock the open position during financial changes, keep effects in the Signals ledger, and use durable references for debit or credit replay protection.