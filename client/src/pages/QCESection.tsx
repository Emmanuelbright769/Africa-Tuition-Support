import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  PiggyBank, TrendingUp, Lock, Unlock, Info, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Clock, Zap, ShieldCheck, BarChart3, Loader2, RefreshCw,
  CalendarDays, DollarSign, History, ChevronDown, ChevronUp,
  CarFront, Home, Banknote, AlertTriangle, TrendingDown, ArrowRight,
  Building2, Menu, X, ChevronRight, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { QCE, calculateLoanMonthly } from "@shared/schema";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";

// ── Types ──────────────────────────────────────────────────────────────────
interface QceSavings {
  id: number; userId: number; balance: string; activated: boolean;
  activatedAt: string | null; startDate: string | null; daysActive: number;
  creditPortalUnlocked: boolean; eligibilityPercent: string;
  lastContributionDate: string | null; createdAt: string; updatedAt: string;
}
interface QceTransaction {
  id: number; userId: number; type: "contribution" | "withdrawal";
  amountUsd: string; balanceAfter: string; note: string | null; createdAt: string;
}
interface QceStatus { savings: QceSavings; transactions: QceTransaction[] }
interface WalletData { balance: string }

type QceTab = "savings" | "car_connect" | "tenancy" | "loan";

const TABS: { id: QceTab; label: string; icon: any; desc: string; badge?: string }[] = [
  { id: "savings",     label: "QCE Savings",               icon: PiggyBank,  desc: "Build credit eligibility over 90 days", badge: "New" },
  { id: "car_connect", label: "Car Connect",               icon: CarFront,   desc: "Peer-to-peer vehicle sharing & bookings", badge: "New" },
  { id: "tenancy",     label: "Landlord Tenancy Gateway",  icon: Home,       desc: "Property listing and lease financing" },
  { id: "loan",        label: "Business Loan",             icon: Banknote,   desc: "Flexible financing based on your activity" },
];

