import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, CandlestickChart, ShieldAlert, X } from "lucide-react";

const SYMBOLS = [
  { s: "BTC-USD", l: "BTC", label: "Bitcoin" },
  { s: "ETH-USD", l: "ETH", label: "Ethereum" },
  { s: "BNB-USD", l: "BNB", label: "BNB" },
  { s: "SOL-USD", l: "SOL", label: "Solana" },
  { s: "XRP-USD", l: "XRP", label: "Ripple" },
  { s: "AAPL", l: "AAPL", label: "Apple" },
  { s: "TSLA", l: "TSLA", label: "Tesla" },
  { s: "NVDA", l: "NVDA", label: "NVIDIA" },
];

export default function ManualTrading({ tradeBalance }: { tradeBalance: number }) {
  const [symbol, setSymbol] = useState(SYMBOLS[0].s);
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
      symbol,
      symbolLabel: SYMBOLS.find(s => s.s === symbol)?.label ?? symbol,
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

  const currentPrice = (prices as any[]).find(p => p.symbol === symbol)?.price;
  const posSize = Number(margin) * leverage;
  const leverageLabel = leverage <= 2 ? "Safe" : leverage <= 5 ? "Moderate" : "High Risk";
  const leverageColor = leverage <= 2 ? "text-tsia-green" : leverage <= 5 ? "text-tsia-gold" : "text-rose-400";

  const open = (positions as any[]).filter(p => p.status === "open");
  const closed = (positions as any[]).filter(p => p.status !== "open").slice(0, 10);

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-tsia-gold">
          <CandlestickChart className="h-4 w-4" /> Manual Desk
        </div>
        <h2 className="mt-2 text-2xl font-black">Make your own market.</h2>
        <p className="text-sm text-muted-foreground">Trade real instruments. Win or lose — it's your call.</p>
      </header>

      {/* Order Entry */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl"
      >
        {/* Symbol picker */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SYMBOLS.map(x => (
            <button key={x.s} onClick={() => setSymbol(x.s)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${symbol === x.s ? "bg-tsia-green text-white shadow-lg shadow-tsia-green/20" : "bg-white/10 hover:bg-white/20"}`}>
              {x.l}
            </button>
          ))}
        </div>

        {/* Live price */}
        <div className="mt-5 flex items-end gap-3">
          <span className="text-4xl font-black">
            ${currentPrice ? Number(currentPrice).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
          </span>
          <span className="mb-1 text-sm text-muted-foreground">{SYMBOLS.find(s => s.s === symbol)?.label}</span>
        </div>

        {/* Direction */}
        <div className="mt-5 grid grid-cols-2 gap-2">
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

        {/* Position size */}
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

        <button disabled={openPos.isPending || Number(margin) < 1 || Number(margin) > tradeBalance}
          onClick={() => openPos.mutate()}
          className={`mt-5 w-full rounded-xl p-3.5 font-bold text-white transition-all disabled:opacity-40 ${direction === "long" ? "bg-tsia-green shadow-lg shadow-tsia-green/20" : "bg-rose-500 shadow-lg shadow-rose-500/20"}`}>
          {openPos.isPending ? "Opening…" : `Open ${direction.toUpperCase()} Position`}
        </button>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-400/10 p-3 text-xs text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Trading with leverage can result in significant losses. Only trade what you can afford to lose.
        </div>
      </motion.section>

      {/* Open positions */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl">
        <h3 className="font-bold">Open Positions <span className="ml-1 rounded-full bg-tsia-green/20 px-2 py-0.5 text-xs text-tsia-green">{open.length}</span></h3>
        {open.length === 0 ? (
          <div className="py-10 text-center">
            <CandlestickChart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No open positions yet.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {open.map((p: any) => {
              const cp = (prices as any[]).find(x => x.symbol === p.symbol)?.price;
              const pct = cp ? (Number(cp) - Number(p.entryPrice)) / Number(p.entryPrice) * (p.direction === "long" ? 1 : -1) : 0;
              const unrealizedPnl = Number(p.sizeUsd) * pct;
              return (
                <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-black text-sm">{p.symbol}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.direction === "long" ? "bg-tsia-green/20 text-tsia-green" : "bg-rose-400/20 text-rose-400"}`}>
                        {p.direction.toUpperCase()} {p.leverage}×
                      </span>
                    </div>
                    <button onClick={() => setCloseConfirm(p.id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/30 transition-colors">
                      Close
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Entry</span><b className="block">${Number(p.entryPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</b></div>
                    <div><span className="text-muted-foreground">Size</span><b className="block">${Number(p.sizeUsd).toFixed(2)}</b></div>
                    <div><span className="text-muted-foreground">Unrealized P&L</span>
                      <b className={`block ${unrealizedPnl >= 0 ? "text-tsia-green" : "text-rose-400"}`}>
                        {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
                      </b>
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
              <span className="font-bold">{p.symbol} <em className={p.direction === "long" ? "text-tsia-green" : "text-rose-400"}>{p.direction}</em> {p.leverage}×</span>
              <span className="text-muted-foreground">${Number(p.marginUsd).toFixed(2)} margin</span>
              <b className={Number(p.pnlUsd) >= 0 ? "text-tsia-green" : "text-rose-400"}>
                {Number(p.pnlUsd) >= 0 ? "+" : ""}${Number(p.pnlUsd ?? 0).toFixed(2)}
              </b>
            </div>
          ))}
        </section>
      )}

      {/* Close confirm dialog */}
      <AnimatePresence>
        {closeConfirm !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Close Position</h3>
                <button onClick={() => setCloseConfirm(null)}><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">This will close your position at the current market price. Your P&L will be settled to your Trade Wallet.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setCloseConfirm(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm">Cancel</button>
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
