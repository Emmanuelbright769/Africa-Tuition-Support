---
name: Trade active-session lock
description: Defines which Trade Market wallet actions must freeze while a bot trade is running.
---

While a Trade Market bot session is active, block bank deposits, crypto deposits, SwiftWallet top-ups, reinvestment, withdrawals/transfers, and exchange-wallet address changes. The bot completion/deactivation control must remain available.

Keep the bot-session marker set until every completion-side balance, cycle, ledger, and notification effect has finished. Early exit, bot activation, and all Manual/Signal position balance mutations must serialize on the same per-wallet lock. A new cycle must clear any stale session marker.

**Why:** Changing the trade wallet's funds or payout destination during a live position can make the session's capital and settlement calculations inconsistent. Clearing the marker before completion accounting finishes lets an overlapping early exit close the cycle while stale completion work later restores funds. Locking only visible buttons is insufficient because stale clients and direct API calls can bypass the UI.

**How to apply:** Enforce the rule on both the wallet UI and every initiation, verification, or mutation endpoint that can fund, debit, reinvest, open/resolve positions, or change the wallet. Use server-derived session state as authoritative, close already-open dialogs when a session starts, and let bot completion retain exclusive ownership of the marker until its final effect.