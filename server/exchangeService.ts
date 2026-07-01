// yahoo-finance2 v3: must be instantiated with `new`.
// esbuild CJS bundle interop wraps the module so `import default` becomes the module
// object (not the class). In dev/tsx it's the class directly.
// We detect which case we're in and unwrap as needed.
import YahooFinanceLib from "yahoo-finance2";
const _YFRaw: any = YahooFinanceLib;
const _YFClass: any = typeof _YFRaw === "function" ? _YFRaw : _YFRaw?.default ?? _YFRaw;
const yahooFinance = new _YFClass({ suppressNotices: ["yahooSurvey"] });

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
  logoUrl: string;
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
  { ticker: "NPN", yfSymbol: "NPN.JO", name: "Naspers", sector: "Tech/Media", exchange: "JSE", region: "african", currency: "ZAc", color: "#16a085",
    logoUrl: "https://logo.clearbit.com/naspers.com",
    description: "South Africa's largest company and a global technology investment holding group with stakes in Tencent." },
  { ticker: "STANBK", yfSymbol: "SBK.JO", name: "Standard Bank", sector: "Finance", exchange: "JSE", region: "african", currency: "ZAc", color: "#1a5276",
    logoUrl: "https://logo.clearbit.com/standardbank.com",
    description: "Africa's largest bank by assets, with operations in 20 countries across the continent." },
  { ticker: "MTN", yfSymbol: "MTN.JO", name: "MTN Group", sector: "Telecom", exchange: "JSE", region: "african", currency: "ZAc", color: "#f39c12",
    logoUrl: "https://logo.clearbit.com/mtn.com",
    description: "Pan-African telecom giant operating in 19 African and Middle Eastern markets with 290M+ subscribers." },
  { ticker: "AIRTEL", yfSymbol: "AAF.L", name: "Airtel Africa", sector: "Telecom", exchange: "LSE", region: "african", currency: "GBp", color: "#c0392b",
    logoUrl: "https://logo.clearbit.com/airtelafrica.com",
    description: "One of Africa's leading providers of mobile communications and mobile money services across 14 countries." },
  { ticker: "VODACOM", yfSymbol: "VOD.JO", name: "Vodacom Group", sector: "Telecom", exchange: "JSE", region: "african", currency: "ZAc", color: "#e40000",
    logoUrl: "https://logo.clearbit.com/vodacom.com",
    description: "South Africa's largest mobile operator, with operations across 7 African countries including Tanzania and Mozambique." },
  { ticker: "ABSA", yfSymbol: "ABG.JO", name: "Absa Group", sector: "Finance", exchange: "JSE", region: "african", currency: "ZAc", color: "#e74c3c",
    logoUrl: "https://logo.clearbit.com/absa.co.za",
    description: "Leading pan-African banking and financial services group with presence in 12 African countries." },
  { ticker: "FIRSTRAND", yfSymbol: "FSR.JO", name: "FirstRand Group", sector: "Finance", exchange: "JSE", region: "african", currency: "ZAc", color: "#2980b9",
    logoUrl: "https://logo.clearbit.com/firstrand.co.za",
    description: "South Africa's largest financial services group, home to FNB, Rand Merchant Bank, and WesBank." },
  { ticker: "DISCOVERY", yfSymbol: "DSY.JO", name: "Discovery Ltd", sector: "Insurance", exchange: "JSE", region: "african", currency: "ZAc", color: "#27ae60",
    logoUrl: "https://logo.clearbit.com/discovery.co.za",
    description: "Innovative South African financial services company pioneering the Vitality shared-value insurance model." },
  { ticker: "ANGLOGLD", yfSymbol: "AGL.JO", name: "Anglo American", sector: "Mining", exchange: "JSE", region: "african", currency: "ZAc", color: "#8e44ad",
    logoUrl: "https://logo.clearbit.com/angloamerican.com",
    description: "Global diversified mining company with major operations across southern Africa producing diamonds, platinum and iron ore." },
  { ticker: "SASOL", yfSymbol: "SOL.JO", name: "Sasol Ltd", sector: "Energy/Chemicals", exchange: "JSE", region: "african", currency: "ZAc", color: "#e67e22",
    logoUrl: "https://logo.clearbit.com/sasol.com",
    description: "South Africa's integrated energy and chemical company, one of the continent's largest fuel producers." },
  { ticker: "OLDMUT", yfSymbol: "OML.JO", name: "Old Mutual Ltd", sector: "Finance", exchange: "JSE", region: "african", currency: "ZAc", color: "#1abc9c",
    logoUrl: "https://logo.clearbit.com/oldmutual.com",
    description: "Pan-African investment, savings and insurance group serving customers across 14 African countries." },
  { ticker: "BIDVEST", yfSymbol: "BVT.JO", name: "Bidvest Group", sector: "Services", exchange: "JSE", region: "african", currency: "ZAc", color: "#c0392b",
    logoUrl: "https://logo.clearbit.com/bidvest.com",
    description: "South Africa's diversified services group operating in freight, facilities management, and financial services." },

  // ── US ────────────────────────────────────────────────────────────────────────
  { ticker: "AAPL", yfSymbol: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", region: "us", currency: "USD", color: "#555555",
    logoUrl: "https://logo.clearbit.com/apple.com",
    description: "The world's most valuable company, known for the iPhone, Mac, and its growing services ecosystem." },
  { ticker: "NVDA", yfSymbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", exchange: "NASDAQ", region: "us", currency: "USD", color: "#76b900",
    logoUrl: "https://logo.clearbit.com/nvidia.com",
    description: "World leader in AI computing hardware, GPUs, and deep learning platforms." },
  { ticker: "TSLA", yfSymbol: "TSLA", name: "Tesla Inc.", sector: "Auto/Energy", exchange: "NASDAQ", region: "us", currency: "USD", color: "#cc0000",
    logoUrl: "https://logo.clearbit.com/tesla.com",
    description: "Electric vehicle and clean energy pioneer, also developing robotics and AI." },
  { ticker: "GOOGL", yfSymbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", exchange: "NASDAQ", region: "us", currency: "USD", color: "#4285f4",
    logoUrl: "https://logo.clearbit.com/google.com",
    description: "Parent company of Google, the world's dominant search engine and digital advertising platform." },
  { ticker: "META", yfSymbol: "META", name: "Meta Platforms", sector: "Technology", exchange: "NASDAQ", region: "us", currency: "USD", color: "#0866ff",
    logoUrl: "https://logo.clearbit.com/meta.com",
    description: "Operates Facebook, Instagram, WhatsApp, and is investing heavily in the metaverse." },
  { ticker: "MSFT", yfSymbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", exchange: "NASDAQ", region: "us", currency: "USD", color: "#00a4ef",
    logoUrl: "https://logo.clearbit.com/microsoft.com",
    description: "Enterprise software giant and cloud computing leader through its Azure platform." },
  { ticker: "AMZN", yfSymbol: "AMZN", name: "Amazon.com", sector: "Retail/Cloud", exchange: "NASDAQ", region: "us", currency: "USD", color: "#ff9900",
    logoUrl: "https://logo.clearbit.com/amazon.com",
    description: "The world's largest e-commerce marketplace and cloud infrastructure provider (AWS)." },
  { ticker: "JPM", yfSymbol: "JPM", name: "JPMorgan Chase", sector: "Finance", exchange: "NYSE", region: "us", currency: "USD", color: "#1a5276",
    logoUrl: "https://logo.clearbit.com/jpmorganchase.com",
    description: "Largest US bank by assets, offering investment, retail, and commercial banking services." },
  { ticker: "NFLX", yfSymbol: "NFLX", name: "Netflix Inc.", sector: "Media/Tech", exchange: "NASDAQ", region: "us", currency: "USD", color: "#e50914",
    logoUrl: "https://logo.clearbit.com/netflix.com",
    description: "World's leading streaming entertainment service with 270M+ subscribers across 190 countries." },
  { ticker: "V", yfSymbol: "V", name: "Visa Inc.", sector: "Finance", exchange: "NYSE", region: "us", currency: "USD", color: "#1a1f71",
    logoUrl: "https://logo.clearbit.com/visa.com",
    description: "World's largest payments technology company, processing billions of transactions annually." },
  { ticker: "MA", yfSymbol: "MA", name: "Mastercard Inc.", sector: "Finance", exchange: "NYSE", region: "us", currency: "USD", color: "#eb001b",
    logoUrl: "https://logo.clearbit.com/mastercard.com",
    description: "Global technology company in the payments industry connecting consumers, banks, and merchants." },
  { ticker: "WMT", yfSymbol: "WMT", name: "Walmart Inc.", sector: "Retail", exchange: "NYSE", region: "us", currency: "USD", color: "#0071ce",
    logoUrl: "https://logo.clearbit.com/walmart.com",
    description: "World's largest retailer by revenue with over 10,500 stores in 24 countries." },
  { ticker: "DIS", yfSymbol: "DIS", name: "Walt Disney Co.", sector: "Media/Entertainment", exchange: "NYSE", region: "us", currency: "USD", color: "#113ccf",
    logoUrl: "https://logo.clearbit.com/disney.com",
    description: "Global entertainment company behind Disney+, Marvel, Star Wars, and iconic theme parks." },
  { ticker: "XOM", yfSymbol: "XOM", name: "ExxonMobil", sector: "Energy", exchange: "NYSE", region: "us", currency: "USD", color: "#c40000",
    logoUrl: "https://logo.clearbit.com/exxonmobil.com",
    description: "One of the world's largest publicly traded oil and gas companies by market capitalization." },

  // ── Global ────────────────────────────────────────────────────────────────────
  { ticker: "SHEL", yfSymbol: "SHEL", name: "Shell plc", sector: "Energy", exchange: "NYSE", region: "global", currency: "USD", color: "#d4ac0d",
    logoUrl: "https://logo.clearbit.com/shell.com",
    description: "One of the world's largest integrated oil and gas companies." },
  { ticker: "TSM", yfSymbol: "TSM", name: "TSMC", sector: "Semiconductor", exchange: "NYSE", region: "global", currency: "USD", color: "#0077c8",
    logoUrl: "https://logo.clearbit.com/tsmc.com",
    description: "World's largest semiconductor foundry, manufacturing chips for Apple, NVIDIA, and others." },
  { ticker: "BABA", yfSymbol: "BABA", name: "Alibaba Group", sector: "Retail/Cloud", exchange: "NYSE", region: "global", currency: "USD", color: "#ff6900",
    logoUrl: "https://logo.clearbit.com/alibaba.com",
    description: "China's largest e-commerce and cloud computing conglomerate." },
  { ticker: "SAP", yfSymbol: "SAP", name: "SAP SE", sector: "Software", exchange: "NYSE", region: "global", currency: "USD", color: "#008fdf",
    logoUrl: "https://logo.clearbit.com/sap.com",
    description: "World's leading enterprise application software provider for business operations." },
  { ticker: "ASML", yfSymbol: "ASML", name: "ASML Holding", sector: "Semiconductor", exchange: "NASDAQ", region: "global", currency: "USD", color: "#0071b5",
    logoUrl: "https://logo.clearbit.com/asml.com",
    description: "Dutch company that makes the extreme ultraviolet lithography machines essential for producing advanced chips." },
  { ticker: "NVO", yfSymbol: "NVO", name: "Novo Nordisk", sector: "Healthcare", exchange: "NYSE", region: "global", currency: "USD", color: "#005ad2",
    logoUrl: "https://logo.clearbit.com/novonordisk.com",
    description: "World's largest diabetes care company and producer of the blockbuster weight-loss drug Ozempic." },
  { ticker: "TM", yfSymbol: "TM", name: "Toyota Motor", sector: "Automotive", exchange: "NYSE", region: "global", currency: "USD", color: "#eb0a1e",
    logoUrl: "https://logo.clearbit.com/toyota.com",
    description: "World's largest automaker by production volume, leading in hybrid and hydrogen vehicle technology." },
  { ticker: "LVMUY", yfSymbol: "LVMUY", name: "LVMH", sector: "Luxury Goods", exchange: "OTC", region: "global", currency: "USD", color: "#2c2c2c",
    logoUrl: "https://logo.clearbit.com/lvmh.com",
    description: "World's largest luxury goods conglomerate owning Louis Vuitton, Moët, Hennessy, Dior, and 75+ brands." },
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
