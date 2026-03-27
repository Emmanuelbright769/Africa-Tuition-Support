import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Receipt, Wifi, Smartphone,
  Droplets, Home, Eye, EyeOff, ChevronRight, ArrowLeft, Send,
  Bell, CreditCard, History, TrendingUp, TrendingDown, Loader2,
  CheckCircle2, X, Zap, Building, ShoppingCart, User, Search,
  Plus, Phone, Wallet
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
type View = "home" | "send" | "request" | "pay-bill" | "service" | "confirm-send" | "confirm-bill";
type WalletData = { id: number; userId: number; balance: string };
type TransferRecord = { id: number; senderId: number; recipientId: number; amount: string; note: string | null; status: string; createdAt: string; recipientName?: string; senderName?: string };
type BillRecord = { id: number; service: string; amount: string; reference: string; status: string; createdAt: string };

// ─── Services ─────────────────────────────────────────────────────────────
const SERVICES = [
  { id: "electricity", label: "Electricity", icon: Zap,          color: "from-yellow-400 to-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  { id: "internet",    label: "Internet",    icon: Wifi,          color: "from-blue-400 to-indigo-500",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "mobile",      label: "Mobile",      icon: Smartphone,    color: "from-emerald-400 to-teal-500",   bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { id: "water",       label: "Water",       icon: Droplets,      color: "from-sky-400 to-blue-500",       bg: "bg-sky-50 dark:bg-sky-900/20" },
  { id: "rent",        label: "Rent",        icon: Home,          color: "from-violet-400 to-purple-500",  bg: "bg-violet-50 dark:bg-violet-900/20" },
  { id: "education",   label: "Education",   icon: Building,      color: "from-pink-400 to-rose-500",      bg: "bg-pink-50 dark:bg-pink-900/20" },
  { id: "shopping",    label: "Shopping",    icon: ShoppingCart,  color: "from-orange-400 to-red-500",     bg: "bg-orange-50 dark:bg-orange-900/20" },
  { id: "other",       label: "Other",       icon: CreditCard,    color: "from-slate-400 to-slate-600",    bg: "bg-slate-50 dark:bg-slate-800/40" },
];

// ─── Numpad ────────────────────────────────────────────────────────────────
const NUMPAD_KEYS = ["1","2","3","4","5","6","7","8","9","*","0","⌫"];

function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handle = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1) || "0"); return; }
    if (k === "*") return;
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
            k === "*" ? "bg-muted/30 text-muted-foreground/30 cursor-default" :
            "bg-muted/60 hover:bg-muted text-foreground"
          }`}
          disabled={k === "*"}
        >{k}</button>
      ))}
    </div>
  );
}

// ─── Balance Card ──────────────────────────────────────────────────────────
function BalanceCard({ balance, totalIn, totalOut, hidden, onToggle, onAddMoney }: {
  balance: number; totalIn: number; totalOut: number; hidden: boolean; onToggle: () => void; onAddMoney: () => void;
}) {
  return (
    <div className="relative rounded-3xl overflow-hidden mb-6">
      {/* Green card */}
      <div className="bg-gradient-to-br from-[#1a5c38] via-[#1e6b42] to-[#0e3d25] p-6">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 left-24 w-28 h-28 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-start justify-between mb-5">
          <div>
            <p className="text-white/60 text-xs font-medium mb-1">Total Balance</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black text-white tracking-tight">
                {hidden ? "••••••" : `$${balance.toFixed(2)}`}
              </p>
              <button onClick={onToggle} className="mb-1 text-white/60 hover:text-white transition-colors">
                {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {/* Wallet icon */}
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6">
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

      {/* Add Money — vertical dashed right strip */}
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

// ─── Quick Action Button ───────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group" data-testid={`btn-quick-${label.toLowerCase().replace(" ","-")}`}>
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform group-active:scale-95`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </button>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function FinancialHub() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>("home");
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientLookup, setRecipientLookup] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [activeTab, setActiveTab] = useState<"transfers" | "bills">("transfers");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: wallet } = useQuery<WalletData>({ queryKey: ["/api/wallet"] });
  const { data: txHistory = [] } = useQuery<any[]>({ queryKey: ["/api/transactions"] });
  const { data: transfers = [] } = useQuery<TransferRecord[]>({ queryKey: ["/api/wallet/transfers"] });
  const { data: bills = [] } = useQuery<BillRecord[]>({ queryKey: ["/api/wallet/bills"] });

  const balance = parseFloat(wallet?.balance ?? "0");
  const totalIn  = (txHistory as any[]).filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = Math.abs((txHistory as any[]).filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + parseFloat(t.amount), 0));

  // Recent unique recipients from transfers
  const recentRecipients = Array.from(
    new Map((transfers as TransferRecord[]).map(t => [t.recipientId, t])).values()
  ).slice(0, 6);

  // ── Mutations ────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!recipientLookup) throw new Error("No recipient selected");
      const res = await apiRequest("POST", "/api/wallet/send", { recipientId: recipientLookup.id, amount: parseFloat(amount), note });
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
      const res = await apiRequest("POST", "/api/wallet/bill", { service: selectedService.id, amount: parseFloat(amount), note });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Bill paid!", description: data.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/bills"] });
      setView("home"); resetBill();
    },
    onError: (e: any) => toast({ title: "Payment failed", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetSend = () => { setAmount("0"); setNote(""); setRecipientEmail(""); setRecipientLookup(null); };
  const resetBill = () => { setAmount("0"); setNote(""); setSelectedService(null); };

  const lookupRecipient = async () => {
    if (!recipientEmail.trim()) return;
    setLookingUp(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/lookup-user", { email: recipientEmail.trim() });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const data = await res.json();
      setRecipientLookup(data);
    } catch (e: any) {
      toast({ title: "User not found", description: e.message, variant: "destructive" });
      setRecipientLookup(null);
    } finally { setLookingUp(false); }
  };

  const AVATAR_COLORS = ["bg-rose-500","bg-purple-500","bg-teal-500","bg-amber-500","bg-blue-500","bg-pink-500"];

  // ─────────────────────────────────────────────────────────────────────────
  // HOME VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div className="space-y-6">
      {/* Balance Card */}
      <BalanceCard
        balance={balance}
        totalIn={totalIn}
        totalOut={totalOut}
        hidden={balanceHidden}
        onToggle={() => setBalanceHidden(h => !h)}
        onAddMoney={() => {
          toast({ title: "To add money", description: "Go to Digital Wallet → Deposit to fund your account via USDT." });
        }}
      />

      {/* Quick Actions */}
      <div>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={Send}       label="Send"      onClick={() => { resetSend(); setView("send"); }}     color="bg-tsia-green" />
          <QuickAction icon={RefreshCw}  label="Transfer"  onClick={() => { resetSend(); setView("send"); }}     color="bg-blue-500" />
          <QuickAction icon={Bell}       label="Request"   onClick={() => setView("request")}                    color="bg-violet-500" />
          <QuickAction icon={Receipt}    label="Pay Bill"  onClick={() => { resetBill(); setView("pay-bill"); }} color="bg-amber-500" />
        </div>
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
              <button key={t.recipientId} onClick={() => { resetSend(); setRecipientLookup({ id: t.recipientId, firstName: t.recipientName?.split(" ")[0], lastName: t.recipientName?.split(" ")[1], email: "" }); setView("send"); }}
                className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`w-14 h-14 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-xl ring-2 ring-offset-2 ring-tsia-green/30`}>
                  {t.recipientName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[56px]">{t.recipientName?.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Select Service */}
      <div>
        <h3 className="font-bold text-sm mb-3">Select service</h3>
        <div className="grid grid-cols-4 gap-3">
          {SERVICES.slice(0, 4).map(svc => (
            <button key={svc.id} onClick={() => { resetBill(); setSelectedService(svc); setView("service"); }}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl ${svc.bg} hover:shadow-md transition-shadow`}
              data-testid={`btn-service-${svc.id}`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                <svc.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">{svc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction History Tabs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">History</h3>
          <div className="flex bg-muted/40 rounded-xl p-0.5 text-xs">
            <button onClick={() => setActiveTab("transfers")} className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "transfers" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Transfers</button>
            <button onClick={() => setActiveTab("bills")} className={`px-3 py-1 rounded-lg font-semibold transition-all ${activeTab === "bills" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>Bills</button>
          </div>
        </div>
        <div className="space-y-2">
          {activeTab === "transfers" ? (
            (transfers as TransferRecord[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Send className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                No transfers yet
              </div>
            ) : (transfers as TransferRecord[]).slice(0, 8).map((t, i) => {
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
            (bills as BillRecord[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                No bill payments yet
              </div>
            ) : (bills as BillRecord[]).slice(0, 8).map(b => {
              const svc = SERVICES.find(s => s.id === b.service) || SERVICES[7];
              return (
                <div key={b.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.color} flex items-center justify-center`}>
                    <svc.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm capitalize">{svc.label} Bill</p>
                    <p className="text-xs text-muted-foreground">{b.reference}</p>
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

  // ─────────────────────────────────────────────────────────────────────────
  // SEND MONEY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "send") return (
    <AnimatePresence mode="wait">
      <motion.div key="send" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("home"); resetSend(); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/70" data-testid="btn-back-send">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-lg">Send Money</h2>
        </div>

        {/* Recipient search */}
        {!recipientLookup ? (
          <div className="space-y-4">
            <div className="bg-card border rounded-2xl p-4 space-y-3">
              <Label className="font-semibold">Find recipient by email or affiliate code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. john@example.com or TSIA-JOH0001"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupRecipient()}
                  data-testid="input-recipient-email"
                  className="rounded-xl"
                />
                <Button onClick={lookupRecipient} disabled={lookingUp || !recipientEmail} className="bg-tsia-green text-white rounded-xl shrink-0">
                  {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            {/* Recent recipients */}
            {recentRecipients.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wide">Recent</p>
                <div className="space-y-2">
                  {recentRecipients.slice(0, 4).map((t, i) => (
                    <button key={t.recipientId}
                      onClick={() => setRecipientLookup({ id: t.recipientId, firstName: t.recipientName?.split(" ")[0] || "User", lastName: t.recipientName?.split(" ")[1] || "", email: "" })}
                      className="w-full flex items-center gap-3 bg-card border rounded-2xl p-3 hover:border-tsia-green/40 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0`}>
                        {t.recipientName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-sm">{t.recipientName}</p>
                        <p className="text-xs text-muted-foreground">Tap to send again</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Recipient card */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-tsia-green mx-auto flex items-center justify-center text-white text-2xl font-black mb-3 ring-4 ring-tsia-green/20">
                {recipientLookup.firstName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <p className="font-bold text-base">Paying money to {recipientLookup.firstName} {recipientLookup.lastName}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> Verified TSIA member
              </p>
              <button onClick={() => setRecipientLookup(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">Change recipient</button>
            </div>

            {/* Amount display */}
            <div className="text-center">
              <div className="text-5xl font-black tracking-tight text-foreground mb-1">
                ${parseFloat(amount || "0").toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Available: ${balance.toFixed(2)}</p>
            </div>

            {/* Note */}
            <Input
              placeholder="Enter reason (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              data-testid="input-note"
              className="rounded-2xl text-center text-sm border-muted"
            />

            {/* Numpad */}
            <Numpad value={amount} onChange={setAmount} />

            {/* Send button */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setView("home"); resetSend(); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <Button
                className="flex-1 h-12 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-base"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                data-testid="btn-confirm-send"
              >
                {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Send ${parseFloat(amount || "0").toFixed(2)}
              </Button>
            </div>
            {parseFloat(amount) > balance && (
              <p className="text-xs text-center text-red-500">Insufficient balance (have ${balance.toFixed(2)})</p>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // REQUEST MONEY VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "request") return (
    <AnimatePresence mode="wait">
      <motion.div key="request" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("home")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-lg">Request Money</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl p-4 space-y-3">
            <Label>Request from (email or affiliate code)</Label>
            <Input placeholder="e.g. john@example.com" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} className="rounded-xl" data-testid="input-request-from" />
          </div>
          <div className="text-center">
            <div className="text-5xl font-black mb-1">${parseFloat(amount || "0").toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Amount to request</p>
          </div>
          <Input placeholder="What is this for?" value={note} onChange={e => setNote(e.target.value)} className="rounded-2xl text-center" data-testid="input-request-note" />
          <Numpad value={amount} onChange={setAmount} />
          <Button className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl"
            onClick={() => { toast({ title: "Request sent!", description: `Request for $${parseFloat(amount).toFixed(2)} sent to ${recipientEmail}` }); setView("home"); resetSend(); }}
            disabled={!recipientEmail || parseFloat(amount) <= 0}
            data-testid="btn-send-request"
          >
            <Bell className="w-5 h-5 mr-2" /> Send Request
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SELECT SERVICE VIEW (which service to pay)
  // ─────────────────────────────────────────────────────────────────────────
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
              onClick={() => { setSelectedService(svc); setView("service"); }}
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

  // ─────────────────────────────────────────────────────────────────────────
  // SERVICE AMOUNT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === "service" && selectedService) return (
    <AnimatePresence mode="wait">
      <motion.div key="service" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("pay-bill")} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-bold text-lg">Pay {selectedService.label} Bill</h2>
        </div>

        {/* Service icon */}
        <div className="text-center">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedService.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
            <selectedService.icon className="w-10 h-10 text-white" />
          </div>
          <p className="font-bold">{selectedService.label} Payment</p>
          <p className="text-xs text-muted-foreground">Wallet balance: ${balance.toFixed(2)}</p>
        </div>

        {/* Amount */}
        <div className="text-center">
          <div className="text-5xl font-black tracking-tight">${parseFloat(amount || "0").toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">Amount to pay</p>
        </div>

        <Input placeholder="Account number / reference" value={note} onChange={e => setNote(e.target.value)} className="rounded-2xl text-center" data-testid="input-bill-ref" />

        <Numpad value={amount} onChange={setAmount} />

        <div className="flex gap-3">
          <button onClick={() => { setView("pay-bill"); }} className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <Button
            className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl"
            onClick={() => billMutation.mutate()}
            disabled={billMutation.isPending || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
            data-testid="btn-confirm-bill"
          >
            {billMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Receipt className="w-5 h-5 mr-2" />}
            Pay ${parseFloat(amount || "0").toFixed(2)}
          </Button>
        </div>
        {parseFloat(amount) > balance && (
          <p className="text-xs text-center text-red-500">Insufficient balance</p>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return null;
}
