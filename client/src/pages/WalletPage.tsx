import { useState, useRef, useEffect, useCallback } from "react";

// Squad inline widget type
declare global {
  interface Window {
    squad: new (config: {
      onClose: () => void; onLoad: () => void; onSuccess: (data: any) => void;
      key: string; email: string; amount: number; currency_code: string;
      transaction_ref: string; payment_channels?: string[];
      metadata?: Record<string, unknown>;
    }) => { setup: () => void; open: () => void };
  }
}
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Wallet, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Loader2,
  CheckCircle2, AlertCircle, Shield, CreditCard, Building2,
  Smartphone, Banknote, Receipt, Send, ExternalLink, RefreshCw, Copy, Coins,
  ScanFace, MapPin, AlertTriangle, Lock, ArrowLeft, X
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";
import BiometricVerification from "@/components/ui/BiometricVerification";

const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};

type WalletData      = { id: number; userId: number; balance: string };
type DepositRecord   = { id: number; amountUsd: string; txHash: string; walletType: string; status: string; createdAt: string };
type TransferRecord  = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord      = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };

const SERVICE_LABELS: Record<string, string> = {
  electricity: "Electricity", internet: "Internet", airtime: "Airtime",
  betting: "Betting", bank_transfer: "Bank Transfer", education: "Education",
};

