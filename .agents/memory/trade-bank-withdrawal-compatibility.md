---
name: Trade bank withdrawal compatibility
description: How trade-market bank withdrawals stay compatible with the existing withdrawal request constraint.
---

Trade-market bank withdrawals must be recorded as the existing `bank` request type and marked with a `[TRADE MARKET]` bank-name prefix, rather than relying on a separate request type.

**Why:** The live database limits withdrawal request types to `bank` and `crypto`; an attempted `trade_bank` record fails. That previously occurred after the trade wallet had been debited, leaving a failed user-facing request with no matching bank-transfer request.

**How to apply:** Keep trade withdrawal creation and balance debit in one database transaction. When a marked request is refunded, return its full gross amount to the trade wallet, not the SwiftWallet.

Ordinary Trade Market withdrawals and SwiftWallet transfers expose realised profit only (`trade balance - locked principal`). Any early-cycle capital settlement must be a separate, explicit action.

**Why:** Presenting an early-exit allowance as the normal withdrawable balance makes locked capital appear spendable and can cause large unintended withdrawals.

**How to apply:** Reuse one profit-only calculation in overview, wallet, and server routes. Never infer early-exit intent from an ordinary withdrawal request.

The `bank_transfers_enabled` admin setting is global and must gate both SwiftHub bank transfers and Trade Market bank withdrawals on the server.

**Why:** UI-only or route-specific shutdowns leave another bank payout path open.

**How to apply:** Check the persisted setting only at final server submission. Let users complete the normal bank form, then return a generic network error without revealing that an administrator disabled transfers.