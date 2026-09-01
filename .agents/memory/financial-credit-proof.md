---
name: Financial credit proof
description: Durable integrity rules for deposits, wallet transfers, reconciliation, and financial receipts.
---

Never credit a wallet from browser-supplied payment data, mutable exchange-rate reconstruction, or a callback that lacks exact ownership and settlement evidence. Require the persisted intent, verified identity, exact provider/network/recipient/token/amount proof, and a global replay claim.

**Why:** A claimed crypto transfer was previously able to create spendable Trade Market value without authoritative on-chain funds, and loosely coupled provider callbacks could leave balances, fees, or notifications inconsistent.

**How to apply:** Reserve limited deposit capacity before sending users to any payment channel, and preserve that reservation through verified settlement. Require explicit chain success and finality, not elapsed time. Finalize money movement, ledger entries, fee allocation, deposit status, replay claims, and durable receipt events in one database transaction. Treat unavailable evidence as pending or manual review, never as success. Delivery retries must never repeat financial writes.

Provider status values must be normalized according to the provider contract before comparison; casing differences such as `Success` versus `success` must not strand a payment. Admin recovery actions should re-query the provider and verify the persisted reference and exact expected amount, never bypass proof with a force-credit button. A provider-confirmed recovery from rejected/manual-review state remains replay-protected and audited.