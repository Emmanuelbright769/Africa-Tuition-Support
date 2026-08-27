---
name: Trade bank withdrawal compatibility
description: How trade-market bank withdrawals stay compatible with the existing withdrawal request constraint.
---

Trade-market bank withdrawals must be recorded as the existing `bank` request type and marked with a `[TRADE MARKET]` bank-name prefix, rather than relying on a separate request type.

**Why:** The live database limits withdrawal request types to `bank` and `crypto`; an attempted `trade_bank` record fails. That previously occurred after the trade wallet had been debited, leaving a failed user-facing request with no matching bank-transfer request.

**How to apply:** Keep trade withdrawal creation and balance debit in one database transaction. When a marked request is refunded, return its full gross amount to the trade wallet, not the SwiftWallet.

An early-cycle exit is a one-time settlement capped at 50% of authoritative locked capital plus 50% of realised profit; it must be blocked while a trade session is active and guarded against concurrent repeat requests.

**Why:** A balance-only cap can be bypassed with repeated withdrawals, allowing more than the intended early-exit entitlement.

**How to apply:** Calculate the cap on the server from the current wallet state, display the same cap before confirmation, and atomically mark the cycle's early exit as completed with the debit.