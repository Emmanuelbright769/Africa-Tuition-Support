import { useState, useEffect, useRef } from "react";
import FinancialHub from "./FinancialHub";
import ReserveFund, { ReserveFundWidget } from "./ReserveFund";
import WalletSection from "./WalletSection";
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
  LogOut, Sun, Moon, Monitor, Hourglass, Eye, EyeOff, Banknote, Menu, X,
  LayoutDashboard, Star, History, ChevronRight, ChevronDown, Car, Globe, Loader2,
  AlertTriangle, DollarSign, Shield, Zap, TrendingDown, ArrowDownLeft, Copy, QrCode,
  ShoppingCart, MessageSquareText, PiggyBank, HeartPulse, Ambulance, Stethoscope, HeartHandshake, LayoutGrid
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


type Section = "overview" | "wallet" | "plans" | "activity" | "loan" | "tour_africa" | "fintech" | "reserve_fund" | "ecommerce" | "forum" | "qce" | "emergency_response";

const NAV_ITEMS: { id: Section; label: string; icon: any; badge?: string }[] = [
  { id: "overview",     label: "Overview",              icon: LayoutDashboard },
  { id: "fintech",      label: "Fintech Hub",            icon: CreditCard },
  { id: "wallet",       label: "Personal Wallet",         icon: Wallet },
  { id: "qce",          label: "QCE Savings",            icon: PiggyBank, badge: "New" },
  { id: "ecommerce",    label: "E-Commerce",             icon: ShoppingCart },
  { id: "tour_africa",  label: "Tour Africa",            icon: Car },
  { id: "reserve_fund", label: "Strategic Reserve Fund", icon: Shield },
  { id: "plans",        label: "Sponsorship Plans",      icon: Star },
  { id: "activity",     label: "Activity",               icon: History },
  { id: "loan",               label: "Student loan",           icon: Banknote },
  { id: "emergency_response", label: "Emergency Response",     icon: HeartPulse, badge: "Soon" },
  { id: "forum",              label: "Community Forum",        icon: MessageSquareText },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("");

  const { data: verification } = useQuery({ queryKey: ["/api/verification/status"] });
  const { data: transactions } = useQuery({ queryKey: ["/api/transactions"] });
  const { data: plan }         = useQuery({ queryKey: ["/api/sponsorship/plan"] });
  const { data: loanLimit, refetch: refetchLoanLimit } = useQuery<any>({ queryKey: ["/api/loans/limit"] });
  const { data: myLoans = [], refetch: refetchMyLoans } = useQuery<any[]>({ queryKey: ["/api/loans/my-loans"] });

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
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsorship/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Plan Selected", description: "Your sponsorship plan has been submitted for review." });
    },
  });


  const handleLogout = async () => { await logout(); setLocation("/"); };

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
  const feePaid          = verification?.portalFeePaid;
  const showPendingApproval = isPending && feePaid;
  const showGoToOnboarding  = !isVerified && !showPendingApproval && !feePaid;

  const themeOpts = [{ v: "light" as const, i: Sun }, { v: "dark" as const, i: Moon }, { v: "system" as const, i: Monitor }];

  const navigate = (section: Section) => {
    if (section === "tour_africa") { setMenuOpen(false); setLocation("/tour-africa"); return; }
    if (section !== "ecommerce") setOpenChatId(null);
    setActiveSection(section); setMenuOpen(false);
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
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Slide-in menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 h-full w-72 bg-card border-r shadow-2xl z-40 flex flex-col"
            >
              <div className="p-5 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Logo variant="badge" height={36} />
                  <div>
                    <p className="font-bold text-sm">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">Student Account</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {/* Top-level flat items: Overview, Fintech Hub, Personal Wallet */}
                {NAV_ITEMS.filter(item => ["overview", "fintech", "wallet"].includes(item.id)).map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id} onClick={() => { navigate(item.id); setMenuOpen(false); }}
                      data-testid={`nav-${item.id}`}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                      }`}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                {/* More Services collapsible group */}
                {(() => {
                  const serviceItems = NAV_ITEMS.filter(item => !["overview", "fintech", "wallet"].includes(item.id));
                  const anyServiceActive = serviceItems.some(i => i.id === activeSection);
                  const isOpen = servicesExpanded || anyServiceActive;
                  return (
                    <div>
                      <button
                        onClick={() => setServicesExpanded(v => !v)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          anyServiceActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <LayoutGrid className="w-4 h-4 shrink-0" />
                          <span>More Services</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-primary/20 pl-3">
                          {serviceItems.map(item => {
                            const isActive = activeSection === item.id;
                            return (
                              <button key={item.id} onClick={() => { navigate(item.id); setMenuOpen(false); }}
                                data-testid={`nav-${item.id}`}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}>
                                <div className="flex items-center gap-2">
                                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                                  <span>{item.label}</span>
                                </div>
                                {item.badge && (
                                  <Badge className="text-[10px] py-0 px-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">{item.badge}</Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </nav>
              <div className="p-4 border-t">
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="container mx-auto px-4 pt-8 pb-20 max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={containerVariants} initial="hidden" animate="visible"
            className="space-y-6"
          >

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
                      {showGoToOnboarding && (
                        <Button onClick={() => setLocation("/onboarding")} className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold h-11 px-6" data-testid="button-go-onboarding">
                          <ArrowUpRight className="w-4 h-4 mr-2" /> Complete Verification
                        </Button>
                      )}
                    </div>
                    {feePaid && (
                      <div className="bg-white/10 border border-white/20 px-8 py-4 rounded-xl text-center backdrop-blur-md shrink-0">
                        {plan ? (() => {
                          const planAge = Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000);
                          const planDaysLeft = Math.max(0, 365 - planAge);
                          return planDaysLeft > 0 ? (
                            <>
                              <div className="text-xs font-semibold text-slate-300 mb-2">Plan change in</div>
                              <div className="text-4xl font-bold font-mono flex items-center justify-center gap-2">
                                <Clock className="w-7 h-7 text-tsia-gold" />
                                {planDaysLeft} <span className="text-lg font-normal text-slate-400 font-sans">days</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-semibold text-slate-300 mb-2">Plan change</div>
                              <div className="text-2xl font-bold text-tsia-gold">Available now!</div>
                            </>
                          );
                        })() : (
                          <>
                            <div className="text-xs font-semibold text-slate-300 mb-2">Plan status</div>
                            <div className="text-2xl font-bold text-tsia-gold">{isVerified ? "Select now!" : "Pending"}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

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
                        {payoutMax > 0 && (
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
                              {item.badge && <p className="text-xs text-amber-600">{item.badge}</p>}
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

            {/* ── WALLET ── */}
            {activeSection === "wallet" && <WalletSection />}

            {/* ── QCE ── */}
            {activeSection === "qce" && <QCESection />}

            {/* ── PLANS ── */}
            {activeSection === "plans" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Sponsorship Plans</h2>
                  {(() => {
                    const planAge = plan?.createdAt ? Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000) : 0;
                    const planDaysLeft = plan ? Math.max(0, 365 - planAge) : 0;
                    return (
                      <p className="text-muted-foreground text-sm mb-6">
                        {plan && planDaysLeft > 0
                          ? `Active ${plan.planYears}-year plan. You can switch plans in ${planDaysLeft} day(s).`
                          : plan && planDaysLeft === 0
                          ? `Your ${plan.planYears}-year plan has completed 365 days. You may select a new plan.`
                          : isVerified
                          ? "Your account is verified — select a plan immediately to begin receiving funding."
                          : "Complete verification to unlock plans."}
                      </p>
                    );
                  })()}
                </motion.div>
                <motion.div variants={itemVariants}>
                  <div className="grid sm:grid-cols-3 gap-5">
                    {[
                      { years: 1, price: 35, payout: 230, coverage: "~85%" },
                      { years: 2, price: 45, payout: 460, coverage: "~90%", popular: true },
                      { years: 3, price: 50, payout: 690, coverage: "~92%" },
                    ].map(p => {
                      const isActive = plan?.planYears === p.years;
                      const planAge = plan?.createdAt ? Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000) : 0;
                      const planDaysLeft = plan ? Math.max(0, 365 - planAge) : 0;
                      const canSelect = isVerified && (!plan || planDaysLeft === 0) && !isActive;
                      return (
                        <div key={p.years} className={`relative rounded-2xl p-6 transition-all ${isActive ? 'border-2 border-primary bg-primary/5 shadow-lg' : p.popular ? 'border-2 border-primary/30' : 'border'}`}>
                          {p.popular && !isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Recommended</div>}
                          {isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Active</div>}
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-semibold text-lg">{p.years}-Year Plan</h4>
                            <span className="text-[10px] font-bold bg-tsia-green/10 text-tsia-green border border-tsia-green/20 rounded-full px-2 py-0.5">{p.coverage} sponsored</span>
                          </div>
                          <div className="text-4xl font-bold mb-4">${p.price}<span className="text-sm font-medium text-muted-foreground">/yr</span></div>
                          <ul className="space-y-3 mb-8 text-sm font-medium">
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Up to ${p.payout} payout</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> {p.coverage} academic cost covered</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Wallet access</li>
                          </ul>
                          <Button
                            variant={isActive || p.popular ? 'default' : 'outline'}
                            className="w-full h-11 font-semibold"
                            disabled={!canSelect || selectPlanMutation.isPending}
                            onClick={() => selectPlanMutation.mutate(p.years)}
                            data-testid={`button-plan-${p.years}`}
                          >
                            {isActive ? 'Active ✓' : !isVerified ? 'Verify first' : plan && planDaysLeft > 0 ? `Locked (${planDaysLeft}d)` : 'Select plan'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}

            {/* ── ACTIVITY ── */}
            {activeSection === "activity" && (
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
            {activeSection === "ecommerce" && (
              <motion.div variants={itemVariants}>
                <EcommerceSection initialOpenChatId={openChatId} />
              </motion.div>
            )}

            {/* ── EMERGENCY RESPONSE ── */}
            {activeSection === "emergency_response" && (
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
            {activeSection === "forum" && (
              <motion.div variants={itemVariants}>
                <ForumSection userSection="student" />
              </motion.div>
            )}

            {/* ── STRATEGIC RESERVE FUND ── */}
            {activeSection === "reserve_fund" && (
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
            {activeSection === "fintech" && (
              <motion.div variants={itemVariants}>
                <FinancialHub />
              </motion.div>
            )}

            {/* ── STUDENT LOAN ── */}
            {activeSection === "loan" && (
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
      </main>
    </div>
  );
}
