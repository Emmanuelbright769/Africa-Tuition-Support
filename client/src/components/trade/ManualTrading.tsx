import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, CandlestickChart, X,
  ChevronDown, Search, WalletCards,
} from "lucide-react";

/* ─────────────────── Symbols catalogue ─────────────────── */
type Category = "Crypto" | "Forex" | "Commodities" | "Indices" | "Stocks";

interface Sym {
  s: string;       // yahoo-finance2 ticker
  l: string;       // short label shown on the pill
  label: string;   // full name
  cat: Category;
  flag?: string;   // emoji flag / icon
}

const SYMBOLS: Sym[] = [
  /* ── Crypto ── */
  { s: "BTC-USD",  l: "BTC",    label: "Bitcoin",         cat: "Crypto",      flag: "₿" },
  { s: "ETH-USD",  l: "ETH",    label: "Ethereum",        cat: "Crypto",      flag: "Ξ" },
  { s: "BNB-USD",  l: "BNB",    label: "BNB",             cat: "Crypto",      flag: "◈" },
  { s: "SOL-USD",  l: "SOL",    label: "Solana",          cat: "Crypto",      flag: "◎" },
  { s: "XRP-USD",  l: "XRP",    label: "Ripple",          cat: "Crypto",      flag: "✕" },
  { s: "ADA-USD",  l: "ADA",    label: "Cardano",         cat: "Crypto",      flag: "₳" },
  { s: "DOGE-USD", l: "DOGE",   label: "Dogecoin",        cat: "Crypto",      flag: "Ð" },
  { s: "AVAX-USD", l: "AVAX",   label: "Avalanche",       cat: "Crypto",      flag: "△" },
  { s: "DOT-USD",  l: "DOT",    label: "Polkadot",        cat: "Crypto",      flag: "●" },
  { s: "LINK-USD", l: "LINK",   label: "Chainlink",       cat: "Crypto",      flag: "⬡" },

  /* ── Forex ── */
  { s: "EURUSD=X", l: "EUR/USD", label: "Euro / US Dollar",          cat: "Forex", flag: "🇪🇺" },
  { s: "GBPUSD=X", l: "GBP/USD", label: "British Pound / US Dollar", cat: "Forex", flag: "🇬🇧" },
  { s: "JPY=X",    l: "USD/JPY", label: "US Dollar / Japanese Yen",  cat: "Forex", flag: "🇯🇵" },
  { s: "AUDUSD=X", l: "AUD/USD", label: "Aussie / US Dollar",        cat: "Forex", flag: "🇦🇺" },
  { s: "CAD=X",    l: "USD/CAD", label: "US Dollar / Canadian Dollar",cat: "Forex", flag: "🇨🇦" },
  { s: "NZDUSD=X", l: "NZD/USD", label: "Kiwi / US Dollar",          cat: "Forex", flag: "🇳🇿" },
  { s: "EURGBP=X", l: "EUR/GBP", label: "Euro / British Pound",      cat: "Forex", flag: "🇪🇺" },
  { s: "CHF=X",    l: "USD/CHF", label: "US Dollar / Swiss Franc",   cat: "Forex", flag: "🇨🇭" },
  { s: "EURJPY=X", l: "EUR/JPY", label: "Euro / Japanese Yen",       cat: "Forex", flag: "🇯🇵" },
  { s: "GBPJPY=X", l: "GBP/JPY", label: "Pound / Japanese Yen",     cat: "Forex", flag: "🇬🇧" },

  /* ── Commodities ── */
  { s: "GC=F",  l: "GOLD",    label: "Gold",         cat: "Commodities", flag: "🥇" },
  { s: "SI=F",  l: "SILVER",  label: "Silver",       cat: "Commodities", flag: "🥈" },
  { s: "CL=F",  l: "WTI OIL", label: "Crude Oil (WTI)",  cat: "Commodities", flag: "🛢️" },
  { s: "BZ=F",  l: "BRENT",   label: "Brent Crude",  cat: "Commodities", flag: "⛽" },
  { s: "NG=F",  l: "NAT GAS", label: "Natural Gas",  cat: "Commodities", flag: "🔥" },
  { s: "HG=F",  l: "COPPER",  label: "Copper",       cat: "Commodities", flag: "🪙" },
  { s: "PL=F",  l: "PLATINUM",label: "Platinum",     cat: "Commodities", flag: "💿" },

  /* ── Indices ── */
  { s: "^GSPC",  l: "S&P 500",  label: "S&P 500",     cat: "Indices", flag: "🇺🇸" },
  { s: "^IXIC",  l: "NASDAQ",   label: "NASDAQ 100",  cat: "Indices", flag: "🇺🇸" },
  { s: "^DJI",   l: "DOW",      label: "Dow Jones",   cat: "Indices", flag: "🇺🇸" },
  { s: "^RUT",   l: "RUSSELL",  label: "Russell 2000",cat: "Indices", flag: "🇺🇸" },
  { s: "^FTSE",  l: "FTSE 100", label: "FTSE 100",    cat: "Indices", flag: "🇬🇧" },
  { s: "^GDAXI", l: "DAX",      label: "DAX 40",      cat: "Indices", flag: "🇩🇪" },
  { s: "^N225",  l: "NIKKEI",   label: "Nikkei 225",  cat: "Indices", flag: "🇯🇵" },
  { s: "^HSI",   l: "HANG SENG",label: "Hang Seng",   cat: "Indices", flag: "🇭🇰" },

  /* ── Stocks ── */
  { s: "AAPL",  l: "AAPL",  label: "Apple Inc.",         cat: "Stocks", flag: "🍎" },
  { s: "MSFT",  l: "MSFT",  label: "Microsoft",          cat: "Stocks", flag: "🪟" },
  { s: "NVDA",  l: "NVDA",  label: "NVIDIA",             cat: "Stocks", flag: "🟢" },
  { s: "TSLA",  l: "TSLA",  label: "Tesla",              cat: "Stocks", flag: "⚡" },
  { s: "AMZN",  l: "AMZN",  label: "Amazon",             cat: "Stocks", flag: "📦" },
  { s: "META",  l: "META",  label: "Meta Platforms",     cat: "Stocks", flag: "🔵" },
  { s: "GOOGL", l: "GOOGL", label: "Alphabet (Google)",  cat: "Stocks", flag: "🔍" },
  { s: "JPM",   l: "JPM",   label: "JPMorgan Chase",     cat: "Stocks", flag: "🏦" },
];

