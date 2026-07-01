// yahoo-finance2 v3: must be instantiated with `new`
import YahooFinanceLib from "yahoo-finance2";
const yahooFinance = new (YahooFinanceLib as any)({ suppressNotices: ["yahooSurvey"] });

// ─── Stock catalogue ──────────────────────────────────────────────────────────
export interface StockInfo {
  ticker: string;
  yfSymbol: string;
  name: string;
  sector: string;
  exchange: string;
  region: "african" | "us" | "global";
  currency: string;
  color: string;
  description: string;
}

export interface StockQuote extends StockInfo {
  price: number;
  priceNative: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: string;
  marketCap: string;
  lastUpdated: number;
}

export const STOCK_CATALOGUE: StockInfo[] = [
  // ── African (JSE/LSE listed — confirmed Yahoo Finance coverage) ───────────────
  { ticker: "NPN",      yfSymbol: "NPN.JO",  name: "Naspers",          sector: "Tech/Media",   exchange: "JSE",    region: "african", currency: "ZAc", color: "#16a085",
    description: "South Africa's largest company and a global technology investment holding group with stakes in Tencent." },
  { ticker: "STANBK",   yfSymbol: "SBK.JO",  name: "Standard Bank",    sector: "Finance",      exchange: "JSE",    region: "african", currency: "ZAc", color: "#1a5276",
    description: "Africa's largest bank by assets, with operations in 20 countries across the continent." },
  { ticker: "MTN",      yfSymbol: "MTN.JO",  name: "MTN Group",        sector: "Telecom",      exchange: "JSE",    region: "african", currency: "ZAc", color: "#f39c12",
    description: "Pan-African telecom giant operating in 19 African and Middle Eastern markets with 290M+ subscribers." },
  { ticker: "AIRTEL",   yfSymbol: "AAF.L",   name: "Airtel Africa",    sector: "Telecom",      exchange: "LSE",    region: "african", currency: "GBp", color: "#c0392b",
    description: "One of Africa's leading providers of mobile communications and mobile money services across 14 countries." },
  { ticker: "VODACOM",  yfSymbol: "VOD.JO",  name: "Vodacom Group",    sector: "Telecom",      exchange: "JSE",    region: "african", currency: "ZAc", color: "#e40000",
    description: "South Africa's largest mobile operator, with operations across 7 African countries including Tanzania and Mozambique." },
  { ticker: "ABSA",     yfSymbol: "ABG.JO",  name: "Absa Group",       sector: "Finance",      exchange: "JSE",    region: "african", currency: "ZAc", color: "#e74c3c",
    description: "Leading pan-African banking and financial services group with presence in 12 African countries." },
  { ticker: "FIRSTRAND",yfSymbol: "FSR.JO",  name: "FirstRand Group",  sector: "Finance",      exchange: "JSE",    region: "african", currency: "ZAc", color: "#2980b9",
    description: "South Africa's largest financial services group, home to FNB, Rand Merchant Bank, and WesBank." },
  { ticker: "DISCOVERY",yfSymbol: "DSY.JO",  name: "Discovery Ltd",    sector: "Insurance",    exchange: "JSE",    region: "african", currency: "ZAc", color: "#27ae60",
    description: "Innovative South African financial services company pioneering the Vitality shared-value insurance model." },
  { ticker: "ANGLOGLD", yfSymbol: "AGL.JO",  name: "Anglo American",   sector: "Mining",       exchange: "JSE",    region: "african", currency: "ZAc", color: "#8e44ad",
    description: "Global diversified mining company with major operations across southern Africa producing diamonds, platinum and iron ore." },
  // ── US ───────────────────────────────────────────────────────────────────────
  { ticker: "AAPL",     yfSymbol: "AAPL",       name: "Apple Inc.",       sector: "Technology",   exchange: "NASDAQ", region: "us",      currency: "USD", color: "#6c7a89",
    description: "The world's most valuable company, known for the iPhone, Mac, and its growing services ecosystem." },
  { ticker: "NVDA",     yfSymbol: "NVDA",       name: "NVIDIA Corp.",     sector: "Technology",   exchange: "NASDAQ", region: "us",      currency: "USD", color: "#76b900",
    description: "World leader in AI computing hardware, GPUs, and deep learning platforms." },
  { ticker: "TSLA",     yfSymbol: "TSLA",       name: "Tesla Inc.",       sector: "Auto/Energy",  exchange: "NASDAQ", region: "us",      currency: "USD", color: "#cc0000",
    description: "Electric vehicle and clean energy pioneer, also developing robotics and AI." },
  { ticker: "GOOGL",    yfSymbol: "GOOGL",      name: "Alphabet Inc.",    sector: "Technology",   exchange: "NASDAQ", region: "us",      currency: "USD", color: "#4285f4",
    description: "Parent company of Google, the world's dominant search engine and digital advertising platform." },
  { ticker: "META",     yfSymbol: "META",       name: "Meta Platforms",   sector: "Technology",   exchange: "NASDAQ", region: "us",      currency: "USD", color: "#0866ff",
    description: "Operates Facebook, Instagram, WhatsApp, and is investing heavily in the metaverse." },
  { ticker: "MSFT",     yfSymbol: "MSFT",       name: "Microsoft Corp.",  sector: "Technology",   exchange: "NASDAQ", region: "us",      currency: "USD", color: "#00a4ef",
    description: "Enterprise software giant and cloud computing leader through its Azure platform." },
  { ticker: "AMZN",     yfSymbol: "AMZN",       name: "Amazon.com",       sector: "Retail/Cloud", exchange: "NASDAQ", region: "us",      currency: "USD", color: "#ff9900",
    description: "The world's largest e-commerce marketplace and cloud infrastructure provider (AWS)." },
  { ticker: "JPM",      yfSymbol: "JPM",        name: "JPMorgan Chase",   sector: "Finance",      exchange: "NYSE",   region: "us",      currency: "USD", color: "#1a5276",
    description: "Largest US bank by assets, offering investment, retail, and commercial banking services." },
  // ── Global ───────────────────────────────────────────────────────────────────
  { ticker: "SHEL",     yfSymbol: "SHEL",       name: "Shell plc",        sector: "Energy",       exchange: "NYSE",   region: "global",  currency: "USD", color: "#d4ac0d",
    description: "One of the world's largest integrated oil and gas companies." },
  { ticker: "TSM",      yfSymbol: "TSM",        name: "TSMC",             sector: "Semiconductor",exchange: "NYSE",   region: "global",  currency: "USD", color: "#0077c8",
    description: "World's largest semiconductor foundry, manufacturing chips for Apple, NVIDIA, and others." },
  { ticker: "BABA",     yfSymbol: "BABA",       name: "Alibaba Group",    sector: "Retail/Cloud", exchange: "NYSE",   region: "global",  currency: "USD", color: "#ff6900",
    description: "China's largest e-commerce and cloud computing conglomerate." },
  { ticker: "SAP",      yfSymbol: "SAP",        name: "SAP SE",           sector: "Software",     exchange: "NYSE",   region: "global",  currency: "USD", color: "#008fdf",
    description: "World's leading enterprise application software provider for business operations." },
];

