import { useState, useEffect, useRef } from "react";
import FinancialHub from "./FinancialHub";
import ReserveFund, { ReserveFundWidget } from "./ReserveFund";
import WalletSection from "./WalletSection";
import { useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Copy, Users, Share2, LogOut, Sun, Moon, Monitor, TrendingUp, Link2,
  Banknote, Clock, Crown, Sparkles, CheckCircle2, AlertCircle, Loader2,
  Target, BarChart3, Infinity, Star, Wallet, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, ChevronDown, ChevronUp, Shield, Zap, Globe,
  Menu, X, LayoutDashboard, ChevronRight, ShoppingCart, Tag, MessageSquareText,
  Bot, Car, Package, ArrowRight, TrendingDown, Info, ExternalLink,
  Home, Building2, Calculator, DollarSign, RefreshCw, AlertTriangle,
  Eye, EyeOff, Bell, Power, Timer, CreditCard
} from "lucide-react";
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
import { CO_AFFILIATE_PROGRAM, TRADE_MARKET, TRADE_BROKERS, getEliteSharePercentage, calculateLoanMonthly } from "@shared/schema";
import EcommerceSection from "./EcommerceSection";
import ForumSection from "./ForumSection";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const itemVariants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  "100": { bg: "bg-blue-50 dark:bg-blue-900/20",    border: "border-blue-200 dark:border-blue-800",    text: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",    icon: "🥉" },
  "300": { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", icon: "🥈" },
  "500": { bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-200 dark:border-amber-800",   text: "text-amber-700 dark:text-amber-300",   badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",   icon: "🏆" },
};
const getTierStyle = (cat: number) => TIER_STYLES[String(cat)] ?? TIER_STYLES["500"];

type Section = "overview" | "wallet" | "trade" | "trust_fund" | "ecommerce" | "tenancy" | "referrals" | "loan" | "tour_africa" | "fintech" | "reserve_fund" | "forum";

const NAV_ITEMS: { id: Section; label: string; icon: any; badge?: string }[] = [
  { id: "overview",     label: "Overview",               icon: LayoutDashboard },
  { id: "fintech",      label: "Fintech Hub",             icon: CreditCard },
  { id: "wallet",       label: "Personal Wallet",         icon: Wallet },
  { id: "reserve_fund", label: "Strategic Reserve Fund",  icon: Shield },
  { id: "trade",        label: "Trade Market",            icon: Globe },
  { id: "trust_fund",   label: "Affiliate Trust Fund",    icon: Crown },
  { id: "ecommerce",    label: "E-Commerce",              icon: ShoppingCart },
  { id: "tenancy",      label: "Tenancy Business",         icon: Home },
  { id: "loan",         label: "Business Loan",            icon: Banknote },
  { id: "referrals",    label: "Referrals",               icon: Users },
  { id: "forum",        label: "Community Forum",         icon: MessageSquareText },
  { id: "tour_africa",  label: "Tour Africa",             icon: Car },
];

export default function AffiliateDashboard() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [subscribeOpen, setSubscribeOpen]       = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [eliteCustomAmount, setEliteCustomAmount] = useState("500");
  const [depositOpen, setDepositOpen]   = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [connectOpen, setConnectOpen]   = useState(false);
  const [chartSymbol, setChartSymbol] = useState("BINANCE:BTCUSDT");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTerm, setLoanTerm] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState("");
  const [depositAmt, setDepositAmt]     = useState("");
  const [depositWallet, setDepositWallet] = useState<"trc20"|"bep20">("trc20");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const [withdrawType, setWithdrawType] = useState<"withdraw_exchange"|"withdraw_bank">("withdraw_exchange");
  const [withdrawWalletType, setWithdrawWalletType] = useState<"trc20"|"bep20">("trc20");
  const [trc20Input, setTrc20Input]     = useState("");
  const [bep20Input, setBep20Input]     = useState("");
  const [showTxHistory, setShowTxHistory] = useState(false);

  // Trade balance visibility (persisted)
  const [tradeBalanceHidden, setTradeBalanceHidden] = useState<boolean>(() => {
    try { return localStorage.getItem("tsia_trade_balance_hidden") === "true"; } catch { return false; }
  });
  const toggleTradeBalanceHidden = () => {
    setTradeBalanceHidden(prev => {
      const next = !prev;
      try { localStorage.setItem("tsia_trade_balance_hidden", String(next)); } catch {}
      return next;
    });
  };

  // Broker selection (persisted)
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>(() => {
    try { return localStorage.getItem("tsia_selected_broker_id") || ""; } catch { return ""; }
  });
  const selectedBroker = TRADE_BROKERS.find(b => b.id === selectedBrokerId) ?? null;
  const handleBrokerChange = (id: string) => {
    setSelectedBrokerId(id);
    try { localStorage.setItem("tsia_selected_broker_id", id); } catch {}
    if (id === "binance") setChartSymbol("BINANCE:BTCUSDT");
    else if (id === "bybit") setChartSymbol("BYBIT:BTCUSDT");
    else if (id === "exness") setChartSymbol("FX:EURUSD");
    else if (id === "etoro") setChartSymbol("ETORO:BTCUSD");
    else setChartSymbol("BINANCE:BTCUSDT");
  };

  // Trading BOT state (persisted)
  const [botActivatedAt, setBotActivatedAt] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem("tsia_bot_activated_at");
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  });
  const [ukNow, setUkNow] = useState(() => new Date());
  const botActive = botActivatedAt !== null && (Date.now() - botActivatedAt) < 12 * 3600 * 1000;
  const botMinsRemaining = botActivatedAt ? Math.max(0, Math.floor((botActivatedAt + 12 * 3600000 - Date.now()) / 60000)) : 0;
  const botHoursLeft = Math.floor(botMinsRemaining / 60);
  const botMinsLeft = botMinsRemaining % 60;

  // Activate bot
  const activateBot = () => {
    const now = Date.now();
    setBotActivatedAt(now);
    try { localStorage.setItem("tsia_bot_activated_at", String(now)); } catch {}
    toast({ title: "Trading Bot Activated", description: "The AI trading bot is now live. It will auto-deactivate in 12 hours and credit your 2% earnings.", className: "border-green-500" });
  };

  // Complete a bot session — credits 2% to wallet, then clears state
  const completeBotSession = async (isAutoOff: boolean) => {
    setBotActivatedAt(null);
    try { localStorage.removeItem("tsia_bot_activated_at"); } catch {}
    try {
      const r = await apiRequest("POST", "/api/trade/bot/complete");
      if (r.ok) {
        const data = await r.json();
        queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trade/transactions"] });
        toast({
          title: isAutoOff ? "Bot Session Complete — Earnings Credited!" : "Bot Stopped",
          description: isAutoOff
            ? `$${parseFloat(data.earning).toFixed(2)} (2% return) has been added to your Trade Wallet.`
            : `Session ended. Your updated balance is $${parseFloat(data.newBalance).toFixed(2)}.`,
          className: "border-tsia-green",
        });
      } else {
        if (isAutoOff) toast({ title: "Trading Bot Deactivated", description: "The bot has automatically turned off after 12 hours.", variant: "destructive" });
      }
    } catch {
      if (isAutoOff) toast({ title: "Trading Bot Deactivated", description: "The bot has automatically turned off after 12 hours.", variant: "destructive" });
    }
  };

  const deactivateBot = () => completeBotSession(false);

  // Auto-deactivate bot + 30-min warning clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setUkNow(now);
      // Auto-off after 12 h
      if (botActivatedAt && (Date.now() - botActivatedAt) >= 12 * 3600 * 1000) {
        completeBotSession(true);
      }
      // 30-min pre-1PM UK warning
      const ukHour = parseInt(now.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }));
      const ukMinute = now.getMinutes();
      if (ukHour === 12 && ukMinute === 30 && !botActive) {
        if (Notification.permission === "granted") {
          new Notification("TSIA Trade Market", { body: "30 minutes until 1:00 PM — Time to activate your Trading Bot!", icon: "/favicon.ico" });
        }
        toast({ title: "⏰ Bot Reminder", description: "It's 12:30 PM — the activation window opens in 30 minutes at 1:00 PM GMT and stays open for 12 hours!", className: "border-amber-500" });
      }
    }, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [botActivatedAt, botActive]);

  // Request notification permission when entering trade section
  useEffect(() => {
    if (activeSection === "trade" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [activeSection]);

  // Welcome wallet walkthrough
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  // Tier upgrade
  const [upgradeOpen, setUpgradeOpen]     = useState(false);
  const [upgradeCategory, setUpgradeCategory] = useState<number>(300);
  const [upgradeEliteAmt, setUpgradeEliteAmt] = useState("500");

  const themeOpts = [
    { v: "light" as const, icon: Sun },
    { v: "dark" as const, icon: Moon },
    { v: "system" as const, icon: Monitor },
  ];

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

  const { data: affiliateInfo }   = useQuery({ queryKey: ["/api/affiliate/info"] });
  const { data: programData }     = useQuery({ queryKey: ["/api/co-affiliate/program"] });
  const { data: myCoAff, refetch: refetchMyCoAff } = useQuery({ queryKey: ["/api/co-affiliate/my-info"] });
  const { data: tradeWallet, refetch: refetchTradeWallet } = useQuery({ queryKey: ["/api/trade/wallet"] });
  const { data: tradeTxs = [], refetch: refetchTradeTxs } = useQuery({ queryKey: ["/api/trade/transactions"] });
  const { data: loanLimit, refetch: refetchLoanLimit } = useQuery<any>({ queryKey: ["/api/loans/limit"] });
  const { data: myLoans = [], refetch: refetchMyLoans } = useQuery<any[]>({ queryKey: ["/api/loans/my-loans"] });
  const { data: myTenancyProps = [] } = useQuery<any[]>({ queryKey: ["/api/tenancy/my-properties"] });

  const subscribeMutation = useMutation({
    mutationFn: async ({ category, customAmount }: { category: number; customAmount?: number }) => {
      const res = await apiRequest("POST", "/api/co-affiliate/subscribe", { category, customAmount });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Enrolled! 🎉", description: data.message });
      setSubscribeOpen(false); setSelectedCategory(null); setEliteCustomAmount("500");
      refetchMyCoAff();
      queryClient.invalidateQueries({ queryKey: ["/api/co-affiliate/program"] });
    },
    onError: (err: any) => toast({ title: "Enrollment Failed", description: err.message, variant: "destructive" }),
  });

  const applyLoanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loans/apply", { amountUsd: parseFloat(loanAmount), termMonths: loanTerm, purpose: loanPurpose });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Loan application submitted", description: "Your business loan application is under review. We'll notify you shortly." });
      setLoanAmount(""); setLoanPurpose("");
      refetchLoanLimit(); refetchMyLoans();
    },
    onError: (err: any) => toast({ title: "Application failed", description: err.message, variant: "destructive" }),
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade/deposit", { amountUsd: parseFloat(depositAmt), walletType: depositWallet, txHash: depositTxHash });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Deposit Confirmed ✓", description: `$${parseFloat(data.breakdown.creditedToYou).toFixed(2)} credited to your trade wallet.` });
      setDepositOpen(false); setDepositAmt(""); setDepositTxHash("");
      refetchTradeWallet(); refetchTradeTxs();
    },
    onError: (err: any) => toast({ title: "Deposit Failed", description: err.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade/withdraw", {
        amountUsd: parseFloat(withdrawAmt),
        withdrawalType: withdrawType,
        walletType: withdrawType === "withdraw_exchange" ? withdrawWalletType : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Withdrawal Processed ✓", description: `$${parseFloat(data.breakdown.netPayout).toFixed(2)} will be sent. Fee: ${data.breakdown.feeRate}` });
      setWithdrawOpen(false); setWithdrawAmt("");
      refetchTradeWallet(); refetchTradeTxs();
    },
    onError: (err: any) => toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" }),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade/wallet/connect", { trc20Address: trc20Input || undefined, bep20Address: bep20Input || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Wallets Connected ✓", description: "Your exchange wallet address(es) have been saved." });
      setConnectOpen(false); refetchTradeWallet();
    },
    onError: (err: any) => toast({ title: "Connection Failed", description: err.message, variant: "destructive" }),
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ category, customAmount }: { category: number; customAmount?: number }) => {
      const res = await apiRequest("POST", "/api/co-affiliate/upgrade", { category, customAmount });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Tier Upgraded! 🎉", description: data.message });
      setUpgradeOpen(false);
      refetchMyCoAff();
      queryClient.invalidateQueries({ queryKey: ["/api/co-affiliate/program"] });
    },
    onError: (err: any) => toast({ title: "Upgrade Failed", description: err.message, variant: "destructive" }),
  });

  // Trigger wallet walkthrough on first visit via ?welcome=1
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("welcome") === "1") {
      const shownKey = "tsia_aff_walkthrough_shown";
      if (!localStorage.getItem(shownKey)) {
        setTimeout(() => { setWalkthroughOpen(true); setWalkthroughStep(0); }, 800);
        localStorage.setItem(shownKey, "1");
      }
    }
  }, [search]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const affiliateCode  = affiliateInfo?.affiliateCode || user?.affiliateCode || "";
  const referralCount  = affiliateInfo?.referralCount || 0;
  const referrals      = affiliateInfo?.referrals || [];
  const referralLink   = `${window.location.origin}/signup?ref=${affiliateCode}`;
  const totalEnrolled  = programData?.totalEnrolled ?? 0;
  const spotsRemaining = programData?.spotsRemaining ?? CO_AFFILIATE_PROGRAM.TARGET;
  const pricing        = programData?.pricing ?? [];
  const progress       = programData?.progress ?? { overallPct: 0, pctToNext: 0, nextMilestone: 150000, milestones: 0 };
  const isEnrolled     = !!myCoAff;
  const myCategory     = myCoAff ? Number(myCoAff.investmentCategory) : null;
  const tradeBalance   = parseFloat(tradeWallet?.tradeBalance ?? "0");
  const eliteAmt       = Math.max(500, Math.min(10000, parseFloat(eliteCustomAmount) || 500));
  const eliteShare     = getEliteSharePercentage(eliteAmt);

  const copyCode = () => { navigator.clipboard.writeText(affiliateCode); toast({ title: "Copied!", description: "Affiliate code copied." }); };
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast({ title: "Copied!", description: "Referral link copied." }); };
  const handleLogout = async () => { await logout(); setLocation("/"); };

  const txTypeLabel: Record<string, string> = { deposit: "Deposit", withdraw_exchange: "Withdraw → Exchange", withdraw_bank: "Withdraw → Bank", bot_earning: "Bot Earnings" };
  const txTypeIcon: Record<string, any> = { deposit: ArrowDownLeft, withdraw_exchange: ArrowUpRight, withdraw_bank: ArrowUpRight, bot_earning: TrendingUp };

  const navigate = (s: Section) => {
    if (s === "tour_africa") { setMenuOpen(false); setLocation("/tour-africa"); return; }
    setActiveSection(s); setMenuOpen(false);
  };
  const currentNav = NAV_ITEMS.find(n => n.id === activeSection) ?? NAV_ITEMS[0]!;
  const upgradeEliteAmtNum = Math.max(500, Math.min(10000, parseFloat(upgradeEliteAmt) || 500));

  return (
    <div className="min-h-screen bg-background font-sans">

      {/* Navbar */}
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-foreground"
              data-testid="button-hamburger-menu"
              aria-label="Open navigation"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/"><a className="flex items-center gap-2"><Logo variant="badge" height={32} /></a></Link>
            <span className="text-xl font-bold tracking-tight hidden sm:block">Affiliate Portal</span>
            <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{currentNav.label}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <DashboardSwitcher />
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-aff-logout">
              <LogOut className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Slide-in menu */}
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
                    <p className="font-bold text-sm">{user!.firstName} {user!.lastName}</p>
                    <p className="text-xs text-muted-foreground">Affiliate Account</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id} onClick={() => navigate(item.id)} data-testid={`nav-${item.id}`}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                      }`}>
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <Badge className="text-[10px] py-0 px-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">{item.badge}</Badge>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t">
                <Button variant="outline" className="w-full" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="container mx-auto px-4 pt-8 pb-20 max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div key={activeSection} variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

            {/* ── OVERVIEW ── */}
            {activeSection === "overview" && (
              <>
                <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-1">Welcome back, {user!.firstName}!</h2>
                    <p className="text-amber-100 text-sm mb-4">Your affiliate account is active. Share your code and start earning.</p>
                  </div>
                </motion.div>

                {/* Stats */}
                <div className="grid sm:grid-cols-3 gap-5">
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-md border-0 h-full"><CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-xl"><Share2 className="w-6 h-6 text-amber-600" /></div>
                        <div><p className="text-sm text-muted-foreground font-medium">Referral Code</p><p className="text-xl font-bold font-mono tracking-wider" data-testid="text-aff-code">{affiliateCode || "—"}</p></div>
                      </div>
                      <Button variant="outline" className="w-full" onClick={copyCode} data-testid="button-copy-aff-code"><Copy className="w-4 h-4 mr-2" /> Copy Code</Button>
                    </CardContent></Card>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-md border-0 h-full"><CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl"><Users className="w-6 h-6 text-blue-600" /></div>
                        <div><p className="text-sm text-muted-foreground font-medium">Total Referrals</p><p className="text-3xl font-bold" data-testid="text-aff-referral-count">{referralCount}</p></div>
                      </div>
                      <p className="text-xs text-muted-foreground">Students signed up via your code</p>
                    </CardContent></Card>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Card className={`shadow-md border-0 h-full cursor-pointer hover:shadow-lg transition-shadow hover:border-primary/40 border ${isEnrolled ? 'border-green-200 dark:border-green-800' : ''}`} onClick={() => navigate("trust_fund")} data-testid="card-trust-fund-overview">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-3 rounded-xl ${isEnrolled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-muted'}`}>
                            <TrendingUp className={`w-6 h-6 ${isEnrolled ? 'text-green-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground font-medium">Trust Fund</p>
                            <Badge className={`text-sm mt-1 ${isEnrolled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                              {isEnrolled ? (myCategory && myCategory >= 500 ? `Elite ($${myCategory}) ✓` : myCategory === 300 ? "Growth ✓" : "Starter ✓") : "Not Enrolled"}
                            </Badge>
                          </div>
                        </div>
                        {isEnrolled && myCoAff ? (
                          <div className="space-y-1">
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Share: {(parseFloat(myCoAff.sharePercentage) * 100).toFixed(6)}% lifetime</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">Reserve: ${(parseFloat(myCoAff.amountPaid) * 0.20).toFixed(2)} ring-fenced ✓</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Tap to join the Trust Fund →</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Referral link */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Your Referral Link</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm truncate" data-testid="text-aff-link">{referralLink}</div>
                        <Button onClick={copyLink} data-testid="button-copy-aff-link"><Copy className="w-4 h-4 mr-2" /> Copy</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Quick nav */}
                <motion.div variants={itemVariants}>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Quick access</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {NAV_ITEMS.filter(n => n.id !== "overview").map(item => (
                      <button key={item.id} onClick={() => navigate(item.id)}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:border-primary hover:shadow-md transition-all text-left"
                        data-testid={`quick-nav-${item.id}`}>
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.label}</p>
                          {item.badge && <p className="text-xs text-amber-600">{item.badge}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {/* ── TRADE MARKET ── */}
            {activeSection === "trade" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Global Trade Market</h2>
                  <p className="text-muted-foreground text-sm mb-4">Invest globally — deposit & withdraw using BYBIT, BINANCE & more.</p>

                  {/* ROI + BOT Info Banner */}
                  <div className="rounded-2xl overflow-hidden shadow-lg mb-2">
                    <div className="bg-gradient-to-r from-green-800 to-emerald-700 text-white p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <TrendingUp className="w-6 h-6 shrink-0 mt-0.5 text-green-200" />
                        <div>
                          <p className="font-bold text-lg leading-tight">100% ROI @ 2% Daily</p>
                          <p className="text-green-200 text-sm mt-0.5">Trades profit & loss on capital markets using arithmetic algorithms with the power of a BOT (AI)</p>
                        </div>
                      </div>
                      <LearnMore label="Learn more" dark className="mt-1">
                        <p className="text-green-100 text-sm leading-relaxed">
                          TSIA's Global Trade Market targets a <strong className="text-white">100% total return on investment</strong> through consistent 2% daily capital market trading — powered by advanced arithmetic algorithms and an AI-driven BOT. At the end of your investment cycle, your capital will have grown to double what you deposited.
                        </p>
                      </LearnMore>
                    </div>
                  </div>
                </motion.div>

                {/* ===== TRADING BOT ACTIVATION PANEL ===== */}
                <motion.div variants={itemVariants}>
                  {(() => {
                    const ukHour = parseInt(ukNow.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }));
                    const ukMin  = ukNow.getMinutes();
                    // Window is open from 1PM GMT until 1AM GMT (12 hours)
                    const isActivationWindow = ukHour >= 13 || ukHour < 1;
                    const isWarning = ukHour === 12 && ukMin >= 30;
                    // How many minutes until the window opens (only relevant when window is closed)
                    const minsUntilOpen = isActivationWindow ? 0 : (() => {
                      const nowMins = ukHour * 60 + ukMin;
                      const openMins = 13 * 60;
                      return nowMins < openMins ? openMins - nowMins : (24 * 60 - nowMins + openMins);
                    })();
                    const hoursUntilOpen = Math.floor(minsUntilOpen / 60);
                    const minsUntilOpenRem = minsUntilOpen % 60;
                    return (
                      <div className={`rounded-2xl overflow-hidden shadow-xl border-2 ${botActive ? "border-green-500" : isActivationWindow ? "border-amber-400" : "border-slate-200 dark:border-slate-700"}`}>
                        {/* Header */}
                        <div className={`p-5 ${botActive ? "bg-gradient-to-r from-green-700 to-emerald-600" : isActivationWindow ? "bg-gradient-to-r from-amber-600 to-orange-500" : "bg-gradient-to-r from-slate-800 to-slate-700"} text-white`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${botActive ? "bg-green-500" : isActivationWindow ? "bg-amber-500" : "bg-slate-600"}`}>
                                <Bot className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-lg leading-tight">AI Trading Bot</p>
                                <p className="text-xs opacity-80">Window opens 1:00 PM GMT · Runs for 12 hours · Auto-off at 1:00 AM</p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${botActive ? "bg-green-500/30 text-green-100" : isActivationWindow ? "bg-amber-500/30 text-amber-100" : "bg-white/10 text-white/70"}`}>
                              <span className={`w-2 h-2 rounded-full ${botActive ? "bg-green-300 animate-pulse" : isActivationWindow ? "bg-amber-300 animate-pulse" : "bg-white/40"}`} />
                              {botActive ? "ACTIVE" : isActivationWindow ? "WINDOW OPEN" : "OFFLINE"}
                            </div>
                          </div>
                          {botActive ? (
                            <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                              <Timer className="w-5 h-5 text-green-200 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold">Bot is running — auto-off in {botHoursLeft}h {botMinsLeft}m</p>
                                <p className="text-xs text-green-200 mt-0.5">Executing 2% daily trades using arithmetic algorithm strategy</p>
                              </div>
                            </div>
                          ) : isWarning ? (
                            <div className="bg-amber-500/30 rounded-xl p-3 flex items-center gap-3 animate-pulse">
                              <Bell className="w-5 h-5 text-amber-200 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold">30-minute reminder — it's nearly 1:00 PM!</p>
                                <p className="text-xs text-amber-200 mt-0.5">The activation window opens at 1:00 PM GMT and stays open for 12 hours.</p>
                              </div>
                            </div>
                          ) : isActivationWindow ? (
                            <div className="bg-white/15 rounded-xl p-3 flex items-center gap-3">
                              <Bell className="w-5 h-5 text-amber-200 shrink-0 animate-bounce" />
                              <div>
                                <p className="text-sm font-semibold">Activation window is open — tap to start!</p>
                                <p className="text-xs text-amber-200 mt-0.5">
                                  Window closes at <strong className="text-white">1:00 AM GMT</strong>. Bot runs for 12 hours from activation.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white/10 rounded-xl p-3">
                              <p className="text-sm text-white/80">
                                UK time: <strong className="text-white">{ukNow.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}</strong>
                                {" · "} Window opens in <strong className="text-white">{hoursUntilOpen > 0 ? `${hoursUntilOpen}h ` : ""}{minsUntilOpenRem}m</strong> at <strong className="text-white">1:00 PM GMT</strong>.
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Action footer */}
                        <div className="bg-card p-4 flex items-center gap-3">
                          {tradeBalance < TRADE_MARKET.MIN_DEPOSIT ? (
                            // No investment plan — block the bot entirely
                            <div className="flex-1 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                <Power className="w-4 h-4 text-orange-500" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Investment plan required</p>
                                <p className="text-xs text-muted-foreground">Deposit at least <strong className="text-foreground">${TRADE_MARKET.MIN_DEPOSIT}</strong> into your Trade Wallet to activate the bot. Go to <strong>Deposit</strong> below.</p>
                              </div>
                            </div>
                          ) : botActive ? (
                            <>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Bot activated · auto-deactivates at <strong>{new Date((botActivatedAt ?? 0) + 12 * 3600000).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}</strong> GMT</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={deactivateBot} data-testid="button-bot-deactivate" className="border-red-300 text-red-600 hover:bg-red-50">
                                <Power className="w-3.5 h-3.5 mr-1" /> Turn Off
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">
                                  {isActivationWindow
                                    ? "Window open now — activates for 12 hours from the moment you tap."
                                    : `Opens at 1:00 PM GMT${hoursUntilOpen > 0 ? ` (in ${hoursUntilOpen}h ${minsUntilOpenRem}m)` : ""}.`}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={activateBot}
                                disabled={!isActivationWindow}
                                data-testid="button-bot-activate"
                                className={`${isActivationWindow ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-muted text-muted-foreground cursor-not-allowed"} font-bold`}
                              >
                                <Power className="w-3.5 h-3.5 mr-1.5" /> {isActivationWindow ? "Activate Bot" : "Opens at 1:00 PM"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>

                {/* Trade wallet balance + bot earnings — always visible */}
                <motion.div variants={itemVariants}>
                  <div className="rounded-2xl border overflow-hidden shadow-sm">
                    {/* Balance row */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Trade Wallet Balance</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {tradeBalanceHidden ? "••••••" : `$${tradeBalance.toFixed(2)}`}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => navigate("wallet")} data-testid="button-goto-wallet" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Wallet className="w-3.5 h-3.5 mr-1.5" /> Open Wallet
                      </Button>
                    </div>
                    {/* Earnings row — always visible */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground leading-none mb-0.5">Total Bot Earnings</p>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-total-bot-earnings">
                            {tradeBalanceHidden ? "••••••" : `$${parseFloat(tradeWallet?.totalBotEarnings ?? "0").toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Daily target</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+2% / session</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Broker Selection — dropdown */}
                <motion.div variants={itemVariants}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-muted-foreground">Select your broker</p>
                    {selectedBroker && (
                      <Badge className="bg-tsia-green/10 text-tsia-green border-tsia-green/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {selectedBroker.name}
                      </Badge>
                    )}
                  </div>
                  <select
                    data-testid="select-broker"
                    value={selectedBrokerId}
                    onChange={e => handleBrokerChange(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-tsia-green/40 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>— Choose a broker —</option>
                    {TRADE_BROKERS.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </motion.div>

                {/* Live TradingView Chart */}
                <motion.div variants={itemVariants}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-muted-foreground">Live market chart</p>
                    <div className="flex gap-2">
                      {[
                        { label: "BTC/USDT", symbol: "BINANCE:BTCUSDT" },
                        { label: "ETH/USDT", symbol: "BINANCE:ETHUSD" },
                        { label: "EUR/USD", symbol: "FX:EURUSD" },
                      ].map(({ label, symbol }) => (
                        <button key={symbol} onClick={() => setChartSymbol(symbol)}
                          data-testid={`button-chart-${label.replace("/", "-")}`}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${chartSymbol === symbol ? "bg-tsia-green text-white border-tsia-green" : "border-border hover:border-tsia-green/40"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border shadow-md" style={{ height: 420 }}>
                    <iframe
                      key={chartSymbol}
                      src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_trade&symbol=${encodeURIComponent(chartSymbol)}&interval=60&hidesidetoolbar=0&hidetooltip=0&theme=dark&style=1&locale=en&toolbar_bg=%23131722&enable_publishing=false&withdateranges=1&showpopupbutton=0&no_referral_id=1&timezone=Europe%2FLondon`}
                      width="100%"
                      height="420"
                      frameBorder="0"
                      allowTransparency={true}
                      scrolling="no"
                      allow="fullscreen"
                      title="TradingView Live Chart"
                      data-testid="iframe-tradingview-chart"
                      style={{ display: "block" }}
                    />
                  </div>
                </motion.div>

              </>
            )}

            {/* ── WALLET ── */}
            {activeSection === "wallet" && <WalletSection />}

            {/* ── TRUST FUND ── */}
            {activeSection === "trust_fund" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Co-Affiliate / Initiator Programme</h2>
                  <p className="text-muted-foreground text-sm mb-2">Invest once, earn lifetime profit share — exclusively for affiliate accounts.</p>
                </motion.div>

                {/* Progress */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold flex items-center gap-1.5"><Target className="w-4 h-4 text-primary" /> Programme Progress</span>
                        <span className="text-muted-foreground font-mono">{totalEnrolled.toLocaleString()} / {CO_AFFILIATE_PROGRAM.TARGET.toLocaleString()}</span>
                      </div>
                      <Progress value={progress.overallPct} className="h-3" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{spotsRemaining.toLocaleString()} spots remaining</span>
                        <span>{progress.overallPct.toFixed(2)}% filled</span>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Next price increase at {progress.nextMilestone.toLocaleString()}</span>
                          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">+20%</span>
                        </div>
                        <Progress value={progress.pctToNext} className="h-2 bg-amber-100 dark:bg-amber-900/40" />
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          {progress.milestones === 0 ? "Join now at the lowest founding price!" : `Price has increased ${progress.milestones}× (${progress.milestones * 20}% total increase).`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Categories */}
                <motion.div variants={itemVariants}>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Affiliate Trust Fund categories</p>
                  <div className="grid sm:grid-cols-3 gap-5">
                    {pricing.map((tier: any) => {
                      const col = getTierStyle(tier.category);
                      const isMyTier = myCategory !== null && (tier.isElite ? myCategory >= 500 : myCategory === tier.category);
                      const isEliteTier = tier.isElite;
                      return (
                        <motion.div key={tier.category} whileHover={{ scale: isEnrolled ? 1 : 1.02 }}
                          className={`relative rounded-2xl p-5 border-2 transition-all ${isMyTier ? 'border-tsia-gold bg-amber-50 dark:bg-amber-900/20 shadow-lg' : `${col.bg} ${col.border}`}`}>
                          {isMyTier && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-tsia-gold text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm whitespace-nowrap">Your Plan ✓</div>
                          )}
                          <div className="text-3xl mb-2">{col.icon}</div>
                          <h5 className={`font-bold text-lg ${col.text}`}>{tier.label}</h5>
                          <p className="text-xs text-muted-foreground mb-3">Base: ${tier.category}{isEliteTier ? " – $10,000" : ""}</p>
                          {isEliteTier ? (
                            <div className="mb-3">
                              <p className="text-xs text-muted-foreground mb-1">Choose your amount ($500 – $10,000)</p>
                              <Input type="number" min={500} max={10000} step={50} value={eliteCustomAmount} onChange={e => setEliteCustomAmount(e.target.value)} className="h-9 font-bold border-amber-300" disabled={isEnrolled} data-testid="input-elite-amount" />
                            </div>
                          ) : (
                            <div className="text-3xl font-bold mb-1">${tier.currentPrice}</div>
                          )}
                          <p className="text-xs text-muted-foreground mb-3">One-time investment</p>
                          <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-block mb-4 ${col.badge}`}>
                            {isEliteTier ? `Share: ${(eliteShare * 100).toFixed(6)}% lifetime` : `Share: ${tier.shareLabel} lifetime`}
                          </div>
                          <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Lifetime profit participation</div>
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> 5% TSIA profits shared</div>
                            <div className="flex items-center gap-1.5"><Infinity className="w-3 h-3 text-primary" /> No expiry — forever</div>
                          </div>
                          {!isEnrolled ? (
                            <Button className="w-full h-10 text-sm font-semibold"
                              onClick={() => { setSelectedCategory(tier.isElite ? 500 : tier.category); setSubscribeOpen(true); }}
                              data-testid={`button-subscribe-${tier.category}`}>
                              {isEliteTier ? `Join for $${Math.round(eliteAmt * Math.pow(1.2, progress.milestones))}` : `Join for $${tier.currentPrice}`}
                            </Button>
                          ) : isMyTier ? (
                            <Button variant="outline" className="w-full h-10 text-sm border-tsia-gold text-tsia-gold" disabled>Enrolled ✓</Button>
                          ) : (() => {
                            const canUpgrade = myCategory !== null && (
                              isEliteTier
                                ? myCategory < 10000
                                : myCategory < tier.category
                            );
                            if (!canUpgrade) return <Button variant="outline" className="w-full h-10 text-sm" disabled>Already at higher tier</Button>;
                            return (
                              <Button className="w-full h-10 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => {
                                  setUpgradeCategory(isEliteTier ? 500 : tier.category);
                                  setUpgradeEliteAmt(isEliteTier ? eliteCustomAmount : "");
                                  setUpgradeOpen(true);
                                }}
                                data-testid={`button-upgrade-${tier.category}`}>
                                ↑ Upgrade to {tier.label}
                              </Button>
                            );
                          })()}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* ── Trust Fund Growth Panel (enrolled only) ── */}
                {isEnrolled && myCoAff && (
                  <motion.div variants={itemVariants}>
                    <Card className="shadow-md border-0 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white px-6 pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-5 h-5" />
                          <h3 className="font-bold text-lg">Your Trust Fund Growth</h3>
                        </div>
                        <p className="text-green-100 text-xs">Active co-affiliate · Lifetime participation confirmed</p>
                      </div>
                      <CardContent className="pt-5 space-y-4">
                        {/* Investment breakdown */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-muted/50 rounded-xl p-3">
                            <p className="text-[11px] text-muted-foreground mb-1">Invested</p>
                            <p className="text-xl font-bold text-foreground">${parseFloat(myCoAff.amountPaid).toFixed(0)}</p>
                            <p className="text-[10px] text-muted-foreground">total paid</p>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1">Reserve</p>
                            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">${(parseFloat(myCoAff.amountPaid) * 0.20).toFixed(0)}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-500">ring-fenced (20%)</p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
                            <p className="text-[11px] text-green-700 dark:text-green-400 mb-1">Your Share</p>
                            <p className="text-xl font-bold text-green-700 dark:text-green-400">{(parseFloat(myCoAff.sharePercentage) * 100).toFixed(6)}%</p>
                            <p className="text-[10px] text-green-600 dark:text-green-500">of TSIA profits</p>
                          </div>
                        </div>

                        {/* Projected earnings */}
                        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-primary" /> Projected Annual Earnings (illustrative)
                          </p>
                          <div className="space-y-2">
                            {[
                              { label: "Conservative (5% TSIA profit = $500K)", profit: 500000 },
                              { label: "Moderate (5% TSIA profit = $2M)", profit: 2000000 },
                              { label: "Optimistic (5% TSIA profit = $10M)", profit: 10000000 },
                            ].map(({ label, profit }) => {
                              const share = parseFloat(myCoAff.sharePercentage);
                              const earning = (share * profit).toFixed(2);
                              return (
                                <div key={label} className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="font-bold text-primary">${Number(earning).toLocaleString()}/yr</span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">* Projections are illustrative only. Actual distributions depend on TSIA annual net profit. Distributions are paid in USDT.</p>
                        </div>

                        {/* Reserve receipt */}
                        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">20% Reserve Confirmed</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">${(parseFloat(myCoAff.amountPaid) * 0.20).toFixed(2)} was ring-fenced into the Strategic Reserve Fund at enrolment. This backs your lifetime share rights.</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                          <span>Status</span>
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-xs">Active · Lifetime</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* How it works */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-center gap-2 font-bold">
                        <BarChart3 className="w-4 h-4 text-primary" /> How Profit Sharing Works
                      </div>
                      <LearnMore label="See how your share is calculated">
                        <div className="space-y-3 pt-1">
                          <p className="text-sm text-muted-foreground">TSIA allocates <strong className="text-foreground">5%</strong> of all profits across up to 1,000,000 Co-Affiliates for life.</p>
                          <div className="bg-card rounded-xl p-4 border font-mono text-xs space-y-1">
                            <div className="text-primary font-bold">Your Share = 0.000005 × (your amount ÷ 100)</div>
                            <div>$100 → <strong>0.0005%</strong> · $300 → <strong>0.0015%</strong> · $500 → <strong>0.0025%</strong> · $10,000 → <strong>0.05%</strong></div>
                          </div>
                        </div>
                      </LearnMore>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Price table — collapsed behind Learn More */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-4 pb-3 px-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        Prices increase by <strong className="text-foreground">20%</strong> every 150,000 enrollments. Current tier starts at <strong className="text-tsia-gold">$100 / $300 / $500+</strong>.
                      </p>
                      <LearnMore label="View price schedule">
                        <div className="overflow-x-auto mt-1">
                          <table className="w-full text-xs">
                            <thead><tr className="border-b bg-muted/30">
                              <th className="text-left px-3 py-2 font-semibold">Enrollment Band</th>
                              <th className="text-center px-3 py-2">Starter ($100)</th>
                              <th className="text-center px-3 py-2">Growth ($300)</th>
                              <th className="text-center px-3 py-2">Elite ($500+)</th>
                            </tr></thead>
                            <tbody>
                              {[0,150000,300000,450000,600000,750000,900000].map((ms, i) => {
                                const mult = Math.pow(1.20, i);
                                const isCur = totalEnrolled >= ms && totalEnrolled < (ms + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                                const isPast = totalEnrolled >= (ms + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                                return (
                                  <tr key={ms} className={`border-b ${isCur ? 'bg-tsia-gold/10 font-bold' : isPast ? 'opacity-40' : ''}`}>
                                    <td className="px-3 py-2">
                                      {ms === 0 ? "0 – 149,999" : `${ms.toLocaleString()} – ${(ms+149999).toLocaleString()}`}
                                      {isCur && <span className="ml-2 text-[10px] bg-tsia-gold text-slate-900 px-1.5 py-0.5 rounded-full font-bold">NOW</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">${Math.round(100*mult)}</td>
                                    <td className="px-3 py-2 text-center">${Math.round(300*mult)}</td>
                                    <td className="px-3 py-2 text-center">${Math.round(500*mult)}+</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </LearnMore>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── E-COMMERCE ── */}
            {activeSection === "ecommerce" && (
              <motion.div variants={itemVariants}>
                <EcommerceSection />
              </motion.div>
            )}

            {/* ── COMMUNITY FORUM ── */}
            {activeSection === "forum" && (
              <motion.div variants={itemVariants}>
                <ForumSection userSection="affiliate" />
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

            {/* ── LOAN ── */}
            {activeSection === "loan" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Business loan</h2>
                  <LearnMore label="Learn more about eligibility" className="mt-1 mb-5">
                    <p className="text-muted-foreground text-sm">Access flexible financing based on your referral activity and trade balance.</p>
                  </LearnMore>
                </motion.div>

                {/* Eligibility / limit card */}
                <motion.div variants={itemVariants}>
                  {!loanLimit ? (
                    <Card className="shadow-sm border-0 mb-4"><CardContent className="pt-8 pb-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  ) : !loanLimit.eligible ? (
                    <Card className="shadow-sm border-0 mb-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
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
                        { label: "Loan limit", value: `$${loanLimit.limitUsd?.toLocaleString()}`, sub: "Your maximum", color: "text-green-600 dark:text-green-400" },
                        { label: "Interest rate", value: `${loanLimit.interestRate}% /yr`, sub: "Flat rate", color: "text-blue-600 dark:text-blue-400" },
                        { label: "Referrals", value: loanLimit.referralCount || 0, sub: `Trade: $${parseFloat(loanLimit.tradeBalance||0).toFixed(2)}`, color: "text-purple-600 dark:text-purple-400" },
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

                {/* Active loan status */}
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
                      <CardHeader className="pb-3 pt-5"><CardTitle className="text-base">Apply for a business loan</CardTitle></CardHeader>
                      <CardContent className="pb-6 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Loan amount (USD)</label>
                            <input
                              type="number"
                              min={50}
                              max={loanLimit.limitUsd}
                              step={50}
                              value={loanAmount}
                              onChange={e => setLoanAmount(e.target.value)}
                              placeholder={`Max $${loanLimit.limitUsd}`}
                              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                              data-testid="input-loan-amount"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Repayment term</label>
                            <select
                              value={loanTerm}
                              onChange={e => setLoanTerm(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                              data-testid="select-loan-term"
                            >
                              {(loanLimit.terms || [6,12,24]).map((t: number) => <option key={t} value={t}>{t} months</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Purpose (optional)</label>
                          <input
                            type="text"
                            value={loanPurpose}
                            onChange={e => setLoanPurpose(e.target.value)}
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
                <motion.div variants={itemVariants}>
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

                {/* Features info */}
                <motion.div variants={itemVariants}>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm">
                    {[
                      { label: "Flexible terms", desc: "6, 12, or 24 months", icon: Clock },
                      { label: "Quick review", desc: "Fast turnaround for active members", icon: Zap },
                      { label: "No collateral", desc: "Activity-based underwriting", icon: Shield },
                      { label: "15% flat rate", desc: "Competitive for business loans", icon: TrendingDown },
                    ].map(f => (
                      <div key={f.label} className="bg-muted/50 rounded-xl p-4 border flex flex-col items-center gap-2">
                        <f.icon className="w-5 h-5 text-blue-500" />
                        <p className="font-semibold">{f.label}</p>
                        <p className="text-xs text-muted-foreground text-center">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {/* ── TENANCY ── */}
            {activeSection === "tenancy" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Tenancy business</h2>
                  <LearnMore label="How tenancy works" className="mt-1 mb-5">
                    <p className="text-muted-foreground text-sm">List your properties or browse available rentals — TSIA pays landlords upfront while tenants pay in instalments.</p>
                  </LearnMore>
                </motion.div>

                {/* Quick stats */}
                <motion.div variants={itemVariants}>
                  <div className="grid sm:grid-cols-3 gap-4 mb-5">
                    {[
                      { label: "Your listings", value: (myTenancyProps as any[]).length, sub: "Properties listed", icon: Building2, color: "text-green-600 dark:text-green-400" },
                      { label: "How it works", value: "Landlord → TSIA → Tenant", sub: "Lump-sum to landlord; instalments from tenant", icon: ArrowRight, color: "text-blue-600 dark:text-blue-400" },
                      { label: "Interest model", value: "5% /yr", sub: "TSIA adds interest to tenant payments", icon: TrendingUp, color: "text-amber-600 dark:text-amber-400" },
                    ].map(s => (
                      <Card key={s.label} className="shadow-sm border-0">
                        <CardContent className="pt-5 pb-5 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                            <s.icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                            <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>

                {/* Your properties */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border-0 mb-5">
                    <CardHeader className="pb-2 pt-5 flex-row items-center justify-between">
                      <CardTitle className="text-base">Your listed properties</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => setLocation("/tenancy")} data-testid="button-list-property">
                        <Home className="w-3.5 h-3.5 mr-1.5" /> List a property
                      </Button>
                    </CardHeader>
                    <CardContent className="pb-5">
                      {(myTenancyProps as any[]).length === 0 ? (
                        <div className="text-center py-10">
                          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground font-medium">No properties listed yet</p>
                          <p className="text-xs text-muted-foreground mt-1 mb-4">List a property so TSIA can pay you upfront and manage tenant collections</p>
                          <Button size="sm" onClick={() => setLocation("/tenancy")} className="bg-green-700 hover:bg-green-800 text-white" data-testid="button-go-to-tenancy">
                            Browse tenancy portal
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(myTenancyProps as any[]).map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border" data-testid={`row-property-${p.id}`}>
                              <div>
                                <p className="font-semibold">{p.propertyName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{p.location} · ${parseFloat(p.annualRentUsd).toLocaleString()} /yr</p>
                              </div>
                              <Badge className={p.status === "available" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground"}>
                                {p.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Browse CTA */}
                <motion.div variants={itemVariants}>
                  <Card className="shadow-sm border-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-100 dark:border-green-900/30">
                    <CardContent className="pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-300 mb-1">Looking for a rental?</p>
                        <p className="text-sm text-green-700 dark:text-green-400">Browse available properties and apply for tenancy — pay in monthly instalments.</p>
                      </div>
                      <Button onClick={() => setLocation("/tenancy")} className="bg-green-700 hover:bg-green-800 text-white shrink-0" data-testid="button-browse-tenancy">
                        Browse rentals <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

            {/* ── REFERRALS ── */}
            {activeSection === "referrals" && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-2xl font-bold mb-1">Your Referrals</h2>
                  <p className="text-muted-foreground text-sm mb-6">Students who signed up using your referral code.</p>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Card className="shadow-md border-0">
                    <CardContent className="pt-6">
                      {referrals.length === 0 ? (
                        <div className="text-center py-16">
                          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground font-medium">No referrals yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Share your referral link to start earning</p>
                          <Button className="mt-4" onClick={() => navigate("overview")} variant="outline">Copy your link</Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {referrals.map((r: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border" data-testid={`row-referral-${i}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><span className="text-sm font-bold text-primary">{r.name?.charAt(0) || "?"}</span></div>
                                <div><p className="font-medium text-sm">{r.name}</p><p className="text-xs text-muted-foreground">Joined {new Date(r.joinedAt).toLocaleDateString()}</p></div>
                              </div>
                              <Badge variant="outline" className="text-xs">Referred</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── DIALOGS ── */}

      {/* Subscribe to Trust Fund */}
      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Star className="w-6 h-6 text-tsia-gold" /> Confirm Enrolment</DialogTitle>
            <DialogDescription>One-time lifetime investment in the Co-Affiliate/Initiator Programme.</DialogDescription>
          </DialogHeader>
          {selectedCategory !== null && (() => {
            const isElite = selectedCategory === 500;
            const tier = pricing.find((p: any) => isElite ? p.isElite : p.category === selectedCategory);
            if (!tier) return null;
            const col = getTierStyle(selectedCategory);
            const finalAmt = isElite ? Math.round(eliteAmt * Math.pow(1.2, progress.milestones)) : tier.currentPrice;
            const finalShare = isElite ? (getEliteSharePercentage(eliteAmt) * 100).toFixed(6) : tier.shareLabel;
            return (
              <div className={`rounded-xl p-5 border-2 my-2 ${col.bg} ${col.border}`}>
                <div className="flex justify-between items-start mb-3">
                  <div><p className="text-xs text-muted-foreground">Category</p><h4 className={`text-2xl font-bold ${col.text}`}>{tier.label}{isElite ? ` ($${Math.round(eliteAmt)})` : ""}</h4></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Total Amount</p><p className="text-2xl font-bold">${finalAmt}</p></div>
                </div>
                {/* Payment breakdown showing the 20% reserve */}
                <div className="bg-background/60 rounded-xl p-3 mb-3 space-y-2 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Payment Breakdown</p>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-foreground font-medium"><Crown className="w-3 h-3 text-amber-500" /> Co-Affiliate Fund (80%)</span>
                    <span className="font-bold text-foreground">${(finalAmt * 0.80).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium"><Shield className="w-3 h-3 text-amber-500" /> Strategic Reserve (20%)</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">${(finalAmt * 0.20).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-1 flex justify-between items-center">
                    <span className="text-muted-foreground">Total Investment</span>
                    <span className="font-bold">${finalAmt}</span>
                  </div>
                </div>
                <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${col.badge}`}>Lifetime share: {finalShare}% of TSIA profits</div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Lifetime participation, no renewal needed</div>
                  <div className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-amber-500" /> 20% ring-fenced into Strategic Reserve</div>
                  <div className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-red-500" /> Investment is non-refundable</div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedCategory !== null && subscribeMutation.mutate({ category: selectedCategory, customAmount: selectedCategory === 500 ? eliteAmt : undefined })}
              disabled={subscribeMutation.isPending} className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold" data-testid="button-confirm-subscribe">
              {subscribeMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : "Confirm & Enrol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Wallet */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Connect Exchange Wallet</DialogTitle>
            <DialogDescription>Add your TRC20 and/or BEP20 wallet address for withdrawals. Supports BYBIT, BINANCE, and any compatible exchange.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>TRC20 Address (TRON Network)</Label>
              <Input placeholder="T..." value={trc20Input} onChange={e => setTrc20Input(e.target.value)} data-testid="input-trc20-address" />
              <p className="text-xs text-muted-foreground">Compatible with USDT TRC20 on BYBIT, BINANCE etc.</p>
            </div>
            <div className="space-y-2">
              <Label>BEP20 Address (BSC Network)</Label>
              <Input placeholder="0x..." value={bep20Input} onChange={e => setBep20Input(e.target.value)} data-testid="input-bep20-address" />
              <p className="text-xs text-muted-foreground">Compatible with USDT BEP20 on BYBIT, BINANCE etc.</p>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setConnectOpen(false)}>Cancel</Button>
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending || (!trc20Input && !bep20Input)} data-testid="button-confirm-connect">
              {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />} Save Wallet(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowDownLeft className="w-5 h-5 text-green-600" /> Deposit to Trade Wallet</DialogTitle>
            <DialogDescription>Send USDT to TSIA's wallet address first, then confirm your deposit here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Network</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["trc20", "bep20"] as const).map(n => (
                  <button key={n} onClick={() => setDepositWallet(n)}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${depositWallet === n ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                    {n.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input type="number" min={TRADE_MARKET.MIN_DEPOSIT} placeholder={`Min $${TRADE_MARKET.MIN_DEPOSIT}`} value={depositAmt} onChange={e => setDepositAmt(e.target.value)} data-testid="input-deposit-amount" />
            </div>
            <div className="space-y-2">
              <Label>Transaction Hash (optional)</Label>
              <Input placeholder="0x..." value={depositTxHash} onChange={e => setDepositTxHash(e.target.value)} data-testid="input-deposit-txhash" />
            </div>
            {depositAmt && parseFloat(depositAmt) >= TRADE_MARKET.MIN_DEPOSIT && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-xs space-y-1">
                <p className="font-semibold text-green-800 dark:text-green-300">Allocation Preview</p>
                <p>Credited to you: <strong>${(parseFloat(depositAmt) * 0.75).toFixed(2)}</strong> (75%)</p>
                <p>Reserve Fund: <strong>${(parseFloat(depositAmt) * 0.20).toFixed(2)}</strong> (20%)</p>
                <p>Affiliate Pool: <strong>${(parseFloat(depositAmt) * 0.05).toFixed(2)}</strong> (5%)</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={() => depositMutation.mutate()} disabled={depositMutation.isPending || !depositAmt || parseFloat(depositAmt) < TRADE_MARKET.MIN_DEPOSIT} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-confirm-deposit">
              {depositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownLeft className="w-4 h-4 mr-2" />} Confirm Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-blue-600" /> Withdraw from Trade Wallet</DialogTitle>
            <DialogDescription>Balance: <strong>${tradeBalance.toFixed(2)}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Withdrawal Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setWithdrawType("withdraw_exchange")}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center ${withdrawType === "withdraw_exchange" ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                  <Globe className="w-4 h-4 mx-auto mb-1" /> Exchange<br /><span className="text-xs font-normal">5% fee</span>
                </button>
                <button onClick={() => setWithdrawType("withdraw_bank")}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center ${withdrawType === "withdraw_bank" ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                  <Banknote className="w-4 h-4 mx-auto mb-1" /> Bank<br /><span className="text-xs font-normal">8% fee</span>
                </button>
              </div>
            </div>
            {withdrawType === "withdraw_exchange" && (
              <div className="space-y-2">
                <Label>Network</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["trc20", "bep20"] as const).map(n => (
                    <button key={n} onClick={() => setWithdrawWalletType(n)}
                      className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${withdrawWalletType === n ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                      {n.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input type="number" min={TRADE_MARKET.MIN_WITHDRAW} max={tradeBalance} placeholder={`Min $${TRADE_MARKET.MIN_WITHDRAW}`} value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} data-testid="input-withdraw-amount" />
            </div>
            {withdrawAmt && parseFloat(withdrawAmt) >= TRADE_MARKET.MIN_WITHDRAW && parseFloat(withdrawAmt) <= tradeBalance && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs space-y-1">
                {(() => {
                  const amt = parseFloat(withdrawAmt);
                  const fee = amt * (withdrawType === "withdraw_bank" ? 0.08 : 0.05);
                  const pool = amt * 0.05;
                  const net = amt - fee - pool;
                  return <>
                    <p className="font-semibold text-blue-800 dark:text-blue-300">Payout Preview</p>
                    <p>Platform fee ({withdrawType === "withdraw_bank" ? "8%" : "5%"}): <strong>-${fee.toFixed(2)}</strong></p>
                    <p>Affiliate Pool (5%): <strong>-${pool.toFixed(2)}</strong></p>
                    <p className="font-bold text-blue-700 dark:text-blue-300">Net payout: ${net.toFixed(2)}</p>
                  </>;
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmt || parseFloat(withdrawAmt) < TRADE_MARKET.MIN_WITHDRAW || parseFloat(withdrawAmt) > tradeBalance}
              data-testid="button-confirm-withdraw">
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />} Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-purple-600" /> Upgrade Your Investment Tier</DialogTitle>
            <DialogDescription>Move to a higher co-affiliate tier and increase your lifetime profit share.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {myCoAff && (
              <div className="bg-muted/50 rounded-xl p-4 border text-sm">
                <p className="text-muted-foreground text-xs mb-1">Current tier</p>
                <p className="font-bold">{myCategory && myCategory >= 500 ? `Elite ($${myCategory})` : myCategory === 300 ? "Growth ($300)" : "Starter ($100)"}</p>
                <p className="text-xs text-muted-foreground mt-1">Share: {(parseFloat(myCoAff.sharePercentage) * 100).toFixed(6)}% lifetime</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Upgrade to</Label>
              <div className="grid grid-cols-3 gap-2">
                {([{cat: 300, label: "Growth"}, {cat: 500, label: "Elite"}, {cat: -1, label: "Elite+"}]).map((opt) => {
                  if (opt.cat === 300 && myCategory !== null && myCategory >= 300) return null;
                  if (opt.cat === 500 && myCategory !== null && myCategory >= 10000) return null;
                  if (opt.cat === -1) return null;
                  return (
                    <button key={opt.cat} onClick={() => setUpgradeCategory(opt.cat)}
                      className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${upgradeCategory === opt.cat ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700' : 'border-muted hover:border-muted-foreground'}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {upgradeCategory === 500 && (
              <div className="space-y-2">
                <Label>Elite Amount ($500 – $10,000)</Label>
                <Input type="number" min={500} max={10000} step={50} value={upgradeEliteAmt} onChange={e => setUpgradeEliteAmt(e.target.value)} data-testid="input-upgrade-elite-amount" />
                <p className="text-xs text-muted-foreground">New share: {(getEliteSharePercentage(upgradeEliteAmtNum) * 100).toFixed(6)}% lifetime</p>
              </div>
            )}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-xs">
              <p className="font-semibold text-purple-800 dark:text-purple-300 mb-1">What changes after upgrade:</p>
              <p className="text-purple-700 dark:text-purple-400">Your lifetime profit share percentage increases immediately to match the new tier. The investment is one-time and non-refundable.</p>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
            <Button onClick={() => upgradeMutation.mutate({ category: upgradeCategory, customAmount: upgradeCategory === 500 ? upgradeEliteAmtNum : undefined })}
              disabled={upgradeMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white font-bold" data-testid="button-confirm-upgrade">
              {upgradeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />} Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welcome Wallet Walkthrough */}
      <Dialog open={walkthroughOpen} onOpenChange={setWalkthroughOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const steps = [
              {
                icon: Wallet,
                iconBg: "bg-blue-100 dark:bg-blue-900/40",
                iconColor: "text-blue-600",
                title: "Welcome to TSIA Affiliate Portal!",
                body: "Your account is set up. To get the most out of the platform, you'll want to connect your exchange wallet — this allows you to deposit funds into the Trade Market and withdraw your earnings.",
              },
              {
                icon: Zap,
                iconBg: "bg-green-100 dark:bg-green-900/40",
                iconColor: "text-green-600",
                title: "Connect Your Exchange Wallet",
                body: "Go to Trade Market → click 'Connect Exchange Wallet' → enter your TRC20 (TRON) or BEP20 (Binance) USDT wallet address from your BYBIT, BINANCE or compatible exchange.",
              },
              {
                icon: ArrowDownLeft,
                iconBg: "bg-amber-100 dark:bg-amber-900/40",
                iconColor: "text-amber-600",
                title: "Make Your First Deposit",
                body: "Send USDT to TSIA's receiving address, then click Deposit and enter the amount. 75% is credited to your trade wallet, 20% goes to the reserve fund, and 5% to the affiliate pool.",
              },
              {
                icon: Bot,
                iconBg: "bg-purple-100 dark:bg-purple-900/40",
                iconColor: "text-purple-600",
                title: "Activate the Trading BOT Daily at 1PM",
                body: "The AI Trading BOT must be manually activated every working day at 1:00 PM for it to execute trades that day. The target is 100% ROI @ 2% daily through arithmetic algorithm trading on capital markets.",
              },
            ];
            const s = steps[walkthroughStep];
            const Icon = s.icon;
            const isLast = walkthroughStep === steps.length - 1;
            return (
              <>
                <DialogHeader>
                  <div className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center mb-3 mx-auto`}>
                    <Icon className={`w-8 h-8 ${s.iconColor}`} />
                  </div>
                  <DialogTitle className="text-center text-xl">{s.title}</DialogTitle>
                  <DialogDescription className="text-center text-sm leading-relaxed mt-2">{s.body}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center gap-2 my-3">
                  {steps.map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all ${i === walkthroughStep ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`} />
                  ))}
                </div>
                <DialogFooter className="gap-3 sm:flex-row">
                  {walkthroughStep > 0 && (
                    <Button variant="outline" onClick={() => setWalkthroughStep(s => s - 1)} className="flex-1">Back</Button>
                  )}
                  <Button onClick={() => {
                    if (isLast) { setWalkthroughOpen(false); navigate("trade"); }
                    else setWalkthroughStep(s => s + 1);
                  }} className="flex-1 bg-primary font-semibold" data-testid={`button-walkthrough-${walkthroughStep}`}>
                    {isLast ? "Go to Trade Market →" : "Next"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
