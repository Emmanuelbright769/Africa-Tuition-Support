---
name: Transaction PIN policy
description: Security boundary between transaction authorization and identity recovery.
---

Outgoing wallet transfers, bank and crypto withdrawals, and bill payments require a four-digit transaction PIN. The PIN must be stored only as a salted slow hash, compared timing-safely, and protected by persisted failed-attempt lockout.

**Why:** Requiring a fresh email OTP for routine transactions is cumbersome, while storing or accepting a plaintext PIN would weaken payment security.

**How to apply:** Use email OTP only to create, change, or recover the PIN. Never accept transaction OTP as a fallback. New money-out routes must enforce the PIN server-side before provider invocation or wallet debit.