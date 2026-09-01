import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Gauge,
  Loader2,
  Plus,
  Radar,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Signal = {
  id: string;
  symbol: string;
  label: string;
  direction: "long" | "short";
  entryPrice: number;
  confidence: number;
  timeframe: string;
  expiresAt: string;
};

type SignalTrade = {
  id: number;
  symbol: string;
  symbolLabel: string;
  direction: "long" | "short";
  entryPrice: string;
  exitPrice?: string | null;
  amountUsd: string;
  pnlUsd?: string | null;
  pnlPct?: string | null;
  confidence: number;
  timeframe: string;
  status: "open" | "won" | "lost" | "cancelled";
  currentPrice?: number;
  unrealizedPnlUsd?: number;
  unrealizedPnlPct?: number;
  estimatedReturnUsd?: number;
  createdAt: string;
};

function formatPrice(value: number | string | null | undefined) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return "—";
  const digits = price >= 1000 ? 2 : price >= 10 ? 3 : 5;
  return price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function refreshSignalData() {
  queryClient.invalidateQueries({ queryKey: ["/api/service-wallets", "signals"] });
  queryClient.invalidateQueries({ queryKey: ["/api/trade/signals/history"] });
}

function actionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `signal_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

export default function TradingSignals({ tradeBalance: _tradeBalance }: { tradeBalance: number }) {
  const [amount, setAmount] = useState("10");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [addTarget, setAddTarget] = useState<SignalTrade | null>(null);
  const [addAmount, setAddAmount] = useState("10");
  const [addKey, setAddKey] = useState(actionKey);
  const [closeTarget, setCloseTarget] = useState<SignalTrade | null>(null);

  const { data: signals = [], isLoading } = useQuery<Signal[]>({
    queryKey: ["/api/trade/signals"],
    refetchInterval: 30_000,
  });
  const { data: history = [], isFetching: historyRefreshing } = useQuery<SignalTrade[]>({
    queryKey: ["/api/trade/signals/history"],
    refetchInterval: 15_000,
  });
  const { data: serviceWallet } = useQuery<any>({
    queryKey: ["/api/service-wallets", "signals"],
    queryFn: async () => (await apiRequest("GET", "/api/service-wallets/signals")).json(),
    refetchInterval: 15_000,
  });
  const walletBalance = Number(serviceWallet?.balance ?? 0);
  const openTrades = useMemo(() => history.filter(trade => trade.status === "open"), [history]);
  const closedTrades = useMemo(() => history.filter(trade => trade.status !== "open"), [history]);

  const enter = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/trade/signals/enter", {
        ...selected,
        amountUsd: Number(amount),
      });
      return response.json();
    },
    onSuccess: () => {
      setSelected(null);
      setAmount("10");
      refreshSignalData();
    },
  });

  const addMargin = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/trade/signals/add/${addTarget!.id}`, {
        amountUsd: Number(addAmount),
        idempotencyKey: addKey,
      });
      return response.json();
    },
    onSuccess: () => {
      setAddTarget(null);
      setAddAmount("10");
      setAddKey(actionKey());
      refreshSignalData();
    },
  });

  const closeTrade = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/trade/signals/close/${closeTarget!.id}`, {});
      return response.json();
    },
    onSuccess: () => {
      setCloseTarget(null);
      refreshSignalData();
    },
  });

  return (
    <div className="space-y-5" data-testid="signal-trading-workspace">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-tsia-green">
            <Radar className="h-4 w-4" /> Itera signal desk
          </div>
          <h2 className="mt-2 text-2xl font-black">Trade the moment.</h2>
          <p className="text-sm text-muted-foreground">Live setups, measured risk, with control after entry.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("tsia:open-trade-mode-wallet", { detail: { mode: "signals" } }))}
          className="shrink-0 rounded-2xl border border-tsia-green/30 bg-tsia-green/10 px-3 py-2 text-right text-tsia-green"
          data-testid="itera-signals-wallet"
        >
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase">
            <WalletCards className="h-3.5 w-3.5" /> Wallet
          </span>
          <strong className="text-base">${walletBalance.toFixed(2)}</strong>
        </button>
      </header>

      {openTrades.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-tsia-green/20 bg-[#07120f] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="font-black text-white">Open signal positions</h3>
              <p className="text-[11px] text-white/45">Live P&amp;L refreshes every 15 seconds</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-tsia-green">
              <span className={`h-2 w-2 rounded-full bg-tsia-green ${historyRefreshing ? "animate-pulse" : ""}`} />
              Live
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {openTrades.map(trade => (
              <OpenSignalPosition
                key={trade.id}
                trade={trade}
                onAdd={() => {
                  setAddTarget(trade);
                  setAddAmount("10");
                  setAddKey(actionKey());
                }}
                onClose={() => setCloseTarget(trade)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-black">Available signals</h3>
            <p className="text-xs text-muted-foreground">Confidence reflects current signal strength.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold text-muted-foreground">
            {signals.length} live
          </span>
        </div>
        <div className="grid gap-3">
          {isLoading
            ? [1, 2, 3].map(item => <div key={item} className="h-52 animate-pulse rounded-2xl bg-muted/50" />)
            : signals
                .filter(signal => !hidden.includes(signal.id))
                .map((signal, index) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    index={index}
                    onEnter={() => setSelected(signal)}
                    onSkip={() => setHidden(current => [...current, signal.id])}
                  />
                ))}
        </div>
        {!isLoading && !signals.length && (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <Radar className="mx-auto mb-3 h-10 w-10 text-tsia-green/60" />
            <p className="font-bold">No signals right now</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Closed signal trades</h3>
          <span className="text-xs text-muted-foreground">Signals wallet ${walletBalance.toFixed(2)}</span>
        </div>
        {closedTrades.length === 0 ? (
          <p className="border-t border-white/10 py-6 text-center text-xs text-muted-foreground">Closed positions will appear here.</p>
        ) : closedTrades.slice(0, 10).map(trade => {
          const pnl = Number(trade.pnlUsd ?? 0);
          return (
            <div key={trade.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-white/10 py-3 text-xs">
              <div>
                <span className="font-bold">{trade.symbol}</span>
                <span className={`ml-2 uppercase ${trade.direction === "long" ? "text-tsia-green" : "text-rose-400"}`}>{trade.direction}</span>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{trade.confidence}% confidence</p>
              </div>
              <span>${Number(trade.amountUsd).toFixed(2)}</span>
              <b className={pnl >= 0 ? "text-tsia-green" : "text-rose-400"}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </b>
            </div>
          );
        })}
      </section>

      <AnimatePresence>
        {selected && (
          <TradeDialog title={`Enter ${selected.symbol}`} onClose={() => setSelected(null)}>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-3 text-xs">
              <div><span className="text-white/45">Direction</span><p className="mt-1 font-black uppercase">{selected.direction}</p></div>
              <div><span className="text-white/45">Confidence</span><p className="mt-1 font-black text-tsia-green">{selected.confidence}%</p></div>
              <div><span className="text-white/45">Entry</span><p className="mt-1 font-mono font-bold">${formatPrice(selected.entryPrice)}</p></div>
              <div><span className="text-white/45">Timeframe</span><p className="mt-1 font-bold">{selected.timeframe}</p></div>
            </div>
            <AmountField value={amount} onChange={setAmount} walletBalance={walletBalance} autoFocus />
            <DialogError error={enter.error} />
            <div className="mt-5 flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm">Cancel</button>
              <button
                disabled={enter.isPending || Number(amount) < 1 || Number(amount) > walletBalance}
                onClick={() => enter.mutate()}
                className="flex flex-1 items-center justify-center rounded-xl bg-tsia-green p-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {enter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm trade"}
              </button>
            </div>
          </TradeDialog>
        )}

        {addTarget && (
          <TradeDialog title={`Add to ${addTarget.symbol}`} onClose={() => setAddTarget(null)}>
            <p className="text-sm leading-6 text-white/60">
              Added money enters at the latest market price. Your average entry price and live P&amp;L will update automatically.
            </p>
            <AmountField value={addAmount} onChange={setAddAmount} walletBalance={walletBalance} autoFocus />
            <DialogError error={addMargin.error} />
            <div className="mt-5 flex gap-2">
              <button onClick={() => setAddTarget(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm">Cancel</button>
              <button
                disabled={addMargin.isPending || Number(addAmount) < 1 || Number(addAmount) > walletBalance}
                onClick={() => addMargin.mutate()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-tsia-green p-3 text-sm font-bold text-white disabled:opacity-40"
                data-testid={`signal-add-confirm-${addTarget.id}`}
              >
                {addMargin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add money</>}
              </button>
            </div>
          </TradeDialog>
        )}

        {closeTarget && (
          <TradeDialog title={`Close ${closeTarget.symbol}?`} onClose={() => setCloseTarget(null)}>
            <p className="text-sm leading-6 text-white/60">
              The position will settle at the latest provider price. Your stake plus profit or loss will return to your Signals wallet.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40">Current unrealized P&amp;L</p>
              <p className={`mt-1 text-2xl font-black ${(closeTarget.unrealizedPnlUsd ?? 0) >= 0 ? "text-tsia-green" : "text-rose-400"}`}>
                {(closeTarget.unrealizedPnlUsd ?? 0) >= 0 ? "+" : "-"}${Math.abs(closeTarget.unrealizedPnlUsd ?? 0).toFixed(2)}
              </p>
            </div>
            <DialogError error={closeTrade.error} />
            <div className="mt-5 flex gap-2">
              <button onClick={() => setCloseTarget(null)} className="flex-1 rounded-xl border border-white/10 p-3 text-sm">Keep open</button>
              <button
                disabled={closeTrade.isPending}
                onClick={() => closeTrade.mutate()}
                className="flex flex-1 items-center justify-center rounded-xl bg-rose-500 p-3 text-sm font-bold text-white disabled:opacity-40"
                data-testid={`signal-close-confirm-${closeTarget.id}`}
              >
                {closeTrade.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Close and settle"}
              </button>
            </div>
          </TradeDialog>
        )}
      </AnimatePresence>
    </div>
  );
}

function SignalCard({ signal, index, onEnter, onSkip }: { signal: Signal; index: number; onEnter: () => void; onSkip: () => void }) {
  const [left, setLeft] = useState(Math.max(0, Math.floor((new Date(signal.expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft(Math.max(0, Math.floor((new Date(signal.expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [signal.expiresAt]);
  const isLong = signal.direction === "long";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * .07 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl"
      data-testid={`signal-card-${signal.id}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-black">
            {signal.symbol}
            <span className="text-xs font-medium text-muted-foreground">{signal.label}</span>
          </div>
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${isLong ? "bg-tsia-green/15 text-tsia-green" : "bg-rose-400/15 text-rose-400"}`}>
            {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {signal.direction.toUpperCase()}
          </span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <Clock3 className="ml-auto mb-1 h-4 w-4" />
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/5 bg-black/10 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-bold text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Signal confidence</span>
          <strong className="text-base text-tsia-green" data-testid={`signal-confidence-${signal.id}`}>{signal.confidence}%</strong>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-tsia-green" style={{ width: `${Math.max(0, Math.min(100, signal.confidence))}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Entry ${formatPrice(signal.entryPrice)}</span>
          <span>{signal.timeframe} setup</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button disabled={left <= 0} onClick={onEnter} className="flex-1 rounded-xl bg-tsia-green py-2.5 text-xs font-bold text-white disabled:opacity-40">Enter Trade</button>
        <button onClick={onSkip} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">Skip</button>
      </div>
    </motion.article>
  );
}

