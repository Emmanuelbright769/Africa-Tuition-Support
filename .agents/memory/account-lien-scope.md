---
name: Account lien scope
description: Defines which financial actions an account lien is allowed to block.
---

An account lien must block only transfers that pay funds out externally from the liened student/SwiftWallet balance to a bank account or cryptocurrency address. It must not block payouts sourced from an independent Trade/affiliate wallet, nor trading-bot activation, trading, P2P, wallet-to-wallet transfers, bills, purchases, savings, or other internal financial services.

**Why:** The product intends a lien to protect only the balance on which it was placed. A user may have a liened student account and an unliened affiliate/Trade account under the same identity; the student lien must not freeze the separate account.

**How to apply:** Classify new routes by both source wallet and destination. External bank or crypto payouts from the liened student/SwiftWallet are blocked; independent Trade/affiliate-wallet payouts use only that wallet's own controls. Internal destinations remain allowed.

For duplicate-credit reconciliation, recover only value proven to remain available without reducing protected principal. When a completed external outflow proves that duplicate proceeds already left the platform, preserve principal and add the unrecovered amount to any existing lien.

**Why:** Reconciliation must not turn a platform concurrency fault into a principal loss, while confirmed external overpayments still require a durable recovery control.

**How to apply:** Require immutable transaction and outflow evidence, use additive liens rather than overwriting existing ones, and make the correction atomic and replay-safe.