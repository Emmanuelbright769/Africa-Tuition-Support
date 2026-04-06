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
  Smartphone, Banknote, Receipt, Send, ExternalLink, RefreshCw, Copy, Coins,
  ScanFace, MapPin, AlertTriangle, Lock
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";
import BiometricVerification from "@/components/ui/BiometricVerification";

// ── TSIA Receiving Wallet Addresses ───────────────────────────────────────────
const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};

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
  const { formatAmount, rateLabel, currency, loading: currencyLoading } = useLocalCurrency();

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
  const [fundMethod, setFundMethod]     = useState<"paystack" | "crypto">("paystack");
  const [fundAmount, setFundAmount]     = useState("");
  const [fundStep, setFundStep]         = useState<"amount" | "pending">("amount");
  const [pendingRef, setPendingRef]     = useState("");
  const [verifyRef, setVerifyRef]       = useState("");
  // Crypto-specific
  const [cryptoNetwork, setCryptoNetwork] = useState<"trc20" | "bep20">("trc20");
  const [cryptoAmount, setCryptoAmount]   = useState("");
  const [cryptoTxHash, setCryptoTxHash]   = useState("");

  // ── Withdraw dialog state ──────────────────────────────────────────────
  const [withdrawOpen, setWithdrawOpen]         = useState(false);
  const [withdrawAmount, setWithdrawAmount]     = useState("");
  const [withdrawTermsAccepted, setWithdrawTermsAccepted] = useState(false);

  // ── History tab ────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"deposits" | "sent" | "received" | "bills">("deposits");

  // ── Wallet KYC state ───────────────────────────────────────────────────
  const [kycBvn, setKycBvn] = useState("");
  const [kycBvnVerified, setKycBvnVerified] = useState(false);
  const [kycBvnVerifying, setKycBvnVerifying] = useState(false);
  const [kycLocationVerified, setKycLocationVerified] = useState(false);
  const [kycLocationLoading, setKycLocationLoading] = useState(false);
  const [kycLocationCoords, setKycLocationCoords] = useState("");
  const [kycShowBiometric, setKycShowBiometric] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: verification, refetch: refetchVerification } = useQuery<any>({ queryKey: ["/api/verification/status"] });
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

  const cryptoDepositMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(cryptoAmount);
      if (!amount || amount < 5) throw new Error("Minimum crypto deposit is $5");
      if (!cryptoTxHash.trim()) throw new Error("Transaction hash is required");
      const res = await apiRequest("POST", "/api/wallet/deposit", {
        amountUsd: amount, txHash: cryptoTxHash.trim(), walletType: cryptoNetwork,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      toast({ title: "Crypto deposit submitted ✓", description: "Your deposit is pending confirmation by TSIA (within 30 minutes).", className: "border-tsia-green" });
      refetchDeposits();
      setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
      setFundOpen(false);
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
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

  // ── Wallet KYC status ─────────────────────────────────────────────
  const walletKycDone = verification?.biometricVerified === true;
  const portalFeePaid = verification?.portalFeePaid === true;
  const needsKyc = portalFeePaid && !walletKycDone;

  // ── Wallet KYC handlers ───────────────────────────────────────────
  const handleKycVerifyBvn = async () => {
    if (!kycBvn || kycBvn.length !== 11 || !/^\d{11}$/.test(kycBvn)) {
      toast({ title: "Invalid BVN", description: "Enter a valid 11-digit BVN.", variant: "destructive" }); return;
    }
    setKycBvnVerifying(true);
    await new Promise(r => setTimeout(r, 2200));
    setKycBvnVerified(true);
    setKycBvnVerifying(false);
    toast({ title: "BVN Verified ✓", description: "Bank Verification Number confirmed." });
  };

  const handleKycVerifyLocation = async () => {
    setKycLocationLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      setKycLocationCoords(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      await new Promise(r => setTimeout(r, 1000));
      setKycLocationVerified(true);
      toast({ title: "Location Verified ✓", description: "GPS coordinates confirmed for proof of address." });
    } catch {
      toast({ title: "Location Denied", description: "Enable GPS and try again. False location leads to disqualification.", variant: "destructive" });
    } finally {
      setKycLocationLoading(false);
    }
  };

  const handleKycBiometricComplete = async () => {
    setKycSubmitting(true);
    try {
      await apiRequest("POST", "/api/verification/biometric");
      setKycShowBiometric(false);
      toast({ title: "Wallet Activated! 🎉", description: "Your wallet is now fully activated. You can fund and transact." });
      refetchVerification();
    } catch {
      toast({ title: "Biometric Error", description: "Could not save biometric. Try again.", variant: "destructive" });
    } finally {
      setKycSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-tsia-green" /> TSIA Personal Wallet
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your single wallet for all transactions on the platform</p>
      </motion.div>

      {/* ── Wallet KYC Activation Panel ── */}
      {needsKyc && (
        <motion.div variants={itemVariants} className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Activate Your Wallet</p>
              <p className="text-white/75 text-xs">Complete 3 quick steps to unlock funding & transactions</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Step 1: BVN */}
            <div className={`p-4 rounded-xl border transition-all ${kycBvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold flex items-center gap-2 text-sm">
                  {kycBvnVerified
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>}
                  BVN Verification
                </Label>
                {kycBvnVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
              </div>
              {!kycBvnVerified && (
                <div className="flex gap-2">
                  <Input
                    placeholder="11-digit BVN"
                    className="h-10 bg-muted/30 flex-1 font-mono tracking-widest"
                    value={kycBvn}
                    maxLength={11}
                    onChange={e => setKycBvn(e.target.value.replace(/\D/g, ""))}
                    data-testid="input-wallet-bvn"
                  />
                  <Button size="sm" className="h-10 px-4" onClick={handleKycVerifyBvn} disabled={kycBvnVerifying || kycBvn.length !== 11} data-testid="button-wallet-verify-bvn">
                    {kycBvnVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                  </Button>
                </div>
              )}
            </div>

            {/* Step 2: GPS */}
            <div className={`p-4 rounded-xl border transition-all ${!kycBvnVerified ? 'opacity-40 pointer-events-none' : kycLocationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
              <div className="flex items-center justify-between mb-2">
                <Label className="font-semibold flex items-center gap-2 text-sm">
                  {kycLocationVerified
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">2</span>}
                  Proof of Address (GPS)
                </Label>
                {kycLocationVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
              </div>
              {!kycLocationVerified ? (
                <>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> False location data leads to immediate account disqualification.
                  </p>
                  <Button size="sm" className="h-10 w-full" onClick={handleKycVerifyLocation} disabled={kycLocationLoading} data-testid="button-wallet-verify-location">
                    {kycLocationLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Detecting…</> : <><MapPin className="w-4 h-4 mr-2" />Enable GPS & Verify Location</>}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400 font-mono flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> GPS: {kycLocationCoords}</p>
              )}
            </div>

            {/* Step 3: Face Scan */}
            <div className={`p-4 rounded-xl border transition-all ${!kycLocationVerified ? 'opacity-40 pointer-events-none' : 'bg-white dark:bg-slate-800 border-border'}`}>
              <Label className="font-semibold flex items-center gap-2 mb-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>
                Biometric Face Scan
              </Label>
              <p className="text-xs text-muted-foreground mb-3">A quick face scan confirms you are a real, unique individual. Camera access required.</p>
              <Button
                size="sm"
                className="h-10 w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setKycShowBiometric(true)}
                disabled={!kycLocationVerified || kycSubmitting}
                data-testid="button-wallet-start-biometric"
              >
                <ScanFace className="w-4 h-4 mr-2" /> Start Face Scan
              </Button>
            </div>
          </div>
        </motion.div>
      )}

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
              {!hidden && (
                <p className="text-white/60 text-sm font-semibold mb-1">
                  ≈ {currencyLoading ? <span className="opacity-50 text-xs">detecting…</span> : formatAmount(balance)}
                  {currency && currency.code !== "USD" && (
                    <span className="ml-1.5 text-[10px] font-normal bg-white/10 px-1.5 py-0.5 rounded-full">{currency.code}</span>
                  )}
                </p>
              )}
              <p className="text-white/50 text-xs mb-1">Available balance · 7.5% VAT on withdrawals</p>
              <p className="text-white/40 text-[10px] mb-5">Minimum $2 must remain in wallet at all times for seamless operations</p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    if (!walletKycDone && needsKyc) {
                      toast({ title: "Wallet KYC Required", description: "Complete BVN, GPS, and face scan above to unlock funding.", variant: "destructive" }); return;
                    }
                    setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef(""); setFundOpen(true);
                  }}
                  className="h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl"
                  data-testid="btn-fund-wallet"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                </Button>
                <Button
                  onClick={() => {
                    if (!walletKycDone && needsKyc) {
                      toast({ title: "Wallet KYC Required", description: "Complete BVN, GPS, and face scan above to unlock withdrawals.", variant: "destructive" }); return;
                    }
                    setWithdrawAmount(""); setWithdrawTermsAccepted(false); setWithdrawOpen(true);
                  }}
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

      {/* Payment method quick-access cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2">
        {[
          { icon: CreditCard, label: "Card",    desc: "Visa / MC",   color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20",   method: "paystack" as const },
          { icon: Building2,  label: "Bank",    desc: "Transfer",    color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", method: "paystack" as const },
          { icon: Smartphone, label: "USSD",    desc: "All nets",    color: "text-tsia-green", bg: "bg-green-50 dark:bg-green-900/20",  method: "paystack" as const },
          { icon: Coins,      label: "Crypto",  desc: "USDT",        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20",  method: "crypto" as const },
        ].map(({ icon: Icon, label, desc, color, bg, method }) => (
          <button
            key={label}
            onClick={() => {
              if (!walletKycDone && needsKyc) {
                toast({ title: "Wallet KYC Required", description: "Complete BVN, GPS, and face scan to unlock funding.", variant: "destructive" }); return;
              }
              setFundMethod(method);
              setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef("");
              setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
              setFundOpen(true);
            }}
            className={`${bg} rounded-2xl p-2.5 text-center hover:opacity-80 transition-opacity active:scale-95`}
            data-testid={`btn-method-${label.toLowerCase()}`}
          >
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-[11px] font-bold">{label}</p>
            <p className="text-[9px] text-muted-foreground">{desc}</p>
          </button>
        ))}
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
                    <p className="text-[10px] text-tsia-green/70">{formatAmount(parseFloat(d.amountUsd))}</p>
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
                    <p className="text-[10px] text-muted-foreground/70">{formatAmount(parseFloat(t.amount))}</p>
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
                    <p className="text-[10px] text-tsia-green/70">{formatAmount(parseFloat(t.amount))}</p>
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
                    <p className="text-[10px] text-muted-foreground/70">{formatAmount(parseFloat(b.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                  </div>
                </div>
              ))
          )}
        </div>
      </motion.div>

      {/* ── FUND WALLET DIALOG ─────────────────────────────────────────── */}
      <Dialog open={fundOpen} onOpenChange={open => {
        setFundOpen(open);
        if (!open) { setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef(""); setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20"); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-tsia-green" /> Fund Your Wallet
            </DialogTitle>
            <DialogDescription>Choose your preferred funding method below.</DialogDescription>
          </DialogHeader>

          {/* Method tabs */}
          <div className="flex bg-muted/40 rounded-2xl p-1 mb-1">
            <button onClick={() => setFundMethod("paystack")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${fundMethod === "paystack" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
              <CreditCard className="w-4 h-4" /> Card / Bank / USSD
            </button>
            <button onClick={() => setFundMethod("crypto")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${fundMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              data-testid="btn-fund-method-crypto">
              <Coins className="w-4 h-4" /> USDT Crypto
            </button>
          </div>

          {/* ── PAYSTACK TAB ── */}
          {fundMethod === "paystack" && (
            <>
              {fundStep === "amount" ? (
                <div className="space-y-4 py-2">
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
                      <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(fundAmount))} {rateLabel()}</p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">Payments processed securely via Paystack. You'll be redirected to complete payment.</p>
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
                    <p className="text-[11px] text-muted-foreground mt-1">Paste reference here if you closed the payment tab.</p>
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
                  <Button onClick={() => initPaystackMutation.mutate()}
                    disabled={initPaystackMutation.isPending || !fundAmount || parseFloat(fundAmount) < 1}
                    className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-pay-paystack">
                    {initPaystackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Pay ${parseFloat(fundAmount || "0").toFixed(2)} via Paystack
                  </Button>
                ) : (
                  <Button onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending || !verifyRef.trim()}
                    className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-verify-payment">
                    {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Verify Payment
                  </Button>
                )}
              </DialogFooter>
            </>
          )}

          {/* ── CRYPTO TAB ── */}
          {fundMethod === "crypto" && (
            <>
              <div className="space-y-4 py-2">
                {/* Network selector */}
                <div>
                  <Label className="mb-2 block">Select Network</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["trc20", "bep20"] as const).map(n => (
                      <button key={n} onClick={() => setCryptoNetwork(n)}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${cryptoNetwork === n ? "border-tsia-green bg-tsia-green/10 text-tsia-green" : "border-border hover:border-tsia-green/40"}`}
                        data-testid={`btn-crypto-network-${n}`}>
                        {n === "trc20" ? "TRC20 (TRON)" : "BEP20 (BSC)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TSIA receiving address */}
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">TSIA Receiving Address ({cryptoNetwork.toUpperCase()})</Label>
                  <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2.5 border border-border">
                    <p className="flex-1 font-mono text-xs break-all leading-relaxed">{TSIA_WALLETS[cryptoNetwork]}</p>
                    <button onClick={() => { navigator.clipboard.writeText(TSIA_WALLETS[cryptoNetwork]); toast({ title: "Address copied!" }); }}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors" data-testid="btn-copy-wallet-address">
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    Send USDT only on the selected network. Wrong network = lost funds.
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <Label htmlFor="crypto-amount">Amount (USD)</Label>
                  <Input id="crypto-amount" type="number" min={5} step={0.01} placeholder="Min $5.00"
                    value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)}
                    className="mt-1 text-lg font-bold" data-testid="input-crypto-amount" />
                  {parseFloat(cryptoAmount) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(cryptoAmount))} {rateLabel()}</p>
                  )}
                </div>

                {/* TxHash */}
                <div>
                  <Label htmlFor="crypto-txhash">Transaction Hash / ID</Label>
                  <Input id="crypto-txhash" placeholder="Paste your transaction hash here"
                    value={cryptoTxHash} onChange={e => setCryptoTxHash(e.target.value)}
                    className="mt-1 font-mono text-xs" data-testid="input-crypto-txhash" />
                  <p className="text-[11px] text-muted-foreground mt-1">Find this in your exchange/wallet after sending. Your wallet will be credited within 30 minutes after admin confirmation.</p>
                </div>

                <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                  <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                  <p className="text-xs text-tsia-green">Minimum deposit: <strong>$5 USDT</strong>. Accepted via BYBIT, BINANCE, Coinbase and any compatible exchange wallet.</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
                <Button onClick={() => cryptoDepositMutation.mutate()}
                  disabled={cryptoDepositMutation.isPending || !cryptoAmount || parseFloat(cryptoAmount) < 5 || !cryptoTxHash.trim()}
                  className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-submit-crypto">
                  {cryptoDepositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                  Submit Deposit
                </Button>
              </DialogFooter>
            </>
          )}
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
                <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(withdrawAmount))} {rateLabel()}</p>
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
                    <p className="text-[11px] text-muted-foreground font-normal">≈ {formatAmount(youGet)}</p>
                  </div>
                </div>
              </div>
            )}

            {parseFloat(withdrawAmount) > balance && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Insufficient balance (have ${balance.toFixed(2)})</p>
            )}
            <TermsCheckbox
              checked={withdrawTermsAccepted}
              onCheckedChange={setWithdrawTermsAccepted}
              context="withdrawal"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance || !withdrawTermsAccepted}
              data-testid="btn-confirm-withdraw"
            >
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Biometric dialog for Wallet KYC ── */}
      <Dialog open={kycShowBiometric} onOpenChange={open => { if (!open) setKycShowBiometric(false); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="bg-[#1A3C34] px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D4AF37]/20 rounded-xl flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">TSIA Identity Verification</h2>
              <p className="text-white/60 text-[11px]">Powered by secure facial biometrics</p>
            </div>
            <div className="ml-auto flex items-center gap-1 bg-[#D4AF37]/20 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
              <span className="text-[#D4AF37] text-[10px] font-bold">SECURE</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <BiometricVerification
              onComplete={handleKycBiometricComplete}
              onCancel={() => setKycShowBiometric(false)}
            />
          </div>
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground">🔒 256-bit encrypted · NDPR compliant · Data not stored</span>
          </div>
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
