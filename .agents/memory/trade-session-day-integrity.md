---
name: Trade session day integrity
description: A Trade Market day must come from a real, uniquely scheduled bot session
---

A bot activation completed within seconds must not advance the trading day or write a financial settlement. Keep the session active until a minimum valid duration has elapsed, and allow at most one completed bot activation per trading date.

**Why:** Repeated activate/complete requests advanced one account from day 11 to day 14 within minutes while producing only microscopic amounts rounded visually to no profit.

**How to apply:** Enforce minimum duration and daily uniqueness on the server under the Trade-wallet lock. Browser timers are presentation only. Preserve premature-session evidence as failed/reversed rows when repairing history rather than deleting it.