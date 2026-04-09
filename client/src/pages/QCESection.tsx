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
  PiggyBank, TrendingUp, Lock, Unlock, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Clock, Zap, ShieldCheck, BarChart3, Loader2, RefreshCw,
  CalendarDays, DollarSign, History, ChevronLeft, Info,
  CarFront, Home, Banknote, AlertTriangle, TrendingDown, Building2,
  Shield, MapPin, Users, Star, Link as LinkIcon
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

type QceTab = "savings" | "car_connect" | "tenancy" | "loan";

const iv = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function QCESection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { formatAmount, rateLabel } = useLocalCurrency();

  // ── Navigation ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<QceTab | null>(null);

  // ── QCE Savings state ───────────────────────────────────────────────
  const [contributeOpen, setContributeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contributeAmt, setContributeAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  // ── Car Connect state ───────────────────────────────────────────────
  const [ccTab, setCcTab] = useState<"browse" | "register">("browse");
  const [ccForm, setCcForm] = useState({ make: "", model: "", year: "", seats: "4", dailyRate: "", city: "", phone: "", description: "" });
  const [ccSelectedCar, setCcSelectedCar] = useState<null | { name: string; city: string; rate: string; owner: string }>(null);
  const [ccConfirmOpen, setCcConfirmOpen] = useState(false);
  const [ccConnectOpen, setCcConnectOpen] = useState(false);
  const [ccBookingDate, setCcBookingDate] = useState("");
  const [ccBookingDays, setCcBookingDays] = useState("1");

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

  const ccBookMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/tour/book", data),
    onSuccess: () => toast({ title: "Connection request sent!", description: "The car owner will contact you shortly." }),
    onError: () => toast({ title: "Failed to connect", variant: "destructive" }),
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

      {/* QCE Savings card */}
      <Card className="shadow-sm border-0 overflow-hidden" data-testid="card-qce-savings-home">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-tsia-green/10 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5 text-tsia-green" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">QCE Savings</p>
                {isActivated
                  ? <Badge className="bg-tsia-green/10 text-tsia-green border-0 text-[10px]">Active · {daysActive}/{QCE.PERIOD_DAYS} days</Badge>
                  : <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Not activated</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isActivated ? `Balance: $${qceBalance.toFixed(2)} · Eligibility: ${eligibilityPct.toFixed(1)}%` : "Activate with min $5 to start building credit eligibility"}
              </p>
            </div>
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

      {/* Car Connect card */}
      <Card className="shadow-sm border-0" data-testid="card-qce-carconnect-home">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
              <CarFront className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold">Car Connect</p>
                <Badge className="bg-teal-100 text-teal-700 border-0 text-[10px]">Live</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Peer-to-peer vehicle sharing across Africa</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white flex-1" onClick={() => { setCcTab("browse"); setActiveTab("car_connect"); }} data-testid="btn-home-cc-find">
              <CarFront className="w-3.5 h-3.5 mr-1" /> Find a Car
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setCcTab("register"); setActiveTab("car_connect"); }} data-testid="btn-home-cc-register">
              List My Car
            </Button>
          </div>
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
                <h3 className="text-lg font-bold">QCE Savings</h3>
                <p className="text-xs text-muted-foreground">Quick Credit Eligibility · 90-day programme</p>
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
                <Zap className="w-4 h-4 mr-2" /> Activate QCE Savings — min $5
              </Button>
            )}

            {isActivated && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="shadow-sm border-0">
                    <CardContent className="pt-4 pb-4 text-center">
                      <PiggyBank className="w-4 h-4 text-tsia-green mx-auto mb-1" />
                      <p className="text-lg font-bold" data-testid="text-qce-balance">${qceBalance.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-0">
                    <CardContent className="pt-4 pb-4 text-center">
                      <BarChart3 className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                      <p className="text-lg font-bold" data-testid="text-qce-eligibility">{eligibilityPct.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">Eligibility</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-0">
                    <CardContent className="pt-4 pb-4 text-center">
                      <CalendarDays className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold" data-testid="text-qce-days">{daysActive}<span className="text-sm font-normal text-muted-foreground">/{QCE.PERIOD_DAYS}</span></p>
                      <p className="text-[10px] text-muted-foreground">Days active</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress */}
                <Card className="shadow-sm border-0">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">90-Day Progress</span>
                      <span className="font-bold text-tsia-green">{progressPct.toFixed(1)}%</span>
                    </div>
                    <Progress value={progressPct} className="h-2.5" data-testid="progress-qce" />
                    {savings?.startDate && (
                      <p className="text-xs text-muted-foreground">Started {format(new Date(savings.startDate), "dd MMM yyyy")}</p>
                    )}
                  </CardContent>
                </Card>

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
                <Card className={`shadow-sm border-0 ${creditPortalUnlocked ? "border-l-4 border-l-tsia-green" : ""}`}>
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {creditPortalUnlocked ? <Unlock className="w-4 h-4 text-tsia-green" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                      Credit Portal
                      {creditPortalUnlocked && <Badge className="ml-auto bg-tsia-green/10 text-tsia-green border-0 text-[10px]">Unlocked</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-2">
                      {[
                        { pct: 5,  label: "Micro-credit requests" },
                        { pct: 10, label: "Student loan applications" },
                        { pct: 20, label: "Increased limits + faster approval" },
                        { pct: 30, label: "Full eligibility — maximum access" },
                      ].map(tier => (
                        <div key={tier.pct} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${eligibilityPct >= tier.pct ? "text-tsia-green" : "text-muted-foreground/30"}`} />
                          <span className={eligibilityPct >= tier.pct ? "text-foreground font-medium" : "text-muted-foreground"}>{tier.pct}% — {tier.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Min balance notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Min <strong>${QCE.MIN_BALANCE}</strong> always retained. Withdrawals return to your Personal Wallet.</p>
                </div>

                {/* Transaction history */}
                {transactions.length > 0 && (
                  <Card className="shadow-sm border-0">
                    <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Recent Transactions</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/50">
                        {transactions.slice(0, 10).map(tx => (
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
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── CAR CONNECT ──────────────────────────────────────────── */}
        {activeTab === "car_connect" && (
          <motion.div key="car_connect" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
            <BackBtn />

            {/* Tab switcher */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
              {(["browse", "register"] as const).map(t => (
                <button key={t} onClick={() => setCcTab(t)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${ccTab === t ? "bg-white dark:bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`tab-cc-${t}`}>
                  {t === "browse" ? "Find a Car" : "Register My Car"}
                </button>
              ))}
            </div>

            {ccTab === "browse" && (
              <>
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-3 flex items-start gap-2 text-xs">
                  <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-teal-800 dark:text-teal-300 font-medium">All vehicle owners are verified TSIA members. Payments go through your wallet.</p>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 1, make: "Toyota", model: "Corolla", year: "2020", seats: 5, dailyRate: "$45", city: "Lagos, Nigeria", owner: "Chukwuemeka A.", rating: 4.9, trips: 34, img: "🚗", color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
                    { id: 2, make: "Honda", model: "CR-V", year: "2021", seats: 7, dailyRate: "$60", city: "Abuja, Nigeria", owner: "Fatima B.", rating: 5.0, trips: 18, img: "🚙", color: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800" },
                    { id: 3, make: "Hyundai", model: "Elantra", year: "2019", seats: 5, dailyRate: "$38", city: "Nairobi, Kenya", owner: "James K.", rating: 4.8, trips: 52, img: "🏎️", color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" },
                    { id: 4, make: "Ford", model: "Ranger (4x4)", year: "2022", seats: 5, dailyRate: "$75", city: "Accra, Ghana", owner: "Kwame A.", rating: 4.7, trips: 12, img: "🛻", color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
                    { id: 5, make: "Kia", model: "Sportage", year: "2020", seats: 5, dailyRate: "$55", city: "Port Harcourt, Nigeria", owner: "Sandra O.", rating: 4.9, trips: 27, img: "🚘", color: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
                  ].map(car => (
                    <Card key={car.id} className={`border-2 ${car.color.split(" ").slice(2).join(" ")} shadow-sm`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 ${car.color.split(" ").slice(0, 2).join(" ")} rounded-2xl flex items-center justify-center text-2xl shrink-0`}>{car.img}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <p className="font-bold text-sm">{car.year} {car.make} {car.model}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {car.city}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-teal-700 dark:text-teal-300">{car.dailyRate}</p>
                                <p className="text-[10px] text-muted-foreground">per day</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {car.seats} seats</span>
                              <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {car.rating} ({car.trips} trips)</span>
                              <span className="flex items-center gap-0.5"><Shield className="w-3 h-3 text-teal-500" /> Verified</span>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <p className="text-xs text-muted-foreground">Owner: <span className="font-semibold text-foreground">{car.owner}</span></p>
                              <Button size="sm" className="ml-auto bg-teal-600 hover:bg-teal-700 text-white text-xs h-7 px-3"
                                onClick={() => { setCcSelectedCar({ name: `${car.year} ${car.make} ${car.model}`, city: car.city, rate: car.dailyRate, owner: car.owner }); setCcConfirmOpen(true); }}
                                data-testid={`btn-connect-car-${car.id}`}>
                                <LinkIcon className="w-3 h-3 mr-1" /> Connect
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {ccTab === "register" && (
              <>
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-3 flex items-start gap-2 text-xs">
                  <Zap className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-teal-800 dark:text-teal-300 font-medium">Earn in USD. Payments are credited directly to your TSIA wallet.</p>
                </div>
                <Card className="shadow-sm border-2 border-teal-200 dark:border-teal-800">
                  <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><CarFront className="w-4 h-4 text-teal-600" /> Vehicle Registration</CardTitle></CardHeader>
                  <CardContent className="pb-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Make</Label><Input placeholder="e.g. Toyota" value={ccForm.make} onChange={e => setCcForm(f => ({ ...f, make: e.target.value }))} data-testid="input-cc-make" /></div>
                      <div className="space-y-1"><Label className="text-xs">Model</Label><Input placeholder="e.g. Corolla" value={ccForm.model} onChange={e => setCcForm(f => ({ ...f, model: e.target.value }))} data-testid="input-cc-model" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Year</Label><Input type="number" min="2000" max="2025" placeholder="2022" value={ccForm.year} onChange={e => setCcForm(f => ({ ...f, year: e.target.value }))} data-testid="input-cc-year" /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Seats</Label>
                        <select value={ccForm.seats} onChange={e => setCcForm(f => ({ ...f, seats: e.target.value }))} className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm" data-testid="select-cc-seats">
                          {["2","4","5","6","7","8"].map(n => <option key={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Daily Rate (USD)</Label><Input type="number" min="10" placeholder="45" value={ccForm.dailyRate} onChange={e => setCcForm(f => ({ ...f, dailyRate: e.target.value }))} data-testid="input-cc-rate" /></div>
                      <div className="space-y-1"><Label className="text-xs">Your City</Label><Input placeholder="Lagos, Nigeria" value={ccForm.city} onChange={e => setCcForm(f => ({ ...f, city: e.target.value }))} data-testid="input-cc-city" /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">WhatsApp / Phone</Label><Input placeholder="+234 80..." value={ccForm.phone} onChange={e => setCcForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-cc-phone" /></div>
                    <div className="space-y-1"><Label className="text-xs">Description (optional)</Label><Input placeholder="AC, Bluetooth, clean interior..." value={ccForm.description} onChange={e => setCcForm(f => ({ ...f, description: e.target.value }))} data-testid="input-cc-description" /></div>
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                      disabled={!ccForm.make || !ccForm.model || !ccForm.year || !ccForm.dailyRate || !ccForm.city || !ccForm.phone}
                      onClick={() => setCcConnectOpen(true)} data-testid="btn-cc-register">
                      <CarFront className="w-4 h-4 mr-2" /> Register Vehicle
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Connect/Book dialog */}
            <Dialog open={ccConfirmOpen} onOpenChange={v => { setCcConfirmOpen(v); if (!v) setCcSelectedCar(null); }}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><LinkIcon className="w-4 h-4 text-teal-600" /> Connect with Car Owner</DialogTitle>
                  <DialogDescription>Choose your booking dates and confirm your request.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {ccSelectedCar && (
                    <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3">
                      <p className="font-bold text-sm">{ccSelectedCar.name}</p>
                      <p className="text-xs text-muted-foreground">{ccSelectedCar.city} · {ccSelectedCar.owner}</p>
                      <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 mt-1">{ccSelectedCar.rate} / day</p>
                    </div>
                  )}
                  <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={ccBookingDate} min={new Date().toISOString().split("T")[0]} onChange={e => setCcBookingDate(e.target.value)} data-testid="input-cc-date" /></div>
                  <div className="space-y-1"><Label className="text-xs">Number of Days</Label><Input type="number" min="1" max="30" value={ccBookingDays} onChange={e => setCcBookingDays(e.target.value)} data-testid="input-cc-days" /></div>
                  {ccSelectedCar && ccBookingDate && ccBookingDays && (
                    <div className="bg-muted rounded-xl p-3 text-sm flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-teal-700 dark:text-teal-300">${(parseFloat(ccSelectedCar.rate.replace("$","")) * parseInt(ccBookingDays || "1")).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCcConfirmOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={!ccBookingDate || !ccBookingDays}
                    onClick={() => {
                      if (!ccSelectedCar) return;
                      const total = parseFloat(ccSelectedCar.rate.replace("$","")) * parseInt(ccBookingDays || "1");
                      ccBookMutation.mutate({ type: "car_connect", details: { ...ccSelectedCar, startDate: ccBookingDate, days: parseInt(ccBookingDays) }, amount: total });
                      setCcConfirmOpen(false); setCcSelectedCar(null); setCcBookingDate(""); setCcBookingDays("1");
                    }} data-testid="btn-cc-confirm-connect">
                    {ccBookMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon className="w-4 h-4 mr-2" />} Confirm & Connect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Register success dialog */}
            <Dialog open={ccConnectOpen} onOpenChange={setCcConnectOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-teal-600" /> Vehicle Registration</DialogTitle>
                  <DialogDescription>Your {ccForm.year} {ccForm.make} {ccForm.model} will be listed for ${ccForm.dailyRate}/day in {ccForm.city}.</DialogDescription>
                </DialogHeader>
                <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-4 text-xs space-y-1.5 my-2">
                  {["TSIA verifies your vehicle within 24h", "Your listing goes live on Car Connect", "Earnings are paid directly to your TSIA wallet"].map(s => (
                    <p key={s} className="flex items-start gap-2 text-teal-700 dark:text-teal-400"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {s}</p>
                  ))}
                </div>
                <DialogFooter>
                  <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={() => {
                    toast({ title: "Registration Submitted!", description: `Your ${ccForm.make} ${ccForm.model} has been submitted for verification.` });
                    setCcConnectOpen(false); setCcForm({ make: "", model: "", year: "", seats: "4", dailyRate: "", city: "", phone: "", description: "" });
                  }} data-testid="btn-cc-confirm-register">
                    Got it — Submit Registration
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
            <DialogTitle className="flex items-center gap-2"><PiggyBank className="w-5 h-5 text-tsia-green" />{isActivated ? "Add to QCE Savings" : "Activate QCE Savings"}</DialogTitle>
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
