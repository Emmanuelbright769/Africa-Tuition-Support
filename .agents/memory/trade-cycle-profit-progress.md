---
name: Trade cycle profit progress
description: Durable business rule for Trade Market cycle progress and earnings-cap calculations.
---

Trade cycle progress and the settlement earnings cap use cumulative realised positive profit as the numerator. Original capital is excluded, and withdrawing earned profit must not reduce progress.

The private profit thresholds are the original capital multiplied by the cycle's full target multiplier. For the 120-day cycle, $100 of capital reaches 100% progress at $200 of cumulative profit, excluding the $100 capital. The 60- and 90-day cycles use their corresponding private promised-return calculations.

**Why:** The user explicitly confirmed that progress represents accumulated profit earned during the cycle, not the amount currently retained in the Trade wallet.

Only canonical completed bot-session transactions count. Modern sessions require their user-bound session hash; narrowly formatted pre-replay-protection records provide legacy continuity. Referral commissions, admin credits, and failed/reversed rows never qualify.

**How to apply:** Keep progress, settlement caps, and reconciliation aligned to the same canonical transaction-backed cumulative profit. Never derive progress from current wallet balance or a manually editable wallet counter.