function OpenSignalPosition({ trade, onAdd, onClose }: { trade: SignalTrade; onAdd: () => void; onClose: () => void }) {
  const pnl = trade.unrealizedPnlUsd;
  const positive = (pnl ?? 0) >= 0;
  const feedAvailable = pnl != null && trade.currentPrice != null;
  return (
    <article className="p-4" data-testid={`open-signal-position-${trade.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-white">{trade.symbol}</h4>
            <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${trade.direction === "long" ? "bg-tsia-green/15 text-tsia-green" : "bg-rose-400/15 text-rose-400"}`}>
              {trade.direction}
            </span>
            <span className="rounded bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">{trade.confidence}% confidence</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">{trade.symbolLabel} · {trade.timeframe}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-white/35">Unrealized P&amp;L</p>
          <p className={`mt-1 text-xl font-black ${!feedAvailable ? "text-white/50" : positive ? "text-tsia-green" : "text-rose-400"}`}>
            {!feedAvailable ? "Price unavailable" : `${positive ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
          </p>
          {feedAvailable && <p className={`text-[10px] font-bold ${positive ? "text-tsia-green/70" : "text-rose-400/70"}`}>{positive ? "+" : ""}{Number(trade.unrealizedPnlPct).toFixed(3)}%</p>}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Invested" value={`$${Number(trade.amountUsd).toFixed(2)}`} />
        <Stat label="Average entry" value={`$${formatPrice(trade.entryPrice)}`} />
        <Stat label="Current price" value={trade.currentPrice ? `$${formatPrice(trade.currentPrice)}` : "Delayed"} />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onAdd}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-tsia-green/30 bg-tsia-green/10 py-2.5 text-xs font-bold text-tsia-green"
          data-testid={`signal-add-${trade.id}`}
        >
          <Plus className="h-3.5 w-3.5" /> Add money
        </button>
        <button
          onClick={onClose}
          disabled={!feedAvailable}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 py-2.5 text-xs font-bold text-rose-300 disabled:opacity-40"
          data-testid={`signal-close-${trade.id}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Close trade
        </button>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/5 bg-white/[.035] p-2.5"><p className="text-[9px] uppercase tracking-wide text-white/35">{label}</p><p className="mt-1 truncate font-mono text-[11px] font-bold text-white/80">{value}</p></div>;
}

function AmountField({ value, onChange, walletBalance, autoFocus = false }: { value: string; onChange: (value: string) => void; walletBalance: number; autoFocus?: boolean }) {
  return (
    <label className="mt-5 block text-xs font-bold uppercase text-white/45">
      Amount (USD)
      <span className="float-right normal-case">Available ${walletBalance.toFixed(2)}</span>
      <input
        autoFocus={autoFocus}
        type="number"
        min="1"
        max={walletBalance}
        step="0.01"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 p-3 text-lg text-white outline-none focus:border-tsia-green/50"
      />
    </label>
  );
}

function DialogError({ error }: { error: Error | null }) {
  return error ? <p className="mt-3 rounded-lg bg-rose-400/10 p-2 text-xs text-rose-300">{error.message}</p> : null;
}

function TradeDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: .96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .96, y: 12 }}
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 text-white shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black">{title}</h3>
          <button onClick={onClose} className="rounded-lg bg-white/10 p-2 text-white/60 hover:text-white" aria-label="Close dialog"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}