// ─── FX cache ─────────────────────────────────────────────────────────────────
interface FxRates { NGN: number; KES: number; ZAR: number; GBP: number; }
let fxRates: FxRates | null = null;
let fxFetchedAt = 0;
const FX_TTL = 5 * 60_000;

// Fallback FX rates (updated periodically — used if Yahoo Finance FX fetch fails)
const FX_FALLBACK: FxRates = { NGN: 0.00065, KES: 0.0077, ZAR: 0.054, GBP: 1.27 };

async function getFxRates(): Promise<FxRates> {
  if (fxRates && Date.now() - fxFetchedAt < FX_TTL) return fxRates;
  try {
    const fx = await yahooFinance.quote(["NGNUSD=X", "KESUSD=X", "ZARUSD=X", "GBPUSD=X"], {}, { validateResult: false });
    const m: Record<string, number> = {};
    for (const q of fx) m[q.symbol] = q.regularMarketPrice ?? 0;
    fxRates = {
      NGN: m["NGNUSD=X"] || FX_FALLBACK.NGN,
      KES: m["KESUSD=X"] || FX_FALLBACK.KES,
      ZAR: m["ZARUSD=X"] || FX_FALLBACK.ZAR,
      GBP: m["GBPUSD=X"] || FX_FALLBACK.GBP,
    };
    fxFetchedAt = Date.now();
  } catch {
    if (!fxRates) fxRates = { ...FX_FALLBACK };
  }
  return fxRates!;
}

function toUsd(price: number, currency: string, fx: FxRates): number {
  switch (currency) {
    case "NGN": return price * fx.NGN;
    case "KES": return price * fx.KES;
    case "ZAR": return price * fx.ZAR;
    case "ZAc": return (price / 100) * fx.ZAR;  // South African cents → ZAR → USD
    case "GBp": return (price / 100) * fx.GBP;  // GBX pence → GBP → USD
    case "GBP": return price * fx.GBP;
    default:    return price;
  }
}

function fmtVol(v: number): string {
  if (!v) return "-";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}

function fmtMcap(mc: number | undefined, currency: string, fx: FxRates): string {
  if (!mc) return "-";
  const usd = toUsd(mc, currency, fx);
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9)  return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6)  return `$${(usd / 1e6).toFixed(1)}M`;
  return `$${usd.toFixed(0)}`;
}

// ─── Quote cache ──────────────────────────────────────────────────────────────
interface CachedQuote { data: StockQuote; fetchedAt: number; }
const quoteCache = new Map<string, CachedQuote>();
const QUOTE_TTL = 60_000;