const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function QCESection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { formatAmount, rateLabel } = useLocalCurrency();

  // ── Internal navigation ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<QceTab>("savings");
  const [menuOpen, setMenuOpen] = useState(false);

  // ── QCE Savings state ─────────────────────────────────────────────────
  const [contributeOpen, setContributeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contributeAmt, setContributeAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // ── Business Loan state ───────────────────────────────────────────────
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────
  const { data, isLoading: qceLoading, refetch: refetchQce } = useQuery<QceStatus>({ queryKey: ["/api/qce/status"] });
  const { data: walletData } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: loanLimit, refetch: refetchLoanLimit } = useQuery<any>({ queryKey: ["/api/loans/limit"] });
  const { data: myLoans = [], refetch: refetchMyLoans } = useQuery<any[]>({ queryKey: ["/api/loans/my-loans"] });

  // ── Derived values ────────────────────────────────────────────────────
  const savings = data?.savings;
  const transactions = data?.transactions ?? [];
  const walletBalance = parseFloat(walletData?.balance ?? "0");
  const qceBalance = parseFloat(savings?.balance ?? "0");
  const eligibilityPct = parseFloat(savings?.eligibilityPercent ?? "0");
  const daysActive = savings?.daysActive ?? 0;
  const progressPct = Math.min((daysActive / QCE.PERIOD_DAYS) * 100, 100);
  const isActivated = savings?.activated ?? false;
  const creditPortalUnlocked = savings?.creditPortalUnlocked ?? false;
  const maxWithdraw = Math.max(qceBalance - QCE.MIN_BALANCE, 0);
  const canWithdraw = qceBalance > QCE.MIN_BALANCE;

  // ── QCE mutations ──────────────────────────────────────────────────────
  const contributeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/qce/contribute", { amountUsd: parseFloat(contributeAmt) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: savings?.activated ? "Contribution added!" : "QCE Activated!", description: d.message });
      qc.invalidateQueries({ queryKey: ["/api/qce/status"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet"] });
      setContributeOpen(false); setContributeAmt("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/qce/withdraw", { amountUsd: parseFloat(withdrawAmt) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: "Withdrawn!", description: d.message });
      qc.invalidateQueries({ queryKey: ["/api/qce/status"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet"] });
      setWithdrawOpen(false); setWithdrawAmt("");
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  const tickMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/qce/tick", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Progress updated", description: "Your QCE day count has been refreshed." });
      refetchQce();
    },
  });

  // ── Loan mutations ────────────────────────────────────────────────────
  const applyLoanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loans/apply", { amountUsd: parseFloat(loanAmount), termMonths: loanTerm, purpose: loanPurpose });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application submitted!", description: "Your loan application is under review." });
      qc.invalidateQueries({ queryKey: ["/api/loans/limit"] });
      qc.invalidateQueries({ queryKey: ["/api/loans/my-loans"] });
      setLoanAmount(""); setLoanTerm(12); setLoanPurpose("");
    },
    onError: (e: any) => toast({ title: "Application failed", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────
  const currentTab = TABS.find(t => t.id === activeTab)!;
  const CurrentIcon = currentTab.icon;

  const navigate = (tab: QceTab) => { setActiveTab(tab); setMenuOpen(false); };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Internal hamburger nav bar ────────────────────────────────── */}
      <div className="relative">
        <div className="flex items-center justify-between bg-card border rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-tsia-green to-emerald-700 flex items-center justify-center shadow-sm">
              <CurrentIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground leading-tight">{currentTab.label}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">{currentTab.desc}</p>
            </div>
            {currentTab.badge && (
              <Badge className="bg-tsia-green/10 text-tsia-green border-tsia-green/20 text-[10px] px-1.5 py-0">{currentTab.badge}</Badge>
            )}
          </div>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="btn-qce-menu"
            aria-label="Open QCE feature menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Dropdown menu */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-full left-0 right-0 mt-2 z-20 bg-card border rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1">Features</p>
                  {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => navigate(tab.id)}
                        data-testid={`btn-qce-tab-${tab.id}`}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                          isActive
                            ? "bg-tsia-green text-white shadow-sm"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-white/20" : "bg-muted"}`}>
                          <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold leading-tight">{tab.label}</p>
                          <p className={`text-xs mt-0.5 line-clamp-1 ${isActive ? "text-white/70" : "text-muted-foreground"}`}>{tab.desc}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tab.badge && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${isActive ? "bg-white/20 text-white border-0" : "bg-tsia-green/10 text-tsia-green border-tsia-green/20"}`}>{tab.badge}</Badge>
                          )}
                          {isActive && <CheckCircle2 className="w-4 h-4 text-white/80" />}
                          {!isActive && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === "savings" && (
          <motion.div key="savings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-5">

            {/* Header row */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold">QCE Savings</h3>
                <p className="text-sm text-muted-foreground">Quick Credit Eligibility · build over 90 days</p>
              </div>
              <div className="flex items-center gap-2">
                {isActivated && (
                  <Button variant="outline" size="sm" onClick={() => tickMutation.mutate()} disabled={tickMutation.isPending} data-testid="button-qce-refresh">
                    {tickMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1 hidden sm:inline">Refresh</span>
                  </Button>
                )}
                {isActivated
                  ? <Badge className="bg-tsia-green/10 text-tsia-green border-tsia-green/20" variant="outline" data-testid="badge-qce-status">Active</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline" data-testid="badge-qce-status">Not Activated</Badge>
                }
              </div>
            </motion.div>

            {/* Activate CTA */}
            {!isActivated && (
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Button onClick={() => setContributeOpen(true)} className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white" data-testid="button-activate-qce">
                  <Zap className="w-4 h-4 mr-2" /> Activate QCE Savings — min $5
                </Button>
              </motion.div>
            )}

            {/* Stats grid */}
            {isActivated && (
              <>
                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="shadow-md border-0" data-testid="card-qce-balance">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-tsia-green/10 flex items-center justify-center">
                          <PiggyBank className="w-5 h-5 text-tsia-green" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">QCE Balance</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-qce-balance">${qceBalance.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Min $2 always retained</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-md border-0" data-testid="card-qce-eligibility">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Credit Eligibility</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-qce-eligibility">{eligibilityPct.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">of {QCE.MAX_ELIGIBILITY}% max</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-md border-0" data-testid="card-qce-days">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <CalendarDays className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Days Active</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-qce-days">
                        {daysActive}<span className="text-base font-normal text-muted-foreground">/{QCE.PERIOD_DAYS}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{QCE.PERIOD_DAYS - daysActive} days remaining</p>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Progress bar */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-5 pb-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">90-Day Progress</p>
                        <p className="text-sm font-bold text-tsia-green">{progressPct.toFixed(1)}%</p>
                      </div>
                      <Progress value={progressPct} className="h-3" data-testid="progress-qce" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Day 0</span><span>Day 45</span><span>Day 90</span>
                      </div>
                      {savings?.startDate && (
                        <p className="text-xs text-muted-foreground">
                          Started {format(new Date(savings.startDate), "dd MMM yyyy")} · {daysActive >= QCE.PERIOD_DAYS ? "Complete!" : `${QCE.PERIOD_DAYS - daysActive} days left`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Action buttons */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex gap-3 flex-wrap">
                  <Button onClick={() => setContributeOpen(true)} className="bg-tsia-green hover:bg-tsia-green/90 text-white flex-1 min-w-[140px]" data-testid="button-qce-contribute">
                    <ArrowDownLeft className="w-4 h-4 mr-2" /> Add to Savings
                  </Button>
                  <Button variant="outline" onClick={() => setWithdrawOpen(true)} disabled={!canWithdraw} className="flex-1 min-w-[140px]" data-testid="button-qce-withdraw">
                    <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw
                  </Button>
                </motion.div>

                {/* Collapsible details toggle */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible">
                  <button
                    onClick={() => setShowDetails(v => !v)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="btn-qce-toggle-details"
                  >
                    {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showDetails ? "Hide details" : "Show details"}
                  </button>
                </motion.div>

                {showDetails && (
                  <>
                    {/* Credit Portal */}
                    <motion.div variants={itemVariants} initial="hidden" animate="visible">
                      <Card className={`shadow-md border-0 ${creditPortalUnlocked ? "border-l-4 border-l-tsia-green" : "border-l-4 border-l-muted"}`} data-testid="card-credit-portal">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            {creditPortalUnlocked ? <Unlock className="w-5 h-5 text-tsia-green" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                            Credit Portal
                            {creditPortalUnlocked && <Badge className="ml-auto bg-tsia-green/10 text-tsia-green border-0 text-xs">Unlocked</Badge>}
                          </CardTitle>
                          <CardDescription>
                            {creditPortalUnlocked ? "Your credit portal is active. Continue building savings to increase eligibility." : "Activate QCE savings and make your first transaction to unlock the credit portal."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {creditPortalUnlocked ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { label: "Current Eligibility", value: `${eligibilityPct.toFixed(1)}%`, max: `${QCE.MAX_ELIGIBILITY}% max`, color: "text-tsia-green" },
                                  { label: "Days to Complete", value: `${Math.max(QCE.PERIOD_DAYS - daysActive, 0)}`, max: "of 90 days", color: "text-blue-600" },
                                ].map(item => (
                                  <div key={item.label} className="bg-muted/40 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                    <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                                    <p className="text-xs text-muted-foreground">{item.max}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3 space-y-2">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  <ShieldCheck className="w-4 h-4 text-tsia-green" /> What your credit score unlocks:
                                </p>
                                <ul className="space-y-1.5 text-xs text-muted-foreground">
                                  {[
                                    { pct: 5,  label: "Access to micro-credit requests" },
                                    { pct: 10, label: "Eligibility for student loan applications" },
                                    { pct: 20, label: "Increased loan limits + faster approval" },
                                    { pct: 30, label: "Full credit eligibility — maximum loan access" },
                                  ].map(tier => (
                                    <li key={tier.pct} className="flex items-start gap-2">
                                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${eligibilityPct >= tier.pct ? "text-tsia-green" : "text-muted-foreground/40"}`} />
                                      <span className={eligibilityPct >= tier.pct ? "text-foreground font-medium" : ""}>{tier.pct}% — {tier.label}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-4 text-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                                <Lock className="w-7 h-7 text-muted-foreground/40" />
                              </div>
                              <p className="text-sm font-medium text-muted-foreground">Activate your QCE savings to unlock the credit portal</p>
                              <Button size="sm" onClick={() => setContributeOpen(true)} className="bg-tsia-green hover:bg-tsia-green/90 text-white" data-testid="button-unlock-credit-portal">
                                <Zap className="w-3.5 h-3.5 mr-1.5" /> Activate Now
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Min balance info */}
                    <motion.div variants={itemVariants} initial="hidden" animate="visible">
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2 items-start">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>A minimum of <strong>${QCE.MIN_BALANCE}</strong> must always remain in your QCE savings. You can withdraw the rest at any time — funds return to your Personal Wallet.</p>
                      </div>
                    </motion.div>
                  </>
                )}

                {/* Transaction History */}
                {showDetails && transactions.length > 0 && (
                  <motion.div variants={itemVariants} initial="hidden" animate="visible">
                    <Card className="shadow-md border-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" /> Transaction History
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                          {transactions.slice(0, 20).map((tx) => (
                            <div key={tx.id} className="flex items-center gap-4 px-5 py-3" data-testid={`row-qce-tx-${tx.id}`}>
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.type === "contribution" ? "bg-tsia-green/10" : "bg-red-100 dark:bg-red-900/20"}`}>
                                {tx.type === "contribution" ? <ArrowDownLeft className="w-4 h-4 text-tsia-green" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground capitalize">{tx.type}</p>
                                <p className="text-xs text-muted-foreground">{tx.note ?? ""} · {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold ${tx.type === "contribution" ? "text-tsia-green" : "text-red-500"}`}>
                                  {tx.type === "contribution" ? "+" : "-"}${parseFloat(tx.amountUsd).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">Bal: ${parseFloat(tx.balanceAfter).toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Car Connect tab ──────────────────────────────────────────── */}
        {activeTab === "car_connect" && (
          <motion.div key="car_connect" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-5">
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <h3 className="text-lg font-bold mb-1">Car Connect</h3>
              <p className="text-sm text-muted-foreground mb-5">Peer-to-peer vehicle sharing — register your car or connect with a nearby vehicle owner.</p>
            </motion.div>

            {/* Feature cards */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: CarFront, title: "Browse Cars", desc: "Find available cars near you and make a booking directly through TSIA.", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20" },
                { icon: DollarSign, title: "Register Your Car", desc: "List your vehicle and earn money when others book it via Car Connect.", color: "text-green-600", bg: "bg-tsia-green/10" },
                { icon: Shield, title: "Secure Payments", desc: "All payments go through the TSIA wallet — no cash required.", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                { icon: CheckCircle2, title: "P2P Verified", desc: "Every car owner is identity-verified before their listing goes live.", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
              ].map(f => (
                <Card key={f.title} className="shadow-sm border-0">
                  <CardContent className="pt-5 pb-5 flex gap-3 items-start">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.bg}`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Button className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white h-12 font-bold text-base" onClick={() => setLocation("/tour-africa")} data-testid="button-qce-car-connect">
                <CarFront className="w-5 h-5 mr-2" /> Open Car Connect
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ── Landlord Tenancy Gateway tab ─────────────────────────────── */}
        {activeTab === "tenancy" && (
          <motion.div key="tenancy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-5">
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <h3 className="text-lg font-bold mb-1">Landlord Tenancy Gateway</h3>
              <p className="text-sm text-muted-foreground mb-5">Property listing and lease financing — TSIA pays landlords a lump sum upfront while tenants pay in monthly instalments.</p>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Building2, title: "For Landlords", desc: "List your property and receive 88% of total rent value as a lump sum upfront — no more chasing yearly payments.", color: "text-green-600", bg: "bg-tsia-green/10" },
                { icon: Home, title: "For Tenants", desc: "Browse available properties and pay in affordable monthly instalments at just 5% annual interest.", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                { icon: Shield, title: "TSIA as Guarantor", desc: "TSIA acts as financial intermediary — securing both landlord payment and tenant affordability.", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                { icon: TrendingUp, title: "3–10 Year Leases", desc: "Flexible lease terms negotiated directly on the platform for both parties.", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
              ].map(f => (
                <Card key={f.title} className="shadow-sm border-0">
                  <CardContent className="pt-5 pb-5 flex gap-3 items-start">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.bg}`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Button className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white h-12 font-bold text-base" onClick={() => setLocation("/tenancy")} data-testid="button-qce-tenancy">
                <Home className="w-5 h-5 mr-2" /> Open Tenancy Gateway
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ── Business Loan tab ────────────────────────────────────────── */}
        {activeTab === "loan" && (
          <motion.div key="loan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-5">
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <h3 className="text-lg font-bold mb-1">Business Loan</h3>
              <p className="text-sm text-muted-foreground mb-1">Access flexible financing based on your referral activity and trade balance.</p>
            </motion.div>

            {/* Eligibility card */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              {!loanLimit ? (
                <Card className="shadow-sm border-0"><CardContent className="pt-8 pb-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
              ) : !loanLimit.eligible ? (
                <Card className="shadow-sm border-0 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex gap-3 items-start">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Not yet eligible</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">{loanLimit.reason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: "Loan limit", value: `$${loanLimit.limitUsd?.toLocaleString()}`, sub: "Your maximum", color: "text-green-600 dark:text-green-400" },
                    { label: "Interest rate", value: `${loanLimit.interestRate}% /yr`, sub: "Flat rate", color: "text-blue-600 dark:text-blue-400" },
                    { label: "Referrals", value: loanLimit.referralCount || 0, sub: `Trade: $${parseFloat(loanLimit.tradeBalance || 0).toFixed(2)}`, color: "text-purple-600 dark:text-purple-400" },
                  ].map(s => (
                    <Card key={s.label} className="shadow-sm border-0">
                      <CardContent className="pt-5 pb-5">
                        <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Active loan */}
            {loanLimit?.activeLoan && (
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Card className="shadow-sm border-0 bg-blue-50 dark:bg-blue-900/10">
                  <CardHeader className="pb-2 pt-5"><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4" /> Active loan</CardTitle></CardHeader>
                  <CardContent className="pb-5">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      {[
                        { label: "Amount", value: `$${parseFloat(loanLimit.activeLoan.amountUsd).toFixed(2)}` },
                        { label: "Total payable", value: `$${parseFloat(loanLimit.activeLoan.totalPayableUsd).toFixed(2)}` },
                        { label: "Monthly", value: `$${parseFloat(loanLimit.activeLoan.monthlyPaymentUsd).toFixed(2)}` },
                        { label: "Status", value: <Badge className="capitalize">{loanLimit.activeLoan.status}</Badge> },
                      ].map(f => (
                        <div key={f.label} className="bg-white dark:bg-blue-900/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
                          <p className="font-semibold">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Application form */}
            {loanLimit?.eligible && !loanLimit?.activeLoan && (
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Card className="shadow-sm border-0">
                  <CardHeader className="pb-3 pt-5"><CardTitle className="text-base">Apply for a business loan</CardTitle></CardHeader>
                  <CardContent className="pb-6 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Loan amount (USD)</label>
                        <input
                          type="number" min={50} max={loanLimit.limitUsd} step={50}
                          value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                          placeholder={`Max $${loanLimit.limitUsd}`}
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                          data-testid="input-loan-amount"
                        />
                        {parseFloat(loanAmount) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(loanAmount))} {rateLabel()}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Repayment term</label>
                        <select
                          value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                          data-testid="select-loan-term"
                        >
                          {(loanLimit.terms || [6, 12, 24]).map((t: number) => <option key={t} value={t}>{t} months</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Purpose (optional)</label>
                      <input
                        type="text" value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)}
                        placeholder="e.g. Business expansion, inventory, marketing..."
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        data-testid="input-loan-purpose"
                      />
                    </div>
                    {loanAmount && parseFloat(loanAmount) > 0 && parseFloat(loanAmount) <= loanLimit.limitUsd && (() => {
                      const { totalPayable, monthly } = calculateLoanMonthly(parseFloat(loanAmount), loanLimit.interestRate, loanTerm);
                      return (
                        <div className="bg-muted/40 rounded-xl p-4 text-sm grid grid-cols-3 gap-3">
                          <div><p className="text-xs text-muted-foreground">Monthly payment</p><p className="font-bold text-green-600">${monthly.toFixed(2)}</p></div>
                          <div><p className="text-xs text-muted-foreground">Total payable</p><p className="font-bold">${totalPayable.toFixed(2)}</p></div>
                          <div><p className="text-xs text-muted-foreground">Interest</p><p className="font-bold">${(totalPayable - parseFloat(loanAmount)).toFixed(2)}</p></div>
                        </div>
                      );
                    })()}
                    <Button
                      onClick={() => applyLoanMutation.mutate()}
                      disabled={applyLoanMutation.isPending || !loanAmount || parseFloat(loanAmount) < 50 || parseFloat(loanAmount) > loanLimit.limitUsd}
                      className="w-full bg-green-700 hover:bg-green-800 text-white"
                      data-testid="button-apply-loan"
                    >
                      {applyLoanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
                      Submit loan application
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Loan history */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <Card className="shadow-sm border-0">
                <CardHeader className="pb-2 pt-5"><CardTitle className="text-base">Loan history</CardTitle></CardHeader>
                <CardContent className="pb-5">
                  {(myLoans as any[]).length === 0 ? (
                    <div className="text-center py-10">
                      <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No loans yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(myLoans as any[]).map((loan: any) => (
                        <div key={loan.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border" data-testid={`row-loan-${loan.id}`}>
                          <div>
                            <p className="font-semibold">${parseFloat(loan.amountUsd).toFixed(2)} over {loan.termMonths} months</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{loan.purpose || "No purpose stated"} · {loan.interestRate}% /yr</p>
                          </div>
                          <Badge className={loan.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : loan.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}>
                            {loan.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Feature highlights */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {[
                  { label: "Flexible terms", desc: "6, 12, or 24 months", icon: Clock },
                  { label: "Quick review", desc: "Fast turnaround for active members", icon: Zap },
                  { label: "No collateral", desc: "Activity-based underwriting", icon: Shield },
                  { label: "15% flat rate", desc: "Competitive for business loans", icon: TrendingDown },
                ].map(f => (
                  <div key={f.label} className="bg-muted/50 rounded-xl p-4 border flex flex-col items-center gap-2">
                    <f.icon className="w-5 h-5 text-blue-500" />
                    <p className="font-semibold text-center">{f.label}</p>
                    <p className="text-xs text-muted-foreground text-center">{f.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contribute Dialog ─────────────────────────────────────────── */}
      <Dialog open={contributeOpen} onOpenChange={v => { setContributeOpen(v); if (!v) setContributeAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-tsia-green" />
              {isActivated ? "Add to QCE Savings" : "Activate QCE Savings"}
            </DialogTitle>
            <DialogDescription>
              {isActivated
                ? `Wallet balance: $${walletBalance.toFixed(2)} · QCE balance: $${qceBalance.toFixed(2)}`
                : `Minimum $${QCE.MIN_ACTIVATION} required to activate. Wallet: $${walletBalance.toFixed(2)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number" min={isActivated ? 1 : QCE.MIN_ACTIVATION} max={walletBalance}
                placeholder={isActivated ? "Enter amount" : `Min $${QCE.MIN_ACTIVATION}`}
                value={contributeAmt} onChange={e => setContributeAmt(e.target.value)}
                data-testid="input-qce-contribute-amount"
              />
            </div>
            {contributeAmt && parseFloat(contributeAmt) > walletBalance && <p className="text-xs text-red-500">Insufficient wallet balance.</p>}
            {!isActivated && contributeAmt && parseFloat(contributeAmt) < QCE.MIN_ACTIVATION && <p className="text-xs text-amber-600">Minimum ${QCE.MIN_ACTIVATION} required for activation.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContributeOpen(false)}>Cancel</Button>
            <Button
              className="bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => contributeMutation.mutate()}
              disabled={contributeMutation.isPending || !contributeAmt || parseFloat(contributeAmt) <= 0 || parseFloat(contributeAmt) > walletBalance || (!isActivated && parseFloat(contributeAmt) < QCE.MIN_ACTIVATION)}
              data-testid="button-confirm-qce-contribute"
            >
              {contributeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {isActivated ? "Contribute" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Dialog ───────────────────────────────────────────── */}
      <Dialog open={withdrawOpen} onOpenChange={v => { setWithdrawOpen(v); if (!v) setWithdrawAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600" /> Withdraw from QCE
            </DialogTitle>
            <DialogDescription>
              Available to withdraw: <strong>${maxWithdraw.toFixed(2)}</strong> (min ${QCE.MIN_BALANCE} retained)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number" min={0.01} max={maxWithdraw}
                placeholder={`Max $${maxWithdraw.toFixed(2)}`}
                value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                data-testid="input-qce-withdraw-amount"
              />
            </div>
            {withdrawAmt && parseFloat(withdrawAmt) > maxWithdraw && <p className="text-xs text-red-500">Exceeds available balance.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmt || parseFloat(withdrawAmt) <= 0 || parseFloat(withdrawAmt) > maxWithdraw}
              data-testid="button-confirm-qce-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Withdraw ${parseFloat(withdrawAmt || "0").toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
