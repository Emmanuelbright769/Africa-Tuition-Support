---
name: yahoo-finance2 v3 setup
description: Correct instantiation pattern for yahoo-finance2 v3 in Node 20, and JSE price currency quirk
---

## Rule
In yahoo-finance2 v3, the default export is a class constructor. You must instantiate it:

```typescript
import YahooFinanceLib from "yahoo-finance2";
const yahooFinance = new (YahooFinanceLib as any)({ suppressNotices: ["yahooSurvey"] });
// Then: yahooFinance.quote(...), yahooFinance.historical(...)
```

The old pattern `import yahooFinance from 'yahoo-finance2'; yahooFinance.quote(...)` fails with:
"Call `const yahooFinance = new YahooFinance()` first."

**Why:** Package broke its API in v3 (installed v3.15.3). Node 20 also triggers an unsupported-runtime warning but works fine.

## JSE Stock Currency
Yahoo Finance returns JSE stocks (e.g. NPN.JO, SBK.JO, MTN.JO) with currency "ZAc" (South African cents).
To convert to USD: `(price / 100) * fx.ZAR`.

## Confirmed working African symbols (Yahoo Finance)
- JSE: NPN.JO, SBK.JO, MTN.JO, VOD.JO, ABG.JO, FSR.JO, DSY.JO, AGL.JO
- LSE: AAF.L (Airtel Africa) — NOT AIR.L
- NGX (.LG suffix) and NSE Kenya (.NR suffix) are NOT reliably supported by Yahoo Finance

**How to apply:** Any future addition of African stocks to the exchange catalogue must use JSE or LSE-listed symbols.
