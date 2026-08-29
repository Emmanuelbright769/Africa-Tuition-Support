---
name: Proctoring upload immutability
description: Concurrency and object-key rules that keep timed-out recording uploads from changing finalized evidence.
---

Treat a private-storage upload timeout as a deadline, not as cancellation. Each recording upload attempt must use an isolated object key, and only the key committed in the media index may be used for playback.

**Why:** A storage promise can finish after its caller times out. Reusing a deterministic key lets that late write overwrite evidence already indexed by a successful retry.

**How to apply:** Serialize chunk indexing and session finalization on the same database lock, commit server-observed failure state before releasing it, and never let retries share a mutable storage key.