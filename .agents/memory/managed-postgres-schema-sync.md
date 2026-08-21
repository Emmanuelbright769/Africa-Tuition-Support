---
name: Managed PostgreSQL schema sync
description: Development schema updates can hit legacy Drizzle diff conflicts; production schema is publish-managed.
---

Use the declared Drizzle schema as the source of truth for application tables. If `drizzle-kit push` cannot resolve an existing-table rename or unrelated legacy sequence conflict in development, apply the narrow, equivalent development DDL through the managed database tooling after checking it is non-destructive.

**Why:** The project has pre-existing database artifacts that can prevent Drizzle's global diff from completing even when the new table itself is safe to add. Production migrations must remain handled by the platform's publish-time schema diff, not custom startup DDL.

**How to apply:** Verify the generated table/enum shape against the schema, make only idempotent development changes, and let the Publish flow present production rename decisions.