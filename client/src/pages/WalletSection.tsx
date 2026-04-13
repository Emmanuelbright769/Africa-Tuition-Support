import { useState, useRef } from "react";
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
  MapPin, AlertTriangle, Lock, ChevronLeft, Camera, ScanFace, RotateCcw
} from "lucide-react";

import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { TermsCheckbox } from "@/components/ui/TermsCheckbox";

const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" }, { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" }, { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" }, { code: "214", name: "FCMB" },
  { code: "058", name: "GTBank" }, { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" }, { code: "090267", name: "Kuda Bank (MFB)" },
  { code: "100004", name: "OPay Digital Services" }, { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" }, { code: "232", name: "Sterling Bank" },
  { code: "100033", name: "PalmPay" }, { code: "50515", name: "Moniepoint MFB" },
  { code: "032", name: "Union Bank" }, { code: "033", name: "UBA" },
  { code: "035", name: "Wema Bank" }, { code: "057", name: "Zenith Bank" },
  { code: "566", name: "VFD Microfinance Bank" },
];

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

  // ── Withdrawal state ───────────────────────────────────────────────────
  const [withdrawChoiceOpen, setWithdrawChoiceOpen] = useState(false);
  const [cwOpen, setCwOpen]               = useState(false);
  const [cwNetwork, setCwNetwork]         = useState<"bep20" | "trc20">("bep20");
  const [cwAddress, setCwAddress]         = useState("");
  const [cwAmount, setCwAmount]           = useState("");
  const [cwSuccessOpen, setCwSuccessOpen] = useState(false);
  const [cwSuccessData, setCwSuccessData] = useState<{ amount: number; netAmount: number; fee: number; network: string } | null>(null);
  // OTP state
  const [cwOtpCode, setCwOtpCode]         = useState("");
  const [cwOtpSent, setCwOtpSent]         = useState(false);
  const [cwOtpLoading, setCwOtpLoading]   = useState(false);

  // ── History tab ────────────────────────────────────────────────────────
  const [historyTab, setHistoryTab] = useState<"deposits" | "sent" | "received" | "bills" | "withdrawals">("deposits");

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
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });
  const { data: withdrawals = [], refetch: refetchWithdrawals } = useQuery<any[]>({ queryKey: ["/api/wallet/withdrawals"] });

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

  const cryptoWithdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(cwAmount);
      if (!amount || amount < 1) throw new Error("Minimum withdrawal is $1");
      if (!cwAddress.trim()) throw new Error("USDT wallet address is required");
      if (!cwOtpCode.trim() || cwOtpCode.trim().length !== 6) throw new Error("Enter the 6-digit OTP sent to your email");
      const res = await apiRequest("POST", "/api/wallet/withdraw-crypto", { amount, network: cwNetwork, address: cwAddress.trim(), otpCode: cwOtpCode.trim() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (d: any) => {
      refetchWallet();
      refetchWithdrawals();
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setCwOpen(false);
      setCwSuccessData({ amount: d.amount, netAmount: d.netAmount ?? d.amount, fee: d.fee ?? 0, network: d.network });
      setCwSuccessOpen(true);
      setCwAmount(""); setCwAddress(""); setCwNetwork("bep20"); setCwOtpCode(""); setCwOtpSent(false);
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  const requestCwOtp = async () => {
    const amount = parseFloat(cwAmount);
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount first", variant: "destructive" }); return; }
    setCwOtpLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/withdrawal-otp/request", { amount, type: "crypto" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setCwOtpSent(true);
      toast({ title: "OTP Sent ✓", description: d.message, className: "border-tsia-green" });
    } catch (e: any) {
      toast({ title: "Could not send OTP", description: e.message, variant: "destructive" });
    } finally { setCwOtpLoading(false); }
  };

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
                {kycSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating…</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Complete Verification</>}
              </Button>
            )}
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
              <p className="text-white/50 text-xs mb-1">Available balance · 7.5% VAT on bank withdrawals · 1% fee on USDT crypto</p>
              <p className="text-white/40 text-[10px] mb-5">Minimum $2 must remain in wallet at all times for seamless operations</p>

              <div className="space-y-2">
                <Button
                  onClick={() => {
                    if (!walletKycDone && needsKyc) {
                      toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification above to unlock funding.", variant: "destructive" }); return;
                    }
                    setFundStep("amount"); setFundAmount(""); setPendingRef(""); setVerifyRef(""); setFundOpen(true);
                  }}
                  className="w-full h-12 bg-white text-[#1a5c38] font-bold hover:bg-white/90 rounded-2xl"
                  data-testid="btn-fund-wallet"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" /> Fund Wallet
                </Button>
                <Button
                  onClick={() => {
                    if (!walletKycDone && needsKyc) {
                      toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification above to unlock withdrawals.", variant: "destructive" }); return;
                    }
                    setWithdrawChoiceOpen(true);
                  }}
                  variant="outline"
                  className="w-full h-12 border-white/40 text-white hover:bg-white/10 rounded-2xl font-bold"
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
                toast({ title: "Wallet KYC Required", description: "Complete BVN and GPS verification to unlock funding.", variant: "destructive" }); return;
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
          {(["deposits","sent","received","bills","withdrawals"] as const).map(tab => (
            <button key={tab} onClick={() => setHistoryTab(tab)}
              className={`flex-1 py-2 rounded-xl font-semibold capitalize transition-all whitespace-nowrap px-2 ${historyTab === tab ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
              {tab === "sent" ? "Sent" : tab === "received" ? "Received" : tab === "deposits" ? "Deposits" : tab === "bills" ? "Bills" : "Withdrawals"}
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

          {historyTab === "withdrawals" && (
            withdrawals.length === 0
              ? <Empty icon={ArrowUpRight} msg="No withdrawals yet" />
              : withdrawals.slice(0, 15).map((w: any) => {
                  const isCrypto = w.type === "crypto_withdrawal";
                  // Extract network+address from description for crypto withdrawals
                  const networkMatch = isCrypto ? w.description?.match(/\(([^)]+?)\)/) : null;
                  const networkLabel = networkMatch ? networkMatch[1] : "";
                  const addrMatch = isCrypto ? w.description?.match(/to ([^\s|]+)/) : null;
                  const addrShort = addrMatch ? addrMatch[1] : "";
                  return (
                    <div key={w.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3" data-testid={`row-withdrawal-${w.id}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCrypto ? "bg-amber-50 dark:bg-amber-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                        {isCrypto ? <Coins className="w-5 h-5 text-amber-500" /> : <Banknote className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{isCrypto ? "Crypto Withdrawal" : "Bank Withdrawal"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isCrypto ? `${networkLabel} · ${addrShort}` : w.description?.split(" to ")[1]?.split(" —")[0] || ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-red-500">−${Math.abs(parseFloat(w.amount)).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground/70">{new Date(w.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                      </div>
                    </div>
                  );
                })
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

      {/* ══════════════════ WITHDRAW — STEP 1: CHOOSE METHOD ══════════════════ */}
      <Dialog open={withdrawChoiceOpen} onOpenChange={setWithdrawChoiceOpen}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !rounded-none !m-0 !p-0 !border-0 overflow-hidden bg-background">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#1a5c38] to-[#2d9d5c] px-6 pt-14 pb-8 text-white shrink-0">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Personal Wallet</p>
              <h2 className="text-3xl font-black">Withdraw Funds</h2>
              <p className="text-white/70 text-sm mt-1">Select your preferred withdrawal method</p>
            </div>

            {/* Options */}
            <div className="flex-1 px-5 py-8 space-y-4">
              {/* ── Bank Withdrawal — Coming Soon ── */}
              <div
                className="relative flex items-center gap-4 p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed select-none"
                data-testid="btn-choose-bank-withdraw"
              >
                <span className="absolute top-3 right-3 text-[9px] font-black bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Coming Soon
                </span>
                <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <Banknote className="w-8 h-8 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0 opacity-50">
                  <p className="font-black text-lg text-foreground leading-tight mb-1">Bank Withdrawal</p>
                  <p className="text-sm text-muted-foreground">NGN to Nigerian bank account</p>
                </div>
                <Lock className="w-5 h-5 text-slate-400 shrink-0 opacity-50" />
              </div>

              {/* ── USDT Crypto — Fully Active ── */}
              <button
                onClick={() => {
                  setWithdrawChoiceOpen(false);
                  setCwAmount(""); setCwAddress(""); setCwNetwork("bep20");
                  setCwOpen(true);
                }}
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
              <Button
                variant="outline"
                className="w-full h-14 text-base font-bold rounded-2xl"
                onClick={() => setWithdrawChoiceOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ WITHDRAW — STEP 2: CRYPTO FORM ══════════════════ */}
      <Dialog open={cwOpen} onOpenChange={v => { setCwOpen(v); if (!v) { setCwAmount(""); setCwAddress(""); setCwNetwork("bep20"); } }}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !rounded-none !m-0 !p-0 !border-0 overflow-hidden bg-background">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-6 pt-14 pb-6 text-white shrink-0">
            <button onClick={() => { setCwOpen(false); setWithdrawChoiceOpen(true); }}
              className="flex items-center gap-1 text-white/70 hover:text-white text-xs mb-3 transition-colors"
              data-testid="btn-back-to-choice">
              <ChevronLeft className="w-4 h-4" /> Back
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
            {/* Network Selector */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select Network</p>
              <div className="grid grid-cols-2 gap-2">
                {(["bep20", "trc20"] as const).map(n => (
                  <button key={n} onClick={() => { setCwNetwork(n); setCwAddress(""); }}
                    className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-center transition-all ${
                      cwNetwork === n
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-border hover:border-amber-400/50 bg-card"
                    }`}
                    data-testid={`btn-cw-network-${n}`}>
                    {cwNetwork === n && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 absolute top-2 right-2" />
                    )}
                    <span className={`text-sm font-black ${cwNetwork === n ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
                      {n === "bep20" ? "BEP20" : "TRC20"}
                    </span>
                    <span className={`text-[10px] font-medium ${cwNetwork === n ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {n === "bep20" ? "BSC Network" : "TRON Network"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                Only send to a <strong>{cwNetwork === "bep20" ? "BEP20/BSC" : "TRC20/TRON"}</strong> address. Wrong network = permanently lost funds.
              </p>
            </div>

            {/* Wallet Address */}
            <div>
              <Label htmlFor="cw-address" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your USDT Address ({cwNetwork === "bep20" ? "BEP20" : "TRC20"})
              </Label>
              <Input
                id="cw-address"
                placeholder={cwNetwork === "bep20" ? "0x… (starts with 0x)" : "T… (starts with T)"}
                value={cwAddress}
                onChange={e => setCwAddress(e.target.value)}
                className="mt-1.5 font-mono text-xs h-11 rounded-xl"
                data-testid="input-cw-address"
              />
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="cw-amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount (USD) — Balance: <span className="text-tsia-green font-bold">${balance.toFixed(2)}</span>
              </Label>
              <Input
                id="cw-amount"
                type="number"
                min={1}
                step={0.01}
                placeholder="Enter amount (min $1.00)"
                value={cwAmount}
                onChange={e => setCwAmount(e.target.value)}
                className="mt-1.5 text-xl font-black h-12 rounded-xl"
                data-testid="input-cw-amount"
              />
            </div>

            {/* Live fee breakdown — shown once amount is entered */}
            {parseFloat(cwAmount) > 0 && (() => {
              const amt = parseFloat(cwAmount);
              const fee = parseFloat((amt * 0.01).toFixed(2));
              const net = parseFloat((amt - fee).toFixed(2));
              const rem = balance - amt;
              const tooLow = rem < 2;
              return (
                <div className="rounded-2xl border bg-slate-50 dark:bg-slate-800/50 divide-y divide-border text-sm overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-muted-foreground">You send</span>
                    <span className="font-semibold">${amt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 text-red-500">
                    <span>Handling fee (1%)</span>
                    <span className="font-semibold">−${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 bg-tsia-green/5">
                    <span className="font-bold text-tsia-green">You receive (USDT)</span>
                    <span className="font-black text-tsia-green">${net.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between items-center px-4 py-2.5 ${tooLow ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                    <span className="text-muted-foreground text-xs">Wallet balance after</span>
                    <span className={`text-xs font-semibold ${tooLow ? "text-red-500" : "text-muted-foreground"}`}>
                      ${Math.max(0, rem).toFixed(2)}
                      {tooLow && " ⚠ min $2"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 24h info banner */}
            <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-3">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Withdrawals are processed manually by the TSIA team within <strong>24 hours</strong>. A <strong>1% handling fee</strong> is deducted — no VAT charged.
              </p>
            </div>

            {/* OTP Section */}
            <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-900/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Email OTP Required</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                An OTP will be sent to your registered email to authorise this withdrawal. Valid for 10 minutes.
              </p>
              <Button
                type="button" size="sm"
                className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm"
                onClick={requestCwOtp}
                disabled={cwOtpLoading || !cwAmount || parseFloat(cwAmount) < 1 || !cwAddress.trim()}
                data-testid="btn-cw-request-otp"
              >
                {cwOtpLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Sending…</> : cwOtpSent ? "Resend OTP" : "Send OTP to Email"}
              </Button>
              {cwOtpSent && (
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enter 6-Digit OTP</Label>
                  <Input
                    type="text" inputMode="numeric" maxLength={6} placeholder="e.g. 847291"
                    value={cwOtpCode} onChange={e => setCwOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="mt-1.5 h-12 text-center text-2xl font-black tracking-widest rounded-xl border-amber-300"
                    data-testid="input-cw-otp"
                  />
                </div>
              )}
            </div>

            {/* CTA */}
            <Button
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-base"
              onClick={() => cryptoWithdrawMutation.mutate()}
              disabled={
                cryptoWithdrawMutation.isPending ||
                !cwAmount || parseFloat(cwAmount) < 1 ||
                !cwAddress.trim() ||
                parseFloat(cwAmount) > balance ||
                (balance - parseFloat(cwAmount || "0")) < 2 ||
                cwOtpCode.length !== 6
              }
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

      {/* ── CRYPTO WITHDRAWAL SUCCESS DIALOG ─────────────────────────────── */}
      <Dialog open={cwSuccessOpen} onOpenChange={setCwSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-black">Withdrawal Received!</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {cwSuccessData?.network === "bep20" ? "BEP20/BSC" : "TRC20/TRON"} · Processing within 24 hours
              </p>
            </div>
            {/* Fee summary */}
            <div className="rounded-xl border bg-slate-50 dark:bg-slate-800/40 p-3 w-full space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Requested</span><span>${cwSuccessData?.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-500">
                <span>Handling fee (1%)</span><span>−${cwSuccessData?.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-tsia-green border-t pt-1.5">
                <span>You will receive (USDT)</span><span>${cwSuccessData?.netAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 w-full text-left">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">What happens next?</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 mt-2 space-y-1">
                <li>• TSIA ops team processes all crypto withdrawals within 24 hours</li>
                <li>• 1% handling fee deducted — no VAT applied</li>
                <li>• Check your wallet transaction history for status updates</li>
              </ul>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={() => setCwSuccessOpen(false)} data-testid="btn-cw-success-ok">
              Got it, thanks!
            </Button>
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
