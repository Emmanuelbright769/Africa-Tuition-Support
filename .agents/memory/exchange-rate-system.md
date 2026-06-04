---
name: Exchange Rate System
description: How multi-currency exchange rates are stored, served, and displayed in TSIA.
---

## Storage pattern
Each currency pair stored as two platform_settings keys:
- `{code}_ngn_buying_rate`  (e.g. `gbp_ngn_buying_rate`)
- `{code}_ngn_selling_rate`

Codes: `usd`, `gbp`, `eur`, `cad`, `aud`, `ghs`, `kes`, `zar`

## Server helpers (server/routes.ts, near top)
- `RATE_CURRENCIES` — array of 8 currency codes
- `RATE_DEFAULTS_BUY` / `RATE_DEFAULTS_SELL` — fallback rates if DB key missing
- `getAllRates()` — async, reads all 8 pairs, 5-min in-memory cache
- `invalidateAllRatesCache()` — clears both `_allRatesCache` AND `_usdNgnRatesCache`

## Endpoints
- `GET /api/exchange-rates` — public; returns `{ buying, selling, currencies, updatedAt }`
  - `buying`/`selling` = USD rates (backward-compat)
  - `currencies` = Record<code, { buying, selling }>
- `PUT /api/admin/exchange-rates` — admin only; body = Record<code, { buying, selling }>
- `GET /api/admin/platform-settings` — now includes `exchangeRates.currencies`

**Why:** Rates endpoint is separate from PUT /api/admin/platform-settings to avoid
accidentally overwriting plan settings when only saving exchange rates.

## Frontend constants (module-level, not inside component)
- `RATE_CURRENCIES_META` in FinancialHub.tsx — flag, label, symbol, defaults
- `MULTI_RATE_CURRENCIES` in AdminDashboard.tsx — same shape

## FinancialHub state
- `exchangeRatesData` from `useQuery(["/api/exchange-rates"])`, staleTime 5 min
- `view === "rates"` — full forex board screen
- Home screen has a preview banner card (USD + GBP) tapping to the rates board

## AdminDashboard state
- `multiRates: Record<string, { buying: string; selling: string }>` state
- `saveMultiRatesMutation` calls `PUT /api/admin/exchange-rates`
- useEffect auto-populates `multiRates` from `platformSettingsData.exchangeRates.currencies`
