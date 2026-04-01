import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Wallet, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Loader2,
  CheckCircle2, AlertCircle, Shield, CreditCard, Building2,
  Smartphone, Banknote, Receipt, Send, ExternalLink, RefreshCw, Copy
} from "lucide-react";
import { toNGN } from "@/lib/utils";

type WalletData = { id: number; userId: number; balance: string };
type DepositRecord = { id: number; amountUsd: string; txHash: string; walletType: string; status: string; createdAt: string };
type TransferRecord = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord    = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };

const SERVICE_LABELS: Record<string, string> = {
  electricity: "Electricity", internet: "Internet", airtime: "Airtime",
  betting: "Betting", bank_transfer: "Bank Transfer", education: "Education",
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function WalletSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const hiddenKey = `tsia_balance_hidden_${user?.id ?? "guest"}`;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(hiddenKey) === "true"; } catch { return false; }
  });
  const toggleHidden = () => setHidden(p => {
    const next = !p;
    try { localStorage.setItem(hiddenKey, String(next)); } catch {}
    return next;
  });

  // ── Fund dialog state ──────────────────────────────────────────────────
  const [fundOpen, setFundOpen]         = useState(false);
  const [fundAmount, setFundAmount]     = useState("");
  const [fundStep, setFundStep]         = useState<"amount" | "pending">("amount");
  const [pendingRef, setPendingRef]     = useState("");
  const [verifyRef, setVerifyRef]       = useState("");

  // ── Withdraw dialog state ──────────────────────────────────────────────
  const [withdrawOpen, setWithdrawOpen]     = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // ── History tab ────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"deposits" | "sent" | "received" | "bills">("deposits");

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: wallet, refetch: refetchWallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: deposits = [], refetch: refetchDeposits } = useQuery<DepositRecord[]>({ queryKey: ["/api/wallet/deposits"] });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });

  const balance = parseFloat(wallet?.balance ?? "0");

  // ── Mutations ──────────────────────────────────────────────────────────
  const initPaystackMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(fundAmount);
      if (!amount || amount < 1) throw new Error("Minimum funding amount is $1");
      const res = await apiRequest("POST", "/api/wallet/paystack/initialize", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d as { authorization_url: string; reference: string };
    },
    onSuccess: (d) => {
      setPendingRef(d.reference);
      setVerifyRef(d.reference);
      setFundStep("pending");
      window.open(d.authorization_url, "_blank", "width=600,height=700,noopener");
    },
    onError: (e: any) => toast({ title: "Could not start payment", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const ref = verifyRef.trim() || pendingRef;
      if (!ref) throw new Error("No reference found");
      const res = await apiRequest("POST", "/api/wallet/paystack/verify", { reference: ref });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d as { message: string; amountUsd: number };
    },
    onSuccess: (d) => {
      toast({ title: "Wallet funded! 🎉", description: d.message, className: "border-tsia-green" });
      refetchWallet();
      refetchDeposits();
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setFundOpen(false);
      setFundStep("amount");
      setFundAmount("");
      setPendingRef("");
      setVerifyRef("");
    },
    onError: (e: any) => toast({ title: "Verification failed", description: e.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (amount > balance) throw new Error("Insufficient balance");
      const res = await apiRequest("POST", "/api/wallet/withdraw", { amount, bankAccount: "local" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (d: any) => {
      toast({ title: "Withdrawal initiated", description: d.message, className: "border-blue-500" });
      refetchWallet();
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  const vatAmt = parseFloat(withdrawAmount || "0") * 0.075;
  const youGet = parseFloat(withdrawAmount || "0") * 0.925;

  const sentTransfers     = (transfers as TransferRecord[]).filter(t => t.senderId === user?.id);
  const receivedTransfers = (transfers as TransferRecord[]).filter(t => t.recipientId === user?.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-tsia-green" /> TSIA Personal Wallet
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your single wallet for all transactions on the platform</p>
      </motion.div>

      {/* Balance card */}
      <motion.div variants={itemVariants}>
        <div className="relative rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-7 pr-6">
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
            <div className="absolute top-4 right-16 w-24 h-24 rounded-full bg-white/5" />
            <div className="absolute -bottom-8 left-28 w-32 h-32 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">TSIA Personal Wallet</p>
                <div className="flex items-center gap-2">
                  <button onClick={toggleHidden} className="text-white/60 hover:text-white transition-colors p-1" data-testid="btn-toggle-balance">
                    {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => refetchWallet()} className="text-white/60 hover:text-white transition-colors p-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-white/50 text-xs mb-3">{user?.email}</p>

              <p className="text-5xl font-black text-white tracking-tight mb-1" data-testid="text-wallet-balance">
                {hidden ? <span className="tracking-[0.3em]">••••••</span> : `$${balance.toFixed(2)}`}
              </p>
              {!hidden && <p className="text-white/60 text-sm font-semibold mb-1">≈ {toNGN(balance)}</p>}
              <p className="text-white/50 text-xs mb-6">Available balance · 7.5% VAT on withdrawals</p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => { setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef(""); setFundOpen(true); }}
                  className="h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl"
                  data-testid="btn-fund-wallet"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                </Button>
                <Button
                  onClick={() => { setWithdrawAmount(""); setWithdrawOpen(true); }}
                  variant="outline"
                  className="h-12 border-white/40 text-white hover:bg-white/10 rounded-2xl font-bold"
                  disabled={balance <= 0}
                  data-testid="btn-withdraw"
                >
                  <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        {[
          { icon: CreditCard,  label: "Card",         desc: "Visa / Mastercard", color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20" },
          { icon: Building2,   label: "Bank Transfer", desc: "Direct bank",       color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { icon: Smartphone,  label: "USSD / Mobile", desc: "All networks",      color: "text-tsia-green", bg: "bg-green-50 dark:bg-green-900/20" },
        ].map(({ icon: Icon, label, desc, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
            <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
            <p className="text-xs font-bold">{label}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </div>
        ))}
      </motion.div>

      {/* VAT notice */}
      <motion.div variants={itemVariants}>
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <p>A mandatory <strong>7.5% VAT</strong> applies to all withdrawals per UK tax regulations. Funding is instant via card or bank transfer through Paystack.</p>
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div variants={itemVariants}>
        <h3 className="font-bold text-sm mb-3">Transaction History</h3>
        <div className="flex bg-muted/40 rounded-2xl p-1 text-xs mb-4 overflow-x-auto gap-0.5">
          {(["deposits","sent","received","bills"] as const).map(tab => (
            <button key={tab} onClick={() => setHistoryTab(tab)}
              className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
              {tab === "sent" ? "Sent" : tab === "received" ? "Received" : tab === "deposits" ? "Deposits" : "Bills"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {historyTab === "deposits" && (
            (deposits as DepositRecord[]).length === 0
              ? <Empty icon={ArrowDownLeft} msg="No deposits yet" />
              : (deposits as DepositRecord[]).slice(0, 15).map(d => (
                <div key={d.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.status === "completed" ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                    {d.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                      : <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm capitalize">
                      {d.walletType === "paystack" ? "Paystack" : d.walletType?.toUpperCase()} Deposit
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{d.txHash}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-tsia-green">+${parseFloat(d.amountUsd).toFixed(2)}</p>
                    <p className="text-[10px] text-tsia-green/70">{toNGN(parseFloat(d.amountUsd))}</p>
                    <p className={`text-[10px] font-semibold capitalize ${d.status === "completed" ? "text-tsia-green" : "text-amber-500"}`}>{d.status}</p>
                  </div>
                </div>
              ))
          )}

          {historyTab === "sent" && (
            sentTransfers.length === 0
              ? <Empty icon={Send} msg="No outgoing transfers yet" />
              : sentTransfers.slice(0, 15).map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">To {t.recipientName || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.note || "Transfer"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-red-500">−${parseFloat(t.amount).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground/70">{toNGN(parseFloat(t.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                  </div>
                </div>
              ))
          )}

          {historyTab === "received" && (
            receivedTransfers.length === 0
              ? <Empty icon={ArrowDownLeft} msg="No incoming transfers yet" />
              : receivedTransfers.slice(0, 15).map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                    <ArrowDownLeft className="w-5 h-5 text-tsia-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">From {t.senderName || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.note || "Transfer"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-tsia-green">+${parseFloat(t.amount).toFixed(2)}</p>
                    <p className="text-[10px] text-tsia-green/70">{toNGN(parseFloat(t.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                  </div>
                </div>
              ))
          )}

          {historyTab === "bills" && (
            (bills as BillRecord[]).length === 0
              ? <Empty icon={Receipt} msg="No bill payments yet" />
              : (bills as BillRecord[]).slice(0, 15).map(b => (
                <div key={b.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm capitalize">{SERVICE_LABELS[b.service] || b.service}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-red-500">−${parseFloat(b.amount).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground/70">{toNGN(parseFloat(b.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                  </div>
                </div>
              ))
          )}
        </div>
      </motion.div>

      {/* ── FUND WALLET DIALOG ─────────────────────────────────────────── */}
      <Dialog open={fundOpen} onOpenChange={open => { setFundOpen(open); if (!open) { setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-tsia-green" /> Fund Your Wallet
            </DialogTitle>
            <DialogDescription>
              {fundStep === "amount"
                ? "Pay securely via card, bank transfer, USSD, or mobile money."
                : "Complete the payment in the new tab, then click Verify below."}
            </DialogDescription>
          </DialogHeader>

          {fundStep === "amount" ? (
            <div className="space-y-4 py-2">
              {/* Payment method icons */}
              <div className="flex gap-2 justify-center">
                {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Mobile" }].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 bg-muted/50 rounded-xl p-2.5 flex-1">
                    <Icon className="w-5 h-5 text-tsia-green" />
                    <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="fund-amount">Amount (USD)</Label>
                <Input id="fund-amount" type="number" min={1} step={0.01} placeholder="e.g. 10.00"
                  value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                  className="mt-1 text-lg font-bold" data-testid="input-fund-amount" />
                {parseFloat(fundAmount) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">≈ {toNGN(parseFloat(fundAmount))} at ₦1,600/$1</p>
                )}
              </div>

              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">Payments are processed securely via Paystack. You'll be redirected to complete payment.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 rounded-2xl p-4 text-center">
                <ExternalLink className="w-8 h-8 text-tsia-green mx-auto mb-2" />
                <p className="font-bold text-sm">Payment page opened in a new tab</p>
                <p className="text-xs text-muted-foreground mt-1">Complete the payment there, then come back here and click <strong>Verify Payment</strong>.</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Payment Reference</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={verifyRef} onChange={e => setVerifyRef(e.target.value)} placeholder="Auto-filled from payment"
                    className="font-mono text-xs" data-testid="input-verify-ref" />
                  <button onClick={() => { navigator.clipboard.writeText(verifyRef); toast({ title: "Copied" }); }}
                    className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">If you already paid and closed the tab accidentally, paste the reference here.</p>
              </div>

              <button onClick={() => { setPendingRef(""); setVerifyRef(""); setFundStep("amount"); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Start a new payment
              </button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
            {fundStep === "amount" ? (
              <Button
                onClick={() => initPaystackMutation.mutate()}
                disabled={initPaystackMutation.isPending || !fundAmount || parseFloat(fundAmount) < 1}
                className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold"
                data-testid="btn-pay-paystack"
              >
                {initPaystackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Pay ${parseFloat(fundAmount || "0").toFixed(2)} · {toNGN(parseFloat(fundAmount || "0"))} via Paystack
              </Button>
            ) : (
              <Button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || !verifyRef.trim()}
                className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold"
                data-testid="btn-verify-payment"
              >
                {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Verify Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── WITHDRAW DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-500" /> Withdraw Funds
            </DialogTitle>
            <DialogDescription>7.5% VAT is deducted from all withdrawals per UK tax law.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="wd-amount">Amount (USD)</Label>
              <Input id="wd-amount" type="number" min={1} step={0.01} placeholder="0.00"
                value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                className="mt-1 text-lg font-bold" data-testid="input-withdraw-amount" />
              {parseFloat(withdrawAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">≈ {toNGN(parseFloat(withdrawAmount))} at ₦1,600/$1</p>
              )}
            </div>

            {parseFloat(withdrawAmount) > 0 && (
              <div className="bg-muted rounded-2xl p-4 border space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal</span><span className="font-medium">${parseFloat(withdrawAmount).toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>VAT (7.5%)</span><span>−${vatAmt.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t pt-2 mt-1">
                  <span>You Receive</span>
                  <div className="text-right">
                    <span className="text-tsia-green">${youGet.toFixed(2)}</span>
                    <p className="text-[11px] text-muted-foreground font-normal">≈ {toNGN(youGet)}</p>
                  </div>
                </div>
              </div>
            )}

            {parseFloat(withdrawAmount) > balance && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Insufficient balance (have ${balance.toFixed(2)})</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance}
              data-testid="btn-confirm-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ icon: Icon, msg }: { icon: any; msg: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <Icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
      {msg}
    </div>
  );
}
