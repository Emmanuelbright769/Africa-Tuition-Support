import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, TrendingUp, Zap, Globe, Lock, RefreshCw, Info, ChevronRight } from "lucide-react";

type FundData = {
  totalBalance: string;
  totalDeposited: string;
  contributionRate: number;
  description: string;
  updatedAt: string;
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

// ─── Mini widget (shown inline in Trade Market) ────────────────────────────
export function ReserveFundWidget({ onNavigate }: { onNavigate: () => void }) {
  const { data, isLoading } = useQuery<FundData>({
    queryKey: ["/api/reserve-fund/live"],
    refetchInterval: 5000,
    staleTime: 0,
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
  const [lastTick, setLastTick] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Poll every 5 seconds
  const { data, isLoading } = useQuery<FundData>({
    queryKey: ["/api/reserve-fund/live"],
    refetchInterval: 5000,
    staleTime: 0,
  });

  // Update "last refreshed" timer
  useEffect(() => {
    if (data?.updatedAt) setLastTick(Date.now());
  }, [data?.updatedAt]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastTick) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastTick]);

  const balance   = parseFloat(data?.totalBalance   ?? "0");
  const deposited = parseFloat(data?.totalDeposited ?? "0");
  const rate      = data?.contributionRate ?? 20;
  // Hypothetical projection: assume fund grows at ~$150M target over 5 years
  const targetFund = 150_000_000 * 0.20; // rough 20% reserve target
  const pct = Math.min((balance / Math.max(targetFund, 1)) * 100, 100);

  return (
    <div className="space-y-6">

      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a5c38] via-[#0e3d25] to-[#1a2a0e] p-6 pb-8">
          {/* Decorative orbs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute top-8 right-8 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 left-20 w-36 h-36 rounded-full bg-[#b8860b]/10" />

          <div className="relative z-10">
            {/* Live badge */}
            <div className="flex items-center gap-2 mb-4">
              <PulseDot />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Live Balance</span>
              <span className="ml-auto text-white/40 text-[10px]">
                {isLoading ? "refreshing…" : `updated ${secondsAgo}s ago`}
              </span>
            </div>

            {/* Balance */}
            <div className="mb-2">
              <p className="text-white/50 text-xs mb-1">20% Strategic Development Reserve</p>
              <div className="text-4xl font-black text-white tracking-tight leading-none">
                {isLoading ? (
                  <span className="animate-pulse">Loading…</span>
                ) : (
                  <AnimatedCounter value={balance} decimals={2} prefix="$" />
                )}
              </div>
            </div>

            {/* Sub-stats row */}
            <div className="flex items-center gap-4 mt-4">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Total Deposited</p>
                <p className="text-white/80 font-bold text-sm">
                  {isLoading ? "—" : <AnimatedCounter value={deposited} decimals={2} prefix="$" />}
                </p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Reserve Rate</p>
                <p className="text-[#f0c040] font-bold text-sm">{rate}% of every deposit</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wide">Backed by</p>
                <p className="text-white/80 font-bold text-sm">$150M Fund</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar at the bottom of the card */}
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
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Info className="w-4 h-4 text-tsia-green" /> How This Fund Works
        </h3>
        <div className="space-y-3">
          {[
            { icon: Globe,    color: "bg-blue-500",    title: "Every Trade Deposit",         desc: "When any member deposits into the Global Trade Market, 20% is automatically ring-fenced." },
            { icon: Shield,   color: "bg-tsia-green",  title: "Ring-fenced & Protected",     desc: "The reserve is locked — it cannot be withdrawn by individual members. It belongs to TSIA." },
            { icon: TrendingUp, color: "bg-amber-500", title: "Strategic Development",       desc: "Funds back TSIA's $150M UK/Turkey partner fund and drive long-term operational growth." },
            { icon: Lock,     color: "bg-violet-500",  title: "Transparent & Auditable",    desc: "Every contribution is logged on-chain and reconciled against TSIA's compliance framework." },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Allocation breakdown ─────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-bold text-base mb-4">Deposit Allocation Breakdown</h3>
        <div className="space-y-3">
          {[
            { label: "Your Trade Wallet",        pct: 75, color: "bg-tsia-green",   text: "text-tsia-green" },
            { label: "Strategic Reserve Fund",   pct: 20, color: "bg-amber-500",    text: "text-amber-500" },
            { label: "Affiliate Pool",           pct: 5,  color: "bg-violet-500",   text: "text-violet-500" },
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
        </div>
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

      {/* ── Refresh note ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-4">
        <RefreshCw className="w-3 h-3" />
        Auto-refreshes every 5 seconds · Powered by TSIA Trade Market
      </div>
    </div>
  );
}