const CATS: Category[] = ["Crypto", "Forex", "Commodities", "Indices", "Stocks"];

const CAT_COLORS: Record<Category, string> = {
  Crypto:      "text-tsia-gold   border-tsia-gold/30   bg-tsia-gold/10",
  Forex:       "text-blue-400    border-blue-400/30    bg-blue-400/10",
  Commodities: "text-amber-400   border-amber-400/30   bg-amber-400/10",
  Indices:     "text-violet-400  border-violet-400/30  bg-violet-400/10",
  Stocks:      "text-tsia-green  border-tsia-green/30  bg-tsia-green/10",
};

const CAT_ACTIVE: Record<Category, string> = {
  Crypto:      "bg-tsia-gold   text-slate-950",
  Forex:       "bg-blue-500    text-white",
  Commodities: "bg-amber-500   text-slate-950",
  Indices:     "bg-violet-500  text-white",
  Stocks:      "bg-tsia-green  text-white",
};

/* ─────────────────── Symbol Picker modal ─────────────────── */
function SymbolPicker({
  value, onSelect, onClose,
}: { value: string; onSelect: (s: Sym) => void; onClose: () => void }) {
  const [cat, setCat] = useState<Category>(
    SYMBOLS.find(s => s.s === value)?.cat ?? "Crypto"
  );
  const [q, setQ] = useState("");

  const visible = q.trim()
    ? SYMBOLS.filter(s =>
        s.label.toLowerCase().includes(q.toLowerCase()) ||
        s.l.toLowerCase().includes(q.toLowerCase())
      )
    : SYMBOLS.filter(s => s.cat === cat);

  return (
    <>
      {/* ── Backdrop (separate element — never wraps the panel) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm"
      />

      {/* ── Sheet panel (independent fixed element at higher z) ── */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl border-t border-white/10 bg-slate-900 shadow-2xl"
        style={{ height: "88dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/20" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h3 className="text-lg font-black text-white">Select Market</h3>
            <p className="text-xs text-white/40">{SYMBOLS.length} instruments available</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mx-5 mb-3 shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Search symbol or name…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-tsia-green/50"
          />
        </div>

        {/* Category tabs */}
        {!q && (
          <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3 scrollbar-none">
            {CATS.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all
                  ${cat === c ? CAT_ACTIVE[c] : "bg-white/5 text-white/50 hover:bg-white/10"}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* ── Scrollable symbol grid — inline styles for iOS Safari ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            paddingLeft: "1.25rem",
            paddingRight: "1.25rem",
            paddingBottom: "6rem",
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {visible.map(sym => {
              const active = sym.s === value;
              const colors = CAT_COLORS[sym.cat];
              return (
                <button
                  key={sym.s}
                  onClick={() => { onSelect(sym); onClose(); }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.97]
                    ${active ? `${colors} ring-1 ring-current` : "border-white/10 bg-white/5"}`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base
                    ${active ? "bg-white/20" : "bg-white/5"}`}>
                    {sym.flag ?? sym.l[0]}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-black leading-tight truncate ${active ? "" : "text-white"}`}>
                      {sym.l}
                    </p>
                    <p className={`mt-0.5 text-[10px] leading-snug truncate ${active ? "opacity-70" : "text-white/40"}`}>
                      {sym.label}
                    </p>
                  </div>
                  {active && (
                    <div className="ml-auto h-2 w-2 shrink-0 rounded-full bg-current animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
          {visible.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-white/30 text-sm">No matches for "{q}"</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ─────────────────── Main component ─────────────────── */
export default function ManualTrading({ tradeBalance }: { tradeBalance: number }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Sym>(SYMBOLS[0]);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState("10");
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [closeConfirm, setCloseConfirm] = useState<number | null>(null);
  const [closeResult, setCloseResult] = useState<any>(null);

  const { data: prices = [] } = useQuery<any[]>({ queryKey: ["/api/trade/market-prices"], refetchInterval: 15000 });
  const { data: positions = [] } = useQuery<any[]>({ queryKey: ["/api/trade/manual/positions"], refetchInterval: 10000 });

  const openPos = useMutation({
    mutationFn: () => apiRequest("POST", "/api/trade/manual/open", {
      symbol: selected.s,
      symbolLabel: selected.label,
      direction, leverage, marginUsd: Number(margin),
      stopLossPrice: stopLoss ? Number(stopLoss) : undefined,
      takeProfitPrice: takeProfit ? Number(takeProfit) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade/manual/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] });
      setMargin("10"); setStopLoss(""); setTakeProfit("");
    },
  });

  const closePos = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/trade/manual/close/${id}`, {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade/manual/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] });
      setCloseConfirm(null);
      setCloseResult(data);
    },
  });

  const currentPrice = (prices as any[]).find(p => p.symbol === selected.s)?.price;
  const posSize = Number(margin) * leverage;
  const leverageLabel = leverage <= 2 ? "Safe" : leverage <= 5 ? "Moderate" : "High Risk";
  const leverageColor = leverage <= 2 ? "text-tsia-green" : leverage <= 5 ? "text-tsia-gold" : "text-rose-400";
  const catColor = CAT_COLORS[selected.cat];

  const open = (positions as any[]).filter(p => p.status === "open");
  const closed = (positions as any[]).filter(p => p.status !== "open").slice(0, 10);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-tsia-gold">
            <CandlestickChart className="h-4 w-4" /> Manual Desk
          </div>
          <h2 className="mt-2 text-2xl font-black">Make your own market.</h2>
          <p className="text-sm text-muted-foreground">Trade real instruments. Win or lose — it's your call.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("tsia:open-trade-mode-wallet", { detail: { mode: "manual" } }))}
          className="shrink-0 rounded-2xl border border-tsia-gold/30 bg-tsia-gold/10 px-3 py-2 text-right text-tsia-gold"
          data-testid="manual-trading-wallet"
        >
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase"><WalletCards className="h-3.5 w-3.5" /> Wallet</span>
          <strong className="text-base">${tradeBalance.toFixed(2)}</strong>
        </button>
      </header>

      {/* Order Entry */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl"
      >
        {/* ── Symbol selector button ── */}
        <button
          onClick={() => setPickerOpen(true)}
          className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${catColor}`}
        >
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl">
            {selected.flag ?? selected.l[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">{selected.cat}</p>
            <p className="text-xl font-black leading-tight">{selected.l}</p>
            <p className="text-xs opacity-70 truncate">{selected.label}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs opacity-50">Current price</p>
            <p className="text-lg font-black">
              {currentPrice
                ? `$${Number(currentPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                : "—"}
            </p>
            <div className="flex items-center gap-1 justify-end mt-0.5 opacity-70">
              <span className="text-[10px]">Tap to change</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>
        </button>

        {/* Direction */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setDirection("long")}
            className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-bold transition-all ${direction === "long" ? "bg-tsia-green text-white shadow-lg shadow-tsia-green/20" : "bg-white/10 hover:bg-white/20"}`}>
            <TrendingUp className="h-4 w-4" /> LONG
          </button>
          <button onClick={() => setDirection("short")}
            className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-bold transition-all ${direction === "short" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-white/10 hover:bg-white/20"}`}>
            <TrendingDown className="h-4 w-4" /> SHORT
          </button>
        </div>

        {/* Margin */}
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Margin (USD) · Available <span className="text-foreground">${tradeBalance.toFixed(2)}</span>
          <input type="number" min="1" max={tradeBalance} value={margin} onChange={e => setMargin(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 p-3 text-lg outline-none focus:border-tsia-green/50" />
        </label>

        {/* Leverage */}
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Leverage: <span className="text-foreground font-black">{leverage}×</span>
          <span className={`ml-2 text-[10px] font-bold ${leverageColor}`}>{leverageLabel}</span>
          <input type="range" min="1" max="10" value={leverage} onChange={e => setLeverage(Number(e.target.value))}
            className="mt-3 w-full accent-[hsl(var(--tsia-green))]" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>1× Safe</span><span>5× Moderate</span><span>10× Max Risk</span></div>
        </label>

        {/* Position size summary */}
        <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position size</span>
            <span className="font-black">${posSize.toFixed(2)}</span>
          </div>
          {Number(margin) > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Max loss</span>
              <span className="text-rose-400 font-bold">${Number(margin).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Optional SL/TP */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Stop Loss
            <input type="number" placeholder="Optional" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 p-2.5 text-sm outline-none" />
          </label>
          <label className="text-xs text-muted-foreground">
            Take Profit
            <input type="number" placeholder="Optional" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 p-2.5 text-sm outline-none" />
          </label>
        </div>

        {/* Submit */}
        <button
          disabled={openPos.isPending || Number(margin) <= 0 || Number(margin) > tradeBalance}
          onClick={() => openPos.mutate()}
          className={`mt-5 w-full rounded-2xl py-4 text-sm font-black tracking-wide transition-all
            ${direction === "long"
              ? "bg-tsia-green text-white shadow-lg shadow-tsia-green/30 hover:opacity-90 disabled:opacity-40"
              : "bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:opacity-90 disabled:opacity-40"
            }`}
        >
          {openPos.isPending
            ? "Opening…"
            : `Open ${leverage}× ${direction.toUpperCase()} · ${selected.l}`}
        </button>
        {openPos.isError && (
          <p className="mt-2 text-center text-xs text-rose-400">
            {(openPos.error as any)?.message ?? "Failed to open position"}
          </p>
        )}
      </motion.section>

      {/* Open positions */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <h3 className="mb-3 font-bold">Open Positions <span className="text-xs text-muted-foreground">({open.length})</span></h3>
        {open.length === 0 ? (
          <div className="py-8 text-center text-white/30">
            <CandlestickChart className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No open positions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((p: any) => {
              const entryP = Number(p.entryPrice);
              const liveP  = (prices as any[]).find(x => x.symbol === p.symbol)?.price ?? entryP;
              const qty    = (Number(p.marginUsd) * Number(p.leverage)) / entryP;
              const unrealizedPnl = p.direction === "long"
                ? (liveP - entryP) * qty
                : (entryP - liveP) * qty;
              return (
                <div key={p.id} className={`rounded-2xl border p-4 ${unrealizedPnl >= 0 ? "border-tsia-green/20 bg-tsia-green/5" : "border-rose-400/20 bg-rose-400/5"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{p.symbol}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.direction === "long" ? "bg-tsia-green/20 text-tsia-green" : "bg-rose-400/20 text-rose-400"}`}>
                          {p.direction === "long" ? "▲" : "▼"} {p.direction.toUpperCase()} {p.leverage}×
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Entry ${entryP.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {" · "}Live ${Number(liveP).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Margin ${Number(p.marginUsd).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <b className={`text-lg font-black ${unrealizedPnl >= 0 ? "text-tsia-green" : "text-rose-400"}`}>
                        {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
                      </b>
                      <button
                        onClick={() => setCloseConfirm(p.id)}
                        className="mt-2 block w-full rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Closed positions */}
      {closed.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 font-bold">Recent Closed Positions</h3>
          {closed.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between border-t border-white/10 py-3 text-xs">
              <span className="font-bold text-white">{p.symbol} <em className={p.direction === "long" ? "text-tsia-green" : "text-rose-400"}>{p.direction}</em> {p.leverage}×</span>
              <span className="text-muted-foreground">${Number(p.marginUsd).toFixed(2)} margin</span>
              <b className={Number(p.pnlUsd) >= 0 ? "text-tsia-green" : "text-rose-400"}>
                {Number(p.pnlUsd) >= 0 ? "+" : ""}${Number(p.pnlUsd ?? 0).toFixed(2)}
              </b>
            </div>
          ))}
        </section>
      )}

      {/* Symbol Picker modal */}
      <AnimatePresence>
        {pickerOpen && (
          <SymbolPicker
            value={selected.s}
            onSelect={sym => setSelected(sym)}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Close confirm dialog */}
      <AnimatePresence>
        {closeConfirm !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white">Close Position</h3>
                <button onClick={() => setCloseConfirm(null)} className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 transition-colors"><X className="h-4 w-4 text-white" /></button>
              </div>
              <p className="text-sm text-muted-foreground">This will close your position at the current market price. Your P&L will be settled to your Trade Wallet.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setCloseConfirm(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm text-white">Cancel</button>
                <button disabled={closePos.isPending} onClick={() => closePos.mutate(closeConfirm!)}
                  className="flex-1 rounded-xl bg-rose-500 p-3 text-sm font-bold text-white disabled:opacity-40">
                  {closePos.isPending ? "Closing…" : "Close at Market"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close result toast */}
      <AnimatePresence>
        {closeResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-6 py-4 text-sm font-bold shadow-2xl backdrop-blur-xl
              ${closeResult.pnlUsd >= 0 ? "border-tsia-green/30 bg-tsia-green/20 text-tsia-green" : "border-rose-400/30 bg-rose-400/20 text-rose-300"}`}>
            {closeResult.pnlUsd >= 0 ? "✓ Won " : "✗ Lost "}
            ${Math.abs(Number(closeResult.pnlUsd)).toFixed(2)} · Returned ${Number(closeResult.returnAmt ?? 0).toFixed(2)}
            <button onClick={() => setCloseResult(null)} className="ml-4 opacity-60 hover:opacity-100"><X className="h-3 w-3 inline" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
