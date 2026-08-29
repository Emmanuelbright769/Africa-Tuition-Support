import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, History } from "lucide-react";

type TradeTransaction = {
  id: number;
  type: string;
  amountUsd: string;
  netAmount: string;
  status: string;
  note?: string | null;
  createdAt: string;
};

function isoWeekKey(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(key: string) {
  const [year, week] = key.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4.getTime() - (((jan4.getUTCDay() || 7) - 1) * 86400000) + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const format = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${format(monday)}–${format(sunday)}`;
}

function transactionLabel(transaction: TradeTransaction, net: number) {
  const labels: Record<string, string> = {
    deposit: "Deposit",
    bot_earning: net < 0 ? "Bot Loss" : "Bot Earnings",
    withdraw_bank: "Bank Withdrawal",
    withdraw_exchange: "Exchange Withdrawal",
    trade_transfer: "Trade Transfer",
    commission_credit: "Commission Credit",
    referral_commission: "Referral Commission",
  };
  return labels[transaction.type] ?? transaction.type.replaceAll("_", " ");
}

export default function TradeHistoryView({ transactions }: { transactions: TradeTransaction[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const history = useMemo(() => [...(transactions ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [transactions]);
  const weekly = useMemo(() => {
    const buckets = new Map<string, { profit: number; loss: number }>();
    history
      .filter(transaction => transaction.type === "bot_earning" && !String(transaction.note ?? "").startsWith("Referral commission"))
      .forEach(transaction => {
        const key = isoWeekKey(new Date(transaction.createdAt));
        const current = buckets.get(key) ?? { profit: 0, loss: 0 };
        const net = Number(transaction.netAmount ?? transaction.amountUsd ?? 0);
        if (net >= 0) current.profit += net;
        else current.loss += Math.abs(net);
        buckets.set(key, current);
      });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, totals]) => ({
      week: weekLabel(key),
      profit: Number(totals.profit.toFixed(4)),
      loss: Number(totals.loss.toFixed(4)),
      net: Number((totals.profit - totals.loss).toFixed(4)),
    }));
  }, [history]);

  const totals = weekly.reduce((result, item) => ({
    profit: result.profit + item.profit,
    loss: result.loss + item.loss,
    net: result.net + item.net,
  }), { profit: 0, loss: 0, net: 0 });
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  const visible = history.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-5" data-testid="panel-trade-history">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f] p-6 text-white shadow-2xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(16,185,129,.16),transparent_42%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-emerald-400">
              <History className="h-4 w-4" /> Itera record
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Trading History</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Weekly performance, completed bot sessions and every Trade Market wallet movement in one place.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Total records</p>
            <p className="mt-1 text-2xl font-black">{history.length}</p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-lg" data-testid="panel-pnl-chart">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-black">Weekly Profit &amp; Loss</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-300">{weekly.length} week{weekly.length === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[.07] p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Profit</p>
              <p className="mt-1 text-sm font-black text-emerald-300">${totals.profit.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-white/[.07] p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-rose-300">Loss</p>
              <p className="mt-1 text-sm font-black text-rose-300">${totals.loss.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-white/[.07] p-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-300">Net</p>
              <p className={`mt-1 text-sm font-black ${totals.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{totals.net >= 0 ? "+" : ""}${totals.net.toFixed(4)}</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {weekly.length ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weekly} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value.toFixed(1)}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`$${Math.abs(value).toFixed(4)}`, name === "profit" ? "Profit" : name === "loss" ? "Loss" : "Net"]}
                    contentStyle={{ borderRadius: 14, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                  />
                  <Legend formatter={value => value === "profit" ? "Profit" : value === "loss" ? "Loss" : "Net"} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: "#22c55e" }} />
                  <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444" }} />
                  <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {weekly.slice().reverse().map(item => (
                  <div key={item.week} className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-semibold text-muted-foreground">{item.week}</span>
                    <span className={`font-black ${item.net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{item.net >= 0 ? "+" : ""}${item.net.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <CalendarDays className="mb-3 h-9 w-9 text-muted-foreground/40" />
              <p className="font-bold">No completed Itera sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your weekly profit and loss chart will appear after the first session settles.</p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-black">Transaction History</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Deposits, settlements, transfers and withdrawals</p>
          </div>
          <History className="h-4 w-4 text-emerald-500" />
        </div>
        {history.length ? (
          <>
            <div className="divide-y">
              {visible.map(transaction => {
                const net = Number(transaction.netAmount ?? transaction.amountUsd ?? 0);
                const incoming = transaction.type === "deposit" || net >= 0;
                return (
                  <div key={transaction.id} className="flex items-start gap-3 px-4 py-4" data-testid={`row-trade-tx-${transaction.id}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${incoming ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"}`}>
                      {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black capitalize">{transactionLabel(transaction, net)}</p>
                        <p className={`shrink-0 text-xs font-black ${incoming ? "text-emerald-600" : "text-rose-500"}`}>{incoming ? "+" : "-"}${Math.abs(net).toFixed(4)}</p>
                      </div>
                      {transaction.note && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={transaction.note}>{transaction.note}</p>}
                      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span>{new Date(transaction.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })} GMT</span>
                        <span className={`rounded-full px-1.5 py-0.5 font-bold ${transaction.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{transaction.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <button onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button>
                <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        ) : (
          <div className="py-14 text-center">
            <History className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
            <p className="font-bold">No Trade Market activity yet</p>
          </div>
        )}
      </section>
    </div>
  );
}