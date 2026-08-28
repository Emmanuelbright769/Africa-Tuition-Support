---
name: Monthly account billing
description: Durable charging, arrears, restriction, and funding-integrity rules for monthly platform access.
---

Starting September 2026, each applicable account owes $1.50 subscription plus $0.50 maintenance per Lagos calendar month. Collect all outstanding cycles as one atomic operation; never take a partial amount while leaving access restricted. Do not charge months before an account existed.

**Why:** A partial deduction would take a user's money without restoring service, while ignoring arrears would let missed monthly charges disappear after downtime or delayed funding.

**How to apply:** Keep unpaid accounts restricted server-side to authentication, billing status, identity verification, and funding. Restore access only after all arrears are paid. Funding that can unlock access must be provider/on-chain verified, account-owned, replay-protected, and serialized with billing.