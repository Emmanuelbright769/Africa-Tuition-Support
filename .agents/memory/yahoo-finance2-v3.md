---
name: yahoo-finance2 v3 setup
description: Correct instantiation pattern for yahoo-finance2 v3 in Node 20, esbuild CJS interop quirk, and JSE price currency quirk
---

## Rule
In yahoo-finance2 v3, the default export is a class constructor. You must instantiate it.
**But esbuild CJS bundle interop breaks the simple pattern** — use this robust form:

```typescript
import YahooFinanceLib from "yahoo-finance2";
const _YFRaw: any = YahooFinanceLib;
// In dev (tsx): _YFRaw is the class directly
// In prod (esbuild CJS bundle): esbuild __toESM forces default=module, so class is at .default
const _YFClass: any = typeof _YFRaw === "function" ? _YFRaw : _YFRaw?.default ?? _YFRaw;
const yahooFinance = new _YFClass({ suppressNotices: ["yahooSurvey"] });
```

**Why the interop issue happens:** esbuild's `__toESM(require("yahoo-finance2"), 1)` passes flag `1`
(Node interop) which forces `default = module` regardless of `__esModule`. So in the bundle,
`import default` = the whole module object, not the class. The class lives at `.default.default`.
The `typeof === "function"` guard handles both environments without branching on NODE_ENV.

**Why:** Package broke its API in v3 (installed v3.15.3). Node 20 also triggers an unsupported-runtime
warning but works fine.

## Chart response shape
In v3, `chart()` returns `{ meta, quotes }`; each quote contains `date`, OHLC, and volume. The older raw Yahoo `timestamp` and `indicators.quote[0]` shape is not the primary SDK result.

**Why:** Parsing only the raw response shape silently produced an empty candlestick chart even though the provider returned valid data.

**How to apply:** Read `chart.quotes` first and optionally retain raw-shape parsing only for compatibility. Continue rejecting invalid OHLC rows rather than generating synthetic candles.

## JSE Stock Currency
Yahoo Finance returns JSE stocks (e.g. NPN.JO, SBK.JO, MTN.JO) with currency "ZAc" (South African cents).
To convert to USD: `(price / 100) * fx.ZAR`.

## Confirmed working African symbols (Yahoo Finance)
- JSE: NPN.JO, SBK.JO, MTN.JO, VOD.JO, ABG.JO, FSR.JO, DSY.JO, AGL.JO
- LSE: AAF.L (Airtel Africa) — NOT AIR.L
- NGX (.LG suffix) and NSE Kenya (.NR suffix) are NOT reliably supported by Yahoo Finance

**How to apply:** Any future addition of African stocks to the exchange catalogue must use JSE or LSE-listed symbols.
