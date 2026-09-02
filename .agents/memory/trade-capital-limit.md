---
name: Trade Market capital limit
description: Cumulative Itera BOT principal is capped across every funding path
---

Itera BOT locked trading capital must never exceed $1,200. The limit is cumulative across the initial funding and all later top-ups; bot earnings are not principal and may make total Trade balance exceed the capital cap.

Once all three top-up slots are used, every funding method stays closed for the remainder of that cycle. Reinvestment must not bypass `3/3`; only normal cycle settlement resets the cycle boundary and reopens initial funding for a new cycle.

**Why:** A per-deposit maximum allowed repeated top-ups to grow locked principal without a cumulative ceiling. Pending payment intents could also race unless they reserve capital capacity.

**How to apply:** Enforce the cap under the Trade-wallet funding lock before accepting external payment intents and before every atomic credit or SwiftWallet transfer. Include pending/confirmed Trade deposit reservations and reject the whole funding request rather than partially crediting paid funds.