---
name: App Storage client startup
description: How to prevent an unprovisioned default App Storage bucket from taking down the application.
---

Instantiate the Replit object-storage client only when handling a storage operation, and convert initialization failures into an explicit feature-level error.

**Why:** The SDK starts asynchronous default-bucket discovery in its constructor. When no App Storage bucket is provisioned, a module-level client can reject during server startup and crash unrelated application services.

**How to apply:** Keep object-storage construction inside an immediately awaited request or background-job operation. Do not create a shared module-level client unless the bucket is guaranteed to exist before process startup.