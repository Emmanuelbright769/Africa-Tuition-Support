import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Search, Bell, Star, StarOff,
  ArrowLeft, X, Plus, Minus, Home, BarChart3, Briefcase,
  List, ChevronRight, RefreshCw, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip as RTooltip, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Stock {
  ticker: string; name: string; sector: string; exchange: string;
  region: "african" | "us" | "global";
  price: number; priceNative: number; change: number; changePercent: number;
  open: number; high: number; low: number;
  volume: string; marketCap: string; description: string;
  color: string; currency: string; lastUpdated: number;
}
interface Holding {
  id: number; ticker: string; shares: string; avgCostUsd: string;
  price: number; value: number; cost: number; pnl: number; pnlPct: number;
}
interface TradeOrder {
  id: number; type: "buy" | "sell"; ticker: string; stockName: string;
  shares: string; priceUsd: string; totalUsd: string; feeUsd: string;
  createdAt: string;
}
interface HistPoint { t: string; v: number; }
type Tab = "home" | "market" | "portfolio" | "watchlist" | "orders";
type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";
type Category = "all" | "african" | "us" | "global";

// ─── Pseudo-sparkline for list views ──────────────────────────────────────────
function miniSpark(price: number, pct: number, n = 12): HistPoint[] {
  const seed = Math.abs(Math.round(price * 100)) || 1;
  let s = seed;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const direction = pct >= 0 ? 1 : -1;
  const result: HistPoint[] = [];
  let p = price * (1 - Math.abs(pct / 100) * 0.8);
  for (let i = 0; i < n; i++) {
    p = p * (1 + (rng() - 0.47 + direction * 0.03) * 0.03);
    result.push({ t: "", v: +p.toFixed(4) });
  }
  result[result.length - 1].v = price;
  return result;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtShares = (s: string | number) => {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(4).replace(/\.?0+$/, "");
};
const upColor   = "#22c55e";
const downColor = "#ef4444";
const pctColor  = (v: number) => v >= 0 ? upColor : downColor;
const pctBg     = (v: number) => v >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
const PIE_COLORS = ["#22c55e","#e6b800","#3b82f6","#8b5cf6","#f97316","#06b6d4","#f43f5e","#ec4899","#14b8a6"];

// ─── Currency native format ────────────────────────────────────────────────────
function nativePrice(stock: Stock) {
  const c = stock.currency;
  const sym = c === "NGN" ? "₦" : c === "KES" ? "KSh " : c === "ZAR" ? "R" : c === "GBp" ? "p" : "";
  if (!sym) return null;
  return `${sym}${fmt(stock.priceNative)}`;
}

// ─── Shared sub-components ─────────────────────────────────────────────────────
function MiniSparkline({ data, up }: { data: HistPoint[]; up: boolean }) {
  return (
    <ResponsiveContainer width={64} height={30}>
      <LineChart data={data}>
        <Line dataKey="v" stroke={up ? upColor : downColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
function Avatar({ stock }: { stock: Stock }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
      style={{ background: stock.color }}>
      {stock.ticker.slice(0, 2)}
    </div>
  );
}
function PctBadge({ v }: { v: number }) {
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap"
      style={{ color: pctColor(v), background: pctBg(v) }}>
      {v >= 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

// ─── Buy / Sell modal ──────────────────────────────────────────────────────────
function TradeModal({ stock, type, cash, onClose, onConfirm }: {
  stock: Stock; type: "buy" | "sell"; cash: number;
  onClose: () => void;
  onConfirm: (shares: number, priceUsd: number, type: "buy" | "sell") => Promise<void>;
}) {
  const [shares, setShares] = useState(1);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitInput, setLimitInput] = useState(stock.price.toFixed(2));
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const execPrice = orderType === "market" ? stock.price : parseFloat(limitInput) || stock.price;
  const subtotal  = shares * execPrice;
  const fee       = +(subtotal * 0.001).toFixed(2);
  const grand     = type === "buy" ? subtotal + fee : subtotal - fee;
  const canAfford = type === "buy" ? grand <= cash : true;

  async function submit() {
    if (!canAfford || state === "loading") return;
    setState("loading");
    setErrMsg("");
    try {
      await onConfirm(shares, execPrice, type);
      setState("done");
    } catch (e: any) {
      setErrMsg(e.message ?? "Order failed");
      setState("error");
    }
  }

  return (
    <motion.div className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.75)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full rounded-t-3xl px-5 pt-5 pb-10 overflow-y-auto"
        style={{ background: "#111827", maxHeight: "88%" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}>

        {state === "done" ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
            <p className="text-white font-bold text-xl">Order Filled!</p>
            <p className="text-gray-400 text-sm">{type === "buy" ? "Bought" : "Sold"} {fmtShares(shares)} × {stock.ticker}</p>
            <p className="text-gray-500 text-xs">${fmt(grand)} {type === "buy" ? "deducted" : "credited"}</p>
          </div>
        ) : <>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Avatar stock={stock} />
              <div>
                <p className="text-white font-bold">{stock.ticker}</p>
                <p className="text-gray-400 text-xs">{stock.name}</p>
              </div>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="flex rounded-2xl overflow-hidden mb-5" style={{ background: "#1f2937" }}>
            {(["buy","sell"] as const).map(t => (
              <button key={t}
                className={`flex-1 py-2.5 text-sm font-bold capitalize transition-all ${type===t ? (t==="buy" ? "bg-green-500 text-white" : "bg-red-500 text-white") : "text-gray-500"}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            {(["market","limit"] as const).map(ot => (
              <button key={ot} onClick={() => setOrderType(ot)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${orderType===ot ? "border-tsia-green text-tsia-green" : "border-gray-700 text-gray-500"}`}>
                {ot} Order
              </button>
            ))}
          </div>

          {orderType === "limit" && (
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Limit Price (USD)</label>
              <Input value={limitInput} onChange={e => setLimitInput(e.target.value)} type="number" step="0.01"
                className="text-sm text-white border-gray-700" style={{ background: "#1f2937" }} />
            </div>
          )}

          <div className="flex justify-between items-center px-3 py-2.5 rounded-xl mb-4" style={{ background: "#1f2937" }}>
            <span className="text-xs text-gray-400">Market Price</span>
            <div className="text-right">
              <span className="text-white font-bold">${fmt(stock.price)}</span>
              {nativePrice(stock) && <p className="text-gray-500 text-[10px]">{nativePrice(stock)}</p>}
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs text-gray-400 mb-2 block">Number of Shares</label>
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => setShares(Math.max(1, shares - 1))}
                className="w-9 h-9 rounded-full border border-gray-600 flex items-center justify-center text-white hover:border-tsia-green transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-white font-black text-2xl w-12 text-center">{shares}</span>
              <button onClick={() => setShares(shares + 1)}
                className="w-9 h-9 rounded-full border border-gray-600 flex items-center justify-center text-white hover:border-tsia-green transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-4 space-y-2.5" style={{ background: "#1f2937" }}>
            {[
              ["Subtotal", `$${fmt(subtotal)}`],
              ["Fee (0.1%)", `$${fmt(fee)}`],
              ["Total", `$${fmt(grand)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-xs text-gray-400">{k}</span>
                <span className={`text-xs font-bold ${k === "Total" ? "text-white" : "text-gray-300"}`}>{v}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-xs text-gray-400">Available Cash</span>
              <span className="text-xs font-bold text-green-400">${fmt(cash)}</span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 mb-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" /> Insufficient trade wallet balance.
            </div>
          )}
          {state === "error" && (
            <div className="flex items-center gap-2 mb-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" /> {errMsg}
            </div>
          )}

          <button onClick={submit} disabled={!canAfford || state === "loading"}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: type === "buy" ? upColor : downColor }}
            data-testid="btn-confirm-trade">
            {state === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm {type === "buy" ? "Buy" : "Sell"} Order
          </button>
        </>}
      </motion.div>
    </motion.div>
  );
}

// ─── Stock Detail screen ───────────────────────────────────────────────────────
function StockDetail({ stock, inWatchlist, cash, holding, onBack, onToggleWatch, onTrade }: {
  stock: Stock; inWatchlist: boolean; cash: number;
  holding?: Holding;
  onBack: () => void; onToggleWatch: () => void;
  onTrade: (type: "buy" | "sell") => void;
}) {
  const [range, setRange] = useState<TimeRange>("1M");
  const [history, setHistory] = useState<HistPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const isUp = stock.changePercent >= 0;
  const chartColor = isUp ? upColor : downColor;
  const RANGES: TimeRange[] = ["1D","1W","1M","3M","1Y"];

  useEffect(() => {
    setLoadingChart(true);
    fetch(`/api/exchange/history/${stock.ticker}?range=${range}`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoadingChart(false); })
      .catch(() => { setHistory([]); setLoadingChart(false); });
  }, [stock.ticker, range]);

  const chartData = history.length > 0 ? history : miniSpark(stock.price, stock.changePercent, 20);
  const gradId = `grad-${stock.ticker.replace(/[^a-z0-9]/gi, "")}`;

  const stats = [
    { label: "Open",       value: `$${fmt(stock.open)}`   },
    { label: "High",       value: `$${fmt(stock.high)}`   },
    { label: "Low",        value: `$${fmt(stock.low)}`    },
    { label: "Volume",     value: stock.volume            },
    { label: "Market Cap", value: stock.marketCap         },
    { label: "Exchange",   value: stock.exchange          },
  ];

  return (
    <motion.div className="absolute inset-0 overflow-y-auto z-10" style={{ background: "#0a0f1a" }}
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}>

      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.07)" }}
          data-testid="btn-stock-back">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-bold">{stock.ticker}</p>
          <p className="text-gray-400 text-xs">{stock.exchange}</p>
        </div>
        <button onClick={onToggleWatch}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.07)" }}
          data-testid="btn-toggle-watchlist">
          {inWatchlist
            ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            : <StarOff className="w-4 h-4 text-gray-400" />}
        </button>
      </div>

      <div className="px-5 pb-4">
        <p className="text-gray-400 text-sm mb-1">{stock.name}</p>
        <div className="flex items-end gap-3">
          <span className="text-white text-3xl font-black">${fmt(stock.price)}</span>
          <PctBadge v={stock.changePercent} />
        </div>
        {nativePrice(stock) && (
          <p className="text-gray-500 text-xs mt-0.5">{nativePrice(stock)} native</p>
        )}
        <p className="text-sm mt-1 font-semibold" style={{ color: pctColor(stock.changePercent) }}>
          {stock.change >= 0 ? "+" : ""}${fmt(Math.abs(stock.change))} today
        </p>
      </div>

      {holding && (
        <div className="mx-4 rounded-2xl px-4 py-3 mb-3 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div>
            <p className="text-green-300/70 text-[10px]">Your Position</p>
            <p className="text-white text-sm font-bold">{fmtShares(holding.shares)} shares</p>
          </div>
          <div className="text-center">
            <p className="text-green-300/70 text-[10px]">Avg Cost</p>
            <p className="text-white text-sm font-bold">${fmt(parseFloat(holding.avgCostUsd))}</p>
          </div>
          <div className="text-right">
            <p className="text-green-300/70 text-[10px]">P&amp;L</p>
            <p className={`text-sm font-bold ${holding.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {holding.pnl >= 0 ? "+" : ""}${fmt(holding.pnl)}
            </p>
          </div>
        </div>
      )}

      <div className="px-2 pb-2">
        {loadingChart ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
              <YAxis domain={["auto","auto"]} tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} />
              <RTooltip
                contentStyle={{ background: "#1f2937", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }}
                formatter={(v: any) => [`$${fmt(Number(v))}`, stock.ticker]}
                labelFormatter={l => l || ""} />
              <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="flex justify-center gap-1 mt-2">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: range===r ? "var(--color-tsia-green)" : "rgba(255,255,255,0.06)", color: range===r ? "#fff" : "#6b7280" }}
              data-testid={`btn-range-${r}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3" style={{ background: "#111827" }}>
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <p className="text-gray-500 text-[10px] mb-0.5">{s.label}</p>
            <p className="text-white text-xs font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mx-4 mb-5">
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">About</p>
        <p className="text-gray-300 text-sm leading-relaxed">{stock.description}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{stock.sector}</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{stock.exchange}</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400 capitalize">{stock.region}</Badge>
        </div>
      </div>

      <div className="flex gap-3 mx-4 mb-8 pb-4">
        <button onClick={() => onTrade("sell")}
          className="flex-1 py-4 rounded-2xl font-bold text-sm border transition-colors"
          style={{ color: downColor, borderColor: "rgba(239,68,68,0.4)" }}
          data-testid="btn-sell">
          Sell
        </button>
        <button onClick={() => onTrade("buy")}
          className="flex-1 py-4 rounded-2xl font-bold text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: upColor }}
          data-testid="btn-buy">
          Buy Now
        </button>
      </div>
    </motion.div>
  );
}

// ─── Home tab ──────────────────────────────────────────────────────────────────
function HomeTab({ holdings, orders, stocks, cash, watchlistSet, onSelectStock, onGoMarket }: {
  holdings: Holding[]; orders: TradeOrder[]; stocks: Stock[]; cash: number;
  watchlistSet: Set<string>; onSelectStock: (s: Stock) => void; onGoMarket: () => void;
}) {
  const stockMap = useMemo(() => new Map(stocks.map(s => [s.ticker, s])), [stocks]);
  const totalHoldings = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPortfolio = cash + totalHoldings;
  const dayChange = holdings.reduce((sum, h) => {
    const s = stockMap.get(h.ticker);
    return sum + (s ? s.change * parseFloat(h.shares) : 0);
  }, 0);
  const dayChangePct = totalHoldings > 0 ? (dayChange / (totalHoldings - Math.abs(dayChange))) * 100 : 0;

  const topMovers = useMemo(() =>
    [...stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6),
  [stocks]);
  const watchedStocks = stocks.filter(s => watchlistSet.has(s.ticker)).slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-5">
      {/* Portfolio card */}
      <div className="rounded-3xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(142 60% 14%) 0%, hsl(142 52% 24%) 100%)" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />
        <p className="text-green-300/80 text-xs font-medium mb-0.5 relative">Total Portfolio</p>
        <p className="text-white text-3xl font-black relative tracking-tight">${fmt(totalPortfolio)}</p>
        <div className="flex items-center gap-1.5 mt-1 relative">
          {dayChange >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-green-300" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
          <span className={`text-xs font-semibold ${dayChange >= 0 ? "text-green-300" : "text-red-300"}`}>
            {dayChange >= 0 ? "+" : ""}${fmt(Math.abs(dayChange))} ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%) today
          </span>
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-white/10 relative">
          <div>
            <p className="text-green-300/70 text-[10px]">Invested</p>
            <p className="text-white text-sm font-bold">${fmt(totalHoldings)}</p>
          </div>
          <div className="text-right">
            <p className="text-green-300/70 text-[10px]">Cash</p>
            <p className="text-white text-sm font-bold">${fmt(cash)}</p>
          </div>
        </div>
      </div>

      {/* Top movers */}
      {topMovers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Top Movers</p>
            <button onClick={onGoMarket} className="flex items-center gap-0.5 text-xs font-semibold text-tsia-gold">
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {topMovers.map(s => (
              <button key={s.ticker} onClick={() => onSelectStock(s)}
                className="flex flex-col p-3 rounded-2xl shrink-0 w-32 border text-left transition-all hover:border-tsia-green/30"
                style={{ background: "#111827", borderColor: "#1f2937" }}
                data-testid={`card-mover-${s.ticker}`}>
                <div className="flex items-center justify-between mb-2">
                  <Avatar stock={s} />
                  <PctBadge v={s.changePercent} />
                </div>
                <p className="text-white text-xs font-black">{s.ticker}</p>
                <p className="text-gray-500 text-[10px] mb-1.5 truncate">{s.name}</p>
                <MiniSparkline data={miniSpark(s.price, s.changePercent)} up={s.changePercent >= 0} />
                <p className="text-white text-sm font-bold mt-1">${fmt(s.price)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist preview */}
      {watchedStocks.length > 0 && (
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Your Watchlist</p>
          <div className="space-y-2">
            {watchedStocks.map(s => (
              <button key={s.ticker} onClick={() => onSelectStock(s)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
                style={{ background: "#111827", borderColor: "#1f2937" }}
                data-testid={`row-watchlist-${s.ticker}`}>
                <Avatar stock={s} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold">{s.ticker}</p>
                  <p className="text-gray-500 text-xs truncate">{s.name}</p>
                </div>
                <MiniSparkline data={miniSpark(s.price, s.changePercent)} up={s.changePercent >= 0} />
                <div className="text-right ml-1 shrink-0">
                  <p className="text-white text-sm font-bold">${fmt(s.price)}</p>
                  <PctBadge v={s.changePercent} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {orders.length > 0 && (
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Recent Activity</p>
          <div className="space-y-2">
            {orders.slice(0, 3).map(o => {
              const s = stockMap.get(o.ticker);
              return (
                <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl border"
                  style={{ background: "#111827", borderColor: "#1f2937" }}>
                  {s ? <Avatar stock={s} /> : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-[11px] font-black shrink-0">
                      {o.ticker.slice(0,2)}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{o.ticker}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${o.type==="buy" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                      {o.type==="buy" ? "+" : "-"}{fmtShares(o.shares)} shares
                    </span>
                    <p className="text-white text-xs mt-0.5">${fmt(parseFloat(o.totalUsd))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orders.length === 0 && holdings.length === 0 && (
        <div className="flex flex-col items-center py-10 gap-3 text-center">
          <BarChart3 className="w-12 h-12 text-gray-700" />
          <p className="text-gray-400 font-semibold">No activity yet</p>
          <p className="text-gray-600 text-sm">Browse the market and make your first trade.</p>
          <button onClick={onGoMarket}
            className="mt-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: "var(--color-tsia-green)" }}>
            Browse Market
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Market tab ────────────────────────────────────────────────────────────────
function MarketTab({ stocks, loading, onSelectStock }: {
  stocks: Stock[]; loading: boolean; onSelectStock: (s: Stock) => void;
}) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Category>("all");

  const CATS: { id: Category; label: string }[] = [
    { id: "all",     label: "All"        },
    { id: "african", label: "🌍 African"  },
    { id: "us",      label: "🇺🇸 US"      },
    { id: "global",  label: "🌐 Global"   },
  ];

  const filtered = useMemo(() => stocks.filter(s => {
    const q = search.toLowerCase();
    return (s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
           (cat === "all" || s.region === cat);
  }), [search, cat, stocks]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-tsia-green animate-spin" />
          <p className="text-gray-400 text-sm">Loading live prices…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 space-y-2" style={{ background: "#0a0f1a" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search stocks…" data-testid="input-stock-search"
            className="pl-9 text-sm text-white border-0"
            style={{ background: "#111827" }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ background: cat===c.id ? "var(--color-tsia-green)" : "#111827", color: cat===c.id ? "#fff" : "#6b7280" }}
              data-testid={`filter-${c.id}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center px-5 py-1.5">
        <span className="flex-1 text-[10px] text-gray-600 uppercase tracking-wider font-bold">Stock</span>
        <span className="w-16 text-center text-[10px] text-gray-600 uppercase tracking-wider font-bold">Chart</span>
        <span className="w-24 text-right text-[10px] text-gray-600 uppercase tracking-wider font-bold">Price</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {filtered.map(s => (
          <button key={s.ticker} onClick={() => onSelectStock(s)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
            style={{ background: "#111827", borderColor: "#1f2937" }}
            data-testid={`row-stock-${s.ticker}`}>
            <Avatar stock={s} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black">{s.ticker}</p>
              <p className="text-gray-500 text-xs truncate">{s.name}</p>
              <span className="text-[10px] text-gray-600">{s.exchange}</span>
            </div>
            <MiniSparkline data={miniSpark(s.price, s.changePercent)} up={s.changePercent >= 0} />
            <div className="text-right shrink-0 ml-1">
              <p className="text-white text-sm font-bold">${fmt(s.price)}</p>
              <PctBadge v={s.changePercent} />
            </div>
          </button>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-600">
            <Search className="w-8 h-8" />
            <p className="text-sm">No stocks found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Portfolio tab ─────────────────────────────────────────────────────────────
function PortfolioTab({ holdings, stocks, cash, onSelectStock }: {
  holdings: Holding[]; stocks: Stock[]; cash: number; onSelectStock: (s: Stock) => void;
}) {
  const stockMap = useMemo(() => new Map(stocks.map(s => [s.ticker, s])), [stocks]);

  const totalValue  = holdings.reduce((a, b) => a + b.value, 0);
  const totalCost   = holdings.reduce((a, b) => a + b.cost, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const pieData = holdings.map((h, i) => ({
    name: h.ticker, value: h.value, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
      <div className="rounded-3xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(142 60% 14%) 0%, hsl(142 52% 24%) 100%)" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 60%)" }} />
        <p className="text-green-300/80 text-xs mb-0.5 relative">Portfolio Value</p>
        <p className="text-white text-3xl font-black relative">${fmt(totalValue + cash)}</p>
        <div className="flex items-center gap-1.5 mt-1 relative">
          {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-300" /> : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
          <span className={`text-xs font-semibold ${totalPnl >= 0 ? "text-green-300" : "text-red-300"}`}>
            {totalPnl >= 0 ? "+" : ""}${fmt(Math.abs(totalPnl))} ({totalPnlPct.toFixed(2)}%) all time
          </span>
        </div>
        <div className="flex justify-between mt-3 pt-3 border-t border-white/10 relative">
          <div><p className="text-green-300/70 text-[10px]">Invested</p><p className="text-white font-bold">${fmt(totalValue)}</p></div>
          <div className="text-center"><p className="text-green-300/70 text-[10px]">Cash</p><p className="text-white font-bold">${fmt(cash)}</p></div>
          <div className="text-right"><p className="text-green-300/70 text-[10px]">P&amp;L</p>
            <p className={`font-bold ${totalPnl >= 0 ? "text-green-300" : "text-red-300"}`}>
              {totalPnl >= 0 ? "+" : ""}${fmt(Math.abs(totalPnl))}
            </p>
          </div>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "#111827" }}>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-3">Allocation</p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-gray-300 text-xs flex-1">{d.name}</span>
                  <span className="text-white text-xs font-bold">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(0) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Holdings</p>
        {holdings.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-gray-600">
            <Briefcase className="w-10 h-10" />
            <p className="text-sm">No holdings yet — buy some stocks!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holdings.map(h => {
              const stock = stockMap.get(h.ticker);
              return (
                <button key={h.ticker}
                  onClick={() => stock && onSelectStock(stock)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
                  style={{ background: "#111827", borderColor: "#1f2937" }}
                  data-testid={`row-holding-${h.ticker}`}>
                  {stock ? <Avatar stock={stock} /> : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-[11px] font-black shrink-0">
                      {h.ticker.slice(0,2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-black">{h.ticker}</p>
                    <p className="text-gray-500 text-xs">{fmtShares(h.shares)} shares · avg ${fmt(parseFloat(h.avgCostUsd))}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-bold">${fmt(h.value)}</p>
                    <span className="text-xs font-semibold" style={{ color: pctColor(h.pnlPct) }}>
                      {h.pnl >= 0 ? "+" : ""}${fmt(Math.abs(h.pnl))} ({h.pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Watchlist tab ─────────────────────────────────────────────────────────────
function WatchlistTab({ watchlistSet, stocks, onSelectStock, onRemove, onTrade }: {
  watchlistSet: Set<string>; stocks: Stock[]; onSelectStock: (s: Stock) => void;
  onRemove: (t: string) => void; onTrade: (s: Stock, type: "buy"|"sell") => void;
}) {
  const watched = stocks.filter(s => watchlistSet.has(s.ticker));

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
      {watched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Star className="w-12 h-12 text-gray-700" />
          <p className="text-gray-400 font-semibold">Watchlist is empty</p>
          <p className="text-gray-600 text-sm">Tap ☆ on any stock to add it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {watched.map(s => (
            <div key={s.ticker} className="rounded-2xl border overflow-hidden"
              style={{ background: "#111827", borderColor: "#1f2937" }}>
              <button onClick={() => onSelectStock(s)}
                className="w-full flex items-center gap-3 p-3 text-left"
                data-testid={`row-watch-${s.ticker}`}>
                <Avatar stock={s} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-black">{s.ticker}</p>
                  <p className="text-gray-500 text-xs truncate">{s.name}</p>
                </div>
                <MiniSparkline data={miniSpark(s.price, s.changePercent)} up={s.changePercent >= 0} />
                <div className="text-right ml-2 shrink-0">
                  <p className="text-white text-sm font-bold">${fmt(s.price)}</p>
                  <PctBadge v={s.changePercent} />
                </div>
              </button>
              <div className="flex border-t" style={{ borderColor: "#1f2937" }}>
                <button onClick={() => onRemove(s.ticker)}
                  className="flex-1 py-2 text-xs text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center gap-1">
                  <StarOff className="w-3 h-3" /> Remove
                </button>
                <div className="w-px" style={{ background: "#1f2937" }} />
                <button onClick={() => onTrade(s, "buy")}
                  className="flex-1 py-2 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors">
                  Buy
                </button>
                <div className="w-px" style={{ background: "#1f2937" }} />
                <button onClick={() => onTrade(s, "sell")}
                  className="flex-1 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors">
                  Sell
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab({ orders, stocks }: { orders: TradeOrder[]; stocks: Stock[] }) {
  const [filter, setFilter] = useState<"all"|"buy"|"sell">("all");
  const stockMap = useMemo(() => new Map(stocks.map(s => [s.ticker, s])), [stocks]);
  const filtered = orders.filter(o => filter === "all" || o.type === filter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex gap-2" style={{ background: "#0a0f1a" }}>
        {(["all","buy","sell"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all"
            style={{ background: filter===f ? "var(--color-tsia-green)" : "#111827", color: filter===f ? "#fff" : "#6b7280" }}
            data-testid={`filter-orders-${f}`}>
            {f === "all" ? "All Orders" : f === "buy" ? "Buys" : "Sells"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(o => {
          const s = stockMap.get(o.ticker);
          return (
            <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl border"
              style={{ background: "#111827", borderColor: "#1f2937" }}
              data-testid={`row-order-${o.id}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${o.type==="buy" ? "bg-green-400/12" : "bg-red-400/12"}`}>
                {o.type === "buy"
                  ? <TrendingUp   className="w-4 h-4 text-green-400" />
                  : <TrendingDown className="w-4 h-4 text-red-400"   />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-black">{o.ticker}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${o.type==="buy" ? "bg-green-400/12 text-green-400" : "bg-red-400/12 text-red-400"}`}>
                    {o.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-500 text-xs">{fmtShares(o.shares)} shares @ ${fmt(parseFloat(o.priceUsd))}</p>
                <p className="text-gray-700 text-[10px]">
                  {new Date(o.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white text-sm font-bold">${fmt(parseFloat(o.totalUsd))}</p>
                <span className="text-[10px] text-green-400 flex items-center justify-end gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> filled
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-600">
            <List className="w-8 h-8" />
            <p className="text-sm">No {filter === "all" ? "" : filter} orders yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
interface ExchangeMarketProps { walletBalance?: number; onBack?: () => void; }

export default function ExchangeMarket({ onBack }: ExchangeMarketProps) {
  const [tab, setTab]               = useState<Tab>("home");
  const [selected, setSelected]     = useState<Stock | null>(null);
  const [tradeModal, setTradeModal]  = useState<{ stock: Stock; type: "buy"|"sell" } | null>(null);

  // Real data state
  const [stocks, setStocks]         = useState<Stock[]>([]);
  const [holdings, setHoldings]     = useState<Holding[]>([]);
  const [orders, setOrders]         = useState<TradeOrder[]>([]);
  const [watchlist, setWatchlist]   = useState(new Set<string>());
  const [cash, setCash]             = useState(0);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadQuotes(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/exchange/quotes");
      if (res.ok) {
        const data = await res.json();
        setStocks(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoadingStocks(false);
      if (showRefreshing) setRefreshing(false);
    }
  }

  async function loadPortfolio() {
    try {
      const res = await fetch("/api/exchange/portfolio");
      if (res.ok) {
        const data = await res.json();
        setHoldings(data.holdings ?? []);
        setCash(data.cash ?? 0);
      }
    } catch {}
  }

  async function loadOrders() {
    try {
      const res = await fetch("/api/exchange/orders");
      if (res.ok) setOrders(await res.json());
    } catch {}
  }

  async function loadWatchlist() {
    try {
      const res = await fetch("/api/exchange/watchlist");
      if (res.ok) {
        const tickers: string[] = await res.json();
        setWatchlist(new Set(tickers));
      }
    } catch {}
  }

  useEffect(() => {
    // Initial load — all in parallel
    Promise.all([loadQuotes(), loadPortfolio(), loadOrders(), loadWatchlist()]);

    // Refresh prices every 60 seconds
    refreshInterval.current = setInterval(() => loadQuotes(), 60_000);
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, []);

  const toggleWatch = useCallback(async (ticker: string) => {
    // Optimistic update
    setWatchlist(prev => {
      const n = new Set(prev);
      n.has(ticker) ? n.delete(ticker) : n.add(ticker);
      return n;
    });
    try {
      await fetch("/api/exchange/watchlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
    } catch {
      // Revert optimistic update on failure
      setWatchlist(prev => {
        const n = new Set(prev);
        n.has(ticker) ? n.delete(ticker) : n.add(ticker);
        return n;
      });
    }
  }, []);

  const confirmTrade = useCallback(async (shares: number, priceUsd: number, type: "buy"|"sell") => {
    if (!tradeModal) return;
    const res = await fetch("/api/exchange/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: tradeModal.stock.ticker, shares, type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Order failed" }));
      throw new Error(err.message ?? "Order failed");
    }
    const result = await res.json();
    setCash(result.newBalance);
    // Refresh portfolio and orders after trade
    await Promise.all([loadPortfolio(), loadOrders()]);
  }, [tradeModal]);

  const stockMap = useMemo(() => new Map(stocks.map(s => [s.ticker, s])), [stocks]);
  const currentStockLive = selected ? (stockMap.get(selected.ticker) ?? selected) : null;
  const holdingForSelected = selected ? holdings.find(h => h.ticker === selected.ticker) : undefined;

  const TABS = [
    { id: "home"      as Tab, Icon: Home,     label: "Home"      },
    { id: "market"    as Tab, Icon: BarChart3, label: "Market"    },
    { id: "portfolio" as Tab, Icon: Briefcase, label: "Portfolio" },
    { id: "watchlist" as Tab, Icon: Star,      label: "Watchlist" },
    { id: "orders"    as Tab, Icon: List,      label: "Orders"    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0f1a" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "#1a2236" }}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ background: "#111827" }} data-testid="btn-exchange-back">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          )}
          <div>
            <h2 className="text-white font-black text-base tracking-tight">Exchange Market</h2>
            <p className="text-[10px]" style={{ color: "#4b5563" }}>
              Live prices · {stocks.length} instruments
              {stocks[0]?.lastUpdated && (
                <> · updated {new Date(stocks[0].lastUpdated).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-1">
            <p className="text-[10px]" style={{ color: "#4b5563" }}>Cash</p>
            <p className="text-white text-xs font-black">${fmt(cash)}</p>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#111827" }}
            data-testid="btn-notifications">
            <Bell className="w-4 h-4" style={{ color: "#4b5563" }} />
          </button>
          <button
            onClick={() => loadQuotes(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#111827" }}
            data-testid="btn-refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-tsia-green" : ""}`} style={{ color: refreshing ? undefined : "#4b5563" }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {tab === "home" && (
          <HomeTab holdings={holdings} orders={orders} stocks={stocks} cash={cash}
            watchlistSet={watchlist} onSelectStock={s => setSelected(s)} onGoMarket={() => setTab("market")} />
        )}
        {tab === "market" && (
          <MarketTab stocks={stocks} loading={loadingStocks} onSelectStock={s => setSelected(s)} />
        )}
        {tab === "portfolio" && (
          <PortfolioTab holdings={holdings} stocks={stocks} cash={cash} onSelectStock={s => setSelected(s)} />
        )}
        {tab === "watchlist" && (
          <WatchlistTab watchlistSet={watchlist} stocks={stocks}
            onSelectStock={s => setSelected(s)}
            onRemove={toggleWatch}
            onTrade={(s, type) => setTradeModal({ stock: s, type })} />
        )}
        {tab === "orders" && <OrdersTab orders={orders} stocks={stocks} />}

        {/* Stock detail overlay */}
        <AnimatePresence>
          {selected && currentStockLive && (
            <StockDetail key={selected.ticker} stock={currentStockLive}
              inWatchlist={watchlist.has(selected.ticker)} cash={cash}
              holding={holdingForSelected}
              onBack={() => setSelected(null)}
              onToggleWatch={() => toggleWatch(selected.ticker)}
              onTrade={type => setTradeModal({ stock: currentStockLive, type })} />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="shrink-0 px-4 pb-6 pt-1" style={{ background: "#0a0f1a", borderTop: "1px solid #1a2236" }}>
        <div className="flex items-center justify-between gap-1 rounded-2xl p-1.5 relative"
          style={{ background: "#0d1525" }}>
          {TABS.map(({ id, Icon, label }) => {
            const active = tab === id && !selected;
            return (
              <button key={id} onClick={() => { setTab(id); setSelected(null); }}
                className="relative flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200"
                data-testid={`tab-${id}`}
                style={{ zIndex: 1 }}>
                {active && (
                  <motion.div layoutId="tab-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "linear-gradient(135deg, #0d2e1f 0%, #0a2419 100%)", border: "1px solid #1a4a30" }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }} />
                )}
                <div className="relative z-10 flex items-center justify-center">
                  {active && (
                    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 rounded-full blur-md"
                      style={{ background: "var(--color-tsia-green)", opacity: 0.25 }} />
                  )}
                  <Icon className="w-[18px] h-[18px] relative z-10 transition-all duration-200"
                    style={{ color: active ? "var(--color-tsia-green)" : "#374151",
                             filter: active ? "drop-shadow(0 0 6px var(--color-tsia-green))" : "none" }} />
                </div>
                <span className="relative z-10 font-bold transition-all duration-200"
                  style={{ fontSize: "9px", letterSpacing: "0.04em",
                           color: active ? "var(--color-tsia-green)" : "#374151" }}>
                  {label.toUpperCase()}
                </span>
                {active && (
                  <motion.div layoutId="tab-dot" initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="relative z-10 w-1 h-1 rounded-full"
                    style={{ background: "var(--color-tsia-green)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trade modal */}
      <AnimatePresence>
        {tradeModal && (
          <TradeModal key="modal" stock={tradeModal.stock} type={tradeModal.type} cash={cash}
            onClose={() => setTradeModal(null)}
            onConfirm={async (shares, price, type) => {
              await confirmTrade(shares, price, type);
              setTimeout(() => setTradeModal(null), 1600);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}
