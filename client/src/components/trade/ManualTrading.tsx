import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, CandlestickChart, ChevronDown, CircleDollarSign, Search,
  ShieldCheck, TrendingDown, TrendingUp, WalletCards, X,
} from "lucide-react";
import MarketChart from "./MarketChart";

type Category = "Crypto" | "Forex" | "Commodities" | "Indices" | "Stocks";
interface Sym { s: string; l: string; label: string; cat: Category; flag?: string }

const SYMBOLS: Sym[] = [
  { s: "BTC-USD", l: "BTC", label: "Bitcoin", cat: "Crypto", flag: "₿" },
  { s: "ETH-USD", l: "ETH", label: "Ethereum", cat: "Crypto", flag: "Ξ" },
  { s: "BNB-USD", l: "BNB", label: "BNB", cat: "Crypto", flag: "◈" },
  { s: "SOL-USD", l: "SOL", label: "Solana", cat: "Crypto", flag: "◎" },
  { s: "XRP-USD", l: "XRP", label: "Ripple", cat: "Crypto", flag: "✕" },
  { s: "ADA-USD", l: "ADA", label: "Cardano", cat: "Crypto", flag: "₳" },
  { s: "DOGE-USD", l: "DOGE", label: "Dogecoin", cat: "Crypto", flag: "Ð" },
  { s: "AVAX-USD", l: "AVAX", label: "Avalanche", cat: "Crypto", flag: "△" },
  { s: "DOT-USD", l: "DOT", label: "Polkadot", cat: "Crypto", flag: "●" },
  { s: "LINK-USD", l: "LINK", label: "Chainlink", cat: "Crypto", flag: "⬡" },
  { s: "EURUSD=X", l: "EUR/USD", label: "Euro / US Dollar", cat: "Forex", flag: "EU" },
  { s: "GBPUSD=X", l: "GBP/USD", label: "British Pound / US Dollar", cat: "Forex", flag: "GB" },
  { s: "JPY=X", l: "USD/JPY", label: "US Dollar / Japanese Yen", cat: "Forex", flag: "JP" },
  { s: "AUDUSD=X", l: "AUD/USD", label: "Aussie / US Dollar", cat: "Forex", flag: "AU" },
  { s: "CAD=X", l: "USD/CAD", label: "US Dollar / Canadian Dollar", cat: "Forex", flag: "CA" },
  { s: "NZDUSD=X", l: "NZD/USD", label: "Kiwi / US Dollar", cat: "Forex", flag: "NZ" },
  { s: "EURGBP=X", l: "EUR/GBP", label: "Euro / British Pound", cat: "Forex", flag: "EU" },
  { s: "CHF=X", l: "USD/CHF", label: "US Dollar / Swiss Franc", cat: "Forex", flag: "CH" },
  { s: "EURJPY=X", l: "EUR/JPY", label: "Euro / Japanese Yen", cat: "Forex", flag: "JP" },
  { s: "GBPJPY=X", l: "GBP/JPY", label: "Pound / Japanese Yen", cat: "Forex", flag: "GB" },
  { s: "GC=F", l: "GOLD", label: "Gold", cat: "Commodities", flag: "AU" },
  { s: "SI=F", l: "SILVER", label: "Silver", cat: "Commodities", flag: "AG" },
  { s: "CL=F", l: "WTI OIL", label: "Crude Oil (WTI)", cat: "Commodities", flag: "WTI" },
  { s: "BZ=F", l: "BRENT", label: "Brent Crude", cat: "Commodities", flag: "BR" },
  { s: "NG=F", l: "NAT GAS", label: "Natural Gas", cat: "Commodities", flag: "NG" },
  { s: "HG=F", l: "COPPER", label: "Copper", cat: "Commodities", flag: "CU" },
  { s: "PL=F", l: "PLATINUM", label: "Platinum", cat: "Commodities", flag: "PT" },
  { s: "^GSPC", l: "S&P 500", label: "S&P 500", cat: "Indices", flag: "US" },
  { s: "^IXIC", l: "NASDAQ", label: "NASDAQ 100", cat: "Indices", flag: "US" },
  { s: "^DJI", l: "DOW", label: "Dow Jones", cat: "Indices", flag: "US" },
  { s: "^RUT", l: "RUSSELL", label: "Russell 2000", cat: "Indices", flag: "US" },
  { s: "^FTSE", l: "FTSE 100", label: "FTSE 100", cat: "Indices", flag: "GB" },
  { s: "^GDAXI", l: "DAX", label: "DAX 40", cat: "Indices", flag: "DE" },
  { s: "^N225", l: "NIKKEI", label: "Nikkei 225", cat: "Indices", flag: "JP" },
  { s: "^HSI", l: "HANG SENG", label: "Hang Seng", cat: "Indices", flag: "HK" },
  { s: "AAPL", l: "AAPL", label: "Apple Inc.", cat: "Stocks", flag: "AP" },
  { s: "MSFT", l: "MSFT", label: "Microsoft", cat: "Stocks", flag: "MS" },
  { s: "NVDA", l: "NVDA", label: "NVIDIA", cat: "Stocks", flag: "NV" },
  { s: "TSLA", l: "TSLA", label: "Tesla", cat: "Stocks", flag: "TS" },
  { s: "AMZN", l: "AMZN", label: "Amazon", cat: "Stocks", flag: "AM" },
  { s: "META", l: "META", label: "Meta Platforms", cat: "Stocks", flag: "ME" },
  { s: "GOOGL", l: "GOOGL", label: "Alphabet (Google)", cat: "Stocks", flag: "GO" },
  { s: "JPM", l: "JPM", label: "JPMorgan Chase", cat: "Stocks", flag: "JP" },
];
const CATS: Category[] = ["Crypto", "Forex", "Commodities", "Indices", "Stocks"];
const accent: Record<Category, string> = {
  Crypto: "text-[#d7b66a] border-[#d7b66a]/30 bg-[#d7b66a]/10",
  Forex: "text-sky-300 border-sky-300/30 bg-sky-300/10",
  Commodities: "text-orange-300 border-orange-300/30 bg-orange-300/10",
  Indices: "text-violet-300 border-violet-300/30 bg-violet-300/10",
  Stocks: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10",
};

