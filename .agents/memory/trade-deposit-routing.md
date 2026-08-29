---
name: Trade deposit routing
description: Rules for automatically crediting Trade Market bank and card deposits to the intended wallet.
---

Trade Market payment intents must remain Trade Market deposits through browser verification, provider webhooks, and background retries. The persisted deposit wallet type is authoritative; an unknown non-exchange type must never silently default to SwiftHub.

**Why:** A provider callback previously treated a Trade Market Korapay payment as an ordinary wallet deposit, while other automation ignored Trade Market payment types. This left deposits in the wrong wallet or pending for manual intervention.

**How to apply:** Every automated payment-finalization path must dispatch by the server-created deposit intent, require an exact target type, and use the same atomic replay claim and wallet update. New payment providers must support Trade Market intents in both their webhook and retry paths before release.