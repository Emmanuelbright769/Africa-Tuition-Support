import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  IN: { code: "INR", symbol: "₹",    name: "Rupee" },
  CN: { code: "CNY", symbol: "¥",    name: "Yuan" },
  JP: { code: "JPY", symbol: "¥",    name: "Yen" },
  KR: { code: "KRW", symbol: "₩",    name: "Won" },
  AE: { code: "AED", symbol: "د.إ",  name: "Dirham" },
  SA: { code: "SAR", symbol: "﷼",    name: "Riyal" },
  QA: { code: "QAR", symbol: "﷼",    name: "Riyal" },
  BR: { code: "BRL", symbol: "R$",   name: "Real" },
  MX: { code: "MXN", symbol: "MX$",  name: "Peso" },
  ZA: { code: "ZAR", symbol: "R",    name: "Rand" },
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

type LocalCurrencyContextType = {
  currency: LocalCurrency | null;
  loading: boolean;
  permissionDenied: boolean;
  requestPermission: () => void;
  formatAmount: (usd: number | string) => string;
  rateLabel: () => string;
};

const LocalCurrencyContext = createContext<LocalCurrencyContextType>({
  currency: null,
  loading: false,
  permissionDenied: false,
  requestPermission: () => {},
  formatAmount: (usd) => `$${parseFloat(String(usd)).toFixed(2)}`,
  rateLabel: () => "",
});

async function resolveCountryCode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  );
  const data = await res.json();
  return (data.countryCode as string) ?? "NG";
}

async function fetchRate(currencyCode: string): Promise<number> {
  if (currencyCode === "USD") return 1;
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  const data = await res.json();
  return (data.rates?.[currencyCode] as number) ?? 1;
}

const CACHE_KEY = "tsia_local_currency_v2";

function loadCache(): LocalCurrency | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalCurrency;
  } catch {
    return null;
  }
}

function saveCache(c: LocalCurrency) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

export function LocalCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<LocalCurrency | null>(loadCache);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const detect = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const countryCode = await resolveCountryCode(pos.coords.latitude, pos.coords.longitude);
          const info = COUNTRY_CURRENCY[countryCode] ?? { code: "USD", symbol: "$", name: "Dollar" };
          const rate = await fetchRate(info.code);
          const result: LocalCurrency = { ...info, rate, countryCode };
          setCurrency(result);
          saveCache(result);
        } catch {
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setPermissionDenied(true);
        }
      },
      { timeout: 10000, maximumAge: 3600000 }
    );
  };

  useEffect(() => {
    if (!currency) detect();
  }, []);

  const formatAmount = (usd: number | string): string => {
    const amount = typeof usd === "string" ? parseFloat(usd) : usd;
    if (isNaN(amount)) return currency ? `${currency.symbol}0` : "₦0";
    if (!currency) {
      return `₦${Math.round(amount * 1600).toLocaleString("en-NG")}`;
    }
    const converted = amount * currency.rate;
    const decimals = currency.code === "JPY" || currency.code === "KRW" || currency.code === "VND" || currency.code === "IDR" ? 0 : 0;
    return `${currency.symbol}${Math.round(converted).toLocaleString()}`;
  };

  const rateLabel = (): string => {
    if (!currency) return "at ₦1,600/$1";
    if (currency.code === "USD") return "";
    const rounded = Math.round(currency.rate);
    return `at ${currency.symbol}${rounded.toLocaleString()}/$1`;
  };

  return (
    <LocalCurrencyContext.Provider value={{ currency, loading, permissionDenied, requestPermission: detect, formatAmount, rateLabel }}>
      {children}
    </LocalCurrencyContext.Provider>
  );
}

export function useLocalCurrency() {
  return useContext(LocalCurrencyContext);
}
