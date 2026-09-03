import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, TrendingUp, Zap, Globe, Lock, RefreshCw, Info, ChevronRight, ChevronDown, BarChart3, Coins, Receipt, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart,
} from "recharts";

type FundData = {
  totalBalance: string;
  totalDeposited: string;
  totalTradeDeposits: string;
  depositCount: number;
  contributionRate: number;
  description: string;
  walletFloorReserve: string;
  walletsAtMin: number;
  totalWallets: number;
  minBalancePerWallet: number;
  combinedReserve: string;
  updatedAt: string;
};

type CommissionData = {
  chartData: {
    month: string;
    ecomCommission: number;
    withdrawalFees: number;
    affiliatePoolPaid: number;
    netProfit: number;
  }[];
  totals: {
    totalEcom: number;
    totalFees: number;
    totalPoolPaid: number;
    totalNetProfit: number;
    totalWithdrawals: number;
  };
};

// ─── Animated number counter ───────────────────────────────────────────────
function AnimatedCounter({ value, decimals = 2, prefix = "$" }: { value: number; decimals?: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef<number>();

  useEffect(() => {
    const from = prevRef.current;
    const to   = value;
    if (from === to) return;
    const duration = 1200;
    const start    = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { setDisplay(to); prevRef.current = to; }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return <span>{prefix}{formatted}</span>;
}

// ─── Live pulse dot ────────────────────────────────────────────────────────
function PulseDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
    </span>
  );
}

// ─── Custom tooltip for commission chart ───────────────────────────────────
function CommissionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-[180px]">
      <p className="font-bold text-sm mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.fill || p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-bold" style={{ color: p.fill || p.color }}>${p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mini widget (shown inline in Trade Market) ────────────────────────────
export function ReserveFundWidget({ onNavigate }: { onNavigate: () => void }) {
  const { data, isLoading } = useQuery<FundData>({
    queryKey: ["/api/reserve-fund/live"],
    refetchInterval: 600_000,
    staleTime: 300_000,
  });
  const balance = parseFloat(data?.totalBalance ?? "0");

  return (
    <div
      onClick={onNavigate}
      className="cursor-pointer rounded-2xl bg-gradient-to-r from-[#1a5c38] to-[#0e3d25] p-4 flex items-center justify-between hover:opacity-90 transition-opacity"
      data-testid="widget-reserve-fund"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <PulseDot />
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wide">Strategic Reserve Fund</p>
          </div>
          <p className="text-white font-black text-xl">
            {isLoading ? <span className="animate-pulse text-white/40">Loading…</span> : <AnimatedCounter value={balance} />}
          </p>
          <p className="text-white/40 text-[10px]">20% of every deposit · auto-growing</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[#f0c040] text-xs font-bold">20%</span>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function ReserveFund() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [lastTick, setLastTick] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [openFundItems, setOpenFundItems] = useState<Set<string>>(new Set());
  const [allocOpen, setAllocOpen] = useState(false);
  const [commChartOpen, setCommChartOpen] = useState(true);
  const toggleFundItem = (key: string) => setOpenFundItems(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const { data, isLoading } = useQuery<FundData>({
    queryKey: ["/api/reserve-fund/live"],
    refetchInterval: 600_000,
    staleTime: 300_000,
    enabled: !!user,
  });

  const { data: commData } = useQuery<CommissionData>({
    queryKey: ["/api/reserve-fund/commission-profits"],
    refetchInterval: 1_800_000,
    staleTime: 600_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [authLoading, user, setLocation]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!user) return null;

  useEffect(() => {
    if (data?.updatedAt) setLastTick(Date.now());
  }, [data?.updatedAt]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastTick) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastTick]);

  const balance             = parseFloat(data?.totalBalance        ?? "0");
  const deposited           = parseFloat(data?.totalDeposited      ?? "0");
  const totalTradeDeposits  = parseFloat(data?.totalTradeDeposits  ?? "0");
  const depositCount        = data?.depositCount ?? 0;
  const rate                = data?.contributionRate ?? 20;
  const floorReserve        = parseFloat(data?.walletFloorReserve  ?? "0");
  const combinedReserve     = parseFloat(data?.combinedReserve     ?? "0");
  const walletsAtMin        = data?.walletsAtMin     ?? 0;
  const totalWallets        = data?.totalWallets     ?? 0;
  const minPerWallet        = data?.minBalancePerWallet ?? 2;
  const targetFund       = 150_000_000 * 0.20;
  const pct = Math.min((combinedReserve / Math.max(targetFund, 1)) * 100, 100);

  const totals = commData?.totals;
  const chartData = commData?.chartData ?? [];

  // If no real data yet, show a placeholder stub row so chart renders
  const displayChart = chartData.length > 0 ? chartData : [
    { month: "—", ecomCommission: 0, withdrawalFees: 0, affiliatePoolPaid: 0, netProfit: 0 }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setLocation(user.role === "affiliate" ? "/affiliate-dashboard" : "/dashboard")}
            className="rounded-xl p-2 transition-colors hover:bg-muted"
            aria-label="Back to dashboard"
            data-testid="button-reserve-fund-back"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-base font-bold">Strategic Reserve Fund</h1>
            <p className="text-xs text-muted-foreground">Live reserve reporting and allocation</p>
          </div>
          <Badge className="ml-auto hidden bg-tsia-green text-white sm:inline-flex">20% ring-fenced</Badge>
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a5c38] via-[#0e3d25] to-[#1a2a0e] p-6 pb-8">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute top-8 right-8 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 left-20 w-36 h-36 rounded-full bg-[#b8860b]/10" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <PulseDot />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Live Balance</span>
              <span className="ml-auto text-white/40 text-[10px]">
                {isLoading ? "refreshing…" : `updated ${secondsAgo}s ago`}
              </span>
            </div>

            <div className="mb-2">
              <p className="text-white/50 text-xs mb-1">Combined Strategic Reserve (Trade + Wallet Floor)</p>
              <div className="text-4xl font-black text-white tracking-tight leading-none">
                {isLoading ? (
                  <span className="animate-pulse">Loading…</span>
                ) : (
                  <AnimatedCounter value={combinedReserve} decimals={2} prefix="$" />
                )}
              </div>
              {!isLoading && (
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-white/50 text-[11px]">
                    <span className="text-[#f0c040] font-bold">Trade 20%:</span> ${balance.toFixed(2)}
                  </span>
                  <span className="text-white/30 text-[11px]">+</span>
                  <span className="text-white/50 text-[11px]">
                    <span className="text-emerald-300 font-bold">Wallet Floor:</span> ${floorReserve.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Total Trade Deposits</p>
                <p className="text-white/90 font-bold text-sm">
                  {isLoading ? "—" : <AnimatedCounter value={totalTradeDeposits} decimals={2} prefix="$" />}
                </p>
                <p className="text-white/30 text-[9px] mt-0.5">{depositCount} deposit{depositCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Reserve Accumulated</p>
                <p className="text-[#f0c040] font-bold text-sm">
                  {isLoading ? "—" : <AnimatedCounter value={deposited} decimals={2} prefix="$" />}
                </p>
                <p className="text-white/30 text-[9px] mt-0.5">{rate}% of deposits</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Wallet Floor</p>
                <p className="text-emerald-300 font-bold text-sm">${isLoading ? "—" : floorReserve.toFixed(2)}</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Backed by</p>
                <p className="text-white/80 font-bold text-sm">$150M Fund</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a2418] px-6 py-3 flex items-center gap-3">
          <span className="text-[10px] text-white/40 uppercase tracking-wide shrink-0">Fund growth</span>
          <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#1a5c38] to-[#f0c040] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 0.5)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] text-white/40 shrink-0">{pct.toFixed(4)}%</span>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-5 space-y-2">
        <h3 className="font-bold text-base flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-tsia-green" /> How This Fund Works
        </h3>
        {[
          {
            icon: Globe, color: "bg-blue-500", title: "Every Trade Deposit",
            desc: isLoading
              ? "When any member deposits into the Global Trade Market, 20% is automatically ring-fenced."
              : `${depositCount} trade deposit${depositCount !== 1 ? "s" : ""} totalling $${totalTradeDeposits.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} have been made so far. 20% of each deposit ($${deposited.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} accumulated) is automatically ring-fenced into this reserve.`,
          },
          { icon: Shield,     color: "bg-tsia-green", title: "Ring-fenced & Protected",  desc: "The reserve is locked — it cannot be withdrawn by individual members. It belongs to TSIA." },
          { icon: TrendingUp, color: "bg-amber-500",  title: "Strategic Development",    desc: "Funds back TSIA's $150M UK/Turkey partner fund and drive long-term operational growth." },
          { icon: Lock,       color: "bg-violet-500", title: "Transparent & Auditable",  desc: "Every contribution is logged on-chain and reconciled against TSIA's compliance framework." },
        ].map(item => {
          const isOpen = openFundItems.has(item.title);
          return (
            <div key={item.title} className="rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleFundItem(item.title)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm flex-1">{item.title}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-muted-foreground px-4 pb-3 leading-relaxed">{item.desc}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ── Allocation breakdown ─────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <button
          onClick={() => setAllocOpen(v => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors text-left"
        >
          <h3 className="font-bold text-base">Deposit Allocation Breakdown</h3>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${allocOpen ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {allocOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                {[
                  { label: "Your Trade Wallet",       pct: 75, color: "bg-tsia-green",  text: "text-tsia-green" },
                  { label: "Strategic Reserve Fund",  pct: 20, color: "bg-amber-500",   text: "text-amber-500" },
                  { label: "Affiliate Pool",          pct: 5,  color: "bg-violet-500",  text: "text-violet-500" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className={`text-sm font-bold ${row.text}`}>{row.pct}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${row.color} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${row.pct}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}

                {/* $2 Wallet Floor Reserve — separate from trade deposit split */}
                <div className="pt-2 border-t border-border mt-2">
                  <div className="flex justify-between mb-1 items-center">
                    <div>
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">$2 Wallet Floor Reserve</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Locked minimum balance per wallet · not from trade deposit split</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${floorReserve.toFixed(2)}</span>
                      <p className="text-[10px] text-muted-foreground">{walletsAtMin}/{totalWallets} wallets</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: totalWallets > 0 ? `${Math.min((walletsAtMin / totalWallets) * 100, 100)}%` : "0%" }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Every active wallet retains ${minPerWallet} at all times — forms a collective liquidity floor for the reserve.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Commission Profits Chart ──────────────────────────────────── */}
      <div className="bg-card border rounded-2xl overflow-hidden" data-testid="section-commission-profits">
        <button
          onClick={() => setCommChartOpen(v => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#f0c040]" />
            <h3 className="font-bold text-base">Platform Commission Profits</h3>
            <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-2 py-0.5 rounded-full uppercase tracking-wide">After 5% Pool Distributed</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${commChartOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {commChartOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-5">

                {/* Summary stat pills */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { label: "E-Commerce (8%)",    value: totals?.totalEcom ?? 0,       color: "text-tsia-green",  icon: Coins,      isMoney: true },
                    { label: "Affiliate Pool Paid", value: totals?.totalPoolPaid ?? 0,  color: "text-violet-500", icon: Zap,        isMoney: true },
                    { label: "Net Platform Profit", value: totals?.totalNetProfit ?? 0, color: "text-[#f0c040]",  icon: TrendingUp, isMoney: true },
                  ].map(stat => (
                    <div key={stat.label} className="bg-muted/50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{stat.label}</span>
                      </div>
                      <p className={`font-black text-base ${stat.color}`}>${stat.value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {/* Withdrawals row — fees + count */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Receipt className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Commissions Taken</span>
                    </div>
                    <p className="font-black text-base text-blue-600">${(totals?.totalFees ?? 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">withdrawal fee revenue</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Withdrawals</span>
                    </div>
                    <p className="font-black text-base text-slate-700 dark:text-slate-300">{(totals?.totalWithdrawals ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">total processed</p>
                  </div>
                </div>

                {/* Stacked Bar Chart */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">Monthly breakdown — commissions earned vs. affiliate pool distributed</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={displayChart} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<CommissionTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                        formatter={(v) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{v}</span>}
                      />
                      <Bar dataKey="ecomCommission"  name="E-Commerce (8%)"    fill="#1a5c38" radius={[4, 4, 0, 0]} stackId="income" />
                      <Bar dataKey="withdrawalFees"  name="Withdrawal Fees"    fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="income" />
                      <Bar dataKey="affiliatePoolPaid" name="Affiliate Pool (–)" fill="#8b5cf6" radius={[0, 0, 4, 4]} stackId="deduction" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Net profit area chart */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium">Net platform profit trend (after 5% affiliate pool deducted)</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={displayChart} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netProfitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f0c040" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f0c040" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<CommissionTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="netProfit"
                        name="Net Profit"
                        stroke="#f0c040"
                        strokeWidth={2}
                        fill="url(#netProfitGrad)"
                        dot={{ fill: "#f0c040", r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-[10px] text-muted-foreground/60 text-center">
                  Sources: 8% e-commerce commission + trade withdrawal fees · Affiliate pool (5%) shown as deduction · Updates every 30s
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Key stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Partner Backing",    value: "$150M",         icon: "🏦", sub: "UK & Turkey fund" },
          { label: "Reserve Rate",       value: "20%",           icon: "🔒", sub: "per deposit auto-deducted" },
          { label: "Company Reg",        value: "RC 1359954",    icon: "🇬🇧", sub: "SMAKEMGGOLD Ltd, London" },
          { label: "Compliance",         value: "NDPR & GDPR",   icon: "⚖️", sub: "UK regulated framework" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-4">
            <span className="text-2xl">{s.icon}</span>
            <p className="font-black text-base mt-2">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── $2 Wallet Floor Reserve detail card ──────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5" data-testid="card-wallet-floor-reserve">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">$2 Wallet Floor Reserve</h4>
            </div>
            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/60 max-w-xs leading-relaxed">
              Every TSIA wallet must retain a minimum of <strong>${minPerWallet}</strong>. This collective floor forms an always-available liquidity buffer that contributes to the overall reserve strength.
            </p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              ${isLoading ? "—" : floorReserve.toFixed(2)}
            </p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">{walletsAtMin} of {totalWallets} wallets funded</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
          <div className="text-center">
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">${minPerWallet}</p>
            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/50 uppercase tracking-wide">Per wallet</p>
          </div>
          <div className="text-center border-x border-emerald-200 dark:border-emerald-800">
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{totalWallets}</p>
            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/50 uppercase tracking-wide">Active wallets</p>
          </div>
          <div className="text-center">
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">${(minPerWallet * totalWallets).toFixed(2)}</p>
            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/50 uppercase tracking-wide">Max potential</p>
          </div>
        </div>
      </div>

      {/* ── Refresh note ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
        <RefreshCw className="w-3 h-3" />
        Auto-refreshes every 5 seconds · Powered by TSIA Trade Market
      </div>
      </main>
    </div>
  );
}
