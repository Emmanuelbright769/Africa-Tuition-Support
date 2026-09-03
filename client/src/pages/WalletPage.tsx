import { useState, useRef, useEffect, useCallback, type ComponentProps } from "react";
import { TransactionReceipt, type ReceiptRow } from "@/components/ui/TransactionReceipt";

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
type FundMethod = "squad" | "korapay" | "crypto";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatLagosDateTime } from "@/lib/date";
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
  Smartphone, Banknote, Receipt, ExternalLink, RefreshCw, Copy, Coins,
  MapPin, AlertTriangle, Lock, ArrowLeft, ArrowRight, X, Camera, ScanFace, RotateCcw, ShieldCheck
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";

const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};

type WalletData      = { id: number; userId: number; balance: string; lienAmount?: string; lienReason?: string | null; lienPlacedAt?: string | null };
type DepositRecord   = { id: number; amountUsd: string; txHash: string; walletType: string; status: string; createdAt: string };
type BillRecord      = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };
type TxRecord        = { id: number; type: string; amount: string; fee: string; paymentMethod: string | null; description: string; createdAt: string };

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
  const [fundMethod, setFundMethod]     = useState<FundMethod>("squad");
  const [fundAmount, setFundAmount]     = useState("");
  const [squadLoading, setSquadLoading] = useState(false);
  const [koraLoading, setKoraLoading]   = useState(false);
  const [cryptoNetwork, setCryptoNetwork] = useState<"trc20" | "bep20">("trc20");
  const [cryptoAmount, setCryptoAmount]   = useState("");
  const [cryptoTxHash, setCryptoTxHash]   = useState("");


  // ── Universal transaction receipt dialog ──────────────────────────────────
  const [txReceiptOpen, setTxReceiptOpen] = useState(false);
  const [txReceiptProps, setTxReceiptProps] = useState<Omit<ComponentProps<typeof TransactionReceipt>, "open" | "onClose"> | null>(null);
  const showWalletReceipt = (props: Omit<ComponentProps<typeof TransactionReceipt>, "open" | "onClose">) => {
    setTxReceiptProps(props);
    setTxReceiptOpen(true);
  };
  // ── History ─────────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"ledger" | "deposits" | "bills">("ledger");
  const [ledgerPage, setLedgerPage]     = useState(0);
  const [depositsPage, setDepositsPage] = useState(0);
  const [billsPage, setBillsPage]       = useState(0);
  const PAGE_SIZE = 10;

  // ── KYC state ───────────────────────────────────────────────────────────
  const [kycBvn, setKycBvn]                   = useState("");
  const [kycBvnVerified, setKycBvnVerified]   = useState(false);
  const [kycBvnVerifying, setKycBvnVerifying] = useState(false);
  const [kycLocationVerified, setKycLocationVerified] = useState(false);
  const [kycLocationLoading, setKycLocationLoading]   = useState(false);
  const [kycLocationCoords, setKycLocationCoords]     = useState("");
  const [kycSubmitting, setKycSubmitting]             = useState(false);
  // ── Face capture state ───────────────────────────────────────────────────
  const [kycFaceVerified, setKycFaceVerified]   = useState(false);
  const [kycCameraActive, setKycCameraActive]   = useState(false);
  const [kycSelfie, setKycSelfie]               = useState<string | null>(null);
  const kycVideoRef  = useRef<HTMLVideoElement>(null);
  const kycCanvasRef = useRef<HTMLCanvasElement>(null);
  const kycStreamRef = useRef<MediaStream | null>(null);

  // ── Queries (SSE-driven + poll fallback) ───────────────────────────────
  const { data: verification, refetch: refetchVerification } = useQuery<any>({ queryKey: ["/api/verification/status"] });
  const { data: wallet, refetch: refetchWallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"], refetchInterval: 600_000, staleTime: 120_000 });
  const { data: deposits = [], refetch: refetchDeposits } = useQuery<DepositRecord[]>({ queryKey: ["/api/wallet/deposits"], refetchInterval: 600_000 });
  const { data: bills = [] }         = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"], refetchInterval: 900_000 });
  const { data: txLedger = [] }      = useQuery<TxRecord[]>({ queryKey: ["/api/transactions"], refetchInterval: 600_000 });
  // SSE: immediately refetch on push events; close when tab hidden to allow server scale-to-zero
  useEffect(() => {
    let es: EventSource | null = null;
    function openSSE() {
      if (es) return;
      es = new EventSource("/api/events", { withCredentials: true });
      es.addEventListener("notification", (e: MessageEvent) => {
        try {
          const n = JSON.parse(e.data);
          if (n?.type === "wallet_credit" || n?.type === "wallet_activation") {
            refetchWallet(); refetchDeposits();
          }
        } catch {}
      });
    }
    function closeSSE() { es?.close(); es = null; }
    function onVisibility() { if (document.hidden) closeSSE(); else openSSE(); }
    if (!document.hidden) openSSE();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); closeSSE(); };
  }, []);

  const balance    = parseFloat(wallet?.balance ?? "0");
  const lienAmount = parseFloat(wallet?.lienAmount ?? "0");
  const hasLien    = lienAmount > 0;
  const available  = Math.max(0, balance - lienAmount);
  const walletKycDone = user?.kycCompleted === true;
  const needsKyc = !walletKycDone;

  // Retained only for historic verification data shown elsewhere in the page.
  const currentYear = new Date().getFullYear();
  const waecYr = verification?.waecYear ? parseInt(verification.waecYear, 10) : null;
  const estimatedAge = waecYr ? currentYear - waecYr + 16 : null;
  const bvnOptional = estimatedAge !== null && estimatedAge <= 19;

  // ── Open fund section ────────────────────────────────────────────────────
  const openFund = (method: FundMethod = "squad") => {
    if (!walletKycDone && needsKyc) {
      toast({ title: "Identity verification required", description: "Complete the secure document and selfie verification to unlock wallet funding.", variant: "destructive" });
      return;
    }
    setFundMethod(method);
    setFundAmount("");
    setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
    setFundOpen(true);
    setTimeout(() => fundRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // ── Korapay: initiate checkout → open in new tab → verify on return ───────
  const openKorapayCheckout = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount", description: "Minimum funding is $1.", variant: "destructive" }); return; }
    setKoraLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/korapay/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { checkoutUrl, reference } = d as { checkoutUrl: string; reference: string };
      // Open Korapay checkout in new tab
      const win = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Fallback: redirect current tab
        window.location.href = checkoutUrl;
        return;
      }
      toast({ title: "Korapay checkout opened", description: "Complete payment in the new tab, then return here to verify.", className: "border-tsia-green" });
      // Poll for verification every 5s for up to 5 minutes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 60) { clearInterval(poll); setKoraLoading(false); return; }
        try {
          const vRes = await apiRequest("POST", "/api/wallet/korapay/verify", { reference });
          const vd = await vRes.json();
          if (vRes.ok) {
            clearInterval(poll);
            toast({ title: "Wallet funded! 🎉", description: vd.message, className: "border-tsia-green" });
            refetchWallet(); refetchDeposits();
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            setFundOpen(false); setFundAmount(""); setKoraLoading(false);
          }
        } catch { /* keep polling */ }
      }, 5000);
    } catch (e: any) {
      setKoraLoading(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [fundAmount, toast, refetchWallet, refetchDeposits]);

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
      if (!amount || amount <= 2) throw new Error("Crypto deposit must be above $2");
      if (!cryptoTxHash.trim()) throw new Error("Transaction hash is required");
      const res = await apiRequest("POST", "/api/wallet/deposit", {
        amountUsd: amount, txHash: cryptoTxHash.trim(), walletType: cryptoNetwork,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      toast({ title: "Wallet Funded ✓", description: "Your crypto deposit has been credited to your wallet instantly. No admin approval needed.", className: "border-tsia-green" });
      refetchDeposits(); setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20"); setFundOpen(false);
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
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

  const handleKycStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      kycStreamRef.current = stream;
      if (kycVideoRef.current) {
        kycVideoRef.current.srcObject = stream;
        kycVideoRef.current.play();
      }
      setKycCameraActive(true);
    } catch {
      toast({ title: "Camera access denied", description: "Please allow camera access and try again.", variant: "destructive" });
    }
  };

  const handleKycCapture = () => {
    if (!kycVideoRef.current || !kycCanvasRef.current) return;
    const video  = kycVideoRef.current;
    const canvas = kycCanvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setKycSelfie(base64);
    // Stop stream
    kycStreamRef.current?.getTracks().forEach(t => t.stop());
    kycStreamRef.current = null;
    setKycCameraActive(false);
    setKycFaceVerified(true);
    toast({ title: "Selfie Captured ✓", className: "border-tsia-green" });
  };

  const handleKycRetake = async () => {
    setKycSelfie(null);
    setKycFaceVerified(false);
    await handleKycStartCamera();
  };

  const handleKycSubmit = async () => {
    toast({ title: "Use secure identity verification", description: "Wallet KYC is now completed through the document and selfie verification flow.", variant: "destructive" });
  };

  // ── Back navigation ───────────────────────────────────────────────────────
  const goBack = () => {
    const role = user?.role ?? "student";
    nav(role === "affiliate" ? "/affiliate-dashboard" : "/dashboard");
  };

  const statusBadge = (s: string) => {
    if (s === "completed" || s === "success" || s === "approved") return <span className="text-[10px] font-bold text-tsia-green bg-tsia-green/10 px-2 py-0.5 rounded-full">Approved</span>;
    if (s === "pending") return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Pending</span>;
    if (s === "refunded") return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">Refunded</span>;
    if (s === "declined") return <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Declined</span>;
    return <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{s ?? "Unknown"}</span>;
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
            <span className="font-bold text-base">SwiftWallet</span>
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
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30" data-testid="wallet-identity-required">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <h2 className="font-bold text-amber-900 dark:text-amber-100">Secure identity verification required</h2>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Complete the document and selfie verification prompt to unlock wallet funding. BVN, GPS, and local camera checks are no longer used for wallet KYC.</p>
                </div>
              </div>
            </div>
          )}

          {false && needsKyc && (
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
                <div className={`p-4 rounded-xl border transition-all ${kycBvnVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : bvnOptional ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-800 border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-semibold flex items-center gap-2 text-sm">
                      {kycBvnVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>}
                      BVN Verification
                      {bvnOptional && !kycBvnVerified && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold">Optional</span>}
                    </Label>
                    {kycBvnVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Verified ✓</span>}
                  </div>
                  {bvnOptional && !kycBvnVerified && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      BVN is optional for users aged 19 and under. You may skip this step.
                    </p>
                  )}
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
                <div className={`p-4 rounded-xl border transition-all ${!(kycBvnVerified || bvnOptional) ? 'opacity-40 pointer-events-none' : kycLocationVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
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

                {/* ── Step 3: Facial Biometric ───────────────────────────── */}
                <div className={`p-4 rounded-xl border transition-all ${!kycLocationVerified ? 'opacity-40 pointer-events-none' : kycFaceVerified ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-semibold flex items-center gap-2 text-sm">
                      {kycFaceVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>}
                      Facial Biometric
                    </Label>
                    {kycFaceVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Captured ✓</span>}
                  </div>
                  {!kycFaceVerified ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1.5">
                        <ScanFace className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                        Take a live selfie to confirm your identity. Ensure good lighting and look directly at the camera.
                      </p>
                      {kycCameraActive ? (
                        <div className="space-y-2">
                          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-52">
                            <video ref={kycVideoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                            <div className="absolute inset-0 border-4 border-blue-400/40 rounded-xl pointer-events-none" />
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">Centre your face in the frame</div>
                          </div>
                          <Button size="sm" className="h-10 w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleKycCapture} data-testid="button-wallet-capture-selfie">
                            <Camera className="w-4 h-4 mr-2" /> Capture Selfie
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" className="h-10 w-full" onClick={handleKycStartCamera} data-testid="button-wallet-open-camera">
                          <Camera className="w-4 h-4 mr-2" /> Open Camera
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img src={kycSelfie!} alt="selfie" className="w-16 h-16 rounded-xl object-cover border-2 border-green-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Selfie captured successfully</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Your face has been recorded for identity verification</p>
                        <button onClick={handleKycRetake} className="text-xs text-blue-500 underline mt-1 flex items-center gap-1" data-testid="button-wallet-retake-selfie">
                          <RotateCcw className="w-3 h-3" /> Retake
                        </button>
                      </div>
                    </div>
                  )}
                  <canvas ref={kycCanvasRef} className="hidden" />
                </div>

                {kycFaceVerified && (
                  <Button className="h-11 w-full bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" onClick={handleKycSubmit} disabled={kycSubmitting} data-testid="button-wallet-complete-kyc">
                    {kycSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating…</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Swift-Apply</>}
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
                    <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">TSIA SwiftWallet</p>
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
                  {hasLien && !hidden && (
                    <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2 mb-3" data-testid="wallet-lien-notice">
                      <Lock className="w-3.5 h-3.5 text-red-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-red-200 text-[11px] font-bold">Account Lien Active</p>
                        <p className="text-red-300/80 text-[10px]">Held: ${lienAmount.toFixed(2)} · Available: ${available.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-white/50 text-xs mb-1">{hasLien ? `Available: $${available.toFixed(2)} · $${lienAmount.toFixed(2)} under lien` : "Available balance · Use Fintech to send money to a bank account"}</p>
                  <p className="text-white/40 text-[10px] mb-5">Fund your wallet to access all platform services</p>
                  <Button onClick={() => openFund("squad")} className="w-full h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl" data-testid="btn-fund-wallet">
                    <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Payment method cards ─────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={fade} className="grid grid-cols-4 gap-2">
            {[
              { icon: CreditCard, label: "Card",     desc: "via Squad",    color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20",    method: "squad" as FundMethod },
              { icon: Building2,  label: "Korapay",  desc: "Card/Bank",    color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20", method: "korapay" as FundMethod },
              { icon: Smartphone, label: "USSD",     desc: "All nets",     color: "text-tsia-green", bg: "bg-green-50 dark:bg-green-900/20",   method: "squad" as FundMethod },
              { icon: Coins,      label: "Crypto",   desc: "USDT",         color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20",   method: "crypto" as FundMethod },
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
                  {/* Method tabs — 3 options */}
                  <div className="grid grid-cols-3 bg-muted/40 rounded-2xl p-1 gap-0.5">
                    <button onClick={() => setFundMethod("squad")}
                      className={`py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${fundMethod === "squad" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                      data-testid="btn-fund-method-squad">
                      <CreditCard className="w-4 h-4" />
                      <span>Squad</span>
                    </button>
                    <button onClick={() => setFundMethod("korapay")}
                      className={`py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${fundMethod === "korapay" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                      data-testid="btn-fund-method-korapay">
                      <Building2 className="w-4 h-4" />
                      <span>Korapay</span>
                    </button>
                    <button onClick={() => setFundMethod("crypto")}
                      className={`py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${fundMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                      data-testid="btn-fund-method-crypto">
                      <Coins className="w-4 h-4" />
                      <span>Crypto</span>
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
                        <Input id="fund-amount" type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                          value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                          className="mt-1 text-lg font-bold" data-testid="input-fund-amount" />
                        {parseFloat(fundAmount) > 0 && parseFloat(fundAmount) <= 2 && (
                          <p className="text-xs text-red-500 mt-1 font-medium">Amount must be above $2.00</p>
                        )}
                        {parseFloat(fundAmount) > 2 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ≈ ₦{(parseFloat(fundAmount) * 1480).toLocaleString()} NGN &nbsp;·&nbsp; {formatAmount(parseFloat(fundAmount))} {rateLabel()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                        <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800 dark:text-emerald-200">
                          Secure inline checkout — pay with card, bank transfer, USSD or instant bank debit. No redirect needed.
                        </p>
                      </div>
                      <Button className="w-full h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold"
                        onClick={openSquadModal}
                        disabled={squadLoading || !fundAmount || parseFloat(fundAmount) <= 2}
                        data-testid="btn-pay-squad">
                        {squadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                        {squadLoading ? "Opening secure checkout…" : `Pay ${parseFloat(fundAmount) > 0 ? `$${parseFloat(fundAmount).toFixed(2)}` : "Now"}`}
                      </Button>
                    </div>
                  )}

                  {/* ── KORAPAY TAB ── */}
                  {fundMethod === "korapay" && (
                    <div className="space-y-4">
                      {/* Accepted channels */}
                      <div className="flex gap-2 justify-center">
                        {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Banknote, label: "Transfer" }].map(({ icon: Icon, label }) => (
                          <div key={label} className="flex flex-col items-center gap-1 bg-muted/50 rounded-xl p-2.5 flex-1">
                            <Icon className="w-5 h-5 text-orange-500" />
                            <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label htmlFor="korapay-fund-amount">Amount (USD)</Label>
                        <Input id="korapay-fund-amount" type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                          value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                          className="mt-1 text-lg font-bold" data-testid="input-korapay-fund-amount" />
                        {parseFloat(fundAmount) > 0 && parseFloat(fundAmount) <= 2 && (
                          <p className="text-xs text-red-500 mt-1 font-medium">Amount must be above $2.00</p>
                        )}
                        {parseFloat(fundAmount) > 2 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ≈ ₦{(parseFloat(fundAmount) * 1480).toLocaleString()} NGN &nbsp;·&nbsp; {formatAmount(parseFloat(fundAmount))} {rateLabel()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                        <Shield className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-800 dark:text-orange-200">
                          Secured by <strong>Korapay</strong> — pay with card, bank transfer, or pay-with-bank. A checkout page will open in a new tab.
                        </p>
                      </div>
                      {koraLoading && (
                        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-3 text-sm text-orange-700 dark:text-orange-300 font-medium">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>Waiting for payment confirmation… Complete payment in the new tab, then return here.</span>
                        </div>
                      )}
                      <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold"
                        onClick={openKorapayCheckout}
                        disabled={koraLoading || !fundAmount || parseFloat(fundAmount) <= 2}
                        data-testid="btn-pay-korapay">
                        {koraLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                        {koraLoading ? "Awaiting payment…" : `Pay ${parseFloat(fundAmount) > 0 ? `$${parseFloat(fundAmount).toFixed(2)}` : "Now"} via Korapay`}
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
                        <Input id="crypto-amount" type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                          value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)}
                          className="mt-1 text-lg font-bold" data-testid="input-crypto-amount" />
                        {parseFloat(cryptoAmount) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">≈ {formatAmount(parseFloat(cryptoAmount))} {rateLabel()}</p>
                        )}
                      </div>

                      {/* Fee / distribution breakdown */}
                      {parseFloat(cryptoAmount) > 2 && (() => {
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
                        <p className="text-[11px] text-muted-foreground mt-1">Find this in your exchange/wallet after sending. Your wallet is credited instantly once submitted — no admin approval required.</p>
                      </div>

                      <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                        <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                        <p className="text-xs text-tsia-green">Above <strong>$2 USDT</strong>. Accepted via BYBIT, BINANCE, Coinbase and any compatible exchange.</p>
                      </div>

                      <Button onClick={() => cryptoDepositMutation.mutate()}
                        disabled={cryptoDepositMutation.isPending || !cryptoAmount || parseFloat(cryptoAmount) <= 2 || !cryptoTxHash.trim()}
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
              {(["ledger", "deposits", "bills"] as const).map(tab => (
                <button key={tab} onClick={() => setHistoryTab(tab)}
                  className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
                  {tab === "ledger" ? "All" : tab === "deposits" ? "Deposits" : "Bills"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {historyTab === "ledger" && (() => {
                const sorted = [...txLedger];
                const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
                const page = sorted.slice(ledgerPage * PAGE_SIZE, (ledgerPage + 1) * PAGE_SIZE);
                return sorted.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (<>
              {page.map(tx => {
                const amt = parseFloat(tx.amount);
                const fee = parseFloat(tx.fee ?? "0");
                const isCredit = amt > 0;
                const isAccountCredit = tx.paymentMethod === "admin"
                  && (tx.type === "admin_credit" || tx.type === "admin_adjustment");
                const typeLabel: Record<string,string> = {
                  deposit: "Deposit", withdrawal: "Withdrawal", transfer: "Transfer",
                  bill: "Bill Payment", trade_transfer: "Trade Fund", loan: "Loan",
                  admin_credit: "Wallet Credit", admin_adjustment: "Credit Alert",
                  verification_fee: "Verification Fee", sponsorship_credit: "Sponsorship",
                  vat_deduction: "VAT",
                };
                const methodLabel: Record<string,string> = {
                  squad: "Bank Card", paystack: "Card / Bank", wallet: "Wallet",
                  bank_transfer: "Bank Transfer", admin: "Wallet", crypto: "Crypto",
                };
                return (
                  <div key={tx.id} data-testid={`tx-row-${tx.id}`} className="bg-card rounded-2xl px-4 py-3 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                          {isCredit ? <ArrowDownLeft className="w-4 h-4 text-tsia-green" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{isAccountCredit ? "Credit Alert" : (typeLabel[tx.type] ?? tx.type)}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{isAccountCredit ? "Funds added to your wallet" : tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">{methodLabel[tx.paymentMethod ?? ""] ?? tx.paymentMethod ?? "Wallet"} · {formatLagosDateTime(tx.createdAt)}</p>
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
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setLedgerPage(p => Math.max(0, p - 1))} disabled={ledgerPage === 0}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-xs text-muted-foreground">Page {ledgerPage + 1} of {totalPages}</span>
                  <button onClick={() => setLedgerPage(p => Math.min(totalPages - 1, p + 1))} disabled={ledgerPage >= totalPages - 1}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              </>);
              })()}

              {historyTab === "deposits" && (() => {
                const totalPages = Math.ceil(deposits.length / PAGE_SIZE);
                const page = deposits.slice(depositsPage * PAGE_SIZE, (depositsPage + 1) * PAGE_SIZE);
                return deposits.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No deposits yet</p>
                </div>
              ) : (<>
                {page.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${(d.walletType === "squad" || d.walletType === "paystack") ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                      {(d.walletType === "squad" || d.walletType === "paystack") ? <CreditCard className="w-4 h-4 text-blue-600" /> : <Coins className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">${parseFloat(d.amountUsd).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.walletType === "squad" ? "Bank Card" : d.walletType === "paystack" ? "Card / Bank" : d.walletType?.toUpperCase()} · {formatLagosDateTime(d.createdAt)}
                      </p>
                    </div>
                  </div>
                  {statusBadge(d.status)}
                </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setDepositsPage(p => Math.max(0, p - 1))} disabled={depositsPage === 0}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <span className="text-xs text-muted-foreground">Page {depositsPage + 1} of {totalPages}</span>
                    <button onClick={() => setDepositsPage(p => Math.min(totalPages - 1, p + 1))} disabled={depositsPage >= totalPages - 1}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>);
              })()}

              {historyTab === "bills" && (() => {
                const totalPages = Math.ceil(bills.length / PAGE_SIZE);
                const page = bills.slice(billsPage * PAGE_SIZE, (billsPage + 1) * PAGE_SIZE);
                return bills.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No bill payments yet</p>
                </div>
              ) : (<>
                {page.map(b => (
                <div key={b.id} className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{SERVICE_LABELS[b.service] ?? b.service}</p>
                      <p className="text-[10px] text-muted-foreground">${parseFloat(b.amount).toFixed(2)} · {formatLagosDateTime(b.createdAt)}</p>
                    </div>
                  </div>
                  {statusBadge(b.status)}
                </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setBillsPage(p => Math.max(0, p - 1))} disabled={billsPage === 0}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <span className="text-xs text-muted-foreground">Page {billsPage + 1} of {totalPages}</span>
                    <button onClick={() => setBillsPage(p => Math.min(totalPages - 1, p + 1))} disabled={billsPage >= totalPages - 1}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>);
              })()}
            </div>
          </motion.div>

          <div className="h-8" />
        </div>
      </main>

      {/* All money-out flows handled in Fintech Hub */}

      {/* ══ BANK WITHDRAWAL SUCCESS ══ */}
      {/* Universal Transaction Receipt Dialog */}
      {txReceiptProps && (
        <TransactionReceipt
          open={txReceiptOpen}
          onClose={() => { setTxReceiptOpen(false); setTxReceiptProps(null); }}
          {...txReceiptProps}
        />
      )}

    </div>
  );
}
