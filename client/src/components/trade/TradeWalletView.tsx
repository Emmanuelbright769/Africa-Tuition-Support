import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Link2, Eye, EyeOff, TrendingUp, Shield, RefreshCw, RefreshCcw,
  CreditCard, Banknote, Lock,
} from "lucide-react";

const MAX_TOPUPS = 3;

interface TradeWalletViewProps {
  onDeposit: () => void;
  onWithdraw: () => void;
  onFund: () => void;
  onConnect: () => void;
  onReinvest: () => void;
  onBankDeposit: () => void;
}

export default function TradeWalletView({
  onDeposit, onWithdraw, onFund, onConnect, onReinvest, onBankDeposit,
}: TradeWalletViewProps) {
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
  // currentCycleEarnings is the server-computed sum of positive bot earnings
  // since cycle_started_at — immune to wallet-field corruption or admin resets.
  const totalEarnings   = parseFloat(wallet?.currentCycleEarnings ?? wallet?.totalBotEarnings ?? "0");
  const withdrawable    = Math.max(0, tradeBalance - lockedPrincipal);

  const planDays        = wallet?.tradingPlanDays ?? 120;
  const profitCapPct    = planDays === 60 ? 0.70 : planDays === 90 ? 0.80 : 1.00;
  const profitTarget    = lockedPrincipal * profitCapPct;

  // Cycle state — must be declared BEFORE the ROI bar calculations that depend on them
  const roiComplete      = !!(wallet?.roiComplete);
  const tradingDayNumber = wallet?.tradingDayNumber ?? 0;
  const cycleComplete    = roiComplete || tradingDayNumber >= planDays;

  // ── ROI bar ──────────────────────────────────────────────────────────────────
  // Use `roiComplete` (server-set flag) as the ONLY gate for "cap reached".
  // totalBotEarnings can be inflated by data issues (e.g. a deposit being
  // double-counted), so never show 100% unless the server has explicitly
  // confirmed the cycle is done.
  const rawReturnPct    = profitTarget > 0 ? (totalEarnings / profitTarget) * 100 : 0;
  const returnPct       = roiComplete ? 100 : Math.min(99.9, rawReturnPct);
  // capReached: true when server set roiComplete=true OR when cumulative earnings
  // have actually reached/exceeded the profit target (using transaction-computed value).
  const capReached      = roiComplete || (profitTarget > 0 && totalEarnings >= profitTarget);

  const hasWallet       = wallet?.trc20Address || wallet?.bep20Address;

  // Top-up tracking — clamp display to avoid showing "11/3"
  const rawDepositCount = wallet?.depositCount ?? 0;
  const depositCount    = Math.min(rawDepositCount, MAX_TOPUPS);   // display-only
  const limitReached    = rawDepositCount >= MAX_TOPUPS;            // real gate
  const topupsLeft      = Math.max(0, MAX_TOPUPS - rawDepositCount);

  const fmt = (n: number) => hidden ? "••••••" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Action grid (2 × 2) ─────────────────────────────────────
  const depositDisabled = limitReached;
  // When all slots are used AND the cycle is complete, the "Top Up" slot becomes "Reinvest"
  const topUpIsReinvest = limitReached && cycleComplete;
  const topUpDisabled   = limitReached && !cycleComplete;

  const actions = [
    {
      id: "bank",
      label: "Bank Deposit",
      sublabel: depositDisabled ? "Top-up limit reached" : "Paystack · card / bank",
      icon: CreditCard,
      color: depositDisabled
        ? "bg-slate-400/10 text-slate-500 border-slate-400/20 opacity-50 cursor-not-allowed"
        : "bg-tsia-green/15 text-tsia-green border-tsia-green/30",
      iconBg: depositDisabled ? "bg-slate-600" : "bg-tsia-green",
      onClick: depositDisabled ? undefined : onBankDeposit,
      badge: (!depositDisabled && topupsLeft > 0) ? `${topupsLeft} left` : null,
    },
    {
      id: "deposit",
      label: "Crypto Deposit",
      sublabel: depositDisabled ? "Top-up limit reached" : "Via TRC20 / BEP20",
      icon: ArrowDownToLine,
      color: depositDisabled
        ? "bg-slate-400/10 text-slate-500 border-slate-400/20 opacity-50 cursor-not-allowed"
        : "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
      iconBg: depositDisabled ? "bg-slate-600" : "bg-emerald-600",
      onClick: depositDisabled ? undefined : onDeposit,
      badge: null,
    },
    {
      id: "fund",
      label: topUpIsReinvest ? "Reinvest" : "Top Up",
      sublabel: topUpIsReinvest
        ? withdrawable >= 2
          ? `Roll $${withdrawable.toFixed(2)} into new cycle`
          : "Need ≥$2 withdrawable earnings"
        : topUpDisabled
          ? "Limit reached — 3/3 used"
          : `From SwiftWallet · ${topupsLeft} left`,
      icon: topUpIsReinvest ? RefreshCcw : Wallet,
      color: topUpIsReinvest
        ? withdrawable >= 2
          ? "bg-tsia-gold/20 text-tsia-gold border-tsia-gold/50"
          : "bg-slate-400/10 text-slate-500 border-slate-400/20 opacity-50 cursor-not-allowed"
        : topUpDisabled
          ? "bg-slate-400/10 text-slate-500 border-slate-400/20 opacity-50 cursor-not-allowed"
          : "bg-tsia-gold/15 text-tsia-gold border-tsia-gold/30",
      iconBg: topUpIsReinvest
        ? withdrawable >= 2 ? "bg-tsia-gold" : "bg-slate-600"
        : topUpDisabled ? "bg-slate-600" : "bg-tsia-gold",
      onClick: topUpIsReinvest
        ? withdrawable >= 2 ? onReinvest : undefined
        : topUpDisabled ? undefined : onFund,
      badge: topUpIsReinvest && withdrawable >= 2
        ? "Cycle done"
        : (!topUpDisabled && !topUpIsReinvest && topupsLeft > 0) ? `${topupsLeft} left` : null,
    },
    {
      id: "withdraw",
      label: "Withdraw",
      sublabel: "Earnings to wallet / bank",
      icon: ArrowUpFromLine,
      color: "bg-blue-400/15 text-blue-400 border-blue-400/30",
      iconBg: "bg-blue-500",
      onClick: onWithdraw,
      badge: null,
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
          <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Top-up slots used</span>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: MAX_TOPUPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-6 rounded-full transition-colors ${
                i < depositCount ? "bg-tsia-gold" : "bg-white/20"
              }`}
            />
          ))}
          <span className={`ml-1 text-xs font-bold ${limitReached ? "text-tsia-gold" : "text-slate-300"}`}>
            {depositCount}/{MAX_TOPUPS}
          </span>
        </div>
      </div>

      {/* Limit-reached banner (shows when limit hit but cycle not yet complete) */}
      {limitReached && !cycleComplete && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-tsia-gold/30 bg-tsia-gold/10 px-4 py-3"
        >
          <Lock className="h-4 w-4 shrink-0 text-tsia-gold mt-0.5" />
          <div>
            <p className="text-xs font-bold text-tsia-gold">Top-up limit reached</p>
            <p className="mt-0.5 text-[10px] text-tsia-gold/70 leading-snug">
              You've used all 3 top-up slots. Continue your current cycle — when your cycle completes, you can <span className="font-bold">Re-invest</span> earnings into a new cycle.
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
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">Total Balance</p>
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
            <p className="text-[10px] text-slate-400">Locked Capital</p>
            <p className="mt-0.5 text-sm font-black text-white">{fmt(lockedPrincipal)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] text-slate-400">Withdrawable</p>
            <p className="mt-0.5 text-sm font-black text-tsia-green">{fmt(withdrawable)}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] text-slate-400">Bot Earnings</p>
            <p className="mt-0.5 text-sm font-black text-tsia-gold">{fmt(totalEarnings)}</p>
          </div>
        </div>

        {/* ROI progress */}
        {lockedPrincipal > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300 flex items-center gap-1 font-medium">
                <TrendingUp className="h-3 w-3" /> ROI Progress
              </span>
              <span className={`font-bold ${capReached ? "text-tsia-gold" : "text-white/90"}`}>
                {capReached
                  ? `${(profitCapPct * 100).toFixed(0)}% cap reached ✓`
                  : `${returnPct.toFixed(1)}% of ${(profitCapPct * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${returnPct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${capReached ? "bg-tsia-gold" : "bg-tsia-green"}`}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">
                {capReached
                  ? withdrawable > 0
                    ? `$${withdrawable.toFixed(2)} available to withdraw`
                    : "Earnings fully withdrawn"
                  : `Target: $${profitTarget.toFixed(2)}`}
              </span>
              <span className="text-slate-400">
                Day {Math.min(tradingDayNumber, planDays)}/{planDays}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Action buttons — 2×2 grid */}
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

      {/* Connect Wallet — full width */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        onClick={onConnect}
        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
          hasWallet
            ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
            : "bg-slate-400/15 text-slate-300 border-slate-400/30"
        }`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasWallet ? "bg-emerald-500" : "bg-slate-600"}`}>
          {hasWallet ? <Link2 className="h-5 w-5 text-white" /> : <ArrowLeftRight className="h-5 w-5 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{hasWallet ? "Exchange Wallet" : "Connect Wallet"}</p>
          <p className="mt-0.5 text-[10px] opacity-70 leading-snug">{hasWallet ? "TRC20/BEP20 connected" : "Link your exchange address"}</p>
        </div>
        {hasWallet && (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[9px] font-bold text-emerald-300">Edit</span>
        )}
      </motion.button>

      {/* Re-invest card — shown when cycle is complete but slots aren't all used
          (when all 3 slots ARE used + cycle complete, the Top Up button transforms to Reinvest instead) */}
      {cycleComplete && !topUpIsReinvest && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-tsia-gold/40 bg-tsia-gold/10 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tsia-gold">
              <RefreshCcw className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-tsia-gold">Cycle Complete — Re-invest</p>
              <p className="mt-0.5 text-[10px] text-tsia-gold/70 leading-snug">
                {withdrawable >= 2
                  ? `Roll $${withdrawable.toFixed(2)} earnings back into principal and start a new cycle.`
                  : "Add at least $2 in withdrawable earnings to re-invest."}
              </p>
            </div>
          </div>
          <button
            onClick={onReinvest}
            disabled={withdrawable < 2}
            className="mt-3 w-full rounded-xl bg-tsia-gold py-2.5 text-sm font-bold text-white transition-all hover:bg-tsia-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {withdrawable >= 2 ? `Re-invest $${withdrawable.toFixed(2)}` : "Insufficient earnings"}
          </button>
        </motion.div>
      )}

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
