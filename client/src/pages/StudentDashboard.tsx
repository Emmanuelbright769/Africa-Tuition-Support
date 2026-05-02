import { useState, useEffect, useRef, useMemo } from "react";
import FinancialHub from "./FinancialHub";
import MoviesSection from "@/components/MoviesSection";
import ReserveFund, { ReserveFundWidget } from "./ReserveFund";
import EcommerceSection from "./EcommerceSection";
import ForumSection from "./ForumSection";
import QCESection from "./QCESection";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, Clock, Trophy, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight,
  LogOut, Sun, Moon, Monitor, Hourglass, Eye, EyeOff, Banknote, Menu, X, UserCircle2,
  LayoutDashboard, Star, History, ChevronRight, ChevronDown, Car, Globe, Loader2,
  AlertTriangle, DollarSign, Shield, Zap, TrendingDown, ArrowDownLeft, Copy, QrCode,
  ShoppingCart, MessageSquareText, PiggyBank, HeartPulse, Ambulance, Stethoscope, HeartHandshake, LayoutGrid, Info, KeyRound,
  Film, GraduationCap, BookOpen, Send
} from "lucide-react";
import { calculateLoanMonthly } from "@shared/schema";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { LearnMore } from "@/components/ui/LearnMore";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { DashboardSwitcher } from "@/components/ui/DashboardSwitcher";


type Section = "overview" | "plans" | "activity" | "loan" | "tour_africa" | "fintech" | "reserve_fund" | "ecommerce" | "forum" | "qce" | "emergency_response" | "movies" | "msc_plans";

