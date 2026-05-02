import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  PiggyBank, Lock, Unlock, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Clock, Zap, BarChart3, Loader2, RefreshCw,
  CalendarDays, History, ChevronLeft, Info, GraduationCap,
  CarFront, Home, Banknote, AlertTriangle, TrendingDown,
  Shield, MapPin, CreditCard, BadgeCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { QCE, calculateLoanMonthly } from "@shared/schema";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";

// ── Types ───────────────────────────────────────────────────────────────
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

type QceTab = "savings" | "v_connect" | "tenancy" | "loan";

// ── V-Connect sample vehicles ────────────────────────────────────────────
const V_CONNECT_VEHICLES = [
  { id: 1, make: "Toyota", model: "Camry", year: 2023, priceNgn: 28_000_000, city: "Lagos, Nigeria", badge: "Popular", color: "bg-tsia-green/10 border-tsia-green/30" },
  { id: 2, make: "Honda", model: "CR-V", year: 2022, priceNgn: 32_000_000, city: "Abuja, Nigeria", badge: "New", color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  { id: 3, make: "Hyundai", model: "Tucson", year: 2023, priceNgn: 26_500_000, city: "Port Harcourt, Nigeria", badge: null, color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" },
  { id: 4, make: "Ford", model: "Ranger (4x4)", year: 2022, priceNgn: 45_000_000, city: "Accra, Ghana", badge: "Premium", color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  { id: 5, make: "Kia", model: "Sportage", year: 2024, priceNgn: 30_000_000, city: "Nairobi, Kenya", badge: "New", color: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800" },
  { id: 6, make: "Toyota", model: "Land Cruiser", year: 2021, priceNgn: 120_000_000, city: "Lagos, Nigeria", badge: "Flagship", color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
];

const iv = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

// ── QCE Credit Calculator ────────────────────────────────────────────────────
function QceCreditCalculator({ qceBalance, eligibilityPct }: { qceBalance: number; eligibilityPct: number }) {
  const [calcAmount, setCalcAmount] = useState("1000");
  const [calcTerm, setCalcTerm] = useState(12);
  const INTEREST_RATE = 0.15; // 15% per year

  const maxCredit = parseFloat(((qceBalance * eligibilityPct) / 100).toFixed(2));
  const requestedAmt = parseFloat(calcAmount) || 0;
  const isOverLimit = requestedAmt > maxCredit;
  const interestTotal = requestedAmt * INTEREST_RATE * (calcTerm / 12);
  const totalRepay = requestedAmt + interestTotal;
  const monthlyPayment = totalRepay / calcTerm;

  return (
    <Card className="shadow-sm border-0 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-600" /> Credit Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        <div className="bg-card rounded-xl p-3 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Max Credit Limit (30% of balance)</span>
          <span className="font-bold text-tsia-green text-sm">${maxCredit.toFixed(2)}</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Credit Amount ($)</Label>
          <Input type="number" min="1" max={maxCredit} value={calcAmount}
            onChange={e => setCalcAmount(e.target.value)} placeholder="Enter amount"
            className={`h-9 text-sm ${isOverLimit ? "border-red-400" : ""}`} data-testid="input-qce-calc-amount" />
          {isOverLimit && <p className="text-[10px] text-red-500">Exceeds your max credit limit of ${maxCredit.toFixed(2)}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Repayment Term</Label>
          <div className="flex gap-2 flex-wrap">
            {[6, 12, 18, 24].map(m => (
              <button key={m} onClick={() => setCalcTerm(m)} data-testid={`btn-calc-term-${m}`}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${calcTerm === m ? "bg-purple-600 text-white border-purple-600" : "bg-muted border-border hover:border-purple-400"}`}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        {requestedAmt > 0 && !isOverLimit && (
          <div className="bg-card rounded-xl p-3 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Credit Amount</span><span className="font-semibold">${requestedAmt.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Interest (15% p.a.)</span><span className="font-semibold">${interestTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Repayable</span><span className="font-semibold">${totalRepay.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Monthly Payment</span><span className="font-bold text-purple-600">${monthlyPayment.toFixed(2)}/mo</span></div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">This is an indicative estimate only. Actual credit approval subject to review.</p>
      </CardContent>
    </Card>
  );
}

export default function QCESection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { formatAmount, rateLabel } = useLocalCurrency();

  // ── Navigation ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<QceTab | null>(null);
  const [qceTxPage, setQceTxPage] = useState(0);
  const QCE_PAGE_SIZE = 10;

  // ── QCE SwiftVault state ───────────────────────────────────────────────
  const [contributeOpen, setContributeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contributeAmt, setContributeAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  // ── V-Connect state ──────────────────────────────────────────────────
  const [vcSelectedVehicle, setVcSelectedVehicle] = useState<typeof V_CONNECT_VEHICLES[0] | null>(null);
  const [vcInterestOpen, setVcInterestOpen] = useState(false);
  const [vcSuccessOpen, setVcSuccessOpen] = useState(false);

  // ── Business Loan state ─────────────────────────────────────────────
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────
  const { data, isLoading: qceLoading, refetch: refetchQce } = useQuery<QceStatus>({ queryKey: ["/api/qce/status"] });
  const { data: walletData } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: loanLimit } = useQuery<any>({ queryKey: ["/api/loans/limit"] });
  const { data: myLoans = [] } = useQuery<any[]>({ queryKey: ["/api/loans/my-loans"] });

  // ── Derived ─────────────────────────────────────────────────────────
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

  const vcEligibilityOk = eligibilityPct >= 30;
  const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

  // ── Mutations ───────────────────────────────────────────────────────
  const contributeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/qce/contribute", { amountUsd: parseFloat(contributeAmt) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: isActivated ? "Contribution added!" : "QCE Activated!", description: d.message });
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
    mutationFn: async () => { const res = await apiRequest("POST", "/api/qce/tick", {}); return res.json(); },
    onSuccess: () => { toast({ title: "Progress updated" }); refetchQce(); },
  });

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

  // ── Home dashboard cards ────────────────────────────────────────────
  const HomeView = () => (
    <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">

      {/* QCE SwiftVault card */}
      <Card className="shadow-sm border-0 overflow-hidden" data-testid="card-qce-savings-home">
        <CardContent className="pt-5 pb-5">
          <div className="w-full">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <div className="flex items-baseline gap-1 leading-none">
                  <span className="text-xl font-black text-tsia-gold tracking-tight uppercase">SWIFT</span>
                  <span className="text-xl font-black text-tsia-gold tracking-tight uppercase">VAULT</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mt-0.5">
                  Fast. Secure. Empowering.
                </p>
              </div>
              {isActivated
                ? <Badge className="bg-tsia-green/10 text-tsia-green border-0 text-[10px] shrink-0">Active · 30% Eligible</Badge>
                : <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] shrink-0">Not activated</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {isActivated ? `Balance: $${qceBalance.toFixed(2)} · Eligibility: ${eligibilityPct.toFixed(1)}%` : "Activate with above $5 to start building credit eligibility"}
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-tsia-green hover:bg-tsia-green/90 text-white flex-1" onClick={() => setContributeOpen(true)} data-testid="btn-home-qce-contribute">
              <ArrowDownLeft className="w-3.5 h-3.5 mr-1" /> {isActivated ? "Add Savings" : "Activate"}
            </Button>
            {isActivated && (
              <Button size="sm" variant="outline" onClick={() => setActiveTab("savings")} data-testid="btn-home-qce-view">
                View Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* V-Connect card */}
      <Card className="shadow-sm border-0" data-testid="card-qce-vconnect-home">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-tsia-gold/10 flex items-center justify-center shrink-0">
              <CarFront className="w-5 h-5 text-tsia-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold">V-Connect</p>
                <Badge className="bg-tsia-gold/10 text-tsia-gold border-0 text-[10px]">Vehicle Credit</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Purchase vehicles on credit — 30% credit eligibility granted instantly on your first deposit</p>
            </div>
          </div>
          <Button size="sm" className="w-full bg-tsia-gold hover:bg-tsia-gold/90 text-white" onClick={() => setActiveTab("v_connect")} data-testid="btn-home-vc-explore">
            <CarFront className="w-3.5 h-3.5 mr-1" /> Explore Vehicles
          </Button>
        </CardContent>
      </Card>

      {/* Tenancy Gateway card */}
      <Card className="shadow-sm border-0" data-testid="card-qce-tenancy-home">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold">Landlord Tenancy Gateway</p>
              <p className="text-xs text-muted-foreground mt-0.5">Property listings with lease financing — lump-sum to landlords, instalments for tenants</p>
            </div>
          </div>
          <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/tenancy")} data-testid="btn-home-tenancy-open">
            <Home className="w-3.5 h-3.5 mr-1" /> Open Tenancy Gateway
          </Button>
        </CardContent>
      </Card>

      {/* Business Loan card */}
      <Card className="shadow-sm border-0" data-testid="card-qce-loan-home">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold">Business Loan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loanLimit?.eligible
                  ? `Eligible · Up to $${loanLimit.limitUsd?.toLocaleString()} at ${loanLimit.interestRate}% /yr`
                  : "Flexible financing based on your referral activity"}
              </p>
            </div>
            {loanLimit?.activeLoan && <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] shrink-0">Active loan</Badge>}
          </div>
          <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setActiveTab("loan")} data-testid="btn-home-loan-open">
            <Banknote className="w-3.5 h-3.5 mr-1" /> {loanLimit?.eligible && !loanLimit?.activeLoan ? "Apply Now" : "View Details"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // ── Back button ────────────────────────────────────────────────────
  const BackBtn = () => (
    <button
      onClick={() => setActiveTab(null)}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium mb-4 transition-colors"
      data-testid="btn-qce-back"
    >
      <ChevronLeft className="w-4 h-4" /> Back to QCE features
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">
      <AnimatePresence mode="wait">

        {/* ── HOME ─────────────────────────────────────────────────── */}
        {!activeTab && <HomeView key="home" />}

        {/* ── QCE SAVINGS ──────────────────────────────────────────── */}
        {activeTab === "savings" && (
          <motion.div key="savings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
            <BackBtn />

            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-2xl font-black text-tsia-gold tracking-tight uppercase">SWIFT</span>
                  <span className="text-2xl font-black text-tsia-gold tracking-tight uppercase">VAULT</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mt-0.5">
                  Fast. Secure. Empowering.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isActivated && (
                  <Button variant="outline" size="sm" onClick={() => tickMutation.mutate()} disabled={tickMutation.isPending} data-testid="button-qce-refresh">
                    {tickMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                )}
                {isActivated
                  ? <Badge className="bg-tsia-green/10 text-tsia-green border-0 text-xs">Active</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Not activated</Badge>}
              </div>
            </div>

            {!isActivated && (
              <Button onClick={() => setContributeOpen(true)} className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white" data-testid="button-activate-qce">
                <Zap className="w-4 h-4 mr-2" /> Activate QCE SwiftVault — above $5
              </Button>
            )}

            {isActivated && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="shadow-sm border-0">
                    <CardContent className="pt-4 pb-4 text-center">
                      <PiggyBank className="w-4 h-4 text-tsia-green mx-auto mb-1" />
                      <p className="text-lg font-bold" data-testid="text-qce-balance">${qceBalance.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-0 bg-tsia-green/5">
                    <CardContent className="pt-4 pb-4 text-center">
                      <Zap className="w-4 h-4 text-tsia-green mx-auto mb-1" />
                      <p className="text-lg font-bold text-tsia-green" data-testid="text-qce-eligibility">{eligibilityPct.toFixed(0)}%</p>
                      <p className="text-[10px] text-muted-foreground">Credit Eligibility</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Instant eligibility notice */}
                <div className="bg-tsia-green/10 border border-tsia-green/20 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-tsia-green">Full 30% Credit Eligibility Activated</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Your first deposit instantly unlocked all credit services. No waiting period required.</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button onClick={() => setContributeOpen(true)} className="bg-tsia-green hover:bg-tsia-green/90 text-white flex-1" data-testid="button-qce-contribute">
                    <ArrowDownLeft className="w-4 h-4 mr-2" /> Add Savings
                  </Button>
                  <Button variant="outline" onClick={() => setWithdrawOpen(true)} disabled={!canWithdraw} className="flex-1" data-testid="button-qce-withdraw">
                    <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw
                  </Button>
                </div>

                {/* Credit portal unlock tiers */}
                <Card className="shadow-sm border-0 border-l-4 border-l-tsia-green">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-tsia-green" />
                      Credit Portal
                      <Badge className="ml-auto bg-tsia-green/10 text-tsia-green border-0 text-[10px]">All Unlocked</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-[10px] text-muted-foreground mb-3">All credit services activated automatically on your first deposit — no waiting period.</p>
                    <div className="space-y-2">
                      {[
                        { label: "V-Connect Vehicle Credit", icon: CarFront },
                        { label: "Student Loan Applications", icon: GraduationCap },
                        { label: "Home / Tenancy Credit", icon: Home },
                        { label: "Business Credit (max access)", icon: Banknote },
                      ].map(({ label, icon: Icon }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-tsia-green" />
                          <Icon className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Min balance notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Min <strong>${QCE.MIN_BALANCE}</strong> always retained. Withdrawals return to your SwiftWallet.</p>
                </div>

                {/* Credit Calculator — always shown when activated */}
                <QceCreditCalculator qceBalance={qceBalance} eligibilityPct={eligibilityPct} />

                {/* Transaction history */}
                {transactions.length > 0 && (() => {
                  const totalQcePages = Math.ceil(transactions.length / QCE_PAGE_SIZE);
                  const qcePage = transactions.slice(qceTxPage * QCE_PAGE_SIZE, (qceTxPage + 1) * QCE_PAGE_SIZE);
                  return (
                  <Card className="shadow-sm border-0">
                    <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Transactions</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/50">
                        {qcePage.map(tx => (
                          <div key={tx.id} className="flex items-center gap-3 px-5 py-3" data-testid={`row-qce-tx-${tx.id}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tx.type === "contribution" ? "bg-tsia-green/10" : "bg-red-100 dark:bg-red-900/20"}`}>
                              {tx.type === "contribution" ? <ArrowDownLeft className="w-3.5 h-3.5 text-tsia-green" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium capitalize">{tx.type}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}</p>
                            </div>
                            <p className={`text-sm font-bold ${tx.type === "contribution" ? "text-tsia-green" : "text-red-500"}`}>
                              {tx.type === "contribution" ? "+" : "-"}${parseFloat(tx.amountUsd).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {totalQcePages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t">
                          <button onClick={() => setQceTxPage(p => Math.max(0, p - 1))} disabled={qceTxPage === 0}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            ← Prev
                          </button>
                          <span className="text-xs text-muted-foreground">Page {qceTxPage + 1} of {totalQcePages}</span>
                          <button onClick={() => setQceTxPage(p => Math.min(totalQcePages - 1, p + 1))} disabled={qceTxPage >= totalQcePages - 1}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next →
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })()}
              </>
            )}
          </motion.div>
        )}

        {/* ── V-CONNECT ────────────────────────────────────────────── */}
        {activeTab === "v_connect" && (
          <motion.div key="v_connect" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
            <BackBtn />

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tsia-gold/10 flex items-center justify-center shrink-0">
                <CarFront className="w-5 h-5 text-tsia-gold" />
              </div>
              <div>
                <h3 className="text-lg font-bold">V-Connect</h3>
                <p className="text-xs text-muted-foreground">Vehicle Purchase Credit — 30% QCE eligibility required</p>
              </div>
              {vcEligibilityOk
                ? <Badge className="ml-auto bg-tsia-green/10 text-tsia-green border-0 text-[10px] shrink-0"><BadgeCheck className="w-3 h-3 mr-0.5" /> Eligible</Badge>
                : <Badge className="ml-auto bg-amber-100 text-amber-700 border-0 text-[10px] shrink-0">{eligibilityPct.toFixed(1)}% / 30%</Badge>}
            </div>

            {/* ── Terms notice ───────────────────────────────────── */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3" data-testid="card-vc-terms">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 dark:text-red-300 space-y-1">
                <p className="font-semibold">Important: Early withdrawal resets eligibility</p>
                <p>If you change or withdraw your QCE SwiftVault plan before the 90-day target is complete, your savings are returned without profit and your QCE credit eligibility resets to zero.</p>
              </div>
            </div>

            {/* ── Vehicle listings ────────────────────────────────── */}
            <div>
              <p className="text-sm font-bold mb-3">Available Vehicles via V-Connect Credit</p>
              <div className="space-y-3">
                {V_CONNECT_VEHICLES.map(vehicle => (
                  <Card key={vehicle.id} className={`border-2 ${vehicle.color} shadow-sm`} data-testid={`card-vc-vehicle-${vehicle.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-tsia-gold/10 flex items-center justify-center shrink-0">
                          <CarFront className="w-6 h-6 text-tsia-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-sm">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                                {vehicle.badge && (
                                  <Badge className="text-[9px] bg-tsia-gold/10 text-tsia-gold border-0 h-4">{vehicle.badge}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {vehicle.city}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-tsia-gold text-sm" data-testid={`text-vc-price-${vehicle.id}`}>{formatNaira(vehicle.priceNgn)}</p>
                              <p className="text-[10px] text-muted-foreground">purchase price</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <p className="text-[10px] text-muted-foreground">
                              30% deposit: <span className="font-semibold text-foreground">{formatNaira(vehicle.priceNgn * 0.3)}</span>
                            </p>
                            <Button
                              size="sm"
                              className={`ml-auto text-xs h-7 px-3 ${vcEligibilityOk ? "bg-tsia-gold hover:bg-tsia-gold/90 text-white" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
                              disabled={!vcEligibilityOk}
                              onClick={() => { setVcSelectedVehicle(vehicle); setVcInterestOpen(true); }}
                              data-testid={`btn-vc-interest-${vehicle.id}`}
                            >
                              <CreditCard className="w-3 h-3 mr-1" /> Express Interest
                            </Button>
                          </div>
                          {!vcEligibilityOk && (
                            <p className="text-[10px] text-amber-600 mt-1">
                              Requires 30% QCE eligibility · you have {eligibilityPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Express Interest dialog */}
            <Dialog open={vcInterestOpen} onOpenChange={v => { setVcInterestOpen(v); if (!v) setVcSelectedVehicle(null); }}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CarFront className="w-4 h-4 text-tsia-gold" /> Express Interest
                  </DialogTitle>
                  <DialogDescription>
                    Submit your interest in purchasing this vehicle via V-Connect credit.
                  </DialogDescription>
                </DialogHeader>
                {vcSelectedVehicle && (
                  <div className="bg-tsia-gold/5 border border-tsia-gold/20 rounded-xl p-4 my-2">
                    <p className="font-bold text-sm">{vcSelectedVehicle.year} {vcSelectedVehicle.make} {vcSelectedVehicle.model}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {vcSelectedVehicle.city}</p>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">Purchase price</span>
                      <span className="font-bold text-tsia-gold">{formatNaira(vcSelectedVehicle.priceNgn)}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="text-muted-foreground">30% deposit required</span>
                      <span className="font-semibold">{formatNaira(vcSelectedVehicle.priceNgn * 0.3)}</span>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVcInterestOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-tsia-gold hover:bg-tsia-gold/90 text-white"
                    onClick={() => { setVcInterestOpen(false); setVcSuccessOpen(true); }}
                    data-testid="btn-vc-confirm-interest"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Submit Application
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Success dialog */}
            <Dialog open={vcSuccessOpen} onOpenChange={setVcSuccessOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-tsia-green" /> Application Received
                  </DialogTitle>
                </DialogHeader>
                <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-2xl p-4 my-2 space-y-2 text-sm">
                  <p className="font-semibold text-tsia-green">Your V-Connect application has been submitted!</p>
                  <p className="text-muted-foreground text-xs">A TSIA advisor will contact you within 48 hours to discuss your V-Connect credit plan and next steps.</p>
                </div>
                <DialogFooter>
                  <Button className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white" onClick={() => { setVcSuccessOpen(false); setVcSelectedVehicle(null); }} data-testid="btn-vc-success-close">
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}

        {/* ── BUSINESS LOAN ─────────────────────────────────────────── */}
        {activeTab === "loan" && (
          <motion.div key="loan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
            <BackBtn />
            <h3 className="text-lg font-bold">Business Loan</h3>

            {/* Eligibility */}
            {!loanLimit ? (
              <Card className="shadow-sm border-0"><CardContent className="pt-8 pb-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
            ) : !loanLimit.eligible ? (
              <Card className="shadow-sm border-0 bg-amber-50 dark:bg-amber-900/10">
                <CardContent className="pt-5 pb-5 flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Not yet eligible</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">{loanLimit.reason}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Loan limit", value: `$${loanLimit.limitUsd?.toLocaleString()}`, color: "text-green-600" },
                  { label: "Interest rate", value: `${loanLimit.interestRate}% /yr`, color: "text-blue-600" },
                  { label: "Referrals", value: loanLimit.referralCount || 0, color: "text-purple-600" },
                ].map(s => (
                  <Card key={s.label} className="shadow-sm border-0">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Active loan */}
            {loanLimit?.activeLoan && (
              <Card className="shadow-sm border-0 bg-blue-50 dark:bg-blue-900/10">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4" /> Active Loan</CardTitle></CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: "Amount", value: `$${parseFloat(loanLimit.activeLoan.amountUsd).toFixed(2)}` },
                      { label: "Monthly", value: `$${parseFloat(loanLimit.activeLoan.monthlyPaymentUsd).toFixed(2)}` },
                      { label: "Total payable", value: `$${parseFloat(loanLimit.activeLoan.totalPayableUsd).toFixed(2)}` },
                      { label: "Status", value: <Badge className="capitalize">{loanLimit.activeLoan.status}</Badge> },
                    ].map(f => (
                      <div key={f.label} className="bg-white dark:bg-blue-900/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        <p className="font-semibold text-sm mt-0.5">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Application form */}
            {loanLimit?.eligible && !loanLimit?.activeLoan && (
              <Card className="shadow-sm border-0">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Apply for a Business Loan</CardTitle></CardHeader>
                <CardContent className="pb-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Amount (USD)</label>
                      <input type="number" min={50} max={loanLimit.limitUsd} step={50} value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                        placeholder={`Max $${loanLimit.limitUsd}`} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" data-testid="input-loan-amount" />
                      {parseFloat(loanAmount) > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">≈ {formatAmount(parseFloat(loanAmount))} {rateLabel()}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Term</label>
                      <select value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border bg-background text-sm" data-testid="select-loan-term">
                        {(loanLimit.terms || [6, 12, 24]).map((t: number) => <option key={t} value={t}>{t} months</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Purpose (optional)</label>
                    <input type="text" value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)}
                      placeholder="Business expansion, inventory..." className="w-full px-3 py-2 rounded-lg border bg-background text-sm" data-testid="input-loan-purpose" />
                  </div>
                  {loanAmount && parseFloat(loanAmount) > 0 && parseFloat(loanAmount) <= loanLimit.limitUsd && (() => {
                    const { totalPayable, monthly } = calculateLoanMonthly(parseFloat(loanAmount), loanLimit.interestRate, loanTerm);
                    return (
                      <div className="bg-muted/40 rounded-xl p-3 text-sm grid grid-cols-3 gap-2">
                        <div><p className="text-[10px] text-muted-foreground">Monthly</p><p className="font-bold text-green-600">${monthly.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-bold">${totalPayable.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Interest</p><p className="font-bold">${(totalPayable - parseFloat(loanAmount)).toFixed(2)}</p></div>
                      </div>
                    );
                  })()}
                  <Button onClick={() => applyLoanMutation.mutate()}
                    disabled={applyLoanMutation.isPending || !loanAmount || parseFloat(loanAmount) < 50 || parseFloat(loanAmount) > loanLimit.limitUsd}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white" data-testid="button-apply-loan">
                    {applyLoanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
                    Submit Application
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loan history */}
            {(myLoans as any[]).length > 0 && (
              <Card className="shadow-sm border-0">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Loan History</CardTitle></CardHeader>
                <CardContent className="pb-4 space-y-2">
                  {(myLoans as any[]).map((loan: any) => (
                    <div key={loan.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border" data-testid={`row-loan-${loan.id}`}>
                      <div>
                        <p className="font-semibold text-sm">${parseFloat(loan.amountUsd).toFixed(2)} · {loan.termMonths}mo</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{loan.purpose || "No purpose stated"} · {loan.interestRate}% /yr</p>
                      </div>
                      <Badge className={loan.status === "active" ? "bg-green-100 text-green-800" : loan.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}>
                        {loan.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Feature tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Flexible terms", desc: "6, 12 or 24 months", icon: Clock },
                { label: "No collateral", desc: "Activity-based underwriting", icon: Shield },
                { label: "Quick review", desc: "Fast for active members", icon: Zap },
                { label: "15% flat rate", desc: "Competitive for businesses", icon: TrendingDown },
              ].map(f => (
                <div key={f.label} className="bg-muted/50 rounded-xl p-3 border flex items-center gap-2">
                  <f.icon className="w-4 h-4 text-purple-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Contribute Dialog ────────────────────────────────────────── */}
      <Dialog open={contributeOpen} onOpenChange={v => { setContributeOpen(v); if (!v) setContributeAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PiggyBank className="w-5 h-5 text-tsia-green" />{isActivated ? "Add to QCE SwiftVault" : "Activate QCE SwiftVault"}</DialogTitle>
            <DialogDescription>{isActivated ? `Wallet: $${walletBalance.toFixed(2)} · QCE: $${qceBalance.toFixed(2)}` : `Min $${QCE.MIN_ACTIVATION} required. Wallet: $${walletBalance.toFixed(2)}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" min={isActivated ? 1 : QCE.MIN_ACTIVATION} max={walletBalance}
                placeholder={isActivated ? "Enter amount" : `Min $${QCE.MIN_ACTIVATION}`}
                value={contributeAmt} onChange={e => setContributeAmt(e.target.value)} data-testid="input-qce-contribute-amount" />
            </div>
            {contributeAmt && parseFloat(contributeAmt) > walletBalance && <p className="text-xs text-red-500">Insufficient wallet balance.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContributeOpen(false)}>Cancel</Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => contributeMutation.mutate()}
              disabled={contributeMutation.isPending || !contributeAmt || parseFloat(contributeAmt) <= 0 || parseFloat(contributeAmt) > walletBalance || (!isActivated && parseFloat(contributeAmt) < QCE.MIN_ACTIVATION)}
              data-testid="button-confirm-qce-contribute">
              {contributeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {isActivated ? "Contribute" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Withdraw Dialog ──────────────────────────────────────────── */}
      <Dialog open={withdrawOpen} onOpenChange={v => { setWithdrawOpen(v); if (!v) setWithdrawAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-blue-600" /> Withdraw from QCE</DialogTitle>
            <DialogDescription>Available: <strong>${maxWithdraw.toFixed(2)}</strong> (min ${QCE.MIN_BALANCE} retained)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input type="number" min={0.01} max={maxWithdraw} placeholder={`Max $${maxWithdraw.toFixed(2)}`}
                value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} data-testid="input-qce-withdraw-amount" />
            </div>
            {withdrawAmt && parseFloat(withdrawAmt) > maxWithdraw && <p className="text-xs text-red-500">Exceeds available balance.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmt || parseFloat(withdrawAmt) <= 0 || parseFloat(withdrawAmt) > maxWithdraw}
              data-testid="button-confirm-qce-withdraw">
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Withdraw ${parseFloat(withdrawAmt || "0").toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
