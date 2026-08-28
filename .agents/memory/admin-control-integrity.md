---
name: Admin control integrity
description: Security rules for account suspension, auditable admin mutations, and manual payment replay protection.
---

Account suspension must be enforced for every authenticated API request as well as every login and linked-role switch path. Sensitive admin mutations must require a reason, and their audit record should be committed atomically with the mutation whenever possible.

**Why:** Checking only the main session endpoint or one login path leaves alternate authentication and existing sessions usable. Writing audit evidence after an irreversible mutation can leave a successful change with no record if the audit insert fails.

**How to apply:** Treat suspension as shared authentication middleware, not route-specific business logic. For manually credited payments, use a globally unique provider reference plus cross-process serialization; never rely only on a read-before-write duplicate check.

An active account lien must block direct Trade Market bank withdrawals as well as SwiftHub spending paths, with a second lien check inside the debit transaction.

**Why:** Checking liens only against the SwiftWallet lets users route funds directly from another product wallet to a bank.

**How to apply:** Treat liens as account-level payout restrictions. Admin lien placement interfaces must also expose an audited release action.