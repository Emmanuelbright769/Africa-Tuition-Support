import { useState } from "react";
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
  CalendarDays, DollarSign, History, ChevronDown, ChevronUp
} from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { QCE } from "@shared/schema";

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

const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function QCESection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [contributeOpen, setContributeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contributeAmt, setContributeAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, refetch } = useQuery<QceStatus>({ queryKey: ["/api/qce/status"] });
  const { data: walletData } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });

  const savings = data?.savings;
  const transactions = data?.transactions ?? [];
  const walletBalance = parseFloat(walletData?.balance ?? "0");
  const qceBalance = parseFloat(savings?.balance ?? "0");
  const eligibilityPct = parseFloat(savings?.eligibilityPercent ?? "0");
  const daysActive = savings?.daysActive ?? 0;
  const progressPct = Math.min((daysActive / QCE.PERIOD_DAYS) * 100, 100);

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
      refetch();
    },
  });

  const isActivated = savings?.activated ?? false;
  const creditPortalUnlocked = savings?.creditPortalUnlocked ?? false;
  const maxWithdraw = Math.max(qceBalance - QCE.MIN_BALANCE, 0);
  const canWithdraw = qceBalance > QCE.MIN_BALANCE;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-tsia-green to-emerald-700 flex items-center justify-center shadow-md">
              <PiggyBank className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">QCE Savings</h2>
              <p className="text-sm text-muted-foreground">Quick Credit Eligibility</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActivated && (
              <Button variant="outline" size="sm" onClick={() => tickMutation.mutate()} disabled={tickMutation.isPending} data-testid="button-qce-refresh">
                {tickMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="ml-1 hidden sm:inline">Refresh Progress</span>
              </Button>
            )}
            {isActivated ? (
              <Badge className="bg-tsia-green/10 text-tsia-green border-tsia-green/20" variant="outline" data-testid="badge-qce-status">Active</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline" data-testid="badge-qce-status">Not Activated</Badge>
            )}
          </div>
        </div>
      </motion.div>

      {/* Activate prompt — shown before activation */}
      {!isActivated && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Button onClick={() => setContributeOpen(true)} className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white" data-testid="button-activate-qce">
            <Zap className="w-4 h-4 mr-2" /> Activate QCE Savings — min $5
          </Button>
        </motion.div>
      )}

      {/* Main stats — shown after activation */}
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
                <p className="text-2xl font-bold text-foreground" data-testid="text-qce-days">{daysActive}<span className="text-base font-normal text-muted-foreground">/{QCE.PERIOD_DAYS}</span></p>
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
                  <span>Day 0</span>
                  <span>Day 45</span>
                  <span>Day 90</span>
                </div>
                {savings?.startDate && (
                  <p className="text-xs text-muted-foreground">
                    Started {format(new Date(savings.startDate), "dd MMM yyyy")} · {daysActive >= QCE.PERIOD_DAYS ? "Complete! " : `${QCE.PERIOD_DAYS - daysActive} days left`}
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

          {/* Show / Hide Details toggle */}
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

          {/* Credit Portal + Minimum Balance (collapsible) */}
          {showDetails && (<>
          {/* Credit Portal */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className={`shadow-md border-0 ${creditPortalUnlocked ? "border-l-4 border-l-tsia-green" : "border-l-4 border-l-muted"}`} data-testid="card-credit-portal">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {creditPortalUnlocked ? (
                    <Unlock className="w-5 h-5 text-tsia-green" />
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  )}
                  Credit Portal
                  {creditPortalUnlocked && <Badge className="ml-auto bg-tsia-green/10 text-tsia-green border-0 text-xs">Unlocked</Badge>}
                </CardTitle>
                <CardDescription>
                  {creditPortalUnlocked
                    ? "Your credit portal is active. Continue building your savings to increase your eligibility."
                    : "Activate QCE savings and make your first transaction to unlock the credit portal."}
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
                          { pct: 5, label: "Access to micro-credit requests" },
                          { pct: 10, label: "Eligibility for student loan applications" },
                          { pct: 20, label: "Increased loan limits + faster approval" },
                          { pct: 30, label: "Full credit eligibility — maximum loan access" },
                        ].map(tier => (
                          <li key={tier.pct} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${eligibilityPct >= tier.pct ? "text-tsia-green" : "text-muted-foreground/40"}`} />
                            <span className={eligibilityPct >= tier.pct ? "text-foreground font-medium" : ""}>
                              {tier.pct}% — {tier.label}
                            </span>
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
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Activate your QCE savings to unlock the credit portal</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Your first $5 contribution opens access</p>
                    </div>
                    <Button size="sm" onClick={() => setContributeOpen(true)} className="bg-tsia-green hover:bg-tsia-green/90 text-white" data-testid="button-unlock-credit-portal">
                      <Zap className="w-3.5 h-3.5 mr-1.5" /> Activate Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Minimum balance info */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2 items-start">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>A minimum of <strong>${QCE.MIN_BALANCE}</strong> must always remain in your QCE savings. You can withdraw the rest at any time — your withdrawal will be sent straight back to your Personal Wallet.</p>
            </div>
          </motion.div>
          </>)}
        </>
      )}

      {/* Transaction History */}
      {isActivated && showDetails && transactions.length > 0 && (
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
                      {tx.type === "contribution"
                        ? <ArrowDownLeft className="w-4 h-4 text-tsia-green" />
                        : <ArrowUpRight className="w-4 h-4 text-red-500" />}
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

      {/* Contribute Dialog */}
      <Dialog open={contributeOpen} onOpenChange={v => { setContributeOpen(v); if (!v) setContributeAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-tsia-green" />
              {isActivated ? "Add to QCE Savings" : "Activate QCE Savings"}
            </DialogTitle>
            <DialogDescription>
              {isActivated
                ? `Your wallet balance: $${walletBalance.toFixed(2)} · QCE balance: $${qceBalance.toFixed(2)}`
                : `Minimum $${QCE.MIN_ACTIVATION} required to activate. Your wallet: $${walletBalance.toFixed(2)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min={isActivated ? 1 : QCE.MIN_ACTIVATION}
                max={walletBalance}
                placeholder={isActivated ? "Enter amount" : `Min $${QCE.MIN_ACTIVATION}`}
                value={contributeAmt}
                onChange={e => setContributeAmt(e.target.value)}
                data-testid="input-qce-contribute-amount"
              />
            </div>
            {contributeAmt && parseFloat(contributeAmt) > walletBalance && (
              <p className="text-xs text-red-500">Insufficient wallet balance.</p>
            )}
            {!isActivated && contributeAmt && parseFloat(contributeAmt) < QCE.MIN_ACTIVATION && (
              <p className="text-xs text-amber-600">Minimum ${QCE.MIN_ACTIVATION} required for activation.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContributeOpen(false)}>Cancel</Button>
            <Button
              className="bg-tsia-green hover:bg-tsia-green/90 text-white"
              onClick={() => contributeMutation.mutate()}
              disabled={
                contributeMutation.isPending ||
                !contributeAmt ||
                parseFloat(contributeAmt) <= 0 ||
                parseFloat(contributeAmt) > walletBalance ||
                (!isActivated && parseFloat(contributeAmt) < QCE.MIN_ACTIVATION)
              }
              data-testid="button-confirm-qce-contribute"
            >
              {contributeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              {isActivated ? "Contribute" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={v => { setWithdrawOpen(v); if (!v) setWithdrawAmt(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600" /> Withdraw from QCE
            </DialogTitle>
            <DialogDescription>
              QCE balance: <strong>${qceBalance.toFixed(2)}</strong> · Available to withdraw: <strong>${maxWithdraw.toFixed(2)}</strong>
              <br /><span className="text-xs">A $2 minimum stays in your QCE account.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min={0.01}
                max={maxWithdraw}
                placeholder={`Max $${maxWithdraw.toFixed(2)}`}
                value={withdrawAmt}
                onChange={e => setWithdrawAmt(e.target.value)}
                data-testid="input-qce-withdraw-amount"
              />
            </div>
            {withdrawAmt && parseFloat(withdrawAmt) > maxWithdraw && (
              <p className="text-xs text-red-500">Maximum withdrawable is ${maxWithdraw.toFixed(2)} (keeping $2 minimum).</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={
                withdrawMutation.isPending ||
                !withdrawAmt ||
                parseFloat(withdrawAmt) <= 0 ||
                parseFloat(withdrawAmt) > maxWithdraw
              }
              data-testid="button-confirm-qce-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
              Withdraw to Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