const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const { formatAmount, rateLabel, currency, loading: currencyLoading } = useLocalCurrency();

  const fundRef = useRef<HTMLDivElement>(null);

  const hiddenKey = `tsia_balance_hidden_${user?.id ?? "guest"}`;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(hiddenKey) === "true"; } catch { return false; }
  });
  const toggleHidden = () => setHidden(p => {
    const next = !p; try { localStorage.setItem(hiddenKey, String(next)); } catch {}; return next;
  });

  // ── Fund state ──────────────────────────────────────────────────────────
  const [fundOpen, setFundOpen]         = useState(false);
  const [fundMethod, setFundMethod]     = useState<"squad" | "crypto">("squad");
  const [fundAmount, setFundAmount]     = useState("");
  const [squadLoading, setSquadLoading] = useState(false);
  const [cryptoNetwork, setCryptoNetwork] = useState<"trc20" | "bep20">("trc20");
  const [cryptoAmount, setCryptoAmount]   = useState("");
  const [cryptoTxHash, setCryptoTxHash]   = useState("");

  // ── Withdraw dialog state ───────────────────────────────────────────────
  const [withdrawOpen, setWithdrawOpen]         = useState(false);
  const [withdrawAmount, setWithdrawAmount]     = useState("");
  const [withdrawTermsAccepted, setWithdrawTermsAccepted] = useState(false);

  // ── History ─────────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"deposits" | "sent" | "received" | "bills">("deposits");

  // ── KYC state ───────────────────────────────────────────────────────────
  const [kycBvn, setKycBvn]                   = useState("");
  const [kycBvnVerified, setKycBvnVerified]   = useState(false);
  const [kycBvnVerifying, setKycBvnVerifying] = useState(false);
  const [kycLocationVerified, setKycLocationVerified] = useState(false);
  const [kycLocationLoading, setKycLocationLoading]   = useState(false);
  const [kycLocationCoords, setKycLocationCoords]     = useState("");
  const [kycShowBiometric, setKycShowBiometric]       = useState(false);
  const [kycSubmitting, setKycSubmitting]             = useState(false);

  // ── Queries (real-time: poll every 5s + SSE invalidation) ───────────────
  const { data: verification, refetch: refetchVerification } = useQuery<any>({ queryKey: ["/api/verification/status"] });
  const { data: wallet, refetch: refetchWallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"], refetchInterval: 5000, staleTime: 3000 });
  const { data: deposits = [], refetch: refetchDeposits } = useQuery<DepositRecord[]>({ queryKey: ["/api/wallet/deposits"], refetchInterval: 10000 });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"], refetchInterval: 10000 });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"], refetchInterval: 15000 });

  // SSE: immediately refetch when server pushes a wallet_credit / wallet_activation event
  useEffect(() => {
    const es = new EventSource("/api/events", { withCredentials: true });
    es.addEventListener("notification", (e: MessageEvent) => {
      try {
        const n = JSON.parse(e.data);
        if (n?.type === "wallet_credit" || n?.type === "wallet_activation") {
          refetchWallet();
          refetchDeposits();
        }
      } catch {}
    });
    return () => es.close();
  }, []);

  const balance = parseFloat(wallet?.balance ?? "0");
  const walletKycDone = verification?.biometricVerified === true;
  const portalFeePaid = verification?.portalFeePaid === true;
  const needsKyc = portalFeePaid && !walletKycDone;

  const vatAmt = parseFloat(withdrawAmount || "0") * 0.075;
  const youGet = parseFloat(withdrawAmount || "0") - vatAmt;

  // ── Open fund section ────────────────────────────────────────────────────
  const openFund = (method: "squad" | "crypto" = "squad") => {
    if (!walletKycDone && needsKyc) {
      toast({ title: "Wallet KYC Required", description: "Complete BVN, GPS, and face scan to unlock funding.", variant: "destructive" });
      return;
    }
    setFundMethod(method);
    setFundAmount("");
    setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
    setFundOpen(true);
    setTimeout(() => fundRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // ── Helper: load Squad widget script once ─────────────────────────────────
  const loadSquadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.squad) return resolve();
      const existing = document.getElementById("squad-widget-js");
      if (existing) { existing.addEventListener("load", () => resolve()); return; }
      const s = document.createElement("script");
      s.id = "squad-widget-js";
      s.src = "https://checkout.squadco.com/widget/squad.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load payment widget. Please check your connection."));
      document.head.appendChild(s);
    });
  }, []);

  // ── Squad pay: initiate → open modal → auto-verify on success ────────────
  const openSquadModal = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount", description: "Minimum funding is $1.", variant: "destructive" }); return; }
    setSquadLoading(true);
    try {
      // 1. Load Squad script
      await loadSquadScript();
      // 2. Initiate transaction on backend — gets ref, amount in kobo, and public key
      const res = await apiRequest("POST", "/api/wallet/squad/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { transactionRef, amountKobo, publicKey, email, firstName, lastName } = d as {
        transactionRef: string; amountKobo: number; publicKey: string; email: string; firstName: string; lastName: string;
      };
      // 3. Open Squad inline modal
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amountKobo,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        payment_channels: ["card", "bank", "ussd", "transfer"],
        metadata: { customer_name: `${firstName} ${lastName}`, platform: "TSIA" },
        onLoad: () => setSquadLoading(false),
        onClose: () => setSquadLoading(false),
        onSuccess: async (data: any) => {
          // 4. Auto-verify the payment
          const ref = data?.transaction_ref ?? transactionRef;
          try {
            const vRes = await apiRequest("POST", "/api/wallet/squad/verify", { transactionRef: ref });
            const vd = await vRes.json();
            if (!vRes.ok) throw new Error(vd.message);
            toast({ title: "Wallet funded! 🎉", description: vd.message, className: "border-tsia-green" });
            refetchWallet(); refetchDeposits();
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            setFundOpen(false); setFundAmount("");
          } catch (ve: any) {
            toast({ title: "Payment received — verification pending", description: ve.message ?? "Your funds will be credited shortly.", variant: "destructive" });
          }
        },
      });
      squadInstance.setup();
      squadInstance.open();
    } catch (e: any) {
      setSquadLoading(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [fundAmount, loadSquadScript, toast, refetchWallet, refetchDeposits]);

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
      refetchDeposits(); setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20"); setFundOpen(false);
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
    onSuccess: () => {
      toast({ title: "Withdrawal request submitted", description: "Your withdrawal will be processed within 24 hours.", className: "border-blue-500" });
      refetchWallet(); setWithdrawOpen(false); setWithdrawAmount(""); setWithdrawTermsAccepted(false);
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  // ── KYC handlers ─────────────────────────────────────────────────────────
  const handleKycVerifyBvn = async () => {
    setKycBvnVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/verification/bvn", { bvn: kycBvn });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setKycBvnVerified(true);
      toast({ title: "BVN Verified ✓", className: "border-tsia-green" });
    } catch (e: any) {
      toast({ title: "BVN Verification Failed", description: e.message, variant: "destructive" });
    } finally { setKycBvnVerifying(false); }
  };

  const handleKycVerifyLocation = () => {
    setKycLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setKycLocationVerified(true);
        setKycLocationCoords(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setKycLocationLoading(false);
        toast({ title: "Location Verified ✓", className: "border-tsia-green" });
      },
      () => { setKycLocationLoading(false); toast({ title: "Location access denied", variant: "destructive" }); }
    );
  };

  const handleKycBiometricComplete = async () => {
    setKycShowBiometric(false); setKycSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/verification/wallet-kyc", { bvn: kycBvn, gpsCoords: kycLocationCoords });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      await refetchVerification();
      toast({ title: "Wallet Activated ✓", description: "Your wallet is now fully unlocked!", className: "border-tsia-green" });
    } catch (e: any) {
      toast({ title: "Activation failed", description: e.message, variant: "destructive" });
    } finally { setKycSubmitting(false); }
  };

  // ── Back navigation ───────────────────────────────────────────────────────
  const goBack = () => {
    const role = user?.role ?? "student";
    nav(role === "affiliate" ? "/affiliate-dashboard" : "/dashboard");
  };

  const statusBadge = (s: string) => {
    if (s === "completed" || s === "success") return <span className="text-[10px] font-bold text-tsia-green bg-tsia-green/10 px-2 py-0.5 rounded-full">Confirmed</span>;
    if (s === "pending") return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Pending</span>;
    return <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Failed</span>;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Sticky top nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="btn-wallet-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Wallet className="w-5 h-5 text-tsia-green" />
            <span className="font-bold text-base">Personal Wallet</span>
          </div>
          <button onClick={() => refetchWallet()} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

          {/* ── KYC Panel ──────────────────────────────────────────────────── */}
          {needsKyc && (
            <motion.div initial="hidden" animate="visible" variants={fade} className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
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
                {/* BVN */}
                <div className={`p-4 rounded-xl border transition-all ${kycBvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-semibold flex items-center gap-2 text-sm">
                      {kycBvnVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>}
                      BVN Verification
                    </Label>
                    {kycBvnVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                  </div>
                  {!kycBvnVerified && (
                    <div className="flex gap-2">
                      <Input placeholder="11-digit BVN" className="h-10 bg-muted/30 flex-1 font-mono tracking-widest" value={kycBvn} maxLength={11} onChange={e => setKycBvn(e.target.value.replace(/\D/g, ""))} data-testid="input-wallet-bvn" />
                      <Button size="sm" className="h-10 px-4" onClick={handleKycVerifyBvn} disabled={kycBvnVerifying || kycBvn.length !== 11} data-testid="button-wallet-verify-bvn">
                        {kycBvnVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* GPS */}
                <div className={`p-4 rounded-xl border transition-all ${!kycBvnVerified ? 'opacity-40 pointer-events-none' : kycLocationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-semibold flex items-center gap-2 text-sm">
                      {kycLocationVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">2</span>}
                      Proof of Address (GPS)
                    </Label>
                    {kycLocationVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                  </div>
                  {!kycLocationVerified ? (
                    <>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> False location data leads to immediate account disqualification.</p>
                      <Button size="sm" className="h-10 w-full" onClick={handleKycVerifyLocation} disabled={kycLocationLoading} data-testid="button-wallet-verify-location">
                        {kycLocationLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Detecting…</> : <><MapPin className="w-4 h-4 mr-2" />Enable GPS & Verify Location</>}
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-green-600 dark:text-green-400 font-mono flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> GPS: {kycLocationCoords}</p>
                  )}
                </div>

                {/* Face scan */}
                <div className={`p-4 rounded-xl border transition-all ${!kycLocationVerified ? 'opacity-40 pointer-events-none' : 'bg-white dark:bg-slate-800 border-border'}`}>
                  <Label className="font-semibold flex items-center gap-2 mb-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>
                    Biometric Face Scan
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">A quick face scan confirms you are a real, unique individual. Camera access required.</p>
                  <Button size="sm" className="h-10 w-full bg-blue-600 hover:bg-blue-700" onClick={() => setKycShowBiometric(true)} disabled={!kycLocationVerified || kycSubmitting} data-testid="button-wallet-start-biometric">
                    <ScanFace className="w-4 h-4 mr-2" /> Start Face Scan
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Balance card ─────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fade}>
            <div className="relative rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-7 pr-6">
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
                <div className="absolute top-4 right-16 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute -bottom-8 left-28 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">TSIA Personal Wallet</p>
                    <button onClick={toggleHidden} className="text-white/60 hover:text-white transition-colors p-1" data-testid="btn-toggle-balance">
                      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-white/50 text-xs mb-3">{user?.email}</p>
                  <p className="text-5xl font-black text-white tracking-tight mb-1" data-testid="text-wallet-balance">
                    {hidden ? <span className="tracking-[0.3em]">••••••</span> : `$${balance.toFixed(2)}`}
                  </p>
                  {!hidden && (
                    <p className="text-white/60 text-sm font-semibold mb-1">
                      ≈ {currencyLoading ? <span className="opacity-50 text-xs">detecting…</span> : formatAmount(balance)}
                      {currency && currency.code !== "USD" && <span className="ml-1.5 text-[10px] font-normal bg-white/10 px-1.5 py-0.5 rounded-full">{currency.code}</span>}
                    </p>
                  )}
                  <p className="text-white/50 text-xs mb-1">Available balance · 7.5% VAT on withdrawals</p>
                  <p className="text-white/40 text-[10px] mb-5">Minimum $2 must remain in wallet at all times</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => openFund("squad")} className="h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl" data-testid="btn-fund-wallet">
                      <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                    </Button>
                    <Button onClick={() => {
                      if (!walletKycDone && needsKyc) { toast({ title: "Wallet KYC Required", description: "Complete BVN, GPS, and face scan to unlock withdrawals.", variant: "destructive" }); return; }
                      setWithdrawAmount(""); setWithdrawTermsAccepted(false); setWithdrawOpen(true);
                    }} variant="outline" className="h-12 border-white/40 text-white hover:bg-white/10 rounded-2xl font-bold" disabled={balance <= 0} data-testid="btn-withdraw">
                      <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Payment method cards ─────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fade} className="grid grid-cols-4 gap-2">
            {[
              { icon: CreditCard, label: "Card",   desc: "Visa / MC",  color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20",    method: "squad" as const },
              { icon: Building2,  label: "Bank",   desc: "Transfer",   color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", method: "squad" as const },
              { icon: Smartphone, label: "USSD",   desc: "All nets",   color: "text-tsia-green", bg: "bg-green-50 dark:bg-green-900/20",   method: "squad" as const },
              { icon: Coins,      label: "Crypto", desc: "USDT",       color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20",   method: "crypto" as const },
            ].map(({ icon: Icon, label, desc, color, bg, method }) => (
              <button key={label} onClick={() => openFund(method)}
                className={`${bg} rounded-2xl p-3 text-center hover:opacity-80 transition-all active:scale-95 ${fundOpen && fundMethod === method ? "ring-2 ring-tsia-green ring-offset-1" : ""}`}
                data-testid={`btn-method-${label.toLowerCase()}`}>
                <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                <p className="text-[11px] font-bold">{label}</p>
                <p className="text-[9px] text-muted-foreground">{desc}</p>
              </button>
            ))}
          </motion.div>

          {/* ── INLINE FUND SECTION ──────────────────────────────────────────── */}
          <AnimatePresence>
            {fundOpen && (
              <motion.div
                ref={fundRef}
                key="fund-section"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border-2 border-tsia-green/30 bg-card overflow-hidden shadow-sm"
              >
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-tsia-green" />
                    <h3 className="font-bold text-base">Fund Your Wallet</h3>
                  </div>
                  <button onClick={() => setFundOpen(false)} className="p-1.5 rounded-xl hover:bg-muted transition-colors" data-testid="btn-close-fund">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Method tabs */}
                  <div className="flex bg-muted/40 rounded-2xl p-1">
                    <button onClick={() => setFundMethod("squad")}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${fundMethod === "squad" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                      data-testid="btn-fund-method-squad">
                      <CreditCard className="w-4 h-4" /> Card / Bank / USSD
                    </button>
                    <button onClick={() => setFundMethod("crypto")}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${fundMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                      data-testid="btn-fund-method-crypto">
                      <Coins className="w-4 h-4" /> USDT Crypto
                    </button>
                  </div>

                  {/* ── SQUAD TAB ── */}
                  {fundMethod === "squad" && (
                    <div className="space-y-4">
                      {/* Accepted channels */}
                      <div className="flex gap-2 justify-center">
                        {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Transfer" }].map(({ icon: Icon, label }) => (
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
                          <p className="text-xs text-muted-foreground mt-1">
                            ≈ ₦{(parseFloat(fundAmount) * 1480).toLocaleString()} NGN &nbsp;·&nbsp; {formatAmount(parseFloat(fundAmount))} {rateLabel()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                        <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800 dark:text-emerald-200">
                          Secured by <strong>Squad by GTco</strong> — pay with card, bank transfer, USSD or instant bank debit. No redirect needed.
                        </p>
                      </div>
                      <Button className="w-full h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold"
                        onClick={openSquadModal}
                        disabled={squadLoading || !fundAmount || parseFloat(fundAmount) < 1}
                        data-testid="btn-pay-squad">
                        {squadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        {squadLoading ? "Opening secure checkout…" : `Pay ${parseFloat(fundAmount) > 0 ? `$${parseFloat(fundAmount).toFixed(2)}` : "Now"}`}
                      </Button>
                    </div>
                  )}

                  {/* ── CRYPTO TAB ── */}
                  {fundMethod === "crypto" && (
                    <div className="space-y-5">
                      {/* Network selector */}
                      <div>
                        <Label className="mb-2 block">Select Network</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {(["trc20", "bep20"] as const).map(n => (
                            <button key={n} onClick={() => setCryptoNetwork(n)}
                              className={`p-4 rounded-xl border-2 text-sm font-bold transition-all ${cryptoNetwork === n ? "border-tsia-green bg-tsia-green/10 text-tsia-green" : "border-border hover:border-tsia-green/40"}`}
                              data-testid={`btn-crypto-network-${n}`}>
                              {n === "trc20" ? "TRC20 (TRON)" : "BEP20 (BSC)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* TSIA receiving address */}
                      <div>
                        <Label className="mb-1.5 block text-sm">TSIA Receiving Address <span className="text-muted-foreground font-normal">({cryptoNetwork.toUpperCase()})</span></Label>
                        <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-3 border border-border">
                          <p className="flex-1 font-mono text-xs break-all leading-relaxed">{TSIA_WALLETS[cryptoNetwork]}</p>
                          <button onClick={() => { navigator.clipboard.writeText(TSIA_WALLETS[cryptoNetwork]); toast({ title: "Address copied!" }); }}
                            className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors" data-testid="btn-copy-wallet-address">
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> Send USDT only on the selected network. Wrong network = lost funds.
                        </p>
                      </div>

                      {/* Amount */}
                      <div>
                        <Label htmlFor="crypto-amount">Amount Sent (USD)</Label>
                        <Input id="crypto-amount" type="number" min={5} step={0.01} placeholder="Min $5.00"
                          value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)}
                          className="mt-1 text-lg font-bold" data-testid="input-crypto-amount" />
                        {parseFloat(cryptoAmount) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(cryptoAmount))} {rateLabel()}</p>
                        )}
                      </div>

                      {/* Fee / distribution breakdown */}
                      {parseFloat(cryptoAmount) >= 5 && (() => {
                        const gross = parseFloat(cryptoAmount);
                        const reserve = parseFloat((gross * 0.20).toFixed(2));
                        const pool    = parseFloat((gross * 0.05).toFixed(2));
                        const credit  = parseFloat((gross - reserve - pool).toFixed(2));
                        return (
                          <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
                            <p className="text-xs font-semibold text-foreground mb-1">Distribution Breakdown</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-tsia-green" /> Credited to your wallet (75%)</span>
                              <span className="font-bold text-tsia-green">${credit.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3 text-blue-500" /> Strategic Reserve Fund (20%)</span>
                              <span className="font-medium text-blue-600">${reserve.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" /> Affiliate Pool (5%)</span>
                              <span className="font-medium text-amber-600">${pool.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between text-xs font-semibold">
                              <span>Total deposited</span>
                              <span>${gross.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tx hash */}
                      <div>
                        <Label htmlFor="crypto-txhash">Transaction Hash / ID</Label>
                        <Input id="crypto-txhash" placeholder="Paste your transaction hash here"
                          value={cryptoTxHash} onChange={e => setCryptoTxHash(e.target.value)}
                          className="mt-1 font-mono text-sm" data-testid="input-crypto-txhash" />
                        <p className="text-[11px] text-muted-foreground mt-1">Find this in your exchange/wallet after sending. Your wallet will be credited within 30 minutes after admin confirmation.</p>
                      </div>

                      <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                        <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                        <p className="text-xs text-tsia-green">Minimum: <strong>$5 USDT</strong>. Accepted via BYBIT, BINANCE, Coinbase and any compatible exchange.</p>
                      </div>

                      <Button onClick={() => cryptoDepositMutation.mutate()}
                        disabled={cryptoDepositMutation.isPending || !cryptoAmount || parseFloat(cryptoAmount) < 5 || !cryptoTxHash.trim()}
                        className="w-full h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-submit-crypto">
                        {cryptoDepositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                        Submit Crypto Deposit
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Transaction History ──────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fade}>
            <h3 className="font-bold text-sm mb-3">Transaction History</h3>
            <div className="flex bg-muted/40 rounded-2xl p-1 text-xs mb-4 overflow-x-auto gap-0.5">
              {(["deposits", "sent", "received", "bills"] as const).map(tab => (
                <button key={tab} onClick={() => setHistoryTab(tab)}
                  className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
                  {tab === "sent" ? "Sent" : tab === "received" ? "Received" : tab === "deposits" ? "Deposits" : "Bills"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {historyTab === "deposits" && (deposits.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No deposits yet</p>
                </div>
              ) : deposits.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${(d.walletType === "squad" || d.walletType === "paystack") ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                      {(d.walletType === "squad" || d.walletType === "paystack") ? <CreditCard className="w-4 h-4 text-blue-600" /> : <Coins className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">${parseFloat(d.amountUsd).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.walletType === "squad" ? "Squad by GTco" : d.walletType === "paystack" ? "Card / Bank" : d.walletType?.toUpperCase()} · {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {statusBadge(d.status)}
                </div>
              )))}

              {historyTab === "sent" && (transfers.filter(t => t.senderId === user?.id).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No outgoing transfers</p>
                </div>
              ) : transfers.filter(t => t.senderId === user?.id).map(t => (
                <div key={t.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">−${parseFloat(t.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">To: {t.recipientName ?? `#${t.recipientId}`} · {new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {statusBadge(t.status)}
                </div>
              )))}

              {historyTab === "received" && (transfers.filter(t => t.recipientId === user?.id).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ArrowDownLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No incoming transfers</p>
                </div>
              ) : transfers.filter(t => t.recipientId === user?.id).map(t => (
                <div key={t.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4 text-tsia-green" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">+${parseFloat(t.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">From: {t.senderName ?? `#${t.senderId}`} · {new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {statusBadge(t.status)}
                </div>
              )))}

              {historyTab === "bills" && (bills.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No bill payments yet</p>
                </div>
              ) : bills.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{SERVICE_LABELS[b.service] ?? b.service}</p>
                      <p className="text-[10px] text-muted-foreground">${parseFloat(b.amount).toFixed(2)} · {new Date(b.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {statusBadge(b.status)}
                </div>
              )))}
            </div>
          </motion.div>

          <div className="h-8" />
        </div>
      </main>

      {/* ── Withdraw Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-blue-500" /> Withdraw Funds</DialogTitle>
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
            <TermsCheckbox checked={withdrawTermsAccepted} onCheckedChange={setWithdrawTermsAccepted} context="withdrawal" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance || !withdrawTermsAccepted}
              data-testid="btn-confirm-withdraw">
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Biometric Dialog ─────────────────────────────────────────────────── */}
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
            <BiometricVerification onComplete={handleKycBiometricComplete} onCancel={() => setKycShowBiometric(false)} />
          </div>
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2">
            <span className="text-[10px] text-muted-foreground">🔒 256-bit encrypted · NDPR compliant · Data not stored</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
