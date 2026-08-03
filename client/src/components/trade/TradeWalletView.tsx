import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Link2, Eye, EyeOff, TrendingUp, Shield, RefreshCw, RefreshCcw,
} from "lucide-react";

const MAX_TOPUPS = 3;

interface TradeWalletViewProps {
  onDeposit: () => void;
  onWithdraw: () => void;
  onFund: () => void;
  onConnect: () => void;
  onReinvest: () => void;
}

export default function TradeWalletView({ onDeposit, onWithdraw, onFund, onConnect, onReinvest }: TradeWalletViewProps) {
  const [hidden, setHidden] = useState(false);
  const { data: wallet, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/trade/wallet"],
    refetchInterval: 15000,
  });
  const { data: txs = [] } = useQuery<any[]>({
    queryKey: ["/api/trade/transactions"],
    refetchInterval: 30000,
  });

  const tradeBalance    = parseFloat(wallet?.tradeBalance ?? "0");
  const lockedPrincipal = parseFloat(wallet?.lockedPrincipal ?? "0");
  const totalEarnings   = parseFloat(wallet?.totalBotEarnings ?? "0");
  const withdrawable    = Math.max(0, tradeBalance - lockedPrincipal);
  const profitTarget    = lockedPrincipal * 2;
  const returnPct       = profitTarget > 0 ? Math.min(100, (totalEarnings / profitTarget) * 100) : 0;
  const hasWallet       = wallet?.trc20Address || wallet?.bep20Address;
  const depositCount    = wallet?.depositCount ?? 0;
  const topupsLeft      = Math.max(0, MAX_TOPUPS - depositCount);
  const limitReached    = depositCount >= MAX_TOPUPS;

  const fmt = (n: number) => hidden ? "••••••" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const actions = [
    {
      id: "deposit",
      label: "Deposit",
      sublabel: "Via crypto (TRC20/BEP20)",
      icon: ArrowDownToLine,
      color: limitReached
        ? "bg-slate-400/10 text-slate-400 border-slate-400/20 opacity-50 cursor-not-allowed"
        : "bg-tsia-green/15 text-tsia-green border-tsia-green/30",
      iconBg: limitReached ? "bg-slate-600" : "bg-tsia-green",
      onClick: limitReached ? undefined : onDeposit,
      badge: !limitReached ? `${topupsLeft} left` : null,
    },
    {
      id: "fund",
      label: limitReached ? "Re-invest" : "Top Up",
      sublabel: limitReached ? "Roll earnings into principal" : `From SwiftWallet · ${topupsLeft} left`,
      icon: limitReached ? RefreshCcw : Wallet,
      color: limitReached
        ? "bg-tsia-gold/15 text-tsia-gold border-tsia-gold/30"
        : "bg-tsia-gold/15 text-tsia-gold border-tsia-gold/30",
      iconBg: "bg-tsia-gold",
      onClick: limitReached ? onReinvest : onFund,
    },
    {
      id: "withdraw",
      label: "Withdraw",
      sublabel: "Earnings to wallet/bank",
      icon: ArrowUpFromLine,
      color: "bg-blue-400/15 text-blue-400 border-blue-400/30",
      iconBg: "bg-blue-500",
      onClick: onWithdraw,
    },
    {
      id: "connect",
      label: hasWallet ? "Exchange Wallet" : "Connect Wallet",
      sublabel: hasWallet ? "TRC20/BEP20 connected" : "Link your exchange address",
      icon: hasWallet ? Link2 : ArrowLeftRight,
      color: hasWallet
        ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
        : "bg-slate-400/15 text-slate-300 border-slate-400/30",
      iconBg: hasWallet ? "bg-emerald-500" : "bg-slate-600",
      onClick: onConnect,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-tsia-green">
            <Wallet className="h-4 w-4" /> Trade Wallet
          </div>
          <h2 className="mt-1 text-2xl font-black">Your Funds</h2>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </header>

      {/* Top-up usage indicator */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-white/40" />
          <span className="text-xs text-white/50">Top-up slots used</span>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: MAX_TOPUPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-5 rounded-full transition-colors ${
                i < depositCount ? "bg-tsia-gold" : "bg-white/15"
              }`}
            />
          ))}
          <span className={`ml-1 text-[10px] font-bold ${limitReached ? "text-tsia-gold" : "text-white/50"}`}>
            {depositCount}/{MAX_TOPUPS}
          </span>
        </div>
      </div>

      {/* Limit-reached banner */}
      {limitReached && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-tsia-gold/30 bg-tsia-gold/10 px-4 py-3"
        >
          <RefreshCcw className="h-4 w-4 shrink-0 text-tsia-gold mt-0.5" />
          <div>
            <p className="text-xs font-bold text-tsia-gold">Top-up limit reached</p>
            <p className="mt-0.5 text-[10px] text-tsia-gold/70 leading-snug">
              You've used all 3 top-up slots. Use <span className="font-bold">Re-invest</span> to roll your withdrawable earnings back into your principal and restart the earning cycle.
            </p>
          </div>
        </motion.div>
      )}

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-tsia-green/20 via-slate-900/60 to-tsia-gold/10 p-5 shadow-xl backdrop-blur-xl"
      >
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-tsia-green/20 blur-3xl" />

        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Total Balance</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-4xl font-black text-white">{fmt(tradeBalance)}</span>
              <span className="mb-1 text-sm font-bold text-tsia-gold">USDT</span>
            </div>
          </div>
          <button
            onClick={() => setHidden(h => !h)}
            className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20 transition-colors"
          >
            {hidden ? <EyeOff className="h-4 w-4 text-white/70" /> : <Eye className="h-4 w-4 text-white/70" />}
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] text-white/40">Locked Capital</p>
            <p className="mt-0.5 text-sm font-black text-white">{fmt(lockedPrincipal)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] text-white/40">Withdrawable</p>
            <p className="mt-0.5 text-sm font-black text-tsia-green">{fmt(withdrawable)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] text-white/40">Bot Earnings</p>
            <p className="mt-0.5 text-sm font-black text-tsia-gold">{fmt(totalEarnings)}</p>
          </div>
        </div>

        {/* ROI progress */}
        {lockedPrincipal > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white/50 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ROI Progress</span>
              <span className={`font-bold ${returnPct >= 100 ? "text-tsia-gold" : "text-white/70"}`}>
                {returnPct >= 100 ? "100% reached ✓" : `${returnPct.toFixed(1)}% of 100%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${returnPct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${returnPct >= 100 ? "bg-tsia-gold" : "bg-tsia-green"}`}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a, i) => (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={a.onClick}
            disabled={!a.onClick}
            className={`relative flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none ${a.color}`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>
              <a.icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">{a.label}</p>
              <p className="mt-0.5 text-[10px] opacity-70 leading-snug">{a.sublabel}</p>
            </div>
            {a.badge && (
              <span className="absolute top-2 right-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold">
                {a.badge}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Exchange wallet status */}
      {hasWallet && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-emerald-300">Exchange Wallet Connected</p>
              {wallet?.trc20Address && (
                <p className="text-[10px] text-emerald-400/60 font-mono mt-0.5">
                  TRC20: {wallet.trc20Address.slice(0, 8)}…{wallet.trc20Address.slice(-6)}
                </p>
              )}
              {wallet?.bep20Address && (
                <p className="text-[10px] text-emerald-400/60 font-mono mt-0.5">
                  BEP20: {wallet.bep20Address.slice(0, 8)}…{wallet.bep20Address.slice(-6)}
                </p>
              )}
            </div>
          </div>
          <button onClick={onConnect} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors">
            Edit
          </button>
        </motion.div>
      )}

      {/* Recent transactions */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Recent Transactions</h3>
          <span className="text-xs text-white/40">{(txs as any[]).length} total</span>
        </div>
        {(txs as any[]).length === 0 ? (
          <div className="py-8 text-center">
            <Wallet className="mx-auto mb-2 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">No transactions yet.</p>
          </div>
        ) : (
          <AnimatePresence>
            {(txs as any[]).slice(0, 8).map((tx: any, i: number) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between border-t border-white/10 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black
                    ${tx.type === "deposit" ? "bg-tsia-green/20 text-tsia-green" :
                      tx.type === "bot_earning" ? "bg-tsia-gold/20 text-tsia-gold" :
                      "bg-rose-400/20 text-rose-400"}`}>
                    {tx.type === "deposit" ? "↓" : tx.type === "bot_earning" ? "✦" : "↑"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white capitalize">{tx.type?.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-white/40">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.type?.includes("withdraw") ? "text-rose-400" : "text-tsia-green"}`}>
                    {tx.type?.includes("withdraw") ? "-" : "+"}${parseFloat(tx.netAmount ?? tx.amountUsd ?? "0").toFixed(2)}
                  </p>
                  <p className={`text-[10px] capitalize ${
                    tx.status === "completed" ? "text-tsia-green/70" :
                    tx.status === "pending" ? "text-tsia-gold/70" : "text-rose-400/70"
                  }`}>{tx.status}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}