export async function getAllQuotes(): Promise<StockQuote[]> {
  const now = Date.now();
  const stale = STOCK_CATALOGUE.some(s => {
    const c = quoteCache.get(s.ticker);
    return !c || now - c.fetchedAt >= QUOTE_TTL;
  });

  if (!stale) {
    return STOCK_CATALOGUE.map(s => quoteCache.get(s.ticker)!.data);
  }

  const fx = await getFxRates();
  const symbols = STOCK_CATALOGUE.map(s => s.yfSymbol);

  let rawArr: any[] = [];
  try {
    rawArr = await yahooFinance.quote(symbols, {}, { validateResult: false });
    if (!Array.isArray(rawArr)) rawArr = [rawArr];
  } catch (e) {
    console.error("[Exchange] quote fetch failed:", e);
  }

  const rawMap = new Map<string, any>();
  for (const r of rawArr) if (r?.symbol) rawMap.set(r.symbol, r);

  const results: StockQuote[] = STOCK_CATALOGUE.map(stock => {
    const raw = rawMap.get(stock.yfSymbol);
    const cached = quoteCache.get(stock.ticker);

    if (!raw) return cached?.data ?? { ...stock, price: 0, priceNative: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, volume: "-", marketCap: "-", lastUpdated: now };

    const native = {
      price:  raw.regularMarketPrice      ?? 0,
      change: raw.regularMarketChange     ?? 0,
      open:   raw.regularMarketOpen       ?? 0,
      high:   raw.regularMarketDayHigh    ?? 0,
      low:    raw.regularMarketDayLow     ?? 0,
    };

    const quote: StockQuote = {
      ...stock,
      priceNative:   native.price,
      price:         +toUsd(native.price,  stock.currency, fx).toFixed(6),
      change:        +toUsd(native.change, stock.currency, fx).toFixed(6),
      changePercent: raw.regularMarketChangePercent ?? 0,
      open:          +toUsd(native.open,   stock.currency, fx).toFixed(6),
      high:          +toUsd(native.high,   stock.currency, fx).toFixed(6),
      low:           +toUsd(native.low,    stock.currency, fx).toFixed(6),
      volume:        fmtVol(raw.regularMarketVolume ?? 0),
      marketCap:     fmtMcap(raw.marketCap, stock.currency, fx),
      lastUpdated:   now,
    };

    quoteCache.set(stock.ticker, { data: quote, fetchedAt: now });
    return quote;
  });

  return results;
}

export async function getQuote(ticker: string): Promise<StockQuote | null> {
  const stock = STOCK_CATALOGUE.find(s => s.ticker === ticker);
  if (!stock) return null;
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < QUOTE_TTL) return cached.data;
  const all = await getAllQuotes();
  return all.find(q => q.ticker === ticker) ?? null;
}

// ─── History cache ────────────────────────────────────────────────────────────
interface HistoryPoint { t: string; v: number; }
interface CachedHistory { data: HistoryPoint[]; fetchedAt: number; }
const histCache = new Map<string, CachedHistory>();
const HIST_TTL = 5 * 60_000;

type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";

export async function getHistory(ticker: string, range: TimeRange): Promise<HistoryPoint[]> {
  const key = `${ticker}:${range}`;
  const cached = histCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < HIST_TTL) return cached.data;

  const stock = STOCK_CATALOGUE.find(s => s.ticker === ticker);
  if (!stock) return [];

  const now = new Date();
  const period2 = now.toISOString().split("T")[0];
  const p1 = new Date(now);
  let interval: "1d" | "1wk";

  switch (range) {
    case "1D": p1.setDate(now.getDate() - 5);   interval = "1d"; break;
    case "1W": p1.setDate(now.getDate() - 10);  interval = "1d"; break;
    case "1M": p1.setMonth(now.getMonth() - 1); interval = "1d"; break;
    case "3M": p1.setMonth(now.getMonth() - 3); interval = "1d"; break;
    case "1Y": p1.setFullYear(now.getFullYear() - 1); interval = "1wk"; break;
  }
  const period1 = p1.toISOString().split("T")[0];

  const fx = await getFxRates();

  try {
    const hist = await yahooFinance.historical(stock.yfSymbol, { period1, period2, interval });
    const pts = hist.slice(range === "1D" ? -2 : undefined).map(r => ({
      t: new Date(r.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
      v: +toUsd(r.close ?? 0, stock.currency, fx).toFixed(6),
    })).filter(d => d.v > 0);

    if (pts.length === 0) return histCache.get(key)?.data ?? [];
    histCache.set(key, { data: pts, fetchedAt: Date.now() });
    return pts;
  } catch (e) {
    console.error(`[Exchange] history fetch failed for ${ticker}:`, e);
    return histCache.get(key)?.data ?? [];
  }
}

// ─── Currency symbol helper ───────────────────────────────────────────────────
export function currencySymbol(currency: string): string {
  switch (currency) {
    case "NGN": return "₦";
    case "KES": return "KSh";
    case "ZAR": return "R";
    case "ZAc": return "c";  // South African cents
    case "GBp": return "p";
    case "GBP": return "£";
    default:    return "$";
  }
}
