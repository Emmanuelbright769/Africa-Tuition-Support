---
name: Monthly account billing
description: Durable charging, arrears, restriction, and funding-integrity rules for monthly platform access.
---

Starting September 2026, each applicable account is charged $1.50 subscription plus $0.50 maintenance for the current Lagos calendar month. Missed months are waived rather than accumulated. Collect the current cycle atomically; never take a partial amount while leaving access restricted. Do not charge months before an account existed.

**Why:** A partial deduction would take a user's money without restoring service, while month-by-month charging keeps access recovery simple and ensures a missed month never becomes an unexpected accumulated bill.

**How to apply:** Keep unpaid accounts restricted server-side to authentication, billing status, identity verification, and funding. Restore access after the current cycle is paid. Funding that can unlock access must be provider/on-chain verified, account-owned, replay-protected, and serialized with billing.