import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";

const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  NG: { code: "NGN", symbol: "₦",    name: "Naira" },
  GH: { code: "GHS", symbol: "₵",    name: "Cedi" },
  KE: { code: "KES", symbol: "KSh",  name: "Shilling" },
  ZA: { code: "ZAR", symbol: "R",    name: "Rand" },
  UG: { code: "UGX", symbol: "USh",  name: "Shilling" },
  TZ: { code: "TZS", symbol: "TSh",  name: "Shilling" },
  ET: { code: "ETB", symbol: "Br",   name: "Birr" },
  CM: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  SN: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  CI: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  BJ: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  BF: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  ML: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  NE: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  TG: { code: "XOF", symbol: "FCFA", name: "CFA Franc" },
  TD: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  GA: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  CG: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  CF: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  GQ: { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
  RW: { code: "RWF", symbol: "RF",   name: "Franc" },
  ZM: { code: "ZMW", symbol: "K",    name: "Kwacha" },
  MW: { code: "MWK", symbol: "MK",   name: "Kwacha" },
  ZW: { code: "ZWL", symbol: "Z$",   name: "Dollar" },
  EG: { code: "EGP", symbol: "E£",   name: "Pound" },
  MA: { code: "MAD", symbol: "DH",   name: "Dirham" },
  TN: { code: "TND", symbol: "DT",   name: "Dinar" },
  DZ: { code: "DZD", symbol: "DA",   name: "Dinar" },
  LY: { code: "LYD", symbol: "LD",   name: "Dinar" },
  AO: { code: "AOA", symbol: "Kz",   name: "Kwanza" },
  MZ: { code: "MZN", symbol: "MT",   name: "Metical" },
  SD: { code: "SDG", symbol: "SDG",  name: "Pound" },
  CD: { code: "CDF", symbol: "FC",   name: "Franc" },
  SO: { code: "SOS", symbol: "Sh",   name: "Shilling" },
  ER: { code: "ERN", symbol: "Nfk",  name: "Nakfa" },
  DJ: { code: "DJF", symbol: "Fdj",  name: "Franc" },
  MG: { code: "MGA", symbol: "Ar",   name: "Ariary" },
  MU: { code: "MUR", symbol: "₨",    name: "Rupee" },
  SC: { code: "SCR", symbol: "₨",    name: "Rupee" },
  CV: { code: "CVE", symbol: "Esc",  name: "Escudo" },
  SL: { code: "SLL", symbol: "Le",   name: "Leone" },
  LR: { code: "LRD", symbol: "L$",   name: "Dollar" },
  GN: { code: "GNF", symbol: "FG",   name: "Franc" },
  GM: { code: "GMD", symbol: "D",    name: "Dalasi" },
  MR: { code: "MRU", symbol: "UM",   name: "Ouguiya" },
  NA: { code: "NAD", symbol: "N$",   name: "Dollar" },
  BW: { code: "BWP", symbol: "P",    name: "Pula" },
  SZ: { code: "SZL", symbol: "L",    name: "Lilangeni" },
  LS: { code: "LSL", symbol: "L",    name: "Loti" },
  SS: { code: "SSP", symbol: "£",    name: "Pound" },
  GB: { code: "GBP", symbol: "£",    name: "Pound" },
  US: { code: "USD", symbol: "$",    name: "Dollar" },
  CA: { code: "CAD", symbol: "C$",   name: "Dollar" },
  AU: { code: "AUD", symbol: "A$",   name: "Dollar" },
  NZ: { code: "NZD", symbol: "NZ$",  name: "Dollar" },
  DE: { code: "EUR", symbol: "€",    name: "Euro" },
  FR: { code: "EUR", symbol: "€",    name: "Euro" },
  IT: { code: "EUR", symbol: "€",    name: "Euro" },
  ES: { code: "EUR", symbol: "€",    name: "Euro" },
  NL: { code: "EUR", symbol: "€",    name: "Euro" },
  BE: { code: "EUR", symbol: "€",    name: "Euro" },
  PT: { code: "EUR", symbol: "€",    name: "Euro" },
  IE: { code: "EUR", symbol: "€",    name: "Euro" },
  AT: { code: "EUR", symbol: "€",    name: "Euro" },
  FI: { code: "EUR", symbol: "€",    name: "Euro" },
  GR: { code: "EUR", symbol: "€",    name: "Euro" },
  IN: { code: "INR", symbol: "₹",    name: "Rupee" },
  CN: { code: "CNY", symbol: "¥",    name: "Yuan" },
  JP: { code: "JPY", symbol: "¥",    name: "Yen" },
  KR: { code: "KRW", symbol: "₩",    name: "Won" },
  AE: { code: "AED", symbol: "د.إ",  name: "Dirham" },
  SA: { code: "SAR", symbol: "﷼",    name: "Riyal" },
  QA: { code: "QAR", symbol: "﷼",    name: "Riyal" },
  BR: { code: "BRL", symbol: "R$",   name: "Real" },
  MX: { code: "MXN", symbol: "MX$",  name: "Peso" },
  PK: { code: "PKR", symbol: "₨",    name: "Rupee" },
  BD: { code: "BDT", symbol: "৳",    name: "Taka" },
  SG: { code: "SGD", symbol: "S$",   name: "Dollar" },
  MY: { code: "MYR", symbol: "RM",   name: "Ringgit" },
  ID: { code: "IDR", symbol: "Rp",   name: "Rupiah" },
  TH: { code: "THB", symbol: "฿",    name: "Baht" },
  PH: { code: "PHP", symbol: "₱",    name: "Peso" },
  VN: { code: "VND", symbol: "₫",    name: "Dong" },
};