function SymbolPicker({ value, onSelect, onClose }: { value: string; onSelect: (s: Sym) => void; onClose: () => void }) {
  const [cat, setCat] = useState<Category>(SYMBOLS.find(s => s.s === value)?.cat ?? "Crypto");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => query.trim()
    ? SYMBOLS.filter(s => `${s.label} ${s.l}`.toLowerCase().includes(query.toLowerCase()))
    : SYMBOLS.filter(s => s.cat === cat), [query, cat]);
  return <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] bg-[#061018]/80 backdrop-blur-sm" />
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className="fixed bottom-0 left-0 right-0 z-[61] flex h-[88dvh] flex-col rounded-t-[28px] border border-white/10 bg-[#101a22] shadow-2xl">
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/20" />
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#d7b66a]">Instrument directory</p><h3 className="mt-1 text-xl font-bold text-white">Select market</h3></div>
        <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/15" aria-label="Close market selector"><X className="h-4 w-4" /></button>
      </div>
      <div className="relative mx-5 mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search symbol or name" className="w-full rounded-xl border border-white/10 bg-[#071219] py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-[#d7b66a]/60" /></div>
      {!query && <div className="flex gap-2 overflow-x-auto px-5 pb-4 scrollbar-none">{CATS.map(item => <button key={item} onClick={() => setCat(item)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${cat === item ? "bg-[#d7b66a] text-[#101a22]" : "bg-white/5 text-white/50"}`}>{item}</button>)}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{visible.map(sym => <button key={sym.s} onClick={() => { onSelect(sym); onClose(); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-transform active:scale-[.98] ${sym.s === value ? accent[sym.cat] : "border-white/8 bg-white/[.035] text-white"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[10px] font-black">{sym.flag ?? sym.l[0]}</span><span className="min-w-0"><b className="block truncate text-sm">{sym.l}</b><small className="block truncate text-white/40">{sym.label}</small></span>{sym.s === value && <span className="ml-auto h-2 w-2 rounded-full bg-current" />}</button>)}</div>{!visible.length && <p className="py-10 text-center text-sm text-white/40">No matching instruments.</p>}</div>
    </motion.div>
  </>;
}

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
  const { data: serviceWallet } = useQuery<any>({ queryKey: ["/api/service-wallets", "manual"], queryFn: async () => (await apiRequest("GET", "/api/service-wallets/manual")).json(), refetchInterval: 15000 });
  const walletBalance = Number(serviceWallet?.balance ?? tradeBalance ?? 0);
  const openPos = useMutation({ mutationFn: () => apiRequest("POST", "/api/trade/manual/open", { symbol: selected.s, symbolLabel: selected.label, direction, leverage, marginUsd: Number(margin), stopLossPrice: stopLoss ? Number(stopLoss) : undefined, takeProfitPrice: takeProfit ? Number(takeProfit) : undefined }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/trade/manual/positions"] }); queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] }); queryClient.invalidateQueries({ queryKey: ["/api/service-wallets", "manual"] }); setMargin("10"); setStopLoss(""); setTakeProfit(""); } });
  const closePos = useMutation({ mutationFn: (id: number) => apiRequest("POST", `/api/trade/manual/close/${id}`, {}), onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ["/api/trade/manual/positions"] }); queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] }); queryClient.invalidateQueries({ queryKey: ["/api/service-wallets", "manual"] }); setCloseConfirm(null); setCloseResult(data); } });
  const currentPrice = prices.find((p: any) => p.symbol === selected.s)?.price;
  const posSize = Number(margin) * leverage;
  const open = positions.filter((p: any) => p.status === "open");
  const closed = positions.filter((p: any) => p.status !== "open").slice(0, 10);
  const leverageLabel = leverage <= 2 ? "Conservative" : leverage <= 5 ? "Balanced" : "Aggressive";
  const fmt = (value: any) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

  return <div className="trade-market-shell min-h-[100dvh] space-y-4 pb-8 text-foreground">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/10 pb-4">
      <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-tsia-gold"><CandlestickChart className="h-4 w-4" /> Manual desk <span className="text-muted-foreground/60">/ perpetuals</span></div><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Trade with a clear view.</h2><p className="mt-1 text-sm text-muted-foreground">Real instruments. Transparent exposure. Your decision.</p></div>
      <button onClick={() => window.dispatchEvent(new CustomEvent("tsia:open-trade-mode-wallet", { detail: { mode: "manual" } }))} data-testid="manual-trading-wallet" className="flex items-center gap-3 rounded-xl border border-tsia-gold/30 bg-tsia-gold/[.08] px-3 py-2 text-right transition-colors hover:bg-tsia-gold/[.14]"><WalletCards className="h-4 w-4 text-tsia-gold" /><span><small className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Trade wallet</small><strong className="font-mono text-sm text-tsia-gold">${walletBalance.toFixed(2)}</strong></span></button>
    </header>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-foreground/10 bg-foreground/10"><div className="bg-card/70 p-3"><small className="block text-[9px] uppercase tracking-widest text-muted-foreground">Instrument</small><b className="mt-1 block text-sm">{selected.l}</b></div><div className="bg-card/70 p-3"><small className="block text-[9px] uppercase tracking-widest text-muted-foreground">Mark price</small><b className="mt-1 block font-mono text-sm">{currentPrice ? `$${fmt(currentPrice)}` : "—"}</b></div><div className="bg-card/70 p-3"><small className="block text-[9px] uppercase tracking-widest text-muted-foreground">Open positions</small><b className="mt-1 block text-sm">{open.length}</b></div></div>
        <MarketChart symbol={selected.s} />
        <Positions open={open} prices={prices} onClose={setCloseConfirm} fmt={fmt} />
        {closed.length > 0 && <section className="rounded-xl border border-foreground/10 bg-card/60 p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Recent settlements</h3><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Last {closed.length}</span></div>{closed.map((p: any) => <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-foreground/8 py-3 text-xs"><span className="font-bold">{p.symbol} <em className={p.direction === "long" ? "text-tsia-green" : "text-rose-400"}>{p.direction}</em> {p.leverage}×</span><span className="text-muted-foreground">${Number(p.marginUsd).toFixed(2)}</span><b className={Number(p.pnlUsd) >= 0 ? "text-tsia-green" : "text-rose-400"}>{Number(p.pnlUsd) >= 0 ? "+" : ""}${Number(p.pnlUsd ?? 0).toFixed(2)}</b></div>)}</section>}
      </div>
      <motion.section initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl border border-foreground/10 bg-card/80 p-4 shadow-xl shadow-black/10 xl:sticky xl:top-4">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-tsia-gold">Order entry</p><h3 className="mt-1 text-lg font-bold">Open position</h3></div><span className="flex items-center gap-1 text-[10px] text-tsia-green"><Activity className="h-3 w-3" /> Market live</span></div>
        <button onClick={() => setPickerOpen(true)} className="flex w-full items-center gap-3 rounded-xl border border-foreground/10 bg-background/70 p-3 text-left hover:border-tsia-gold/40"><span className={`grid h-10 w-10 place-items-center rounded-lg border text-xs font-black ${accent[selected.cat]}`}>{selected.flag ?? selected.l[0]}</span><span className="min-w-0 flex-1"><small className="block text-[9px] uppercase tracking-widest text-muted-foreground">{selected.cat}</small><b className="block truncate text-sm">{selected.label}</b><span className="font-mono text-[10px] text-muted-foreground">{selected.s}</span></span><ChevronDown className="h-4 w-4 text-muted-foreground" /></button>
        <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setDirection("long")} className={`rounded-lg py-3 text-xs font-black transition-colors ${direction === "long" ? "bg-tsia-green text-white" : "bg-tsia-green/10 text-tsia-green hover:bg-tsia-green/20"}`}><TrendingUp className="mr-1 inline h-4 w-4" /> LONG</button><button onClick={() => setDirection("short")} className={`rounded-lg py-3 text-xs font-black transition-colors ${direction === "short" ? "bg-rose-500 text-white" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"}`}><TrendingDown className="mr-1 inline h-4 w-4" /> SHORT</button></div>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Margin · available <span className="font-mono text-foreground">${walletBalance.toFixed(2)}</span><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span><input type="number" min="1" max={walletBalance} value={margin} onChange={e => setMargin(e.target.value)} className="w-full rounded-lg border border-foreground/10 bg-background py-3 pl-7 pr-3 font-mono text-sm outline-none focus:border-tsia-gold/60" /></div></label>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leverage <span className="font-mono text-foreground">{leverage}×</span><span className={`float-right normal-case tracking-normal ${leverage > 5 ? "text-rose-400" : "text-tsia-green"}`}>{leverageLabel}</span><input type="range" min="1" max="10" value={leverage} onChange={e => setLeverage(Number(e.target.value))} className="mt-3 w-full accent-[hsl(var(--tsia-gold))]" /><span className="mt-1 flex justify-between text-[9px] font-normal normal-case tracking-normal"><span>1×</span><span>5×</span><span>10×</span></span></label>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-foreground/8 bg-background/60 p-3 text-xs"><span className="text-muted-foreground">Position size</span><b className="text-right font-mono">${posSize.toFixed(2)}</b><span className="text-muted-foreground">Max loss</span><b className="text-right font-mono text-rose-400">${Number(margin).toFixed(2)}</b></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-[10px] text-muted-foreground">Stop loss<input type="number" placeholder="Optional" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/10 bg-background p-2.5 text-xs outline-none focus:border-rose-400/60" /></label><label className="text-[10px] text-muted-foreground">Take profit<input type="number" placeholder="Optional" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/10 bg-background p-2.5 text-xs outline-none focus:border-tsia-green/60" /></label></div>
        <button disabled={openPos.isPending || Number(margin) <= 0 || Number(margin) > walletBalance} onClick={() => openPos.mutate()} className={`mt-5 w-full rounded-lg py-3.5 text-xs font-black tracking-wide transition-opacity disabled:opacity-40 ${direction === "long" ? "bg-tsia-green text-white" : "bg-rose-500 text-white"}`}>{openPos.isPending ? "Opening position…" : `Open ${leverage}× ${direction.toUpperCase()} · ${selected.l}`}</button>
        {openPos.isError && <p className="mt-2 text-center text-xs text-rose-400">{(openPos.error as any)?.message ?? "Failed to open position"}</p>}
        <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3 text-tsia-green" /> Margin is reserved from your trade wallet</p>
      </motion.section>
    </div>
    <AnimatePresence>{pickerOpen && <SymbolPicker value={selected.s} onSelect={setSelected} onClose={() => setPickerOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{closeConfirm !== null && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-[#061018]/80 p-4 backdrop-blur-sm"><motion.div initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101a22] p-5 shadow-2xl"><div className="flex justify-between"><div><p className="text-[10px] uppercase tracking-widest text-rose-400">Risk action</p><h3 className="mt-1 text-lg font-bold text-white">Close position?</h3></div><button onClick={() => setCloseConfirm(null)} className="text-white/50"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-6 text-white/60">This will settle the position at the current market price and return the result to your Trade Wallet.</p><div className="mt-5 flex gap-2"><button onClick={() => setCloseConfirm(null)} className="flex-1 rounded-lg border border-white/10 py-3 text-xs text-white">Cancel</button><button disabled={closePos.isPending} onClick={() => closePos.mutate(closeConfirm)} className="flex-1 rounded-lg bg-rose-500 py-3 text-xs font-bold text-white disabled:opacity-40">{closePos.isPending ? "Closing…" : "Close at market"}</button></div></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{closeResult && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold shadow-xl ${Number(closeResult.pnlUsd) >= 0 ? "border-tsia-green/30 bg-tsia-green/15 text-tsia-green" : "border-rose-400/30 bg-rose-400/15 text-rose-300"}`}>{Number(closeResult.pnlUsd) >= 0 ? "Position settled in profit" : "Position settled at a loss"} · ${Math.abs(Number(closeResult.pnlUsd)).toFixed(2)}<button onClick={() => setCloseResult(null)}><X className="h-3 w-3" /></button></motion.div>}</AnimatePresence>
  </div>;
}

function Positions({ open, prices, onClose, fmt }: { open: any[]; prices: any[]; onClose: (id: number) => void; fmt: (value: any) => string }) {
  return <section className="rounded-xl border border-foreground/10 bg-card/60 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Open positions <span className="ml-1 font-mono text-xs text-muted-foreground">({open.length})</span></h3><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Unrealized P&amp;L</span></div>{!open.length ? <div className="grid place-items-center rounded-lg border border-dashed border-foreground/10 py-8 text-center"><CircleDollarSign className="mb-2 h-6 w-6 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">No open positions yet.</p></div> : <div className="space-y-2">{open.map(p => { const entry = Number(p.entryPrice); const live = Number(prices.find((x: any) => x.symbol === p.symbol)?.price ?? entry); const qty = Number(p.marginUsd) * Number(p.leverage) / entry; const pnl = p.direction === "long" ? (live - entry) * qty : (entry - live) * qty; return <div key={p.id} className={`rounded-lg border p-3 ${pnl >= 0 ? "border-tsia-green/20 bg-tsia-green/[.04]" : "border-rose-400/20 bg-rose-400/[.04]"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><b className="text-sm">{p.symbol}</b><span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${p.direction === "long" ? "bg-tsia-green/15 text-tsia-green" : "bg-rose-400/15 text-rose-400"}`}>{p.direction.toUpperCase()} {p.leverage}×</span></div><p className="mt-2 font-mono text-[10px] text-muted-foreground">Entry {fmt(entry)} · Live {fmt(live)} · Margin ${Number(p.marginUsd).toFixed(2)}</p></div><div className="text-right"><b className={`font-mono text-sm ${pnl >= 0 ? "text-tsia-green" : "text-rose-400"}`}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</b><button onClick={() => onClose(p.id)} className="mt-2 block rounded-md bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20">Close</button></div></div></div> })}</div>}</section>;
}