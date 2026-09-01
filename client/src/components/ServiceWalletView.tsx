import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, WalletCards } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ServiceWalletType = "manual" | "signals" | "tsmart";

const labels: Record<ServiceWalletType, string> = {
  manual: "Manual Trading Wallet",
  signals: "Trading Signals Wallet",
  tsmart: "TS-Mart Wallet",
};

const formatMoney = (value: unknown) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ServiceWalletView({ walletType, description }: { walletType: ServiceWalletType; description?: string }) {
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const walletKey = ["/api/service-wallets", walletType];
  const ledgerKey = ["/api/service-wallets", walletType, "transactions"];
  const { data: wallet, isLoading, isError, refetch } = useQuery<any>({
    queryKey: walletKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/service-wallets/${walletType}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Could not load this wallet.");
      return response.json();
    },
    refetchInterval: 30000,
  });
  const { data: transactions = [], isLoading: ledgerLoading, isError: ledgerError } = useQuery<any[]>({
    queryKey: ledgerKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/service-wallets/${walletType}/transactions`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Could not load wallet activity.");
      return response.json();
    },
    refetchInterval: 30000,
  });
  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ledgerKey });
  };
  const action = useMutation({
    mutationFn: async (kind: "from" | "to" | "kora") => {
      const amountUsd = Number(amount);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Enter an amount greater than $0.");
      const endpoint = kind === "from" ? "transfer-from-swift" : kind === "to" ? "transfer-to-swift" : "korapay/initiate";
      const response = await apiRequest("POST", `/api/service-wallets/${walletType}/${endpoint}`, { amountUsd });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "This wallet action could not be completed.");
      return { kind, data };
    },
    onSuccess: ({ kind, data }) => {
      setError(null);
      if (kind === "kora" && data.checkoutUrl) {
        const popup = window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
        if (!popup) window.location.assign(data.checkoutUrl);
        setNotice("Korapay checkout opened. Complete payment, then refresh your wallet.");
      } else {
        setNotice(kind === "from" ? "Funds transferred from Swift Wallet." : "Funds transferred to Swift Wallet.");
        setAmount("");
        refresh();
      }
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message || "Something went wrong. Please try again.");
    },
  });
  const run = (kind: "from" | "to" | "kora") => {
    setError(null); setNotice(null); action.mutate(kind);
  };

  return <div className="space-y-4">
    <header className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-tsia-green"><WalletCards className="h-4 w-4" /> Independent wallet</div><h2 className="mt-1 text-2xl font-black">{labels[walletType]}</h2><p className="mt-1 text-sm text-white/60">{description || "Balance and activity are kept separate from your other wallets."}</p></div>
      <button onClick={refresh} className="rounded-xl border border-white/10 p-2.5 hover:bg-white/10" aria-label="Refresh wallet"><RefreshCw className="h-4 w-4" /></button>
    </header>
    <section className="rounded-2xl border border-tsia-green/25 bg-gradient-to-br from-tsia-green/20 to-slate-900 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-white/60">Available balance</p>
      <p className="mt-2 text-4xl font-black">{isLoading ? "—" : formatMoney(wallet?.balance)} <span className="text-sm text-tsia-green">USD</span></p>
      {isError && <p className="mt-3 text-xs text-rose-300">Unable to load balance. Please refresh and try again.</p>}
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <label className="block text-xs font-bold text-white/70">Amount (USD)<input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="0.00" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-base outline-none focus:border-tsia-green" /></label>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-tsia-green/15 px-3 py-2 text-xs text-tsia-green">{notice}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button disabled={action.isPending} onClick={() => run("kora")} className="rounded-xl bg-tsia-green px-3 py-3 text-sm font-bold text-white disabled:opacity-50">Fund with Kora</button>
        <button disabled={action.isPending} onClick={() => run("from")} className="rounded-xl border border-tsia-gold/40 px-3 py-3 text-sm font-bold text-tsia-gold disabled:opacity-50"><ArrowDownToLine className="mr-1 inline h-4 w-4" />From Swift</button>
        <button disabled={action.isPending} onClick={() => run("to")} className="rounded-xl border border-blue-400/40 px-3 py-3 text-sm font-bold text-blue-300 disabled:opacity-50"><ArrowUpFromLine className="mr-1 inline h-4 w-4" />To Swift</button>
      </div>
      {action.isPending && <p className="mt-2 text-xs text-white/50">Processing wallet action…</p>}
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-bold">Wallet activity</h3><span className="text-xs text-white/45">{transactions.length} records</span></div>
      {ledgerLoading ? <div className="h-14 animate-pulse rounded-xl bg-white/10" /> : ledgerError ? <p className="py-5 text-center text-sm text-rose-300">Unable to load activity.</p> : transactions.length === 0 ? <p className="py-6 text-center text-sm text-white/45">No wallet activity yet.</p> : transactions.slice(0, 10).map((tx: any) => { const value = Number(tx.amountUsd ?? tx.amount ?? tx.netAmount ?? 0); const outgoing = value < 0; return <div key={tx.id} className="flex items-center justify-between border-t border-white/10 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold capitalize">{String(tx.description || tx.type || "Wallet activity").replace(/_/g, " ")}</p><p className="text-[11px] text-white/45">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : tx.status || ""}</p></div><b className={outgoing ? "text-rose-300" : "text-tsia-green"}>{outgoing ? "-" : "+"}{formatMoney(Math.abs(value))}</b></div>; })}
    </section>
  </div>;
}