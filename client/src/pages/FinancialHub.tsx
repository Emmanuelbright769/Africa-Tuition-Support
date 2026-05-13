import { useState, useEffect, useCallback, useRef, type ComponentProps } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { TransactionReceipt, type ReceiptRow } from "@/components/ui/TransactionReceipt";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Receipt, Wifi, Eye, EyeOff,
  ChevronRight, ArrowLeft, ArrowRight, Send, Bell, TrendingUp, TrendingDown,
  Loader2, CheckCircle2, X, Zap, Phone, Wallet, Gamepad2, Delete,
  Copy, Search, ChevronDown, AlertCircle, Users, Building2, Clock,
  CreditCard, Shield, Lock, Coins, Smartphone, ExternalLink, Banknote,
  RefreshCcw, BookMarked, GraduationCap, Briefcase, ArrowLeftRight, Check
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";

// ─── Wallet Account Switcher (Student ↔ Affiliate) ────────────────────────────
function WalletAccountSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data } = useQuery<{ roles: string[]; currentRole: string }>({
    queryKey: ["/api/auth/linked-roles"],
    queryFn: () => apiRequest("GET", "/api/auth/linked-roles").then(r => r.json()),
    staleTime: 60_000,
    enabled: !!user,
  });
  const switchMut = useMutation({
    mutationFn: (targetRole: string) =>
      apiRequest("POST", "/api/auth/switch-role", { targetRole }).then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Switch failed"); }
        return r.json();
      }),
    onSuccess: (newUser: any) => {
      queryClient.setQueryData(["/api/auth/me"], newUser);
      queryClient.removeQueries({ predicate: q => (q.queryKey[0] as string) !== "/api/auth/me" });
      setOpen(false);
      toast({ title: `Switched to ${newUser.role === "affiliate" ? "Business" : "Student"} wallet` });
      if (newUser.role === "affiliate") window.location.href = "/affiliate-dashboard";
      else window.location.href = "/dashboard";
    },
    onError: (e: any) => toast({ title: "Could not switch", description: e.message, variant: "destructive" }),
  });

  if (!user || !data) return null;
  const roles = (data.roles || []).filter(r => r !== "admin");
  if (roles.length < 2) return null; // single-account user — render nothing

  const labelFor = (r: string) => r === "affiliate" ? "Business" : "Student";
  const IconFor = (r: string) => r === "affiliate" ? Briefcase : GraduationCap;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={switchMut.isPending}
        className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-2 py-0.5"
        data-testid="btn-switch-wallet-account"
        title="Switch wallet account"
      >
        {switchMut.isPending
          ? <Loader2 className="w-2.5 h-2.5 text-white/70 animate-spin" />
          : <ArrowLeftRight className="w-2.5 h-2.5 text-white/70" />}
        <span className="text-[9px] font-bold text-white/70">{labelFor(data.currentRole).toUpperCase()}</span>
        <ChevronDown className={`w-2.5 h-2.5 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-border overflow-hidden"
              data-testid="menu-wallet-accounts"
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your wallets</p>
              </div>
              {roles.map(r => {
                const Icon = IconFor(r);
                const isCurrent = r === data.currentRole;
                return (
                  <button
                    key={r}
                    onClick={() => { if (!isCurrent) switchMut.mutate(r); }}
                    disabled={isCurrent || switchMut.isPending}
                    data-testid={`item-wallet-${r}`}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${isCurrent ? "bg-muted cursor-default" : "hover:bg-muted/60"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r === "affiliate" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{labelFor(r)} Wallet</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r === "affiliate" ? "Affiliate account" : "Student account"}</p>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-tsia-green shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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

// ─── Local-currency payout map (fixed platform rates) ──────────────────────────
const PAYOUT_CURRENCY: Record<string, { symbol: string; code: string; rate: number }> = {
  ng: { symbol: "₦", code: "NGN", rate: 1_280 },
  gh: { symbol: "₵", code: "GHS", rate: 15   },
  ke: { symbol: "Ksh", code: "KES", rate: 130  },
  za: { symbol: "R",  code: "ZAR", rate: 18   },
  ug: { symbol: "USh",code: "UGX", rate: 3_720 },
  tz: { symbol: "TSh",code: "TZS", rate: 2_600 },
  rw: { symbol: "Fr", code: "RWF", rate: 1_350 },
};

function LocalEquiv({ usd, country }: { usd: number; country?: string }) {
  const info = PAYOUT_CURRENCY[(country ?? "").toLowerCase()];
  if (!info || usd <= 0) return null;
  const local = Math.round(usd * info.rate);
  return (
    <p className="text-xs font-semibold text-tsia-green/80 mt-0.5 animate-in fade-in">
      ≈ {info.symbol}{local.toLocaleString()} {info.code}
    </p>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SendMode = "bank" | "tsia";
type View = "home" | "fund" | "send" | "request" | "pay-bill" | "service" | "send-amount" | "tsia-amount" | "tsia-otp" | "receipt";

// ── TSIA Receiving Wallet Addresses ───────────────────────────────────────────
const TSIA_WALLETS = {
  trc20: "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj",
  bep20: "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977",
};
type ReceiptData = { txRef: string; txDate: string; amount: string; senderName: string; recipientName: string; walletLabel: string; note: string | null; newBalance: string };
type WalletData = { id: number; userId: number; balance: string };
type TransferRecord = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };
type Bank = { code: string; name: string; gateway?: "squad" | "korapay" };

// ─── Services ──────────────────────────────────────────────────────────────────
const SERVICES = [
  { id: "electricity", label: "Electricity", icon: Zap,      color: "from-yellow-400 to-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  { id: "internet",    label: "Internet",    icon: Wifi,      color: "from-blue-400 to-indigo-500",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "airtime",     label: "Airtime",     icon: Phone,     color: "from-emerald-400 to-teal-500",  bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { id: "cable-tv",    label: "Cable TV",    icon: Smartphone, color: "from-rose-400 to-pink-600",   bg: "bg-rose-50 dark:bg-rose-900/20" },
  { id: "betting",     label: "Betting",     icon: Gamepad2,  color: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
];

// ─── Nigerian Networks ────────────────────────────────────────────────────────
const NETWORKS = [
  { id: "mtn",     label: "MTN",     color: "bg-yellow-400",  text: "text-yellow-900" },
  { id: "airtel",  label: "Airtel",  color: "bg-red-500",     text: "text-white" },
  { id: "glo",     label: "Glo",     color: "bg-green-600",   text: "text-white" },
  { id: "9mobile", label: "9mobile", color: "bg-emerald-700", text: "text-white" },
];

// ─── Data Plans per network (fallback when live API unavailable) ──────────────
const DATA_PLANS: Record<string, { id: string; label: string; validity: string; price: number }[]> = {
  mtn: [
    { id: "mtn_50mb",   label: "50MB",   validity: "1 day",    price: 0.10 },
    { id: "mtn_200mb",  label: "200MB",  validity: "5 days",   price: 0.25 },
    { id: "mtn_500mb",  label: "500MB",  validity: "7 days",   price: 0.50 },
    { id: "mtn_1gb",    label: "1GB",    validity: "30 days",  price: 1.00 },
    { id: "mtn_1gb_n",  label: "1GB",    validity: "7 days",   price: 0.80 },
    { id: "mtn_2gb",    label: "2GB",    validity: "30 days",  price: 2.00 },
    { id: "mtn_3gb",    label: "3GB",    validity: "30 days",  price: 2.80 },
    { id: "mtn_5gb",    label: "5GB",    validity: "30 days",  price: 4.50 },
    { id: "mtn_10gb",   label: "10GB",   validity: "30 days",  price: 8.00 },
    { id: "mtn_15gb",   label: "15GB",   validity: "30 days",  price: 11.00 },
    { id: "mtn_20gb",   label: "20GB",   validity: "30 days",  price: 14.00 },
    { id: "mtn_30gb",   label: "30GB",   validity: "30 days",  price: 19.00 },
    { id: "mtn_50gb",   label: "50GB",   validity: "30 days",  price: 28.00 },
    { id: "mtn_75gb",   label: "75GB",   validity: "30 days",  price: 38.00 },
    { id: "mtn_100gb",  label: "100GB",  validity: "30 days",  price: 50.00 },
  ],
  airtel: [
    { id: "airtel_100mb",  label: "100MB",  validity: "1 day",    price: 0.12 },
    { id: "airtel_300mb",  label: "300MB",  validity: "7 days",   price: 0.30 },
    { id: "airtel_500mb",  label: "500MB",  validity: "7 days",   price: 0.50 },
    { id: "airtel_1gb",    label: "1GB",    validity: "30 days",  price: 0.90 },
    { id: "airtel_1_5gb",  label: "1.5GB",  validity: "30 days",  price: 1.00 },
    { id: "airtel_2gb",    label: "2GB",    validity: "30 days",  price: 1.80 },
    { id: "airtel_3gb",    label: "3GB",    validity: "30 days",  price: 2.50 },
    { id: "airtel_6gb",    label: "6GB",    validity: "30 days",  price: 4.50 },
    { id: "airtel_10gb",   label: "10GB",   validity: "30 days",  price: 7.50 },
    { id: "airtel_15gb",   label: "15GB",   validity: "30 days",  price: 10.50 },
    { id: "airtel_20gb",   label: "20GB",   validity: "30 days",  price: 13.50 },
    { id: "airtel_30gb",   label: "30GB",   validity: "30 days",  price: 18.00 },
    { id: "airtel_40gb",   label: "40GB",   validity: "30 days",  price: 22.00 },
    { id: "airtel_50gb",   label: "50GB",   validity: "30 days",  price: 27.00 },
    { id: "airtel_100gb",  label: "100GB",  validity: "30 days",  price: 45.00 },
  ],
  glo: [
    { id: "glo_100mb",  label: "100MB",  validity: "1 day",    price: 0.12 },
    { id: "glo_350mb",  label: "350MB",  validity: "7 days",   price: 0.35 },
    { id: "glo_500mb",  label: "500MB",  validity: "14 days",  price: 0.50 },
    { id: "glo_1gb",    label: "1GB",    validity: "30 days",  price: 0.70 },
    { id: "glo_1_5gb",  label: "1.5GB",  validity: "30 days",  price: 1.00 },
    { id: "glo_2gb",    label: "2GB",    validity: "30 days",  price: 1.40 },
    { id: "glo_2_5gb",  label: "2.5GB",  validity: "30 days",  price: 1.60 },
    { id: "glo_5gb",    label: "5GB",    validity: "30 days",  price: 3.00 },
    { id: "glo_7_5gb",  label: "7.5GB",  validity: "30 days",  price: 4.50 },
    { id: "glo_10gb",   label: "10GB",   validity: "30 days",  price: 5.80 },
    { id: "glo_15gb",   label: "15GB",   validity: "30 days",  price: 8.00 },
    { id: "glo_20gb",   label: "20GB",   validity: "30 days",  price: 10.00 },
    { id: "glo_30gb",   label: "30GB",   validity: "30 days",  price: 13.50 },
    { id: "glo_50gb",   label: "50GB",   validity: "30 days",  price: 20.00 },
    { id: "glo_100gb",  label: "100GB",  validity: "30 days",  price: 35.00 },
  ],
  "9mobile": [
    { id: "9m_150mb",  label: "150MB",  validity: "7 days",   price: 0.18 },
    { id: "9m_500mb",  label: "500MB",  validity: "30 days",  price: 0.50 },
    { id: "9m_1gb",    label: "1GB",    validity: "30 days",  price: 1.00 },
    { id: "9m_1_5gb",  label: "1.5GB",  validity: "30 days",  price: 1.40 },
    { id: "9m_2gb",    label: "2GB",    validity: "30 days",  price: 1.80 },
    { id: "9m_3gb",    label: "3GB",    validity: "30 days",  price: 2.60 },
    { id: "9m_5gb",    label: "5GB",    validity: "30 days",  price: 4.00 },
    { id: "9m_10gb",   label: "10GB",   validity: "30 days",  price: 7.50 },
    { id: "9m_15gb",   label: "15GB",   validity: "30 days",  price: 11.00 },
    { id: "9m_20gb",   label: "20GB",   validity: "30 days",  price: 14.00 },
    { id: "9m_30gb",   label: "30GB",   validity: "30 days",  price: 19.50 },
    { id: "9m_40gb",   label: "40GB",   validity: "30 days",  price: 25.00 },
  ],
};

// ─── Electricity Discos — VTU.ng service_id format ────────────────────────────
const DISCOS = [
  { id: "eko-electric",          label: "Eko Electric",        area: "Lagos South (Apapa, Lekki, Ojo, Island)" },
  { id: "ikeja-electric",        label: "Ikeja Electric",      area: "Lagos North (Ikeja, Ikorodu, Oshodi)" },
  { id: "abuja-electric",        label: "Abuja Electric",      area: "FCT, Kogi, Niger, Nassarawa" },
  { id: "kano-electric",         label: "Kano Electric",       area: "Kano, Katsina, Jigawa" },
  { id: "portharcourt-electric", label: "Port Harcourt Elec.", area: "Rivers, Akwa Ibom, Bayelsa, Cross River" },
  { id: "ibadan-electric",       label: "Ibadan Electric",     area: "Oyo, Ogun, Osun, Kwara" },
  { id: "jos-electric",          label: "Jos Electric",        area: "Plateau, Bauchi, Benue, Gombe" },
  { id: "benin-electric",        label: "Benin Electric",      area: "Edo, Delta, Ekiti, Ondo" },
  { id: "enugu-electric",        label: "Enugu Electric",      area: "Enugu, Anambra, Imo, Ebonyi" },
  { id: "aba-electric",          label: "Aba Electric",        area: "Abia State" },
  { id: "yola-electric",         label: "Yola Electric",       area: "Adamawa, Taraba, Borno, Yobe" },
  { id: "kaduna-electric",       label: "Kaduna Electric",     area: "Kaduna, Kebbi, Sokoto, Zamfara" },
];

// ─── Betting Platforms — VTU.ng exact service_id values ──────────────────────
const BETTING_PLATFORMS = [
  { id: "Bet9ja",        label: "Bet9ja",        color: "bg-green-800",    text: "text-white" },
  { id: "SportyBet",     label: "SportyBet",     color: "bg-blue-900",     text: "text-white" },
  { id: "BetKing",       label: "BetKing",       color: "bg-orange-600",   text: "text-white" },
  { id: "1xBet",         label: "1xBet",         color: "bg-slate-800",    text: "text-white" },
  { id: "BetWay",        label: "Betway",        color: "bg-green-600",    text: "text-white" },
  { id: "MSport",        label: "Msport",        color: "bg-red-600",      text: "text-white" },
  { id: "Melbet",        label: "Melbet",        color: "bg-yellow-500",   text: "text-black" },
  { id: "NairaBet",      label: "NairaBet",      color: "bg-blue-700",     text: "text-white" },
  { id: "MerryBet",      label: "MerryBet",      color: "bg-red-700",      text: "text-white" },
  { id: "BetPawa",       label: "BetPawa",       color: "bg-lime-600",     text: "text-white" },
  { id: "Parimatch",     label: "Parimatch",     color: "bg-yellow-600",   text: "text-black" },
  { id: "NaijaBet",      label: "NaijaBet",      color: "bg-purple-700",   text: "text-white" },
  { id: "BangBet",       label: "BangBet",       color: "bg-amber-600",    text: "text-white" },
  { id: "BetLion",       label: "BetLion",       color: "bg-yellow-600",   text: "text-black" },
  { id: "LiveScoreBet",  label: "LiveScore",     color: "bg-sky-600",      text: "text-white" },
  { id: "SupaBet",       label: "SupaBet",       color: "bg-indigo-700",   text: "text-white" },
  { id: "WBet",          label: "WBet",          color: "bg-teal-700",     text: "text-white" },
  { id: "Surebet247",    label: "Surebet247",    color: "bg-green-700",    text: "text-white" },
  { id: "Betfarm",       label: "Betfarm",       color: "bg-emerald-700",  text: "text-white" },
  { id: "YangaBet",      label: "YangaBet",      color: "bg-pink-700",     text: "text-white" },
  { id: "AccessBet",     label: "AccessBet",     color: "bg-rose-800",     text: "text-white" },
  { id: "Mybet",         label: "MyBet",         color: "bg-cyan-700",     text: "text-white" },
  { id: "CloudBet",      label: "CloudBet",      color: "bg-cyan-800",     text: "text-white" },
  { id: "iLot",          label: "iLot",          color: "bg-violet-700",   text: "text-white" },
];

// ─── Cable TV Providers ───────────────────────────────────────────────────────
const TV_PROVIDERS = [
  { id: "dstv",      label: "DStv",      color: "bg-blue-800",   text: "text-white" },
  { id: "gotv",      label: "GOtv",      color: "bg-orange-500", text: "text-white" },
  { id: "startimes", label: "StarTimes", color: "bg-red-700",    text: "text-white" },
  { id: "showmax",   label: "Showmax",   color: "bg-pink-700",   text: "text-white" },
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
  const [activeTab, setActiveTab] = useState<"transfers" | "bank-transfers" | "bills">("transfers");
  const [bankTxPage, setBankTxPage]   = useState(0);
  const [transferPage, setTransferPage] = useState(0);
  const [billPage, setBillPage]       = useState(0);
  const [depositPage, setDepositPage] = useState(0);
  const FH_PAGE_SIZE = 10;
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ── Universal transaction receipt dialog ──────────────────────────────────
  const [txReceiptOpen, setTxReceiptOpen]       = useState(false);
  const [txReceiptProps, setTxReceiptProps]     = useState<Omit<ComponentProps<typeof TransactionReceipt>, "open" | "onClose"> | null>(null);

  const showReceipt = (props: Omit<ComponentProps<typeof TransactionReceipt>, "open" | "onClose">) => {
    setTxReceiptProps(props);
    setTxReceiptOpen(true);
  };

  // ── Fund Account state ────────────────────────────────────────────────────
  type FundMethod = "squad" | "korapay" | "crypto";
  const [fundMethod, setFundMethod]     = useState<FundMethod>("squad");
  const [fundAmount, setFundAmount]     = useState("");
  const [squadLoading, setSquadLoading] = useState(false);
  const [koraLoading, setKoraLoading]   = useState(false);
  const [koraReference, setKoraReference] = useState<string | null>(null);
  const koraPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cryptoNetwork, setCryptoNetwork] = useState<"trc20" | "bep20">("trc20");
  const [cryptoAmount, setCryptoAmount]   = useState("");
  const [cryptoTxHash, setCryptoTxHash]   = useState("");
  // ── Wallet balance display toggle (USD ↔ local currency) ─────────────────
  const [showLocalBalance, setShowLocalBalance] = useState(false);

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
  const [bankGateway, setBankGateway]   = useState<"squad" | "korapay">("korapay");

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
  // Internet / live data plans
  const [selectedISP, setSelectedISP]         = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan]       = useState<{ variationId: string; label: string; priceNgn: number } | null>(null);
  const [livePlans, setLivePlans]             = useState<{ variationId: string; label: string; priceNgn: number }[]>([]);
  const [livePlansLoading, setLivePlansLoading] = useState(false);
  // Electricity
  const [selectedDisco, setSelectedDisco]     = useState<typeof DISCOS[0] | null>(null);
  const [meterType, setMeterType]             = useState<"prepaid" | "postpaid" | null>(null);
  const [discoSearch, setDiscoSearch]         = useState("");
  const [elecPhone, setElecPhone]             = useState("");
  const [elecCustomerName, setElecCustomerName] = useState("");
  // Cable TV
  const [selectedTvProvider, setSelectedTvProvider] = useState<typeof TV_PROVIDERS[0] | null>(null);
  const [tvPackages, setTvPackages]           = useState<{ variationId: string; label: string; priceNgn: number }[]>([]);
  const [tvPackagesLoading, setTvPackagesLoading] = useState(false);
  const [selectedTvPackage, setSelectedTvPackage] = useState<{ variationId: string; label: string; priceNgn: number } | null>(null);
  const [tvCustomerName, setTvCustomerName]   = useState("");
  // Betting
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: wallet }         = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: txHistory = [] } = useQuery<any[]>({ queryKey: ["/api/transactions"] });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] }     = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });
  const { data: banks = [] }     = useQuery<Bank[]>({ queryKey: ["/api/wallet/banks"] });
  const { data: vcData, refetch: refetchCard } = useQuery<{ card: any | null }>({ queryKey: ["/api/fintech/virtual-card"] });

  const [cardRevealed, setCardRevealed] = useState(false);
  const [vcCopied, setVcCopied]         = useState<string | null>(null);

  // ── Virtual Card Wizard state ────────────────────────────────────────────
  const [vcWizardOpen, setVcWizardOpen]     = useState(false);
  const [vcWizardStep, setVcWizardStep]     = useState<1 | 2 | 3>(1);
  const [vcName, setVcName]                 = useState("");
  const [vcAddress, setVcAddress]           = useState("");
  const [vcCity, setVcCity]                 = useState("");
  const [vcRegion, setVcRegion]             = useState("");
  const [vcZip, setVcZip]                   = useState("");
  const [vcPin, setVcPin]                   = useState("");
  const [vcPinConfirm, setVcPinConfirm]     = useState("");
  const [vcPinErr, setVcPinErr]             = useState("");
  const [vcPinVisible, setVcPinVisible]     = useState(false);

  const openVcWizard = () => {
    setVcWizardStep(1);
    setVcName(""); setVcAddress(""); setVcCity(""); setVcRegion(""); setVcZip("");
    setVcPin(""); setVcPinConfirm(""); setVcPinErr("");
    setVcWizardOpen(true);
  };
  const vcStep1Valid = vcName.trim().length >= 3 && vcAddress.trim().length >= 5 && vcCity.trim().length >= 2;
  const vcStep2Valid = vcPin.length === 4 && vcPinConfirm.length === 4;

  const handleVcStep2Next = () => {
    if (vcPin !== vcPinConfirm) { setVcPinErr("PINs do not match"); return; }
    setVcPinErr("");
    setVcWizardStep(3);
  };

  const copyToClipboard = (val: string, label: string) => {
    navigator.clipboard.writeText(val.replace(/\s/g, "")).then(() => {
      setVcCopied(label);
      setTimeout(() => setVcCopied(null), 2000);
    });
  };

  const purchaseCardMutation = useMutation({
    mutationFn: (payload: { billingName: string; billingAddress: string; billingCity: string; billingRegion: string; billingZip: string; pin: string }) =>
      apiRequest("POST", "/api/fintech/virtual-card/purchase", payload).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message && !data.card) { toast({ title: "Error", description: data.message, variant: "destructive" }); return; }
      setVcWizardOpen(false);
      refetchCard();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "💳 Virtual Card Issued!", description: "Your US Mastercard is ready to use." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Fund Account: local currency helpers + queries ────────────────────────
  const { formatAmount, formatAmountVAT, rateLabel, rateLabelVAT, currency } = useLocalCurrency();
  const { data: walletDeposits = [], refetch: refetchDeposits } = useQuery<any[]>({ queryKey: ["/api/wallet/deposits"] });
  const { data: balances, refetch: refetchBalances } = useQuery<{
    bookBalance: string; availableBalance: string; confirmedBalance: string;
    minimumBalance: string; lockedBalance: string;
    pendingAmount: string; pendingCount: number; failedCount: number;
    tradeBalance: string; referralBalance: string; totalAffiliateBalance: string;
  }>({ queryKey: ["/api/wallet/balances"], staleTime: 30_000 });

  const bookBalance   = parseFloat(balances?.bookBalance   ?? "0");
  const pendingAmount = parseFloat(balances?.pendingAmount  ?? "0");

  // ── Squad: load widget script ─────────────────────────────────────────────
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

  // ── Squad: open inline modal ──────────────────────────────────────────────
  const openSquadModal = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 2) { toast({ title: "Enter a valid amount", description: "Minimum deposit is above $2.00.", variant: "destructive" }); return; }
    setSquadLoading(true);
    try {
      await loadSquadScript();
      const res = await apiRequest("POST", "/api/wallet/squad/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { transactionRef, amountKobo, publicKey, email, firstName, lastName } = d as {
        transactionRef: string; amountKobo: number; publicKey: string;
        email: string; firstName: string; lastName: string;
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
            queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
            refetchDeposits(); refetchBalances();
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
            setFundAmount(""); setView("home");
          } catch {
            toast({ title: "Payment received — verifying", description: "Your funds will be credited within 2 minutes automatically." });
          } finally {
            setSquadLoading(false);
          }
        },
      });
      instance.setup();
      instance.open();
    } catch (e: any) {
      setSquadLoading(false);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [fundAmount, loadSquadScript, toast, refetchDeposits, refetchBalances]);

  // ── Korapay: open checkout in new tab + poll ──────────────────────────────
  const stopKoraPoll = useCallback(() => {
    if (koraPollRef.current) { clearInterval(koraPollRef.current); koraPollRef.current = null; }
    setKoraLoading(false);
    setKoraReference(null);
  }, []);

  const verifyKoraPayment = useCallback(async (reference: string) => {
    try {
      const vRes = await apiRequest("POST", "/api/wallet/korapay/verify", { reference });
      const vd = await vRes.json();
      if (vRes.ok) {
        if (koraPollRef.current) { clearInterval(koraPollRef.current); koraPollRef.current = null; }
        toast({ title: "Wallet funded! 🎉", description: vd.message, className: "border-tsia-green" });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
        refetchDeposits(); refetchBalances();
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        setFundAmount(""); setKoraLoading(false); setKoraReference(null); setView("home");
        return true;
      }
    } catch { /* keep polling */ }
    return false;
  }, [toast, refetchDeposits, refetchBalances]);

  const openKorapayCheckout = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 2) { toast({ title: "Enter a valid amount", description: "Minimum deposit is above $2.00.", variant: "destructive" }); return; }
    setKoraLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/korapay/initiate", { amountUsd: amount });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Could not start payment");
      const { checkoutUrl, reference } = d as { checkoutUrl: string; reference: string };
      setKoraReference(reference);
      const win = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      if (!win) { window.location.href = checkoutUrl; return; }
      toast({ title: "Korapay checkout opened", description: "Complete payment in the new tab, then return here.", className: "border-tsia-green" });
      let attempts = 0;
      koraPollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 60) { stopKoraPoll(); return; }
        await verifyKoraPayment(reference);
      }, 5000);
    } catch (e: any) {
      setKoraLoading(false);
      setKoraReference(null);
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    }
  }, [fundAmount, toast, refetchDeposits, refetchBalances, stopKoraPoll, verifyKoraPayment]);

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
      toast({ title: "Wallet Funded ✓", description: "Your deposit has been credited to your wallet instantly. No admin approval needed.", className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/deposits"] });
      setCryptoAmount(""); setCryptoTxHash(""); setCryptoNetwork("trc20");
      setView("home");
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  const balance  = parseFloat(wallet?.balance ?? "0");
  const totalIn  = (txHistory as any[]).filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = Math.abs((txHistory as any[]).filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + parseFloat(t.amount), 0));

  // Bank-transfer availability is controlled by the admin toggle only.
  // If the toggle is OFF the server will return a network error on submit.

  const recentRecipients = Array.from(
    new Map((transfers as TransferRecord[]).map(t => [t.recipientId, t])).values()
  ).slice(0, 5);

  const filteredBanks = (banks as Bank[]).filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const filteredDiscos = DISCOS.filter(d => d.label.toLowerCase().includes(discoSearch.toLowerCase()) || d.area.toLowerCase().includes(discoSearch.toLowerCase()));

  // ── Fetch live data plans when ISP selected ───────────────────────────────
  useEffect(() => {
    if (!selectedISP) { setLivePlans([]); return; }
    let cancelled = false;
    setLivePlansLoading(true);
    setSelectedPlan(null);
    setLivePlans([]);
    apiRequest("GET", `/api/fintech/data-plans?network=${selectedISP}`)
      .then(r => r.json())
      .then((d: any) => { if (!cancelled) setLivePlans(d.plans ?? []); })
      .catch(() => { if (!cancelled) setLivePlans([]); })
      .finally(() => { if (!cancelled) setLivePlansLoading(false); });
    return () => { cancelled = true; };
  }, [selectedISP]);

  // ── Fetch live TV packages when provider selected ──────────────────────────
  useEffect(() => {
    if (!selectedTvProvider) { setTvPackages([]); return; }
    let cancelled = false;
    setTvPackagesLoading(true);
    setSelectedTvPackage(null);
    setTvPackages([]);
    apiRequest("GET", `/api/fintech/tv-plans?service=${selectedTvProvider.id}`)
      .then(r => r.json())
      .then((d: any) => { if (!cancelled) setTvPackages(d.plans ?? []); })
      .catch(() => { if (!cancelled) setTvPackages([]); })
      .finally(() => { if (!cancelled) setTvPackagesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedTvProvider]);

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
        gateway: bankGateway,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      const amt = parseFloat(amount);
      const vat = parseFloat(data.vatAmount ?? "0");
      setView("home"); resetSend();
      showReceipt({
        title: "Bank Transfer",
        status: "pending",
        amount: `$${amt.toFixed(2)}`,
        rows: [
          { label: "Reference",      value: data.reference,                     mono: true },
          { label: "Sender",         value: `${user?.firstName} ${user?.lastName} (You)` },
          { label: "Beneficiary",    value: resolvedName || acctNumber },
          { label: "Account No",     value: acctNumber },
          { label: "Bank",           value: selectedBank?.name || "—" },
          { label: "Amount",         value: `$${amt.toFixed(2)}` },
          { label: "VAT (7.5%)",     value: `-$${vat.toFixed(2)}`,                red: true },
          { label: "Beneficiary Receives", value: `₦${(data.netAmountNgn ?? 0).toLocaleString()} NGN`, green: true, bold: true },
          { label: "Narration",      value: note || "None" },
          { label: "Status",         value: "Pending — Admin will process within 24 hrs", bold: true },
        ] as ReceiptRow[],
        referenceRow: data.reference,
        footerNote: `Your wallet has been debited. Admin will manually process this transfer and approve it within 24 hours. You will receive a notification once it is sent.`,
        onNewTx: () => { setTxReceiptOpen(false); setView("send"); resetSend(); },
        newTxLabel: "New Transfer",
      });
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
      setView("home"); resetSend();
      const r = data.receipt;
      if (r) {
        showReceipt({
          title: "TSIA Transfer",
          status: "success",
          amount: `-$${r.amount}`,
          rows: [
            { label: "Reference",   value: r.txRef,                                    mono: true },
            { label: "Date & Time", value: r.txDate },
            { label: "Sender",           value: `${r.senderName} (You)` },
            { label: "Recipient",        value: `${r.recipientName} — ${r.walletLabel}` },
            { label: "Amount Sent",      value: `-$${r.amount}`,                            red: true },
            { label: "Platform Fee (25%)", value: `-$${r.fee ?? (parseFloat(r.amount) * 0.25).toFixed(2)}`,  red: true },
            { label: "Recipient Received", value: `$${r.recipientCredit ?? (parseFloat(r.amount) * 0.75).toFixed(2)}`, green: true },
            ...(r.note ? [{ label: "Narration", value: `"${r.note}"` }] : []),
          ] as ReceiptRow[],
          referenceRow: r.txRef,
          onNewTx: () => { setTxReceiptOpen(false); setView("send"); resetSend(); },
          newTxLabel: "New Transfer",
        });
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
        if (!selectedPlan?.variationId) throw new Error("No data plan selected");
        endpoint = "/api/fintech/data";
        payload = { network: selectedISP, phone: billRef, amount: parseFloat(amount), variationId: selectedPlan.variationId, planLabel: selectedPlan.label };
      } else if (selectedService.id === "electricity") {
        endpoint = "/api/fintech/electricity";
        payload = { discoCode: selectedDisco?.id, meterType, meterNumber: billRef, amount: parseFloat(amount) };
      } else if (selectedService.id === "cable-tv") {
        if (!selectedTvPackage) throw new Error("No TV package selected");
        endpoint = "/api/fintech/cable-tv";
        payload = { serviceId: selectedTvProvider?.id, smartcardNumber: billRef, variationId: selectedTvPackage.variationId, packageName: selectedTvPackage.label, amount: parseFloat(amount) };
      } else if (selectedService.id === "betting") {
        endpoint = "/api/fintech/betting";
        payload = { platform: selectedPlatform, bettingUserId: billRef, amount: parseFloat(amount) };
      }

      const res = await apiRequest("POST", endpoint, payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      const sid = selectedService?.id ?? "bill";
      const titleMap: Record<string, string> = {
        airtime: "Airtime Purchase", internet: "Data Bundle",
        electricity: "Electricity Bill", "cable-tv": "Cable TV Subscription", betting: "Betting Top-up",
      };
      const rows: ReceiptRow[] = [
        { label: "Reference",   value: data.reference || "—",     mono: true },
        { label: "Service",     value: titleMap[sid] || "Bill Payment" },
        { label: "Amount Paid", value: `₦${(data.amountNgn ?? 0).toLocaleString()} NGN`, green: true, bold: true },
      ];

      if (sid === "airtime") {
        rows.push({ label: "Network", value: selectedNetwork?.toUpperCase() || "—" });
        rows.push({ label: "Phone",   value: billRef });
      } else if (sid === "internet") {
        rows.push({ label: "Network", value: selectedISP?.toUpperCase() || "—" });
        rows.push({ label: "Plan",    value: selectedPlan?.label || "—" });
        rows.push({ label: "Phone",   value: billRef });
      } else if (sid === "electricity") {
        rows.push({ label: "Provider", value: selectedDisco?.label || "—" });
        rows.push({ label: "Meter",    value: billRef,   mono: true });
        rows.push({ label: "Type",     value: meterType ?? "prepaid" });
        if (data.customerName) rows.push({ label: "Customer", value: data.customerName });
        if (data.token) rows.push({ label: "PREPAID TOKEN", value: data.token, mono: true, gold: true, bold: true });
      } else if (sid === "cable-tv") {
        rows.push({ label: "Provider",    value: selectedTvProvider?.label || "—" });
        rows.push({ label: "Package",     value: selectedTvPackage?.label || "—" });
        rows.push({ label: "Smartcard",   value: billRef, mono: true });
        if (data.customerName) rows.push({ label: "Customer", value: data.customerName });
      } else if (sid === "betting") {
        rows.push({ label: "Platform", value: selectedPlatform || "—" });
        rows.push({ label: "User ID",  value: billRef });
        if (data.customerName) rows.push({ label: "Customer", value: data.customerName });
      }

      resetBill();
      setView("home");
      setActiveTab("bills");
      setBillPage(0);
      showReceipt({
        title:       titleMap[sid] || "Bill Payment",
        status:      "success",
        amount:      `₦${(data.amountNgn ?? 0).toLocaleString()}`,
        amountLabel: "Nigerian Naira",
        rows,
        referenceRow: data.reference,
        onNewTx: () => { setTxReceiptOpen(false); resetBill(); setView("pay-bill"); },
        newTxLabel: "New Bill",
      });
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
    setLivePlans([]); setLivePlansLoading(false);
    setSelectedDisco(null); setMeterType(null); setElecPhone(""); setElecCustomerName("");
    setSelectedTvProvider(null); setTvPackages([]); setSelectedTvPackage(null); setTvCustomerName("");
    setSelectedPlatform(null);
    setTxResult(null);
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
      <div className="w-full">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-2xl font-medium text-foreground tracking-tight">TSIA</span>
          <span className="text-2xl font-black text-foreground tracking-tight">SWIFT HUB</span>
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mt-1 leading-relaxed">
          Fintech for Educational Empowerment in Africa
        </p>
      </div>

      {/* Greeting — only on home */}
      <div className="bg-gradient-to-r from-tsia-green/10 via-tsia-green/5 to-tsia-gold/10 border border-tsia-green/20 rounded-2xl px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-tsia-green to-tsia-gold flex items-center justify-center shrink-0 shadow-md shadow-tsia-green/20">
          <span className="text-white font-black text-base">{(user?.firstName?.[0] ?? "U").toUpperCase()}</span>
        </div>
        <div>
          <h2 className="text-xl font-bold leading-tight">Hello, {user?.firstName} 👋</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Send money, pay bills &amp; manage transfers</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-6 pr-20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 left-24 w-28 h-28 rounded-full bg-white/5" />
          <div className="relative z-10">
            {/* Label row with currency + wallet switchers */}
            <div className="flex items-center justify-between mb-0.5 gap-2">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-widest truncate">TSIA Bank • Wallet Balance</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <WalletAccountSwitcher />
                <button onClick={() => setShowLocalBalance(v => !v)}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-2 py-0.5"
                  data-testid="btn-switch-currency">
                  <RefreshCcw className="w-2.5 h-2.5 text-white/60" />
                  <span className="text-[9px] font-bold text-white/60">{showLocalBalance ? "USD" : (currency?.code ?? "NGN")}</span>
                </button>
              </div>
            </div>
            {/* Balance amount */}
            <div className="flex items-end gap-2 mb-1">
              <p className="text-4xl font-black text-white tracking-tight">
                {balanceHidden ? "••••••" : showLocalBalance ? formatAmount(balance) : `$${balance.toFixed(2)}`}
              </p>
              <button onClick={toggleHidden} className="mb-1 text-white/60 hover:text-white transition-colors" data-testid="btn-toggle-balance">
                {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Conversational rate hint */}
            {!balanceHidden && !showLocalBalance && currency?.code !== "USD" && (
              <p className="text-white/50 text-[10px] mb-2">≈ {formatAmount(balance)} {currency?.code}</p>
            )}
            {/* Ledger / Book balance */}
            {!balanceHidden && (
              <div className="flex items-center gap-1.5 mb-2" data-testid="text-ledger-balance">
                <BookMarked className="w-3 h-3 text-amber-300/90" />
                <p className="text-amber-300/90 text-[11px] font-semibold">
                  Ledger balance: ${bookBalance.toFixed(2)}
                  {pendingAmount > 0 && (
                    <span className="text-amber-300/70 font-medium"> · +${pendingAmount.toFixed(2)} pending</span>
                  )}
                </p>
              </div>
            )}
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
        <button onClick={() => { setFundMethod("squad"); setFundAmount(""); setCryptoAmount(""); setCryptoTxHash(""); setView("fund"); }}
          className="absolute right-0 top-0 h-full w-16 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-white/30 bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="btn-add-money">
          <span className="text-white text-2xl font-black">+</span>
          <p className="text-white text-[9px] font-bold tracking-wider" style={{ writingMode: "vertical-rl" }}>ADD MONEY</p>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: ArrowDownLeft, label: "Fund",     color: "bg-emerald-600", action: () => { setFundMethod("squad"); setFundAmount(""); setCryptoAmount(""); setCryptoTxHash(""); setView("fund"); } },
          { icon: Send,          label: "Send",     color: "bg-tsia-green",  action: () => { resetSend(); setView("send"); } },
          { icon: Bell,          label: "Request",  color: "bg-violet-500",  action: () => setView("request") },
          { icon: Receipt,       label: "Pay Bill", color: "bg-amber-500",   action: () => { resetBill(); setView("pay-bill"); } },
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
          {SERVICES.map((svc: any) => {
            const cs = !!svc.comingSoon;
            return (
              <button key={svc.id}
                onClick={() => {
                  if (cs) { toast({ title: `${svc.label} coming soon`, description: "We're integrating a licensed provider. Stay tuned." }); return; }
                  resetBill(); setSelectedService(svc); setView("service");
                }}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl ${svc.bg} hover:shadow-md transition-shadow ${cs ? "opacity-60" : ""}`}
                data-testid={`btn-service-${svc.id}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                  <svc.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-semibold text-foreground">{svc.label}</span>
                {cs && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-bold uppercase tracking-wide shadow">Soon</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Virtual Card */}
      <div>
        <h3 className="font-bold text-sm mb-3">Virtual US Mastercard <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide">Coming Soon</span></h3>
        {false && vcData?.card ? (
          <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d6a4f 50%, #b8860b 100%)" }}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/20" />
              <div className="absolute bottom-4 left-8 w-24 h-24 rounded-full bg-white/10" />
            </div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/80 text-xs font-semibold tracking-wider">TSIA SwiftWallet</span>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest">Virtual</p>
                  <p className="text-white font-bold text-sm">MASTERCARD</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">Card Number</p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-mono text-base tracking-widest font-bold">
                    {cardRevealed ? vcData.card.cardNumber : vcData.card.cardNumber.replace(/\d(?=.* \d{4}$)/g, "●").replace(/\d{4} \d{4} \d{4}/, "●●●● ●●●● ●●●●")}
                  </p>
                  <button onClick={() => copyToClipboard(vcData.card.cardNumber, "card")} className="text-white/60 hover:text-white transition-colors" data-testid="btn-copy-card-number">
                    {vcCopied === "card" ? <CheckCircle2 className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-white/60 text-[10px] uppercase tracking-widest mb-0.5">Card Holder</p>
                  <p className="text-white font-semibold text-sm">{vcData.card.cardHolder}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/60 text-[10px] uppercase tracking-widest mb-0.5">Expires</p>
                  <p className="text-white font-semibold text-sm">{vcData.card.expiryMonth}/{vcData.card.expiryYear}</p>
                </div>
                <div>
                  <p className="text-white/60 text-[10px] uppercase tracking-widest mb-0.5">CVV</p>
                  <div className="flex items-center gap-1">
                    <p className="text-white font-mono font-semibold text-sm">{cardRevealed ? vcData.card.cvv : "●●●"}</p>
                    {cardRevealed && (
                      <button onClick={() => copyToClipboard(vcData.card.cvv, "cvv")} className="text-white/60 hover:text-white transition-colors" data-testid="btn-copy-cvv">
                        {vcCopied === "cvv" ? <CheckCircle2 className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="relative px-5 py-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex gap-1">
                <div className="w-7 h-7 rounded-full bg-red-500 opacity-90" />
                <div className="w-7 h-7 rounded-full bg-amber-400 opacity-90 -ml-3" />
              </div>
              <button onClick={() => setCardRevealed(p => !p)}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition-colors"
                data-testid="btn-toggle-card-reveal">
                {cardRevealed ? <><EyeOff className="w-3.5 h-3.5" /> Hide Details</> : <><Eye className="w-3.5 h-3.5" /> Reveal Details</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-amber-500/30 p-6 flex flex-col items-center gap-3 bg-amber-50/40 dark:bg-amber-900/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/30 to-tsia-gold/30 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">Virtual US Mastercard — Coming Soon</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">We're integrating with a licensed card issuer (Bridgecard / Sudo) to bring you real, fundable virtual cards for online USD purchases worldwide. Stay tuned.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full text-xs text-muted-foreground max-w-xs">
              {["Real issuer-backed", "Fund from wallet", "Global online use", "Freeze / unfreeze"].map(f => (
                <div key={f} className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">History</h3>
          <div className="flex bg-muted/40 rounded-xl p-0.5 text-xs">
            <button onClick={() => { setActiveTab("transfers"); setTransferPage(0); }}      className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "transfers"      ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Transfers</button>
            <button onClick={() => { setActiveTab("bank-transfers"); setBankTxPage(0); }} className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "bank-transfers" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Bank</button>
            <button onClick={() => { setActiveTab("bills"); setBillPage(0); }}            className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "bills"          ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Bills</button>
          </div>
        </div>
        <div className="space-y-2">
          {activeTab === "bank-transfers" ? (
            (() => {
              const bankTxs = (bills as BillRecord[]).filter(b => b.service === "bank_transfer");
              if (bankTxs.length === 0) return <EmptyState icon={Building2} msg="No bank transfers yet" />;
              const btTotalPages = Math.ceil(bankTxs.length / FH_PAGE_SIZE);
              const btPageItems = bankTxs.slice(bankTxPage * FH_PAGE_SIZE, (bankTxPage + 1) * FH_PAGE_SIZE);
              return (<>{btPageItems.map(b => {
                const btStatus: "success" | "pending" | "processing" =
                  b.status === "completed" ? "success" : b.status === "pending" ? "pending" : "processing";
                const btDate = new Date(b.createdAt).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                });
                let btDetails: any = {};
                try { btDetails = JSON.parse(b.reference); } catch { btDetails = { txRef: b.reference }; }
                const openBtReceipt = () => showReceipt({
                  status: btStatus,
                  title: "Bank Transfer",
                  amount: `₦${Number(btDetails.netAmountNgn ?? 0).toLocaleString()}`,
                  amountLabel: `$${parseFloat(b.amount).toFixed(2)}`,
                  timestamp: btDate,
                  referenceRow: btDetails.txRef || b.reference,
                  rows: [
                    { label: "Reference",    value: btDetails.txRef || b.reference, mono: true },
                    { label: "Recipient",    value: btDetails.accountName || "—" },
                    { label: "Account No",   value: btDetails.accountNumber || "—", mono: true },
                    { label: "Bank",         value: btDetails.bankName || "—" },
                    { label: "Amount (NGN)", value: `₦${Number(btDetails.netAmountNgn ?? 0).toLocaleString()}`, bold: true, green: true },
                    { label: "Amount (USD)", value: `$${parseFloat(b.amount).toFixed(2)}` },
                    { label: "Date",         value: btDate },
                    { label: "Status",       value: btStatus === "success" ? "Completed" : btStatus === "pending" ? "Pending Approval" : "Processing",
                      green: btStatus === "success", gold: btStatus === "processing", red: btStatus === "pending" },
                  ],
                });
                return (
                  <button key={b.id} onClick={openBtReceipt}
                    className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:bg-muted/30 active:scale-[0.99] transition-all text-left"
                    data-testid={`row-bank-transfer-${b.id}`}>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{btDetails.accountName || "Bank Transfer"}</p>
                      <p className="text-xs text-muted-foreground truncate">{btDetails.bankName || btDetails.txRef || b.reference}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-red-500">−${parseFloat(b.amount).toFixed(2)}</p>
                      <p className={`text-[10px] font-semibold ${btStatus === "success" ? "text-tsia-green" : btStatus === "pending" ? "text-amber-500" : "text-blue-500"}`}>
                        {btStatus === "success" ? "Sent" : btStatus === "pending" ? "Pending" : "Processing"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })}
              {btTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setBankTxPage(p => Math.max(0, p - 1))} disabled={bankTxPage === 0} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                  <span className="text-xs text-muted-foreground">Page {bankTxPage + 1} of {btTotalPages}</span>
                  <button onClick={() => setBankTxPage(p => Math.min(btTotalPages - 1, p + 1))} disabled={bankTxPage >= btTotalPages - 1} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                </div>
              )}
              </>);
            })()
          ) : activeTab === "transfers" ? (
            (() => {
              const allTx = transfers as TransferRecord[];
              if (allTx.length === 0) return <EmptyState icon={Send} msg="No transfers yet" />;
              const txTotalPages = Math.ceil(allTx.length / FH_PAGE_SIZE);
              const txPageItems = allTx.slice(transferPage * FH_PAGE_SIZE, (transferPage + 1) * FH_PAGE_SIZE);
              return (<>{txPageItems.map(t => {
                  const isOut = t.senderId === user?.id;
                  const txStatus: "success" | "pending" | "processing" =
                    t.status === "completed" ? "success" : t.status === "pending" ? "pending" : "processing";
                  const txDate = new Date(t.createdAt).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                  });
                  const openTransferReceipt = () => showReceipt({
                    status: txStatus,
                    title: isOut ? "Money Sent" : "Money Received",
                    amount: `$${parseFloat(t.amount).toFixed(2)}`,
                    timestamp: txDate,
                    referenceRow: `TSIA-TX-${t.id}`,
                    rows: [
                      { label: "Reference",  value: `TSIA-TX-${t.id}`, mono: true },
                      { label: "Sender",     value: isOut ? `${user?.firstName} ${user?.lastName} (You)` : (t.senderName || "TSIA Member") },
                      { label: "Recipient",  value: isOut ? (t.recipientName || "TSIA Member") : `${user?.firstName} ${user?.lastName} (You)` },
                      { label: "Amount",     value: `$${parseFloat(t.amount).toFixed(2)}`, bold: true },
                      { label: "Note",       value: t.note || "None" },
                      { label: "Date",       value: txDate },
                      { label: "Status",     value: txStatus === "success" ? "Completed" : txStatus === "pending" ? "Pending" : "Processing",
                        green: txStatus === "success", gold: txStatus === "processing", red: txStatus === "pending" },
                    ],
                  });
                  return (
                    <button key={t.id} onClick={openTransferReceipt}
                      className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:bg-muted/30 active:scale-[0.99] transition-all text-left"
                      data-testid={`row-transfer-${t.id}`}>
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                    </button>
                  );
                })}
                {txTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setTransferPage(p => Math.max(0, p - 1))} disabled={transferPage === 0} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                    <span className="text-xs text-muted-foreground">Page {transferPage + 1} of {txTotalPages}</span>
                    <button onClick={() => setTransferPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={transferPage >= txTotalPages - 1} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                  </div>
                )}
                </>);
              })()
          ) : (
            (() => {
              const billItems = (bills as BillRecord[]).filter(b => b.service !== "bank_transfer");
              if (billItems.length === 0) return <EmptyState icon={Receipt} msg="No bill payments yet" />;
              const blTotalPages = Math.ceil(billItems.length / FH_PAGE_SIZE);
              const blPageItems = billItems.slice(billPage * FH_PAGE_SIZE, (billPage + 1) * FH_PAGE_SIZE);
              return (<>{blPageItems.map(b => {
                const svc = SERVICES.find(s => s.id === b.service) || SERVICES[0];
                const billStatus: "success" | "pending" | "processing" =
                  b.status === "completed" ? "success" : b.status === "pending" ? "pending" : "processing";
                const billDate = new Date(b.createdAt).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                });
                const openBillReceipt = () => showReceipt({
                  status: billStatus,
                  title: `${svc.label} Payment`,
                  amount: `$${parseFloat(b.amount).toFixed(2)}`,
                  timestamp: billDate,
                  referenceRow: b.reference,
                  rows: [
                    { label: "Reference", value: b.reference, mono: true },
                    { label: "Service",   value: svc.label },
                    { label: "Amount",    value: `$${parseFloat(b.amount).toFixed(2)}`, bold: true },
                    { label: "Date",      value: billDate },
                    { label: "Status",    value: billStatus === "success" ? "Completed" : billStatus === "pending" ? "Pending" : "Processing",
                      green: billStatus === "success", gold: billStatus === "processing", red: billStatus === "pending" },
                  ],
                });
                return (
                  <button key={b.id} onClick={openBillReceipt}
                    className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:bg-muted/30 active:scale-[0.99] transition-all text-left"
                    data-testid={`row-bill-${b.id}`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                      <svc.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm capitalize">{svc.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.reference.includes(" | Ref: ")
                          ? b.reference.split(" | Ref: ")[0]
                          : b.reference}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-red-500">−${parseFloat(b.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })}
              {blTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setBillPage(p => Math.max(0, p - 1))} disabled={billPage === 0} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                  <span className="text-xs text-muted-foreground">Page {billPage + 1} of {blTotalPages}</span>
                  <button onClick={() => setBillPage(p => Math.min(blTotalPages - 1, p + 1))} disabled={billPage >= blTotalPages - 1} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                </div>
              )}
              </>);
            })()
          )}
        </div>
      </div>

      {/* Universal Transaction Receipt Dialog */}
      {txReceiptProps && (
        <TransactionReceipt
          open={txReceiptOpen}
          onClose={() => { setTxReceiptOpen(false); setTxReceiptProps(null); }}
          {...txReceiptProps}
        />
      )}

      {/* ── Virtual Card Setup Wizard ─────────────────────────────────────── */}
      <Dialog open={vcWizardOpen} onOpenChange={open => { if (!purchaseCardMutation.isPending) setVcWizardOpen(open); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tsia-green/20 to-tsia-gold/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-tsia-gold" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Virtual Card Setup</DialogTitle>
                <p className="text-xs text-muted-foreground">Step {vcWizardStep} of 3</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="flex gap-1.5 mt-1">
              {[1,2,3].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= vcWizardStep ? "bg-tsia-green" : "bg-muted"}`} />
              ))}
            </div>
          </DialogHeader>

          {/* Step 1 — Billing Details */}
          {vcWizardStep === 1 && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-semibold text-foreground">Cardholder & Billing Address</p>
              <p className="text-xs text-muted-foreground">This information will be printed on your virtual card and used for billing verification.</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-semibold">Full Name (as on card)</Label>
                  <Input
                    value={vcName} onChange={e => setVcName(e.target.value)}
                    placeholder="e.g. John A. Smith" className="mt-1 h-9 text-sm"
                    data-testid="input-vc-name" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Street Address</Label>
                  <Input
                    value={vcAddress} onChange={e => setVcAddress(e.target.value)}
                    placeholder="e.g. 12 Baker Street" className="mt-1 h-9 text-sm"
                    data-testid="input-vc-address" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">City</Label>
                    <Input value={vcCity} onChange={e => setVcCity(e.target.value)} placeholder="Lagos" className="mt-1 h-9 text-sm" data-testid="input-vc-city" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">State / Region</Label>
                    <Input value={vcRegion} onChange={e => setVcRegion(e.target.value)} placeholder="Lagos State" className="mt-1 h-9 text-sm" data-testid="input-vc-region" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Postal / ZIP Code</Label>
                  <Input
                    value={vcZip} onChange={e => setVcZip(e.target.value.replace(/\D/g,"").slice(0,10))}
                    placeholder="100001" className="mt-1 h-9 text-sm" data-testid="input-vc-zip" />
                </div>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-tsia-green to-tsia-gold text-white font-bold rounded-xl"
                disabled={!vcStep1Valid}
                onClick={() => setVcWizardStep(2)}
                data-testid="btn-vc-next-step1">
                Continue — Set PIN
              </Button>
            </div>
          )}

          {/* Step 2 — PIN Setup */}
          {vcWizardStep === 2 && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-semibold text-foreground">Set Your Card PIN</p>
              <p className="text-xs text-muted-foreground">Choose a secure 4-digit PIN. You'll use this to authorise transactions on your virtual card.</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-semibold">4-Digit PIN</Label>
                  <div className="relative mt-1">
                    <Input
                      type={vcPinVisible ? "text" : "password"}
                      value={vcPin} onChange={e => setVcPin(e.target.value.replace(/\D/g,"").slice(0,4))}
                      placeholder="••••" className="h-9 text-sm font-mono tracking-widest pr-10"
                      data-testid="input-vc-pin" />
                    <button type="button" onClick={() => setVcPinVisible(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {vcPinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Confirm PIN</Label>
                  <Input
                    type={vcPinVisible ? "text" : "password"}
                    value={vcPinConfirm} onChange={e => setVcPinConfirm(e.target.value.replace(/\D/g,"").slice(0,4))}
                    placeholder="••••" className="mt-1 h-9 text-sm font-mono tracking-widest"
                    data-testid="input-vc-pin-confirm" />
                </div>
                {vcPinErr && <p className="text-xs text-red-500 font-medium">{vcPinErr}</p>}
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3">
                  <Shield className="w-3.5 h-3.5 text-tsia-green shrink-0 mt-0.5" />
                  <span>Your PIN is encrypted and never stored in plain text. Keep it secret — TSIA staff will never ask for it.</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => setVcWizardStep(1)} data-testid="btn-vc-back-step2">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-tsia-green to-tsia-gold text-white font-bold rounded-xl text-sm"
                  disabled={!vcStep2Valid}
                  onClick={handleVcStep2Next}
                  data-testid="btn-vc-next-step2">
                  Review & Pay
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirm & Pay */}
          {vcWizardStep === 3 && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-semibold text-foreground">Review & Activate</p>
              <div className="rounded-xl border bg-muted/30 divide-y divide-border text-sm overflow-hidden">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">Name on card</span>
                  <span className="font-semibold text-xs">{vcName}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">Address</span>
                  <span className="font-semibold text-xs text-right max-w-[55%]">{vcAddress}, {vcCity}{vcRegion ? `, ${vcRegion}` : ""}{vcZip ? ` ${vcZip}` : ""}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">PIN</span>
                  <span className="font-semibold text-xs font-mono">{"●".repeat(vcPin.length)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground text-xs">Card Type</span>
                  <span className="font-semibold text-xs">Virtual US Mastercard</span>
                </div>
                <div className="flex justify-between px-3 py-2 bg-tsia-green/5">
                  <span className="text-muted-foreground text-xs font-semibold">Setup Fee</span>
                  <span className="font-bold text-tsia-gold text-sm">$5.00</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">$5.00 will be deducted from your TSIA SwiftWallet balance (current: <span className="font-bold text-foreground">${balance.toFixed(2)}</span>)</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl text-sm" onClick={() => setVcWizardStep(2)}
                  disabled={purchaseCardMutation.isPending} data-testid="btn-vc-back-step3">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-tsia-green to-tsia-gold text-white font-bold rounded-xl text-sm"
                  disabled={purchaseCardMutation.isPending || balance < 5}
                  onClick={() => purchaseCardMutation.mutate({ billingName: vcName, billingAddress: vcAddress, billingCity: vcCity, billingRegion: vcRegion, billingZip: vcZip, pin: vcPin })}
                  data-testid="btn-vc-confirm-pay">
                  {purchaseCardMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Activating…</>
                    : <><CreditCard className="w-4 h-4 mr-1.5" />Pay $5 &amp; Activate</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // FUND ACCOUNT
  // ═════════════════════════════════════════════════════════════════════════
  if (view === "fund") return (
    <AnimatePresence mode="wait">
      <motion.div key="fund" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-4">
        <BackHeader onBack={() => { setFundAmount(""); setCryptoAmount(""); setCryptoTxHash(""); setView("home"); }} title="Fund Account" sub="Add money to your TSIA wallet" />

        {/* Balance pill */}
        <div className="flex items-center justify-between bg-gradient-to-r from-tsia-green/10 to-tsia-gold/10 border border-tsia-green/20 rounded-2xl px-4 py-3">
          <span className="text-sm text-muted-foreground font-medium">Current Balance</span>
          <span className="text-lg font-black text-tsia-green">${balance.toFixed(2)}</span>
        </div>

        {/* Method tabs */}
        <div className="flex bg-muted/40 rounded-2xl p-1 gap-1">
          <button onClick={() => setFundMethod("squad")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "squad" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            data-testid="btn-fund-method-squad">
            <CreditCard className="w-3.5 h-3.5" /> Squad
          </button>
          <button onClick={() => setFundMethod("korapay")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "korapay" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            data-testid="btn-fund-method-korapay">
            <Building2 className="w-3.5 h-3.5" /> Korapay
          </button>
          <button onClick={() => setFundMethod("crypto")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${fundMethod === "crypto" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            data-testid="btn-fund-method-crypto">
            <Coins className="w-3.5 h-3.5" /> Crypto
          </button>
        </div>

        {/* ── SQUAD ── */}
        {fundMethod === "squad" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Transfer" }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 bg-muted/50 rounded-2xl p-3">
                  <Icon className="w-5 h-5 text-tsia-green" />
                  <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-sm font-semibold">Amount (USD)</Label>
              <Input type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                className="mt-1.5 text-lg font-bold h-12" data-testid="input-fund-amount" />
              {parseFloat(fundAmount) > 0 && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(fundAmount))} {rateLabel()}</p>
                  {(currency?.code ?? "NGN") !== "USD" && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      ≈ <span className="font-semibold">{formatAmountVAT(parseFloat(fundAmount))}</span>
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">incl. 7.5% VAT</span>
                    </p>
                  )}
                  {parseFloat(fundAmount) > 2 && (
                    <div className="mt-1 text-xs border border-border rounded-xl px-3 py-2 bg-muted/30 space-y-0.5" data-testid="deposit-fee-breakdown">
                      <div className="flex justify-between text-muted-foreground"><span>Affiliate pool (5%)</span><span className="text-red-500">-${(parseFloat(fundAmount) * 0.05).toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold text-tsia-green"><span>You receive (95%)</span><span>${(parseFloat(fundAmount) * 0.95).toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[10, 25, 50, 100, 200, 500].map(amt => (
                <button key={amt} onClick={() => setFundAmount(String(amt))}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${fundAmount === String(amt) ? "border-tsia-green bg-tsia-green/10 text-tsia-green" : "border-border hover:border-tsia-green/40"}`}>
                  ${amt}
                </button>
              ))}
            </div>
            {/* Conversational rate card */}
            {currency?.code && currency.code !== "USD" && (
              <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
                <RefreshCcw className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
                <p className="text-xs text-tsia-green leading-relaxed">
                  Today's rate: <strong>1 USD ≈ {formatAmount(1)}</strong>
                </p>
              </div>
            )}
            <div className="flex items-start gap-2 bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3">
              <Shield className="w-4 h-4 text-tsia-green shrink-0 mt-0.5" />
              <p className="text-xs text-tsia-green">Secure inline checkout — card, bank transfer, USSD &amp; mobile money supported.</p>
            </div>
            <Button onClick={openSquadModal}
              disabled={squadLoading || !fundAmount || parseFloat(fundAmount) <= 2}
              className="w-full h-12 bg-gradient-to-r from-tsia-green to-tsia-gold text-white font-bold rounded-2xl"
              data-testid="btn-pay-squad">
              {squadLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening payment…</> : <><CreditCard className="w-4 h-4 mr-2" />Pay ${parseFloat(fundAmount || "0").toFixed(2)} via Squad</>}
            </Button>
          </div>
        )}

        {/* ── KORAPAY ── */}
        {fundMethod === "korapay" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[{ icon: CreditCard, label: "Card" }, { icon: Building2, label: "Bank" }, { icon: Smartphone, label: "USSD" }, { icon: Banknote, label: "Virtual" }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 bg-muted/50 rounded-2xl p-3">
                  <Icon className="w-5 h-5 text-orange-500" />
                  <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-sm font-semibold">Amount (USD)</Label>
              <Input type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                className="mt-1.5 text-lg font-bold h-12" data-testid="input-fund-amount-korapay" />
              {parseFloat(fundAmount) > 0 && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(fundAmount))} {rateLabel()}</p>
                  {parseFloat(fundAmount) > 2 && (
                    <div className="mt-1 text-xs border border-border rounded-xl px-3 py-2 bg-muted/30 space-y-0.5" data-testid="deposit-fee-breakdown-korapay">
                      <div className="flex justify-between text-muted-foreground"><span>Affiliate pool (5%)</span><span className="text-red-500">-${(parseFloat(fundAmount) * 0.05).toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold text-tsia-green"><span>You receive (95%)</span><span>${(parseFloat(fundAmount) * 0.95).toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[10, 25, 50, 100, 200, 500].map(amt => (
                <button key={amt} onClick={() => setFundAmount(String(amt))}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${fundAmount === String(amt) ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600" : "border-border hover:border-orange-400/40"}`}>
                  ${amt}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <Shield className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700 dark:text-orange-300">Opens in a new tab. Payment is auto-verified when complete.</p>
            </div>
            {koraLoading && koraReference && (
              <div className="bg-tsia-green/5 border border-tsia-green/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-tsia-green animate-spin shrink-0" />
                  <p className="text-xs font-semibold text-tsia-green">Waiting for payment confirmation…</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Completed payment? Tap below to confirm instantly.</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs bg-tsia-green text-white rounded-xl" onClick={() => verifyKoraPayment(koraReference)} data-testid="btn-kora-i-have-paid">
                    ✓ I've Paid — Check Now
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground rounded-xl" onClick={stopKoraPoll} data-testid="btn-kora-cancel">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <Button onClick={openKorapayCheckout}
              disabled={koraLoading || !fundAmount || parseFloat(fundAmount) <= 2}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl"
              data-testid="btn-pay-korapay">
              {koraLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening Korapay…</> : <><ExternalLink className="w-4 h-4 mr-2" />Pay ${parseFloat(fundAmount || "0").toFixed(2)} via Korapay</>}
            </Button>
          </div>
        )}

        {/* ── CRYPTO ── */}
        {fundMethod === "crypto" && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Select Network</Label>
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
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">TSIA Receiving Address ({cryptoNetwork.toUpperCase()})</Label>
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2.5 border">
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
            <div>
              <Label className="text-sm font-semibold">Amount (USD)</Label>
              <Input type="number" min={2.01} step={0.01} placeholder="Above $2.00"
                value={cryptoAmount} onChange={e => setCryptoAmount(e.target.value)}
                className="mt-1.5 text-lg font-bold h-12" data-testid="input-crypto-amount" />
              {parseFloat(cryptoAmount) > 0 && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-muted-foreground">≈ {formatAmount(parseFloat(cryptoAmount))} {rateLabel()}</p>
                  {parseFloat(cryptoAmount) > 2 && (
                    <div className="text-xs border border-border rounded-xl px-3 py-2 bg-muted/30 space-y-0.5" data-testid="deposit-fee-breakdown-crypto">
                      <div className="flex justify-between text-muted-foreground"><span>Affiliate pool (5%)</span><span className="text-red-500">-${(parseFloat(cryptoAmount) * 0.05).toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold text-tsia-green"><span>You receive (95%)</span><span>${(parseFloat(cryptoAmount) * 0.95).toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-semibold">Transaction Hash (TxID)</Label>
              <Input placeholder="Paste your USDT transaction hash here"
                value={cryptoTxHash} onChange={e => setCryptoTxHash(e.target.value)}
                className="mt-1.5 font-mono text-xs" data-testid="input-crypto-txhash" />
              <p className="text-[11px] text-muted-foreground mt-1">Copy the TxID from your crypto wallet after sending.</p>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">Crypto deposits are auto-verified on-chain. Processing typically takes up to 30 minutes. Minimum deposit is $2.01. A 5% affiliate pool applies; 95% is credited to your wallet.</p>
            </div>
            <Button onClick={() => cryptoDepositMutation.mutate()}
              disabled={cryptoDepositMutation.isPending || !cryptoTxHash.trim() || parseFloat(cryptoAmount) <= 2}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-2xl"
              data-testid="btn-submit-crypto">
              {cryptoDepositMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : <><Coins className="w-4 h-4 mr-2" />Submit Crypto Deposit</>}
            </Button>
          </div>
        )}

        {/* Recent deposits */}
        {(walletDeposits as any[]).length > 0 && (() => {
          const allDeps = walletDeposits as any[];
          const dpTotalPages = Math.ceil(allDeps.length / FH_PAGE_SIZE);
          const dpPage = allDeps.slice(depositPage * FH_PAGE_SIZE, (depositPage + 1) * FH_PAGE_SIZE);
          return (
            <div>
              <h3 className="font-bold text-sm mb-3">Deposit History</h3>
              <div className="space-y-2">
                {dpPage.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${d.status === "completed" ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                      {d.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-tsia-green" /> : <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold capitalize">{d.walletType === "squad" ? "Squad (Card/Bank)" : d.walletType === "paystack" ? "Card/Bank" : d.walletType === "korapay" ? "Korapay" : d.walletType?.toUpperCase()} Deposit</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{d.txHash}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-tsia-green">+${parseFloat(d.amountUsd).toFixed(2)}</p>
                      <p className={`text-[10px] font-semibold capitalize ${d.status === "completed" ? "text-tsia-green" : "text-amber-500"}`}>{d.status}</p>
                    </div>
                  </div>
                ))}
                {dpTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setDepositPage(p => Math.max(0, p - 1))} disabled={depositPage === 0} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">← Prev</button>
                    <span className="text-xs text-muted-foreground">Page {depositPage + 1} of {dpTotalPages}</span>
                    <button onClick={() => setDepositPage(p => Math.min(dpTotalPages - 1, p + 1))} disabled={depositPage >= dpTotalPages - 1} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-40 transition-colors">Next →</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </motion.div>
    </AnimatePresence>
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
                        <button key={b.code} onClick={() => { setSelectedBank(b); setBankDropOpen(false); setBankSearch(""); setAcctNumber(""); setResolvedName(null); if (b.gateway) setBankGateway(b.gateway); }}
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
          <LocalEquiv usd={parseFloat(amount) || 0} country={user?.country} />
          {parseFloat(amount) > balance && <p className="text-xs text-red-500 font-semibold mt-1">Exceeds your balance</p>}
        </div>

        <input placeholder="Narration (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-tsia-green/40"
          data-testid="input-narration" />

        {/* Gateway picker */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payout Gateway</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "squad",   label: "Primary",        desc: "Instant bank payout", color: "border-tsia-green bg-tsia-green/5 text-tsia-green" },
              { id: "korapay", label: "Alternative",     desc: "Backup payout route",  color: "border-orange-400 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
            ] as const).map(g => (
              <button key={g.id} onClick={() => setBankGateway(g.id)}
                className={`rounded-xl border-2 p-2.5 text-left transition-all ${bankGateway === g.id ? g.color : "border-border text-muted-foreground"}`}
                data-testid={`btn-gateway-${g.id}`}>
                <p className="text-xs font-bold">{g.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{g.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
          <Button className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
            disabled={sendBankMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            onClick={() => sendBankMutation.mutate()} data-testid="btn-send-bank">
            {sendBankMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            Send ${fmt(amount)} via {bankGateway === "korapay" ? "Korapay" : "Squad"}
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
          <LocalEquiv usd={parseFloat(amount) || 0} country={user?.country} />
          {parseFloat(amount) > balance && <p className="text-xs text-red-500 font-semibold mt-1">Exceeds your balance</p>}
        </div>

        <input placeholder="What's this for? (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-tsia-green/40"
          data-testid="input-tsia-note" />

        {parseFloat(amount) > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-xs space-y-1" data-testid="transfer-fee-breakdown">
            <p className="font-bold text-amber-800 dark:text-amber-300">Platform Service Fee (25%)</p>
            <div className="flex justify-between text-muted-foreground"><span>You send</span><span className="font-semibold text-foreground">${fmt(amount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Platform fee (25%)</span><span className="text-red-500">-${(parseFloat(amount) * 0.25).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-tsia-green"><span>Recipient receives</span><span>${(parseFloat(amount) * 0.75).toFixed(2)}</span></div>
          </div>
        )}

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
          <Button className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
            disabled={requestTransferOtpMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            onClick={() => { requestTransferOtpMutation.mutate(); }} data-testid="btn-send-tsia">
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
            <span className="text-muted-foreground">You send</span>
            <span className="font-black text-tsia-green text-lg">${fmt(amount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Platform fee (25%)</span>
            <span className="font-semibold text-red-500">-${(parseFloat(amount) * 0.25).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-tsia-green/20 pt-2">
            <span className="text-muted-foreground font-semibold">Recipient gets</span>
            <span className="font-black text-tsia-green">${(parseFloat(amount) * 0.75).toFixed(2)}</span>
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
            onClick={() => { sendTsiaMutation.mutate(); }}
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
  // (TSIA Transfer receipt now handled by the universal TransactionReceipt dialog)

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
                {livePlansLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading live plans…
                  </div>
                ) : (() => {
                  // Use live plans if available, otherwise fall back to hardcoded plans
                  const fallbackPlans = (DATA_PLANS[selectedISP!] ?? []).map(p => ({
                    variationId: p.id,
                    label: `${p.label} — ${p.validity}`,
                    priceNgn: Math.round(p.price * 1600),
                  }));
                  const displayPlans = livePlans.length > 0 ? livePlans : fallbackPlans;
                  const usingFallback = livePlans.length === 0 && fallbackPlans.length > 0;
                  return displayPlans.length > 0 ? (
                    <>
                      {usingFallback && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" /> Showing estimated plans — live pricing loads on purchase
                        </p>
                      )}
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {displayPlans.map(plan => {
                          const priceUsd = plan.priceNgn / 1600;
                          return (
                            <button key={plan.variationId} onClick={() => setSelectedPlan(plan)}
                              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${selectedPlan?.variationId === plan.variationId ? "border-tsia-green bg-green-50 dark:bg-green-900/20" : "border-border bg-card hover:border-tsia-green/40"}`}>
                              <div className="text-left">
                                <p className="font-bold text-sm">{plan.label}</p>
                                <p className="text-xs text-muted-foreground">₦{plan.priceNgn.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-tsia-green">${priceUsd.toFixed(2)}</span>
                                {selectedPlan?.variationId === plan.variationId && <CheckCircle2 className="w-4 h-4 text-tsia-green" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No plans available for this network right now. Try again shortly.</p>
                  );
                })()}
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
              onClick={() => {
                const priceUsd = (selectedPlan!.priceNgn / 1600).toFixed(2);
                setAmount(priceUsd);
                setBillStep("amount");
              }}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>) : billStep === "success" && txResult ? (<>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-blue-600" /></div>
              <div><h3 className="font-black text-xl text-blue-600">Data Bundle Activated ✓</h3><p className="text-muted-foreground text-sm mt-1">{selectedISP?.toUpperCase()} • {selectedPlan?.label} • {billRef}</p></div>
              <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-blue-600 text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>Done</Button>
            </div>
          </>) : (<>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-3xl p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{selectedISP?.toUpperCase()} Data</p>
              <p className="text-4xl font-black text-blue-700">{selectedPlan?.label}</p>
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
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {BETTING_PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                    className={`py-3 rounded-2xl font-bold text-xs transition-all ${p.color} ${p.text} ${selectedPlatform === p.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
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

    // ── CABLE TV ─────────────────────────────────────────────────────────
    if (selectedService.id === "cable-tv") return (
      <AnimatePresence mode="wait">
        <motion.div key="cable-tv" initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }} className="space-y-5">
          <BackHeader onBack={() => billStep === "success" ? (resetBill(), setView("home")) as any : billStep === "amount" ? setBillStep("details") : setView("pay-bill")} title="Cable TV" sub={billStep === "details" ? "Select provider & package" : billStep === "success" ? "Subscription Complete" : "Confirm subscription"} />

          {billStep === "details" ? (<>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">TV Provider</label>
              <div className="grid grid-cols-2 gap-3">
                {TV_PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => { setSelectedTvProvider(p); setSelectedTvPackage(null); setBillRef(""); setTvCustomerName(""); }}
                    className={`py-3.5 rounded-2xl font-bold text-sm transition-all ${p.color} ${p.text} ${selectedTvProvider?.id === p.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                    data-testid={`btn-tv-${p.id}`}>{p.label}</button>
                ))}
              </div>
            </div>

            {selectedTvProvider && (<>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Select Package</label>
                {tvPackagesLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading packages…
                  </div>
                ) : tvPackages.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {tvPackages.map(pkg => {
                      const priceUsd = (pkg.priceNgn / 1600).toFixed(2);
                      return (
                        <button key={pkg.variationId} onClick={() => setSelectedTvPackage(pkg)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${selectedTvPackage?.variationId === pkg.variationId ? "border-tsia-green bg-green-50 dark:bg-green-900/20" : "border-border bg-card hover:border-tsia-green/40"}`}
                          data-testid={`btn-tv-pkg-${pkg.variationId}`}>
                          <div className="text-left">
                            <p className="font-bold text-sm">{pkg.label}</p>
                            <p className="text-xs text-muted-foreground">₦{pkg.priceNgn.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-tsia-green">${priceUsd}</span>
                            {selectedTvPackage?.variationId === pkg.variationId && <CheckCircle2 className="w-4 h-4 text-tsia-green" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No packages found. Try a different provider.</p>
                )}
              </div>

              {selectedTvPackage && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Smartcard / IUC Number</label>
                  <input type="tel" placeholder="Enter your smartcard number" value={billRef} onChange={e => setBillRef(e.target.value.replace(/\D/g,""))}
                    className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-xl font-mono tracking-widest focus:outline-none focus:border-tsia-green bg-background"
                    data-testid="input-tv-smartcard" />
                  {tvCustomerName && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-tsia-green font-semibold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> {tvCustomerName}
                    </div>
                  )}
                </div>
              )}
            </>)}

            <Button className="w-full h-12 bg-rose-600 text-white font-bold rounded-2xl"
              disabled={!selectedTvPackage || billRef.length < 5}
              onClick={() => {
                const priceUsd = (selectedTvPackage!.priceNgn / 1600).toFixed(2);
                setAmount(priceUsd);
                setBillStep("amount");
              }}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>) : billStep === "success" && txResult ? (<>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-rose-600" /></div>
              <div><h3 className="font-black text-xl text-rose-600">Subscription Activated ✓</h3><p className="text-muted-foreground text-sm mt-1">{selectedTvProvider?.label} • {selectedTvPackage?.label}</p></div>
              <div className="w-full bg-rose-50 dark:bg-rose-900/20 border border-rose-300 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold">₦{txResult.amountNgn.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Smartcard</span><span className="font-mono">{billRef}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Reference</span><span className="font-mono text-muted-foreground">{txResult.ref}</span></div>
              </div>
              <Button className="w-full h-12 bg-rose-600 text-white font-bold rounded-2xl" onClick={() => { resetBill(); setView("home"); }}>Done</Button>
            </div>
          </>) : (<>
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 rounded-3xl p-5 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{selectedTvProvider?.label}</p>
              <p className="text-4xl font-black text-rose-700">{selectedTvPackage?.label}</p>
              <p className="text-2xl font-black text-tsia-green mt-2">${fmt(amount)}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Smartcard: {billRef}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
              <Button className="flex-1 h-12 bg-rose-600 text-white font-bold rounded-2xl"
                disabled={billMutation.isPending || parseFloat(amount) > balance}
                onClick={() => billMutation.mutate()} data-testid="btn-confirm-cable-tv">
                {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Smartphone className="w-5 h-5 mr-2" />}
                Subscribe ${fmt(amount)}
              </Button>
            </div>
            {parseFloat(amount) > balance && <p className="text-xs text-center text-red-500">Insufficient balance</p>}
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
