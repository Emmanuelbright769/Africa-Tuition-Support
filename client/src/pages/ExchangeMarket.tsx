import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, TrendingUp, TrendingDown, Send, Download, RefreshCw, ChevronDown, ArrowRight, Zap, Globe, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Currency catalogue ────────────────────────────────────────────────────────
interface Currency {
  code: string;
  name: string;
  flag: string;
  symbol: string;
  color: string;
  usdRate: number; // units of this currency per 1 USD
}

const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar",         flag: "🇺🇸", symbol: "$",  color: "#22c55e", usdRate: 1     },
  { code: "NGN", name: "Nigerian Naira",    flag: "🇳🇬", symbol: "₦",  color: "#16a34a", usdRate: 1480  },
  { code: "GBP", name: "British Pound",     flag: "🇬🇧", symbol: "£",  color: "#7c3aed", usdRate: 0.79  },
  { code: "EUR", name: "Euro",              flag: "🇪🇺", symbol: "€",  color: "#2563eb", usdRate: 0.92  },
  { code: "GHS", name: "Ghanaian Cedi",     flag: "🇬🇭", symbol: "₵",  color: "#dc2626", usdRate: 16.4  },
  { code: "KES", name: "Kenyan Shilling",   flag: "🇰🇪", symbol: "KSh",color: "#ea580c", usdRate: 128   },
  { code: "ZAR", name: "South African Rand",flag: "🇿🇦", symbol: "R",  color: "#0d9488", usdRate: 18.6  },
  { code: "TZS", name: "Tanzanian Shilling",flag: "🇹🇿", symbol: "TSh",color: "#0891b2", usdRate: 2580  },
  { code: "UGX", name: "Ugandan Shilling",  flag: "🇺🇬", symbol: "USh",color: "#9333ea", usdRate: 3780  },
  { code: "RWF", name: "Rwandan Franc",     flag: "🇷🇼", symbol: "RF", color: "#059669", usdRate: 1360  },
  { code: "XOF", name: "CFA Franc (BCEAO)", flag: "🌍",  symbol: "CFA",color: "#d97706", usdRate: 604   },
  { code: "ETB", name: "Ethiopian Birr",    flag: "🇪🇹", symbol: "Br", color: "#7c3aed", usdRate: 122   },
];

// ── Simulated 24h trend data (% change) ──────────────────────────────────────
const TRENDS: Record<string, number> = {
  NGN: -0.34, GHS: +0.28, KES: -0.11, ZAR: +0.63, GBP: +0.19,
  EUR: +0.44, TZS: -0.22, UGX: +0.09, RWF: +0.15, XOF: +0.33, ETB: -0.51,
};

// ── Featured rate pairs on the Rates tab ─────────────────────────────────────
const FEATURED_PAIRS = [
  { from: "USD", to: "NGN" },
  { from: "GBP", to: "NGN" },
  { from: "EUR", to: "NGN" },
  { from: "USD", to: "GHS" },
  { from: "USD", to: "KES" },
  { from: "USD", to: "ZAR" },
  { from: "GBP", to: "USD" },
  { from: "USD", to: "ETB" },
];

function getCurrency(code: string) {
  return CURRENCIES.find(c => c.code === code)!;
}

function calcRate(from: string, to: string) {
  const f = getCurrency(from);
  const t = getCurrency(to);
  return t.usdRate / f.usdRate;
}

function fmtAmount(val: number, decimals = 2) {
  if (val >= 1000) return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals + 2 });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CurrencyCircle({ currency, size = 40 }: { currency: Currency; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0 text-white shadow-md"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${currency.color}cc, ${currency.color})`, fontSize: size * 0.32 }}
    >
      {currency.flag}
    </div>
  );
}

