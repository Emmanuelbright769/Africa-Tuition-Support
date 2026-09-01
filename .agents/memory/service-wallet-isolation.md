---
name: Service wallet isolation
description: Durable accounting boundaries for Trade Market modes and TS-Mart.
---

Manual Trading, Trading Signals, and TS-Mart must each use an independent wallet and signed activity ledger. Itera BOT remains on the existing protected Trade Market cycle wallet because its principal locks, early-exit rules, settlement, and profit-cap accounting are inseparable from that account.

**Why:** Renaming shared-balance views created false wallet separation, and allowing order/trade flows to borrow SwiftWallet or the BOT balance made balances misleading and could cross-contaminate financial rules.

**How to apply:** Debit and credit the relevant wallet in the same database transaction as the trade or escrow state change. Direct deposits must be identity-gated, provider-verified, replay-safe, and target-bound. Never fall back to another wallet when a service balance is missing or insufficient.