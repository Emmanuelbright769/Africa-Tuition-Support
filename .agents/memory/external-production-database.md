---
name: External production database
description: Explains which database is authoritative for live-site investigations and corrections.
---

The published application uses the external connection supplied through `EXTERNAL_DATABASE_URL`. Replit production-database query tooling targets a separate managed database and must not be treated as the live application source of truth.

**Why:** A reconciliation built from the managed production database used valid-looking but wrong wallet snapshots and transaction identities, causing the real live accounts to be skipped.

**How to apply:** For live-site financial investigations, first confirm the deployment connection and query the external database read-only through the application environment. Never build production correction evidence from the managed database unless the deployment is verified to use it.