import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, ArrowRight, Banknote, Bell, CheckCircle2, ChevronRight,
  Clock3, FileText, Filter, Landmark, Lock, Mail, MoreHorizontal, Search,
  ShieldAlert, ShieldCheck, UserRound, Wallet, XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Status({ value }: { value?: string | null }) {
  const status = value || "not started";
  const tone = status === "verified" || status === "active" || status === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "suspended" || status === "rejected" || status === "failed"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return <Badge variant="outline" className={`capitalize text-[11px] ${tone}`}>{status}</Badge>;
}

type Props = {
  onNotify: (user: any) => void;
  onEdit: (user: any) => void;
  onWallet: (user: any) => void;
  onReferrer: (user: any) => void;
  onLien: (user: any) => void;
  onDelete: (user: any) => void;
  onManualCredit: () => void;
};

export default function AdminUsersWorkspace(props: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [verificationStatus, setVerificationStatus] = useState("all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [statusDialog, setStatusDialog] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users", page, query, role, verificationStatus, accountStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (query.trim()) params.set("q", query.trim());
      if (role !== "all") params.set("role", role);
      if (verificationStatus !== "all") params.set("verificationStatus", verificationStatus);
      if (accountStatus !== "all") params.set("accountStatus", accountStatus);
      const response = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to load users");
      return response.json();
    },
    placeholderData: (previous) => previous,
  });

  const detailQuery = useQuery({
    queryKey: ["/api/admin/users", selectedId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${selectedId}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to load user");
      return response.json();
    },
    enabled: !!selectedId,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${id}/status`, {
        status, reason: reason.trim(), reference: reference.trim(),
        idempotencyKey: `account-${id}-${status}-${Date.now()}`,
      });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to update account");
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.status === "suspended" ? "Account suspended" : "Account reactivated", description: "The action was recorded in the admin audit log." });
      setStatusDialog(null);
      setReason("");
      setReference("");
      usersQuery.refetch();
      detailQuery.refetch();
    },
    onError: (error: any) => toast({ title: "Action failed", description: error.message, variant: "destructive" }),
  });

  const data = usersQuery.data ?? { items: [], total: 0, totalPages: 1, page: 1 };
  const selected = detailQuery.data;
  const selectedUser = selected?.user;
  const counts = useMemo(() => ({
    active: (data.items || []).filter((u: any) => u.accountStatus === "active").length,
    attention: (data.items || []).filter((u: any) => ["pending", "manual_review"].includes(u.verificationStatus || u.identityStatus)).length,
  }), [data.items]);

  const applyFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5" data-testid="admin-users-workspace">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-tsia-green">
            <UserRound className="h-4 w-4" /> User directory
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Every account, one workspace</h2>
          <p className="mt-1 text-sm text-slate-500">Search by identity, contact details, role, country, or affiliate code. Results are paginated server-side.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
          <Button className="h-11 rounded-xl bg-amber-600 hover:bg-amber-700" onClick={props.onManualCredit}><Banknote className="mr-2 h-4 w-4" /> Manual payment credit</Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Matching users</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{data.total}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Active on page</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{counts.active}</p>
          </div>
          <div className="hidden rounded-xl border bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Needs review</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{counts.attention}</p>
          </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, phone, affiliate code, or user ID…" className="h-10 rounded-xl pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={role} onValueChange={(value) => applyFilter(setRole, value)}>
                <SelectTrigger className="h-10 w-[130px] rounded-xl"><SelectValue placeholder="All roles" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="student">Students</SelectItem><SelectItem value="affiliate">Affiliates</SelectItem></SelectContent>
              </Select>
              <Select value={verificationStatus} onValueChange={(value) => applyFilter(setVerificationStatus, value)}>
                <SelectTrigger className="h-10 w-[150px] rounded-xl"><SelectValue placeholder="Verification" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All verification</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
              </Select>
              <Select value={accountStatus} onValueChange={(value) => applyFilter(setAccountStatus, value)}>
                <SelectTrigger className="h-10 w-[140px] rounded-xl"><SelectValue placeholder="Account state" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All accounts</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => { setQuery(""); setRole("all"); setVerificationStatus("all"); setAccountStatus("all"); setPage(1); }}>
                <Filter className="mr-2 h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle className="text-base">Accounts</CardTitle><p className="mt-1 text-xs text-slate-500">Open an account for profile, compliance, funds, and activity.</p></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Live directory</div>
          </div>
        </CardHeader>
        {usersQuery.isLoading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
        ) : usersQuery.isError ? (
          <div className="p-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-500" /><p className="mt-2 font-semibold">Directory unavailable</p><p className="mt-1 text-sm text-slate-500">Refresh to retry the user search.</p><Button className="mt-4" onClick={() => usersQuery.refetch()}>Retry</Button></div>
        ) : (data.items || []).length === 0 ? (
          <div className="p-12 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">No matching accounts</p><p className="mt-1 text-sm text-slate-500">Try a broader search or clear the filters.</p></div>
        ) : (
          <>
            <div className="divide-y dark:divide-slate-800">
              {(data.items || []).map((item: any) => (
                <div key={item.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50 lg:flex-row lg:items-center">
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setSelectedId(item.id); setDetailTab("overview"); }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tsia-green/10 text-sm font-bold text-tsia-green">{`${item.firstName?.[0] || ""}${item.lastName?.[0] || ""}`}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-slate-900 dark:text-white">{item.firstName} {item.lastName}</p><Status value={item.accountStatus} /></div>
                      <p className="truncate text-xs text-slate-500">{item.email} · ID {item.id}</p>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4 lg:w-[520px]">
                    <div><p className="text-slate-400">Role</p><p className="mt-0.5 capitalize font-medium">{item.role}</p></div>
                    <div><p className="text-slate-400">Verification</p><div className="mt-0.5"><Status value={item.verificationStatus || item.identityStatus} /></div></div>
                    <div><p className="text-slate-400">Wallet</p><p className="mt-0.5 font-semibold">{fmt(item.walletBalance)}</p></div>
                    <div><p className="text-slate-400">Joined</p><p className="mt-0.5 font-medium">{date(item.createdAt)}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => { setSelectedId(item.id); setDetailTab("overview"); }}>Open <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => props.onNotify(item)}><Bell className="mr-1 h-3.5 w-3.5" /> Notify</Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2" onClick={() => setStatusDialog(item)}><MoreHorizontal className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-slate-500 dark:border-slate-800">
              <span>Page {data.page} of {data.totalPages} · {data.total} total</span>
              <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Previous</Button><Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1rem)] max-w-5xl flex-col overflow-hidden p-0">
          {detailQuery.isLoading ? <div className="p-12 text-center text-sm text-slate-500">Loading user workspace…</div> : !selected ? <div className="p-12 text-center text-sm text-rose-500">Unable to load this account.</div> : (
            <>
              <DialogHeader className="border-b bg-slate-950 px-5 py-5 text-white dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div><DialogTitle className="text-xl text-white">{selectedUser.firstName} {selectedUser.lastName}</DialogTitle><DialogDescription className="mt-1 text-slate-300">{selectedUser.email} · Account ID {selectedUser.id} · Joined {date(selectedUser.createdAt)}</DialogDescription></div>
                  <Status value={selectedUser.accountStatus} />
                </div>
              </DialogHeader>
              <div className="border-b px-5 dark:border-slate-800"><div className="flex gap-5 overflow-x-auto">
                {[["overview", "Overview"], ["money", "Money & wallets"], ["activity", "Activity"], ["records", "Records"], ["audit", "Action history"]].map(([value, label]) => <button key={value} className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-semibold ${detailTab === value ? "border-tsia-green text-tsia-green" : "border-transparent text-slate-500"}`} onClick={() => setDetailTab(value)}>{label}</button>)}
              </div></div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {detailTab === "overview" && <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric icon={Wallet} label="Swift wallet" value={fmt(selected.wallet?.balance)} />
                    <Metric icon={Landmark} label="Trade balance" value={fmt(selected.tradeWallet?.tradeBalance)} />
                    <Metric icon={ShieldCheck} label="Identity" value={selected.identity?.[0]?.status || "Not started"} />
                    <Metric icon={Activity} label="Transactions" value={selected.transactions?.length || 0} />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InfoCard title="Account & compliance"><Info label="Phone" value={selectedUser.phone} /><Info label="Country" value={selectedUser.country?.toUpperCase()} /><Info label="Role" value={selectedUser.role} /><Info label="Academic verification" value={selected.verification?.status || "Not started"} /><Info label="Tier" value={selected.verification?.tier || "—"} /></InfoCard>
                    <InfoCard title="Available controls"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => props.onEdit(selectedUser)}><UserRound className="mr-1.5 h-3.5 w-3.5" /> Edit profile</Button><Button size="sm" variant="outline" onClick={() => props.onWallet({ ...selectedUser, wallet: selected.wallet })}><Wallet className="mr-1.5 h-3.5 w-3.5" /> Adjust wallet</Button><Button size="sm" variant="outline" onClick={() => props.onNotify(selectedUser)}><Bell className="mr-1.5 h-3.5 w-3.5" /> Notify</Button><Button size="sm" variant="outline" onClick={() => props.onLien({ ...selectedUser, wallet: selected.wallet })}><Lock className="mr-1.5 h-3.5 w-3.5" /> Manage lien</Button><Button size="sm" variant="outline" onClick={() => props.onReferrer(selectedUser)}><UserRound className="mr-1.5 h-3.5 w-3.5" /> Referral source</Button></div></InfoCard>
                  </div>
                  <InfoCard title="Uploaded documents">{(selected.files || []).length === 0 ? <Empty text="No uploaded documents" /> : selected.files.map((file: any) => <div key={file.id} className="flex items-center justify-between border-b py-2 last:border-0"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /><div><p className="text-sm font-medium">{file.fileName}</p><p className="text-xs text-slate-500">{file.category} · {date(file.createdAt)}</p></div></div><a className="text-xs font-semibold text-tsia-green hover:underline" href={`/api/admin/files/${file.id}`} target="_blank" rel="noreferrer">View</a></div>)}</InfoCard>
                </div>}
                {detailTab === "money" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={Wallet} label="Swift wallet" value={fmt(selected.wallet?.balance)} /><Metric icon={Banknote} label="Cashback" value={fmt(selected.wallet?.cashbackBalance)} /><Metric icon={Lock} label="Lien" value={fmt(selected.wallet?.lienAmount)} /></div><DataList title="Wallet ledger" rows={selected.transactions} empty="No wallet transactions" render={(item: any) => <Row title={item.description} meta={`${item.type} · ${date(item.createdAt)}`} value={fmt(item.amount)} />} /><DataList title="Deposits" rows={selected.deposits} empty="No deposits" render={(item: any) => <Row title={`Deposit #${item.id}`} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.amountUsd)} />} /><DataList title="Withdrawals" rows={selected.withdrawals} empty="No withdrawals" render={(item: any) => <Row title={`${item.type} withdrawal #${item.id}`} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.amount)} />} /></div>}
                {detailTab === "activity" && <div className="space-y-4"><DataList title="Notifications" rows={selected.notifications} empty="No notifications" render={(item: any) => <Row title={item.title} meta={`${item.type} · ${date(item.createdAt)}`} value={item.isRead ? "Read" : "Unread"} />} /><DataList title="Transfers" rows={selected.transfers} empty="No wallet transfers" render={(item: any) => <Row title={item.note || `Transfer #${item.id}`} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.amount)} />} /><DataList title="Trade activity" rows={selected.tradeTransactions} empty="No Trade Market activity" render={(item: any) => <Row title={item.type} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.amountUsd)} />} /></div>}
                {detailTab === "records" && <div className="space-y-4"><DataList title="Loans" rows={selected.loans} empty="No loans" render={(item: any) => <Row title={`Loan #${item.id} · ${item.purpose || "General"}`} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.amountUsd)} />} /><DataList title="Marketplace orders" rows={selected.orders} empty="No marketplace orders" render={(item: any) => <Row title={item.productTitle || `Order #${item.id}`} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.totalAmount)} />} /><DataList title="Products" rows={selected.products} empty="No products listed" render={(item: any) => <Row title={item.title} meta={`${item.status} · ${date(item.createdAt)}`} value={fmt(item.price)} />} /><InfoCard title="Programme records"><Info label="Sponsorship plan" value={selected.sponsorshipPlan ? `${selected.sponsorshipPlan.planYears} years` : "None"} /><Info label="Referrals" value={String(selected.referrals?.length || 0)} /><Info label="Back to School" value={`${selected.kiddies?.length || 0} child record(s)`} /></InfoCard></div>}
                {detailTab === "audit" && <DataList title="Admin action history" rows={selected.auditHistory} empty="No recorded admin actions for this account" render={(item: any) => <Row title={item.action} meta={`${item.actorUserId === selectedUser.id ? "User-linked record" : "Admin action"} · ${date(item.createdAt)}${item.reason ? ` · ${item.reason}` : ""}`} value={item.outcome} />} />}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60"><p className="text-xs text-slate-500">Sensitive actions require a reason and are logged.</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => props.onDelete(selectedUser)}>Delete account</Button><Button size="sm" className={selectedUser.accountStatus === "suspended" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} onClick={() => setStatusDialog(selectedUser)}>{selectedUser.accountStatus === "suspended" ? <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Reactivate</> : <><XCircle className="mr-1.5 h-3.5 w-3.5" /> Suspend</>}</Button></div></div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusDialog} onOpenChange={(open) => { if (!open) { setStatusDialog(null); setReason(""); setReference(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{statusDialog?.accountStatus === "suspended" ? "Reactivate account" : "Suspend account"}</DialogTitle><DialogDescription>This changes access for {statusDialog?.firstName} {statusDialog?.lastName}. The action is attributable and cannot be silently changed.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2"><div className="rounded-xl border bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><p className="font-semibold">{statusDialog?.email}</p><p className="mt-1 text-xs text-slate-500">Current status: <Status value={statusDialog?.accountStatus} /></p></div><div className="space-y-2"><Label>Reason <span className="text-rose-500">*</span></Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this action is needed" /></div><div className="space-y-2"><Label>Reference (optional)</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Case, ticket, or review reference" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button><Button disabled={reason.trim().length < 5 || statusMutation.isPending} onClick={() => statusMutation.mutate({ id: statusDialog.id, status: statusDialog.accountStatus === "suspended" ? "active" : "suspended" })}>{statusMutation.isPending ? "Saving…" : "Confirm action"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4 text-tsia-green" />{label}</div><p className="mt-2 text-lg font-bold capitalize text-slate-900 dark:text-white">{value}</p></div>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>{children}</div>;
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="flex items-center justify-between border-b py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="max-w-[60%] truncate text-right font-medium capitalize">{value || "—"}</span></div>;
}

function Empty({ text }: { text: string }) { return <p className="py-5 text-center text-sm text-slate-500">{text}</p>; }

function DataList({ title, rows, empty, render }: { title: string; rows?: any[]; empty: string; render: (row: any) => React.ReactNode }) {
  return <InfoCard title={title}>{!rows?.length ? <Empty text={empty} /> : <div className="divide-y dark:divide-slate-800">{rows.slice(0, 30).map((row: any, index: number) => <div key={row.id ?? index} className="py-2.5">{render(row)}</div>)}{rows.length > 30 && <p className="pt-3 text-xs text-slate-500">Showing the latest 30 records.</p>}</div>}</InfoCard>;
}

function Row({ title, meta, value }: { title: string; meta: string; value: any }) {
  return <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs text-slate-500">{meta}</p></div><span className="shrink-0 text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{value}</span></div>;
}