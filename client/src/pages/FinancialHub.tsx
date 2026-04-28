import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Receipt, Wifi, Eye, EyeOff,
  ChevronRight, ArrowLeft, ArrowRight, Send, Bell, TrendingUp, TrendingDown,
  Loader2, CheckCircle2, X, Zap, Phone, Wallet, Gamepad2, Delete,
  Copy, Search, ChevronDown, AlertCircle, Users, Building2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type SendMode = "bank" | "tsia";
type View = "home" | "send" | "request" | "pay-bill" | "service" | "send-amount" | "tsia-amount" | "tsia-otp" | "receipt";
type ReceiptData = { txRef: string; txDate: string; amount: string; senderName: string; recipientName: string; walletLabel: string; note: string | null; newBalance: string };
type WalletData = { id: number; userId: number; balance: string };
type TransferRecord = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };
type Bank = { code: string; name: string };

// ─── Services ──────────────────────────────────────────────────────────────────
const SERVICES = [
  { id: "electricity", label: "Electricity", icon: Zap,      color: "from-yellow-400 to-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  { id: "internet",    label: "Internet",    icon: Wifi,      color: "from-blue-400 to-indigo-500",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "airtime",     label: "Airtime",     icon: Phone,     color: "from-emerald-400 to-teal-500",  bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { id: "betting",     label: "Betting",     icon: Gamepad2,  color: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
];

// ─── Nigerian Networks ────────────────────────────────────────────────────────
const NETWORKS = [
  { id: "mtn",     label: "MTN",     color: "bg-yellow-400",  text: "text-yellow-900" },
  { id: "airtel",  label: "Airtel",  color: "bg-red-500",     text: "text-white" },
  { id: "glo",     label: "Glo",     color: "bg-green-600",   text: "text-white" },
  { id: "9mobile", label: "9mobile", color: "bg-emerald-700", text: "text-white" },
];

// ─── Data Plans per network ───────────────────────────────────────────────────
const DATA_PLANS: Record<string, { id: string; label: string; validity: string; price: number }[]> = {
  mtn: [
    { id: "mtn_500mb", label: "500MB",  validity: "1 day",   price: 0.50 },
    { id: "mtn_1gb",   label: "1GB",    validity: "30 days", price: 1.00 },
    { id: "mtn_2gb",   label: "2GB",    validity: "30 days", price: 2.00 },
    { id: "mtn_5gb",   label: "5GB",    validity: "30 days", price: 4.50 },
    { id: "mtn_10gb",  label: "10GB",   validity: "30 days", price: 8.00 },
    { id: "mtn_20gb",  label: "20GB",   validity: "30 days", price: 14.00 },
  ],
  airtel: [
    { id: "airtel_500mb", label: "500MB",  validity: "1 day",   price: 0.50 },
    { id: "airtel_1gb",   label: "1.5GB",  validity: "30 days", price: 1.00 },
    { id: "airtel_2gb",   label: "3GB",    validity: "30 days", price: 2.00 },
    { id: "airtel_5gb",   label: "6GB",    validity: "30 days", price: 4.50 },
    { id: "airtel_10gb",  label: "10GB",   validity: "30 days", price: 8.00 },
    { id: "airtel_15gb",  label: "15GB",   validity: "30 days", price: 12.00 },
  ],
  glo: [
    { id: "glo_1gb",   label: "1GB",    validity: "30 days", price: 0.70 },
    { id: "glo_2gb",   label: "2.5GB",  validity: "30 days", price: 1.50 },
    { id: "glo_5gb",   label: "5GB",    validity: "30 days", price: 3.50 },
    { id: "glo_10gb",  label: "10GB",   validity: "30 days", price: 7.00 },
    { id: "glo_15gb",  label: "15GB",   validity: "30 days", price: 10.00 },
  ],
  "9mobile": [
    { id: "9m_500mb", label: "500MB",  validity: "30 days", price: 0.50 },
    { id: "9m_1gb",   label: "1GB",    validity: "30 days", price: 1.00 },
    { id: "9m_2gb",   label: "2GB",    validity: "30 days", price: 1.80 },
    { id: "9m_5gb",   label: "5GB",    validity: "30 days", price: 4.00 },
    { id: "9m_10gb",  label: "10GB",   validity: "30 days", price: 7.50 },
  ],
};

// ─── Electricity Discos ───────────────────────────────────────────────────────
const DISCOS = [
  { id: "EKEDC",  label: "Eko Electric",       area: "Lagos South" },
  { id: "IKEDC",  label: "Ikeja Electric",      area: "Lagos North" },
  { id: "AEDC",   label: "Abuja Electric",      area: "FCT & environs" },
  { id: "KEDCO",  label: "Kano Electric",       area: "Kano, Jigawa, Katsina" },
  { id: "PHEDC",  label: "Port Harcourt Elec.", area: "Rivers, Bayelsa" },
  { id: "IBEDC",  label: "Ibadan Electric",     area: "Oyo, Ogun, Osun, Kwara" },
  { id: "JEDC",   label: "Jos Electric",        area: "Plateau, Nassarawa, Benue" },
  { id: "BEDC",   label: "Benin Electric",      area: "Edo, Delta, Ekiti, Ondo" },
  { id: "EEDC",   label: "Enugu Electric",      area: "Enugu, Anambra, Imo, Ebonyi, Abia" },
  { id: "YEDC",   label: "Yola Electric",       area: "Adamawa, Taraba" },
  { id: "KAEDCO", label: "Kaduna Electric",     area: "Kaduna, Kebbi, Sokoto, Zamfara" },
];

// ─── Betting Platforms ────────────────────────────────────────────────────────
const BETTING_PLATFORMS = [
  { id: "bet9ja",    label: "Bet9ja",    color: "bg-green-800",  text: "text-white" },
  { id: "sportybet", label: "SportyBet", color: "bg-blue-700",   text: "text-white" },
  { id: "1xbet",     label: "1xBet",     color: "bg-slate-800",  text: "text-white" },
  { id: "parimatch", label: "Parimatch", color: "bg-yellow-500", text: "text-black" },
];

const AVATAR_COLORS = ["bg-rose-500","bg-purple-500","bg-teal-500","bg-amber-500","bg-blue-500","bg-pink-500"];
const fmt = (v: string | number) => { const n = parseFloat(String(v) || "0"); return isNaN(n) ? "0.00" : n.toFixed(2); };

// ─── Numpad ────────────────────────────────────────────────────────────────────
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handle = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1) || "0"); return; }
    if (k === "." && value.includes(".")) return;
    if (value === "0" && k !== ".") { onChange(k); return; }
    if (value.split(".")[1]?.length >= 2) return;
    onChange(value + k);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k, i) => (
        <button key={i} onClick={() => handle(k)}
          className={`h-14 rounded-2xl font-bold text-xl transition-all active:scale-95 ${k === "⌫" ? "bg-red-50 dark:bg-red-900/20 text-red-500" : "bg-muted/60 hover:bg-muted text-foreground"}`}
        >{k === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : k}</button>
      ))}
    </div>
  );
}

