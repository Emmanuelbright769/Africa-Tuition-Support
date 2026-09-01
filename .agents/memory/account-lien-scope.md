---
name: Account lien scope
description: Defines which financial actions an account lien is allowed to block.
---

An account lien must block only transfers that pay funds out externally to a bank account or cryptocurrency address. It must not block trading-bot activation, trading, P2P, wallet-to-wallet transfers, bills, purchases, savings, or other internal financial services.

**Why:** The product intends a lien to prevent external removal of funds without suspending the user's ability to keep using and growing funds inside the platform.

**How to apply:** Classify new routes by destination, not merely by whether they debit a balance. Mixed routes must inspect the requested payout type: external bank or crypto options are blocked, while internal wallet or exchange destinations remain allowed.

For duplicate-credit reconciliation, recover only value proven to remain available without reducing protected principal. When a completed external outflow proves that duplicate proceeds already left the platform, preserve principal and add the unrecovered amount to any existing lien.

**Why:** Reconciliation must not turn a platform concurrency fault into a principal loss, while confirmed external overpayments still require a durable recovery control.

**How to apply:** Require immutable transaction and outflow evidence, use additive liens rather than overwriting existing ones, and make the correction atomic and replay-safe.