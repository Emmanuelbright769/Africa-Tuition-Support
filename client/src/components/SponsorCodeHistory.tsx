import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, HeartHandshake, Loader2, RefreshCw, ShieldCheck, Tag } from "lucide-react";
import { apiRequest, parseApiError, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SponsorCode = {
  purchaseId?: number | string; code: string; cohortId?: number | string;
  amountUsd?: number | string; currency?: string; transactionId?: string;
  reference?: string; status?: "available" | "disabled" | "redeemed";
  purchasedAt?: string; redeemedAt?: string;
  redeemedBy?: { firstName?: string; lastName?: string; email?: string } | null;
};

const date = (value?: string) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const statusStyle: Record<string, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  redeemed: "border-slate-200 bg-slate-100 text-slate-600",
  disabled: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function SponsorCodeHistory() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const attemptKey = useRef<string | null>(null);
  const query = useQuery<SponsorCode[]>({
    queryKey: ["/api/affiliate/scholarship-sponsor-codes"],
    queryFn: async () => {
      const response = await fetch("/api/affiliate/scholarship-sponsor-codes", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load sponsor codes");
      return response.json();
    },
  });
  const purchase = useMutation({
    mutationFn: async () => {
      if (!attemptKey.current) attemptKey.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const response = await apiRequest("POST", "/api/affiliate/scholarship-sponsor-code", { amountUsd: 5.5, currency: "USD" }, { "Idempotency-Key": attemptKey.current });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Purchase could not be completed");
      return result;
    },
    onSuccess: (result) => {
      attemptKey.current = null;
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate/scholarship-sponsor-codes"] });
      toast({ title: "Sponsor code purchased", description: `${result.code} is ready to share.` });
    },
    onError: (error: Error) => toast({ title: "Purchase not completed", description: parseApiError(error), variant: "destructive" }),
  });
  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1800);
  };
  const codes = query.data ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-tsia-green">Affiliate operations</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold"><HeartHandshake className="h-6 w-6 text-tsia-green" /> Sponsorship Cohort</h2>
          <p className="mt-1 text-sm text-muted-foreground">Purchase a single-use scholarship code and keep a clear record of every sponsorship.</p>
        </div>
        <Button className="bg-tsia-green text-white hover:bg-tsia-green/90" onClick={() => purchase.mutate()} disabled={purchase.isPending} data-testid="button-buy-sponsor-code">
          {purchase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
          Buy code · $5.50
        </Button>
      </div>
      <div className="rounded-2xl border border-tsia-green/20 bg-tsia-green/[0.045] p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-tsia-green" /><span>Codes are single-use. Share an available code with a student; it becomes redeemed when applied during onboarding.</span></div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5"><div><h3 className="font-semibold">Purchase history</h3><p className="text-xs text-muted-foreground">{codes.length} code{codes.length === 1 ? "" : "s"} recorded</p></div><Button variant="ghost" size="icon" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh purchase history"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button></div>
        {query.isLoading ? <div className="space-y-3 p-5"><div className="h-12 animate-pulse rounded-xl bg-muted" /><div className="h-12 animate-pulse rounded-xl bg-muted" /></div> :
          query.isError ? <div className="p-8 text-center"><p className="text-sm font-medium">Purchase history is unavailable.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div> :
          codes.length === 0 ? <div className="p-10 text-center"><Tag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/35" /><p className="font-medium">No sponsor codes yet</p><p className="mt-1 text-xs text-muted-foreground">Your completed purchases will appear here.</p></div> :
          <div className="divide-y">
            {codes.map((item, index) => <div key={item.purchaseId ?? `${item.code}-${index}`} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tsia-gold/15 text-tsia-gold"><Tag className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><code className="font-mono text-sm font-bold tracking-wide">{item.code}</code><Badge variant="outline" className={`text-[10px] capitalize ${statusStyle[item.status ?? "available"]}`}>{item.status ?? "available"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Purchased {date(item.purchasedAt)} · Cohort {item.cohortId ?? "—"}</p></div></div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => copy(item.code)} disabled={item.status !== "available"}>{copied === item.code ? <Check className="mr-1.5 h-3.5 w-3.5 text-tsia-green" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copied === item.code ? "Copied" : "Copy code"}</Button>
            </div>)}
          </div>}
      </div>
    </div>
  );
}