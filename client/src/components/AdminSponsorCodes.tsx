import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Search, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { apiRequest, parseApiError, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RecordItem = { purchaseId: number | string | null; code: string; cohortId?: number | string; amountUsd?: number | string | null; currency?: string; transactionId?: number | string | null; reference?: string | null; status: string; purchasedAt?: string; redeemedAt?: string | null; legacy?: boolean; purchaser?: { firstName?: string; lastName?: string; email?: string } | null; redeemedBy?: { firstName?: string; lastName?: string; email?: string } | null };
type Report = { summary?: { totalPurchases: number; totalRevenue: number; availableCodes: number; redeemedCodes: number; disabledCodes: number }; records?: RecordItem[] };
const money = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
const when = (d?: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const person = (p?: RecordItem["purchaser"]) => p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "Unknown" : "—";
const pill: Record<string, string> = { available: "bg-emerald-50 text-emerald-700 border-emerald-200", redeemed: "bg-slate-100 text-slate-600 border-slate-200", disabled: "bg-rose-50 text-rose-700 border-rose-200" };

export default function AdminSponsorCodes() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState<RecordItem | null>(null);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const report = useQuery<Report>({
    queryKey: ["/api/admin/sponsor-code-purchases", search, status],
    queryFn: async () => { const params = new URLSearchParams({ q: search, status }); const r = await fetch(`/api/admin/sponsor-code-purchases?${params}`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load sponsor-code report"); return r.json(); },
  });
  const update = useMutation({
    mutationFn: async ({ record, next }: { record: RecordItem; next: "available" | "disabled" }) => { const r = await apiRequest("PATCH", `/api/admin/sponsor-code-purchases/${record.purchaseId}/status`, { status: next, reason: reason.trim() }); const body = await r.json(); if (!r.ok) throw new Error(body.message || "Status update failed"); return body; },
    onSuccess: () => { setPending(null); setReason(""); queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsor-code-purchases"] }); toast({ title: "Code status updated", description: "The sponsor-code register has been refreshed." }); },
    onError: (e: Error) => toast({ title: "Update failed", description: parseApiError(e), variant: "destructive" }),
  });
  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1800);
  };
  const s = report.data?.summary ?? { totalPurchases: 0, totalRevenue: 0, availableCodes: 0, redeemedCodes: 0, disabledCodes: 0 };
  const cards = [["Purchases", s.totalPurchases, "bg-tsia-green/10 text-tsia-green"], ["Revenue", money(s.totalRevenue), "bg-tsia-gold/15 text-amber-700"], ["Available", s.availableCodes, "bg-emerald-50 text-emerald-700"], ["Redeemed", s.redeemedCodes, "bg-slate-100 text-slate-600"], ["Disabled", s.disabledCodes, "bg-rose-50 text-rose-700"]];
  return <div className="space-y-5">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-tsia-green">Controls · Scholarship operations</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-tsia-green" /> Sponsor Codes</h2><p className="mt-1 text-sm text-muted-foreground">Track purchases, cohorts, redemptions and code availability from one register.</p></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{cards.map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border bg-card p-4 shadow-sm"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}><CheckCircle2 className="h-4 w-4" /></div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search code, reference, email or transaction" value={search} onChange={e => setSearch(e.target.value)} /></div><select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-40"><option value="all">All statuses</option><option value="available">Available</option><option value="disabled">Disabled</option><option value="redeemed">Redeemed</option></select></div>
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="border-b px-4 py-3"><h3 className="font-semibold">Purchase and redemption register</h3><p className="text-xs text-muted-foreground">{report.data?.records?.length ?? 0} records in current view</p></div>
      {report.isLoading ? <div className="space-y-3 p-5"><div className="h-10 animate-pulse rounded bg-muted" /><div className="h-10 animate-pulse rounded bg-muted" /></div> : report.isError ? <div className="p-8 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" /><p className="text-sm">Report unavailable. Try again.</p><Button variant="outline" className="mt-3" onClick={() => report.refetch()}>Retry</Button></div> : !report.data?.records?.length ? <div className="p-10 text-center text-sm text-muted-foreground">No sponsor-code records match these filters.</div> :
      <div className="divide-y">{report.data.records.map((r, index) => <div key={r.purchaseId ?? `${r.cohortId}-${index}`} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/25 lg:grid lg:grid-cols-[1.25fr_1fr_.8fr_1fr_auto] lg:items-center lg:gap-4">
        <div><div className="flex items-center gap-2"><code className="font-mono text-sm font-bold">{r.code}</code><Badge variant="outline" className={`text-[10px] capitalize ${pill[r.status] ?? ""}`}>{r.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Purchased {when(r.purchasedAt)} · Cohort {r.cohortId ?? "—"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{r.reference ?? (r.legacy ? "Historical cohort" : "No reference")}</p></div>
        <div className="text-xs"><p className="font-medium">{person(r.purchaser)}</p><p className="text-muted-foreground">{r.purchaser?.email ?? r.reference ?? "No purchaser detail"}</p></div>
        <div className="text-xs">{r.amountUsd === null || r.amountUsd === undefined ? <><p className="font-semibold text-muted-foreground">Payment data unavailable</p><p className="text-muted-foreground">Historical record</p></> : <><p className="font-semibold">{money(r.amountUsd)} {r.currency ?? "USD"}</p><p className="text-muted-foreground">Transaction {r.transactionId ?? "unavailable"}</p></>}</div>
        <div className="text-xs"><p className="font-medium">{r.status === "redeemed" ? person(r.redeemedBy) : "Not redeemed"}</p><p className="text-muted-foreground">{r.redeemedAt ? when(r.redeemedAt) : r.legacy ? "Legacy record" : "—"}</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => copy(r.code)}>{copied === r.code ? <Check className="h-4 w-4 text-tsia-green" /> : <Copy className="h-4 w-4" />}<span className="sr-only">Copy code</span></Button>{r.status !== "redeemed" && r.purchaseId !== null && <Button variant="outline" size="sm" onClick={() => { setPending(r); setReason(""); }}><span className="hidden sm:inline">{r.status === "available" ? "Disable" : "Enable"}</span>{r.status === "available" ? <ToggleRight className="h-4 w-4 sm:ml-2" /> : <ToggleLeft className="h-4 w-4 sm:ml-2" />}</Button>}</div>
      </div>)}</div>}</div>
    {pending && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => e.currentTarget === e.target && setPending(null)}><div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl"><h3 className="text-lg font-bold">{pending.status === "available" ? "Disable" : "Enable"} sponsor code</h3><p className="mt-1 text-sm text-muted-foreground">Code <code className="font-mono font-semibold">{pending.code}</code> will be marked {pending.status === "available" ? "disabled" : "available"}.</p><label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Reason <span className="text-rose-600">*</span></label><Input className="mt-2" value={reason} onChange={e => setReason(e.target.value)} placeholder="Add an audit note (minimum 5 characters)" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setPending(null)}>Cancel</Button><Button className="bg-tsia-green text-white" disabled={reason.trim().length < 5 || update.isPending} onClick={() => update.mutate({ record: pending, next: pending.status === "available" ? "disabled" : "available" })}>{update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</Button></div></div></div>}
  </div>;
}