const BASE_NAV_ITEMS: { id: Section; label: string; icon: any; badge?: string }[] = [
  { id: "overview",     label: "Overview",               icon: LayoutDashboard },
  { id: "fintech",      label: "Swift Hub",              icon: CreditCard },
  { id: "qce",          label: "QCE SwiftVault",         icon: PiggyBank, badge: "New" },
  { id: "ecommerce",    label: "TS-Mart Online Stores",  icon: ShoppingCart },
  { id: "tour_africa",  label: "Glide Africa",           icon: Car },
  { id: "movies",             label: "Movies & Streaming", icon: Film },
  { id: "reserve_fund", label: "Strategic Reserve Fund", icon: Shield },
  { id: "plans",        label: "Swift-Pay Plans",        icon: Star },
  { id: "msc_plans",    label: "Swift Pay MSc plans",    icon: GraduationCap, badge: "Soon" },
  { id: "activity",     label: "Activity",               icon: History },
  { id: "loan",               label: "Student loan",      icon: Banknote },
  { id: "emergency_response", label: "Emergency Response", icon: HeartPulse, badge: "Soon" },
  { id: "forum",              label: "Community Forum",   icon: MessageSquareText },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants       = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function StudentDashboard() {
  const { formatAmount, rateLabel } = useLocalCurrency();
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<Section>("overview");
  const navHistory = useRef<Section[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [sponsorCodeDialogOpen, setSponsorCodeDialogOpen] = useState(false);
  const [sponsorCodeInput, setSponsorCodeInput] = useState("");
  const [sponsorCodeLoading, setSponsorCodeLoading] = useState(false);
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("");

  const { data: verification } = useQuery({ queryKey: ["/api/verification/status"] });
  const { data: transactions } = useQuery({ queryKey: ["/api/transactions"] });
  const { data: plan }         = useQuery({ queryKey: ["/api/sponsorship/plan"] });
  const { data: loanLimit, refetch: refetchLoanLimit } = useQuery<any>({ queryKey: ["/api/loans/limit"] });
  const { data: myLoans = [], refetch: refetchMyLoans } = useQuery<any[]>({ queryKey: ["/api/loans/my-loans"] });
  const { data: walletData } = useQuery<any>({ queryKey: ["/api/wallet"] });
  const { data: batchStatus } = useQuery<any>({ queryKey: ["/api/sponsorship/batch-status"] });
  const { data: planPrices }  = useQuery<{ plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }>({ queryKey: ["/api/platform/plan-prices"] });
  const { data: notifData }   = useQuery<any>({ queryKey: ["/api/notifications"], refetchInterval: 60000 });

  const tsmartNewCount = useMemo(() =>
    (notifData?.notifications ?? []).filter((n: any) => n.type === "new_arrival" && !n.isRead).length,
    [notifData]
  );

  const NAV_ITEMS = useMemo(() =>
    BASE_NAV_ITEMS.map(item =>
      item.id === "ecommerce" && tsmartNewCount > 0
        ? { ...item, badge: tsmartNewCount > 9 ? "9+" : String(tsmartNewCount), _badgeRed: true }
        : item
    ),
    [tsmartNewCount]
  );
  const [batchCountdown, setBatchCountdown] = useState("");
  const [commitmentCountdown, setCommitmentCountdown] = useState("");
  const [planCountdown, setPlanCountdown] = useState("");
  const [deadlineCountdown, setDeadlineCountdown] = useState<string | null>(null);

  const walletActivated = walletData?.activated === true;

  const [activationPopupOpen, setActivationPopupOpen] = useState(false);
  useEffect(() => {
    if (!walletData) return;
    const dismissed = localStorage.getItem("tsia_wallet_activation_dismissed_" + user?.id);
    if (!dismissed && parseFloat(walletData.balance ?? "0") === 0) {
      setActivationPopupOpen(true);
    }
  }, [walletData, user?.id]);

  const applyLoanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loans/apply", { amountUsd: parseFloat(loanAmount), termMonths: loanTerm, purpose: loanPurpose });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application submitted", description: "Your student loan application is under review." });
      setLoanAmount(""); setLoanPurpose("");
      refetchLoanLimit(); refetchMyLoans();
    },
    onError: (err: any) => toast({ title: "Application failed", description: err.message, variant: "destructive" }),
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (planYears: number) => {
      const res = await apiRequest("POST", "/api/sponsorship/select", { planYears });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Plan selection failed");
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsorship/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Swift-Pay Plan Active ✓",
        description: `Your ${data.planYears}-year plan is active. $${data.totalCost} debited from wallet. Disbursement of $${data.maxPayout} is pending admin approval.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Plan selection failed", description: err.message, variant: "destructive" });
    },
  });


  const handleLogout = async () => { await logout(); setLocation("/"); };

  const handleSponsorCodeSubmit = async () => {
    if (!sponsorCodeInput.trim()) return;
    setSponsorCodeLoading(true);
    try {
      const res = await apiRequest("POST", "/api/verification/use-sponsor-code", { code: sponsorCodeInput.trim().toUpperCase() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code");
      toast({ title: "Sponsor Code Activated!", description: `$${Number(data.bonus ?? 5.5).toFixed(2)} has been credited to your wallet and your account is now active.` });
      setSponsorCodeDialogOpen(false);
      setSponsorCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      toast({ title: "Invalid Code", description: err.message, variant: "destructive" });
    } finally {
      setSponsorCodeLoading(false);
    }
  };

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      redirectTimerRef.current = setTimeout(() => {
        if (!queryClient.getQueryData(["/api/auth/me"])) setLocation("/login");
      }, 800);
    } else {
      if (redirectTimerRef.current) { clearTimeout(redirectTimerRef.current); redirectTimerRef.current = null; }
    }
    return () => { if (redirectTimerRef.current) { clearTimeout(redirectTimerRef.current); redirectTimerRef.current = null; } };
  }, [authLoading, user]);

  // Listen for chat notification deep-links — must be before any early return
  useEffect(() => {
    const handler = (e: Event) => {
      const chatId = (e as CustomEvent).detail?.chatId;
      if (chatId) { setOpenChatId(chatId); setActiveSection("ecommerce"); }
    };
    window.addEventListener("tsia:open-chat", handler);
    return () => window.removeEventListener("tsia:open-chat", handler);
  }, []);

  // Live countdown for closed batch
  useEffect(() => {
    if (!batchStatus?.nextOpenAt) { setBatchCountdown(""); return; }
    const due = new Date(batchStatus.nextOpenAt).getTime();
    const update = () => {
      const diff = due - Date.now();
      if (diff <= 0) { setBatchCountdown("Opening now…"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setBatchCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [batchStatus?.nextOpenAt]);

  // Live countdown for 30-day commitment window
  useEffect(() => {
    const ver = verification as any;
    if (!ver?.commitmentStartDate) { setCommitmentCountdown(""); return; }
    const due = new Date(ver.commitmentStartDate).getTime() + 30 * 24 * 60 * 60 * 1000;
    const update = () => {
      const diff = due - Date.now();
      if (diff <= 0) { setCommitmentCountdown("EXPIRED"); return; }
      const d = Math.floor(diff / 86400000);
      const h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setCommitmentCountdown(`${d}d ${h}:${m}:${s}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [(verification as any)?.commitmentStartDate]);

  // Live countdown for 72h wallet fund deadline
  useEffect(() => {
    if (!user?.walletFundDeadline || walletActivated) { setDeadlineCountdown(null); return; }
    const due = new Date(user.walletFundDeadline).getTime();
    const update = () => {
      const diff = due - Date.now();
      if (diff <= 0) { setDeadlineCountdown("EXPIRED — enrollment reset in progress"); return; }
      const h = Math.floor(diff / 3600000);
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setDeadlineCountdown(`${h}h ${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [user?.walletFundDeadline, walletActivated]);

  // Live countdown for 365-day active sponsorship plan
  useEffect(() => {
    const p = plan as any;
    if (!p?.createdAt) { setPlanCountdown(""); return; }
    const due = new Date(p.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000;
    const update = () => {
      const diff = due - Date.now();
      if (diff <= 0) { setPlanCountdown("Renewal available"); return; }
      const d = Math.floor(diff / 86400000);
      const h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setPlanCountdown(`${d}d ${h}:${m}:${s}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [(plan as any)?.createdAt]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const tier             = verification?.tier || "none";
  const tierLabel        = tier.charAt(0).toUpperCase() + tier.slice(1);
  const waecPct          = verification?.waecPercentage ? parseFloat(verification.waecPercentage) : null;
  const payoutMin        = verification?.payoutMin ? parseFloat(verification.payoutMin) : 0;
  const payoutMax        = verification?.payoutMax ? parseFloat(verification.payoutMax) : 0;
  const isVerified       = verification?.status === "verified";
  const isPending        = verification?.status === "pending";
  // feePaid is true only when enrolled in the CURRENT open batch
  // (so re-entry into a new batch works correctly after 30-day lockout)
  const feePaid = batchStatus != null
    ? (batchStatus.enrolledInCurrentBatch === true)
    : (verification?.portalFeePaid === true);
  const showPendingApproval = isPending && feePaid;
  const showGoToOnboarding  = !isVerified && !showPendingApproval && !feePaid && batchStatus?.status !== "closed";

  const themeOpts = [{ v: "light" as const, i: Sun }, { v: "dark" as const, i: Moon }, { v: "system" as const, i: Monitor }];

  const navigate = (section: Section) => {
    if (section === "tour_africa") { setMenuOpen(false); setLocation("/tour-africa"); return; }
    if (section !== "ecommerce") setOpenChatId(null);
    if (section === "ecommerce" && tsmartNewCount > 0) {
      apiRequest("PATCH", "/api/notifications/mark-type-read", { type: "new_arrival" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }))
        .catch(() => {});
    }
    navHistory.current.push(activeSection);
    setActiveSection(section); setMenuOpen(false);
  };

  const goBack = () => {
    const prev = navHistory.current.pop();
    if (prev && prev !== "overview") {
      setActiveSection(prev);
      setMenuOpen(false);
    } else {
      setActiveSection("overview");
      setMenuOpen(true);
    }
  };
  const currentNav = NAV_ITEMS.find(n => n.id === activeSection) ?? NAV_ITEMS[0]!;

  return (
    <div className="min-h-screen bg-background font-sans">

      {/* Navbar */}
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-foreground"
              data-testid="button-hamburger-menu"
              aria-label="Open menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Logo variant="badge" height={32} />
            <span className="text-xl font-bold tracking-tight hidden sm:block">Dashboard</span>
            <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{currentNav.label}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.i className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <span className="text-sm font-medium hidden sm:block text-muted-foreground">Hi, {user.firstName}</span>
            <DashboardSwitcher />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setLocation("/profile")} title="My Profile" data-testid="button-profile">
              <UserCircle2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Full-screen grid menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: "linear-gradient(135deg, #0a2e1a 0%, #0f3d22 50%, #1a5c32 100%)" }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Logo variant="badge" height={36} />
                <div>
                  <p className="font-bold text-sm text-white">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-white/50">Student Account</p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav grid */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
                      onClick={() => { navigate(item.id); setMenuOpen(false); }}
                      data-testid={`nav-${item.id}`}
                      className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all ${
                        isActive
                          ? "bg-tsia-gold border-tsia-gold/60 text-slate-900"
                          : "bg-white/8 border-white/10 text-white hover:bg-white/15 hover:border-white/25"
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isActive ? "bg-slate-900/20" : "bg-white/10"}`}>
                        <item.icon className={`w-5 h-5 ${isActive ? "text-slate-900" : "text-white"}`} />
                      </div>
                      <span className={`text-[11px] font-semibold leading-tight text-center ${isActive ? "text-slate-900" : "text-white/80"}`}>{item.label}</span>
                      {item.badge && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-tsia-gold text-slate-900 px-1.5 py-0.5 rounded-full leading-none">{item.badge}</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="px-5 py-4 border-t border-white/10 flex gap-3">
              <button onClick={() => { setLocation("/profile"); setMenuOpen(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                data-testid="button-menu-profile">
                <UserCircle2 className="w-4 h-4" /> My Profile
              </button>
              <button onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating nav button — only shown when a service is open */}
      {activeSection !== "overview" && (
        <button
          onClick={() => setMenuOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-full bg-card border shadow-xl text-sm font-bold transition-all hover:shadow-2xl active:scale-95"
          data-testid="btn-floating-menu"
        >
          <Menu className="w-4 h-4" />
          <span>{NAV_ITEMS.find(n => n.id === activeSection)?.label ?? "Menu"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Main content — overview normal, services cover entire screen (above nav) */}
      <main className={activeSection !== "overview" ? "fixed inset-0 z-50 bg-background overflow-y-auto" : "container mx-auto px-4 pt-8 pb-20 max-w-5xl"}>

        {/* Back button bar — shown for all service sections */}
        {activeSection !== "overview" && (
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b flex items-center gap-2 px-4 h-13 py-3 shadow-sm">
            <button onClick={goBack} className="p-1.5 rounded-xl hover:bg-muted transition-colors shrink-0" data-testid="btn-student-section-back">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <span className="font-bold text-sm truncate">{NAV_ITEMS.find(n => n.id === activeSection)?.label ?? activeSection}</span>
          </div>
        )}

        <div className={activeSection !== "overview" ? "container mx-auto px-4 pt-4 pb-24 max-w-5xl" : ""}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={containerVariants} initial="hidden" animate="visible"
            className="space-y-6"
          >

            {/* ── WALLET GATE: blocks all sections except overview when wallet not yet funded ── */}
            {!walletActivated && activeSection !== "overview" && (
              <motion.div variants={itemVariants} className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6">
                  <Wallet className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Fund Your Account First</h2>
                <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
                  To access this feature, you need to fund your TSIA wallet with above <strong>$5</strong> via Swift Hub. This unlocks all platform services including sponsorship, loans, e-commerce, and more.
                </p>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground font-bold px-8"
                  onClick={() => navigate("fintech")}
                  data-testid="button-wallet-gate-activate"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Fund via Swift Hub
                </Button>
                <p className="text-xs text-muted-foreground mt-4">Deposit above $5 · Activates immediately on confirmation</p>
              </motion.div>
            )}

            {/* ── OVERVIEW ── */}
            {activeSection === "overview" && (
              <>
                <motion.div variants={itemVariants} className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <p className="text-slate-400 text-sm font-medium mb-1">
                        {(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}, {user.firstName} 👋
                      </p>
                      <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${isVerified ? 'bg-green-500/20 text-green-400' : showPendingApproval ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          {isVerified ? <CheckCircle2 className="w-5 h-5" /> : showPendingApproval ? <Hourglass className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        {isVerified ? "Account Verified" : showPendingApproval ? "Pending Approval" : "Welcome to TSIA!"}
                      </h2>
                      <p className="text-slate-300 text-sm max-w-xl leading-relaxed mb-4">
                        {isVerified ? "Your documents are approved. Choose a sponsorship plan to begin receiving funding."
                          : showPendingApproval ? "Your application is under review by the TSIA team. You'll be notified within 24–48 hours."
                          : "Start by activating your wallet, then complete your verification (NIN + WAEC) to unlock sponsorship funding."}
                      </p>
                      <div className="flex flex-wrap gap-3 items-center">
                        {showGoToOnboarding && (
                          <Button
                            onClick={() => walletActivated ? setLocation("/onboarding") : navigate("fintech")}
                            className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold h-11 px-6"
                            data-testid="button-go-onboarding"
                          >
                            {walletActivated ? <ArrowUpRight className="w-4 h-4 mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                            {walletActivated ? "Swift-Apply" : "Complete Verification"}
                          </Button>
                        )}
                        <Button
                          onClick={() => setSponsorCodeDialogOpen(true)}
                          variant="outline"
                          className="border-tsia-gold text-tsia-gold hover:bg-tsia-gold/10 font-bold h-11 px-6"
                          data-testid="button-enter-sponsor-code"
                        >
                          <KeyRound className="w-4 h-4 mr-2" />
                          Enter Sponsor Code
                        </Button>
                      </div>
                      <Dialog open={sponsorCodeDialogOpen} onOpenChange={setSponsorCodeDialogOpen}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <KeyRound className="w-5 h-5 text-tsia-gold" />
                              Enter Your Sponsor Code
                            </DialogTitle>
                            <DialogDescription>
                              Have a code from a sponsor? Enter it below to activate your wallet and receive $5.50 instantly.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <Label htmlFor="sponsor-code-input">Sponsor Code</Label>
                            <Input
                              id="sponsor-code-input"
                              placeholder="e.g. TSIA-ABC1234"
                              value={sponsorCodeInput}
                              onChange={e => setSponsorCodeInput(e.target.value.toUpperCase())}
                              onKeyDown={e => e.key === "Enter" && handleSponsorCodeSubmit()}
                              className="font-mono tracking-widest uppercase"
                              data-testid="input-sponsor-code"
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSponsorCodeDialogOpen(false)} disabled={sponsorCodeLoading}>Cancel</Button>
                            <Button
                              onClick={handleSponsorCodeSubmit}
                              disabled={sponsorCodeLoading || !sponsorCodeInput.trim()}
                              className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold"
                              data-testid="button-submit-sponsor-code"
                            >
                              {sponsorCodeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                              {sponsorCodeLoading ? "Verifying…" : "Apply Code"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {feePaid && (
                      <div className="bg-white/10 border border-white/20 px-6 py-4 rounded-xl text-center backdrop-blur-md shrink-0 min-w-[140px]">
                        {plan ? (() => {
                          const planAge = Math.floor((Date.now() - new Date((plan as any).createdAt).getTime()) / 86400000);
                          const planDaysLeft = Math.max(0, 365 - planAge);
                          return planDaysLeft > 0 ? (
                            <>
                              <div className="text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-widest">Active plan expires in</div>
                              <div className="text-tsia-gold font-black font-mono text-lg leading-tight">
                                {planCountdown || `${planDaysLeft}d`}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">{(plan as any).planYears}-year plan</div>
                            </>
                          ) : (
                            <>
                              <div className="text-[10px] font-semibold text-slate-300 mb-1.5 uppercase tracking-widest">Plan renewal</div>
                              <div className="text-tsia-gold font-black text-base">Available!</div>
                            </>
                          );
                        })() : isVerified ? (
                          <>
                            <div className="text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-widest">Commitment clock</div>
                            <div className="text-tsia-gold font-black font-mono text-base leading-tight">
                              {commitmentCountdown || "—"}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] font-semibold text-slate-300 mb-1.5 uppercase tracking-widest">Plan status</div>
                            <div className="text-tsia-gold font-black text-base">Pending</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* 72h wallet fund deadline countdown banner — urgent */}
                {!walletActivated && deadlineCountdown && (
                  <motion.div
                    variants={itemVariants}
                    data-testid="banner-fund-deadline"
                    className="bg-red-600 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-lg shadow-red-500/30"
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white mb-0.5 text-base">Action Required — Fund Your Wallet Within 72 Hours!</p>
                      <p className="text-sm text-red-100 leading-relaxed">
                        Your WAEC validation has been completed. You must fund your TSIA SwiftWallet with above <strong>$5</strong> within <strong>72 hours</strong>, or your enrollment will be reset and you will need to restart the full onboarding process (including re-payment of the portal fee) to continue.
                        <br />
                        <span className="font-mono font-bold text-yellow-300 text-base mt-1 block">Time remaining: {deadlineCountdown}</span>
                      </p>
                    </div>
                    <Button size="sm" className="bg-white text-red-700 hover:bg-red-50 font-bold shrink-0" onClick={() => navigate("fintech")} data-testid="button-deadline-fund-wallet">
                      Fund Now
                    </Button>
                  </motion.div>
                )}

                {/* Wallet gate banner — shown below greeting when wallet not yet activated */}
                {!walletActivated && (
                  <motion.div variants={itemVariants} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200 mb-0.5">Activate Your Account to Unlock All Features</p>
                      <p className="text-sm text-amber-700 dark:text-amber-400">Fund your TSIA wallet with above <strong>$5</strong> via Swift Hub to access all platform services.</p>
                    </div>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={() => navigate("fintech")} data-testid="button-overview-wallet-activate">
                      Fund via Swift Hub
                    </Button>
                  </motion.div>
                )}

                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/40 dark:from-amber-600/20 to-transparent rounded-bl-full pointer-events-none"></div>
                    <CardHeader className="pb-2 relative z-10">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg text-amber-600"><Trophy className="w-5 h-5" /></div> Academic Tier
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-6 py-6 relative z-10">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-1 shadow-xl shadow-amber-200/50 shrink-0">
                        <div className="w-full h-full bg-card rounded-full flex items-center justify-center">
                          <Trophy className="w-12 h-12 text-amber-500" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold mb-1 tracking-tight" data-testid="text-tier">{tierLabel} Tier</h3>
                        {waecPct !== null && <p className="text-lg font-semibold text-primary mb-2">{waecPct}% Score</p>}
                        <p className="text-sm text-muted-foreground mb-3">{tier !== "none" ? "Based on your WAEC results" : "Complete onboarding to set tier"}</p>
                        {payoutMax > 0 && (() => {
                          if (!plan) return true;
                          const pAge = Math.floor((Date.now() - new Date((plan as any).createdAt).getTime()) / 86400000);
                          return Math.max(0, 365 - pAge) === 0;
                        })() && (
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="secondary" className="px-4 py-1.5 text-sm font-semibold">Payout: ${payoutMin} – ${payoutMax}</Badge>
                            <button
                              onClick={() => navigate("plans")}
                              data-testid="button-accept-offer"
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-tsia-green hover:bg-tsia-green/90 text-white text-xs font-bold shadow-md shadow-tsia-green/30 transition-all hover:scale-105 active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Accept Offer &amp; Deposit
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* MSc Sponsorship teaser card */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0 overflow-hidden relative group bg-gradient-to-br from-tsia-green/5 to-tsia-gold/5 dark:from-tsia-green/10 dark:to-tsia-gold/10">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-tsia-gold/20 to-transparent rounded-bl-full pointer-events-none" />
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-tsia-green/10 dark:bg-tsia-green/20 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-7 h-7 text-tsia-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-base">Master's Degree (MSc) Sponsorship</h3>
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] px-2 py-0.5 font-bold">Coming Soon</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          TSIA's postgraduate sponsorship programme — funding verified students pursuing an MSc or equivalent master's qualification. Identity and degree verification required.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> Identity Verification (KYC)
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5 text-tsia-green" /> Bachelor's Degree Transcript
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> University Admission Letter
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate("msc_plans")}
                        data-testid="button-view-msc-plans"
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-tsia-green hover:bg-tsia-green/90 text-white text-xs font-bold shadow-md shadow-tsia-green/20 transition-all hover:scale-105 active:scale-95"
                      >
                        <ArrowUpRight className="w-4 h-4" /> Learn More
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Quick nav dropdown */}
                <motion.div variants={itemVariants} className="relative">
                  <button
                    onClick={() => setQuickAccessOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left"
                    data-testid="button-quick-access-toggle"
                  >
                    <span className="text-sm font-semibold text-muted-foreground">Quick access</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${quickAccessOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {quickAccessOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border bg-card shadow-xl overflow-hidden"
                      >
                        {NAV_ITEMS.filter(n => n.id !== "overview").map((item, idx, arr) => (
                          <button
                            key={item.id}
                            onClick={() => { navigate(item.id); setQuickAccessOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left ${idx < arr.length - 1 ? "border-b" : ""}`}
                            data-testid={`quick-nav-${item.id}`}
                          >
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                              <item.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{item.label}</p>
                              {item.badge && <p className={`text-xs font-semibold ${(item as any)._badgeRed ? "text-red-600" : "text-amber-600"}`}>{item.badge}</p>}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </>
            )}

            {/* ── QCE ── */}
            {activeSection === "qce" && walletActivated && <QCESection />}

            {/* ── PLANS ── */}
            {activeSection === "plans" && walletActivated && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Swift-Pay Plans</h2>
                  {(() => {
                    const planAge = plan?.createdAt ? Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000) : 0;
                    const planDaysLeft = plan ? Math.max(0, 365 - planAge) : 0;
                    // 30-day commitment window from admin approval
                    const approvalDate = verification?.commitmentStartDate ? new Date(verification.commitmentStartDate) : null;
                    const windowEnd = approvalDate ? approvalDate.getTime() + 30 * 24 * 60 * 60 * 1000 : null;
                    const windowDaysLeft = windowEnd ? Math.max(0, Math.ceil((windowEnd - Date.now()) / 86400000)) : null;
                    const withinWindow = windowEnd ? Date.now() < windowEnd : false;
                    return (
                      <>
                        <p className="text-muted-foreground text-sm mb-4">
                          {plan && planDaysLeft > 0
                            ? `Active ${plan.planYears}-year plan. You can renew after ${planDaysLeft} day(s).`
                            : plan && planDaysLeft === 0
                            ? `Your ${plan.planYears}-year plan has completed 365 days. You may select a new plan.`
                            : isVerified && withinWindow
                            ? `Your offer is approved! Select and pay for a plan within your ${windowDaysLeft}-day commitment window.`
                            : isVerified && !withinWindow && !plan
                            ? "Your 30-day commitment window has expired. Please contact support."
                            : "Complete verification to unlock sponsorship plans."}
                        </p>
                        {/* Commitment Clock — 30-day window */}
                        {isVerified && !plan && windowEnd && (
                          (() => {
                            const urgent = (windowDaysLeft ?? 0) <= 5;
                            const expired = !withinWindow;
                            return (
                              <div className={`rounded-2xl overflow-hidden mb-5 border ${expired ? "border-red-300 dark:border-red-700" : urgent ? "border-amber-300 dark:border-amber-700" : "border-tsia-green/40 dark:border-tsia-green/30"}`}>
                                {/* Header strip */}
                                <div className={`px-4 py-2.5 flex items-center gap-2 ${expired ? "bg-red-600" : urgent ? "bg-amber-500" : "bg-tsia-green"}`}>
                                  <Hourglass className="w-4 h-4 text-white" />
                                  <span className="text-white text-xs font-bold uppercase tracking-wider">
                                    {expired ? "Commitment Window Expired" : "Commitment Clock — Act Now"}
                                  </span>
                                </div>
                                {/* Body */}
                                <div className={`p-4 ${expired ? "bg-red-50 dark:bg-red-900/20" : urgent ? "bg-amber-50 dark:bg-amber-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                                  {!expired ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                      {/* Live timer */}
                                      <div className="text-center shrink-0">
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${urgent ? "text-amber-600" : "text-tsia-green"}`}>Time remaining</p>
                                        <p className={`text-2xl font-black font-mono tracking-tight ${urgent ? "text-amber-700 dark:text-amber-400" : "text-tsia-green"}`}>
                                          {commitmentCountdown || `${windowDaysLeft}d`}
                                        </p>
                                      </div>
                                      <div className={`hidden sm:block w-px self-stretch ${urgent ? "bg-amber-300" : "bg-tsia-green/30"}`} />
                                      <div className="flex-1 text-center sm:text-left">
                                        <p className={`text-sm font-bold mb-0.5 ${urgent ? "text-amber-800 dark:text-amber-300" : "text-green-800 dark:text-green-200"}`}>
                                          {urgent ? "⚠ Deadline approaching — select your plan now!" : "Your offer is approved! Select and pay for a plan."}
                                        </p>
                                        <p className={`text-xs ${urgent ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
                                          Payment is debited directly from your wallet. Deadline: <strong>{new Date(windowEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center py-1">
                                      <p className="text-red-700 dark:text-red-400 font-bold text-sm">Your 30-day commitment window has closed.</p>
                                      <p className="text-red-600 dark:text-red-500 text-xs mt-0.5">Contact support at <span className="font-semibold underline">support@tsiforafrica.com</span> to discuss re-enrollment options.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </>
                    );
                  })()}
                  {/* Batch status banner — shown to ALL users when batch is closed */}
                  {batchStatus?.status === "closed" && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 mb-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="bg-blue-100 dark:bg-blue-800/50 p-2 rounded-lg shrink-0">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-blue-900 dark:text-blue-200 text-sm">
                            {batchStatus.enrolledInCurrentBatch
                              ? "You're enrolled — next batch opens soon"
                              : "Enrollment Batch Full"}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                            {batchStatus.enrolledInCurrentBatch
                              ? "Your application is being reviewed. A new batch will open after 30 days — you will need to re-apply and pay the fee again to join."
                              : "This batch has reached capacity. Wait for the next batch to open, then pay the fee and re-apply."}
                          </p>
                        </div>
                      </div>
                      {/* Live countdown */}
                      <div className="bg-white/60 dark:bg-black/20 rounded-xl p-3 flex items-center gap-3">
                        <Hourglass className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold">Next batch opens in</p>
                          <p className="text-lg font-bold text-blue-800 dark:text-blue-200 font-mono tracking-tight">
                            {batchCountdown || (batchStatus.nextOpenAt
                              ? new Date(batchStatus.nextOpenAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                              : "Soon")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
                <motion.div variants={itemVariants}>
                  {(() => {
                    // Compute commitment window for plan cards
                    const planAge = plan?.createdAt ? Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000) : 0;
                    const planDaysLeft = plan ? Math.max(0, 365 - planAge) : 0;
                    const approvalDate = verification?.commitmentStartDate ? new Date(verification.commitmentStartDate) : null;
                    const windowEnd = approvalDate ? approvalDate.getTime() + 30 * 24 * 60 * 60 * 1000 : null;
                    const withinWindow = windowEnd ? Date.now() < windowEnd : false;
                    // User's actual payout per year from their tier
                    const tierPayoutMax = payoutMax || 230;
                    const tierPayoutMin = payoutMin || 225;
                    const SERVICE_CHARGE = planPrices?.serviceChargeRate ?? 0.10;
                    return (
                      <div className="grid sm:grid-cols-3 gap-5">
                        {[
                          { years: 1, price: planPrices?.plan1yr ?? 35, coverage: "~85%" },
                          { years: 2, price: planPrices?.plan2yr ?? 45, coverage: "~90%", popular: true },
                          { years: 3, price: planPrices?.plan3yr ?? 50, coverage: "~92%" },
                        ].map(p => {
                          const isActive = plan?.planYears === p.years;
                          const canSelect = isVerified && withinWindow && (!plan || planDaysLeft === 0) && !isActive;
                          const serviceCharge = parseFloat((p.price * SERVICE_CHARGE).toFixed(2));
                          const totalCost = p.price + serviceCharge;
                          const totalPayoutMin = tierPayoutMin * p.years;
                          const totalPayoutMax = tierPayoutMax * p.years;
                          return (
                            <div key={p.years} className={`relative rounded-2xl p-6 transition-all ${isActive ? 'border-2 border-primary bg-primary/5 shadow-lg' : p.popular ? 'border-2 border-primary/30' : 'border'}`}>
                              {p.popular && !isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Recommended</div>}
                              {isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Active</div>}
                              <div className="flex items-start justify-between mb-1">
                                <h4 className="font-semibold text-lg">{p.years}-Year Plan</h4>
                                <span className="text-[10px] font-bold bg-tsia-green/10 text-tsia-green border border-tsia-green/20 rounded-full px-2 py-0.5">{p.coverage} sponsored</span>
                              </div>
                              <div className="text-4xl font-bold mb-1">${totalCost.toFixed(2)}<span className="text-sm font-medium text-muted-foreground"> total</span></div>
                              <p className="text-[11px] text-muted-foreground mb-4">${p.price.toFixed(2)} base + ${serviceCharge.toFixed(2)} service charge (10%)</p>
                              <ul className="space-y-3 mb-8 text-sm font-medium">
                                <li className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                  {isVerified && tierPayoutMax > 0
                                    ? `$${totalPayoutMin.toFixed(0)}–$${totalPayoutMax.toFixed(0)} payout`
                                    : "Payout based on your tier"}
                                </li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {p.coverage} academic cost covered</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Full wallet access</li>
                              </ul>
                              <Button
                                variant={isActive || p.popular ? 'default' : 'outline'}
                                className="w-full h-11 font-semibold"
                                disabled={!canSelect || selectPlanMutation.isPending}
                                onClick={() => selectPlanMutation.mutate(p.years)}
                                data-testid={`button-plan-${p.years}`}
                              >
                                {isActive ? 'Active ✓'
                                  : !isVerified ? 'Verify first'
                                  : !withinWindow && !plan ? 'Window expired'
                                  : plan && planDaysLeft > 0 ? `Locked (${planDaysLeft}d)`
                                  : `Pay $${totalCost.toFixed(2)} — Select`}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </motion.div>

                {/* 365-Day Active Sponsorship Countdown */}
                {plan && (() => {
                  const planAge = Math.floor((Date.now() - new Date((plan as any).createdAt).getTime()) / 86400000);
                  const planDaysLeft = Math.max(0, 365 - planAge);
                  const expiryDate = new Date(new Date((plan as any).createdAt).getTime() + 365 * 24 * 60 * 60 * 1000);
                  const pct = Math.min(100, Math.round((planAge / 365) * 100));
                  return planDaysLeft > 0 ? (
                    <motion.div variants={itemVariants} className="rounded-2xl overflow-hidden border border-tsia-green/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                      <div className="px-4 py-2.5 bg-tsia-green flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-white" />
                          <span className="text-white text-xs font-bold uppercase tracking-wider">Active Sponsorship Period</span>
                        </div>
                        <span className="text-white/80 text-[10px] font-semibold">{(plan as any).planYears}-Year Plan</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-tsia-green font-bold mb-0.5">Time remaining</p>
                            <p className="text-2xl font-black font-mono text-tsia-green tracking-tight">{planCountdown || `${planDaysLeft}d`}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Expires on</p>
                            <p className="text-sm font-bold text-foreground">{expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                            <p className="text-[10px] text-muted-foreground">{planAge} of 365 days elapsed</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="w-full bg-tsia-green/10 rounded-full h-2.5 overflow-hidden">
                            <div className="h-full bg-tsia-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                            <span>Plan started</span>
                            <span>{pct}% elapsed</span>
                            <span>365 days</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div variants={itemVariants} className="rounded-2xl border border-tsia-gold/40 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-tsia-gold/20 rounded-full flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-tsia-gold" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">Your {(plan as any).planYears}-year plan has completed its 365-day period.</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">You may now select a new sponsorship plan above.</p>
                      </div>
                    </motion.div>
                  );
                })()}
              </>
            )}

            {/* ── ACTIVITY ── */}
            {activeSection === "activity" && walletActivated && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Activity</h2>
                  <p className="text-muted-foreground text-sm mb-6">Your complete transaction history.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-6">
                      {(!transactions || transactions.length === 0) ? (
                        <div className="text-center py-16">
                          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground">No transactions yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {transactions.map((tx: any) => (
                            <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border hover:shadow-sm transition-shadow" data-testid={`row-tx-${tx.id}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  tx.type === 'sponsorship_credit' ? 'bg-green-50 dark:bg-green-900/30 text-green-600' :
                                  tx.type === 'withdrawal' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' :
                                  tx.type === 'vat_deduction' ? 'bg-red-50 dark:bg-red-900/30 text-red-600' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {tx.type === 'sponsorship_credit' ? <CheckCircle2 className="w-4 h-4" /> :
                                   tx.type === 'withdrawal' ? <ArrowUpRight className="w-4 h-4" /> :
                                   <CreditCard className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{tx.description}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className={`font-bold text-sm ${parseFloat(tx.amount) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {parseFloat(tx.amount) >= 0 ? '+' : ''}${tx.amount}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── E-COMMERCE ── */}
            {activeSection === "ecommerce" && walletActivated && (
              <motion.div variants={itemVariants}>
                <EcommerceSection initialOpenChatId={openChatId} />
              </motion.div>
            )}

            {/* ── EMERGENCY RESPONSE ── */}
            {activeSection === "emergency_response" && walletActivated && (
              <motion.div variants={itemVariants} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
                    <HeartPulse className="w-6 h-6 text-red-500" /> Emergency Response
                  </h2>
                  <p className="text-muted-foreground text-sm">Rapid care services — wherever you are in Africa.</p>
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      icon: Ambulance,
                      color: "text-red-600",
                      bg: "bg-red-50 dark:bg-red-900/20",
                      border: "border-red-200 dark:border-red-800",
                      title: "Ambulance Services",
                      desc: "On-demand emergency ambulance dispatch to your location. Real-time GPS tracking, trained paramedics, and direct hospital coordination.",
                    },
                    {
                      icon: Stethoscope,
                      color: "text-blue-600",
                      bg: "bg-blue-50 dark:bg-blue-900/20",
                      border: "border-blue-200 dark:border-blue-800",
                      title: "Medical Expert Home Service",
                      desc: "Book a verified doctor or nurse to visit your home. Diagnosis, treatment, and prescription — all without leaving your door.",
                    },
                    {
                      icon: HeartHandshake,
                      color: "text-purple-600",
                      bg: "bg-purple-50 dark:bg-purple-900/20",
                      border: "border-purple-200 dark:border-purple-800",
                      title: "Age to Grey Health Insurance",
                      desc: "Lifetime health coverage designed for older Africans. Comprehensive plans covering hospitalisation, chronic illness, and preventive care.",
                    },
                  ].map(({ icon: Icon, color, bg, border, title, desc }) => (
                    <div key={title} className={`${bg} border ${border} rounded-2xl p-5 flex items-start gap-4`}>
                      <div className={`w-12 h-12 rounded-2xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-base">{title}</p>
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] px-2 py-0.5">Coming Soon</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-muted/40 border border-border rounded-2xl p-4 text-center">
                  <HeartPulse className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="font-semibold text-sm">Services launching soon</p>
                  <p className="text-xs text-muted-foreground mt-1">Emergency Response services are in development. You will be notified as soon as they go live.</p>
                </div>
              </motion.div>
            )}

            {/* ── COMMUNITY FORUM ── */}
            {activeSection === "forum" && walletActivated && (
              <motion.div variants={itemVariants}>
                <ForumSection userSection="student" />
              </motion.div>
            )}

            {/* ── MOVIES ── */}
            {activeSection === "movies" && (
              <motion.div variants={itemVariants}>
                <MoviesSection />
              </motion.div>
            )}

            {/* ── MSC PLANS ── */}
            {activeSection === "msc_plans" && (
              <motion.div variants={itemVariants} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
                    <GraduationCap className="w-6 h-6 text-tsia-green" /> Swift Pay MSc Plans
                  </h2>
                  <p className="text-muted-foreground text-sm">Postgraduate sponsorship for eligible TSIA students pursuing a Master's degree.</p>
                </div>

                {/* Coming soon hero */}
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-24 h-24 bg-tsia-green/10 rounded-full flex items-center justify-center mb-6">
                    <GraduationCap className="w-12 h-12 text-tsia-green" />
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-sm px-4 py-1.5 mb-4">Coming Soon</Badge>
                  <h3 className="text-2xl font-bold mb-3">MSc Sponsorship Launching Soon</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed text-sm mb-8">
                    TSIA is building a dedicated postgraduate sponsorship track. Verified BSc holders admitted to a recognised MSc programme will be eligible to apply for tuition co-funding.
                  </p>
                </div>

                {/* Requirements preview */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-tsia-green" /> Eligibility Requirements (Preview)
                    </CardTitle>
                    <CardDescription>What you will need when applications open</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: "Identity Verification", desc: "Valid NIN, BVN, or government-issued ID confirmed via KYC" },
                        { label: "Bachelor's Degree", desc: "First-class or second-class upper division (2:1 minimum) transcript" },
                        { label: "MSc Admission Letter", desc: "Unconditional offer from a recognised university (local or international)" },
                        { label: "Programme Duration", desc: "Full-time or part-time MSc of at least 12 months" },
                        { label: "Active TSIA SwiftWallet", desc: "Wallet must be funded and verified before applying" },
                      ].map((req, i) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                          <div className="w-6 h-6 rounded-full bg-tsia-green/10 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{req.label}</p>
                            <p className="text-xs text-muted-foreground">{req.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Expression of interest */}
                <Card className="border-0 shadow-sm bg-tsia-green/5 dark:bg-tsia-green/10">
                  <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-10 h-10 bg-tsia-green/20 rounded-xl flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5 text-tsia-green" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm mb-0.5">Be the First to Know</p>
                      <p className="text-xs text-muted-foreground">We'll notify you via your registered email and dashboard as soon as MSc applications open. No action needed — you're already in the queue.</p>
                    </div>
                    <Badge className="bg-tsia-green text-white text-xs px-3 py-1.5 shrink-0">Auto-notified</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── STRATEGIC RESERVE FUND ── */}
            {activeSection === "reserve_fund" && walletActivated && (
              <motion.div variants={itemVariants}>
                <div className="mb-5">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-tsia-green" /> Strategic Reserve Fund
                  </h2>
                  <p className="text-muted-foreground text-sm">20% of every trade deposit — growing in real-time</p>
                </div>
                <ReserveFund />
              </motion.div>
            )}

            {/* ── FINTECH HUB ── */}
            {activeSection === "fintech" && walletActivated && (
              <motion.div variants={itemVariants}>
                <FinancialHub />
              </motion.div>
            )}

            {/* ── STUDENT LOAN ── */}
            {activeSection === "loan" && walletActivated && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Student loan programme</h2>
                  <LearnMore label="Learn more about this programme" className="mt-1 mb-5">
                    <p className="text-muted-foreground text-sm">Low-interest education financing exclusively for verified TSIA students.</p>
                  </LearnMore>
                </motion.div>

                {/* Eligibility / stats */}
                <motion.div variants={itemVariants}>
                  {!loanLimit ? (
                    <Card className="shadow-sm border-0 mb-4"><CardContent className="pt-8 pb-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  ) : !loanLimit.eligible ? (
                    <Card className="shadow-sm border-0 mb-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
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
                    <div className="grid sm:grid-cols-3 gap-4 mb-5">
                      {[
                        { label: "Your limit", value: `$${loanLimit.limitUsd}`, sub: `${loanLimit.tier?.charAt(0).toUpperCase() + loanLimit.tier?.slice(1)} tier`, color: "text-green-600 dark:text-green-400" },
                        { label: "Interest rate", value: "10% /yr", sub: "Flat annual rate", color: "text-blue-600 dark:text-blue-400" },
                        { label: "Available terms", value: "6 / 12 / 18", sub: "Months", color: "text-purple-600 dark:text-purple-400" },
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
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-sm border-0 mb-5 bg-blue-50 dark:bg-blue-900/10">
                      <CardHeader className="pb-2 pt-5"><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4" />Active loan</CardTitle></CardHeader>
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
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-sm border-0 mb-5">
                      <CardHeader className="pb-3 pt-5"><CardTitle className="text-base">Apply for a student loan</CardTitle></CardHeader>
                      <CardContent className="pb-6 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Loan amount (USD)</label>
                            <input
                              type="number" min={20} max={loanLimit.limitUsd} step={10}
                              value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                              placeholder={`Up to $${loanLimit.limitUsd}`}
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
                              {[6, 12, 18].map(t => <option key={t} value={t}>{t} months</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Purpose (optional)</label>
                          <input
                            type="text" value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)}
                            placeholder="e.g. Tuition, accommodation, study materials..."
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            data-testid="input-loan-purpose"
                          />
                        </div>
                        {loanAmount && parseFloat(loanAmount) > 0 && parseFloat(loanAmount) <= loanLimit.limitUsd && (() => {
                          const { totalPayable, monthly } = calculateLoanMonthly(parseFloat(loanAmount), 10, loanTerm);
                          return (
                            <div className="bg-muted/40 rounded-xl p-4 text-sm grid grid-cols-3 gap-3">
                              <div><p className="text-xs text-muted-foreground">Monthly</p><p className="font-bold text-green-600">${monthly.toFixed(2)}</p></div>
                              <div><p className="text-xs text-muted-foreground">Total payable</p><p className="font-bold">${totalPayable.toFixed(2)}</p></div>
                              <div><p className="text-xs text-muted-foreground">Interest</p><p className="font-bold">${(totalPayable - parseFloat(loanAmount)).toFixed(2)}</p></div>
                            </div>
                          );
                        })()}
                        <Button
                          onClick={() => applyLoanMutation.mutate()}
                          disabled={applyLoanMutation.isPending || !loanAmount || parseFloat(loanAmount) < 20 || parseFloat(loanAmount) > loanLimit.limitUsd}
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
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border-0 mb-5">
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
                                <p className="text-xs text-muted-foreground mt-0.5">{loan.purpose || "No purpose stated"} · 10% /yr</p>
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
                <motion.div variants={itemVariants}>
                  <LearnMore label="How this loan works">
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                      {[
                        { label: "Low interest", desc: "10% flat annual rate for students", icon: TrendingDown },
                        { label: "No collateral", desc: "Identity-based underwriting via TSIA enrollment", icon: Shield },
                        { label: "Quick review", desc: "Decisions within 24–48 hours", icon: Zap },
                      ].map(f => (
                        <div key={f.label} className="bg-muted/50 rounded-xl p-4 border flex items-start gap-3">
                          <f.icon className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold">{f.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </LearnMore>
                </motion.div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      {/* ── Wallet Activation Popup ── */}
      <Dialog open={activationPopupOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-tsia-green to-emerald-600 flex items-center justify-center shadow-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Activate Your Wallet</DialogTitle>
                <p className="text-xs text-muted-foreground">Required to unlock all TSIA features</p>
              </div>
            </div>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              To access QCE SwiftVault, loans, e-commerce, the trade market, and all other platform features, please <strong>fund your SwiftWallet with above $5</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-tsia-green/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-tsia-green" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Activate with above $5</p>
                <p className="text-xs text-muted-foreground mt-0.5">Go to Swift Hub → Fund Account to deposit via card, bank transfer, or USDT crypto. Admin confirms within 30 minutes.</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Minimum balance:</strong> At least <strong>$2 must remain</strong> in your wallet at all times to keep platform services running — payments, transfers, and features stay active.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" className="flex-1"
              onClick={() => { localStorage.setItem("tsia_wallet_activation_dismissed_" + user?.id, "1"); setActivationPopupOpen(false); }}
              data-testid="button-activation-later">
              Remind Me Later
            </Button>
            <Button className="flex-1 bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => { localStorage.setItem("tsia_wallet_activation_dismissed_" + user?.id, "1"); setActivationPopupOpen(false); navigate("fintech"); }}
              data-testid="button-activation-goto-wallet">
              <CreditCard className="w-4 h-4 mr-2" /> Fund via Swift Hub
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
