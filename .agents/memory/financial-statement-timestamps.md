---
name: Financial statement timestamps
description: Timestamp and date-range policy for user histories, receipts, and admin-generated financial statements.
---

Display financial activity from its persisted database timestamp in Africa/Lagos time, including the date, time, and explicit timezone. Admin statement date ranges are inclusive Lagos calendar days and aggregate source-labelled entries across the user's applicable ledgers.

**Why:** Date-only records and timestamps generated at receipt-render time can misstate when a transaction occurred, while source-free statements make isolated service wallets difficult to reconcile.

**How to apply:** Never substitute the current time for a missing transaction timestamp. Show only persisted balance details, and omit post-transaction balances where a ledger does not store them.