export type LocalCurrency = {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  countryCode: string;
};

export const VAT_RATE = 0.075; // Nigeria 7.5% VAT on fintech transactions

type LocalCurrencyContextType = {
  currency: LocalCurrency | null;
  loading: boolean;
  permissionDenied: boolean;
  requestPermission: () => void;
  formatAmount: (usd: number | string) => string;
  formatAmountVAT: (usd: number | string) => string;
  rateLabel: () => string;
  rateLabelVAT: () => string;
};

const NGN_RATE = 1480;
const CACHE_KEY = "tsia_local_currency_v3";

const LocalCurrencyContext = createContext<LocalCurrencyContextType>({
  currency: null,
  loading: false,
  permissionDenied: false,
  requestPermission: () => {},
  formatAmount: (usd) => `₦${Math.round(parseFloat(String(usd)) * NGN_RATE).toLocaleString("en-NG")}`,
  formatAmountVAT: (usd) => `₦${Math.round(parseFloat(String(usd)) * NGN_RATE * (1 + VAT_RATE)).toLocaleString("en-NG")}`,
  rateLabel: () => `at ₦${NGN_RATE}/$1`,
  rateLabelVAT: () => `at ₦${Math.round(NGN_RATE * (1 + VAT_RATE))}/$1 incl. 7.5% VAT`,
});
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — picks up location changes quickly

interface CacheEntry {
  currency: LocalCurrency;
  savedAt: number;
}

function loadCache(): LocalCurrency | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null; // expired
    return entry.currency;
  } catch {
    return null;
  }
}

function saveCache(c: LocalCurrency) {
  try {
    const entry: CacheEntry = { currency: c, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

async function fetchRate(currencyCode: string): Promise<number> {
  if (currencyCode === "USD") return 1;
  if (currencyCode === "NGN") {
    try {
      const res = await fetch("/api/exchange-rates", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        return typeof data.buying === "number" ? data.buying : NGN_RATE;
      }
    } catch {}
    return NGN_RATE;
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    return (data.rates?.[currencyCode] as number) ?? 1;
  } catch {
    return 1;
  }
}

/** Detect country via IP — fully automatic, no browser permission required */
async function detectCountryByIP(): Promise<string> {
  // Primary: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.country_code && typeof data.country_code === "string") {
      return data.country_code;
    }
  } catch {}

  // Fallback: ip-api.com
  try {
    const res = await fetch("http://ip-api.com/json/?fields=countryCode", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.countryCode && typeof data.countryCode === "string") {
      return data.countryCode;
    }
  } catch {}

  return "NG"; // default to Nigeria if all detection fails
}

export function LocalCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<LocalCurrency | null>(loadCache);
  const [loading, setLoading] = useState(!loadCache()); // loading only if no valid cache
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detect = async () => {
    setLoading(true);
    try {
      const countryCode = await detectCountryByIP();
      const info = COUNTRY_CURRENCY[countryCode] ?? { code: "USD", symbol: "$", name: "Dollar" };
      const rate = await fetchRate(info.code);
      const result: LocalCurrency = { ...info, rate, countryCode };
      setCurrency(result);
      saveCache(result);
    } catch {
      // keep existing currency on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Always detect on mount (cache TTL already handles freshness)
    detect();

    // Re-detect every 30 minutes while the app is open, catching location changes
    timerRef.current = setInterval(detect, CACHE_TTL_MS);

    // Also re-detect when the tab regains focus (user switched networks/locations)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const cached = loadCache();
        if (!cached) detect(); // cache expired while tab was hidden
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const formatAmount = (usd: number | string): string => {
    const amount = typeof usd === "string" ? parseFloat(usd) : usd;
    if (isNaN(amount)) return currency ? `${currency.symbol}0` : "₦0";
    if (!currency) {
      return `₦${Math.round(amount * NGN_RATE).toLocaleString("en-NG")}`;
    }
    const converted = amount * currency.rate;
    return `${currency.symbol}${Math.round(converted).toLocaleString()}`;
  };

  const rateLabel = (): string => {
    if (!currency) return `at ₦${NGN_RATE.toLocaleString()}/$1`;
    if (currency.code === "USD") return "";
    const rounded = Math.round(currency.rate);
    return `at ${currency.symbol}${rounded.toLocaleString()}/$1`;
  };

  const formatAmountVAT = (usd: number | string): string => {
    const amount = typeof usd === "string" ? parseFloat(usd) : usd;
    if (isNaN(amount)) return currency ? `${currency.symbol}0` : "₦0";
    const rate = currency ? currency.rate : NGN_RATE;
    const sym = currency?.symbol ?? "₦";
    const converted = amount * rate * (1 + VAT_RATE);
    return `${sym}${Math.round(converted).toLocaleString()}`;
  };

  const rateLabelVAT = (): string => {
    if (!currency) return `at ₦${Math.round(NGN_RATE * (1 + VAT_RATE)).toLocaleString()}/$1 incl. 7.5% VAT`;
    if (currency.code === "USD") return "";
    const rounded = Math.round(currency.rate * (1 + VAT_RATE));
    return `at ${currency.symbol}${rounded.toLocaleString()}/$1 incl. 7.5% VAT`;
  };

  return (
    <LocalCurrencyContext.Provider value={{
      currency,
      loading,
      permissionDenied: false,
      requestPermission: detect,
      formatAmount,
      formatAmountVAT,
      rateLabel,
      rateLabelVAT,
    }}>
      {children}
    </LocalCurrencyContext.Provider>
  );
}

export function useLocalCurrency() {
  return useContext(LocalCurrencyContext);
}
