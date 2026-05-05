import { useState, useRef, useCallback, useEffect, type ComponentProps } from "react";
import { useLocation } from "wouter";
import { TransactionReceipt, type ReceiptRow } from "@/components/ui/TransactionReceipt";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  Smartphone, Banknote, Receipt, ExternalLink, RefreshCw, Copy, Coins,
  MapPin, AlertTriangle, Lock, ChevronLeft, Camera, ScanFace, RotateCcw,
  ChevronDown, BookOpen, TrendingUp, Users, Clock
} from "lucide-react";

import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";

// ── TSIA Receiving Wallet Addresses ───────────────────────────────────────────
const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};

type WalletData = { id: number; userId: number; balance: string };
type DepositRecord = { id: number; amountUsd: string; txHash: string; walletType: string; status: string; createdAt: string };
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
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatAmount, formatAmountVAT, rateLabel, rateLabelVAT, currency, loading: currencyLoading } = useLocalCurrency();

  const hiddenKey = `tsia_balance_hidden_${user?.id ?? "guest"}`;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(hiddenKey) === "true"; } catch { return false; }
  });
  const toggleHidden = () => setHidden(p => {
    const next = !p;
    try { localStorage.setItem(hiddenKey, String(next)); } catch {}
    return next;
  });

  // ── Wallet switcher ────────────────────────────────────────────────────
  type WalletView = "student" | "affiliate";
  const walletViewKey = `tsia_wallet_view_${user?.id ?? "guest"}`;
  const [walletView, setWalletView] = useState<WalletView>(() => {
    try { return (localStorage.getItem(walletViewKey) as WalletView) ?? "student"; } catch { return "student"; }
  });
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switchWallet = (w: WalletView) => {
    setWalletView(w);
    try { localStorage.setItem(walletViewKey, w); } catch {}
    setSwitcherOpen(false);
  };
  useEffect(() => {
    if (!switcherOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-wallet-switcher]")) setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [switcherOpen]);

  // ── Fund dialog state ──────────────────────────────────────────────────
  const [fundOpen, setFundOpen]           = useState(false);
  const [fundMethod, setFundMethod]       = useState<FundMethod>("squad");
  const [fundAmount, setFundAmount]       = useState("");
  const [squadLoading, setSquadLoading]   = useState(false);
  const [koraLoading, setKoraLoading]     = useState(false);
  // Crypto-specific
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
  // ── History tab ────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"deposits" | "bills">("deposits");
  const [depositsPage, setDepositsPage] = useState(0);
  const [billsPage, setBillsPage] = useState(0);
  const WS_PAGE_SIZE = 10;

  // ── Wallet KYC state ───────────────────────────────────────────────────
  const [kycBvn, setKycBvn] = useState("");
  const [kycBvnVerified, setKycBvnVerified] = useState(false);
  const [kycBvnVerifying, setKycBvnVerifying] = useState(false);
  const [kycLocationVerified, setKycLocationVerified] = useState(false);
  const [kycLocationLoading, setKycLocationLoading] = useState(false);
  const [kycLocationCoords, setKycLocationCoords] = useState("");
  const [kycSubmitting, setKycSubmitting] = useState(false);
  // ── Face capture state ──────────────────────────────────────────────────
  const [kycFaceVerified, setKycFaceVerified]   = useState(false);
  const [kycCameraActive, setKycCameraActive]   = useState(false);
  const [kycSelfie, setKycSelfie]               = useState<string | null>(null);
  const kycVideoRef  = useRef<HTMLVideoElement>(null);
  const kycCanvasRef = useRef<HTMLCanvasElement>(null);
  const kycStreamRef = useRef<MediaStream | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: verification, refetch: refetchVerification } = useQuery<any>({ queryKey: ["/api/verification/status"] });
  const { data: wallet, refetch: refetchWallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: deposits = [], refetch: refetchDeposits } = useQuery<DepositRecord[]>({ queryKey: ["/api/wallet/deposits"] });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });
  const { data: balances, refetch: refetchBalances } = useQuery<{
    bookBalance: string; availableBalance: string; confirmedBalance: string;
    minimumBalance: string; lockedBalance: string;
    pendingAmount: string; pendingCount: number; failedCount: number;
    tradeBalance: string; referralBalance: string; totalAffiliateBalance: string;
  }>({ queryKey: ["/api/wallet/balances"], staleTime: 30_000 });

  const balance         = parseFloat(wallet?.balance ?? "0");
  const availableBalance = parseFloat(balances?.availableBalance ?? "0");
  const bookBalance      = parseFloat(balances?.bookBalance ?? String(balance));
  const pendingAmount    = parseFloat(balances?.pendingAmount ?? "0");
  const pendingCount     = balances?.pendingCount ?? 0;
  const lockedBalance    = parseFloat(balances?.lockedBalance ?? "0");
  const tradeBalance     = parseFloat(balances?.tradeBalance ?? "0");
  const referralBalance  = parseFloat(balances?.referralBalance ?? "0");
  const totalAffiliate   = parseFloat(balances?.totalAffiliateBalance ?? "0");

  // ── Squad: load widget script ────────────────────────────────────────────
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
      s.onerror = () => reject(new Error("Could not load payment widget. Check your connection."));
      document.head.appendChild(s);
    });
  }, []);

  // ── Squad: open inline modal ─────────────────────────────────────────────
  const openSquadModal = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount", description: "Minimum funding is $1.", variant: "destructive" }); return; }
    setSquadLoading(true);
    try {
      await loadSquadScript();
      const res = await apiRequest("POST", "/api/wallet/squad/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { transactionRef, amountKobo, publicKey, email, firstName, lastName } = d as {
        transactionRef: string; amountKobo: number; publicKey: string; email: string; firstName: string; lastName: string;
      };
      const instance = new window.squad({
        key: publicKey, email, amount: amountKobo, currency_code: "NGN",
        transaction_ref: transactionRef,
        payment_channels: ["card", "bank", "ussd", "transfer"],
        metadata: { customer_name: `${firstName} ${lastName}`, platform: "TSIA" },
        onLoad: () => setSquadLoading(false),
        onClose: () => setSquadLoading(false),
        onSuccess: async (data: any) => {
          const ref = data?.transaction_ref ?? transactionRef;
          try {
            const vRes = await apiRequest("POST", "/api/wallet/squad/verify", { transactionRef: ref });
            const vd = await vRes.json();
            if (!vRes.ok) throw new Error(vd.message);
            toast({ title: "Wallet funded! 🎉", description: vd.message, className: "border-tsia-green" });
            refetchWallet(); refetchDeposits(); refetchBalances();
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            setFundOpen(false); setFundAmount("");
          } catch (ve: any) {
            toast({ title: "Payment received — verifying", description: "Your funds will be credited shortly.", variant: "destructive" });
          }
        },
      });
      instance.setup();
      instance.open();
    } catch (e: any) {
      setSquadLoading(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [fundAmount, loadSquadScript, toast, refetchWallet, refetchDeposits]);

  // ── Korapay: open checkout in new tab + poll for success ─────────────────
  const openKorapayCheckout = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount", description: "Minimum funding is $1.", variant: "destructive" }); return; }
    setKoraLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/korapay/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { checkoutUrl, reference } = d as { checkoutUrl: string; reference: string };
      const win = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      if (!win) { window.location.href = checkoutUrl; return; }
      toast({ title: "Korapay checkout opened", description: "Complete payment in the new tab, then return here.", className: "border-tsia-green" });
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
            refetchWallet(); refetchDeposits(); refetchBalances();
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

  const cryptoDepositMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(cryptoAmount);
      if (!amount || amount <= 5) throw new Error("Crypto deposit must be above $5");
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
      refetchDeposits();
      setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
      setFundOpen(false);
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

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

  const handleKycVerifyLocation = async () => {
    setKycLocationLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      setKycLocationCoords(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      setKycLocationVerified(true);
      toast({ title: "Location Verified ✓", className: "border-tsia-green" });
    } catch {
      toast({ title: "Location Denied", description: "Enable GPS and try again.", variant: "destructive" });
    } finally {
      setKycLocationLoading(false);
    }
  };

  const handleKycStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      kycStreamRef.current = stream;
      if (kycVideoRef.current) { kycVideoRef.current.srcObject = stream; kycVideoRef.current.play(); }
      setKycCameraActive(true);
    } catch {
      toast({ title: "Camera access denied", description: "Please allow camera access and try again.", variant: "destructive" });
    }
  };

  const handleKycCapture = () => {
    if (!kycVideoRef.current || !kycCanvasRef.current) return;
    const video = kycVideoRef.current; const canvas = kycCanvasRef.current;
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setKycSelfie(base64);
    kycStreamRef.current?.getTracks().forEach(t => t.stop());
    kycStreamRef.current = null;
    setKycCameraActive(false); setKycFaceVerified(true);
    toast({ title: "Selfie Captured ✓", className: "border-tsia-green" });
  };

  const handleKycRetake = async () => {
    setKycSelfie(null); setKycFaceVerified(false);
    await handleKycStartCamera();
  };

  const handleKycSubmit = async () => {
    if (!kycSelfie) {
      toast({ title: "Selfie required", description: "Please capture your selfie in Step 3.", variant: "destructive" }); return;
    }
    setKycSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/verification/wallet-kyc", { bvn: kycBvn, gpsCoords: kycLocationCoords, selfieBase64: kycSelfie });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      refetchVerification();
      toast({ title: "Wallet Activated ✓", description: "Your wallet is now fully unlocked!", className: "border-tsia-green" });
    } catch (e: any) {
      toast({ title: "Activation failed", description: e.message, variant: "destructive" });
    } finally {
      setKycSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-tsia-green" /> TSIA SwiftWallet
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

            {/* Step 3: Facial Biometric */}
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

      {/* Balance card */}
      <motion.div variants={itemVariants}>
        <div className="relative rounded-3xl overflow-hidden">
          {/* Student wallet card */}
          {walletView === "student" && (
            <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-6 pr-6">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
              <div className="absolute top-4 right-16 w-24 h-24 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 left-28 w-32 h-32 rounded-full bg-white/5" />

              <div className="relative z-10">
                {/* Row 1: wallet switcher + actions */}
                <div className="flex items-center justify-between mb-3">
                  {/* Wallet switcher dropdown */}
                  <div className="relative" data-wallet-switcher>
                    <button
                      onClick={() => setSwitcherOpen(p => !p)}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors"
                      data-testid="btn-wallet-switcher"
                    >
                      <Wallet className="w-3.5 h-3.5 text-white/80" />
                      <span className="text-white/90 text-[11px] font-semibold uppercase tracking-wider">Student Wallet</span>
                      <ChevronDown className="w-3 h-3 text-white/60" />
                    </button>
                    {switcherOpen && (
                      <div className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 min-w-[180px] overflow-hidden">
                        <button onClick={() => switchWallet("student")}
                          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          data-testid="btn-switch-student">
                          <div className="w-7 h-7 rounded-xl bg-tsia-green/10 flex items-center justify-center">
                            <Wallet className="w-3.5 h-3.5 text-tsia-green" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">Student Wallet</p>
                            <p className="text-[10px] text-muted-foreground">SwiftWallet · Fintech</p>
                          </div>
                          {walletView === "student" && <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green ml-auto" />}
                        </button>
                        <div className="h-px bg-border mx-3" />
                        <button onClick={() => switchWallet("affiliate")}
                          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          data-testid="btn-switch-affiliate">
                          <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">Affiliate Wallet</p>
                            <p className="text-[10px] text-muted-foreground">Trade · Referral</p>
                          </div>
                          {walletView === "affiliate" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-auto" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={toggleHidden} className="text-white/60 hover:text-white transition-colors p-1" data-testid="btn-toggle-balance">
                      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { refetchWallet(); refetchBalances(); }} className="text-white/60 hover:text-white transition-colors p-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Available balance — main display */}
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Available Balance</p>
                <p className="text-5xl font-black text-white tracking-tight mb-1" data-testid="text-wallet-balance">
                  {hidden ? <span className="tracking-[0.3em]">••••••</span> : `$${availableBalance.toFixed(2)}`}
                </p>
                {!hidden && (
                  <div className="mb-3 space-y-0.5">
                    <p className="text-white/60 text-sm font-semibold">
                      {currencyLoading
                        ? <span className="opacity-50 text-xs">detecting…</span>
                        : <>{formatAmount(availableBalance)} <span className="text-[10px] font-normal bg-white/10 px-1.5 py-0.5 rounded-full">{currency?.code ?? "NGN"}</span></>}
                    </p>
                    {!currencyLoading && (currency?.code ?? "NGN") !== "USD" && (
                      <p className="text-white/40 text-[11px] font-medium flex items-center gap-1.5" data-testid="text-vat-currency">
                        <span className="text-white/30">≈</span>
                        <span className="text-white/60 font-bold">{formatAmountVAT(availableBalance)}</span>
                        <span className="bg-amber-400/20 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full tracking-wide">incl. 7.5% VAT</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Balance breakdown row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/10 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <BookOpen className="w-3 h-3 text-white/60" />
                      <span className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">Book</span>
                    </div>
                    <p className="text-white text-xs font-bold" data-testid="text-book-balance">
                      {hidden ? "••••" : `$${bookBalance.toFixed(2)}`}
                    </p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${pendingCount > 0 ? "bg-amber-500/20" : "bg-white/10"}`}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Clock className="w-3 h-3 text-white/60" />
                      <span className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">Pending</span>
                    </div>
                    <p className={`text-xs font-bold ${pendingCount > 0 ? "text-amber-300" : "text-white"}`} data-testid="text-pending-balance">
                      {hidden ? "••••" : `$${pendingAmount.toFixed(2)}`}
                      {pendingCount > 0 && <span className="ml-1 text-[9px]">({pendingCount})</span>}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Lock className="w-3 h-3 text-white/60" />
                      <span className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">Reserved</span>
                    </div>
                    <p className="text-white text-xs font-bold" data-testid="text-locked-balance">
                      {hidden ? "••••" : `$${lockedBalance.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/20 rounded-xl px-3 py-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <p className="text-amber-200 text-[11px]">{pendingCount} deposit{pendingCount > 1 ? "s" : ""} awaiting gateway confirmation · <span className="font-bold">${pendingAmount.toFixed(2)}</span> in ledger</p>
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (!walletKycDone && needsKyc) {
                      toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification above to unlock funding.", variant: "destructive" }); return;
                    }
                    setFundAmount(""); setFundOpen(true);
                  }}
                  className="w-full h-11 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl"
                  data-testid="btn-fund-wallet"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                </Button>
              </div>
            </div>
          )}

          {/* Affiliate wallet card */}
          {walletView === "affiliate" && (
            <div className="bg-gradient-to-br from-[#78350f] via-[#92400e] to-[#451a03] p-6 pr-6">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
              <div className="absolute top-4 right-16 w-24 h-24 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 left-28 w-32 h-32 rounded-full bg-white/5" />

              <div className="relative z-10">
                {/* Row 1: wallet switcher + actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="relative" data-wallet-switcher>
                    <button
                      onClick={() => setSwitcherOpen(p => !p)}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors"
                      data-testid="btn-wallet-switcher-aff"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-white/80" />
                      <span className="text-white/90 text-[11px] font-semibold uppercase tracking-wider">Affiliate Wallet</span>
                      <ChevronDown className="w-3 h-3 text-white/60" />
                    </button>
                    {switcherOpen && (
                      <div className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 min-w-[180px] overflow-hidden">
                        <button onClick={() => switchWallet("student")}
                          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          data-testid="btn-switch-student-aff">
                          <div className="w-7 h-7 rounded-xl bg-tsia-green/10 flex items-center justify-center">
                            <Wallet className="w-3.5 h-3.5 text-tsia-green" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">Student Wallet</p>
                            <p className="text-[10px] text-muted-foreground">SwiftWallet · Fintech</p>
                          </div>
                        </button>
                        <div className="h-px bg-border mx-3" />
                        <button onClick={() => switchWallet("affiliate")}
                          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          data-testid="btn-switch-affiliate-aff">
                          <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">Affiliate Wallet</p>
                            <p className="text-[10px] text-muted-foreground">Trade · Referral</p>
                          </div>
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={toggleHidden} className="text-white/60 hover:text-white transition-colors p-1">
                      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => refetchBalances()} className="text-white/60 hover:text-white transition-colors p-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Total Affiliate Balance</p>
                <p className="text-5xl font-black text-white tracking-tight mb-1" data-testid="text-affiliate-balance">
                  {hidden ? <span className="tracking-[0.3em]">••••••</span> : `$${totalAffiliate.toFixed(2)}`}
                </p>
                {!hidden && (
                  <div className="mb-3 space-y-0.5">
                    <p className="text-white/60 text-sm font-semibold">
                      {currencyLoading
                        ? <span className="opacity-50 text-xs">detecting…</span>
                        : <>{formatAmount(totalAffiliate)} <span className="text-[10px] font-normal bg-white/10 px-1.5 py-0.5 rounded-full">{currency?.code ?? "NGN"}</span></>}
                    </p>
                    {!currencyLoading && (currency?.code ?? "NGN") !== "USD" && (
                      <p className="text-white/40 text-[11px] font-medium flex items-center gap-1.5">
                        <span className="text-white/30">≈</span>
                        <span className="text-white/60 font-bold">{formatAmountVAT(totalAffiliate)}</span>
                        <span className="bg-amber-400/20 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full tracking-wide">incl. 7.5% VAT</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Trade + Referral breakdown */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[10px] text-white/50 font-semibold uppercase">Trade Balance</span>
                    </div>
                    <p className="text-white text-sm font-bold" data-testid="text-trade-balance">
                      {hidden ? "••••" : `$${tradeBalance.toFixed(2)}`}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[10px] text-white/50 font-semibold uppercase">Referral</span>
                    </div>
                    <p className="text-white text-sm font-bold" data-testid="text-referral-balance">
                      {hidden ? "••••" : `$${referralBalance.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <p className="text-white/40 text-[10px] mb-4">Manage your trade and referral earnings in the Trade Market section</p>

                <Button
                  onClick={() => switchWallet("student")}
                  className="w-full h-11 bg-white text-amber-800 font-bold hover:bg-white/90 rounded-2xl"
                  data-testid="btn-switch-to-student"
                >
                  <Wallet className="w-4 h-4 mr-2" /> Switch to Student Wallet
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Payment method quick-access cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2">
        {[
          { icon: CreditCard, label: "Squad",   desc: "Card/USSD",   color: "text-tsia-green", bg: "bg-green-50 dark:bg-green-900/20",  method: "squad" as FundMethod },
          { icon: Building2,  label: "Korapay", desc: "Bank/Card",   color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", method: "korapay" as FundMethod },
          { icon: Smartphone, label: "Mobile",  desc: "All nets",    color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/20",    method: "squad" as FundMethod },
          { icon: Coins,      label: "Crypto",  desc: "USDT",        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-900/20",  method: "crypto" as FundMethod },
        ].map(({ icon: Icon, label, desc, color, bg, method }) => (
          <button
            key={label}
            onClick={() => {
              if (!walletKycDone && needsKyc) {
                toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification to unlock funding.", variant: "destructive" }); return;
              }
              setFundMethod(method);
              setFundAmount(""); setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
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
          {(["deposits","bills"] as const).map(tab => (
            <button key={tab} onClick={() => { setHistoryTab(tab); setDepositsPage(0); setBillsPage(0); }}
              className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
              {tab === "deposits" ? "Deposits" : "Bills"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {historyTab === "deposits" && (() => {
            const allDeps = deposits as DepositRecord[];
            if (allDeps.length === 0) return <Empty icon={ArrowDownLeft} msg="No deposits yet" />;
            const totalPages = Math.ceil(allDeps.length / WS_PAGE_SIZE);
            const page = allDeps.slice(depositsPage * WS_PAGE_SIZE, (depositsPage + 1) * WS_PAGE_SIZE);
            return (
              <>
                {page.map(d => (
                  <div key={d.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.status === "completed" ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                      {d.status === "completed"
                        ? <CheckCircle2 className="w-5 h-5 text-tsia-green" />
                        : <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm capitalize">
                        {d.walletType === "squad" ? "Squad (Card/Bank)" : d.walletType === "paystack" ? "Card/Bank" : d.walletType === "korapay" ? "Korapay" : d.walletType?.toUpperCase()} Deposit
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{d.txHash}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-tsia-green">+${parseFloat(d.amountUsd).toFixed(2)}</p>
                      <p className="text-[10px] text-tsia-green/70">{formatAmount(parseFloat(d.amountUsd))}</p>
                      <p className={`text-[10px] font-semibold capitalize ${d.status === "completed" ? "text-tsia-green" : "text-amber-500"}`}>{d.status}</p>
                    </div>
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setDepositsPage(p => Math.max(0, p - 1))} disabled={depositsPage === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                    <span className="text-xs text-muted-foreground">Page {depositsPage + 1} of {totalPages}</span>
                    <button onClick={() => setDepositsPage(p => Math.min(totalPages - 1, p + 1))} disabled={depositsPage >= totalPages - 1}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                  </div>
                )}
              </>
            );
          })()}

          {historyTab === "bills" && (() => {
            const allBills = bills as BillRecord[];
            if (allBills.length === 0) return <Empty icon={Receipt} msg="No bill payments yet" />;
            const totalPages = Math.ceil(allBills.length / WS_PAGE_SIZE);
            const page = allBills.slice(billsPage * WS_PAGE_SIZE, (billsPage + 1) * WS_PAGE_SIZE);
            return (
              <>
                {page.map(b => (
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
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setBillsPage(p => Math.max(0, p - 1))} disabled={billsPage === 0}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                    <span className="text-xs text-muted-foreground">Page {billsPage + 1} of {totalPages}</span>
                    <button onClick={() => setBillsPage(p => Math.min(totalPages - 1, p + 1))} disabled={billsPage >= totalPages - 1}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </motion.div>

      {/* ── FUND WALLET DIALOG ─────────────────────────────────────────── */}
      <Dialog open={fundOpen} onOpenChange={open => {
        setFundOpen(open);
        if (!open) { setFundAmount(""); setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20"); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-tsia-green" /> Fund Your Wallet
            </DialogTitle>
            <DialogDescription>Choose your preferred funding method below.</DialogDescription>
          </DialogHeader>

          {/* Method tabs */}
          <div className="flex bg-muted/40 rounded-2xl p-1 mb-1 gap-1">
            <button onClick={() => setFundMethod("squad")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "squad" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              data-testid="btn-fund-method-squad">
              <CreditCard className="w-3.5 h-3.5" /> Squad
            </button>
            <button onClick={() => setFundMethod("korapay")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "korapay" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              data-testid="btn-fund-method-korapay">
              <Building2 className="w-3.5 h-3.5" /> Korapay
            </button>
            <button onClick={() => setFundMethod("crypto")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              data-testid="btn-fund-method-crypto">
              <Coins className="w-3.5 h-3.5" /> Crypto
            </button>
          </div>

          {/* ── SQUAD TAB ── */}
          {fundMethod === "squad" && (
            <>
              <div className="space-y-4 py-2">
                <div className="flex gap-2 justify-center">
                  {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Transfer" }].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 bg-muted/50 rounded-xl p-2.5 flex-1">
                      <Icon className="w-5 h-5 text-tsia-green" />
                      <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <Label htmlFor="fund-amount-squad">Amount (USD)</Label>
                  <Input id="fund-amount-squad" type="number" min={1} step={0.01} placeholder="e.g. 10.00"
                    value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                    className="mt-1 text-lg font-bold" data-testid="input-fund-amount" />
                  {parseFloat(fundAmount) > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(fundAmount))} {rateLabel()}</p>
                      {(currency?.code ?? "NGN") !== "USD" && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          ≈ <span className="font-semibold">{formatAmountVAT(parseFloat(fundAmount))}</span>
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">incl. 7.5% VAT</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                  <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                  <p className="text-xs text-tsia-green">Secure inline checkout — card, bank transfer, USSD, and mobile money supported.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
                <Button onClick={openSquadModal}
                  disabled={squadLoading || !fundAmount || parseFloat(fundAmount) < 1}
                  className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-pay-squad">
                  {squadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Pay ${parseFloat(fundAmount || "0").toFixed(2)} via Squad
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── KORAPAY TAB ── */}
          {fundMethod === "korapay" && (
            <>
              <div className="space-y-4 py-2">
                <div className="flex gap-2 justify-center">
                  {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Virtual" }].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1 bg-muted/50 rounded-xl p-2.5 flex-1">
                      <Icon className="w-5 h-5 text-purple-600" />
                      <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <Label htmlFor="fund-amount-kora">Amount (USD)</Label>
                  <Input id="fund-amount-kora" type="number" min={1} step={0.01} placeholder="e.g. 10.00"
                    value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                    className="mt-1 text-lg font-bold" data-testid="input-fund-amount-korapay" />
                  {parseFloat(fundAmount) > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(fundAmount))} {rateLabel()}</p>
                      {(currency?.code ?? "NGN") !== "USD" && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          ≈ <span className="font-semibold">{formatAmountVAT(parseFloat(fundAmount))}</span>
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">incl. 7.5% VAT</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
                  <Shield className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-700 dark:text-purple-300">Opens in a new tab. Payment is auto-verified when complete.</p>
                </div>
                {koraLoading && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 rounded-xl p-3 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-tsia-green animate-spin shrink-0" />
                    <p className="text-xs font-semibold">Waiting for payment confirmation…</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
                <Button onClick={openKorapayCheckout}
                  disabled={koraLoading || !fundAmount || parseFloat(fundAmount) < 1}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold" data-testid="btn-pay-korapay">
                  {koraLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                  {koraLoading ? "Awaiting payment…" : `Pay $${parseFloat(fundAmount || "0").toFixed(2)} via Korapay`}
                </Button>
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
                  <Input id="crypto-amount" type="number" min={5.01} step={0.01} placeholder="Above $5.00"
                    value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)}
                    className="mt-1 text-lg font-bold" data-testid="input-crypto-amount" />
                  {parseFloat(cryptoAmount) > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(cryptoAmount))} {rateLabel()}</p>
                      {(currency?.code ?? "NGN") !== "USD" && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          ≈ <span className="font-semibold">{formatAmountVAT(parseFloat(cryptoAmount))}</span>
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">incl. 7.5% VAT</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* TxHash */}
                <div>
                  <Label htmlFor="crypto-txhash">Transaction Hash / ID</Label>
                  <Input id="crypto-txhash" placeholder="Paste your transaction hash here"
                    value={cryptoTxHash} onChange={e => setCryptoTxHash(e.target.value)}
                    className="mt-1 font-mono text-xs" data-testid="input-crypto-txhash" />
                  <p className="text-[11px] text-muted-foreground mt-1">Find this in your exchange/wallet after sending. Your wallet is credited instantly once submitted — no admin approval required.</p>
                </div>

                <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                  <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                  <p className="text-xs text-tsia-green">Above <strong>$5 USDT</strong>. Accepted via BYBIT, BINANCE, Coinbase and any compatible exchange wallet.</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
                <Button onClick={() => cryptoDepositMutation.mutate()}
                  disabled={cryptoDepositMutation.isPending || !cryptoAmount || parseFloat(cryptoAmount) <= 5 || !cryptoTxHash.trim()}
                  className="bg-tsia-green hover:bg-tsia-green/90 text-white font-bold" data-testid="btn-submit-crypto">
                  {cryptoDepositMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                  Submit Deposit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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

function Empty({ icon: Icon, msg }: { icon: any; msg: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <Icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
      {msg}
    </div>
  );
}
