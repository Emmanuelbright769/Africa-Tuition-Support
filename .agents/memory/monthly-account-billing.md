---
name: Monthly account billing
description: Durable charging, arrears, restriction, and funding-integrity rules for monthly platform access.
---

Starting September 2026, applicable existing accounts are charged $1.50 subscription plus $0.50 maintenance on the first day of each Lagos calendar month. A new account's signup month is free; its first cycle begins on the first day of the following month. Missed months are waived rather than accumulated. Collect the current cycle atomically; never take a partial amount while leaving access restricted.

**Why:** New members must not meet a fee gate immediately after signup. A partial deduction would take a user's money without restoring service, while month-by-month charging keeps access recovery simple and prevents accumulated bills.

**How to apply:** Compare signup and billing months in Africa/Lagos. Same-month signups have access with no payable cycle; older unpaid accounts retain only authentication, billing status, identity verification, and funding. Provider/on-chain funding must remain account-owned, replay-protected, and serialized with billing.

General SwiftWallet access never requires an activation deposit or retained balance. Members may transfer or withdraw the full available balance; monthly fees are separate charges, not a permanent wallet floor.