import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Receipt, Wifi, Smartphone,
  Eye, EyeOff, ChevronRight, ArrowLeft, Send,
  Bell, CreditCard, History, TrendingUp, TrendingDown, Loader2,
  CheckCircle2, X, Zap, Building, User, Search,
  Plus, Phone, Wallet, Gamepad2, Delete, Copy
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type View = "home" | "send" | "request" | "pay-bill" | "service" | "send-amount";
type WalletData = { id: number; userId: number; balance: string };
type TransferRecord = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };

// ─── TSIA Account Number helper ───────────────────────────────────────────────
const toAccountNumber = (userId: number) => String(userId).padStart(10, "0");

// ─── Services ─────────────────────────────────────────────────────────────────
const SERVICES = [
  { id: "electricity", label: "Electricity", icon: Zap,        color: "from-yellow-400 to-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  { id: "internet",    label: "Internet",    icon: Wifi,        color: "from-blue-400 to-indigo-500",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "airtime",     label: "Airtime",     icon: Phone,       color: "from-emerald-400 to-teal-500",  bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { id: "education",   label: "Education",   icon: Building,    color: "from-pink-400 to-rose-500",     bg: "bg-pink-50 dark:bg-pink-900/20" },
  { id: "betting",     label: "Betting",     icon: Gamepad2,    color: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
];

const AIRTIME_NETWORKS = [
  { id: "mtn",     label: "MTN",     color: "bg-yellow-400",  text: "text-yellow-900" },
  { id: "airtel",  label: "Airtel",  color: "bg-red-500",     text: "text-white" },
  { id: "glo",     label: "Glo",     color: "bg-green-600",   text: "text-white" },
  { id: "9mobile", label: "9mobile", color: "bg-emerald-700", text: "text-white" },
];

const BETTING_PLATFORMS = [
  { id: "bet9ja",    label: "Bet9ja",    color: "bg-green-800",  text: "text-white" },
  { id: "sportybet", label: "SportyBet", color: "bg-blue-700",   text: "text-white" },
  { id: "1xbet",     label: "1xBet",     color: "bg-slate-800",  text: "text-white" },
  { id: "parimatch", label: "Parimatch", color: "bg-yellow-500", text: "text-black" },
];

const AVATAR_COLORS = ["bg-rose-500","bg-purple-500","bg-teal-500","bg-amber-500","bg-blue-500","bg-pink-500"];

// ─── Numpad ────────────────────────────────────────────────────────────────────
const NUMPAD_KEYS = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];
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
      {NUMPAD_KEYS.map(k => (
        <button key={k} onClick={() => handle(k)}
          className={`h-14 rounded-2xl font-bold text-xl transition-all active:scale-95 ${
            k === "⌫" ? "bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100" :
            "bg-muted/60 hover:bg-muted text-foreground"
          }`}
        >{k === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : k}</button>
      ))}
    </div>
  );
}

// ─── Account Number Input ─────────────────────────────────────────────────────
function AcctNumpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handle = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (value.length >= 10) return;
    onChange(value + k);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
        <button key={i} onClick={() => k && handle(k)} disabled={!k}
          className={`h-14 rounded-2xl font-bold text-xl transition-all active:scale-95 ${
            !k ? "opacity-0 pointer-events-none" :
            k === "⌫" ? "bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100" :
            "bg-muted/60 hover:bg-muted text-foreground"
          }`}
        >{k === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : k}</button>
      ))}
    </div>
  );
}

