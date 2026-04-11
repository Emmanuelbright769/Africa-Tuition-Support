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
  MapPin, AlertTriangle, Lock, ArrowLeft, X
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";

const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};

type WalletData      = { id: number; userId: number; balance: string };
type DepositRecord   = { id: number; amountUsd: string; txHash: string; walletType: string; status: string; createdAt: string };
type TransferRecord  = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord      = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };
type TxRecord        = { id: number; type: string; amount: string; fee: string; paymentMethod: string | null; description: string; createdAt: string };

const SERVICE_LABELS: Record<string, string> = {
  electricity: "Electricity", internet: "Internet", airtime: "Airtime",
  betting: "Betting", bank_transfer: "Bank Transfer", education: "Education",
};

const NG_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "FCMB (First City Monument Bank)" },
  { code: "058", name: "GTBank (Guaranty Trust Bank)" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "090267", name: "Kuda Bank (MFB)" },
  { code: "100004", name: "OPay Digital Services" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100033", name: "PalmPay" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "032", name: "Union Bank" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "566", name: "VFD Microfinance Bank" },
];

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
  const [withdrawChoiceOpen, setWithdrawChoiceOpen] = useState(false);
  // Bank withdrawal
  const [bwOpen, setBwOpen]             = useState(false);
  const [bwBankName, setBwBankName]     = useState("");
  const [bwBankCode, setBwBankCode]     = useState("");
  const [bwBankOther, setBwBankOther]   = useState("");
  const [bwAccount, setBwAccount]       = useState("");
  const [bwAccountName, setBwAccountName] = useState("");
  const [bwAmount, setBwAmount]         = useState("");
  const [bwSuccessOpen, setBwSuccessOpen] = useState(false);
  const [bwSuccessData, setBwSuccessData] = useState<{ amount: number; vatAmount: number; netAmountNgn: number; bankName: string; accountNumber: string; accountName: string } | null>(null);
  // Crypto withdrawal
  const [cwOpen, setCwOpen]               = useState(false);
  const [cwNetwork, setCwNetwork]         = useState<"bep20" | "trc20">("bep20");
  const [cwAddress, setCwAddress]         = useState("");
  const [cwAmount, setCwAmount]           = useState("");
  const [cwSuccessOpen, setCwSuccessOpen] = useState(false);
  const [cwSuccessData, setCwSuccessData] = useState<{ amount: number; netAmount: number; fee: number; network: string } | null>(null);

  // ── History ─────────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"ledger" | "deposits" | "sent" | "received" | "bills">("ledger");

  // ── KYC state ───────────────────────────────────────────────────────────
  const [kycBvn, setKycBvn]                   = useState("");
  const [kycBvnVerified, setKycBvnVerified]   = useState(false);
  const [kycBvnVerifying, setKycBvnVerifying] = useState(false);
  const [kycLocationVerified, setKycLocationVerified] = useState(false);
  const [kycLocationLoading, setKycLocationLoading]   = useState(false);
  const [kycLocationCoords, setKycLocationCoords]     = useState("");
  const [kycSubmitting, setKycSubmitting]             = useState(false);

  // ── Queries (real-time: poll every 5s + SSE invalidation) ───────────────
  const { data: verification, refetch: refetchVerification } = useQuery<any>({ queryKey: ["/api/verification/status"] });
  const { data: wallet, refetch: refetchWallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"], refetchInterval: 5000, staleTime: 3000 });
  const { data: deposits = [], refetch: refetchDeposits } = useQuery<DepositRecord[]>({ queryKey: ["/api/wallet/deposits"], refetchInterval: 10000 });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"], refetchInterval: 10000 });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"], refetchInterval: 15000 });
  const { data: txLedger = [] }  = useQuery<TxRecord[]>({ queryKey: ["/api/transactions"], refetchInterval: 10000 });

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

  // ── Open fund section ────────────────────────────────────────────────────
  const openFund = (method: "squad" | "crypto" = "squad") => {
    if (!walletKycDone && needsKyc) {
      toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification to unlock funding.", variant: "destructive" });
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

  const cryptoWithdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(cwAmount);
      if (!amount || amount < 1) throw new Error("Minimum withdrawal is $1");
      if (!cwAddress.trim()) throw new Error("USDT wallet address is required");
      const res = await apiRequest("POST", "/api/wallet/withdraw-crypto", { amount, network: cwNetwork, address: cwAddress.trim() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (d: any) => {
      setCwSuccessData({ amount: parseFloat(cwAmount), netAmount: d.netAmount, fee: d.fee, network: cwNetwork });
      setCwOpen(false); setCwAmount(""); setCwAddress(""); setCwNetwork("bep20");
      setCwSuccessOpen(true);
      refetchWallet();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawals"] });
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  const bankWithdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(bwAmount);
      if (!amount || amount < 1) throw new Error("Minimum withdrawal is $1");
      const effectiveBankName = bwBankName === "__other__" ? bwBankOther.trim() : bwBankName;
      if (!effectiveBankName) throw new Error("Please select or enter your bank name");
      if (!bwAccount || bwAccount.length !== 10 || !/^\d+$/.test(bwAccount)) throw new Error("Account number must be exactly 10 digits");
      if (!bwAccountName.trim()) throw new Error("Account name is required");
      const res = await apiRequest("POST", "/api/wallet/withdraw", {
        amount,
        bankName: effectiveBankName,
        bankCode: bwBankCode,
        accountNumber: bwAccount,
        accountName: bwAccountName.trim(),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (d: any) => {
      const effectiveBankName = bwBankName === "__other__" ? bwBankOther.trim() : bwBankName;
      setBwSuccessData({
        amount: parseFloat(bwAmount),
        vatAmount: parseFloat(d.vatAmount),
        netAmountNgn: parseInt(d.netAmountNgn),
        bankName: effectiveBankName,
        accountNumber: bwAccount,
        accountName: bwAccountName,
      });
      setBwOpen(false);
      setBwSuccessOpen(true);
      setBwBankName(""); setBwBankCode(""); setBwBankOther(""); setBwAccount(""); setBwAccountName(""); setBwAmount("");
      refetchWallet();
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
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

  const handleKycSubmit = async () => {
    setKycSubmitting(true);
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
                  <p className="text-white/75 text-xs">Complete 2 quick steps to unlock funding & transactions</p>
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

                {kycLocationVerified && (
                  <Button className="h-11 w-full bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" onClick={handleKycSubmit} disabled={kycSubmitting} data-testid="button-wallet-complete-kyc">
                    {kycSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating…</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Complete Verification</>}
                  </Button>
                )}
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
                  <p className="text-white/50 text-xs mb-1">Available balance · Crypto: 1% fee · Bank: Coming Soon</p>
                  <p className="text-white/40 text-[10px] mb-5">Minimum $2 must remain in wallet at all times</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => openFund("squad")} className="h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl" data-testid="btn-fund-wallet">
                      <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                    </Button>
                    <Button onClick={() => {
                      if (!walletKycDone && needsKyc) { toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification to unlock withdrawals.", variant: "destructive" }); return; }
                      setWithdrawChoiceOpen(true);
                    }} variant="outline" className="h-12 border-white/40 text-white hover:bg-white/10 rounded-2xl font-bold" data-testid="btn-withdraw">
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
              {(["ledger", "deposits", "sent", "received", "bills"] as const).map(tab => (
                <button key={tab} onClick={() => setHistoryTab(tab)}
                  className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
                  {tab === "ledger" ? "All" : tab === "sent" ? "Sent" : tab === "received" ? "Received" : tab === "deposits" ? "Deposits" : "Bills"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {historyTab === "ledger" && (txLedger.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : [...txLedger].reverse().map(tx => {
                const amt = parseFloat(tx.amount);
                const fee = parseFloat(tx.fee ?? "0");
                const isCredit = amt > 0;
                const typeLabel: Record<string,string> = {
                  deposit: "Deposit", withdrawal: "Withdrawal", transfer: "Transfer",
                  bill: "Bill Payment", trade_transfer: "Trade Fund", loan: "Loan",
                  admin_credit: "Admin Credit", admin_adjustment: "Admin Adj.",
                  verification_fee: "Verification Fee", sponsorship_credit: "Sponsorship",
                  vat_deduction: "VAT",
                };
                const methodLabel: Record<string,string> = {
                  squad: "Squad by GTco", paystack: "Card / Bank", wallet: "Wallet",
                  bank_transfer: "Bank Transfer", admin: "Admin", crypto: "Crypto",
                };
                return (
                  <div key={tx.id} data-testid={`tx-row-${tx.id}`} className="bg-card rounded-2xl px-4 py-3 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                          {isCredit ? <ArrowDownLeft className="w-4 h-4 text-tsia-green" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{typeLabel[tx.type] ?? tx.type}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">{methodLabel[tx.paymentMethod ?? ""] ?? tx.paymentMethod ?? "Wallet"} · {new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`font-bold text-sm ${isCredit ? "text-tsia-green" : "text-red-500"}`}>
                          {isCredit ? "+" : ""}${Math.abs(amt).toFixed(2)}
                        </p>
                        {fee > 0 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Fee: ${fee.toFixed(2)}</p>
                        )}
                        {fee === 0 && (
                          <p className="text-[10px] text-muted-foreground">No fee</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }))}

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

      {/* ══ WITHDRAW — STEP 1: CHOOSE METHOD ══ */}
      <Dialog open={withdrawChoiceOpen} onOpenChange={setWithdrawChoiceOpen}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !rounded-none !m-0 !p-0 !border-0 overflow-hidden bg-background">
          <div className="flex flex-col h-full">
            {/* Top header strip */}
            <div className="bg-gradient-to-br from-[#1a5c38] to-[#2d9d5c] px-6 pt-14 pb-8 text-white shrink-0">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Personal Wallet</p>
              <h2 className="text-3xl font-black">Withdraw Funds</h2>
              <p className="text-white/70 text-sm mt-1">Select your preferred withdrawal method</p>
            </div>

            {/* Options */}
            <div className="flex-1 px-5 py-8 space-y-4">
              {/* Bank */}
              <button
                onClick={() => { setWithdrawChoiceOpen(false); setBwBankName(""); setBwBankCode(""); setBwBankOther(""); setBwAccount(""); setBwAccountName(""); setBwAmount(""); setBwOpen(true); }}
                className="w-full flex items-center gap-4 p-5 rounded-3xl bg-[#1a5c38] hover:bg-[#1e6b42] active:scale-[0.98] transition-all text-left group shadow-lg"
                data-testid="btn-choose-bank-withdraw"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <Banknote className="w-8 h-8 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-lg text-white leading-tight">Bank Withdrawal</p>
                    <span className="text-[9px] font-black bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Active</span>
                  </div>
                  <p className="text-sm text-white/60">NGN to Nigerian bank · 7.5% VAT</p>
                  <p className="text-xs text-white/40 mt-0.5">30 minutes – 24 hours</p>
                </div>
                <ArrowUpRight className="w-6 h-6 text-white/70 group-hover:text-white shrink-0 transition-colors" />
              </button>

              {/* USDT Crypto */}
              <button
                onClick={() => { setWithdrawChoiceOpen(false); setCwAmount(""); setCwAddress(""); setCwNetwork("bep20"); setCwOpen(true); }}
                className="w-full flex items-center gap-4 p-5 rounded-3xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all text-left group shadow-lg"
                data-testid="btn-choose-crypto-withdraw"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-lg text-white leading-tight">USDT Crypto</p>
                    <span className="text-[9px] font-black bg-white/30 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Active</span>
                  </div>
                  <p className="text-sm text-white/80">BEP20 (BSC) · TRC20 (TRON)</p>
                  <p className="text-xs text-white/60 mt-0.5">1% handling fee · within 24 hours</p>
                </div>
                <ArrowUpRight className="w-6 h-6 text-white/80 group-hover:text-white shrink-0 transition-colors" />
              </button>
            </div>

            {/* Cancel */}
            <div className="px-5 pb-10 shrink-0">
              <Button variant="outline" className="w-full h-14 text-base font-bold rounded-2xl" onClick={() => setWithdrawChoiceOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ WITHDRAW — STEP 2: CRYPTO FORM ══ */}
      <Dialog open={cwOpen} onOpenChange={v => { setCwOpen(v); if (!v) { setCwAmount(""); setCwAddress(""); setCwNetwork("bep20"); } }}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !rounded-none !m-0 !p-0 !border-0 overflow-hidden bg-background">
          <div className="flex flex-col h-full">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 pt-14 pb-6 text-white shrink-0">
              <button onClick={() => { setCwOpen(false); setWithdrawChoiceOpen(true); }} className="flex items-center gap-1 text-white/70 hover:text-white text-xs mb-3 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-xl leading-tight">USDT Withdrawal</h2>
                  <p className="text-white/70 text-xs mt-0.5">Credited within 24 hours · 1% handling fee</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Network */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select Network</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["bep20", "trc20"] as const).map(n => (
                    <button key={n} onClick={() => { setCwNetwork(n); setCwAddress(""); }}
                      className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-center transition-all ${cwNetwork === n ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-border hover:border-amber-400/50 bg-card"}`}
                      data-testid={`btn-cw-network-${n}`}>
                      {cwNetwork === n && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 absolute top-2 right-2" />}
                      <span className={`text-sm font-black ${cwNetwork === n ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{n === "bep20" ? "BEP20" : "TRC20"}</span>
                      <span className={`text-[10px] font-medium ${cwNetwork === n ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{n === "bep20" ? "BSC Network" : "TRON Network"}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  Only send to a <strong>{cwNetwork === "bep20" ? "BEP20/BSC" : "TRC20/TRON"}</strong> address. Wrong network = permanently lost.
                </p>
              </div>

              {/* Address */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your USDT Address ({cwNetwork === "bep20" ? "BEP20" : "TRC20"})</Label>
                <Input
                  placeholder={cwNetwork === "bep20" ? "0x… (starts with 0x)" : "T… (starts with T)"}
                  value={cwAddress} onChange={e => setCwAddress(e.target.value)}
                  className="mt-1.5 font-mono text-xs h-11 rounded-xl" data-testid="input-cw-address"
                />
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount (USD) — Balance: <span className="text-tsia-green font-bold">${balance.toFixed(2)}</span></Label>
                <Input
                  type="number" min={1} step={0.01} placeholder="Enter amount (min $1.00)"
                  value={cwAmount} onChange={e => setCwAmount(e.target.value)}
                  className="mt-1.5 text-xl font-black h-12 rounded-xl" data-testid="input-cw-amount"
                />
              </div>

              {/* Fee breakdown */}
              {parseFloat(cwAmount) > 0 && (() => {
                const amt = parseFloat(cwAmount);
                const fee = parseFloat((amt * 0.01).toFixed(2));
                const net = parseFloat((amt - fee).toFixed(2));
                const rem = balance - amt;
                const tooLow = rem < 2;
                return (
                  <div className="rounded-2xl border bg-slate-50 dark:bg-slate-800/50 divide-y divide-border text-sm overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-2.5"><span className="text-muted-foreground">You send</span><span className="font-semibold">${amt.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center px-4 py-2.5 text-red-500"><span>Handling fee (1%)</span><span className="font-semibold">−${fee.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-tsia-green/5"><span className="font-bold text-tsia-green">You receive (USDT)</span><span className="font-black text-tsia-green">${net.toFixed(2)}</span></div>
                    <div className={`flex justify-between items-center px-4 py-2.5 ${tooLow ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                      <span className="text-muted-foreground text-xs">Wallet balance after</span>
                      <span className={`text-xs font-semibold ${tooLow ? "text-red-500" : "text-muted-foreground"}`}>${Math.max(0, rem).toFixed(2)}{tooLow && " ⚠ min $2"}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Info */}
              <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-3">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Withdrawals are processed manually within <strong>24 hours</strong>. A <strong>1% handling fee</strong> is deducted — no VAT charged.
                </p>
              </div>

              {/* CTA */}
              <Button
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-base"
                onClick={() => cryptoWithdrawMutation.mutate()}
                disabled={cryptoWithdrawMutation.isPending || !cwAmount || parseFloat(cwAmount) < 1 || !cwAddress.trim() || parseFloat(cwAmount) > balance || (balance - parseFloat(cwAmount || "0")) < 2}
                data-testid="btn-confirm-crypto-wd"
              >
                {cryptoWithdrawMutation.isPending
                  ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing…</>
                  : parseFloat(cwAmount) > 0
                    ? <><Coins className="w-5 h-5 mr-2" /> Receive ${(parseFloat(cwAmount) * 0.99).toFixed(2)} USDT</>
                    : <><Coins className="w-5 h-5 mr-2" /> Confirm Withdrawal</>
                }
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setCwOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ CRYPTO WITHDRAWAL SUCCESS ══ */}
      <Dialog open={cwSuccessOpen} onOpenChange={setCwSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-black">Withdrawal Received!</h3>
              <p className="text-muted-foreground text-sm mt-1">{cwSuccessData?.network === "bep20" ? "BEP20/BSC" : "TRC20/TRON"} · Processing within 24 hours</p>
            </div>
            <div className="rounded-xl border bg-slate-50 dark:bg-slate-800/40 p-3 w-full space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Requested</span><span>${cwSuccessData?.amount.toFixed(2)}</span></div>
              <div className="flex justify-between text-red-500"><span>Handling fee (1%)</span><span>−${cwSuccessData?.fee.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-tsia-green border-t pt-1.5"><span>You will receive (USDT)</span><span>${cwSuccessData?.netAmount.toFixed(2)}</span></div>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => setCwSuccessOpen(false)}>Got it, thanks!</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ BANK WITHDRAWAL — STEP 2: FORM ══ */}
      <Dialog open={bwOpen} onOpenChange={v => { setBwOpen(v); if (!v) { setBwBankName(""); setBwBankCode(""); setBwBankOther(""); setBwAccount(""); setBwAccountName(""); setBwAmount(""); } }}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !rounded-none !m-0 !p-0 !border-0 overflow-hidden bg-background">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#1a5c38] to-[#2d9d5c] px-6 pt-14 pb-6 text-white shrink-0">
              <button onClick={() => { setBwOpen(false); setWithdrawChoiceOpen(true); }} className="flex items-center gap-1 text-white/70 hover:text-white text-xs mb-3 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-xl leading-tight">Bank Withdrawal</h2>
                  <p className="text-white/70 text-xs mt-0.5">NGN to your Nigerian bank · 7.5% VAT · 30min–24h</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Bank selector */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Your Bank</Label>
                <select
                  className="w-full mt-1.5 h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a5c38]"
                  value={bwBankName} data-testid="select-bank-name"
                  onChange={e => {
                    const opt = NG_BANKS.find(b => b.name === e.target.value);
                    setBwBankName(e.target.value);
                    setBwBankCode(opt?.code ?? "");
                  }}
                >
                  <option value="">-- Choose bank --</option>
                  {NG_BANKS.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                  <option value="__other__">Other (type below)</option>
                </select>
                {bwBankName === "__other__" && (
                  <Input
                    placeholder="Type your bank name"
                    value={bwBankOther} onChange={e => setBwBankOther(e.target.value)}
                    className="mt-2 h-11 rounded-xl" data-testid="input-bank-other"
                  />
                )}
              </div>

              {/* Account Number */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Number (10 digits)</Label>
                <Input
                  type="text" inputMode="numeric" maxLength={10} placeholder="e.g. 0123456789"
                  value={bwAccount} onChange={e => setBwAccount(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="mt-1.5 font-mono h-11 rounded-xl tracking-widest" data-testid="input-bank-account"
                />
                {bwAccount.length > 0 && bwAccount.length < 10 && (
                  <p className="text-xs text-red-500 mt-1">{10 - bwAccount.length} more digit{10 - bwAccount.length !== 1 ? "s" : ""} needed</p>
                )}
              </div>

              {/* Account Name */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Name</Label>
                <Input
                  placeholder="e.g. John Doe"
                  value={bwAccountName} onChange={e => setBwAccountName(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl" data-testid="input-bank-account-name"
                />
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Amount (USD) — Balance: <span className="text-[#1a5c38] font-bold">${balance.toFixed(2)}</span>
                </Label>
                <Input
                  type="number" min={1} step={0.01} placeholder="Enter amount (min $1.00)"
                  value={bwAmount} onChange={e => setBwAmount(e.target.value)}
                  className="mt-1.5 text-xl font-black h-12 rounded-xl" data-testid="input-bank-amount"
                />
              </div>

              {/* Fee breakdown */}
              {parseFloat(bwAmount) > 0 && (() => {
                const amt  = parseFloat(bwAmount);
                const vat  = parseFloat((amt * 0.075).toFixed(2));
                const net  = parseFloat((amt - vat).toFixed(2));
                const ngn  = Math.round(net * 1280);
                const rem  = balance - amt;
                const tooLow = rem < 2;
                return (
                  <div className="rounded-2xl border bg-slate-50 dark:bg-slate-800/50 divide-y divide-border text-sm overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-2.5"><span className="text-muted-foreground">You send</span><span className="font-semibold">${amt.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center px-4 py-2.5 text-red-500"><span>VAT (7.5%)</span><span className="font-semibold">−${vat.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center px-4 py-2.5"><span className="text-muted-foreground">Net (USD)</span><span className="font-semibold">${net.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center px-4 py-3 bg-[#1a5c38]/5"><span className="font-bold text-[#1a5c38]">You receive (NGN)</span><span className="font-black text-[#1a5c38] text-base">₦{ngn.toLocaleString()}</span></div>
                    {tooLow && <div className="px-4 py-2 text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Minimum $2 must remain in wallet</div>}
                    {amt > balance && <div className="px-4 py-2 text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Insufficient balance</div>}
                  </div>
                );
              })()}

              {/* Info box */}
              <div className="flex items-start gap-2.5 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 p-3">
                <Shield className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                  Funds are debited immediately. Bank transfer takes <strong>30 minutes to 24 hours</strong>. Auto-refunded if not processed in 24h.
                </p>
              </div>

              {/* Submit */}
              <Button
                className="w-full h-12 bg-[#1a5c38] hover:bg-[#1e6b42] text-white font-black rounded-2xl text-base"
                onClick={() => bankWithdrawMutation.mutate()}
                disabled={
                  bankWithdrawMutation.isPending ||
                  !bwAmount || parseFloat(bwAmount) < 1 ||
                  parseFloat(bwAmount) > balance ||
                  (balance - parseFloat(bwAmount || "0")) < 2 ||
                  bwAccount.length !== 10 ||
                  !bwAccountName.trim() ||
                  (!bwBankName || (bwBankName === "__other__" && !bwBankOther.trim()))
                }
                data-testid="btn-confirm-bank-wd"
              >
                {bankWithdrawMutation.isPending
                  ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Submitting…</>
                  : parseFloat(bwAmount) > 0
                    ? <><Banknote className="w-5 h-5 mr-2" /> Send ₦{Math.round((parseFloat(bwAmount) * 0.925) * 1280).toLocaleString()}</>
                    : <><Banknote className="w-5 h-5 mr-2" /> Confirm Bank Withdrawal</>
                }
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setBwOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ BANK WITHDRAWAL SUCCESS ══ */}
      <Dialog open={bwSuccessOpen} onOpenChange={setBwSuccessOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
          <div className="flex flex-col items-center gap-0">
            {/* Green top band */}
            <div className="w-full bg-gradient-to-br from-[#1a5c38] to-[#2d9d5c] flex flex-col items-center py-8 px-6">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-11 h-11 text-white" />
              </div>
              <h2 className="text-white font-black text-2xl text-center">Withdrawal Submitted!</h2>
              <p className="text-white/70 text-sm text-center mt-1">Your bank transfer is being processed</p>
            </div>
            {/* Details */}
            <div className="w-full p-5 space-y-3">
              <div className="rounded-2xl border bg-slate-50 dark:bg-slate-800/50 divide-y divide-border text-sm overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2.5"><span className="text-muted-foreground">Amount</span><span className="font-semibold">${bwSuccessData?.amount.toFixed(2)}</span></div>
                <div className="flex justify-between items-center px-4 py-2.5 text-red-500"><span>VAT (7.5%)</span><span>−${bwSuccessData?.vatAmount.toFixed(2)}</span></div>
                <div className="flex justify-between items-center px-4 py-3 bg-[#1a5c38]/5">
                  <span className="font-bold text-[#1a5c38]">You'll receive (NGN)</span>
                  <span className="font-black text-[#1a5c38] text-base">₦{bwSuccessData?.netAmountNgn.toLocaleString()}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-4 py-3 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-300">{bwSuccessData?.bankName}</p>
                <p className="text-amber-700 dark:text-amber-400 font-mono text-xs mt-0.5">{bwSuccessData?.accountNumber} · {bwSuccessData?.accountName}</p>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1a5c38]" />
                <span>Processing takes <strong>30 minutes to 24 hours</strong>. You'll receive an email once sent. Auto-refunded if not processed in time.</span>
              </div>
              <Button className="w-full bg-[#1a5c38] hover:bg-[#1e6b42] text-white font-bold rounded-2xl" onClick={() => setBwSuccessOpen(false)} data-testid="btn-bank-wd-done">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