function RateCard({ from, to, onClick }: { from: string; to: string; onClick?: () => void }) {
  const fc = getCurrency(from);
  const tc = getCurrency(to);
  const rate = calcRate(from, to);
  const trend = TRENDS[to] ?? 0;
  const up = trend >= 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <Card className="border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <CurrencyCircle currency={fc} size={34} />
                <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-background" style={{ width: 18, height: 18, background: tc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>
                  {tc.flag}
                </div>
              </div>
              <div className="ml-1">
                <p className="text-xs font-bold text-foreground">{from}/{to}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{fc.name.split(" ")[0]} → {tc.name.split(" ")[0]}</p>
              </div>
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${up ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? "+" : ""}{trend.toFixed(2)}%
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-0.5">1 {fc.symbol} {from} =</p>
            <p className="text-lg font-black text-foreground">{tc.symbol} {fmtAmount(rate)}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Currency Selector Modal ───────────────────────────────────────────────────
function CurrencyPicker({ selected, onChange, exclude, onClose }: {
  selected: string; onChange: (c: string) => void; exclude?: string; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = CURRENCIES.filter(c =>
    c.code !== exclude &&
    (c.code.includes(search.toUpperCase()) || c.name.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl shadow-2xl border border-border/60 p-5"
      style={{ top: 60 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-base">Select Currency</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-semibold">Done</button>
      </div>
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search currency…"
        className="w-full border border-border rounded-2xl px-4 py-3 text-sm bg-muted/30 focus:outline-none focus:border-tsia-green mb-4"
      />
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {filtered.map(c => (
          <button
            key={c.code}
            onClick={() => { onChange(c.code); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/60 transition-colors text-left ${selected === c.code ? "bg-tsia-green/10 border border-tsia-green/30" : ""}`}
          >
            <CurrencyCircle currency={c} size={38} />
            <div className="flex-1">
              <p className="text-sm font-bold">{c.code}</p>
              <p className="text-xs text-muted-foreground">{c.name}</p>
            </div>
            <span className="text-sm font-bold text-muted-foreground">{c.symbol}</span>
            {selected === c.code && <div className="w-2 h-2 rounded-full bg-tsia-green" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = "rates" | "convert" | "about";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ExchangeMarket({ walletBalance = 0 }: { walletBalance?: number }) {
  const [tab, setTab] = useState<Tab>("rates");
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("NGN");
  const [amount, setAmount] = useState("100");
  const [pickerFor, setPickerFor] = useState<"from" | "to" | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Fetch live USD/NGN from platform settings
  const { data: ratesData } = useQuery<any>({ queryKey: ["/api/currency-rates"], staleTime: 5 * 60 * 1000 });

  // Override NGN rate if we have live data
  const currencies = useMemo(() => {
    const liveBuying = ratesData?.USD_TO_NGN_PAYMENT;
    if (!liveBuying) return CURRENCIES;
    return CURRENCIES.map(c => c.code === "NGN" ? { ...c, usdRate: liveBuying } : c);
  }, [ratesData]);

  const fromCurrency = currencies.find(c => c.code === fromCode)!;
  const toCurrency   = currencies.find(c => c.code === toCode)!;

  const liveRate = useMemo(() => {
    const f = currencies.find(c => c.code === fromCode)!;
    const t = currencies.find(c => c.code === toCode)!;
    return t.usdRate / f.usdRate;
  }, [fromCode, toCode, currencies]);

  const converted = useMemo(() => {
    const n = parseFloat(amount.replace(/,/g, "")) || 0;
    return n * liveRate;
  }, [amount, liveRate]);

  const flip = () => {
    setFromCode(toCode);
    setToCode(fromCode);
    setAmount(fmtAmount(converted, 2).replace(/,/g, ""));
  };

  const baseRates = useMemo(() => {
    const base = currencies.find(c => c.code === baseCurrency)!;
    return currencies
      .filter(c => c.code !== baseCurrency)
      .map(c => ({ ...c, rate: c.usdRate / base.usdRate }));
  }, [baseCurrency, currencies]);

  return (
    <div className="space-y-5 relative">

      {/* ── HERO HEADER CARD ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-3xl overflow-hidden shadow-xl" style={{
          background: "linear-gradient(135deg, #0a2e1a 0%, #134d2e 40%, #1a6b3c 100%)"
        }}>
          {/* decorative circles */}
          <div className="relative px-5 pt-6 pb-5 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
            <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="absolute top-4 right-20 w-12 h-12 rounded-full bg-tsia-gold/20" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">TSIA Exchange Market</p>
                  <p className="text-white text-2xl font-black mt-0.5">
                    ${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">
                    ≈ ₦{(walletBalance * (ratesData?.USD_TO_NGN_PAYMENT ?? 1480)).toLocaleString("en-US", { maximumFractionDigits: 0 })} NGN
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white/80" />
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2">
                {[
                  { icon: Send,        label: "Send",    },
                  { icon: Download,    label: "Receive", },
                  { icon: RefreshCw,   label: "Convert", onClick: () => setTab("convert") },
                ].map(({ icon: Icon, label, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all duration-200 active:scale-95"
                  >
                    <Icon className="w-4 h-4 text-white" />
                    <span className="text-[11px] font-bold text-white/80">{label}</span>
                  </button>
                ))}
              </div>

              {/* Live ticker strip */}
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { pair: "USD/NGN", val: (ratesData?.USD_TO_NGN_PAYMENT ?? 1480), trend: TRENDS["NGN"] },
                  { pair: "GBP/NGN", val: ((ratesData?.USD_TO_NGN_PAYMENT ?? 1480) / 0.79), trend: -0.12 },
                  { pair: "USD/GHS", val: 16.4, trend: TRENDS["GHS"] },
                  { pair: "USD/KES", val: 128, trend: TRENDS["KES"] },
                  { pair: "EUR/NGN", val: ((ratesData?.USD_TO_NGN_PAYMENT ?? 1480) / 0.92), trend: 0.21 },
                ].map(({ pair, val, trend }) => (
                  <div key={pair} className="flex items-center gap-1.5 bg-white/8 rounded-full px-3 py-1.5 shrink-0">
                    <span className="text-white/70 text-[10px] font-bold">{pair}</span>
                    <span className="text-white text-[10px] font-black">{val >= 100 ? Math.round(val).toLocaleString() : val.toFixed(2)}</span>
                    <span className={`text-[9px] font-bold ${trend >= 0 ? "text-green-300" : "text-red-300"}`}>
                      {trend >= 0 ? "▲" : "▼"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── TABS ── */}
      <div className="flex bg-muted/40 rounded-2xl p-1 gap-1">
        {([
          { id: "rates",   label: "Live Rates" },
          { id: "convert", label: "Converter"  },
          { id: "about",   label: "About"       },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════ RATES TAB ══════════ */}
        {tab === "rates" && (
          <motion.div key="rates" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">

            {/* Base currency selector */}
            <div>
              <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Show rates for</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {["USD", "NGN", "GBP", "EUR", "GHS"].map(code => {
                  const c = getCurrency(code);
                  return (
                    <button
                      key={code}
                      onClick={() => setBaseCurrency(code)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shrink-0 transition-all ${
                        baseCurrency === code
                          ? "border-tsia-green bg-tsia-green/10 text-tsia-green"
                          : "border-border bg-background text-foreground hover:border-tsia-green/50"
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rates table — ChipperCash style scrollable list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-foreground">1 {fromCurrency.symbol} {baseCurrency} =</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </div>
              </div>
              {baseRates.map((c, i) => {
                const trend = TRENDS[c.code] ?? 0;
                const up = trend >= 0;
                return (
                  <motion.div
                    key={c.code}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-background border border-border/50 hover:border-tsia-green/40 hover:bg-tsia-green/5 transition-all cursor-pointer group"
                    onClick={() => { setFromCode(baseCurrency); setToCode(c.code); setTab("convert"); }}
                  >
                    <CurrencyCircle currency={c} size={42} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black">{c.code}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {up ? "+" : ""}{trend.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{c.symbol} {fmtAmount(c.rate)}</p>
                      <p className="text-[10px] text-muted-foreground">per {baseCurrency}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-tsia-green transition-colors shrink-0" />
                  </motion.div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/70 dark:border-amber-800/40">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                Rates shown are indicative and may vary at time of transaction. USD/NGN rates are sourced from platform settings. Other pairs are reference rates.
              </p>
            </div>
          </motion.div>
        )}

        {/* ══════════ CONVERT TAB ══════════ */}
        {tab === "convert" && (
          <motion.div key="convert" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">

            {/* Converter card */}
            <div className="rounded-3xl bg-background border border-border/60 shadow-sm overflow-visible p-5 space-y-3">

              {/* FROM block */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">You Send</p>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border focus-within:border-tsia-green transition-colors">
                  <button
                    className="flex items-center gap-2 shrink-0"
                    onClick={() => setPickerFor("from")}
                  >
                    <CurrencyCircle currency={fromCurrency} size={38} />
                    <div className="text-left">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-black">{fromCode}</p>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{fromCurrency.name.split(" ")[0]}</p>
                    </div>
                  </button>
                  <div className="w-px h-8 bg-border" />
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 text-right text-2xl font-black bg-transparent focus:outline-none text-foreground"
                    placeholder="0.00"
                  />
                  <span className="text-sm font-bold text-muted-foreground">{fromCurrency.symbol}</span>
                </div>
              </div>

              {/* Flip button */}
              <div className="flex items-center justify-center">
                <motion.button
                  whileTap={{ rotate: 180 }}
                  onClick={flip}
                  className="w-10 h-10 rounded-full bg-tsia-green text-white flex items-center justify-center shadow-md hover:bg-tsia-green/90 transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </motion.button>
              </div>

              {/* TO block */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">You Receive</p>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-tsia-green/8 dark:bg-tsia-green/15 border border-tsia-green/30">
                  <button
                    className="flex items-center gap-2 shrink-0"
                    onClick={() => setPickerFor("to")}
                  >
                    <CurrencyCircle currency={toCurrency} size={38} />
                    <div className="text-left">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-black">{toCode}</p>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{toCurrency.name.split(" ")[0]}</p>
                    </div>
                  </button>
                  <div className="w-px h-8 bg-tsia-green/30" />
                  <div className="flex-1 text-right">
                    <p className="text-2xl font-black text-tsia-green">{fmtAmount(converted)}</p>
                  </div>
                  <span className="text-sm font-bold text-tsia-green">{toCurrency.symbol}</span>
                </div>
              </div>

              {/* Rate summary */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live rate</span>
                </div>
                <span className="text-xs font-bold">
                  1 {fromCode} = {toCurrency.symbol} {fmtAmount(liveRate)}
                </span>
              </div>
            </div>

            {/* Quick amount pills */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Quick amounts</p>
              <div className="flex gap-2 flex-wrap">
                {["10", "50", "100", "250", "500", "1000"].map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${
                      amount === a ? "bg-tsia-green text-white border-tsia-green" : "border-border text-foreground hover:border-tsia-green/50"
                    }`}
                  >
                    {fromCurrency.symbol}{a}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-2xl border border-border/60 p-4 space-y-2">
              <p className="text-xs font-bold mb-2">Transaction Breakdown</p>
              {[
                { label: "You send",       value: `${fromCurrency.symbol} ${fmtAmount(parseFloat(amount.replace(/,/g, "")) || 0)}` },
                { label: "Exchange rate",  value: `1 ${fromCode} = ${toCurrency.symbol} ${fmtAmount(liveRate)}` },
                { label: "Service fee",    value: "0.50%" },
                { label: "Recipient gets", value: `${toCurrency.symbol} ${fmtAmount(converted * 0.995)}`, bold: true, green: true },
              ].map(({ label, value, bold, green }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-xs ${bold ? "font-black" : "font-semibold"} ${green ? "text-tsia-green" : "text-foreground"}`}>{value}</span>
                </div>
              ))}
            </div>

            <Button className="w-full h-13 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 text-white font-black text-base shadow-lg">
              <Zap className="w-5 h-5 mr-2" />
              Exchange Now
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">Powered by TSIA SwiftWallet • Transfers settled instantly</p>
          </motion.div>
        )}

        {/* ══════════ ABOUT TAB ══════════ */}
        {tab === "about" && (
          <motion.div key="about" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">

            {/* Feature cards */}
            {[
              {
                icon: Zap,
                color: "bg-tsia-green/10 text-tsia-green",
                title: "Instant Conversion",
                desc: "Convert between 12+ African and global currencies in seconds at live market rates.",
              },
              {
                icon: Shield,
                color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                title: "Bank-Grade Security",
                desc: "All exchange transactions are OTP-protected and backed by the TSIA trust infrastructure.",
              },
              {
                icon: Globe,
                color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
                title: "Pan-African Coverage",
                desc: "Send to 9 African countries: Nigeria, Ghana, Kenya, South Africa, Tanzania, Uganda, Rwanda, Ivory Coast & Ethiopia.",
              },
              {
                icon: TrendingUp,
                color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                title: "Best Rates Guaranteed",
                desc: "We aggregate rates across multiple providers to always offer you the most competitive exchange rates.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-4 p-4 rounded-2xl bg-background border border-border/50">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold mb-0.5">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}

            {/* Supported currencies */}
            <div className="rounded-2xl bg-background border border-border/50 p-4">
              <p className="text-sm font-bold mb-3">Supported Currencies</p>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map(c => (
                  <div key={c.code} className="flex items-center gap-2 p-2 rounded-xl bg-muted/30">
                    <span className="text-base">{c.flag}</span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{c.code}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight truncate">{c.name.split(" ")[0]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-tsia-green/8 dark:bg-tsia-green/15 border border-tsia-green/30 p-4">
              <p className="text-xs font-bold text-tsia-green mb-1">Platform Note</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The TSIA Exchange Market uses our SwiftWallet infrastructure. Transactions are debited from your TSIA wallet and credited to the recipient's account or local bank. Volume discounts apply for exchanges above $500.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CURRENCY PICKER OVERLAY ── */}
      <AnimatePresence>
        {pickerFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setPickerFor(null)}
          >
            <div className="absolute inset-x-0 bottom-0" onClick={e => e.stopPropagation()}>
              <CurrencyPicker
                selected={pickerFor === "from" ? fromCode : toCode}
                exclude={pickerFor === "from" ? toCode : fromCode}
                onChange={code => {
                  if (pickerFor === "from") setFromCode(code);
                  else setToCode(code);
                }}
                onClose={() => setPickerFor(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
