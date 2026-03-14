import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Clock, Trophy, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight, LogOut, Sun, Moon, Monitor, Share2, Copy, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/Logo";
import { CURRENCY_RATES } from "@shared/schema";

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: verification } = useQuery({ queryKey: ["/api/verification/status"] });
  const { data: walletData } = useQuery({ queryKey: ["/api/wallet"] });
  const { data: transactions } = useQuery({ queryKey: ["/api/transactions"] });
  const { data: plan } = useQuery({ queryKey: ["/api/sponsorship/plan"] });
  const { data: affiliateInfo } = useQuery({ queryKey: ["/api/affiliate/info"] });

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

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", { amount, bankAccount: "local" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      toast({ title: "Withdrawal Processed", description: `$${data.netAmount} (₦${parseFloat(data.netAmountNgn).toLocaleString()}) sent to your bank` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => { await logout(); setLocation("/"); };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) { setLocation("/login"); return null; }

  const balance = parseFloat(walletData?.balance || "0");
  const balanceNgn = balance * CURRENCY_RATES.USD_TO_NGN_PAYOUT;
  const tier = verification?.tier || "none";
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const waecPct = verification?.waecPercentage ? parseFloat(verification.waecPercentage) : null;
  const payoutMin = verification?.payoutMin ? parseFloat(verification.payoutMin) : 0;
  const payoutMax = verification?.payoutMax ? parseFloat(verification.payoutMax) : 0;
  const commitmentStart = verification?.commitmentStartDate ? new Date(verification.commitmentStartDate) : null;
  const daysElapsed = commitmentStart ? Math.floor((Date.now() - commitmentStart.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const countdown = Math.max(0, 30 - daysElapsed);
  const isVerified = verification?.status === "verified";
  const isPending = verification?.status === "pending";
  const feePaid = verification?.portalFeePaid;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  const themeOpts = [{ v: "light" as const, i: Sun }, { v: "dark" as const, i: Moon }, { v: "system" as const, i: Monitor }];

  return (
    <div className="min-h-screen bg-background font-sans pb-20">
      <nav className="bg-card border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="badge" height={32} />
            <span className="text-xl font-bold tracking-tight">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-muted rounded-full p-1 gap-0.5">
              {themeOpts.map(o => (
                <button key={o.v} onClick={() => setMode(o.v)} className={`p-1.5 rounded-full transition-all ${mode === o.v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <o.i className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <div className="text-sm font-medium hidden sm:block">Hello, {user.firstName}</div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 pt-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-6xl mx-auto">
          <motion.div variants={itemVariants} className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${isVerified ? 'bg-green-500/20 text-green-400' : isPending ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {isVerified ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  {isVerified ? "Account Verified" : isPending && feePaid ? "Pending Admin Review" : "Complete Onboarding"}
                </h2>
                <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
                  {isVerified ? "Your documents are approved. Choose a sponsorship plan below." : isPending && feePaid ? "Your documents are under review by the TSIA team." : "Please complete onboarding to submit your application."}
                </p>
              </div>
              {feePaid && (
                <div className="bg-white/10 border border-white/20 px-8 py-4 rounded-xl text-center backdrop-blur-md min-w-[220px]">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">Commitment Window</div>
                  <div className="text-4xl font-bold font-mono tracking-tight flex items-center justify-center gap-3 text-white">
                    <Clock className="w-7 h-7 text-tsia-gold" /> {countdown} <span className="text-lg font-normal text-slate-400 font-sans tracking-normal">days left</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="h-full shadow-md border-0">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600"><Wallet className="w-5 h-5" /></div> Digital Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-8">
                    <div>
                      <div className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wide">Available Balance</div>
                      <div className="text-5xl font-bold tracking-tight" data-testid="text-wallet-balance">${balance.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground mt-1">₦{balanceNgn.toLocaleString()} (at ₦{CURRENCY_RATES.USD_TO_NGN_PAYOUT}/USD)</div>
                    </div>
                    <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                      <DialogTrigger asChild>
                        <Button className="h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-md" disabled={balance <= 0} data-testid="button-withdraw">
                          Withdraw <ArrowUpRight className="w-4 h-4 ml-2" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Withdraw Funds</DialogTitle>
                          <DialogDescription>7.5% VAT deducted. Payout rate: ₦{CURRENCY_RATES.USD_TO_NGN_PAYOUT}/USD.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Amount (USD)</Label>
                            <Input type="number" placeholder="0.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} data-testid="input-withdraw-amount" />
                          </div>
                          {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                            <div className="bg-muted rounded-xl p-4 border space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal</span><span className="font-medium">${parseFloat(withdrawAmount).toFixed(2)}</span></div>
                              <div className="flex justify-between text-destructive"><span>VAT (7.5%)</span><span>-${(parseFloat(withdrawAmount) * 0.075).toFixed(2)}</span></div>
                              <div className="flex justify-between font-bold border-t pt-2"><span>You Receive (USD)</span><span>${(parseFloat(withdrawAmount) * 0.925).toFixed(2)}</span></div>
                              <div className="flex justify-between font-bold text-primary"><span>You Receive (NGN)</span><span>₦{(parseFloat(withdrawAmount) * 0.925 * CURRENCY_RATES.USD_TO_NGN_PAYOUT).toLocaleString()}</span></div>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
                          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => withdrawMutation.mutate(withdrawAmount)} disabled={withdrawMutation.isPending} data-testid="button-confirm-withdraw">
                            {withdrawMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="bg-amber-50/50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                    <p className="leading-relaxed">A mandatory <strong>7.5% VAT</strong> applies to all withdrawals. Conversion at ₦{CURRENCY_RATES.USD_TO_NGN_PAYOUT}/USD payout rate.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="h-full shadow-md border-0 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/40 dark:from-amber-600/20 to-transparent rounded-bl-full pointer-events-none"></div>
                <CardHeader className="pb-2 relative z-10">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg text-amber-600"><Trophy className="w-5 h-5" /></div> Academic Tier
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 relative z-10">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-1 mb-4 shadow-xl shadow-amber-200/50">
                    <div className="w-full h-full bg-card rounded-full flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-amber-500" />
                    </div>
                  </motion.div>
                  <h3 className="text-3xl font-bold mb-1 tracking-tight" data-testid="text-tier">{tierLabel} Tier</h3>
                  {waecPct !== null && (
                    <p className="text-lg font-semibold text-primary mb-2">{waecPct}% Score</p>
                  )}
                  <p className="text-sm text-muted-foreground text-center mb-4 font-medium">
                    {tier !== "none" ? "Based on your WAEC results" : "Complete onboarding to set tier"}
                  </p>
                  {payoutMax > 0 && (
                    <Badge variant="secondary" className="px-4 py-1.5 text-sm font-semibold">
                      Payout: ${payoutMin} - ${payoutMax}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="h-full shadow-md border-0">
                <CardHeader>
                  <CardTitle className="text-xl">Sponsorship Plan</CardTitle>
                  <CardDescription className="text-base">
                    {plan ? `You are on the ${plan.planYears}-year plan.` : countdown > 0 && feePaid ? "Plans unlock after your commitment window." : isVerified ? "Select a plan to begin receiving funding." : "Complete verification to unlock plans."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { years: 1, price: 35, payout: 230 },
                      { years: 2, price: 45, payout: 460, popular: true },
                      { years: 3, price: 50, payout: 690 }
                    ].map((p) => {
                      const isActive = plan?.planYears === p.years;
                      const canSelect = isVerified && !plan && countdown === 0;
                      return (
                        <div key={p.years} className={`relative rounded-2xl p-6 transition-all ${isActive ? 'border-2 border-primary bg-primary/5 shadow-lg' : p.popular ? 'border-2 border-primary/30' : 'border'}`}>
                          {p.popular && !isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Recommended</div>}
                          {isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">Active</div>}
                          <h4 className="font-semibold text-lg mb-1">{p.years} Year Plan</h4>
                          <div className="text-3xl font-bold mb-1">${p.price}<span className="text-sm font-medium text-muted-foreground">/yr</span></div>
                          <div className="text-xs text-muted-foreground mb-6">₦{(p.price * CURRENCY_RATES.USD_TO_NGN_PAYMENT).toLocaleString()}/yr</div>
                          <ul className="space-y-3 mb-8 text-sm font-medium">
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Up to ${p.payout} payout</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Wallet access</li>
                          </ul>
                          <Button
                            variant={isActive ? 'default' : p.popular ? 'default' : 'outline'}
                            className="w-full h-11 font-semibold"
                            disabled={!canSelect || selectPlanMutation.isPending}
                            onClick={() => selectPlanMutation.mutate(p.years)}
                            data-testid={`button-plan-${p.years}`}
                          >
                            {isActive ? 'Active' : canSelect ? 'Select Plan' : 'Locked'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="h-full shadow-md border-0">
                <CardHeader><CardTitle className="text-xl">Activity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(!transactions || transactions.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
                    ) : (
                      transactions.slice(0, 6).map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
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
                          <div className={`font-bold text-sm ${parseFloat(tx.amount) >= 0 ? 'text-green-600' : ''}`}>
                            {parseFloat(tx.amount) >= 0 ? '+' : ''}${tx.amount}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div variants={itemVariants}>
            <Card className="shadow-md border-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg text-amber-600"><Share2 className="w-5 h-5" /></div>
                  Affiliate Program
                </CardTitle>
                <CardDescription>Share your referral code and earn commission for every verified student you refer.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted rounded-xl px-6 py-3 font-mono text-lg font-bold tracking-wider flex-1 text-center" data-testid="text-affiliate-code">
                        {affiliateInfo?.affiliateCode || user?.affiliateCode || "Loading..."}
                      </div>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => {
                          const code = affiliateInfo?.affiliateCode || user?.affiliateCode;
                          if (code) {
                            navigator.clipboard.writeText(code);
                            toast({ title: "Copied!", description: "Referral code copied to clipboard." });
                          }
                        }}
                        data-testid="button-copy-affiliate"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span><strong className="text-foreground">{affiliateInfo?.referralCount || 0}</strong> referrals</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
