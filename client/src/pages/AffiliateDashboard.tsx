import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy, Users, Share2, LogOut, Sun, Moon, Monitor, TrendingUp, Link2,
  Banknote, Clock, Crown, Sparkles, CheckCircle2, AlertCircle, Loader2,
  Target, BarChart3, Infinity, Star, Wallet, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, RefreshCcw, ChevronDown, ChevronUp, Shield, Zap, Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { CO_AFFILIATE_PROGRAM, TRADE_MARKET, getEliteSharePercentage } from "@shared/schema";

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const itemVariants = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  "100":  { bg: "bg-blue-50 dark:bg-blue-900/20",   border: "border-blue-200 dark:border-blue-800",   text: "text-blue-700 dark:text-blue-300",   badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",   icon: "🥉" },
  "300":  { bg: "bg-purple-50 dark:bg-purple-900/20",border: "border-purple-200 dark:border-purple-800",text: "text-purple-700 dark:text-purple-300",badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",icon: "🥈" },
  "500":  { bg: "bg-amber-50 dark:bg-amber-900/20",  border: "border-amber-200 dark:border-amber-800",  text: "text-amber-700 dark:text-amber-300",  badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",  icon: "🏆" },
};
const getTierStyle = (cat: number) => TIER_STYLES[String(cat)] ?? TIER_STYLES["500"];

export default function AffiliateDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();

  const [loanOpen, setLoanOpen]   = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [eliteCustomAmount, setEliteCustomAmount] = useState("500");
  const [depositOpen, setDepositOpen]   = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [connectOpen, setConnectOpen]   = useState(false);
  const [depositAmt, setDepositAmt]     = useState("");
  const [depositWallet, setDepositWallet] = useState<"trc20"|"bep20">("trc20");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const [withdrawType, setWithdrawType] = useState<"withdraw_exchange"|"withdraw_bank">("withdraw_exchange");
  const [withdrawWalletType, setWithdrawWalletType] = useState<"trc20"|"bep20">("trc20");
  const [trc20Input, setTrc20Input]     = useState("");
  const [bep20Input, setBep20Input]     = useState("");
  const [showTxHistory, setShowTxHistory] = useState(false);

  const themeOpts = [
    { v: "light" as const, icon: Sun },
    { v: "dark" as const, icon: Moon },
    { v: "system" as const, icon: Monitor },
  ];

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { redirectTimerRef.current = setTimeout(() => setLocation("/login"), 200); }
    else if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); };
  }, [authLoading, user]);

  const { data: affiliateInfo } = useQuery({ queryKey: ["/api/affiliate/info"] });
  const { data: programData }   = useQuery({ queryKey: ["/api/co-affiliate/program"] });
  const { data: myCoAff, refetch: refetchMyCoAff } = useQuery({ queryKey: ["/api/co-affiliate/my-info"] });
  const { data: tradeWallet, refetch: refetchTradeWallet } = useQuery({ queryKey: ["/api/trade/wallet"] });
  const { data: tradeTxs = [], refetch: refetchTradeTxs }  = useQuery({ queryKey: ["/api/trade/transactions"] });

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
      setConnectOpen(false);
      refetchTradeWallet();
    },
    onError: (err: any) => toast({ title: "Connection Failed", description: err.message, variant: "destructive" }),
  });

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

  const eliteAmt   = Math.max(500, Math.min(10000, parseFloat(eliteCustomAmount) || 500));
  const eliteShare = getEliteSharePercentage(eliteAmt);

  const copyCode = () => { navigator.clipboard.writeText(affiliateCode); toast({ title: "Copied!", description: "Code copied." }); };
  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast({ title: "Copied!", description: "Link copied." }); };
  const handleLogout = async () => { await logout(); setLocation("/"); };

  const txTypeLabel: Record<string, string> = { deposit: "Deposit", withdraw_exchange: "Withdraw → Exchange", withdraw_bank: "Withdraw → Bank" };
  const txTypeIcon: Record<string, any> = { deposit: ArrowDownLeft, withdraw_exchange: ArrowUpRight, withdraw_bank: ArrowUpRight };

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      {/* Navbar */}
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><a className="flex items-center gap-3"><Logo variant="badge" height={32} /><span className="text-xl font-bold tracking-tight">Affiliate Portal</span></a></Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-aff-logout">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">

          {/* Hero banner */}
          <motion.div variants={itemVariants} className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">Welcome, {user!.firstName}!</h2>
                <p className="text-amber-100 text-sm">Your affiliate account is active. Share your code and start earning.</p>
              </div>
              <Button onClick={() => setLoanOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 h-11 px-5 font-semibold backdrop-blur-sm shrink-0" data-testid="button-take-loan">
                <Banknote className="w-4 h-4 mr-2" /> Take a Loan
              </Button>
            </div>
          </motion.div>

          {/* Stats row */}
          <div className="grid md:grid-cols-3 gap-5">
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
              <Card className="shadow-md border-0 h-full"><CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-xl ${isEnrolled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-muted'}`}>
                    <TrendingUp className={`w-6 h-6 ${isEnrolled ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Trust Fund Status</p>
                    <Badge className={`text-sm mt-1 ${isEnrolled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {isEnrolled ? (myCategory && myCategory >= 500 ? `Elite ($${myCategory}) ✓` : myCategory === 300 ? "Growth ✓" : "Starter ✓") : "Not Enrolled"}
                    </Badge>
                  </div>
                </div>
                {isEnrolled && myCoAff ? (
                  <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Share: {(parseFloat(myCoAff.sharePercentage) * 100).toFixed(6)}% lifetime</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Join the Trust Fund below</p>
                )}
              </CardContent></Card>
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

          {/* ── TRADE MARKET ── */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-xl border-2 border-blue-200 dark:border-blue-800 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-400/30">
                      <Globe className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Global Trade Market</h3>
                      <p className="text-blue-300 text-sm">Invest globally — deposit & withdraw using BYBIT, BINANCE & more</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                    Connect your crypto exchange wallet (TRC20 / BEP20) or use direct bank credit/debit. All deposits automatically allocate 20% to the TSIA Reserve Fund and 5% to the Affiliate Pool.
                  </p>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">

                {/* Trade balance + actions */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-900/20 dark:to-slate-800/50 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-muted-foreground mb-1">Trade Wallet Balance</p>
                    <p className="text-4xl font-bold text-blue-700 dark:text-blue-400 mb-4">${tradeBalance.toFixed(2)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" className="h-9 bg-green-600 hover:bg-green-700 text-white" onClick={() => setDepositOpen(true)} data-testid="button-trade-deposit">
                        <ArrowDownLeft className="w-3.5 h-3.5 mr-1" /> Deposit
                      </Button>
                      <Button size="sm" variant="outline" className="h-9" onClick={() => setWithdrawOpen(true)} data-testid="button-trade-withdraw">
                        <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> Withdraw
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border p-4 bg-muted/30 space-y-2 text-sm">
                      <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Connected Wallets</p>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">TRC20 (USDT)</span>
                        <span className="font-mono text-xs truncate max-w-[120px]">{tradeWallet?.trc20Address || <span className="text-muted-foreground italic">Not set</span>}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">BEP20 (USDT)</span>
                        <span className="font-mono text-xs truncate max-w-[120px]">{tradeWallet?.bep20Address || <span className="text-muted-foreground italic">Not set</span>}</span>
                      </div>
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs mt-1" onClick={() => { setTrc20Input(tradeWallet?.trc20Address || ""); setBep20Input(tradeWallet?.bep20Address || ""); setConnectOpen(true); }} data-testid="button-connect-wallet">
                        <Zap className="w-3 h-3 mr-1" /> {tradeWallet?.trc20Address || tradeWallet?.bep20Address ? "Update" : "Connect"} Exchange Wallet
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Fee schedule */}
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { label: "Deposit Allocation", desc: "75% credited to you", sub: "20% Reserve Fund · 5% Affiliate Pool", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", icon: ArrowDownLeft },
                    { label: "Exchange Withdrawal", desc: "5% fee", sub: "+ 5% Affiliate Pool deducted", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", icon: ArrowUpRight },
                    { label: "Bank Withdrawal", desc: "8% fee", sub: "+ 5% Affiliate Pool deducted", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", icon: Banknote },
                  ].map((f, i) => (
                    <div key={i} className={`rounded-xl p-4 border ${f.bg} ${f.border}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${f.bg} border ${f.border}`}>
                        <f.icon className={`w-4 h-4 ${f.color}`} />
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{f.label}</p>
                      <p className={`text-lg font-bold ${f.color}`}>{f.desc}</p>
                      <p className="text-xs text-muted-foreground">{f.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Reserve fund note */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">20% Reserve Fund</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Every deposit automatically allocates 20% to TSIA's Reserve Fund — a safety net protecting investors and ensuring platform sustainability. The fund is managed transparently and reported quarterly.</p>
                    </div>
                  </div>
                </div>

                {/* Deposit instructions */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">How to Deposit</span>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <p className="text-muted-foreground">Send USDT to TSIA's receiving wallet address for your chosen network, then click <strong>Deposit</strong> and enter the amount + transaction hash.</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3 border">
                        <p className="text-xs font-bold text-muted-foreground mb-1">TRC20 (TRON Network)</p>
                        <p className="font-mono text-xs break-all">{TRADE_MARKET.TSIA_RECEIVING_TRC20}</p>
                        <Button size="sm" variant="ghost" className="h-7 text-xs mt-1 w-full" onClick={() => { navigator.clipboard.writeText(TRADE_MARKET.TSIA_RECEIVING_TRC20); toast({ title: "Copied TRC20 address" }); }}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 border">
                        <p className="text-xs font-bold text-muted-foreground mb-1">BEP20 (BSC Network)</p>
                        <p className="font-mono text-xs break-all">{TRADE_MARKET.TSIA_RECEIVING_BEP20}</p>
                        <Button size="sm" variant="ghost" className="h-7 text-xs mt-1 w-full" onClick={() => { navigator.clipboard.writeText(TRADE_MARKET.TSIA_RECEIVING_BEP20); toast({ title: "Copied BEP20 address" }); }}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tx history */}
                <div>
                  <button onClick={() => setShowTxHistory(!showTxHistory)} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full justify-between">
                    <span>Transaction History ({(tradeTxs as any[]).length})</span>
                    {showTxHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showTxHistory && (
                    <div className="mt-3 space-y-2">
                      {(tradeTxs as any[]).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No trade transactions yet.</p>
                      ) : (tradeTxs as any[]).slice(0, 10).map((tx: any) => {
                        const TxIcon = txTypeIcon[tx.type] || ArrowUpRight;
                        const isDeposit = tx.type === "deposit";
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border text-sm" data-testid={`row-trade-tx-${tx.id}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDeposit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <TxIcon className={`w-4 h-4 ${isDeposit ? 'text-green-600' : 'text-red-500'}`} />
                              </div>
                              <div>
                                <p className="font-medium">{txTypeLabel[tx.type]}</p>
                                <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${isDeposit ? 'text-green-600' : 'text-red-500'}`}>{isDeposit ? '+' : '-'}${parseFloat(tx.amountUsd).toFixed(2)}</p>
                              <Badge variant="outline" className="text-[10px]">{tx.status}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── AFFILIATE TRUST FUND ── */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-tsia-gold/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-tsia-gold/20 rounded-xl flex items-center justify-center border border-tsia-gold/30">
                      <Crown className="w-7 h-7 text-tsia-gold" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Co-Affiliate / Initiator Programme</h3>
                      <p className="text-amber-200 text-sm">Lifetime profit sharing — exclusively for affiliate accounts</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm max-w-2xl">Invest once and earn a <strong className="text-white">lifetime 5% TSIA profit share</strong> proportional to your investment category. Prices increase +20% every 150,000 enrollments.</p>
                </div>
              </div>

              <CardContent className="p-6 space-y-6">
                {/* Programme progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold flex items-center gap-1.5"><Target className="w-4 h-4 text-primary" /> Programme Progress</span>
                    <span className="text-muted-foreground font-mono">{totalEnrolled.toLocaleString()} / {CO_AFFILIATE_PROGRAM.TARGET.toLocaleString()}</span>
                  </div>
                  <Progress value={progress.overallPct} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{spotsRemaining.toLocaleString()} spots remaining</span>
                    <span>{progress.overallPct.toFixed(2)}% filled</span>
                  </div>
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

                {/* ── Affiliate Trust Fund Categories (renamed from "Current Investment Categories") ── */}
                <div>
                  <h4 className="font-bold text-base mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-tsia-gold" /> Affiliate Trust Fund Categories</h4>
                  <div className="grid sm:grid-cols-3 gap-4">
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
                              <p className="text-xs text-muted-foreground mb-1">Choose your amount</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-amber-600">$</span>
                                <Input
                                  type="number"
                                  min={500} max={10000} step={50}
                                  value={eliteCustomAmount}
                                  onChange={e => setEliteCustomAmount(e.target.value)}
                                  className="h-9 font-bold text-lg border-amber-300"
                                  disabled={isEnrolled}
                                  data-testid="input-elite-amount"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Max: $10,000</p>
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
                          ) : (
                            <Button variant="outline" className="w-full h-10 text-sm" disabled>{isMyTier ? "Enrolled ✓" : "Already Enrolled"}</Button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Profit share explanation */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border">
                  <h4 className="font-bold flex items-center gap-2 text-sm mb-3"><BarChart3 className="w-4 h-4 text-primary" /> How Profit Sharing Works</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>TSIA allocates <strong className="text-foreground">5%</strong> of all profits to 1,000,000 Co-Affiliates for life.</p>
                    <div className="bg-card rounded-lg p-3 border font-mono text-xs space-y-1">
                      <div className="text-primary font-bold">Share = 0.000005 × (your amount ÷ 100)</div>
                      <div>$100 → <strong>0.0005%</strong> · $300 → <strong>0.0015%</strong> · $500 → <strong>0.0025%</strong> · $10,000 → <strong>0.05%</strong></div>
                    </div>
                  </div>
                </div>

                {/* Price table */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b"><h4 className="text-sm font-semibold">Price Schedule (every 150,000 enrollments)</h4></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-semibold">Co-Affiliates Enrolled</th>
                        <th className="text-center px-4 py-2 font-semibold">Starter ($100)</th>
                        <th className="text-center px-4 py-2 font-semibold">Growth ($300)</th>
                        <th className="text-center px-4 py-2 font-semibold">Elite ($500+)</th>
                      </tr></thead>
                      <tbody>
                        {[0,150000,300000,450000,600000,750000,900000].map((milestone, i) => {
                          const mult = Math.pow(1.20, i);
                          const isCur = totalEnrolled >= milestone && totalEnrolled < (milestone + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                          const isPast = totalEnrolled >= (milestone + CO_AFFILIATE_PROGRAM.MILESTONE_INTERVAL);
                          return (
                            <tr key={milestone} className={`border-b ${isCur ? 'bg-tsia-gold/10 font-bold' : isPast ? 'opacity-40' : ''}`}>
                              <td className="px-4 py-2">
                                {milestone === 0 ? "0 – 149,999" : `${milestone.toLocaleString()} – ${(milestone+149999).toLocaleString()}`}
                                {isCur && <span className="ml-2 text-[10px] bg-tsia-gold text-slate-900 px-1.5 py-0.5 rounded-full font-bold">NOW</span>}
                              </td>
                              <td className="px-4 py-2 text-center">${Math.round(100*mult)}</td>
                              <td className="px-4 py-2 text-center">${Math.round(300*mult)}</td>
                              <td className="px-4 py-2 text-center">${Math.round(500*mult)}+</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── E-COMMERCE (Coming Soon) ── */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-2 border-dashed border-muted-foreground/20 overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <h3 className="text-xl font-bold">E-Commerce Marketplace</h3>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xl">An integrated e-commerce marketplace for affiliates — sell products, earn commissions, and grow your income beyond referrals. Built to empower African entrepreneurs.</p>
                  </div>
                  <Button variant="outline" disabled className="shrink-0"><Clock className="w-4 h-4 mr-2" /> Coming Soon</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Referrals */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0">
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Your Referrals</CardTitle></CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-12"><Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-sm text-muted-foreground">No referrals yet. Share your link to start.</p></div>
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

        </motion.div>
      </main>

      {/* ── DIALOGS ── */}

      {/* Loan Coming Soon */}
      <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="w-10 h-10 text-amber-500" /></div>
            <DialogTitle className="text-2xl">Coming Soon</DialogTitle>
            <DialogDescription className="text-base">The Affiliate Loan feature is currently under development and will be available soon.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button className="w-full" onClick={() => setLoanOpen(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trust Fund Subscribe */}
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
                  <div className="text-right"><p className="text-xs text-muted-foreground">Amount</p><p className="text-2xl font-bold">${finalAmt}</p></div>
                </div>
                <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${col.badge}`}>Lifetime share: {finalShare} of TSIA profits</div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Lifetime participation, no renewal</div>
                  <div className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-amber-500" /> Investment is non-refundable</div>
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
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${withdrawType === "withdraw_exchange" ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                  <Globe className="w-4 h-4 mx-auto mb-1" /> Exchange Wallet<br /><span className="text-xs font-normal">5% fee</span>
                </button>
                <button onClick={() => setWithdrawType("withdraw_bank")}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${withdrawType === "withdraw_bank" ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-muted-foreground'}`}>
                  <Banknote className="w-4 h-4 mx-auto mb-1" /> Bank Account<br /><span className="text-xs font-normal">8% fee</span>
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
                <p className="font-semibold text-blue-800 dark:text-blue-300">Payout Preview</p>
                {(() => {
                  const amt = parseFloat(withdrawAmt);
                  const fee = amt * (withdrawType === "withdraw_bank" ? 0.08 : 0.05);
                  const pool = amt * 0.05;
                  const net = amt - fee - pool;
                  return <>
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
    </div>
  );
}
