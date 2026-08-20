---
name: Trade bank withdrawal compatibility
description: How trade-market bank withdrawals stay compatible with the existing withdrawal request constraint.
---

Trade-market bank withdrawals must be recorded as the existing `bank` request type and marked with a `[TRADE MARKET]` bank-name prefix, rather than relying on a separate request type.

**Why:** The live database limits withdrawal request types to `bank` and `crypto`; an attempted `trade_bank` record fails. That previously occurred after the trade wallet had been debited, leaving a failed user-facing request with no matching bank-transfer request.

**How to apply:** Keep trade withdrawal creation and balance debit in one database transaction. When a marked request is refunded, return its full gross amount to the trade wallet, not the SwiftWallet.