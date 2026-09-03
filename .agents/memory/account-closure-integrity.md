---
name: Account closure integrity
description: Rules for safely closing one user role account without deleting financial evidence or affecting linked accounts.
---

Self-service account closure must soft-close only the authenticated role-specific account. It must preserve financial, KYC, notification, and audit evidence, invalidate the active session, and prevent future login or linked-role switching into the closed account.

**Why:** Financial records cannot be safely hard-deleted, and users may hold multiple role accounts under one email that must remain independent.

**How to apply:** Require explicit destructive confirmation and reject closure while any wallet has funds, a market position or Trade cycle is active, or a deposit, withdrawal, order, or loan remains unresolved. Match and update by user ID, never by email.