// ─── Back Header ──────────────────────────────────────────────────────────────
function BackHeader({ onBack, title, sub }: { onBack: () => void; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div>
        <h2 className="font-bold text-lg leading-tight">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function FinancialHub() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Per-user balance hidden pref
  const hiddenKey = `tsia_balance_hidden_${user?.id ?? "guest"}`;
  const [balanceHidden, setBalanceHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(hiddenKey) === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { setBalanceHidden(localStorage.getItem(hiddenKey) === "true"); } catch {}
  }, [hiddenKey]);
  const toggleHidden = () => setBalanceHidden(prev => {
    const next = !prev;
    try { localStorage.setItem(hiddenKey, String(next)); } catch {}
    return next;
  });

  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView]       = useState<View>("home");
  const [amount, setAmount]   = useState("0");
  const [note, setNote]       = useState("");
  const [activeTab, setActiveTab] = useState<"transfers" | "bills">("transfers");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ── Send-to-bank state ────────────────────────────────────────────────────
  const [sendMode, setSendMode]         = useState<SendMode>("bank");
  const [bankSearch, setBankSearch]     = useState("");
  const [bankDropOpen, setBankDropOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [acctNumber, setAcctNumber]     = useState("");
  const [resolving, setResolving]       = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveWarning, setResolveWarning] = useState(false);

  // ── Send-to-TSIA state ────────────────────────────────────────────────────
  const [tsiaEmail, setTsiaEmail]         = useState("");
  const [tsiaLooking, setTsiaLooking]     = useState(false);
  const [tsiaUser, setTsiaUser]           = useState<{ id: number; firstName: string; lastName: string; email: string; role?: string; isDual?: boolean; roles?: string[]; variants?: { id: number; role: string }[] } | null>(null);
  const [recipientRoleChoice, setRecipientRoleChoice] = useState<"student" | "affiliate">("student");
  const [memberSuggestions, setMemberSuggestions] = useState<{ id: number; firstName: string; lastName: string; email: string; role: string; isDual: boolean; roles: string[] }[]>([]);
  const [showSuggestions, setShowSuggestions]     = useState(false);

  // ── Transfer OTP state ───────────────────────────────────────────────────
  const [otpCode, setOtpCode]           = useState("");
  const [otpMaskedEmail, setOtpMaskedEmail] = useState("");
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  // ── Request Money state ──────────────────────────────────────────────────
  const [requestEmail, setRequestEmail] = useState("");
  const [requestNote, setRequestNote]   = useState("");

  // Debounced email autocomplete
  useEffect(() => {
    if (!tsiaEmail.trim() || tsiaUser) { setMemberSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/wallet/members-search?q=${encodeURIComponent(tsiaEmail.trim())}`);
        if (res.ok) { const data = await res.json(); setMemberSuggestions(data); setShowSuggestions(data.length > 0); }
      } catch {}
    }, 280);
    return () => clearTimeout(t);
  }, [tsiaEmail, tsiaUser]);

  // ── Bill state ────────────────────────────────────────────────────────────
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [billStep, setBillStep]               = useState<"details" | "amount" | "success">("details");
  const [billRef, setBillRef]                 = useState("");
  const [txResult, setTxResult]               = useState<{ ref: string; amountNgn: number; token?: string; message: string } | null>(null);
  // Airtime
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  // Internet
  const [selectedISP, setSelectedISP]         = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan]       = useState<typeof DATA_PLANS["mtn"][0] | null>(null);
  // Electricity
  const [selectedDisco, setSelectedDisco]     = useState<typeof DISCOS[0] | null>(null);
  const [meterType, setMeterType]             = useState<"prepaid" | "postpaid" | null>(null);
  const [discoSearch, setDiscoSearch]         = useState("");
  const [elecPhone, setElecPhone]             = useState("");
  // Betting
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: wallet }         = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: txHistory = [] } = useQuery<any[]>({ queryKey: ["/api/transactions"] });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });
  const { data: banks = [] }     = useQuery<Bank[]>({ queryKey: ["/api/wallet/banks"] });

  const balance  = parseFloat(wallet?.balance ?? "0");
  const totalIn  = (txHistory as any[]).filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = Math.abs((txHistory as any[]).filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + parseFloat(t.amount), 0));

  const recentRecipients = Array.from(
    new Map((transfers as TransferRecord[]).map(t => [t.recipientId, t])).values()
  ).slice(0, 5);

  const filteredBanks = (banks as Bank[]).filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const filteredDiscos = DISCOS.filter(d => d.label.toLowerCase().includes(discoSearch.toLowerCase()) || d.area.toLowerCase().includes(discoSearch.toLowerCase()));

  // ── Auto-resolve bank account ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedBank || acctNumber.length !== 10) {
      setResolvedName(null); setResolveError(null); setResolveWarning(false); return;
    }
    let cancelled = false;
    setResolving(true);
    setResolvedName(null); setResolveError(null); setResolveWarning(false);
    apiRequest("POST", "/api/wallet/resolve-bank", { accountNumber: acctNumber, bankCode: selectedBank.code })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.accountName) {
          setResolvedName(d.accountName);
        } else if (d.unverified) {
          setResolveWarning(true);
          setResolvedName(d.message || "Could not verify — double-check before sending");
        } else if (d.accountNotFound) {
          setResolveError(d.message || "Account not found. Check the number and bank.");
        } else {
          setResolveError(d.message || "Could not verify account");
        }
      })
      .catch(() => { if (!cancelled) { setResolveWarning(true); setResolvedName("Could not verify — double-check details before sending"); } })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
  }, [selectedBank, acctNumber]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendBankMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fintech/bank-transfer", {
        bankCode: selectedBank!.code,
        bankName: selectedBank!.name,
        accountNumber: acctNumber,
        accountName: resolvedName || acctNumber,
        amount: parseFloat(amount),
        narration: note || undefined,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Transfer Initiated ✓", description: data.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setView("home"); resetSend();
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const requestTransferOtpMutation = useMutation({
    mutationFn: async () => {
      if (!tsiaUser) throw new Error("No recipient selected");
      const res = await apiRequest("POST", "/api/wallet/transfer-otp/request", {
        amount: parseFloat(amount),
        recipientName: `${tsiaUser.firstName} ${tsiaUser.lastName}`.trim(),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      setOtpMaskedEmail(data.message?.replace("OTP sent to ", "") ?? "");
      setOtpCode("");
      setOtpResendCooldown(60);
      setView("tsia-otp");
    },
    onError: (e: any) => toast({ title: "Could not send OTP", description: e.message, variant: "destructive" }),
  });

  const sendTsiaMutation = useMutation({
    mutationFn: async () => {
      if (!tsiaUser) throw new Error("No recipient selected");
      const payload: Record<string, unknown> = { recipientId: tsiaUser.id, amount: parseFloat(amount), note, otpCode };
      // If dual-account member, pass email + chosen role so backend can route to correct wallet
      if (tsiaUser.isDual && tsiaUser.email) {
        payload.recipientEmail = tsiaUser.email;
        payload.recipientRole  = recipientRoleChoice;
      }
      const res = await apiRequest("POST", "/api/wallet/send", payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      if (data.receipt) {
        setReceiptData(data.receipt);
        setView("receipt");
      } else {
        toast({ title: "Money sent! ✓", description: data.message, className: "border-tsia-green" });
        setView("home"); resetSend();
      }
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const requestMutation = useMutation({
    mutationFn: async ({ email, amount: amt, reqNote }: { email: string; amount: string; reqNote: string }) => {
      const res = await apiRequest("POST", "/api/fintech/request-money", { email: email.trim(), amount: parseFloat(amt), note: reqNote || undefined });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Request sent! ✓", description: data.message, className: "border-tsia-green" });
      setView("home"); setAmount("0"); setNote("");
    },
    onError: (e: any) => toast({ title: "Request failed", description: e.message, variant: "destructive" }),
  });

  const billMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) throw new Error("No service selected");
      let endpoint = "/api/wallet/bill";
      let payload: Record<string, any> = {};

      if (selectedService.id === "airtime") {
        endpoint = "/api/fintech/airtime";
        payload = { network: selectedNetwork, phone: billRef, amount: parseFloat(amount) };
      } else if (selectedService.id === "internet") {
        endpoint = "/api/fintech/data";
        payload = { network: selectedISP, phone: billRef, amount: parseFloat(amount), planLabel: selectedPlan?.label, planValidity: selectedPlan?.validity };
      } else if (selectedService.id === "electricity") {
        endpoint = "/api/fintech/electricity";
        payload = { discoCode: selectedDisco?.id, meterType, meterNumber: billRef, amount: parseFloat(amount), phone: elecPhone || undefined };
      } else if (selectedService.id === "betting") {
        endpoint = "/api/fintech/betting";
        payload = { platform: selectedPlatform, bettingUserId: billRef, amount: parseFloat(amount) };
      }

      const res = await apiRequest("POST", endpoint, payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      setTxResult({ ref: data.reference, amountNgn: data.amountNgn, token: data.token, message: data.message });
      setBillStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (e: any) => toast({ title: "Payment failed", description: e.message, variant: "destructive" }),
  });

  // OTP resend countdown
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setTimeout(() => setOtpResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendCooldown]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetSend = () => {
    setAmount("0"); setNote(""); setSendMode("bank"); setBankSearch(""); setSelectedBank(null);
    setAcctNumber(""); setResolvedName(null); setResolveError(null); setResolveWarning(false);
    setTsiaEmail(""); setTsiaUser(null); setRecipientRoleChoice("student");
    setOtpCode(""); setOtpMaskedEmail(""); setOtpResendCooldown(0);
  };
  const resetBill = () => {
    setAmount("0"); setBillRef(""); setSelectedService(null); setBillStep("details");
    setSelectedNetwork(null); setSelectedISP(null); setSelectedPlan(null);
    setSelectedDisco(null); setMeterType(null); setSelectedPlatform(null);
    setElecPhone(""); setTxResult(null);
  };

  const lookupTsia = async () => {
    if (!tsiaEmail.trim()) return;
    setTsiaLooking(true); setTsiaUser(null);
    try {
      const res = await apiRequest("POST", "/api/wallet/lookup-email", { email: tsiaEmail.trim() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setTsiaUser(d);
      // Auto-select student role by default if dual-account member
      if (d.isDual) setRecipientRoleChoice("student");
      else setRecipientRoleChoice(d.role === "affiliate" ? "affiliate" : "student");
    } catch (e: any) { toast({ title: "Not found", description: e.message, variant: "destructive" }); }
    finally { setTsiaLooking(false); }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "home") return (
    <div className="space-y-6">
      {/* Swift Hub branded header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-tsia-green flex flex-col items-center justify-center shadow-md shrink-0">
          <span className="text-white font-black text-sm tracking-tighter leading-none">SH</span>
          <span className="text-tsia-gold text-[7px] font-bold tracking-widest uppercase mt-0.5">Hub</span>
        </div>
        <div>
          <p className="font-black text-lg leading-none text-tsia-green tracking-tight">Swift Hub</p>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5 tracking-wide">TSIA · Financial Centre</p>
        </div>
      </div>

      {/* Greeting — only on home */}
      <div>
        <h2 className="text-2xl font-bold">Hello, {user?.firstName} 👋</h2>
        <p className="text-muted-foreground text-sm">Send money, pay bills &amp; manage transfers</p>
      </div>

      {/* Balance Card */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-6 pr-20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 left-24 w-28 h-28 rounded-full bg-white/5" />
          <div className="relative z-10">
            <p className="text-white/60 text-[10px] font-medium mb-0.5 uppercase tracking-widest">TSIA Bank • Wallet Balance</p>
            <div className="flex items-end gap-2 mb-3">
              <p className="text-4xl font-black text-white tracking-tight">{balanceHidden ? "••••••" : `$${balance.toFixed(2)}`}</p>
              <button onClick={toggleHidden} className="mb-1 text-white/60 hover:text-white transition-colors" data-testid="btn-toggle-balance">
                {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><TrendingDown className="w-4 h-4 text-white" /></div>
                <div><p className="text-white/60 text-[10px]">Income</p><p className="text-white font-bold text-sm">{balanceHidden ? "••••" : `$${totalIn.toFixed(2)}`}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-white" /></div>
                <div><p className="text-white/60 text-[10px]">Expense</p><p className="text-white font-bold text-sm">{balanceHidden ? "••••" : `$${totalOut.toFixed(2)}`}</p></div>
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => toast({ title: "Add money", description: "Go to Digital Wallet → Deposit to fund via USDT." })}
          className="absolute right-0 top-0 h-full w-16 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-white/30 bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="btn-add-money">
          <span className="text-white text-2xl font-black">+</span>
          <p className="text-white text-[9px] font-bold tracking-wider" style={{ writingMode: "vertical-rl" }}>ADD MONEY</p>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Send,      label: "Send",     color: "bg-tsia-green", action: () => { resetSend(); setView("send"); } },
          { icon: RefreshCw, label: "Transfer", color: "bg-blue-500",   action: () => { resetSend(); setView("send"); } },
          { icon: Bell,      label: "Request",  color: "bg-violet-500", action: () => setView("request") },
          { icon: Receipt,   label: "Pay Bill", color: "bg-amber-500",  action: () => { resetBill(); setView("pay-bill"); } },
        ].map(({ icon: Icon, label, color, action }) => (
          <button key={label} onClick={action} className="flex flex-col items-center gap-2 group" data-testid={`btn-quick-${label.toLowerCase().replace(" ","-")}`}>
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform group-active:scale-95`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* Recent Recipients */}
      {recentRecipients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Recent</h3>
            <button className="text-xs text-tsia-green font-semibold flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {recentRecipients.map((t, i) => (
              <button key={t.recipientId} onClick={() => { resetSend(); setSendMode("tsia"); setTsiaUser({ id: t.recipientId, firstName: t.recipientName?.split(" ")[0] || "User", lastName: t.recipientName?.split(" ")[1] || "", email: "" }); setView("tsia-amount"); }}
                className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`w-14 h-14 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-xl ring-2 ring-offset-2 ring-tsia-green/30`}>
                  {(t.recipientName ?? "?")[0].toUpperCase()}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[56px]">{t.recipientName?.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      <div>
        <h3 className="font-bold text-sm mb-3">Quick Services</h3>
        <div className="grid grid-cols-4 gap-3">
          {SERVICES.map(svc => (
            <button key={svc.id} onClick={() => { resetBill(); setSelectedService(svc); setView("service"); }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl ${svc.bg} hover:shadow-md transition-shadow`} data-testid={`btn-service-${svc.id}`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                <svc.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">{svc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">History</h3>
          <div className="flex bg-muted/40 rounded-xl p-0.5 text-xs">
            <button onClick={() => setActiveTab("transfers")} className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "transfers" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Transfers</button>
            <button onClick={() => setActiveTab("bills")}     className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "bills"     ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Bills</button>
          </div>
        </div>
        <div className="space-y-2">
          {activeTab === "transfers" ? (
            (transfers as TransferRecord[]).length === 0
              ? <EmptyState icon={Send} msg="No transfers yet" />
              : (transfers as TransferRecord[]).slice(0, 8).map(t => {
                  const isOut = t.senderId === user?.id;
                  return (
                    <div key={t.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOut ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                        {isOut ? <ArrowUpRight className="w-5 h-5 text-red-500" /> : <ArrowDownLeft className="w-5 h-5 text-tsia-green" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{isOut ? `To ${t.recipientName || "User"}` : `From ${t.senderName || "User"}`}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.note || (isOut ? "Money sent" : "Money received")}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${isOut ? "text-red-500" : "text-tsia-green"}`}>{isOut ? "−" : "+"}${parseFloat(t.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                      </div>
                    </div>
                  );
                })
          ) : (
            (bills as BillRecord[]).length === 0
              ? <EmptyState icon={Receipt} msg="No bill payments yet" />
              : (bills as BillRecord[]).slice(0, 8).map(b => {
                  const svc = SERVICES.find(s => s.id === b.service) || SERVICES[0];
                  const isBankTransfer = b.service === "bank_transfer";
                  return (
                    <div key={b.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                      <div className={`w-10 h-10 rounded-xl ${isBankTransfer ? "bg-blue-100 dark:bg-blue-900/30" : `bg-gradient-to-br ${svc.color}`} flex items-center justify-center`}>
                        {isBankTransfer ? <Building2 className="w-5 h-5 text-blue-600" /> : <svc.icon className="w-5 h-5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm capitalize">{isBankTransfer ? "Bank Transfer" : svc.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.reference}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-red-500">−${parseFloat(b.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                      </div>
                    </div>
                  );
                })
          )}
        </div>
      </div>
    </div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // SEND MONEY — Bank or TSIA selector
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "send") return (
    <AnimatePresence mode="wait">
      <motion.div key="send" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}>
        <BackHeader onBack={() => { setView("home"); resetSend(); }} title="Send Money" />

        {/* Mode tabs */}
        <div className="flex bg-muted/40 rounded-2xl p-1 mb-5">
          <button onClick={() => setSendMode("bank")} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${sendMode === "bank" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
            <Building2 className="w-4 h-4" /> Bank Account
          </button>
          <button onClick={() => setSendMode("tsia")} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${sendMode === "tsia" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
            <Users className="w-4 h-4" /> TSIA Member
          </button>
        </div>

        {sendMode === "bank" ? (
          <div className="space-y-4">
            {/* Bank picker */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Select Bank</label>
              <div className="relative">
                <button onClick={() => setBankDropOpen(o => !o)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-colors ${selectedBank ? "border-tsia-green bg-card" : "border-border bg-muted/30"}`}>
                  <span className={selectedBank ? "font-semibold text-foreground" : "text-muted-foreground text-sm"}>{selectedBank?.name || "Choose bank"}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {bankDropOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-card border rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b">
                      <div className="flex items-center gap-2 px-2">
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input autoFocus placeholder="Search bank..." value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm focus:outline-none py-1" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredBanks.map(b => (
                        <button key={b.code} onClick={() => { setSelectedBank(b); setBankDropOpen(false); setBankSearch(""); setAcctNumber(""); setResolvedName(null); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors font-medium">{b.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account number */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Account Number</label>
              <input
                type="tel" maxLength={10} placeholder="Enter 10-digit account number"
                value={acctNumber} onChange={e => setAcctNumber(e.target.value.replace(/\D/g,"").slice(0,10))}
                disabled={!selectedBank}
                className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-mono tracking-[0.2em] focus:outline-none focus:border-tsia-green disabled:opacity-40 bg-background transition-colors"
                data-testid="input-acct-number"
              />
            </div>

            {/* Resolve result */}
            <div className="min-h-[44px] flex items-center justify-center">
              {resolving && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying account...
                </div>
              )}
              {!resolving && resolvedName && !resolveError && (
                <div className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl border ${resolveWarning ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300" : "bg-green-50 dark:bg-green-900/20 border-tsia-green/30"}`}>
                  {resolveWarning
                    ? <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-tsia-green shrink-0" />}
                  <span className={`font-bold text-sm ${resolveWarning ? "text-amber-700" : "text-tsia-green"}`}>{resolvedName}</span>
                </div>
              )}
              {!resolving && resolveError && (
                <div className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-600 font-medium">{resolveError}</span>
                </div>
              )}
            </div>

            <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl"
              disabled={!selectedBank || acctNumber.length !== 10 || !!resolveError || resolving}
              onClick={() => { setAmount("0"); setView("send-amount"); }}
              data-testid="btn-continue-bank"
            >Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        ) : (
          /* TSIA Member */
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Email Address</label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    placeholder="Start typing a member's email…"
                    value={tsiaEmail}
                    onChange={e => { setTsiaEmail(e.target.value); setTsiaUser(null); }}
                    onKeyDown={e => { if (e.key === "Enter") { setShowSuggestions(false); lookupTsia(); } if (e.key === "Escape") setShowSuggestions(false); }}
                    onFocus={() => { if (memberSuggestions.length > 0) setShowSuggestions(true); }}
                    className="flex-1 border-2 border-border rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-tsia-green bg-background"
                    autoComplete="off"
                    data-testid="input-tsia-email"
                  />
                  <button onClick={() => { setShowSuggestions(false); lookupTsia(); }} disabled={tsiaLooking || !tsiaEmail.trim()}
                    className="w-12 h-12 bg-tsia-green text-white rounded-2xl flex items-center justify-center disabled:opacity-40 mt-0.5">
                    {tsiaLooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>

                {/* Autocomplete dropdown */}
                {showSuggestions && memberSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-12 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                    {memberSuggestions.map(m => {
                      const accountLabel = m.isDual ? "Student + Affiliate" : m.role === "affiliate" ? "Affiliate" : "Student";
                      const accountColor = m.isDual ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                        m.role === "affiliate" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
                      const avatarColor = m.isDual ? "bg-purple-600" : m.role === "affiliate" ? "bg-amber-600" : "bg-tsia-green";
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setTsiaEmail(m.email);
                            setShowSuggestions(false);
                            setMemberSuggestions([]);
                            setTsiaUser(m);
                            // Auto-select role intelligently
                            if (m.isDual) setRecipientRoleChoice("student");
                            else setRecipientRoleChoice(m.role === "affiliate" ? "affiliate" : "student");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0"
                          data-testid={`suggestion-member-${m.id}`}
                        >
                          <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                            {m.firstName[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{m.firstName} {m.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${accountColor}`}>
                            {m.isDual ? "🎓+🤝" : m.role === "affiliate" ? "🤝 Affiliate" : "🎓 Student"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {tsiaUser && (
              <div className="space-y-3">
                {/* Recipient profile card */}
                <div className={`flex items-center gap-3 rounded-2xl p-4 border ${
                  tsiaUser.isDual ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300" :
                  tsiaUser.role === "affiliate" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300" :
                  "bg-green-50 dark:bg-green-900/20 border-tsia-green/30"
                }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-black ${
                    tsiaUser.isDual ? "bg-purple-600" :
                    tsiaUser.role === "affiliate" ? "bg-amber-600" : "bg-tsia-green"
                  }`}>
                    {tsiaUser.firstName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{tsiaUser.firstName} {tsiaUser.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{tsiaUser.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {tsiaUser.isDual ? (
                        <>
                          <span className="text-[10px] font-bold bg-tsia-green/10 text-tsia-green px-2 py-0.5 rounded-full">🎓 Student</span>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🤝 Affiliate</span>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Dual Account</span>
                        </>
                      ) : tsiaUser.role === "affiliate" ? (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🤝 Affiliate Account</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-tsia-green/10 text-tsia-green px-2 py-0.5 rounded-full">🎓 Student Account</span>
                      )}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-tsia-green shrink-0" />
                </div>

                {/* Wallet destination selector — always visible */}
                <div className="rounded-2xl border border-border p-4 space-y-2.5 bg-muted/30">
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <ArrowRight className="w-3.5 h-3.5" />
                    Send to wallet
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Student button */}
                    {(() => {
                      const hasStudent = tsiaUser.isDual || (tsiaUser.roles ?? [tsiaUser.role]).includes("student");
                      return (
                        <button
                          onClick={() => hasStudent && setRecipientRoleChoice("student")}
                          disabled={!hasStudent}
                          data-testid="btn-wallet-student"
                          className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all ${
                            recipientRoleChoice === "student" && hasStudent
                              ? "bg-tsia-green text-white border-tsia-green shadow-md"
                              : hasStudent
                                ? "bg-background text-foreground border-border hover:border-tsia-green/50"
                                : "bg-muted/50 text-muted-foreground border-border opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                          <span className="text-[11px] font-bold leading-tight text-center">Student<br/>Wallet</span>
                          {recipientRoleChoice === "student" && hasStudent && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" />
                            </span>
                          )}
                          {!hasStudent && <span className="text-[9px] opacity-60">(not available)</span>}
                        </button>
                      );
                    })()}

                    {/* Affiliate button */}
                    {(() => {
                      const hasAffiliate = tsiaUser.isDual || (tsiaUser.roles ?? [tsiaUser.role]).includes("affiliate");
                      return (
                        <button
                          onClick={() => hasAffiliate && setRecipientRoleChoice("affiliate")}
                          disabled={!hasAffiliate}
                          data-testid="btn-wallet-affiliate"
                          className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all ${
                            recipientRoleChoice === "affiliate" && hasAffiliate
                              ? "bg-amber-600 text-white border-amber-600 shadow-md"
                              : hasAffiliate
                                ? "bg-background text-foreground border-border hover:border-amber-400/50"
                                : "bg-muted/50 text-muted-foreground border-border opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <Users className="w-5 h-5" />
                          <span className="text-[11px] font-bold leading-tight text-center">Affiliate<br/>Wallet</span>
                          {recipientRoleChoice === "affiliate" && hasAffiliate && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                            </span>
                          )}
                          {!hasAffiliate && <span className="text-[9px] opacity-60">(not available)</span>}
                        </button>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {recipientRoleChoice === "student"
                      ? "💸 Money will credit their Student Dashboard wallet"
                      : "💸 Money will credit their Affiliate Dashboard wallet"}
                  </p>
                </div>
              </div>
            )}

            {/* Recent TSIA recipients */}
            {recentRecipients.length > 0 && !tsiaUser && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Recent</p>
                <div className="space-y-2">
                  {recentRecipients.slice(0, 3).map((t, i) => (
                    <button key={t.recipientId} onClick={() => { setTsiaUser({ id: t.recipientId, firstName: t.recipientName?.split(" ")[0] || "User", lastName: t.recipientName?.split(" ")[1] || "", email: "" }); }}
                      className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:border-tsia-green/40 transition-colors">
                      <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0`}>
                        {(t.recipientName ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-sm">{t.recipientName}</p>
                        <p className="text-xs text-muted-foreground">TSIA member</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl"
              disabled={!tsiaUser} onClick={() => { setAmount("0"); setView("tsia-amount"); }}
              data-testid="btn-continue-tsia"
            >Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // SEND TO BANK — Amount screen
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "send-amount") return (
    <AnimatePresence mode="wait">
      <motion.div key="send-amount" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
        <BackHeader onBack={() => setView("send")} title="Enter Amount" sub={`To ${resolvedName ?? acctNumber} • ${selectedBank?.name}`} />

        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-2xl px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Recipient</p>
            <p className="font-bold text-sm">{resolvedName ?? "Unverified"}</p>
            <p className="text-xs text-muted-foreground font-mono">{acctNumber} • {selectedBank?.name}</p>
          </div>
          {resolveWarning
            ? <AlertCircle className="w-5 h-5 text-amber-500" />
            : <CheckCircle2 className="w-5 h-5 text-tsia-green" />}
        </div>

        <div className="text-center py-2">
          <div className="text-5xl font-black">${fmt(amount)}</div>
          <p className="text-xs text-muted-foreground mt-1">Available: ${balance.toFixed(2)}</p>
          {parseFloat(amount) > balance && <p className="text-xs text-red-500 font-semibold mt-1">Exceeds your balance</p>}
        </div>

        <input placeholder="Narration (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-tsia-green/40"
          data-testid="input-narration" />

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
          <Button className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
            disabled={sendBankMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            onClick={() => sendBankMutation.mutate()} data-testid="btn-send-bank">
            {sendBankMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            Send ${fmt(amount)}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // SEND TO TSIA — Amount screen
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "tsia-amount" && tsiaUser) return (
    <AnimatePresence mode="wait">
      <motion.div key="tsia-amount" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
        <BackHeader onBack={() => setView("send")} title="Enter Amount" sub="Transfer to TSIA member" />

        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 rounded-2xl p-4">
          <div className="w-12 h-12 rounded-full bg-tsia-green flex items-center justify-center text-white text-xl font-black">
            {tsiaUser.firstName[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold">{tsiaUser.firstName} {tsiaUser.lastName}</p>
            {tsiaUser.email && <p className="text-xs text-muted-foreground">{tsiaUser.email}</p>}
          </div>
          <div className="flex items-center gap-1 text-tsia-green"><CheckCircle2 className="w-4 h-4" /><span className="text-xs font-bold">TSIA</span></div>
        </div>

        <div className="text-center py-2">
          <div className="text-5xl font-black">${fmt(amount)}</div>
          <p className="text-xs text-muted-foreground mt-1">Available: ${balance.toFixed(2)}</p>
          {parseFloat(amount) > balance && <p className="text-xs text-red-500 font-semibold mt-1">Exceeds your balance</p>}
        </div>

        <input placeholder="What's this for? (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-tsia-green/40"
          data-testid="input-tsia-note" />

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
          <Button className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
            disabled={requestTransferOtpMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            onClick={() => requestTransferOtpMutation.mutate()} data-testid="btn-send-tsia">
            {requestTransferOtpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            Continue — ${fmt(amount)}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // TSIA TRANSFER — OTP confirmation screen
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "tsia-otp" && tsiaUser) return (
    <AnimatePresence mode="wait">
      <motion.div key="tsia-otp" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
        <BackHeader onBack={() => setView("tsia-amount")} title="Confirm Transfer" sub="Enter the code sent to your email" />

        {/* Transfer summary */}
        <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-black text-tsia-green text-lg">${fmt(amount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="font-semibold">{tsiaUser.firstName} {tsiaUser.lastName}</span>
          </div>
          {note && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Note</span>
              <span className="text-foreground">{note}</span>
            </div>
          )}
        </div>

        {/* OTP notice */}
        <div className="rounded-2xl bg-muted/50 border border-border p-4 text-center space-y-1">
          <p className="text-sm font-semibold">Security code sent</p>
          <p className="text-xs text-muted-foreground">
            A 6-digit code was sent to <strong>{otpMaskedEmail}</strong>.{" "}
            It expires in 10 minutes.
          </p>
        </div>

        {/* OTP digit input */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Enter 6-digit OTP</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="— — — — — —"
            value={otpCode}
            onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full text-center text-3xl font-black tracking-[0.4em] border-2 border-border rounded-2xl px-4 py-4 bg-background focus:outline-none focus:border-tsia-green"
            data-testid="input-transfer-otp"
          />
        </div>

        {/* Resend */}
        <p className="text-center text-xs text-muted-foreground">
          Didn't receive it?{" "}
          {otpResendCooldown > 0 ? (
            <span className="font-semibold text-muted-foreground">Resend in {otpResendCooldown}s</span>
          ) : (
            <button
              className="font-semibold text-tsia-green underline underline-offset-2"
              onClick={() => requestTransferOtpMutation.mutate()}
              disabled={requestTransferOtpMutation.isPending}
              data-testid="btn-resend-transfer-otp"
            >
              {requestTransferOtpMutation.isPending ? "Sending…" : "Resend code"}
            </button>
          )}
        </p>

        {/* Confirm */}
        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
          <Button
            className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
            disabled={sendTsiaMutation.isPending || otpCode.length !== 6}
            onClick={() => sendTsiaMutation.mutate()}
            data-testid="btn-confirm-transfer-otp"
          >
            {sendTsiaMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Confirm Transfer
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // TSIA TRANSFER — Receipt screen
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "receipt" && receiptData) return (
    <AnimatePresence mode="wait">
      <motion.div key="receipt" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-0">
        {/* Success banner */}
        <div className="rounded-2xl bg-gradient-to-br from-tsia-green to-emerald-600 text-white p-6 text-center mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Transfer Successful</p>
          <p className="text-4xl font-black tracking-tight">-${receiptData.amount}</p>
          <p className="text-sm text-white/80 mt-1">Sent to {receiptData.recipientName}</p>
        </div>

        {/* Receipt card */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm mb-4">
          {/* TSIA branding strip */}
          <div className="flex items-center gap-2.5 bg-muted/60 px-4 py-3 border-b border-border">
            <div className="w-7 h-7 rounded-full bg-tsia-gold flex items-center justify-center text-white font-black text-xs">T</div>
            <div>
              <p className="text-xs font-bold text-foreground leading-none">TSIA SwiftWallet</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Tuition Support Initiative for Africa</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-tsia-green bg-tsia-green/10 px-2 py-0.5 rounded-full">Completed</span>
          </div>

          {/* Receipt rows */}
          {[
            { label: "Reference", value: receiptData.txRef, mono: true },
            { label: "Date & Time", value: receiptData.txDate },
            { label: "Sender", value: `${receiptData.senderName} (You)` },
            { label: "Recipient", value: `${receiptData.recipientName} — ${receiptData.walletLabel}` },
            { label: "Amount", value: `-$${receiptData.amount}`, red: true },
            { label: "Fee", value: "$0.00 — Free", green: true },
            ...(receiptData.note ? [{ label: "Note", value: `"${receiptData.note}"`, italic: true }] : []),
          ].map((row, i) => (
            <div key={row.label} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? "border-t border-dashed border-border" : ""}`}>
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide shrink-0">{row.label}</span>
              <span className={`text-right font-semibold ml-4 text-xs ${row.mono ? "font-mono text-foreground" : ""} ${row.red ? "text-red-500 font-bold" : ""} ${row.green ? "text-tsia-green font-bold" : ""} ${(row as any).italic ? "italic text-muted-foreground font-normal" : ""}`}>
                {row.value}
              </span>
            </div>
          ))}

          {/* New balance */}
          <div className="flex items-center justify-between px-4 py-3.5 border-t-2 border-tsia-green/40 bg-tsia-green/5">
            <span className="text-xs font-bold uppercase tracking-wide text-tsia-green">New Balance</span>
            <span className="text-base font-black text-foreground">${receiptData.newBalance}</span>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-muted-foreground text-center px-4 mb-4">
          A receipt has been sent to your email address. Keep this reference for your records.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-11 rounded-2xl" onClick={() => { setView("send"); resetSend(); setReceiptData(null); }} data-testid="btn-receipt-new-transfer">
            <Send className="w-4 h-4 mr-1.5" /> New Transfer
          </Button>
          <Button className="flex-1 h-11 bg-tsia-green text-white font-bold rounded-2xl" onClick={() => { setView("home"); resetSend(); setReceiptData(null); }} data-testid="btn-receipt-done">
            Done
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // REQUEST MONEY
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "request") return (
    <AnimatePresence mode="wait">
      <motion.div key="request" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
        <BackHeader onBack={() => { setView("home"); setRequestEmail(""); setRequestNote(""); setAmount("0"); }} title="Request Money" sub="Notify a TSIA member to pay you" />

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Their Email Address</label>
          <input placeholder="member@tsia.com" value={requestEmail} onChange={e => setRequestEmail(e.target.value)}
            className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-violet-400 bg-background"
            type="email" data-testid="input-request-from" />
        </div>

        <div className="text-center py-2">
          <div className="text-5xl font-black">${fmt(amount)}</div>
          <p className="text-xs text-muted-foreground mt-1">Amount to request</p>
        </div>

        <input placeholder="What's it for? (optional)" value={requestNote} onChange={e => setRequestNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          data-testid="input-request-note" />

        <Numpad value={amount} onChange={setAmount} />

        <Button className="w-full h-12 bg-violet-600 text-white font-bold rounded-2xl"
          onClick={() => requestMutation.mutate({ email: requestEmail, amount, reqNote: requestNote })}
          disabled={!requestEmail.trim() || parseFloat(amount) <= 0 || requestMutation.isPending}
          data-testid="btn-send-request">
          {requestMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Bell className="w-5 h-5 mr-2" />}
          Send Request for ${fmt(amount)}
        </Button>
        <p className="text-xs text-center text-muted-foreground">They will receive a notification in their TSIA app to send you the money.</p>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PAY BILL — Service picker
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "pay-bill") return (
    <AnimatePresence mode="wait">
      <motion.div key="pay-bill" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
        <BackHeader onBack={() => setView("home")} title="Pay a Bill" />
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map(svc => (
            <button key={svc.id} onClick={() => { setSelectedService(svc); setBillStep("details"); setView("service"); }}
              className={`flex items-center gap-3 p-4 rounded-2xl ${svc.bg} border hover:shadow-md transition-shadow`} data-testid={`btn-bill-${svc.id}`}>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center shrink-0`}>
                <svc.icon className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-sm">{svc.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // SERVICE FLOWS
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "service" && selectedService) {

    // ── ELECTRICITY ──────────────────────────────────────────────────────
    if (selectedService.id === "electricity") return (
      <AnimatePresence mode="wait">
        <motion.div key="electricity" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
          <BackHeader onBack={() => billStep === "success" ? resetBill() : billStep === "amount" ? setBillStep("details") : setView("pay-bill")} title="Buy Electricity" sub={billStep === "details" ? "Select provider & meter" : billStep === "success" ? "Payment Complete" : "Enter amount"} />

          {billStep === "details" ? (<>
            {/* Disco search + pick */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Electricity Provider (DisCo)</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input placeholder="Search by state or DisCo name..." value={discoSearch} onChange={e => setDiscoSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 border-2 border-border rounded-2xl text-sm focus:outline-none focus:border-tsia-green bg-background" />
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {filteredDiscos.map(d => (
                  <button key={d.id} onClick={() => setSelectedDisco(d)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${selectedDisco?.id === d.id ? "border-tsia-green bg-green-50 dark:bg-green-900/20" : "border-border bg-card hover:border-tsia-green/40"}`}>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.area}</p>
                    </div>
                    {selectedDisco?.id === d.id && <CheckCircle2 className="w-5 h-5 text-tsia-green" />}
                  </button>
                ))}
              </div>
            </div>

            {selectedDisco && (<>
              {/* Meter type */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Meter Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["prepaid","postpaid"] as const).map(t => (
                    <button key={t} onClick={() => setMeterType(t)}
                      className={`py-3.5 rounded-2xl font-bold text-sm border-2 transition-all capitalize ${meterType === t ? "border-tsia-green bg-green-50 dark:bg-green-900/20 text-tsia-green" : "border-border bg-muted/30 text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {meterType && (<>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Meter Number</label>
                  <input type="tel" placeholder="Enter meter number" value={billRef} onChange={e => setBillRef(e.target.value.replace(/\D/g,""))}
                    className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-xl font-mono tracking-widest focus:outline-none focus:border-tsia-green bg-background"
                    data-testid="input-meter" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Contact Phone (optional)</label>
                  <input type="tel" placeholder="e.g. 08012345678" value={elecPhone} onChange={e => setElecPhone(e.target.value.replace(/\D/g,"").slice(0,11))}
                    className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-base font-mono tracking-widest focus:outline-none focus:border-amber-400 bg-background"
                    data-testid="input-elec-phone" />
                </div>
              </>)}
            </>)}

            <Button className="w-full h-12 bg-amber-500 text-white font-bold rounded-2xl"
              disabled={!selectedDisco || !meterType || billRef.length < 6}
              onClick={() => setBillStep("amount")}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

          </>) : billStep === "success" && txResult ? (<>
            {/* SUCCESS VIEW */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-tsia-green" />
              </div>
              <div>
                <h3 className="font-black text-xl text-tsia-green">Electricity Credited ✓</h3>
                <p className="text-muted-foreground text-sm mt-1">{selectedDisco?.label} • {meterType} • {billRef}</p>
              </div>
              <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount Paid</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                {txResult.token && (
                  <div className="bg-white dark:bg-black/20 rounded-xl p-3 text-center border border-amber-300">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">PREPAID TOKEN</p>
                    <p className="font-black text-lg tracking-[0.25em] text-amber-700">{txResult.token}</p>
                  </div>
                )}
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>
                Done
              </Button>
            </div>
          </>) : (<>
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-300 rounded-2xl px-4 py-3">
              <div><p className="text-xs text-muted-foreground">Meter</p><p className="font-bold text-sm font-mono">{billRef}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">{selectedDisco?.label}</p><p className="text-xs text-muted-foreground capitalize">{meterType}</p></div>
            </div>

            <div className="text-center py-1"><div className="text-5xl font-black">${fmt(amount)}</div><p className="text-xs text-muted-foreground mt-1">Balance: ${balance.toFixed(2)}</p></div>

            <div className="grid grid-cols-4 gap-2">
              {["5","10","20","50"].map(v => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${amount === v ? "border-amber-500 bg-amber-500/10 text-amber-600" : "border-border bg-muted/40 text-muted-foreground"}`}>
                  ${v}
                </button>
              ))}
            </div>

            <Numpad value={amount} onChange={setAmount} />
            <div className="flex gap-3">
              <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
              <Button className="flex-1 h-12 bg-amber-500 text-white font-bold rounded-2xl"
                disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                onClick={() => billMutation.mutate()} data-testid="btn-confirm-electricity">
                {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                Pay ${fmt(amount)}
              </Button>
            </div>
          </>)}
        </motion.div>
      </AnimatePresence>
    );

    // ── INTERNET ────────────────────────────────────────────────────────
    if (selectedService.id === "internet") return (
      <AnimatePresence mode="wait">
        <motion.div key="internet" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
          <BackHeader onBack={() => billStep === "success" ? (resetBill(), setView("home")) as any : billStep === "amount" ? setBillStep("details") : setView("pay-bill")} title="Buy Data" sub={billStep === "details" ? "Select network & plan" : billStep === "success" ? "Purchase Complete" : "Confirm purchase"} />

          {billStep === "details" ? (<>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Network</label>
              <div className="grid grid-cols-4 gap-2">
                {NETWORKS.map(n => (
                  <button key={n.id} onClick={() => { setSelectedISP(n.id); setSelectedPlan(null); }}
                    className={`py-3 rounded-2xl font-bold text-sm transition-all ${n.color} ${n.text} ${selectedISP === n.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                    data-testid={`btn-network-${n.id}`}>{n.label}</button>
                ))}
              </div>
            </div>

            {selectedISP && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Select Data Plan</label>
                <div className="space-y-2">
                  {DATA_PLANS[selectedISP]?.map(plan => (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${selectedPlan?.id === plan.id ? "border-tsia-green bg-green-50 dark:bg-green-900/20" : "border-border bg-card hover:border-tsia-green/40"}`}>
                      <div className="text-left">
                        <p className="font-bold">{plan.label}</p>
                        <p className="text-xs text-muted-foreground">{plan.validity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-tsia-green">${plan.price.toFixed(2)}</span>
                        {selectedPlan?.id === plan.id && <CheckCircle2 className="w-4 h-4 text-tsia-green" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPlan && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Phone Number</label>
                <input type="tel" placeholder="e.g. 08012345678" value={billRef}
                  onChange={e => setBillRef(e.target.value.replace(/\D/g,"").slice(0,11))}
                  className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-xl font-mono tracking-widest focus:outline-none focus:border-tsia-green bg-background"
                  data-testid="input-data-phone" />
              </div>
            )}

            <Button className="w-full h-12 bg-blue-600 text-white font-bold rounded-2xl"
              disabled={!selectedPlan || billRef.length < 10}
              onClick={() => { setAmount(String(selectedPlan!.price)); setBillStep("amount"); }}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>) : billStep === "success" && txResult ? (<>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-blue-600" /></div>
              <div><h3 className="font-black text-xl text-blue-600">Data Bundle Activated ✓</h3><p className="text-muted-foreground text-sm mt-1">{selectedISP?.toUpperCase()} • {selectedPlan?.label} • {billRef}</p></div>
              <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Validity</span><span className="font-semibold">{selectedPlan?.validity}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-blue-600 text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>Done</Button>
            </div>
          </>) : (<>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-3xl p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{selectedISP?.toUpperCase()} Data</p>
              <p className="text-4xl font-black text-blue-700">{selectedPlan?.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedPlan?.validity} validity</p>
              <p className="text-2xl font-black text-tsia-green mt-2">${fmt(amount)}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{billRef}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
              <Button className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-2xl"
                disabled={billMutation.isPending || parseFloat(amount) > balance}
                onClick={() => billMutation.mutate()} data-testid="btn-confirm-data">
                {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wifi className="w-5 h-5 mr-2" />}
                Buy Data ${fmt(amount)}
              </Button>
            </div>
            {parseFloat(amount) > balance && <p className="text-xs text-center text-red-500">Insufficient balance</p>}
          </>)}
        </motion.div>
      </AnimatePresence>
    );

    // ── AIRTIME ─────────────────────────────────────────────────────────
    if (selectedService.id === "airtime") return (
      <AnimatePresence mode="wait">
        <motion.div key="airtime" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
          <BackHeader onBack={() => billStep === "success" ? (resetBill(), setView("home")) as any : billStep === "amount" ? setBillStep("details") : setView("pay-bill")} title="Buy Airtime" sub={billStep === "details" ? "Select network & phone" : billStep === "success" ? "Purchase Complete" : "Enter amount"} />

          {billStep === "details" ? (<>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Select Network</label>
              <div className="grid grid-cols-4 gap-2">
                {NETWORKS.map(n => (
                  <button key={n.id} onClick={() => setSelectedNetwork(n.id)}
                    className={`py-3 rounded-2xl font-bold text-sm transition-all ${n.color} ${n.text} ${selectedNetwork === n.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                    data-testid={`btn-airtime-${n.id}`}>{n.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Phone Number</label>
              <input type="tel" placeholder="e.g. 08012345678" value={billRef} onChange={e => setBillRef(e.target.value.replace(/\D/g,"").slice(0,11))}
                className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-xl font-mono tracking-widest focus:outline-none focus:border-tsia-green bg-background"
                data-testid="input-airtime-phone" />
            </div>
            <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl"
              disabled={!selectedNetwork || billRef.length < 10}
              onClick={() => setBillStep("amount")}>Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </>) : billStep === "success" && txResult ? (<>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-tsia-green" /></div>
              <div><h3 className="font-black text-xl text-tsia-green">Airtime Delivered ✓</h3><p className="text-muted-foreground text-sm mt-1">{selectedNetwork?.toUpperCase()} • {billRef}</p></div>
              <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-tsia-green/30 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>Done</Button>
            </div>
          </>) : (<>
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-tsia-green/30 rounded-2xl px-4 py-3">
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-bold font-mono">{billRef}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Network</p><p className="font-bold uppercase">{selectedNetwork}</p></div>
            </div>
            <div className="text-center py-1"><div className="text-5xl font-black">${fmt(amount)}</div><p className="text-xs text-muted-foreground mt-1">Balance: ${balance.toFixed(2)}</p></div>
            <div className="grid grid-cols-4 gap-2">
              {["1","2","5","10"].map(v => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${amount === v ? "border-tsia-green bg-tsia-green/10 text-tsia-green" : "border-border bg-muted/40 text-muted-foreground"}`}>${v}</button>
              ))}
            </div>
            <Numpad value={amount} onChange={setAmount} />
            <div className="flex gap-3">
              <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
              <Button className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
                disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                onClick={() => billMutation.mutate()} data-testid="btn-confirm-airtime">
                {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Phone className="w-5 h-5 mr-2" />}
                Buy ${fmt(amount)} Airtime
              </Button>
            </div>
          </>)}
        </motion.div>
      </AnimatePresence>
    );

    // ── BETTING ──────────────────────────────────────────────────────────
    if (selectedService.id === "betting") return (
      <AnimatePresence mode="wait">
        <motion.div key="betting" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
          <BackHeader onBack={() => billStep === "success" ? (resetBill(), setView("home")) as any : billStep === "amount" ? setBillStep("details") : setView("pay-bill")} title="Fund Betting Wallet" sub={billStep === "details" ? "Select platform & ID" : billStep === "success" ? "Payment Complete" : "Enter amount"} />

          {billStep === "details" ? (<>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {BETTING_PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                    className={`py-3.5 rounded-2xl font-bold text-sm transition-all ${p.color} ${p.text} ${selectedPlatform === p.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                    data-testid={`btn-betting-${p.id}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Betting User ID</label>
              <input placeholder="Your betting platform ID" value={billRef} onChange={e => setBillRef(e.target.value)}
                className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-violet-500 bg-background"
                data-testid="input-betting-id" />
            </div>
            <Button className="w-full h-12 bg-violet-600 text-white font-bold rounded-2xl"
              disabled={!selectedPlatform || !billRef.trim()} onClick={() => setBillStep("amount")}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>) : billStep === "success" && txResult ? (<>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-violet-600" /></div>
              <div><h3 className="font-black text-xl text-violet-600">Betting Wallet Funded ✓</h3><p className="text-muted-foreground text-sm mt-1">{selectedPlatform} • ID: {billRef}</p></div>
              <div className="w-full bg-violet-50 dark:bg-violet-900/20 border border-violet-300 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount Credited</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-violet-600 text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>Done</Button>
            </div>
          </>) : (<>
            <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 border border-violet-300 rounded-2xl px-4 py-3">
              <div><p className="text-xs text-muted-foreground">User ID</p><p className="font-bold">{billRef}</p></div>
              <div className="text-right"><p className="text-xs text-muted-foreground">Platform</p><p className="font-bold capitalize">{selectedPlatform}</p></div>
            </div>
            <div className="text-center py-1"><div className="text-5xl font-black">${fmt(amount)}</div><p className="text-xs text-muted-foreground mt-1">Balance: ${balance.toFixed(2)}</p></div>
            <div className="grid grid-cols-4 gap-2">
              {["5","10","20","50"].map(v => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${amount === v ? "border-violet-500 bg-violet-500/10 text-violet-600" : "border-border bg-muted/40 text-muted-foreground"}`}>${v}</button>
              ))}
            </div>
            <Numpad value={amount} onChange={setAmount} />
            <div className="flex gap-3">
              <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
              <Button className="flex-1 h-12 bg-violet-600 text-white font-bold rounded-2xl"
                disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                onClick={() => billMutation.mutate()} data-testid="btn-confirm-betting">
                {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Gamepad2 className="w-5 h-5 mr-2" />}
                Fund ${fmt(amount)}
              </Button>
            </div>
          </>)}
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, msg }: { icon: any; msg: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <Icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
      {msg}
    </div>
  );
}
