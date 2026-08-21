---
name: Back to School Kiddies wallet rules
description: Permanent $30 eligibility, certificate gating, and guardian wallet fee treatment for the kiddies programme.
---

The Kiddies programme has no holding-period settlement. Once a child wallet first reaches $30, the CBT entitlement remains permanently unlocked even if the guardian later withdraws money. An approved birth certificate is required before either the CBT or withdrawal can be used.

Deposits charge 5% on top of the amount credited to the child wallet. Withdrawals deduct 7.5% from the requested child-wallet amount before crediting the guardian wallet. Record gross amount, fee, net amount, and both wallet movements atomically; money-moving requests must be idempotent.

**Why:** Guardians must retain access to their savings without losing a child’s earned assessment entitlement, while fees and retry behavior must never create unexplained or duplicate wallet movements.

**How to apply:** Keep certificate verification, wallet balance checks, permanent unlock state, transaction records, and replay protection server-side whenever changing contribution, withdrawal, CBT eligibility, or staff-award flows.