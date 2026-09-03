---
name: Account lien scope
description: Defines which financial actions an account lien is allowed to block.
---

An account lien must block only transfers that pay funds out externally from the liened account's student/SwiftWallet balance to a bank account or cryptocurrency address. It must not block a separate affiliate account sharing the same email, payouts sourced from an independent Trade/affiliate wallet, or internal financial services.

**Why:** The product intends a lien to protect only the account and balance on which it was placed. A user may have a liened student account and an unliened affiliate account under the same email; identity linkage must not freeze the separate account.

**How to apply:** Check the signed-in user ID, never every user row matching the email. Then classify by source wallet and destination: external payouts from the liened account are blocked; separate affiliate/Trade-wallet payouts use their own controls.

For duplicate-credit reconciliation, recover only value proven to remain available without reducing protected principal. When a completed external outflow proves that duplicate proceeds already left the platform, preserve principal and add the unrecovered amount to any existing lien.

**Why:** Reconciliation must not turn a platform concurrency fault into a principal loss, while confirmed external overpayments still require a durable recovery control.

**How to apply:** Require immutable transaction and outflow evidence, use additive liens rather than overwriting existing ones, and make the correction atomic and replay-safe.