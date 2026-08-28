---
name: Admin control integrity
description: Security rules for account suspension, auditable admin mutations, and manual payment replay protection.
---

Account suspension must be enforced for every authenticated API request as well as every login and linked-role switch path. Sensitive admin mutations must require a reason, and their audit record should be committed atomically with the mutation whenever possible.

**Why:** Checking only the main session endpoint or one login path leaves alternate authentication and existing sessions usable. Writing audit evidence after an irreversible mutation can leave a successful change with no record if the audit insert fails.

**How to apply:** Treat suspension as shared authentication middleware, not route-specific business logic. For manually credited payments, use a globally unique provider reference plus cross-process serialization; never rely only on a read-before-write duplicate check.

An active account lien must block every user-initiated funds-out path across every product and linked role, including withdrawals, transfers, purchases, reservations, trading allocations, and escrow release.

**Why:** Checking only one wallet or checking before a debit without serialization lets users route funds through another product, switch linked roles, or win a race against lien placement.

**How to apply:** Serialize funds-out requests and every automatic/manual lien mutation on one stable linked-account identity. Preserve lien ownership: a lifecycle may release only the lien it created, while explicit admin release may clear the whole hold.