// ─── Balance Card ──────────────────────────────────────────────────────────────
function BalanceCard({ balance, totalIn, totalOut, hidden, onToggle, onAddMoney, accountNumber }: {
  balance: number; totalIn: number; totalOut: number; hidden: boolean;
  onToggle: () => void; onAddMoney: () => void; accountNumber: string;
}) {
  const { toast } = useToast();
  const copyAcct = () => {
    navigator.clipboard.writeText(accountNumber);
    toast({ title: "Copied!", description: "Account number copied to clipboard." });
  };
  return (
    <div className="relative rounded-3xl overflow-hidden mb-6">
      <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-6 pr-20">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 left-24 w-28 h-28 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/60 text-[10px] font-medium mb-0.5 uppercase tracking-widest">TSIA Bank • Total Balance</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-black text-white tracking-tight">
                  {hidden ? "••••••" : `$${balance.toFixed(2)}`}
                </p>
                <button onClick={onToggle} className="mb-1 text-white/60 hover:text-white transition-colors" data-testid="btn-toggle-balance">
                  {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Account number */}
          <button onClick={copyAcct} className="flex items-center gap-2 mb-4 group">
            <p className="text-white/50 text-xs font-mono tracking-widest">
              {accountNumber.slice(0,4)} {accountNumber.slice(4,7)} {accountNumber.slice(7)}
            </p>
            <Copy className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
          </button>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-[10px]">Income</p>
                <p className="text-white font-bold text-sm">{hidden ? "••••" : `$${totalIn.toFixed(2)}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-[10px]">Expense</p>
                <p className="text-white font-bold text-sm">{hidden ? "••••" : `$${totalOut.toFixed(2)}`}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button onClick={onAddMoney}
        className="absolute right-0 top-0 h-full w-16 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-white/30 bg-white/10 hover:bg-white/20 transition-colors"
        data-testid="btn-add-money"
      >
        <Plus className="w-5 h-5 text-white" />
        <p className="text-white text-[9px] font-bold tracking-wider" style={{ writingMode: "vertical-rl" }}>ADD MONEY</p>
      </button>
    </div>
  );
}

// ─── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group" data-testid={`btn-quick-${label.toLowerCase().replace(/\s/g,"-")}`}>
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform group-active:scale-95`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </button>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function FinancialHub() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Per-user balance hidden preference
  const hiddenKey = user?.id ? `tsia_balance_hidden_${user.id}` : "tsia_balance_hidden";
  const [balanceHidden, setBalanceHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(hiddenKey) === "true"; } catch { return false; }
  });

  const toggleHidden = () => {
    setBalanceHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(hiddenKey, String(next)); } catch {}
      return next;
    });
  };

  // Sync key when user loads
  useEffect(() => {
    try {
      const stored = localStorage.getItem(hiddenKey);
      setBalanceHidden(stored === "true");
    } catch {}
  }, [hiddenKey]);

  // ── Views & State ──────────────────────────────────────────────────────────
  const [view, setView]       = useState<View>("home");
  const [amount, setAmount]   = useState("0");
  const [note, setNote]       = useState("");
  const [activeTab, setActiveTab] = useState<"transfers" | "bills">("transfers");

  // Send-money state
  const [acctInput, setAcctInput]         = useState("");  // 10-digit TSIA acct number
  const [verifying, setVerifying]         = useState(false);
  const [verifiedUser, setVerifiedUser]   = useState<{ id: number; name: string; acct: string } | null>(null);
  const [sendStep, setSendStep]           = useState<"acct" | "amount">("acct");

  // Bill state
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [billRef, setBillRef]                  = useState("");  // phone / acct / user-id etc
  const [selectedNetwork, setSelectedNetwork]  = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform]= useState<string | null>(null);
  const [billStep, setBillStep]                = useState<"details" | "amount">("details");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: wallet }          = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: txHistory = [] }  = useQuery<any[]>({ queryKey: ["/api/transactions"] });
  const { data: transfers = [] }  = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] }      = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });

  const balance  = parseFloat(wallet?.balance ?? "0");
  const totalIn  = (txHistory as any[]).filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = Math.abs((txHistory as any[]).filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + parseFloat(t.amount), 0));
  const accountNumber = user?.id ? toAccountNumber(user.id) : "0000000000";

  const recentRecipients = Array.from(
    new Map((transfers as TransferRecord[]).map(t => [t.recipientId, t])).values()
  ).slice(0, 5);

  // ── Auto-verify account as digits typed ───────────────────────────────────
  useEffect(() => {
    if (acctInput.length !== 10) { setVerifiedUser(null); return; }
    let cancelled = false;
    setVerifying(true);
    apiRequest("POST", "/api/wallet/verify-account", { accountNumber: acctInput })
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.id) setVerifiedUser({ id: d.id, name: `${d.firstName} ${d.lastName}`, acct: acctInput }); else setVerifiedUser(null); } })
      .catch(() => { if (!cancelled) setVerifiedUser(null); })
      .finally(() => { if (!cancelled) setVerifying(false); });
    return () => { cancelled = true; };
  }, [acctInput]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!verifiedUser) throw new Error("No recipient selected");
      const res = await apiRequest("POST", "/api/wallet/send", { recipientId: verifiedUser.id, amount: parseFloat(amount), note });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Money sent!", description: data.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transfers"] });
      setView("home"); resetSend();
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const billMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) throw new Error("No service selected");
      const ref = selectedService.id === "airtime"
        ? `${selectedNetwork}:${billRef}`
        : selectedService.id === "betting"
        ? `${selectedPlatform}:${billRef}`
        : billRef;
      const res = await apiRequest("POST", "/api/wallet/bill", { service: selectedService.id, amount: parseFloat(amount), note: ref });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Payment successful!", description: data.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      setView("home"); resetBill();
    },
    onError: (e: any) => toast({ title: "Payment failed", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetSend = () => { setAmount("0"); setNote(""); setAcctInput(""); setVerifiedUser(null); setSendStep("acct"); };
  const resetBill = () => { setAmount("0"); setBillRef(""); setSelectedService(null); setSelectedNetwork(null); setSelectedPlatform(null); setBillStep("details"); };

  const fmt = (v: string) => { const n = parseFloat(v || "0"); return isNaN(n) ? "0.00" : n.toFixed(2); };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "home") return (
    <div className="space-y-6">
      <BalanceCard
        balance={balance} totalIn={totalIn} totalOut={totalOut}
        hidden={balanceHidden} onToggle={toggleHidden}
        onAddMoney={() => toast({ title: "How to add money", description: "Go to Digital Wallet → Deposit to fund via USDT." })}
        accountNumber={accountNumber}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        <QuickAction icon={Send}      label="Send"     onClick={() => { resetSend(); setView("send"); }}     color="bg-tsia-green" />
        <QuickAction icon={RefreshCw} label="Transfer" onClick={() => { resetSend(); setView("send"); }}     color="bg-blue-500" />
        <QuickAction icon={Bell}      label="Request"  onClick={() => setView("request")}                    color="bg-violet-500" />
        <QuickAction icon={Receipt}   label="Pay Bill" onClick={() => { resetBill(); setView("pay-bill"); }} color="bg-amber-500" />
      </div>

      {/* Recent Recipients */}
      {recentRecipients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Recent Recipients</h3>
            <button className="text-xs text-tsia-green font-semibold flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {recentRecipients.map((t, i) => (
              <button key={t.recipientId}
                onClick={() => {
                  resetSend();
                  const name = t.recipientName ?? "User";
                  setVerifiedUser({ id: t.recipientId, name, acct: toAccountNumber(t.recipientId) });
                  setAcctInput(toAccountNumber(t.recipientId));
                  setSendStep("amount");
                  setView("send");
                }}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
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
        <div className="grid grid-cols-5 gap-2">
          {SERVICES.map(svc => (
            <button key={svc.id}
              onClick={() => { resetBill(); setSelectedService(svc); setView("service"); }}
              className={`flex flex-col items-center gap-2 p-2.5 rounded-2xl ${svc.bg} hover:shadow-md transition-shadow`}
              data-testid={`btn-service-${svc.id}`}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                <svc.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-foreground leading-none">{svc.label}</span>
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
                  return (
                    <div key={b.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                        <svc.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm capitalize">{svc.label}</p>
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MONEY — STEP 1: Account Number
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "send" && sendStep === "acct") return (
    <AnimatePresence mode="wait">
      <motion.div key="send-acct" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center" data-testid="btn-back-send">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-bold text-lg">Send Money</h2>
            <p className="text-xs text-muted-foreground">Enter TSIA account number</p>
          </div>
        </div>

        {/* Acct number display */}
        <div className="bg-card border-2 border-muted rounded-3xl p-5 text-center">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest font-semibold">Account Number</p>
          <p className="text-3xl font-black tracking-[0.25em] font-mono min-h-[44px]">
            {acctInput.padEnd(10, "·").replace(/(.{4})(.{3})(.{3})/, "$1 $2 $3")}
          </p>
          {/* Verification indicator */}
          <div className="mt-3 h-6 flex items-center justify-center">
            {verifying && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {!verifying && verifiedUser && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 rounded-full px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" />
                <span className="text-xs font-bold text-tsia-green">{verifiedUser.name}</span>
              </div>
            )}
            {!verifying && !verifiedUser && acctInput.length === 10 && (
              <p className="text-xs text-red-500 font-semibold">Account not found</p>
            )}
          </div>
        </div>

        {/* Account numpad */}
        <AcctNumpad value={acctInput} onChange={setAcctInput} />

        {/* Recent recipients */}
        {recentRecipients.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Recent</p>
            <div className="space-y-2">
              {recentRecipients.slice(0, 3).map((t, i) => (
                <button key={t.recipientId}
                  onClick={() => {
                    const acct = toAccountNumber(t.recipientId);
                    setAcctInput(acct);
                    const name = t.recipientName ?? "User";
                    setVerifiedUser({ id: t.recipientId, name, acct });
                    setSendStep("amount");
                  }}
                  className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:border-tsia-green/40 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0`}>
                    {(t.recipientName ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm">{t.recipientName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{toAccountNumber(t.recipientId)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          className="w-full h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl"
          disabled={!verifiedUser}
          onClick={() => setSendStep("amount")}
          data-testid="btn-next-amount"
        >
          Continue <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MONEY — STEP 2: Amount & Confirm
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "send" && sendStep === "amount" && verifiedUser) return (
    <AnimatePresence mode="wait">
      <motion.div key="send-amount" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSendStep("acct")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-bold text-lg">Enter Amount</h2>
            <p className="text-xs text-muted-foreground">Available: ${balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Recipient confirmed banner */}
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-tsia-green/30 rounded-2xl p-4">
          <div className="w-12 h-12 rounded-full bg-tsia-green flex items-center justify-center text-white text-xl font-black">
            {verifiedUser.name[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{verifiedUser.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{verifiedUser.acct.slice(0,4)} {verifiedUser.acct.slice(4,7)} {verifiedUser.acct.slice(7)}</p>
          </div>
          <div className="flex items-center gap-1 text-tsia-green">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold">Verified</span>
          </div>
        </div>

        {/* Big amount */}
        <div className="text-center py-2">
          <div className="text-5xl font-black tracking-tight">${fmt(amount)}</div>
          {parseFloat(amount) > balance && (
            <p className="text-xs text-red-500 mt-1 font-semibold">Exceeds your balance of ${balance.toFixed(2)}</p>
          )}
        </div>

        {/* Note */}
        <input
          placeholder="What's this for? (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full text-center text-sm border border-border rounded-2xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-tsia-green/40"
          data-testid="input-send-note"
        />

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <Button
            className="flex-1 h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-base"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            data-testid="btn-confirm-send"
          >
            {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            Send ${fmt(amount)}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUEST MONEY
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "request") return (
    <AnimatePresence mode="wait">
      <motion.div key="request" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("home")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-lg">Request Money</h2>
        </div>

        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <Label>Request from (account number or email)</Label>
          <input
            placeholder="Account number or email"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            data-testid="input-request-from"
          />
        </div>

        <div className="text-center py-2">
          <div className="text-5xl font-black">${fmt(amount)}</div>
          <p className="text-xs text-muted-foreground mt-1">Amount to request</p>
        </div>

        <Numpad value={amount} onChange={setAmount} />

        <Button className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl"
          onClick={() => { toast({ title: "Request sent!", description: `Request for $${fmt(amount)} sent.` }); setView("home"); setAmount("0"); setNote(""); }}
          disabled={!note || parseFloat(amount) <= 0}
          data-testid="btn-send-request"
        >
          <Bell className="w-5 h-5 mr-2" /> Send Request
        </Button>
      </motion.div>
    </AnimatePresence>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PAY BILL — Service picker
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "pay-bill") return (
    <AnimatePresence mode="wait">
      <motion.div key="pay-bill" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("home")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-lg">Pay a Bill</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map(svc => (
            <button key={svc.id}
              onClick={() => { setSelectedService(svc); setBillStep("details"); setView("service"); }}
              className={`flex items-center gap-3 p-4 rounded-2xl ${svc.bg} border hover:shadow-md transition-shadow`}
              data-testid={`btn-bill-${svc.id}`}
            >
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE FLOW (Airtime / Betting / Others)
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "service" && selectedService) {
    // ── AIRTIME ──
    if (selectedService.id === "airtime") return (
      <AnimatePresence mode="wait">
        <motion.div key="airtime" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => { billStep === "amount" ? setBillStep("details") : setView("pay-bill"); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-bold text-lg">Buy Airtime</h2>
              <p className="text-xs text-muted-foreground">{billStep === "details" ? "Select network & phone number" : "Enter amount"}</p>
            </div>
          </div>

          {billStep === "details" ? (
            <>
              {/* Network selection */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide font-bold text-muted-foreground">Select Network</Label>
                <div className="grid grid-cols-4 gap-2">
                  {AIRTIME_NETWORKS.map(n => (
                    <button key={n.id}
                      onClick={() => setSelectedNetwork(n.id)}
                      className={`py-3 rounded-2xl font-bold text-sm transition-all ${n.color} ${n.text} ${selectedNetwork === n.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                      data-testid={`btn-network-${n.id}`}
                    >{n.label}</button>
                  ))}
                </div>
              </div>

              {/* Phone number */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide font-bold text-muted-foreground">Phone Number</Label>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={billRef}
                  onChange={e => setBillRef(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-lg font-mono tracking-widest focus:outline-none focus:border-tsia-green bg-background"
                  data-testid="input-phone"
                />
              </div>

              <Button
                className="w-full h-12 bg-tsia-green text-white font-bold rounded-2xl"
                disabled={!selectedNetwork || billRef.length < 10}
                onClick={() => setBillStep("amount")}
              >Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          ) : (
            <>
              {/* Summary strip */}
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-tsia-green/30 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-bold text-sm font-mono">{billRef}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Network</p>
                  <p className="font-bold text-sm uppercase">{selectedNetwork}</p>
                </div>
              </div>

              <div className="text-center py-1">
                <div className="text-5xl font-black">${fmt(amount)}</div>
                <p className="text-xs text-muted-foreground mt-1">Balance: ${balance.toFixed(2)}</p>
              </div>

              {/* Preset amounts */}
              <div className="grid grid-cols-4 gap-2">
                {["1","2","5","10"].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${amount === v ? "border-tsia-green bg-tsia-green/10 text-tsia-green" : "border-border bg-muted/40 text-muted-foreground"}`}
                  >${v}</button>
                ))}
              </div>

              <Numpad value={amount} onChange={setAmount} />

              <div className="flex gap-3">
                <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <Button
                  className="flex-1 h-12 bg-tsia-green text-white font-bold rounded-2xl"
                  disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                  onClick={() => billMutation.mutate()}
                  data-testid="btn-confirm-airtime"
                >
                  {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Phone className="w-5 h-5 mr-2" />}
                  Buy ${fmt(amount)} Airtime
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );

    // ── BETTING ──
    if (selectedService.id === "betting") return (
      <AnimatePresence mode="wait">
        <motion.div key="betting" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => { billStep === "amount" ? setBillStep("details") : setView("pay-bill"); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-bold text-lg">Fund Betting Wallet</h2>
              <p className="text-xs text-muted-foreground">{billStep === "details" ? "Select platform & enter user ID" : "Enter amount to fund"}</p>
            </div>
          </div>

          {billStep === "details" ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide font-bold text-muted-foreground">Select Platform</Label>
                <div className="grid grid-cols-2 gap-2">
                  {BETTING_PLATFORMS.map(p => (
                    <button key={p.id}
                      onClick={() => setSelectedPlatform(p.id)}
                      className={`py-3.5 rounded-2xl font-bold text-sm transition-all ${p.color} ${p.text} ${selectedPlatform === p.id ? "ring-2 ring-offset-2 ring-tsia-green scale-105" : "opacity-70 hover:opacity-90"}`}
                      data-testid={`btn-platform-${p.id}`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide font-bold text-muted-foreground">Betting User ID / Username</Label>
                <input
                  placeholder="Enter your betting ID"
                  value={billRef}
                  onChange={e => setBillRef(e.target.value)}
                  className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-tsia-green bg-background"
                  data-testid="input-betting-id"
                />
              </div>

              <Button
                className="w-full h-12 bg-violet-600 text-white font-bold rounded-2xl"
                disabled={!selectedPlatform || !billRef.trim()}
                onClick={() => setBillStep("amount")}
              >Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-900/20 border border-violet-300 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">User ID</p>
                  <p className="font-bold text-sm">{billRef}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="font-bold text-sm capitalize">{selectedPlatform}</p>
                </div>
              </div>

              <div className="text-center py-1">
                <div className="text-5xl font-black">${fmt(amount)}</div>
                <p className="text-xs text-muted-foreground mt-1">Balance: ${balance.toFixed(2)}</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {["5","10","20","50"].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className={`py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${amount === v ? "border-violet-500 bg-violet-500/10 text-violet-600" : "border-border bg-muted/40 text-muted-foreground"}`}
                  >${v}</button>
                ))}
              </div>

              <Numpad value={amount} onChange={setAmount} />

              <div className="flex gap-3">
                <button onClick={() => { setView("home"); resetBill(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <Button
                  className="flex-1 h-12 bg-violet-600 text-white font-bold rounded-2xl"
                  disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                  onClick={() => billMutation.mutate()}
                  data-testid="btn-confirm-betting"
                >
                  {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Gamepad2 className="w-5 h-5 mr-2" />}
                  Fund ${fmt(amount)}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );

    // ── GENERIC SERVICE (Electricity / Internet / Education) ──
    return (
      <AnimatePresence mode="wait">
        <motion.div key="service-generic" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("pay-bill")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="font-bold text-lg">Pay {selectedService.label}</h2>
          </div>

          <div className="text-center">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedService.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
              <selectedService.icon className="w-10 h-10 text-white" />
            </div>
            <p className="font-bold">{selectedService.label} Payment</p>
            <p className="text-xs text-muted-foreground">Wallet balance: ${balance.toFixed(2)}</p>
          </div>

          <input
            placeholder={
              selectedService.id === "electricity" ? "Meter number" :
              selectedService.id === "internet" ? "Customer ID / Account number" :
              "Reference number"
            }
            value={billRef}
            onChange={e => setBillRef(e.target.value)}
            className="w-full border-2 border-border rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-tsia-green bg-background text-center"
            data-testid="input-bill-ref"
          />

          <div className="text-center py-1">
            <div className="text-5xl font-black">${fmt(amount)}</div>
          </div>

          <Numpad value={amount} onChange={setAmount} />

          <div className="flex gap-3">
            <button onClick={() => { setView("pay-bill"); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
            <Button
              className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl"
              onClick={() => billMutation.mutate()}
              disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance || !billRef.trim()}
              data-testid="btn-confirm-bill"
            >
              {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Receipt className="w-5 h-5 mr-2" />}
              Pay ${fmt(amount)}
            </Button>
          </div>
          {parseFloat(amount) > balance && <p className="text-xs text-center text-red-500">Insufficient balance</p>}
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
