---
name: Prembly server authentication
description: Credential requirements for the project’s server-to-server Prembly identity checks.
---

Use the Prembly secret API key in the `x-api-key` header for server-side identity and liveness requests. Do not require or send an App ID, and do not expose or use the public key for these backend calls.

**Why:** Prembly’s current authentication documentation states that server API calls can be executed with the Secret Key alone. Requiring an incorrect App ID caused valid requests to fail.

**How to apply:** When adding or changing Prembly server requests, require only the secret API key and keep all credential handling on the server. Recheck Prembly’s current official documentation before changing this authentication rule.