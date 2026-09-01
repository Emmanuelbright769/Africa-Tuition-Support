---
name: Trading chart integrity
description: Rules for market data shown in Itera BOT and Manual Trading charts.
---

Charts presented as live must contain only real OHLC candles from an allowlisted market-data provider. If data is unavailable, show an explicit unavailable or stale state rather than generated candles.

**Why:** Synthetic fallback candles looked live but were static and misleading to users making trading decisions.

**How to apply:** Keep chart symbols and intervals server-allowlisted, poll/cache real provider data, and keep all trade entry and settlement prices server-authoritative.