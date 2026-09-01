import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, RefreshCw, Search, ShieldCheck, Unlock, WalletCards } from "lucide-react";
import { apiRequest, parseApiError, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ServiceType = "manual" | "signals" | "tsmart";
type WalletRow = Record<string, any>;
type PinRow = Record<string, any>;

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "manual", label: "Manual Trading" },
  { value: "signals", label: "Trading Signals" },
  { value: "tsmart", label: "TS-Mart" },
];

const money = (value: unknown) => `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
const userName = (row: Record<string, any>) => {
  const user = row.user ?? row;
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || `User #${row.userId ?? user.id ?? "—"}`;
};
const getBalance = (row: WalletRow) => Number(row.balance ?? row.amount ?? row.walletBalance ?? row.wallet?.balance ?? 0);
const getRows = (data: any, keys: string[]) => Array.isArray(data) ? data : keys.reduce<any[]>((found, key) => found.length ? found : (Array.isArray(data?.[key]) ? data[key] : []), []);

/** Creates an unpredictable request key without relying on timestamp-only values. */
function idempotencyKey(prefix: string) {
  const browserCrypto = globalThis.crypto;
  if (!browserCrypto) throw new Error("Secure browser cryptography is required to perform this action.");
  if (typeof browserCrypto.randomUUID === "function") return `${prefix}-${browserCrypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  browserCrypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function ServiceBadge({ type }: { type: unknown }) {
  const match = SERVICE_TYPES.find(item => item.value === type);
  return <Badge variant="outline" className="text-xs">{match?.label ?? String(type ?? "Unknown").replace(/_/g, " ")}</Badge>;
}

function pinStatusFor(row: PinRow) {
  const raw = String(row.status ?? (row.locked || row.lockedUntil ? "locked" : row.isSet ?? row.pinSet ?? row.transactionPinSetAt ? "set" : "unset")).toLowerCase();
  return raw === "locked" ? "locked" : ["set", "active"].includes(raw) ? "set" : "unset";
}

function PinBadge({ row }: { row: PinRow }) {
  const status = pinStatusFor(row);
  const color = status === "locked" ? "border-rose-200 bg-rose-50 text-rose-700" : status === "set" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <Badge variant="outline" className={`capitalize ${color}`}>{status}</Badge>;
}

export default function AdminWalletOperations() {
  const { toast } = useToast();
  const [walletQuery, setWalletQuery] = useState("");
  const [walletType, setWalletType] = useState("all");
  const [pinQuery, setPinQuery] = useState("");
  const [pinStatus, setPinStatus] = useState("all");
  const [adjusting, setAdjusting] = useState<WalletRow | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [adjustmentIdempotencyKey, setAdjustmentIdempotencyKey] = useState<string | null>(null);
  const [pinAction, setPinAction] = useState<{ row: PinRow; action: "unlock" | "reset"; idempotencyKey: string } | null>(null);
  const [pinReason, setPinReason] = useState("");

  const walletsQuery = useQuery({
    queryKey: ["/api/admin/service-wallets", walletType, walletQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ serviceType: walletType, q: walletQuery.trim() });
      const response = await apiRequest("GET", `/api/admin/service-wallets?${params}`);
      return response.json();
    },
  });
  const pinsQuery = useQuery({
    queryKey: ["/api/admin/transaction-pins", pinStatus, pinQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ q: pinQuery.trim(), status: pinStatus === "all" ? "" : pinStatus });
      const response = await apiRequest("GET", `/api/admin/transaction-pins?${params}`);
      return response.json();
    },
  });

  const walletRows = getRows(walletsQuery.data, ["wallets", "items", "data"]);
  const pinRows = getRows(pinsQuery.data, ["pins", "items", "data"]);
  const totals = useMemo(() => {
    const supplied = walletsQuery.data?.totals ?? walletsQuery.data?.aggregate;
    const valueFor = (type: ServiceType) => Number(supplied?.[type] ?? supplied?.[`${type}Total`] ?? walletRows.filter(row => row.serviceType === type || row.type === type).reduce((sum, row) => sum + getBalance(row), 0));
    const manual = valueFor("manual"), signals = valueFor("signals"), mart = valueFor("tsmart");
    const swift = Number(walletsQuery.data?.ecosystemTotals?.swift ?? 0);
    const trade = Number(walletsQuery.data?.ecosystemTotals?.trade ?? 0);
    return { manual, signals, mart, swift, trade, total: swift + trade + manual + signals + mart };
  }, [walletRows, walletsQuery.data]);

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!adjusting) throw new Error("Choose a service wallet first.");
      const amount = Number(adjustmentAmount);
      if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero signed amount.");
      // A missing service-wallet record is valid for a zero balance. Always
      // address adjustments by the owner and service type, never wallet id.
      const userId = adjusting.userId ?? adjusting.user_id ?? adjusting.user?.id;
      const serviceType = adjusting.serviceType ?? adjusting.type;
      if (!userId || !serviceType) throw new Error("This row is missing its user or service wallet type.");
      if (!adjustmentIdempotencyKey) throw new Error("Secure adjustment key is unavailable. Reopen the dialog and try again.");
      await apiRequest("POST", `/api/admin/service-wallets/${userId}/adjust`, { serviceType, amount, note: adjustmentNote.trim(), idempotencyKey: adjustmentIdempotencyKey });
    },
    onSuccess: () => {
      toast({ title: "Service wallet adjusted", description: "The signed adjustment was recorded." });
      setAdjusting(null); setAdjustmentAmount(""); setAdjustmentNote(""); setAdjustmentIdempotencyKey(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-wallets"] });
    },
    onError: error => toast({ title: "Adjustment failed", description: parseApiError(error), variant: "destructive" }),
  });
  const pinMutation = useMutation({
    mutationFn: async () => {
      if (!pinAction) throw new Error("Choose a PIN action first.");
      const userId = pinAction.row.userId ?? pinAction.row.user_id ?? pinAction.row.user?.id ?? pinAction.row.id;
      if (!userId) throw new Error("This PIN record is missing its user.");
      await apiRequest("POST", `/api/admin/users/${userId}/transaction-pin/${pinAction.action}`, { reason: pinReason.trim(), idempotencyKey: pinAction.idempotencyKey });
    },
    onSuccess: () => {
      toast({ title: pinAction?.action === "unlock" ? "Transaction PIN unlocked" : "Transaction PIN reset", description: "The security action was recorded." });
      setPinAction(null); setPinReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transaction-pins"] });
    },
    onError: error => toast({ title: "PIN action failed", description: parseApiError(error), variant: "destructive" }),
  });

  const closeAdjustment = () => { setAdjusting(null); setAdjustmentAmount(""); setAdjustmentNote(""); setAdjustmentIdempotencyKey(null); };
  const closePinAction = () => { setPinAction(null); setPinReason(""); };
  const openAdjustment = (row: WalletRow) => { setAdjusting(row); setAdjustmentAmount(""); setAdjustmentNote(""); setAdjustmentIdempotencyKey(idempotencyKey("service-wallet-adjustment")); };
  const openPinAction = (row: PinRow, action: "unlock" | "reset") => { setPinAction({ row, action, idempotencyKey: idempotencyKey(`transaction-pin-${action}`) }); setPinReason(""); };

  return <div className="space-y-6" data-testid="admin-wallet-operations">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-tsia-green">Money & configuration</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Wallets & PIN Security</h2><p className="mt-1 text-sm text-slate-500">Monitor the complete wallet ecosystem. SwiftWallet is managed in All Users, Itera BOT in Trade Market, and separated service wallets below.</p></div>
      <Button variant="outline" onClick={() => { walletsQuery.refetch(); pinsQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[[WalletCards, "SwiftWallet", totals.swift], [WalletCards, "Itera BOT / Trade", totals.trade], [WalletCards, "Manual Trading", totals.manual], [WalletCards, "Trading Signals", totals.signals], [WalletCards, "TS-Mart", totals.mart], [ShieldCheck, "Wallet ecosystem total", totals.total]].map(([Icon, label, value]) => {
        const CardIcon = Icon as any;
        return <Card key={String(label)} className="border-slate-200/80 shadow-sm dark:border-slate-800"><CardContent className="p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CardIcon className="h-4 w-4 text-tsia-green" />{String(label)}</div><p className="mt-2 text-xl font-bold">{money(value)}</p></CardContent></Card>;
      })}
    </div>

    <Card className="overflow-hidden"><CardHeader className="border-b bg-slate-50/70 dark:bg-slate-900/60"><CardTitle className="text-base">Service wallets</CardTitle><p className="text-sm text-slate-500">Balances are isolated by service. Adjustments accept a signed amount: positive credits, negative debits.</p></CardHeader><CardContent className="p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" value={walletQuery} onChange={event => setWalletQuery(event.target.value)} placeholder="Search user name, email, or ID" /></div><Select value={walletType} onValueChange={setWalletType}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All service wallets</SelectItem>{SERVICE_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
      {walletsQuery.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading service wallets…</p> : walletsQuery.isError ? <p className="py-8 text-center text-sm text-rose-600">Unable to load service wallets. Please retry.</p> : walletRows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No service wallets match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-xs text-slate-500"><tr><th className="pb-3 font-medium">User</th><th className="pb-3 font-medium">Service wallet</th><th className="pb-3 font-medium">Balance</th><th className="pb-3 font-medium">Latest activity</th><th className="pb-3" /></tr></thead><tbody className="divide-y">{walletRows.map((row, index) => <tr key={`${row.userId ?? row.user?.id ?? index}-${row.serviceType ?? row.type}`}><td className="py-3"><p className="font-medium">{userName(row)}</p><p className="text-xs text-slate-500">{row.user?.email ?? row.email ?? `ID ${row.userId ?? row.id}`}</p></td><td className="py-3"><ServiceBadge type={row.serviceType ?? row.type} /></td><td className="py-3 font-semibold">{money(getBalance(row))}</td><td className="py-3 text-xs text-slate-500">{dateTime(row.latestActivityAt ?? row.lastActivityAt ?? row.updatedAt ?? row.lastTransactionAt)}</td><td className="py-3 text-right"><Button size="sm" variant="outline" onClick={() => openAdjustment(row)}>Adjust</Button></td></tr>)}</tbody></table></div>}
    </CardContent></Card>

    <Card className="overflow-hidden"><CardHeader className="border-b bg-slate-50/70 dark:bg-slate-900/60"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-tsia-green" /> Transaction PIN security</CardTitle><p className="text-sm text-slate-500">Unlock restores access; reset removes the existing PIN so the user must enroll again.</p></CardHeader><CardContent className="p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" value={pinQuery} onChange={event => setPinQuery(event.target.value)} placeholder="Search user name, email, or ID" /></div><Select value={pinStatus} onValueChange={setPinStatus}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="set">Set</SelectItem><SelectItem value="unset">Unset</SelectItem><SelectItem value="locked">Locked</SelectItem></SelectContent></Select></div>
      {pinsQuery.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading PIN security records…</p> : pinsQuery.isError ? <p className="py-8 text-center text-sm text-rose-600">Unable to load PIN records. Please retry.</p> : pinRows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No PIN records match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b text-left text-xs text-slate-500"><tr><th className="pb-3 font-medium">User</th><th className="pb-3 font-medium">PIN status</th><th className="pb-3 font-medium">Attempts</th><th className="pb-3 font-medium">Lock expiry</th><th className="pb-3 font-medium">Set time</th><th className="pb-3 font-medium">Announcement</th><th className="pb-3" /></tr></thead><tbody className="divide-y">{pinRows.map((row, index) => {
        const status = pinStatusFor(row);
        return <tr key={row.userId ?? row.user?.id ?? row.id ?? index}><td className="py-3"><p className="font-medium">{userName(row)}</p><p className="text-xs text-slate-500">{row.user?.email ?? row.email ?? `ID ${row.userId ?? row.id}`}</p></td><td className="py-3"><PinBadge row={row} /></td><td className="py-3">{row.failedAttempts ?? row.attempts ?? 0}</td><td className="py-3 text-xs text-slate-500">{dateTime(row.lockedUntil ?? row.lockExpiresAt ?? row.lockExpiry)}</td><td className="py-3 text-xs text-slate-500">{dateTime(row.transactionPinSetAt ?? row.setAt ?? row.pinSetAt)}</td><td className="py-3"><Badge variant="outline" className="text-xs">{row.announcementSeenAt || row.announcementSeen || row.announcementStatus === "seen" ? "Seen" : row.announcementNotifiedAt ? "Notified" : "Pending"}</Badge></td><td className="py-3 text-right whitespace-nowrap"><Button size="sm" variant="outline" className="mr-2" disabled={status !== "locked"} onClick={() => openPinAction(row, "unlock")}><Unlock className="mr-1 h-3.5 w-3.5" /> Unlock</Button><Button size="sm" variant="outline" disabled={status !== "set" && status !== "locked"} onClick={() => openPinAction(row, "reset")}>Reset</Button></td></tr>;
      })}</tbody></table></div>}
    </CardContent></Card>

    <Dialog open={!!adjusting} onOpenChange={open => !open && closeAdjustment()}><DialogContent><DialogHeader><DialogTitle>Signed service wallet adjustment</DialogTitle><DialogDescription>Adjusting {userName(adjusting ?? {})}'s {SERVICE_TYPES.find(type => type.value === (adjusting?.serviceType ?? adjusting?.type))?.label ?? "service"} wallet.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" /><strong>Warning:</strong> this directly changes a separated user balance. Use a positive amount to credit or a negative amount to debit. This action is audit-recorded.</div><div className="space-y-2"><Label>Signed amount (USD)</Label><Input type="number" step="0.01" value={adjustmentAmount} onChange={event => setAdjustmentAmount(event.target.value)} placeholder="e.g. 25.00 or -25.00" /></div><div className="space-y-2"><Label>Reason <span className="text-rose-500">*</span></Label><Textarea value={adjustmentNote} onChange={event => setAdjustmentNote(event.target.value)} placeholder="Explain the reconciliation or correction" /></div></div><DialogFooter><Button variant="outline" onClick={closeAdjustment}>Cancel</Button><Button disabled={adjustmentNote.trim().length < 5 || !adjustmentAmount || adjustmentMutation.isPending} onClick={() => adjustmentMutation.mutate()}>{adjustmentMutation.isPending ? "Recording…" : "Confirm signed adjustment"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!pinAction} onOpenChange={open => !open && closePinAction()}><DialogContent><DialogHeader><DialogTitle>{pinAction?.action === "unlock" ? "Unlock transaction PIN" : "Reset transaction PIN"}</DialogTitle><DialogDescription>{pinAction?.action === "unlock" ? "This clears the PIN lock for" : "This removes the existing PIN for"} {userName(pinAction?.row ?? {})}. The action is logged and cannot be silent.</DialogDescription></DialogHeader><div className="space-y-2 py-2"><Label>Reason <span className="text-rose-500">*</span></Label><Textarea value={pinReason} onChange={event => setPinReason(event.target.value)} placeholder="Case, verification result, or support reason" /></div><DialogFooter><Button variant="outline" onClick={closePinAction}>Cancel</Button><Button disabled={pinReason.trim().length < 5 || pinMutation.isPending} className={pinAction?.action === "reset" ? "bg-rose-600 hover:bg-rose-700" : ""} onClick={() => pinMutation.mutate()}>{pinMutation.isPending ? "Confirming…" : `Confirm ${pinAction?.action ?? "action"}`}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}