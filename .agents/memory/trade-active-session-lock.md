---
name: Trade active-session lock
description: Defines which Trade Market wallet actions must freeze while a bot trade is running.
---

While a Trade Market bot session is active, block bank deposits, crypto deposits, SwiftWallet top-ups, reinvestment, withdrawals/transfers, and exchange-wallet address changes. The bot completion/deactivation control must remain available.

**Why:** Changing the trade wallet's funds or payout destination during a live position can make the session's capital and settlement calculations inconsistent. Locking only the visible buttons is insufficient because stale clients and direct API calls can bypass the UI.

**How to apply:** Enforce the rule on both the wallet UI and every initiation, verification, or mutation endpoint that can fund, debit, reinvest, or change the wallet. Use server-derived session state as authoritative, close already-open dialogs when a session starts, and never apply the lock to the bot's own completion route.