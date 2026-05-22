import { useState, useEffect, useRef } from "react";
import { logoBadgeWhite, logoWhiteHorizontal } from "@/components/ui/Logo";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users, DollarSign, Search, CheckCircle2, AlertCircle, TrendingUp, Building2,
  Wallet, FileText, LogOut, ArrowRight, BarChart2, ShoppingBag, Share2,
  ArrowLeftRight, Bell, Landmark, XCircle, AlertTriangle, RefreshCw,
  ChevronDown, Menu, X, Send, Eye, UserCheck, Clock, BadgeCheck, Package,
  Trash2, Edit, MessageSquare, Coins, PlusCircle, ShieldCheck, Award, ToggleLeft, ToggleRight, GitBranch,
  Banknote, Copy, Phone, ThumbsUp, ThumbsDown, Settings, Save, Percent,
  LockOpen, Lock, UserPlus, Users2, CheckCheck, Info, Mail, Film, RotateCcw, GraduationCap, ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtUSD = (v: any) => `$${parseFloat(v || "0").toFixed(2)}`;
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    active: "bg-green-100 text-green-700 border-green-200",
    repaid: "bg-slate-100 text-slate-600 border-slate-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    delivered: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    declined: "bg-red-100 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={`capitalize text-xs ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status || "—"}</Badge>;
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "platinum") return <Badge className="bg-slate-800 text-white text-xs">Platinum</Badge>;
  if (tier === "gold") return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs" variant="outline">Gold</Badge>;
  if (tier === "silver") return <Badge className="bg-slate-200 text-slate-700 text-xs" variant="outline">Silver</Badge>;
  return <span className="text-slate-400 text-xs">—</span>;
}

function StatCard({ title, value, sub, icon: Icon, color }: { title: string; value: any; sub?: string; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600", purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-600",
    tsia: "bg-tsia-green/10 text-tsia-green",
  };
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function WithdrawalWalletBalance({ balance }: { balance: any }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-tsia-green/20 bg-tsia-green/5 px-3 py-2" data-testid="text-withdrawal-wallet-balance">
      <span className="text-xs font-semibold text-tsia-green flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5" /> Current Wallet Balance
      </span>
      <span className="text-sm font-black text-tsia-green">{fmtUSD(balance ?? 0)}</span>
    </div>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview",      icon: TrendingUp,     label: "Overview" },
  { id: "applications",  icon: UserCheck,      label: "Applications",  badgeKey: "pendingVerifications" },
  { id: "payouts",       icon: DollarSign,     label: "Disbursements", badgeKey: "pendingDisbursements" },
  { id: "loans",         icon: Landmark,       label: "Loans",         badgeKey: "pendingLoans" },
  { id: "users",         icon: Users,          label: "All Users" },
  { id: "affiliates",    icon: Share2,         label: "Affiliates" },
  { id: "referrals",     icon: GitBranch,      label: "Referrals" },
  { id: "transactions",  icon: ArrowLeftRight, label: "Transactions" },
  { id: "ecommerce",     icon: ShoppingBag,    label: "TS-Mart Online Stores" },
  { id: "trade",         icon: BarChart2,      label: "Trade Market" },
  { id: "trade_withdrawals", icon: ArrowUpRight, label: "Trade W/D" },
  { id: "deposits",      icon: Coins,          label: "Deposit History" },
  { id: "withdrawals",  icon: Banknote,       label: "Bank W/D",      badgeKey: "pendingWithdrawals" },
  { id: "crypto_withdrawals", icon: Coins,    label: "Crypto W/D",    badgeKey: "pendingCryptoWd" },
  { id: "bank_transfers", icon: Send,         label: "Bank Transfers", badgeKey: "pendingBankTransfers" },
  { id: "reserve",      icon: ShieldCheck,    label: "Str. Reserve" },
  { id: "trustfunders", icon: Award,          label: "Affiliate Trust Fund" },
  { id: "messages",     icon: MessageSquare,  label: "Forum Messages" },
  { id: "notifications", icon: Bell,          label: "Notifications" },
  { id: "enrollment",   icon: UserPlus,       label: "Enrollment" },
  { id: "settings",     icon: Settings,      label: "Plan Settings" },
];

// ─── AdminDashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; verification: any }>({ open: false, verification: null });
  const [rejectReason, setRejectReason] = useState("");
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [loanDialog, setLoanDialog] = useState<{ open: boolean; loan: any; action: string }>({ open: false, loan: null, action: "" });
  const [disburseDialog, setDisburseDialog] = useState<any>(null);
  const [editDisburseDialog, setEditDisburseDialog] = useState<any>(null);
  const [editDisburseAmount, setEditDisburseAmount] = useState("");
  const [editDisburseNote, setEditDisburseNote] = useState("");
  const [declineDisburseDialog, setDeclineDisburseDialog] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<any>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyRole, setNotifyRole] = useState("all");
  const [movieBcTitle, setMovieBcTitle] = useState("");
  const [movieBcDesc, setMovieBcDesc] = useState("");
  const [txFilter, setTxFilter] = useState("all");
  const [editBalanceDialog, setEditBalanceDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editBalanceAmount, setEditBalanceAmount] = useState("");
  const [editBalanceNote, setEditBalanceNote] = useState("");
  const [creditAffiliateDialog, setCreditAffiliateDialog] = useState<{ open: boolean; affiliate: any }>({ open: false, affiliate: null });
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editUserDialog, setEditUserDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserFirst, setEditUserFirst] = useState("");
  const [editUserLast, setEditUserLast] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [setReferrerDialog, setSetReferrerDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [referrerCode, setReferrerCode] = useState("");
  const [manualCreditOpen, setManualCreditOpen] = useState(false);
  const [mcUserId, setMcUserId]       = useState("");
  const [mcAmount, setMcAmount]       = useState("");
  const [mcReference, setMcReference] = useState("");
  const [mcNote, setMcNote]           = useState("");
  // Withdrawal review state
  const [vFilter, setVFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  const [wdFilter, setWdFilter] = useState<"all" | "pending" | "approved" | "declined" | "refunded">("all");
  const [cwdFilter, setCwdFilter] = useState<"all" | "pending" | "approved" | "declined" | "refunded">("all");
  const [wdNoteDialogId, setWdNoteDialogId] = useState<number | null>(null);
  const [wdNote, setWdNote]               = useState("");
  const [settingsForm, setSettingsForm]   = useState({ plan1yr: "", plan2yr: "", plan3yr: "", serviceChargeRate: "", silverMin: "", silverMax: "", goldMin: "", goldMax: "", platinumMin: "", platinumMax: "" });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [waecScaleForm, setWaecScaleForm] = useState<Record<string, string>>({});
  const [waecScaleSaved, setWaecScaleSaved] = useState(false);
  const [tradeForm, setTradeForm] = useState({ feeExchangeWithdraw: "", feeBankWithdraw: "", reserveRate: "", affiliateShareRate: "", minDeposit: "", minWithdraw: "", coAffiliatePoolRate: "", botFullRate: "" });
  const [bankTransfersEnabled, setBankTransfersEnabled] = useState<boolean>(true);
  const [bankWeekendOverrideUntil, setBankWeekendOverrideUntil] = useState<number>(0);
  const [bankWeekendSaving, setBankWeekendSaving] = useState<boolean>(false);
  const [bankToggleSaving, setBankToggleSaving] = useState(false);
  const [tradeSaved, setTradeSaved] = useState(false);
  const [tosEmailState, setTosEmailState] = useState<"idle" | "sending" | "done">("idle");
  const [tosEmailResult, setTosEmailResult] = useState("");
  const [openSlotsInput, setOpenSlotsInput] = useState("1");
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteName,  setInviteName]      = useState("");
  const [inviteNote,  setInviteNote]      = useState("");
  const [wdAction, setWdAction]           = useState<"approve" | "decline" | "refund" | null>(null);
  const [wdCopied, setWdCopied]           = useState<string | null>(null);
  const [tradeExpandedUser, setTradeExpandedUser] = useState<number | null>(null);
  const [tradeAdjustDialog, setTradeAdjustDialog] = useState<{ userId: number; name: string } | null>(null);
  const [stopBotConfirm, setStopBotConfirm] = useState<{ userId: number; name: string } | null>(null);
  const [removeTradeConfirm, setRemoveTradeConfirm] = useState<{ userId: number; name: string } | null>(null);
  const [tradeAdjustAmount, setTradeAdjustAmount] = useState("");
  const [tradeAdjustNote, setTradeAdjustNote]   = useState("");
  const [sessionOverrideDialog, setSessionOverrideDialog] = useState<{ txId: number; userId: number; currentAmt: number } | null>(null);
  const [sessionOverrideAmt, setSessionOverrideAmt] = useState("");
  const [tfAdjustDialog, setTfAdjustDialog] = useState<{ userId: number; name: string; earnedAmount: number; availableAmount: number; sharePercentage: string; withdrawnAmount: string } | null>(null);
  const [tfAdjustSharePct, setTfAdjustSharePct] = useState("");
  const [tfGrantAmount, setTfGrantAmount] = useState("");

  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: stats }                   = useQuery({ queryKey: ["/api/admin/enhanced-stats"] });
  const { data: pendingVerifications = [] } = useQuery({ queryKey: ["/api/admin/pending-verifications"] });
  const { data: allVerifications = [] }    = useQuery({ queryKey: ["/api/admin/all-verifications"], enabled: activeTab === "applications" });
  const { data: pendingDisbursements = [] } = useQuery({ queryKey: ["/api/admin/pending-disbursements"] });
  const { data: allDisbursements = [] }     = useQuery({ queryKey: ["/api/admin/all-disbursements"], enabled: activeTab === "payouts" });
  const { data: allUsers = [] }            = useQuery({ queryKey: ["/api/admin/all-users"], enabled: activeTab === "users" });
  const { data: allAffiliates = [] }       = useQuery({ queryKey: ["/api/admin/affiliates-all"], enabled: activeTab === "affiliates" });
  const { data: allLoans = [] }            = useQuery({ queryKey: ["/api/admin/loans-all"], enabled: activeTab === "loans" });
  const { data: allTransactions = [] }     = useQuery({ queryKey: ["/api/admin/transactions-all"], enabled: activeTab === "transactions" });
  const { data: ecommerceStats }           = useQuery({ queryKey: ["/api/admin/ecommerce-stats"], enabled: activeTab === "ecommerce" });
  const { data: tradeStats }               = useQuery({ queryKey: ["/api/admin/trade-stats"], enabled: activeTab === "trade", refetchInterval: 30_000, staleTime: 15_000 });
  const { data: tradeUsers = [] }          = useQuery<any[]>({ queryKey: ["/api/admin/trade-users"], enabled: activeTab === "trade", refetchInterval: 30_000 });
  const { data: tradeUserSessions = [] }   = useQuery<any[]>({ queryKey: ["/api/admin/trade-users", tradeExpandedUser, "sessions"], queryFn: async () => { if (!tradeExpandedUser) return []; const r = await fetch(`/api/admin/trade-users/${tradeExpandedUser}/sessions`, { credentials: "include" }); return r.json(); }, enabled: activeTab === "trade" && !!tradeExpandedUser });
  const { data: tradeWithdrawals = [] }    = useQuery<any[]>({ queryKey: ["/api/admin/trade-withdrawals"], enabled: activeTab === "trade_withdrawals", refetchInterval: 30_000 });
  const { data: allDeposits = [] }         = useQuery({ queryKey: ["/api/admin/wallet-deposits"], enabled: activeTab === "deposits" });
  const { data: pendingBankTransfers = [], refetch: refetchBankTransfers } = useQuery<any[]>({ queryKey: ["/api/admin/pending-bank-transfers"], enabled: activeTab === "bank_transfers", refetchInterval: 30_000 });
  const { data: allMessages = [] }         = useQuery({ queryKey: ["/api/admin/messages"], enabled: activeTab === "messages" });
  const { data: reserveFundData }          = useQuery({ queryKey: ["/api/reserve-fund/live"], enabled: activeTab === "reserve" });
  const { data: reserveProfitData }        = useQuery({ queryKey: ["/api/reserve-fund/commission-profits"], enabled: activeTab === "reserve" });
  const { data: allTrustFunders = [] }     = useQuery({ queryKey: ["/api/admin/co-affiliates"], enabled: activeTab === "trustfunders", refetchInterval: 30_000, staleTime: 10_000 });
  const { data: referralsData }            = useQuery({ queryKey: ["/api/admin/referrals-all"], enabled: activeTab === "referrals" });
  const { data: allWithdrawals = [], refetch: refetchWithdrawals } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawals"], refetchInterval: 600_000 });
  const { data: platformSettingsData, refetch: refetchPlatformSettings } = useQuery<{ prices: { plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }; tiers: { silver: { min: number; max: number }; gold: { min: number; max: number }; platinum: { min: number; max: number } } }>({ queryKey: ["/api/admin/platform-settings"], enabled: activeTab === "settings" });
  const { data: waecScaleData, refetch: refetchWaecScale } = useQuery<{ scale: Record<string, number> }>({ queryKey: ["/api/admin/waec-grade-scale"], enabled: activeTab === "settings" });
  const { data: tradeSettingsData, refetch: refetchTradeSettings } = useQuery<{ feeExchangeWithdraw: number; feeBankWithdraw: number; reserveRate: number; affiliateShareRate: number; minDeposit: number; minWithdraw: number; coAffiliatePoolRate: number | null; botFullRate: number; bankTransfersEnabled: boolean; bankTransfersWeekendOverrideUntil: number }>({ queryKey: ["/api/admin/trade-settings"], enabled: activeTab === "settings" || activeTab === "bank_transfers" });
  const { data: batchStatus, refetch: refetchBatchStatus } = useQuery<{ batch: any; totalCapacity: number; remaining: number; enrolled: number }>({ queryKey: ["/api/admin/batch-status"], enabled: activeTab === "enrollment" });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: number; approve: boolean; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/verify/${id}`, { approve, reason });
      return res.json();
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      setReviewDialog(null);
      setRejectDialog({ open: false, verification: null });
      setRejectReason("");
      toast({ title: approve ? "Student Approved ✓" : "Application Declined", description: approve ? "Verification approved. Wallet funding pending disbursement." : "Application declined — student notified with retry instructions." });
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/process-disbursement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setDisburseDialog(null);
      toast({ title: "Payout Processed ✓", description: "Funds credited to student wallet. Confirmation email sent." });
    },
  });

  const resetVerifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/reset-verification/${id}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-verifications"] });
      setReviewDialog(null);
      toast({ title: "Application Reopened ✓", description: "Status reset to pending — student notified and can now resubmit." });
    },
    onError: (e: any) => toast({ title: "Reset Failed", description: e.message, variant: "destructive" }),
  });

  const editDisburseMutation = useMutation({
    mutationFn: async ({ id, newAmount, note }: { id: number; newAmount: string; note: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/edit-disbursement/${id}`, { newAmount, note });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-disbursements"] });
      setEditDisburseDialog(null); setEditDisburseAmount(""); setEditDisburseNote("");
      toast({ title: "Amount Updated ✓", description: "Disbursement amount adjusted. Student notified by email." });
    },
    onError: (e: any) => toast({ title: "Update Failed", description: e.message, variant: "destructive" }),
  });

  const declineDisburseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/decline-disbursement/${id}`, { reason });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setDeclineDisburseDialog(null); setDeclineReason("");
      toast({ title: "Disbursement Declined", description: "Student notified by email.", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Action Failed", description: e.message, variant: "destructive" }),
  });

  const loanStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", `/api/admin/loans/${id}/status`, { status });
      return res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loans-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setLoanDialog({ open: false, loan: null, action: "" });
      toast({ title: status === "active" ? "Loan Disbursed ✓" : status === "rejected" ? "Loan Rejected" : "Loan Updated", description: status === "active" ? "Loan amount credited to user wallet." : "Loan status updated and user notified." });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      if (notifyTarget) {
        const res = await apiRequest("POST", `/api/admin/notify-user/${notifyTarget.id}`, { title: notifyTitle, message: notifyMsg });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/admin/notify-all`, { title: notifyTitle, message: notifyMsg, role: notifyRole });
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      setNotifyDialog(false);
      setNotifyTarget(null);
      setNotifyTitle("");
      setNotifyMsg("");
      toast({ title: "Notification Sent ✓", description: data?.sent ? `Sent to ${data.sent} users.` : "Notification delivered." });
    },
  });

  const movieBroadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/movies/broadcast", { title: movieBcTitle.trim(), description: movieBcDesc.trim() || undefined });
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      setMovieBcTitle(""); setMovieBcDesc("");
      toast({ title: "🎥 Movie Broadcast Started", description: "Notifications and emails are being sent to every user in the background." });
    },
    onError: (e: any) => toast({ title: "Broadcast failed", description: e.message, variant: "destructive" }),
  });

  const editBalanceMutation = useMutation({
    mutationFn: async ({ id, balance, note }: { id: number; balance: string; note: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/wallet`, { balance, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setEditBalanceDialog({ open: false, user: null });
      setEditBalanceAmount("");
      setEditBalanceNote("");
      toast({ title: "Wallet Updated ✓", description: "User wallet balance has been updated." });
    },
  });

  const manualCreditMutation = useMutation({
    mutationFn: async (data: { userId: string; amountUsd: string; reference: string; note: string }) => {
      const res = await apiRequest("POST", "/api/admin/manual-deposit-credit", data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setManualCreditOpen(false);
      setMcUserId(""); setMcAmount(""); setMcReference(""); setMcNote("");
      toast({ title: "Payment Credited ✓", description: data.message });
    },
    onError: (e: any) => toast({ title: "Credit Failed", description: e.message, variant: "destructive" }),
  });

  const creditAffiliateMutation = useMutation({
    mutationFn: async ({ id, amount, note }: { id: number; amount: string; note: string }) => {
      const res = await apiRequest("POST", `/api/admin/affiliates/${id}/credit`, { amount, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setCreditAffiliateDialog({ open: false, affiliate: null });
      setCreditAmount("");
      setCreditNote("");
      toast({ title: "Affiliate Credited ✓", description: "Funds added to affiliate wallet." });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setDeleteUserDialog({ open: false, user: null });
      toast({ title: "User Deleted", description: "User account has been permanently removed." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Delete Failed", description: e.message }),
  });

  const setReferrerMutation = useMutation({
    mutationFn: async ({ id, affiliateCode }: { id: number; affiliateCode: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/referred-by`, { affiliateCode });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set referrer");
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/affiliates-all"] });
      setSetReferrerDialog({ open: false, user: null });
      setReferrerCode("");
      toast({ title: "Referral Source Set", description: data.message });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, email, firstName, lastName, newPassword }: { id: number; email?: string; firstName?: string; lastName?: string; newPassword?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/account`, { email, firstName, lastName, newPassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      setEditUserDialog({ open: false, user: null });
      setEditUserEmail(""); setEditUserFirst(""); setEditUserLast(""); setEditUserPassword("");
      toast({ title: "User Updated ✓", description: "Account details have been changed." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const wdActionMutation = useMutation({
    mutationFn: async ({ id, action, adminNote }: { id: number; action: "approve" | "decline" | "refund"; adminNote: string }) => {
      const res = await apiRequest("POST", `/api/admin/withdrawals/${id}/${action}`, { adminNote });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      setWdNoteDialogId(null); setWdNote(""); setWdAction(null);
      toast({
        title: action === "approve" ? "Withdrawal Approved ✓" : action === "decline" ? "Withdrawal Declined" : "Refund Issued ✓",
        description: action === "approve" ? "User notified by email and in-app." : action === "decline" ? "User notified. No funds moved." : "Funds returned to user's wallet. Email sent.",
      });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (form: { plan1yr: string; plan2yr: string; plan3yr: string; serviceChargeRate: string }) => {
      const res = await apiRequest("PUT", "/api/admin/platform-settings", form);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/plan-prices"] });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      toast({ title: "Plan Prices Updated ✓", description: "New prices are live for all students immediately." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveWaecScaleMutation = useMutation({
    mutationFn: async (scale: Record<string, number>) => {
      const res = await apiRequest("PUT", "/api/admin/waec-grade-scale", { scale });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waec-grade-scale"] });
      setWaecScaleSaved(true);
      setTimeout(() => setWaecScaleSaved(false), 3000);
      toast({ title: "Grade Scale Updated ✓", description: "All future WAEC applications will use the new point values." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveTradeSettingsMutation = useMutation({
    mutationFn: async (form: typeof tradeForm) => {
      const res = await apiRequest("PUT", "/api/admin/trade-settings", form);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: () => {
      refetchTradeSettings();
      setTradeSaved(true);
      setTimeout(() => setTradeSaved(false), 3000);
      toast({ title: "Trade Settings Updated ✓", description: "New rates are stored and will apply to future trades." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const stopBotMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/trade-users/${userId}/stop-bot`, {});
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-stats"] });
      setStopBotConfirm(null);
      toast({ title: "Bot Stopped ✓", description: "User's active bot trade session has been stopped." });
    },
    onError: (e: any) => toast({ title: "Stop failed", description: e.message, variant: "destructive" }),
  });

  const removeFromTradeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/trade-users/${userId}`, {});
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-stats"] });
      setRemoveTradeConfirm(null);
      setTradeExpandedUser(null);
      toast({ title: "User Removed ✓", description: "User has been removed from the Trade Market." });
    },
    onError: (e: any) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  const sessionOverrideMutation = useMutation({
    mutationFn: async ({ txId, newAmount }: { txId: number; newAmount: string }) => {
      const res = await apiRequest("POST", `/api/admin/trade-sessions/${txId}/override`, { newAmount });
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-stats"] });
      setSessionOverrideDialog(null); setSessionOverrideAmt("");
      toast({ title: "Session Overridden ✓", description: "Bot session amount updated and user balance adjusted." });
    },
    onError: (e: any) => toast({ title: "Override failed", description: e.message, variant: "destructive" }),
  });

  const tradeAdjustMutation = useMutation({
    mutationFn: async ({ userId, amount, note }: { userId: number; amount: string; note: string }) => {
      const res = await apiRequest("POST", `/api/admin/trade-wallets/${userId}/adjust`, { amount, note });
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/trade-stats"] });
      setTradeAdjustDialog(null); setTradeAdjustAmount(""); setTradeAdjustNote("");
      toast({ title: "Trade Balance Adjusted ✓", description: "User's trade capital updated." });
    },
    onError: (e: any) => toast({ title: "Adjustment failed", description: e.message, variant: "destructive" }),
  });

  const deleteDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/wallet-deposit/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-deposits"] });
      toast({ title: "Deposit Deleted", description: "Record removed from the system." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
  });

  const forceCreditMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/deposit/${id}/force-credit`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-deposits"] });
      toast({ title: "Wallet Credited ✓", description: d.message });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Credit Failed", description: e.message }); },
  });

  const updateTrustFunderStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/co-affiliate/${userId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-affiliates"] });
      toast({ title: "Status Updated", description: "Trust Funder status changed." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
  });

  const deleteTrustFunderMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/co-affiliate/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-affiliates"] });
      toast({ title: "Trust Funder Deleted", description: "Co-affiliate record removed." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
  });

  const adjustTrustFunderMutation = useMutation({
    mutationFn: async ({ userId, sharePercentage, adjustWithdrawn }: { userId: number; sharePercentage?: string; adjustWithdrawn?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/co-affiliate/${userId}/adjust`, { sharePercentage, adjustWithdrawn });
      const d = await res.json(); if (!res.ok) throw new Error(d.message); return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-affiliates"] });
      setTfAdjustDialog(null); setTfAdjustSharePct(""); setTfGrantAmount("");
      toast({ title: "Trust Funder Updated ✓", description: "Share percentage and/or profit balance adjusted." });
    },
    onError: (e: any) => toast({ title: "Adjustment failed", description: e.message, variant: "destructive" }),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/messages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      toast({ title: "Message Deleted", description: "Forum post removed." });
    },
  });

  const [adminDeleteListingId, setAdminDeleteListingId] = useState<number | null>(null);
  const removeListingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ecommerce-stats"] });
      setAdminDeleteListingId(null);
      toast({ title: "Listing Removed", description: "The listing has been permanently deleted." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: personalInvitations = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/personal-invitations"],
    enabled: activeTab === "batches",
  });

  const inviteStudentMutation = useMutation({
    mutationFn: async (payload: { email: string; name?: string; note?: string }) => {
      const res = await apiRequest("POST", "/api/admin/invite-student", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personal-invitations"] });
      toast({ title: "Invitation sent", description: `${inviteEmail} can now enroll even while the batch is closed.` });
      setInviteEmail("");
      setInviteName("");
      setInviteNote("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openBatchSlotsMutation = useMutation({
    mutationFn: async (slots: number) => {
      const res = await apiRequest("POST", "/api/admin/batch/open-slots", { slots });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/batch-status"] });
      setOpenSlotsInput("1");
      toast({ title: "Slots Opened", description: `Batch now has ${data.remaining} open seat${data.remaining === 1 ? "" : "s"} available.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveBankTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/pending-bank-transfer/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-bank-transfers"] });
      toast({ title: "Transfer Approved ✓", description: "Bank transfer sent successfully." });
    },
    onError: (e: any) => toast({ title: "Approval Failed", description: e.message, variant: "destructive" }),
  });

  const rejectBankTransferMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/pending-bank-transfer/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-bank-transfers"] });
      toast({ title: "Refunded ✓", description: "Transfer rejected and funds returned to user's wallet." });
    },
    onError: (e: any) => toast({ title: "Refund Failed", description: e.message, variant: "destructive" }),
  });

  const declineBankTransferMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/pending-bank-transfer/${id}/decline`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-bank-transfers"] });
      toast({ title: "Declined", description: "Transfer declined. No refund was issued." });
    },
    onError: (e: any) => toast({ title: "Decline Failed", description: e.message, variant: "destructive" }),
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────
  const timerRef = useRef<any>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") { timerRef.current = setTimeout(() => setLocation("/login"), 200); }
    return () => clearTimeout(timerRef.current);
  }, [authLoading, user]);

  useEffect(() => {
    if (!platformSettingsData) return;
    const p = platformSettingsData.prices;
    const t = platformSettingsData.tiers;
    setSettingsForm(f => f.plan1yr ? f : {
      plan1yr:           p ? p.plan1yr.toString() : "35",
      plan2yr:           p ? p.plan2yr.toString() : "45",
      plan3yr:           p ? p.plan3yr.toString() : "50",
      serviceChargeRate: p ? (p.serviceChargeRate * 100).toFixed(2) : "10.00",
      silverMin:   t ? t.silver.min.toString()   : "110",
      silverMax:   t ? t.silver.max.toString()   : "130",
      goldMin:     t ? t.gold.min.toString()     : "160",
      goldMax:     t ? t.gold.max.toString()     : "180",
      platinumMin: t ? t.platinum.min.toString() : "225",
      platinumMax: t ? t.platinum.max.toString() : "230",
    });
  }, [platformSettingsData]);

  useEffect(() => {
    if (tradeSettingsData && typeof tradeSettingsData.bankTransfersEnabled === "boolean") {
      setBankTransfersEnabled(tradeSettingsData.bankTransfersEnabled);
    }
    if (tradeSettingsData && typeof tradeSettingsData.bankTransfersWeekendOverrideUntil === "number") {
      setBankWeekendOverrideUntil(tradeSettingsData.bankTransfersWeekendOverrideUntil);
    }
  }, [tradeSettingsData]);

  if (authLoading || (!user && !authLoading)) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-tsia-green border-t-transparent rounded-full" /></div>;

  const handleLogout = async () => { await logout(); setLocation("/login"); };

  const slide = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } }, exit: { opacity: 0, y: -12, transition: { duration: 0.25 } } };

  // ─── Filtered data helpers ─────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredUsers = (allUsers as any[]).filter(u =>
    !q || `${u.firstName} ${u.lastName} ${u.email} ${u.country}`.toLowerCase().includes(q)
  );
  const filteredAffiliates = (allAffiliates as any[]).filter(a =>
    !q || `${a.firstName} ${a.lastName} ${a.email} ${a.affiliateCode}`.toLowerCase().includes(q)
  );
  const filteredLoans = (allLoans as any[]).filter(l =>
    !q || `${l.user?.firstName} ${l.user?.lastName} ${l.user?.email} ${l.status}`.toLowerCase().includes(q)
  );
  const filteredTxns = (allTransactions as any[]).filter(t =>
    (txFilter === "all" || t.type === txFilter) &&
    (!q || `${t.user?.firstName} ${t.user?.lastName} ${t.description}`.toLowerCase().includes(q))
  );
  const filteredVerifications = (allVerifications as any[]).filter(v =>
    (vFilter === "all" || v.status === vFilter) &&
    (!q || `${v.user?.firstName} ${v.user?.lastName} ${v.user?.email} ${v.nin}`.toLowerCase().includes(q))
  );
  const filteredDisbursements = (pendingDisbursements as any[]).filter(d =>
    !q || `${d.user?.firstName} ${d.user?.lastName} ${d.user?.email}`.toLowerCase().includes(q)
  );
  const filteredOrders = ((ecommerceStats as any)?.recentOrders || []).filter((o: any) =>
    !q || `${o.buyer?.firstName} ${o.seller?.firstName} ${o.product?.title} ${o.status}`.toLowerCase().includes(q)
  );

  const badgeCounts: Record<string, number> = {
    pendingVerifications: (pendingVerifications as any[]).length,
    pendingDisbursements: (pendingDisbursements as any[]).length,
    pendingLoans: (allLoans as any[]).filter((l: any) => l.status === "pending").length,
    pendingWithdrawals: (allWithdrawals as any[]).filter((w: any) => w.status === "pending" && (w.type === "bank" || w.type === "trade_bank")).length,
    pendingCryptoWd: (allWithdrawals as any[]).filter((w: any) => w.status === "pending" && w.type === "crypto").length,
    pendingBankTransfers: (pendingBankTransfers as any[]).filter((t: any) => t.status === "pending").length,
  };

  // ─── Sidebar nav ───────────────────────────────────────────────────────────
  const SidebarContent = () => (
    <>
      <div className="h-20 flex flex-col justify-center px-5 border-b border-slate-800 shrink-0 bg-slate-950">
        <img src={logoWhiteHorizontal} alt="TSIA" className="h-8 w-auto object-contain mb-0.5" />
        <span className="text-[10px] font-bold text-tsia-gold tracking-widest uppercase pl-0.5">Admin Control Panel</span>
      </div>
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {NAV.map(item => {
          const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
          return (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setSearch(""); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-tsia-green/15 text-tsia-green border border-tsia-green/25" : "hover:bg-slate-900 hover:text-white border border-transparent text-slate-400"}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === item.id ? "bg-tsia-green text-white" : "bg-red-500 text-white"}`}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 bg-tsia-green rounded-full flex items-center justify-center text-white text-xs font-bold">AD</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">Admin</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-900 text-xs" onClick={handleLogout}>
          <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="admin-root min-h-screen bg-slate-50 dark:bg-slate-950 font-sans flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-950 text-slate-300 flex-col flex-shrink-0 border-r border-slate-800 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div className="fixed inset-0 z-50 flex md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <motion.div className="relative w-72 bg-slate-950 text-slate-300 flex flex-col h-full" initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ type: "spring", stiffness: 280, damping: 30 }}>
              <SidebarContent />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-slate-900 capitalize">
              {NAV.find(n => n.id === activeTab)?.label || activeTab}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search..." className="pl-9 h-8 w-52 bg-slate-100 border-slate-200 rounded-full text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setMobileSearchOpen(p => !p)}><Search className="w-4 h-4 text-slate-500" /></button>
            <Button size="sm" variant="outline" onClick={() => { queryClient.invalidateQueries(); }} className="hidden sm:flex gap-1.5 h-8 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </header>

        {/* Mobile search */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 py-2 bg-white border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input autoFocus placeholder="Search users, emails, NIN..." className="pl-9 h-9 bg-slate-100 border-0 rounded-xl text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════ OVERVIEW ═══════════════════════════════ */}
            {activeTab === "overview" && (
              <motion.div key="overview" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Students"     value={stats?.totalStudents ?? 0}      icon={Users}          color="blue"   />
                  <StatCard title="Total Affiliates"   value={stats?.totalAffiliates ?? 0}    icon={Share2}         color="purple" />
                  <StatCard title="Co-Affiliates"      value={stats?.totalCoAffiliates ?? 0}  icon={Building2}      color="slate"  />
                  <StatCard title="Total Loans"        value={stats?.totalLoans ?? 0}         icon={Landmark}       color="amber"  sub={`${stats?.activeLoans ?? 0} active`} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Pending Verifications" value={stats?.pendingVerifications ?? 0} icon={AlertCircle}  color="amber" />
                  <StatCard title="Pending Payouts"       value={stats?.pendingDisbursements ?? 0} icon={DollarSign}   color="green" />
                  <StatCard title="Pending Loans"         value={stats?.pendingLoans ?? 0}         icon={Clock}        color="red"   />
                  <StatCard title="Total Orders"          value={stats?.totalOrders ?? 0}          icon={Package}      color="slate" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Disbursed"       value={fmtUSD(stats?.totalDisbursed)}            icon={Wallet}       color="tsia" />
                  <StatCard title="Portal Fee Revenue"    value={fmtUSD(stats?.totalFeeRevenue)}           icon={TrendingUp}   color="green" />
                  <StatCard title="TS-Mart Online Stores Commission" value={fmtUSD(stats?.totalEcommerceCommission)}  icon={ShoppingBag}  color="blue"  />
                  <StatCard title="Trade Reserve Fund"    value={fmtUSD(stats?.tradeReserveBalance)}       icon={BarChart2}    color="purple"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Pending Applications</CardTitle><CardDescription>Require admin review</CardDescription></CardHeader>
                    <CardContent className="space-y-2">
                      {(pendingVerifications as any[]).slice(0, 5).map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center font-semibold text-amber-700 text-sm">
                              {v.user?.firstName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{v.user?.firstName} {v.user?.lastName}</p>
                              <p className="text-xs text-slate-500">{v.user?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.tier && v.tier !== "none" && <TierBadge tier={v.tier} />}
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setActiveTab("applications"); setReviewDialog(v); }}>Review</Button>
                          </div>
                        </div>
                      ))}
                      {(pendingVerifications as any[]).length === 0 && <p className="text-sm text-slate-500 text-center py-6">No pending applications. 🎉</p>}
                      {(pendingVerifications as any[]).length > 5 && (
                        <Button variant="ghost" size="sm" className="w-full text-xs mt-2" onClick={() => setActiveTab("applications")}>
                          View all {(pendingVerifications as any[]).length} applications <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Platform SLA Status</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Verification SLA", value: (pendingVerifications as any[]).length, target: "24–48h review", ok: (pendingVerifications as any[]).length < 10 },
                        { label: "Payout SLA",        value: (pendingDisbursements as any[]).length, target: "24–48h disbursement", ok: (pendingDisbursements as any[]).length < 5 },
                        { label: "Loan Reviews",      value: stats?.pendingLoans ?? 0, target: "48–72h decision", ok: (stats?.pendingLoans ?? 0) < 5 },
                      ].map(item => (
                        <div key={item.label} className={`p-4 rounded-xl border ${item.ok ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-semibold ${item.ok ? "text-green-800" : "text-amber-800"}`}>{item.label}</p>
                              <p className={`text-xs mt-0.5 ${item.ok ? "text-green-600" : "text-amber-600"}`}>{item.target}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold ${item.ok ? "text-green-700" : "text-amber-700"}`}>{item.value}</span>
                              {item.ok ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════ APPLICATIONS ═══════════════════════════════ */}
            {activeTab === "applications" && (
              <motion.div key="applications" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                {/* Summary counts */}
                <div className="grid grid-cols-4 gap-3">
                  {([
                    { label: "All",      key: "all",      color: "text-slate-700",  count: (allVerifications as any[]).length },
                    { label: "Pending",  key: "pending",  color: "text-amber-600",  count: (allVerifications as any[]).filter((v: any) => v.status === "pending").length },
                    { label: "Approved", key: "verified", color: "text-tsia-green", count: (allVerifications as any[]).filter((v: any) => v.status === "verified").length },
                    { label: "Rejected", key: "rejected", color: "text-red-600",    count: (allVerifications as any[]).filter((v: any) => v.status === "rejected").length },
                  ] as const).map(s => (
                    <Card
                      key={s.key}
                      className={`p-3 text-center cursor-pointer transition-all border-2 ${vFilter === s.key ? "border-tsia-green bg-tsia-green/5 shadow-sm" : "border-transparent hover:border-slate-200"}`}
                      onClick={() => setVFilter(s.key)}
                    >
                      <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Student Applications</CardTitle>
                      <CardDescription>
                        {filteredVerifications.length} {vFilter === "all" ? "total" : vFilter} application{filteredVerifications.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(["all", "pending", "verified", "rejected"] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setVFilter(f)}
                          className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition-colors ${vFilter === f ? "bg-tsia-green text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {f === "verified" ? "Approved" : f}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">NIN</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">WAEC Reg</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Score</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Fee</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Biometric</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVerifications.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-10 text-slate-500">No applications found.</TableCell></TableRow>
                        ) : filteredVerifications.map((v: any) => (
                          <TableRow key={v.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-slate-900 text-sm">{v.user?.firstName} {v.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{v.user?.email}</div>
                              {v.ageDisqualified && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> Age flag
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-600">{v.nin || "—"}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-700">{v.waecRegNumber || "—"}</TableCell>
                            <TableCell className="text-sm font-bold text-slate-900">{v.waecPercentage ? `${v.waecPercentage}%` : "—"}</TableCell>
                            <TableCell><TierBadge tier={v.tier} /></TableCell>
                            <TableCell>{v.portalFeePaid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}</TableCell>
                            <TableCell>{v.biometricVerified ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}</TableCell>
                            <TableCell>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                v.status === "verified" ? "bg-green-100 text-green-700" :
                                v.status === "rejected" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>
                                {v.status === "verified" ? "Approved" : v.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex gap-1.5 justify-end">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setReviewDialog(v)} data-testid={`button-review-${v.id}`} title="View details">
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                {v.status !== "rejected" && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 text-xs border-red-400 text-red-600 hover:bg-red-50"
                                    onClick={() => { setRejectDialog({ open: true, verification: v }); setRejectReason(""); }}
                                    disabled={verifyMutation.isPending}
                                    data-testid={`button-decline-retry-${v.id}`}>
                                    <XCircle className="w-3 h-3 mr-1" /> Decline & Retry
                                  </Button>
                                )}
                                {v.status === "rejected" && (
                                  <Button size="sm"
                                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                    onClick={() => resetVerifyMutation.mutate(v.id)}
                                    disabled={resetVerifyMutation.isPending || verifyMutation.isPending}
                                    data-testid={`button-allow-retry-${v.id}`}>
                                    <RefreshCw className="w-3 h-3 mr-1" /> Allow Retry
                                  </Button>
                                )}
                                {v.status === "pending" && (
                                  <Button size="sm"
                                    className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90"
                                    onClick={() => verifyMutation.mutate({ id: v.id, approve: true })}
                                    disabled={verifyMutation.isPending}
                                    data-testid={`button-approve-${v.id}`}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ PAYOUTS ═══════════════════════════════ */}
            {activeTab === "payouts" && (
              <motion.div key="payouts" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">SLA Requirement Active</p>
                    <p className="text-xs text-blue-700 mt-0.5">All approved disbursements must be processed within <strong>24–48 hours</strong>.</p>
                  </div>
                </div>

                {/* Semester 2 backfill tool */}
                <Card className="border border-purple-200 bg-purple-50/60 dark:bg-purple-900/10">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-sm text-purple-800 dark:text-purple-200">Ensure Semester 2 Exists for All Students</p>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">Creates missing Semester 2 pending disbursements for students enrolled before the two-semester split was added.</p>
                    </div>
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 ml-4" data-testid="btn-backfill-semester2"
                      onClick={async () => {
                        try {
                          const res = await apiRequest("POST", "/api/admin/backfill-semester2", {});
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.message);
                          queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/admin/all-disbursements"] });
                          toast({ title: "Semester 2 Backfill ✓", description: data.message });
                        } catch (e: any) {
                          toast({ title: "Backfill failed", description: e.message, variant: "destructive" });
                        }
                      }}>
                      Run Backfill
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Pending Disbursements</CardTitle>
                    <CardDescription>{filteredDisbursements.length} payouts awaiting processing</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Ref</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Student</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Requested</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDisbursements.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">No pending payouts.</TableCell></TableRow>
                        ) : filteredDisbursements.map((d: any) => (
                          <TableRow key={d.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-400">DIS-{String(d.id).padStart(5, "0")}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm text-slate-900">{d.user?.firstName} {d.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{d.user?.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-900">{fmtUSD(d.amount)}</div>
                              <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.semesterNum === 2 ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                Semester {d.semesterNum ?? 1}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{fmtDate(d.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex gap-1.5 justify-end">
                                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-600 hover:bg-amber-50"
                                  onClick={() => { setEditDisburseDialog(d); setEditDisburseAmount(parseFloat(d.amount).toFixed(2)); setEditDisburseNote(""); }}
                                  data-testid={`button-edit-${d.id}`}>
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-600 hover:bg-red-50"
                                  onClick={() => { setDeclineDisburseDialog(d); setDeclineReason(""); }}
                                  data-testid={`button-decline-${d.id}`}>
                                  <XCircle className="w-3 h-3 mr-1" /> Decline
                                </Button>
                                <Button size="sm" className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90"
                                  onClick={() => setDisburseDialog(d)}
                                  data-testid={`button-process-${d.id}`}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Process
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* ── Disbursement History ───────────────────────────── */}
                {(() => {
                  const history = (allDisbursements as any[]).filter((d: any) => d.status !== "pending");
                  const filtered = history.filter((d: any) =>
                    !q || `${d.user?.firstName} ${d.user?.lastName} ${d.user?.email}`.toLowerCase().includes(q)
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <Card className="border-0 shadow-sm overflow-hidden">
                      <CardHeader className="border-b bg-white py-4 px-6">
                        <CardTitle className="text-base">Disbursement History</CardTitle>
                        <CardDescription>{filtered.length} processed — full record of all completed, declined &amp; adjusted payouts</CardDescription>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Ref</TableHead>
                              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Student</TableHead>
                              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                              <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Processed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((d: any) => (
                              <TableRow key={d.id} className="hover:bg-slate-50/50">
                                <TableCell className="px-6 font-mono text-xs text-slate-400">DIS-{String(d.id).padStart(5, "0")}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm text-slate-900">{d.user?.firstName} {d.user?.lastName}</div>
                                  <div className="text-xs text-slate-500">{d.user?.email}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-bold text-slate-900">{fmtUSD(d.amount)}</div>
                                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.semesterNum === 2 ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                    Semester {d.semesterNum ?? 1}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    d.status === "completed" ? "bg-green-100 text-green-700" :
                                    d.status === "rejected"  ? "bg-red-100 text-red-700"   :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">{d.processedAt ? fmtDate(d.processedAt) : fmtDate(d.createdAt)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  );
                })()}
              </motion.div>
            )}

            {/* ═══════════════════════════════ LOANS ═══════════════════════════════ */}
            {activeTab === "loans" && (
              <motion.div key="loans" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">All Loan Applications</CardTitle>
                    <CardDescription>{(allLoans as any[]).length} total — {(allLoans as any[]).filter((l: any) => l.status === "pending").length} pending action</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">User</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Role</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Term</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Monthly</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Total</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Applied</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLoans.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-10 text-slate-500">No loans found.</TableCell></TableRow>
                        ) : filteredLoans.map((l: any) => (
                          <TableRow key={l.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-sm text-slate-900">{l.user?.firstName} {l.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{l.user?.email}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{l.userRole}</Badge></TableCell>
                            <TableCell className="font-bold text-slate-900">{fmtUSD(l.amountUsd)}</TableCell>
                            <TableCell className="text-sm text-slate-600">{l.termMonths}mo</TableCell>
                            <TableCell className="text-sm text-slate-600">{fmtUSD(l.monthlyPaymentUsd)}</TableCell>
                            <TableCell className="text-sm font-medium text-slate-700">{fmtUSD(l.totalPayableUsd)}</TableCell>
                            <TableCell><StatusBadge status={l.status} /></TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(l.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              {l.status === "pending" && (
                                <div className="flex justify-end gap-1.5">
                                  <Button size="sm" className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90" onClick={() => setLoanDialog({ open: true, loan: l, action: "active" })}>
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setLoanDialog({ open: true, loan: l, action: "rejected" })}>
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {l.status !== "pending" && <span className="text-xs text-slate-400 italic">—</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ ALL USERS ═══════════════════════════════ */}
            {activeTab === "users" && (
              <motion.div key="users" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                {/* Manual Payment Credit Tool */}
                <Card className="border border-amber-200 bg-amber-50/60 dark:bg-amber-900/10">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">Manual Payment Credit</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Use when a Korapay/Squad payment was received but not credited to a user's wallet automatically.</p>
                    </div>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 ml-4" onClick={() => setManualCreditOpen(true)} data-testid="btn-open-manual-credit">
                      Credit Wallet
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">All Platform Users</CardTitle>
                    <CardDescription>{(allUsers as any[]).length} users registered (students + affiliates)</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">User</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Role</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Country</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Verification</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Wallet</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Joined</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">No users found.</TableCell></TableRow>
                        ) : filteredUsers.map((u: any) => (
                          <TableRow key={u.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-sm text-slate-900">{u.firstName} {u.lastName}</div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{u.role}</Badge></TableCell>
                            <TableCell className="text-sm text-slate-600">{u.country || "—"}</TableCell>
                            <TableCell><StatusBadge status={u.verification?.status || "not started"} /></TableCell>
                            <TableCell><TierBadge tier={u.verification?.tier || ""} /></TableCell>
                            <TableCell className="font-semibold text-sm">{fmtUSD(u.wallet?.balance)}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(u.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setNotifyTarget(u); setNotifyDialog(true); }} data-testid={`button-notify-user-${u.id}`}>
                                  <Bell className="w-3 h-3 mr-1" /> Notify
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50" onClick={() => { setEditUserDialog({ open: true, user: u }); setEditUserEmail(u.email || ""); setEditUserFirst(u.firstName || ""); setEditUserLast(u.lastName || ""); setEditUserPassword(""); }} data-testid={`button-edit-user-${u.id}`}>
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => { setEditBalanceDialog({ open: true, user: u }); setEditBalanceAmount(u.wallet?.balance || "0"); setEditBalanceNote(""); }} data-testid={`button-edit-wallet-${u.id}`}>
                                  <Edit className="w-3 h-3 mr-1" /> Wallet
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setSetReferrerDialog({ open: true, user: u }); setReferrerCode(u.referredBy || ""); }} data-testid={`button-set-referrer-${u.id}`} title={u.referredBy ? `Referred by: ${u.referredBy}` : "Set referral source"}>
                                  <Share2 className="w-3 h-3 mr-1" /> {u.referredBy ? "Re-assign" : "Referrer"}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeleteUserDialog({ open: true, user: u })} data-testid={`button-delete-user-${u.id}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ AFFILIATES ═══════════════════════════════ */}
            {activeTab === "affiliates" && (
              <motion.div key="affiliates" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                {/* Back-fill referral commissions */}
                <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Back-fill Referral Commissions
                    </CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-400">
                      Credits any owed 5% referral commissions to affiliates whose referred users have paid a subscription fee, completed wallet KYC, or funded their wallet — but whose referrer never received a commission.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={async () => {
                        try {
                          const res = await apiRequest("POST", "/api/admin/backfill-referral-commissions", {});
                          const data = await res.json();
                          toast({ title: "Back-fill complete", description: data.summary });
                        } catch (e: any) {
                          toast({ title: "Back-fill failed", description: e.message, variant: "destructive" });
                        }
                      }}
                      data-testid="btn-backfill-referral-commissions"
                    >
                      Run Back-fill Now
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Affiliate Directory</CardTitle>
                    <CardDescription>{(allAffiliates as any[]).length} registered affiliates</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Affiliate</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Code</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Referrals</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Commission Earned</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Co-Affiliate</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Wallet</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Trade Wallet</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Joined</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAffiliates.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-10 text-slate-500">No users with affiliate codes found.</TableCell></TableRow>
                        ) : filteredAffiliates.map((a: any) => (
                          <TableRow key={a.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-sm text-slate-900">{a.firstName} {a.lastName}</div>
                              <div className="text-xs text-slate-500">{a.email}</div>
                              {a.role === "student" && <span className="text-xs text-blue-500">student</span>}
                            </TableCell>
                            <TableCell><code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{a.affiliateCode || "—"}</code></TableCell>
                            <TableCell>
                              <span className={`font-bold text-sm ${a.referralCount > 0 ? "text-tsia-green" : "text-slate-400"}`}>{a.referralCount}</span>
                            </TableCell>
                            <TableCell className="font-semibold text-sm text-amber-600">{fmtUSD(a.totalCommission ?? 0)}</TableCell>
                            <TableCell>
                              {a.coAffiliate ? (
                                <Badge variant="outline" className="text-xs">
                                  {a.coAffiliate.investmentCategory >= 500 ? "Elite" : a.coAffiliate.investmentCategory >= 300 ? "Growth" : "Starter"}
                                </Badge>
                              ) : <span className="text-slate-400 text-xs">—</span>}
                            </TableCell>
                            <TableCell className="font-semibold text-sm">{fmtUSD(a.wallet?.balance)}</TableCell>
                            <TableCell className="text-sm text-slate-600">{fmtUSD(a.tradeWallet?.balance)}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(a.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                <Button size="sm" variant="outline" className="h-7 text-xs text-tsia-green border-tsia-green/30 hover:bg-tsia-green/5" onClick={() => { setCreditAffiliateDialog({ open: true, affiliate: a }); setCreditAmount(""); setCreditNote(""); }} data-testid={`button-credit-affiliate-${a.id}`}>
                                  <PlusCircle className="w-3 h-3 mr-1" /> Credit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setNotifyTarget(a); setNotifyDialog(true); }} data-testid={`button-notify-affiliate-${a.id}`}>
                                  <Bell className="w-3 h-3 mr-1" /> Notify
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" disabled={deleteUserMutation.isPending} onClick={() => setDeleteUserDialog({ open: true, user: a })} data-testid={`button-delete-affiliate-${a.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ REFERRALS ═══════════════════════════════ */}
            {activeTab === "referrals" && (
              <motion.div key="referrals" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Commissions Paid</p>
                      <p className="text-2xl font-bold text-amber-600">{fmtUSD((referralsData as any)?.stats?.totalPaid ?? 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Commission Events</p>
                      <p className="text-2xl font-bold">{(referralsData as any)?.stats?.totalEvents ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Active Referrers</p>
                      <p className="text-2xl font-bold text-tsia-green">{(referralsData as any)?.stats?.uniqueReferrers ?? 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Commission history table */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Referral Commission History</CardTitle>
                    <CardDescription>All 5% referral commissions credited to members (latest 200)</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">#</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Referrer</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Code</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Note</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!referralsData || ((referralsData as any).commissions?.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                              No referral commissions recorded yet.
                            </TableCell>
                          </TableRow>
                        ) : (referralsData as any).commissions?.map((r: any, idx: number) => (
                          <TableRow key={r.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 text-xs text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm text-slate-900">{r.referrer_name}</div>
                              <div className="text-xs text-slate-500">{r.referrer_email}</div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{r.referrer_code || "—"}</code>
                            </TableCell>
                            <TableCell className="font-bold text-sm text-amber-600">{fmtUSD(parseFloat(r.amount_usd ?? 0))}</TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">{r.note}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(r.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ TRANSACTIONS ═══════════════════════════════ */}
            {activeTab === "transactions" && (
              <motion.div key="transactions" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">
                <div className="flex items-center gap-3">
                  <Select value={txFilter} onValueChange={setTxFilter}>
                    <SelectTrigger className="w-52 h-9 bg-white border text-sm">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="verification_fee">Portal Fees</SelectItem>
                      <SelectItem value="sponsorship_credit">Sponsorship Credits</SelectItem>
                      <SelectItem value="withdrawal">Withdrawals</SelectItem>
                      <SelectItem value="vat_deduction">VAT Deductions</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-500">{filteredTxns.length} transactions</p>
                </div>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ID</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">User</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Role</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Type</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Description</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTxns.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500">No transactions found.</TableCell></TableRow>
                        ) : filteredTxns.slice(0, 100).map((t: any) => (
                          <TableRow key={t.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-400">#{t.id}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-900">{t.user?.firstName} {t.user?.lastName}</div>
                              <div className="text-xs text-slate-500">{t.user?.email}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{t.user?.role || "—"}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${t.type === "sponsorship_credit" ? "bg-green-50 text-green-700 border-green-200" : t.type === "verification_fee" ? "bg-blue-50 text-blue-700 border-blue-200" : t.type === "withdrawal" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600"}`}>
                                {t.type?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className={`font-bold text-sm ${parseFloat(t.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {parseFloat(t.amount) >= 0 ? "+" : ""}{fmtUSD(t.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">{t.description}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(t.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ E-COMMERCE ═══════════════════════════════ */}
            {activeTab === "ecommerce" && (
              <motion.div key="ecommerce" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Products"   value={ecommerceStats?.totalProducts ?? 0}  icon={Package}    color="blue"  />
                  <StatCard title="Active Listings"  value={ecommerceStats?.activeProducts ?? 0} icon={Eye}        color="green" sub={`${ecommerceStats?.soldProducts ?? 0} sold`} />
                  <StatCard title="Total Orders"     value={ecommerceStats?.totalOrders ?? 0}    icon={ShoppingBag}color="amber" sub={`${ecommerceStats?.completedOrders ?? 0} delivered`} />
                  <StatCard title="Commission Earned" value={fmtUSD(ecommerceStats?.totalCommission)} icon={DollarSign} color="tsia" sub="8% per sale" />
                </div>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Recent Orders</CardTitle>
                    <CardDescription>Latest {filteredOrders.length} marketplace transactions</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Ref</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Product</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Buyer</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Seller</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Total</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Commission</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">No orders found.</TableCell></TableRow>
                        ) : filteredOrders.slice(0, 50).map((o: any) => (
                          <TableRow key={o.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-400">ORD-{String(o.id).padStart(5,"0")}</TableCell>
                            <TableCell className="text-sm font-medium text-slate-900 max-w-[180px] truncate">{o.product?.title || "—"}</TableCell>
                            <TableCell className="text-xs text-slate-600">{o.buyer?.firstName} {o.buyer?.lastName}</TableCell>
                            <TableCell className="text-xs text-slate-600">{o.seller?.firstName} {o.seller?.lastName}</TableCell>
                            <TableCell className="font-bold text-sm">{fmtUSD(o.totalPrice)}</TableCell>
                            <TableCell className="text-sm text-tsia-green font-semibold">{fmtUSD(o.commission)}</TableCell>
                            <TableCell><StatusBadge status={o.status} /></TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(o.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* All Listings table */}
                {(ecommerceStats as any)?.allProducts?.length > 0 && (
                  <Card className="border-0 shadow-sm overflow-hidden">
                    <CardHeader className="border-b bg-white py-4 px-6">
                      <CardTitle className="text-base">All Listings</CardTitle>
                      <CardDescription>Remove any listing that violates marketplace rules</CardDescription>
                    </CardHeader>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ID</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Title</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Seller</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Price</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Listed</TableHead>
                            <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((ecommerceStats as any).allProducts as any[]).map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-slate-50/50" data-testid={`row-admin-listing-${p.id}`}>
                              <TableCell className="px-6 font-mono text-xs text-slate-400">#{p.id}</TableCell>
                              <TableCell className="text-sm font-medium text-slate-900 max-w-[180px] truncate">{p.title}</TableCell>
                              <TableCell className="text-xs text-slate-600">{p.sellerName ?? "—"}</TableCell>
                              <TableCell className="font-bold text-sm">{fmtUSD(p.price)}</TableCell>
                              <TableCell><StatusBadge status={p.status} /></TableCell>
                              <TableCell className="text-xs text-slate-500">{fmtDate(p.createdAt)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs rounded-lg"
                                  onClick={() => setAdminDeleteListingId(p.id)}
                                  data-testid={`btn-admin-remove-listing-${p.id}`}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}

                {/* Admin remove listing confirmation */}
                <Dialog open={adminDeleteListingId !== null} onOpenChange={open => { if (!open) setAdminDeleteListingId(null); }}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-red-600">Remove Listing</DialogTitle>
                      <DialogDescription>
                        This will permanently delete this listing, all associated chats, ratings, and orders. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAdminDeleteListingId(null)}>Cancel</Button>
                      <Button
                        variant="destructive"
                        onClick={() => { if (adminDeleteListingId !== null) removeListingMutation.mutate(adminDeleteListingId); }}
                        disabled={removeListingMutation.isPending}
                        data-testid="button-admin-confirm-remove-listing"
                      >
                        {removeListingMutation.isPending ? "Removing…" : "Yes, Remove"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </motion.div>
            )}

            {/* ═══════════════════════════════ TRADE MARKET ═══════════════════════════════ */}
            {activeTab === "trade" && (
              <motion.div key="trade" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Reserve Fund"         value={fmtUSD(tradeStats?.reserveBalance)}   icon={Wallet}     color="green"  />
                  <StatCard title="Total Trade Deposits"  value={fmtUSD(tradeStats?.totalDeposited)}  icon={TrendingUp} color="blue"   />
                  <StatCard title="Bot Earnings"          value={fmtUSD(tradeStats?.totalBotEarnings)} icon={BarChart2} color="tsia"   />
                  <StatCard title="Active Traders"        value={(tradeUsers as any[]).filter(u => u.isActive).length} icon={Users2} color="purple" />
                </div>

                {/* ─── Per-User Bot Session Management ─────────────────────────────── */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><Users2 className="w-4 h-4 text-purple-500" /> Trade Wallet Management</CardTitle>
                        <CardDescription>Per-user bot sessions, capital locked, and loss overrides</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">{(tradeUsers as any[]).length} active traders</Badge>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-border/50">
                    {(tradeUsers as any[]).length === 0 ? (
                      <div className="py-10 text-center text-slate-500 text-sm">No active trade wallets</div>
                    ) : (tradeUsers as any[]).map((u: any) => (
                      <div key={u.userId}>
                        {/* User row */}
                        <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 cursor-pointer"
                          onClick={() => setTradeExpandedUser(tradeExpandedUser === u.userId ? null : u.userId)}
                          data-testid={`row-trade-user-${u.userId}`}>
                          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                            <Users2 className="w-4 h-4 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          {/* Bot status badge */}
                          <div className="text-center hidden sm:block">
                            {u.isActive
                              ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">● BOT ACTIVE</Badge>
                              : u.tradingDayNumber > 0
                                ? <Badge variant="outline" className="text-[10px] text-slate-500">Day {u.tradingDayNumber}/120</Badge>
                                : <Badge variant="outline" className="text-[10px] text-slate-400">No sessions</Badge>}
                          </div>
                          {/* Balance / locked */}
                          <div className="text-right hidden md:block">
                            <p className="font-bold text-sm text-tsia-green">{fmtUSD(u.balance)}</p>
                            <p className="text-[10px] text-slate-500">🔒 {fmtUSD(u.lockedPrincipal)} locked</p>
                          </div>
                          {/* Cycle progress */}
                          <div className="text-right hidden lg:block">
                            <p className="text-sm font-semibold">{fmtUSD(u.totalBotEarnings)}</p>
                            <p className="text-[10px] text-slate-400">Bot earnings</p>
                          </div>
                          {/* Actions */}
                          <Button size="sm" variant="outline" className="text-xs shrink-0"
                            onClick={e => { e.stopPropagation(); setTradeAdjustDialog({ userId: u.userId, name: u.name }); }}
                            data-testid={`button-trade-adjust-${u.userId}`}>
                            Adjust Capital
                          </Button>
                          {u.isActive && (
                            <Button size="sm" variant="outline" className="text-xs shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={e => { e.stopPropagation(); setStopBotConfirm({ userId: u.userId, name: u.name }); }}
                              data-testid={`button-stop-bot-${u.userId}`}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Stop Bot
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs shrink-0 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={e => { e.stopPropagation(); setRemoveTradeConfirm({ userId: u.userId, name: u.name }); }}
                            data-testid={`button-remove-trade-${u.userId}`}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${tradeExpandedUser === u.userId ? "rotate-180" : ""}`} />
                        </div>

                        {/* Expanded: session history */}
                        {tradeExpandedUser === u.userId && (
                          <div className="bg-slate-50 border-t border-border/50 px-6 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Bot Session History — {u.name}</p>
                              <div className="flex gap-3 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Profit</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Loss</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Missed/Zero</span>
                              </div>
                            </div>
                            {(tradeUserSessions as any[]).length === 0 ? (
                              <p className="text-xs text-slate-400 py-4 text-center">No bot sessions recorded yet</p>
                            ) : (
                              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                {(tradeUserSessions as any[]).map((s: any) => (
                                  <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs ${
                                    s.isLoss ? "bg-red-50 dark:bg-red-900/10" : s.isMissed ? "bg-slate-100 dark:bg-slate-800/40" : "bg-green-50 dark:bg-green-900/10"
                                  }`} data-testid={`row-session-${s.id}`}>
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.isLoss ? "bg-red-400" : s.isMissed ? "bg-slate-400" : "bg-green-400"}`} />
                                    <p className="flex-1 text-slate-600 truncate">{s.note || "Bot session"}</p>
                                    <p className={`font-bold tabular-nums ${s.isLoss ? "text-red-600" : s.isMissed ? "text-slate-400" : "text-green-600"}`}>
                                      {s.amountUsd >= 0 ? "+" : ""}${s.amountUsd.toFixed(4)}
                                    </p>
                                    <p className="text-slate-400 shrink-0">{fmtDate(s.createdAt)}</p>
                                    {(s.isLoss || s.isMissed) && (
                                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 border-amber-300 text-amber-700 hover:bg-amber-50 shrink-0"
                                        onClick={() => { setSessionOverrideDialog({ txId: s.id, userId: u.userId, currentAmt: s.amountUsd }); setSessionOverrideAmt(""); }}
                                        data-testid={`button-override-session-${s.id}`}>
                                        Override → Profit
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* User summary bar */}
                            <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-3 gap-3 text-xs">
                              <div className="bg-white rounded-lg px-3 py-2">
                                <p className="text-slate-400">Balance</p>
                                <p className="font-bold text-tsia-green">{fmtUSD(u.balance)}</p>
                              </div>
                              <div className="bg-white rounded-lg px-3 py-2">
                                <p className="text-slate-400">Locked Capital</p>
                                <p className="font-bold text-slate-700">{fmtUSD(u.lockedPrincipal)}</p>
                              </div>
                              <div className="bg-white rounded-lg px-3 py-2">
                                <p className="text-slate-400">Day Progress</p>
                                <p className="font-bold">{u.tradingDayNumber}/120 {u.roiComplete && "✓"}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                {/* ─── Recent Transactions (collapsed) ─────────────────────────────── */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Recent Trade Transactions</CardTitle>
                    <CardDescription>Latest bot trading and affiliate pool activity</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ID</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Type</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Description</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(tradeStats?.recentTransactions || []).length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">No trade transactions yet.</TableCell></TableRow>
                        ) : (tradeStats?.recentTransactions || []).map((t: any) => (
                          <TableRow key={t.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-mono text-xs text-slate-400">#{t.id}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${t.type === "bot_earning" ? "bg-green-50 text-green-700 border-green-200" : t.type === "deposit" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-600"}`}>
                                {t.type?.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className={`font-bold text-sm ${parseFloat(t.amountUsd) >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {fmtUSD(t.amountUsd)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">{t.note || "—"}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(t.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* ─── Session Override Dialog ──────────────────────────────────────── */}
                <Dialog open={!!sessionOverrideDialog} onOpenChange={o => !o && setSessionOverrideDialog(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Override Bot Session → Profit</DialogTitle>
                      <DialogDescription>Current amount: <strong className="text-red-500">${sessionOverrideDialog?.currentAmt?.toFixed(4)}</strong>. Enter the new profit amount for this session.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <Label>New Amount (USD)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        <Input type="number" min="0" step="0.01" className="pl-7" placeholder="e.g. 2.50"
                          value={sessionOverrideAmt} onChange={e => setSessionOverrideAmt(e.target.value)}
                          data-testid="input-session-override-amt" />
                      </div>
                      <p className="text-xs text-muted-foreground">The user's trade balance will be adjusted by the difference automatically.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSessionOverrideDialog(null)}>Cancel</Button>
                      <Button className="bg-amber-500 hover:bg-amber-600 text-white"
                        disabled={!sessionOverrideAmt || sessionOverrideMutation.isPending}
                        onClick={() => sessionOverrideDialog && sessionOverrideMutation.mutate({ txId: sessionOverrideDialog.txId, newAmount: sessionOverrideAmt })}
                        data-testid="button-confirm-session-override">
                        {sessionOverrideMutation.isPending ? "Saving…" : "Apply Override"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Capital Adjust Dialog ────────────────────────────────────────── */}
                <Dialog open={!!tradeAdjustDialog} onOpenChange={o => !o && setTradeAdjustDialog(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Adjust Trade Capital — {tradeAdjustDialog?.name}</DialogTitle>
                      <DialogDescription>Use a positive value to credit, negative to debit. A transaction record will be created.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div>
                        <Label>Amount (USD)</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                          <Input type="number" step="0.01" className="pl-7" placeholder="e.g. 10.00 or -5.00"
                            value={tradeAdjustAmount} onChange={e => setTradeAdjustAmount(e.target.value)}
                            data-testid="input-trade-adjust-amount" />
                        </div>
                      </div>
                      <div>
                        <Label>Note (optional)</Label>
                        <Input className="mt-1" placeholder="Reason for adjustment"
                          value={tradeAdjustNote} onChange={e => setTradeAdjustNote(e.target.value)}
                          data-testid="input-trade-adjust-note" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTradeAdjustDialog(null)}>Cancel</Button>
                      <Button className="bg-tsia-green hover:bg-tsia-green/90 text-white"
                        disabled={!tradeAdjustAmount || tradeAdjustMutation.isPending}
                        onClick={() => tradeAdjustDialog && tradeAdjustMutation.mutate({ userId: tradeAdjustDialog.userId, amount: tradeAdjustAmount, note: tradeAdjustNote })}
                        data-testid="button-confirm-trade-adjust">
                        {tradeAdjustMutation.isPending ? "Saving…" : "Apply Adjustment"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Stop Bot Confirm Dialog ──────────────────────────────────────── */}
                <Dialog open={!!stopBotConfirm} onOpenChange={o => !o && setStopBotConfirm(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-amber-500" /> Stop Bot — {stopBotConfirm?.name}
                      </DialogTitle>
                      <DialogDescription>
                        This will immediately stop the user's active bot trade session and unlock their capital. Their earnings history and balance will be preserved.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setStopBotConfirm(null)}>Cancel</Button>
                      <Button
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        disabled={stopBotMutation.isPending}
                        onClick={() => stopBotConfirm && stopBotMutation.mutate(stopBotConfirm.userId)}
                        data-testid="button-confirm-stop-bot"
                      >
                        {stopBotMutation.isPending ? "Stopping…" : "Stop Bot Session"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Remove from Trade Market Confirm Dialog ──────────────────────── */}
                <Dialog open={!!removeTradeConfirm} onOpenChange={o => !o && setRemoveTradeConfirm(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-500" /> Remove from Trade Market
                      </DialogTitle>
                      <DialogDescription>
                        This will permanently remove <strong>{removeTradeConfirm?.name}</strong> from the Trade Market. Their trade wallet, all sessions, and associated data will be deleted. Their main wallet balance is not affected.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setRemoveTradeConfirm(null)}>Cancel</Button>
                      <Button
                        variant="destructive"
                        disabled={removeFromTradeMutation.isPending}
                        onClick={() => removeTradeConfirm && removeFromTradeMutation.mutate(removeTradeConfirm.userId)}
                        data-testid="button-confirm-remove-trade"
                      >
                        {removeFromTradeMutation.isPending ? "Removing…" : "Remove Permanently"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </motion.div>
            )}

            {/* ═══════════════════════════════ DEPOSITS ═══════════════════════════════ */}
            {activeTab === "deposits" && (
              <motion.div key="deposits" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Wallet Deposits</CardTitle>
                    <CardDescription>All crypto and fiat deposits. Deposits are auto-confirmed by payment gateways — no manual approval needed.</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">User</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Type</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Tx Hash</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allDeposits as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500">No deposits yet.</TableCell></TableRow>
                        ) : (allDeposits as any[]).map((d: any) => (
                          <TableRow key={d.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-sm text-slate-900">{d.userName}</div>
                              <div className="text-xs text-slate-500">{d.userEmail}</div>
                            </TableCell>
                            <TableCell className="font-bold text-sm">{fmtUSD(d.amountUsd)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs uppercase">{d.walletType || "crypto"}</Badge></TableCell>
                            <TableCell className="font-mono text-xs text-slate-500 max-w-[120px] truncate">{d.txHash || "—"}</TableCell>
                            <TableCell><StatusBadge status={d.status} /></TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(d.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                <span className={`text-xs font-medium mr-1 ${d.status === "completed" ? "text-emerald-600" : d.status === "declined" ? "text-red-500" : "text-amber-600"}`} data-testid={`status-deposit-${d.id}`}>
                                  {d.status === "completed" ? "Auto-confirmed" : d.status === "declined" ? "Declined" : "Processing…"}
                                </span>
                                {d.status !== "completed" && (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" disabled={forceCreditMutation.isPending} onClick={() => { if (window.confirm(`Force-credit $${parseFloat(d.amountUsd).toFixed(2)} to ${d.userName} (ID: ${d.id})? This will immediately credit their wallet.`)) forceCreditMutation.mutate(d.id); }} data-testid={`button-credit-deposit-${d.id}`}>
                                    <Coins className="w-3 h-3 mr-1" /> Credit
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" disabled={deleteDepositMutation.isPending} onClick={() => { if (window.confirm(`Delete this deposit record (ID: ${d.id})? This cannot be undone.`)) deleteDepositMutation.mutate(d.id); }} data-testid={`button-delete-deposit-${d.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════ PENDING BANK TRANSFERS ══════════════════════ */}
            {activeTab === "bank_transfers" && (
              <motion.div key="bank_transfers" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-4">

                {/* ── Quick kill-switch banner (full controls also live in Settings) ── */}
                <Card className={`border-0 shadow-sm border-l-4 ${bankTransfersEnabled ? "border-l-emerald-500" : "border-l-red-500"}`}>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border-2 ${bankTransfersEnabled ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {bankTransfersEnabled
                            ? <><ToggleRight className="w-5 h-5 text-emerald-600" /> Bank Transfers are <span className="text-emerald-700">OPEN</span></>
                            : <><ToggleLeft className="w-5 h-5 text-red-600" /> Bank Transfers are <span className="text-red-700">CLOSED</span></>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bankTransfersEnabled
                            ? "Users can send bank transfers via the Fintech Hub. Toggle off to block all outgoing bank transfers platform-wide — users will see a network error."
                            : "All bank transfer attempts are blocked. Wallets are not debited. Airtime/data/bill payments still work."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={bankTransfersEnabled ? "destructive" : "default"}
                        className={`font-semibold shrink-0 ${bankTransfersEnabled ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                        disabled={bankToggleSaving}
                        data-testid="button-toggle-bank-transfers-tab"
                        onClick={async () => {
                          const next = !bankTransfersEnabled;
                          setBankToggleSaving(true);
                          try {
                            const res = await apiRequest("PUT", "/api/admin/trade-settings", {
                              feeExchangeWithdraw: tradeSettingsData?.feeExchangeWithdraw?.toString() ?? "0.05",
                              feeBankWithdraw:     tradeSettingsData?.feeBankWithdraw?.toString()     ?? "0.08",
                              reserveRate:         tradeSettingsData?.reserveRate?.toString()         ?? "0.20",
                              affiliateShareRate:  tradeSettingsData?.affiliateShareRate?.toString()  ?? "0.05",
                              minDeposit:          tradeSettingsData?.minDeposit?.toString()          ?? "10",
                              minWithdraw:         tradeSettingsData?.minWithdraw?.toString()         ?? "5",
                              botFullRate:         tradeSettingsData?.botFullRate?.toString()         ?? "0.02",
                              coAffiliatePoolRate: tradeSettingsData?.coAffiliatePoolRate != null ? tradeSettingsData.coAffiliatePoolRate.toString() : "",
                              bankTransfersEnabled: next,
                            });
                            if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
                            setBankTransfersEnabled(next);
                            refetchTradeSettings();
                            toast({ title: next ? "Bank Transfers Re-Opened ✓" : "Bank Transfers Closed ✓", description: next ? "Users can now send bank transfers again." : "All bank transfer attempts will be blocked." });
                          } catch (e: any) {
                            toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
                          } finally {
                            setBankToggleSaving(false);
                          }
                        }}
                      >
                        {bankToggleSaving
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving…</>
                          : (bankTransfersEnabled ? <><ToggleLeft className="w-4 h-4 mr-1.5" />Close Bank Transfers</> : <><ToggleRight className="w-4 h-4 mr-1.5" />Re-Open Bank Transfers</>)}
                      </Button>
                    </div>

                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-tsia-green" /> Bank Transfers
                    </CardTitle>
                    <CardDescription>All fintech bank transfer requests. Pending transfers need your approval — approve after making the manual transfer, or reject to refund the user.</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">User</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Recipient</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Bank</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Amount (NGN)</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(pendingBankTransfers as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">No bank transfers yet.</TableCell></TableRow>
                        ) : (pendingBankTransfers as any[]).map((t: any) => {
                          let details: any = {};
                          try { details = JSON.parse(t.reference); } catch { /* ok */ }
                          const isPending = t.status === "pending";
                          const statusMeta: Record<string, { label: string; cls: string }> = {
                            pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-800 border-amber-300" },
                            completed: { label: "Approved",  cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
                            rejected:  { label: "Refunded",  cls: "bg-blue-100 text-blue-800 border-blue-300" },
                            declined:  { label: "Declined",  cls: "bg-red-100 text-red-700 border-red-300" },
                            failed:    { label: "Failed",    cls: "bg-slate-100 text-slate-600 border-slate-300" },
                          };
                          const sm = statusMeta[t.status] ?? { label: t.status, cls: "bg-slate-100 text-slate-600 border-slate-300" };
                          return (
                            <TableRow key={t.id} className={`hover:bg-slate-50/50 ${!isPending ? "opacity-80" : ""}`}>
                              <TableCell className="px-6">
                                <div className="font-medium text-sm text-slate-900">{t.userName}</div>
                                <div className="text-xs text-slate-500">{t.userEmail}</div>
                              </TableCell>
                              <TableCell className="font-bold text-sm">{fmtUSD(t.amount)}</TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{details.accountName || "—"}</div>
                                <button
                                  className="text-xs text-slate-500 font-mono hover:text-tsia-green transition-colors flex items-center gap-1 group"
                                  title="Click to copy account number"
                                  onClick={() => { navigator.clipboard.writeText(details.accountNumber || ""); toast({ title: "Copied!", description: `Account number ${details.accountNumber} copied.` }); }}
                                  data-testid={`btn-copy-acct-${t.id}`}
                                >
                                  {details.accountNumber || "—"}
                                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </TableCell>
                              <TableCell className="text-sm">{details.bankName || details.bankCode || "—"}</TableCell>
                              <TableCell className="font-semibold text-sm text-tsia-green">₦{(details.netAmountNgn || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-xs text-slate-500">{fmtDate(t.createdAt)}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${sm.cls}`}>
                                  {sm.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right px-6">
                                {isPending ? (
                                  <div className="flex flex-col gap-1 items-end">
                                    <Button size="sm" className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90 w-full" disabled={approveBankTransferMutation.isPending} onClick={() => { if (window.confirm(`Mark this transfer as done?\n\nRecipient: ${details.accountName}\nAccount: ${details.accountNumber}\nAmount: ₦${(details.netAmountNgn||0).toLocaleString()}\n\nOnly click OK after you have made the manual bank transfer.`)) approveBankTransferMutation.mutate(t.id); }} data-testid={`button-approve-bt-${t.id}`}>
                                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve ✓
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 w-full" disabled={declineBankTransferMutation.isPending} onClick={() => { const reason = window.prompt("Reason for declining (shown to user, NO refund):", "Transfer could not be completed."); if (reason !== null) declineBankTransferMutation.mutate({ id: t.id, reason }); }} data-testid={`button-decline-bt-${t.id}`}>
                                      <XCircle className="w-3 h-3 mr-1" /> Decline
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-600 hover:bg-red-50 w-full" disabled={rejectBankTransferMutation.isPending} onClick={() => { const reason = window.prompt("Reason for refund (shown to user, wallet will be credited back):", "Transfer could not be completed."); if (reason !== null) rejectBankTransferMutation.mutate({ id: t.id, reason }); }} data-testid={`button-reject-bt-${t.id}`}>
                                      <RotateCcw className="w-3 h-3 mr-1" /> Refund
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No actions</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════ BANK WITHDRAWALS ═══════════════════════════ */}
            {activeTab === "withdrawals" && (
              <motion.div key="withdrawals" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Bank", value: (allWithdrawals as any[]).filter((w: any) => w.type === "bank" || w.type === "trade_bank").length, color: "text-slate-700" },
                    { label: "Pending", value: (allWithdrawals as any[]).filter((w: any) => (w.type === "bank" || w.type === "trade_bank") && w.status === "pending").length, color: "text-amber-600" },
                    { label: "Approved", value: (allWithdrawals as any[]).filter((w: any) => (w.type === "bank" || w.type === "trade_bank") && w.status === "approved").length, color: "text-tsia-green" },
                  ].map(s => (
                    <Card key={s.label} className="p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>

                {/* Filter + Cards */}
                {(() => {
                  const filtered = (allWithdrawals as any[]).filter((w: any) => (w.type === "bank" || w.type === "trade_bank") && (wdFilter === "all" || w.status === wdFilter));
                  function copyToClipboard(text: string, key: string) {
                    navigator.clipboard.writeText(text).then(() => {
                      setWdCopied(key);
                      setTimeout(() => setWdCopied(null), 1800);
                    });
                  }
                  return (<>
                      <div className="flex gap-2 flex-wrap">
                        {(["all", "pending", "approved", "declined", "refunded"] as const).map(f => (
                          <button key={f} onClick={() => setWdFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${wdFilter === f ? "bg-tsia-green text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"}`}>
                            {f}
                          </button>
                        ))}
                        <button onClick={() => refetchWithdrawals()} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>

                      {filtered.length === 0 && (
                        <Card className="p-8 text-center text-muted-foreground">No {wdFilter !== "all" ? wdFilter : ""} withdrawal requests.</Card>
                      )}

                      <div className="space-y-3">
                        {filtered.map((wd: any) => (
                          <Card key={wd.id} className={`overflow-hidden border-l-4 ${wd.status === "pending" ? "border-l-amber-400" : wd.status === "approved" ? "border-l-green-500" : wd.status === "declined" ? "border-l-red-500" : "border-l-slate-400"}`}>
                            <CardContent className="p-4 space-y-3">
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm">{wd.user?.firstName} {wd.user?.lastName}</span>
                                    <Badge variant="outline" className="text-[10px]">{wd.type === "bank" ? "Bank NGN" : wd.type === "trade_bank" ? "Trade Market" : "USDT Crypto"}</Badge>
                                    {wd.type === "trade_bank" && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">TRADE</span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${wd.status === "pending" ? "bg-amber-100 text-amber-700" : wd.status === "approved" ? "bg-green-100 text-green-700" : wd.status === "declined" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                      {wd.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span>{wd.user?.email}</span>
                                    {wd.user?.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />{wd.user.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-lg font-black text-tsia-green">${parseFloat(wd.amount).toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground">Net: ${parseFloat(wd.netAmount).toFixed(2)}</p>
                                </div>
                              </div>

                              <WithdrawalWalletBalance balance={wd.user?.walletBalance} />

                              {/* Bank details (regular bank + trade_bank) */}
                              {(wd.type === "bank" || wd.type === "trade_bank") && (
                                <div className={`rounded-xl p-3 text-sm space-y-1 ${wd.type === "trade_bank" ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                                  {wd.type === "trade_bank" && (
                                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-1">Source: Trade Market Balance</p>
                                  )}
                                  {wd.bankName && wd.bankName !== "[TRADE MARKET]" && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground text-xs">Bank</span>
                                      <span className="font-semibold text-xs">{wd.bankName}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Account Number</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-semibold text-sm">{wd.accountNumber}</span>
                                      <button
                                        onClick={() => copyToClipboard(wd.accountNumber, `acc-${wd.id}`)}
                                        className="text-muted-foreground hover:text-tsia-green transition-colors"
                                        title="Copy account number"
                                      >
                                        {wdCopied === `acc-${wd.id}` ? <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Account Name</span>
                                    <span className="font-semibold text-xs">{wd.accountName}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">NGN Amount</span>
                                    <span className="font-black text-tsia-green text-sm">₦{Math.round(parseFloat(wd.netAmount) * 1280).toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">{wd.type === "trade_bank" ? "Fee (8%)" : "VAT"}</span>
                                    <span className="text-red-500 text-xs">−${parseFloat(wd.fee).toFixed(2)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Crypto details */}
                              {wd.type === "crypto" && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Network</span>
                                    <span className="font-semibold text-xs">{wd.network}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground text-xs shrink-0">Address</span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-mono text-xs truncate max-w-[160px]" title={wd.address}>{wd.address}</span>
                                      <button
                                        onClick={() => copyToClipboard(wd.address, `addr-${wd.id}`)}
                                        className="text-muted-foreground hover:text-amber-500 transition-colors shrink-0"
                                        title="Copy address"
                                      >
                                        {wdCopied === `addr-${wd.id}` ? <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Net USDT</span>
                                    <span className="font-black text-amber-600 text-sm">${parseFloat(wd.netAmount).toFixed(2)} USDT</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Fee (1%)</span>
                                    <span className="text-red-500 text-xs">−${parseFloat(wd.fee).toFixed(2)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Admin note / timestamp */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{new Date(wd.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                                {wd.adminNote && <span className="italic">Note: {wd.adminNote}</span>}
                              </div>

                              {/* Action buttons — pending: Approve + Decline; declined: Refund */}
                              {wd.status === "pending" && (
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-tsia-green hover:bg-tsia-green/90 text-white text-xs h-9 rounded-xl font-bold"
                                    onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("approve"); }}
                                    data-testid={`btn-approve-wd-${wd.id}`}
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1 text-xs h-9 rounded-xl font-bold"
                                    onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("decline"); }}
                                    data-testid={`btn-decline-wd-${wd.id}`}
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Decline
                                  </Button>
                                </div>
                              )}
                              {wd.status === "declined" && (
                                <div className="pt-1">
                                  <Button
                                    size="sm"
                                    className="w-full text-xs h-9 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
                                    onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("refund"); }}
                                    data-testid={`btn-refund-wd-${wd.id}`}
                                  >
                                    <Wallet className="w-3.5 h-3.5 mr-1" /> Refund to Wallet
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Confirm Dialog — shared for approve / decline / refund */}
                      <Dialog open={wdNoteDialogId !== null} onOpenChange={open => { if (!open) { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); } }}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>
                              {wdAction === "approve" ? "Approve Withdrawal" : wdAction === "decline" ? "Decline Withdrawal" : "Refund to Wallet"}
                            </DialogTitle>
                            <DialogDescription>
                              {wdAction === "approve"
                                ? "Confirm you have manually transferred the funds. The user will be notified."
                                : wdAction === "decline"
                                ? "This will mark the request as declined. No money will be moved. You can issue a refund separately."
                                : "This will credit the full amount back to the user's TSIA wallet and send them an email."}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Admin Note (optional)</Label>
                              <Textarea
                                placeholder={wdAction === "approve" ? "e.g. Transferred via Opay at 2:30PM" : wdAction === "decline" ? "e.g. Incorrect account details" : "e.g. Refund issued per support request"}
                                value={wdNote}
                                onChange={e => setWdNote(e.target.value)}
                                className="mt-1.5 h-20 text-sm"
                              />
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); }}>Cancel</Button>
                            <Button
                              size="sm"
                              className={wdAction === "approve" ? "bg-tsia-green hover:bg-tsia-green/90" : wdAction === "refund" ? "bg-amber-500 hover:bg-amber-600" : ""}
                              variant={wdAction === "decline" ? "destructive" : "default"}
                              disabled={wdActionMutation.isPending}
                              onClick={() => wdActionMutation.mutate({ id: wdNoteDialogId!, action: wdAction!, adminNote: wdNote })}
                              data-testid="btn-confirm-wd-action"
                            >
                              {wdActionMutation.isPending ? "Processing…" : wdAction === "approve" ? "Confirm Approval" : wdAction === "decline" ? "Confirm Decline" : "Confirm Refund"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* ═══════════════════════════ CRYPTO WITHDRAWALS ═══════════════════════════ */}
            {activeTab === "crypto_withdrawals" && (
              <motion.div key="crypto_withdrawals" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Crypto", value: (allWithdrawals as any[]).filter((w: any) => w.type === "crypto").length, color: "text-slate-700" },
                    { label: "Pending", value: (allWithdrawals as any[]).filter((w: any) => w.type === "crypto" && w.status === "pending").length, color: "text-amber-600" },
                    { label: "Approved", value: (allWithdrawals as any[]).filter((w: any) => w.type === "crypto" && w.status === "approved").length, color: "text-tsia-green" },
                  ].map(s => (
                    <Card key={s.label} className="p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>

                {(() => {
                  const filtered = (allWithdrawals as any[]).filter((w: any) => w.type === "crypto" && (cwdFilter === "all" || w.status === cwdFilter));
                  function copyToClipboard(text: string, key: string) {
                    navigator.clipboard.writeText(text).then(() => {
                      setWdCopied(key);
                      setTimeout(() => setWdCopied(null), 1800);
                    });
                  }
                  return (<>
                    <div className="flex gap-2 flex-wrap">
                      {(["all", "pending", "approved", "declined", "refunded"] as const).map(f => (
                        <button key={f} onClick={() => setCwdFilter(f)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${cwdFilter === f ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"}`}>
                          {f}
                        </button>
                      ))}
                      <button onClick={() => refetchWithdrawals()} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>

                    {filtered.length === 0 && (
                      <Card className="p-8 text-center text-muted-foreground">No {cwdFilter !== "all" ? cwdFilter : ""} crypto withdrawal requests.</Card>
                    )}

                    <div className="space-y-3">
                      {filtered.map((wd: any) => (
                        <Card key={wd.id} className={`overflow-hidden border-l-4 ${wd.status === "pending" ? "border-l-amber-400" : wd.status === "approved" ? "border-l-green-500" : wd.status === "declined" ? "border-l-red-500" : "border-l-slate-400"}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm">{wd.user?.firstName} {wd.user?.lastName}</span>
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">USDT Crypto</Badge>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${wd.status === "pending" ? "bg-amber-100 text-amber-700" : wd.status === "approved" ? "bg-green-100 text-green-700" : wd.status === "declined" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                    {wd.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span>{wd.user?.email}</span>
                                  {wd.user?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{wd.user.phone}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-black text-amber-600">${parseFloat(wd.amount).toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">Net: ${parseFloat(wd.netAmount).toFixed(2)} USDT</p>
                              </div>
                            </div>

                            <WithdrawalWalletBalance balance={wd.user?.walletBalance} />

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-xs">Network</span>
                                <span className="font-semibold text-xs">{wd.network}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground text-xs shrink-0">Address</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono text-xs truncate max-w-[160px]" title={wd.address}>{wd.address}</span>
                                  <button onClick={() => copyToClipboard(wd.address, `addr-${wd.id}`)} className="text-muted-foreground hover:text-amber-500 transition-colors shrink-0">
                                    {wdCopied === `addr-${wd.id}` ? <CheckCircle2 className="w-3.5 h-3.5 text-tsia-green" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-xs">Fee (1%)</span>
                                <span className="text-red-500 text-xs">−${parseFloat(wd.fee).toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{new Date(wd.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                              {wd.adminNote && <span className="italic">Note: {wd.adminNote}</span>}
                            </div>

                            {wd.status === "pending" && (
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" className="flex-1 bg-tsia-green hover:bg-tsia-green/90 text-white text-xs h-9 rounded-xl font-bold"
                                  onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("approve"); }}
                                  data-testid={`btn-approve-cwd-${wd.id}`}>
                                  <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1 text-xs h-9 rounded-xl font-bold"
                                  onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("decline"); }}
                                  data-testid={`btn-decline-cwd-${wd.id}`}>
                                  <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Decline
                                </Button>
                              </div>
                            )}
                            {wd.status === "declined" && (
                              <div className="pt-1">
                                <Button size="sm"
                                  className="w-full text-xs h-9 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => { setWdNoteDialogId(wd.id); setWdNote(""); setWdAction("refund"); }}
                                  data-testid={`btn-refund-cwd-${wd.id}`}>
                                  <Wallet className="w-3.5 h-3.5 mr-1" /> Refund to Wallet
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Dialog open={wdNoteDialogId !== null} onOpenChange={open => { if (!open) { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); } }}>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>
                            {wdAction === "approve" ? "Approve Crypto Withdrawal" : wdAction === "decline" ? "Decline Crypto Withdrawal" : "Refund to Wallet"}
                          </DialogTitle>
                          <DialogDescription>
                            {wdAction === "approve"
                              ? "Confirm you have sent the USDT. The user will be notified."
                              : wdAction === "decline"
                              ? "This will mark the request as declined. No funds will be moved. You can refund separately."
                              : "This will credit the full amount back to the user's TSIA wallet."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Admin Note (optional)</Label>
                            <Textarea placeholder={wdAction === "approve" ? "e.g. Sent via TRC-20 at 3PM" : wdAction === "decline" ? "e.g. Invalid address" : "e.g. Refund per support request"} value={wdNote} onChange={e => setWdNote(e.target.value)} className="mt-1.5 h-20 text-sm" />
                          </div>
                        </div>
                        <DialogFooter className="gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); }}>Cancel</Button>
                          <Button size="sm"
                            className={wdAction === "approve" ? "bg-tsia-green hover:bg-tsia-green/90" : wdAction === "refund" ? "bg-amber-500 hover:bg-amber-600" : ""}
                            variant={wdAction === "decline" ? "destructive" : "default"}
                            disabled={wdActionMutation.isPending}
                            onClick={() => wdActionMutation.mutate({ id: wdNoteDialogId!, action: wdAction!, adminNote: wdNote })}>
                            {wdActionMutation.isPending ? "Processing…" : wdAction === "approve" ? "Confirm Approval" : wdAction === "decline" ? "Confirm Decline" : "Confirm Refund"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>);
                })()}
              </motion.div>
            )}

            {/* ═══════════════════════════ TRADE WITHDRAWALS ═══════════════════════════ */}
            {activeTab === "trade_withdrawals" && (
              <motion.div key="trade_withdrawals" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Transfers", value: (tradeWithdrawals as any[]).length, color: "text-slate-700" },
                    { label: "Total Withdrawn (gross)", value: `$${(tradeWithdrawals as any[]).reduce((s: number, r: any) => s + parseFloat(r.gross_usd ?? 0), 0).toFixed(2)}`, color: "text-blue-600" },
                    { label: "Reserve Collected (20%)", value: `$${(tradeWithdrawals as any[]).reduce((s: number, r: any) => s + parseFloat(r.reserve_usd ?? 0), 0).toFixed(2)}`, color: "text-tsia-green" },
                  ].map(s => (
                    <Card key={s.label} className="p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>

                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-tsia-green" /> Trade → Fintech Wallet Transfers
                    </CardTitle>
                    <CardDescription>All Trade Market earnings transferred to users' Fintech (SwiftWallet) accounts. Full amount is credited — no fee on wallet-to-wallet transfers.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(tradeWithdrawals as any[]).length === 0 ? (
                      <p className="text-center text-muted-foreground py-10 text-sm">No trade withdrawals yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                            <tr>
                              {["User", "Email", "Gross (USD)", "Reserve (20%)", "Net Credited", "Date"].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(tradeWithdrawals as any[]).map((row: any) => (
                              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-semibold whitespace-nowrap">{row.user_name}</td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{row.email}</td>
                                <td className="px-4 py-3 font-bold text-blue-600">${parseFloat(row.gross_usd).toFixed(2)}</td>
                                <td className="px-4 py-3 text-red-500 text-xs">−${parseFloat(row.reserve_usd).toFixed(2)}</td>
                                <td className="px-4 py-3 font-bold text-tsia-green">${parseFloat(row.net_usd).toFixed(2)}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════ STRATEGIC RESERVE ═══════════════════════════ */}
            {activeTab === "reserve" && (
              <motion.div key="reserve" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                {/* Balance cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Trade Reserve Balance", value: fmtUSD((reserveFundData as any)?.totalBalance), icon: ShieldCheck, color: "text-tsia-green" },
                    { label: "Total Deposited (Trade)", value: fmtUSD((reserveFundData as any)?.totalDeposited), icon: TrendingUp, color: "text-blue-600" },
                    { label: "Wallet Floor Reserve", value: fmtUSD((reserveFundData as any)?.walletFloorReserve), icon: Wallet, color: "text-purple-600" },
                    { label: "Combined Reserve", value: fmtUSD((reserveFundData as any)?.combinedReserve), icon: Building2, color: "text-amber-600" },
                  ].map(s => (
                    <Card key={s.label} className="border-0 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                        <p className="text-xs text-slate-500">{s.label}</p>
                      </div>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </Card>
                  ))}
                </div>
                {/* Wallet floor detail */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-tsia-green" /> Wallet Floor Reserve Detail</CardTitle>
                    <CardDescription>$2 minimum locked in {(reserveFundData as any)?.walletsAtMin ?? 0} of {(reserveFundData as any)?.totalWallets ?? 0} activated wallets</CardDescription>
                  </CardHeader>
                  <CardContent className="py-4 px-6">
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div><p className="text-xs text-slate-500">Activated Wallets</p><p className="font-bold text-slate-900">{(reserveFundData as any)?.totalWallets ?? 0}</p></div>
                      <div><p className="text-xs text-slate-500">Wallets at Min</p><p className="font-bold text-slate-900">{(reserveFundData as any)?.walletsAtMin ?? 0}</p></div>
                      <div><p className="text-xs text-slate-500">Min per Wallet</p><p className="font-bold text-slate-900">${(reserveFundData as any)?.minBalancePerWallet ?? 2}</p></div>
                      <div><p className="text-xs text-slate-500">Floor Reserve Total</p><p className="font-bold text-tsia-green">{fmtUSD((reserveFundData as any)?.walletFloorReserve)}</p></div>
                      <div><p className="text-xs text-slate-500">Trade Reserve Rate</p><p className="font-bold text-slate-900">{(reserveFundData as any)?.contributionRate ?? 20}%</p></div>
                    </div>
                  </CardContent>
                </Card>
                {/* Commission profits */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Platform Commission Profits</CardTitle>
                    <CardDescription>TS-Mart Online Stores commissions + withdrawal fees, minus affiliate pool payouts</CardDescription>
                  </CardHeader>
                  {(reserveProfitData as any)?.totals && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 border-b bg-slate-50">
                        {[
                          { label: "E-com Commissions", value: fmtUSD((reserveProfitData as any).totals.totalEcom), color: "text-blue-600" },
                          { label: "Affiliate Pool Paid", value: fmtUSD((reserveProfitData as any).totals.totalPoolPaid), color: "text-amber-600" },
                          { label: "Net Profit", value: fmtUSD((reserveProfitData as any).totals.totalNetProfit), color: "text-tsia-green" },
                        ].map(s => (
                          <div key={s.label} className="px-6 py-4 border-r last:border-0">
                            <p className="text-xs text-slate-500">{s.label}</p>
                            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 border-b bg-purple-50/50">
                        <div className="px-6 py-4 border-r">
                          <p className="text-xs text-slate-500">Commissions Taken (Withdrawal Fees)</p>
                          <p className="text-lg font-bold text-purple-600">{fmtUSD((reserveProfitData as any).totals.totalFees)}</p>
                        </div>
                        <div className="px-6 py-4">
                          <p className="text-xs text-slate-500">No. of Withdrawals</p>
                          <p className="text-lg font-bold text-slate-700">{((reserveProfitData as any).totals.totalWithdrawals ?? 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Month</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">E-com Commission</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Withdrawal Fees</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Pool Paid Out</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide text-right px-6">Net Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((reserveProfitData as any)?.chartData ?? []).length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">No profit data yet.</TableCell></TableRow>
                        ) : ((reserveProfitData as any)?.chartData ?? []).map((r: any, i: number) => (
                          <TableRow key={i} className="hover:bg-slate-50/50">
                            <TableCell className="px-6 font-medium text-sm">{r.month}</TableCell>
                            <TableCell className="text-blue-600 font-semibold text-sm">{fmtUSD(r.ecomCommission)}</TableCell>
                            <TableCell className="text-purple-600 font-semibold text-sm">{fmtUSD(r.withdrawalFees)}</TableCell>
                            <TableCell className="text-amber-600 text-sm">{fmtUSD(r.affiliatePoolPaid)}</TableCell>
                            <TableCell className={`text-right px-6 font-bold text-sm ${r.netProfit >= 0 ? "text-tsia-green" : "text-red-500"}`}>{fmtUSD(r.netProfit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════ TRUST FUNDERS ═══════════════════════════════ */}
            {activeTab === "trustfunders" && (
              <motion.div key="trustfunders" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">

                {/* ─── Pool summary bar — ALWAYS VISIBLE ─────────────────────── */}
                {(() => {
                  const tfs = allTrustFunders as any[];
                  const tf0 = tfs[0];
                  const totalPool = tf0?.totalPool ?? 0;
                  const totalInvested = tfs.reduce((s: number, t: any) => s + parseFloat(t.amountPaid ?? "0"), 0);
                  const totalEarned   = tfs.reduce((s: number, t: any) => s + (t.earnedAmount ?? 0), 0);
                  const totalAvail    = tfs.reduce((s: number, t: any) => s + (t.availableAmount ?? 0), 0);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard title="Affiliate Pool (Total)" value={fmtUSD(totalPool)}    icon={Coins}    color="purple" sub="all-time trade pool" />
                      <StatCard title="Total Invested"         value={fmtUSD(totalInvested)} icon={TrendingUp} color="blue" sub="across all trust funders" />
                      <StatCard title="Total Earned"           value={fmtUSD(totalEarned)}   icon={BarChart2} color="tsia" sub="pool × share %" />
                      <StatCard title="Available to Withdraw"  value={fmtUSD(totalAvail)}    icon={Wallet}    color="green" sub="earned − withdrawn" />
                    </div>
                  );
                })()}

                {/* ─── Admin Power Tools strip ─────────────────────────────────── */}
                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 via-white to-amber-50/40">
                  <CardContent className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900">Admin Power Tools</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You have full control over every trust funder's <strong>share percentage</strong> and <strong>profit balance</strong>.
                          Use the <strong>Adjust</strong> button on each row to grant or deduct profit, change pool share, activate/cancel, or remove records.
                          The pool itself is fed automatically from the 20% reserve allocations on every deposit/withdrawal.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Edit className="w-3 h-3 text-amber-600" /> Adjust share % & grant/deduct profit</span>
                          <span className="inline-flex items-center gap-1"><ToggleRight className="w-3 h-3 text-red-500" /> Activate / Cancel</span>
                          <span className="inline-flex items-center gap-1"><Trash2 className="w-3 h-3 text-red-500" /> Delete record</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ─── Trust Funders table ──────────────────────────────────────── */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Trust Funders (Co-Affiliates)</CardTitle>
                        <CardDescription>{(allTrustFunders as any[]).length} registered trust funders — investors backing the affiliate programme. Updates every 30s.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Name / Email</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Invested</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Share %</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Earned</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Available</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Withdrawn</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Wallet Bal.</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Joined</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allTrustFunders as any[]).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-12 text-slate-500 bg-white">
                              <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                              <p className="font-medium text-sm text-slate-600">No trust funders yet</p>
                              <p className="text-xs text-slate-400 mt-1">When affiliates subscribe to the Trust Funder programme they'll appear here with full Adjust / Activate / Delete controls.</p>
                            </TableCell>
                          </TableRow>
                        ) : (allTrustFunders as any[]).map((tf: any) => {
                          const tier = tf.investmentCategory >= 500 ? "Elite" : tf.investmentCategory >= 300 ? "Growth" : "Starter";
                          const tierColor = tier === "Elite" ? "bg-slate-800 text-white" : tier === "Growth" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";
                          const isActive = tf.status === "active";
                          const earned = tf.earnedAmount ?? 0;
                          const available = tf.availableAmount ?? 0;
                          const withdrawn = parseFloat(tf.withdrawnAmount ?? "0");
                          return (
                            <TableRow key={tf.id} className="hover:bg-slate-50/50">
                              <TableCell className="px-6">
                                <p className="font-medium text-sm text-slate-900">{tf.userName}</p>
                                <p className="text-xs text-slate-500">{tf.userEmail}</p>
                              </TableCell>
                              <TableCell><Badge variant="outline" className={`text-xs ${tierColor}`}>{tier}</Badge></TableCell>
                              <TableCell className="font-bold text-sm">{fmtUSD(tf.amountPaid)}</TableCell>
                              <TableCell className="text-sm font-mono">{(parseFloat(tf.sharePercentage) * 100).toFixed(6)}%</TableCell>
                              {/* Real-time earnings */}
                              <TableCell>
                                <p className="font-bold text-sm text-tsia-green">{fmtUSD(earned)}</p>
                                <p className="text-[10px] text-muted-foreground">from pool</p>
                              </TableCell>
                              <TableCell>
                                <p className={`font-bold text-sm ${available > 0 ? "text-blue-600" : "text-slate-400"}`}>{fmtUSD(available)}</p>
                                <p className="text-[10px] text-muted-foreground">withdrawable</p>
                              </TableCell>
                              <TableCell className="text-sm text-slate-500 font-mono">{fmtUSD(withdrawn)}</TableCell>
                              <TableCell className="font-semibold text-sm text-tsia-green">{fmtUSD(tf.walletBalance ?? 0)}</TableCell>
                              <TableCell><StatusBadge status={tf.status} /></TableCell>
                              <TableCell className="text-xs text-slate-500">{fmtDate(tf.createdAt)}</TableCell>
                              <TableCell className="text-right px-6">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => {
                                      setTfAdjustDialog({ userId: tf.userId, name: tf.userName, earnedAmount: earned, availableAmount: available, sharePercentage: tf.sharePercentage, withdrawnAmount: tf.withdrawnAmount });
                                      setTfAdjustSharePct(parseFloat(tf.sharePercentage).toFixed(4));
                                      setTfGrantAmount("");
                                    }}
                                    data-testid={`button-adjust-trustfunder-${tf.id}`}>
                                    <Edit className="w-3 h-3 mr-1" /> Adjust
                                  </Button>
                                  <Button size="sm" variant="outline" className={`h-7 text-xs ${isActive ? "border-red-300 text-red-600 hover:bg-red-50" : "border-tsia-green/30 text-tsia-green hover:bg-tsia-green/5"}`}
                                    disabled={updateTrustFunderStatusMutation.isPending}
                                    onClick={() => updateTrustFunderStatusMutation.mutate({ userId: tf.userId, status: isActive ? "cancelled" : "active" })}
                                    data-testid={`button-toggle-trustfunder-${tf.id}`}>
                                    {isActive ? <><ToggleRight className="w-3 h-3 mr-1" /> Cancel</> : <><ToggleLeft className="w-3 h-3 mr-1" /> Activate</>}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                    disabled={deleteTrustFunderMutation.isPending}
                                    onClick={() => { if (window.confirm(`Delete trust funder record for ${tf.userName}? This cannot be undone.`)) deleteTrustFunderMutation.mutate(tf.userId); }}
                                    data-testid={`button-delete-trustfunder-${tf.id}`}>
                                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* ─── Adjust Trust Funder Profit Dialog ───────────────────────── */}
                <Dialog open={!!tfAdjustDialog} onOpenChange={o => !o && setTfAdjustDialog(null)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Adjust Profit — {tfAdjustDialog?.name}</DialogTitle>
                      <DialogDescription>
                        Current state: <strong className="text-tsia-green">{fmtUSD(tfAdjustDialog?.earnedAmount ?? 0)}</strong> earned |
                        <strong className="text-blue-600"> {fmtUSD(tfAdjustDialog?.availableAmount ?? 0)}</strong> available |
                        <strong className="text-slate-500"> {fmtUSD(parseFloat(tfAdjustDialog?.withdrawnAmount ?? "0"))}</strong> withdrawn
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div>
                        <Label className="font-semibold">Share Percentage (%)</Label>
                        <p className="text-xs text-muted-foreground mb-1">Changes how much of the affiliate pool this trust funder earns. Affects all past and future pool calculations.</p>
                        <div className="relative">
                          <Input type="number" min="0" max="100" step="0.0001" className="pr-8"
                            value={tfAdjustSharePct} onChange={e => setTfAdjustSharePct(e.target.value)}
                            placeholder="e.g. 0.0050" data-testid="input-tf-share-pct" />
                          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="border-t pt-4">
                        <Label className="font-semibold">Grant / Deduct Profit (USD)</Label>
                        <p className="text-xs text-muted-foreground mb-1">
                          <strong>Positive</strong> = grant profit (increase available balance). <strong>Negative</strong> = deduct profit (decrease available balance). This adjusts the "withdrawn" ledger accordingly.
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                          <Input type="number" step="0.01" className="pl-7"
                            value={tfGrantAmount} onChange={e => setTfGrantAmount(e.target.value)}
                            placeholder="e.g. 5.00 or -2.00" data-testid="input-tf-grant-amount" />
                        </div>
                        {tfGrantAmount && !isNaN(parseFloat(tfGrantAmount)) && (
                          <p className={`text-xs mt-1 ${parseFloat(tfGrantAmount) >= 0 ? "text-tsia-green" : "text-red-500"}`}>
                            {parseFloat(tfGrantAmount) >= 0
                              ? `Will GRANT $${Math.abs(parseFloat(tfGrantAmount)).toFixed(2)} — available balance increases`
                              : `Will DEDUCT $${Math.abs(parseFloat(tfGrantAmount)).toFixed(2)} — available balance decreases`}
                          </p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTfAdjustDialog(null)}>Cancel</Button>
                      <Button className="bg-amber-500 hover:bg-amber-600 text-white"
                        disabled={(!tfAdjustSharePct && !tfGrantAmount) || adjustTrustFunderMutation.isPending}
                        onClick={() => tfAdjustDialog && adjustTrustFunderMutation.mutate({
                          userId: tfAdjustDialog.userId,
                          sharePercentage: tfAdjustSharePct || undefined,
                          adjustWithdrawn: tfGrantAmount || undefined,
                        })}
                        data-testid="button-confirm-tf-adjust">
                        {adjustTrustFunderMutation.isPending ? "Saving…" : "Apply Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </motion.div>
            )}

            {/* ═══════════════════════════════ MESSAGES ═══════════════════════════════ */}
            {activeTab === "messages" && (
              <motion.div key="messages" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Forum Messages</CardTitle>
                    <CardDescription>Latest 500 forum posts. Delete inappropriate content.</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Author</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Topic</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Message</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Likes</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allMessages as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">No messages yet.</TableCell></TableRow>
                        ) : (allMessages as any[]).map((m: any) => (
                          <TableRow key={m.id} className="hover:bg-slate-50/50">
                            <TableCell className="px-6">
                              <div className="font-medium text-sm text-slate-900">{m.authorName}</div>
                              <div className="text-xs text-slate-500">{m.authorEmail}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">{m.topicTitle}</TableCell>
                            <TableCell className="text-sm text-slate-700 max-w-[260px]">
                              <p className="line-clamp-2">{m.content}</p>
                            </TableCell>
                            <TableCell className="text-sm">{m.likeCount ?? 0}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(m.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={deleteMessageMutation.isPending} onClick={() => deleteMessageMutation.mutate(m.id)} data-testid={`button-delete-message-${m.id}`}>
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ NOTIFICATIONS ═══════════════════════════════ */}
            {activeTab === "notifications" && (
              <motion.div key="notifications" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6 max-w-2xl">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-base">Send Platform Notification</CardTitle>
                    <CardDescription>Compose a notification for a specific user or broadcast to all users.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <div className="space-y-2">
                      <Label className="font-semibold">Target Audience</Label>
                      <Select value={notifyRole} onValueChange={v => { setNotifyRole(v); setNotifyTarget(null); }}>
                        <SelectTrigger className="h-10 bg-muted/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users (Students + Affiliates)</SelectItem>
                          <SelectItem value="student">All Students Only</SelectItem>
                          <SelectItem value="affiliate">All Affiliates Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Notification Title</Label>
                      <Input placeholder="e.g. Important Platform Update" className="h-10 bg-muted/30" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} data-testid="input-notify-title" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Message Body</Label>
                      <Textarea placeholder="Write your notification message here..." className="bg-muted/30 min-h-[100px] resize-none" value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} data-testid="input-notify-message" />
                    </div>
                    <Button className="w-full h-11 font-semibold" disabled={!notifyTitle || !notifyMsg || notifyMutation.isPending} onClick={() => notifyMutation.mutate()} data-testid="button-send-notification">
                      {notifyMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send Notification</>}
                    </Button>
                  </CardContent>
                </Card>
                <p className="text-xs text-slate-500 text-center">To notify a specific user, go to the Users or Affiliates tab and use the Notify button on their row.</p>

                {/* ─── New Movie Broadcast ─────────────────────────────────────── */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-base flex items-center gap-2"><Film className="w-4 h-4 text-rose-500" /> Broadcast: New Movie Added</CardTitle>
                    <CardDescription>Sends an in-app notification AND an email to every student & affiliate announcing a new movie in the streaming library.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <div className="space-y-2">
                      <Label className="font-semibold">Movie Title *</Label>
                      <Input placeholder="e.g. Inception" className="h-10 bg-muted/30" value={movieBcTitle} onChange={e => setMovieBcTitle(e.target.value)} maxLength={200} data-testid="input-movie-broadcast-title" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Short Description (optional)</Label>
                      <Textarea placeholder="One-liner for the email and notification..." className="bg-muted/30 min-h-[80px] resize-none" value={movieBcDesc} onChange={e => setMovieBcDesc(e.target.value)} maxLength={500} data-testid="input-movie-broadcast-desc" />
                    </div>
                    <Button className="w-full h-11 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                      disabled={!movieBcTitle.trim() || movieBroadcastMutation.isPending}
                      onClick={() => movieBroadcastMutation.mutate()}
                      data-testid="button-broadcast-movie">
                      {movieBroadcastMutation.isPending
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Broadcasting…</>
                        : <><Film className="w-4 h-4 mr-2" /> Broadcast New Movie to Everyone</>}
                    </Button>
                  </CardContent>
                </Card>

                {/* ─── Trade Window Schedule (auto, info only) ─────────────────── */}
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-base flex items-center gap-2"><Coins className="w-4 h-4 text-emerald-600" /> Itera Trade BOT — Weekly Window Broadcasts</CardTitle>
                    <CardDescription>Automated. Notifications + emails go out to every user when the market window opens and closes each week.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-emerald-200">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">🟢 Market OPENS</p>
                        <p className="text-xs text-muted-foreground">Every Monday at 12:30 PM GMT</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Auto</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-rose-200">
                      <div>
                        <p className="text-sm font-semibold text-rose-700">🔴 Market CLOSES</p>
                        <p className="text-xs text-muted-foreground">Every Friday at 12:30 PM GMT</p>
                      </div>
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200">Auto</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1">Each broadcast fires once per week and is de-duplicated by date — restarting the server will not re-send the same day's message.</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "enrollment" && (
              <motion.div key="enrollment" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="space-y-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-tsia-green" /> Enrollment Slot Management</h2>

                {/* Batch status cards */}
                {batchStatus ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard title="Batch Number" value={batchStatus.batch ? `#${batchStatus.batch.batchNumber}` : "—"} icon={Users2} color="tsia" />
                    <StatCard title="Enrolled" value={`${batchStatus.enrolled} / ${batchStatus.totalCapacity}`} icon={UserCheck} color="blue" />
                    <StatCard title="Remaining Seats" value={batchStatus.remaining} icon={LockOpen} color={batchStatus.remaining > 0 ? "green" : "red"} />
                    <StatCard
                      title="Batch Status"
                      value={batchStatus.batch?.status === "open" ? "Open" : "Closed"}
                      icon={batchStatus.batch?.status === "open" ? LockOpen : Lock}
                      color={batchStatus.batch?.status === "open" ? "green" : "red"}
                      sub={batchStatus.batch?.status === "closed" && batchStatus.batch?.nextOpenAt
                        ? `Next: ${fmtDate(batchStatus.batch.nextOpenAt)}`
                        : undefined}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[0,1,2,3].map(i => <Card key={i} className="border-0 shadow-sm animate-pulse"><CardContent className="p-5 h-24 bg-slate-100 rounded-xl" /></Card>)}
                  </div>
                )}

                {/* Open slots form */}
                <Card className="border border-tsia-green/20 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                      <PlusCircle className="w-4 h-4 text-tsia-green" /> Open Additional Enrollment Slots
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Adding slots reopens the current batch immediately. The batch will close again automatically once the new capacity is reached.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label htmlFor="open-slots-input" className="text-xs font-semibold text-slate-600 mb-1.5 block">Number of Additional Seats</Label>
                        <Input
                          id="open-slots-input"
                          type="number"
                          min="1"
                          max="500"
                          value={openSlotsInput}
                          onChange={e => setOpenSlotsInput(e.target.value)}
                          className="max-w-xs"
                          data-testid="input-open-slots"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          const n = parseInt(openSlotsInput);
                          if (!n || n < 1) return toast({ title: "Invalid", description: "Enter at least 1 slot.", variant: "destructive" });
                          openBatchSlotsMutation.mutate(n);
                        }}
                        disabled={openBatchSlotsMutation.isPending}
                        className="bg-tsia-green hover:bg-tsia-green/90 text-white"
                        data-testid="button-open-slots"
                      >
                        {openBatchSlotsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LockOpen className="w-4 h-4" />}
                        <span className="ml-1.5">Open Slots</span>
                      </Button>
                    </div>

                    {/* Info note */}
                    <div className="flex items-start gap-2 rounded-lg bg-tsia-gold/10 border border-tsia-gold/30 px-3 py-2.5">
                      <Info className="w-4 h-4 text-tsia-gold shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-600">
                        Extra slots are <strong>additive</strong> — each time you open more, they stack on top of the previous total.
                        The standard batch size is <strong>15</strong>; extra slots add on top of that.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Invite Specific Student ── */}
                <Card className="border border-tsia-gold/30 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                      <Mail className="w-4 h-4 text-tsia-gold" /> Invite a Specific Student
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Grant a named student the ability to enroll even while the batch is closed. The countdown timer on all other students' dashboards is <strong>not affected</strong>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="invite-email" className="text-xs font-semibold text-slate-600 mb-1.5 block">Student Email <span className="text-red-500">*</span></Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="student@example.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          data-testid="input-invite-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-name" className="text-xs font-semibold text-slate-600 mb-1.5 block">Student Name (optional)</Label>
                        <Input
                          id="invite-name"
                          placeholder="e.g. Chukwuemeka Obi"
                          value={inviteName}
                          onChange={e => setInviteName(e.target.value)}
                          data-testid="input-invite-name"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="invite-note" className="text-xs font-semibold text-slate-600 mb-1.5 block">Internal Note (optional)</Label>
                      <Input
                        id="invite-note"
                        placeholder="e.g. Referred by regional coordinator"
                        value={inviteNote}
                        onChange={e => setInviteNote(e.target.value)}
                        data-testid="input-invite-note"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail))
                          return toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
                        inviteStudentMutation.mutate({ email: inviteEmail.trim(), name: inviteName.trim() || undefined, note: inviteNote.trim() || undefined });
                      }}
                      disabled={inviteStudentMutation.isPending}
                      className="bg-tsia-gold hover:bg-tsia-gold/90 text-white"
                      data-testid="button-send-invite"
                    >
                      {inviteStudentMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
                      Send Personal Invitation
                    </Button>

                    {/* Invitation history */}
                    {personalInvitations.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Invitation History</p>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {personalInvitations.map((inv: any) => (
                            <div key={inv.id} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate">{inv.email}</p>
                                {inv.name && <p className="text-slate-500">{inv.name}</p>}
                                {inv.note && <p className="text-slate-400 italic truncate">{inv.note}</p>}
                              </div>
                              <span className={`ml-3 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${inv.used ? "bg-slate-200 text-slate-500" : "bg-tsia-gold/20 text-tsia-gold"}`}>
                                {inv.used ? "Used" : "Pending"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Batch history */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-slate-800 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-slate-500" /> Current Batch Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {batchStatus?.batch ? (
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Batch #</span>
                          <span className="font-semibold text-slate-800">{batchStatus.batch.batchNumber}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Status</span>
                          <StatusBadge status={batchStatus.batch.status} />
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Base Capacity</span>
                          <span className="font-semibold text-slate-800">15</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Extra Slots Granted</span>
                          <span className={`font-semibold ${batchStatus.batch.extraSlots > 0 ? "text-tsia-green" : "text-slate-400"}`}>{batchStatus.batch.extraSlots}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Total Capacity</span>
                          <span className="font-bold text-tsia-green">{batchStatus.totalCapacity}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Enrolled</span>
                          <span className="font-semibold text-slate-800">{batchStatus.enrolled}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Remaining Seats</span>
                          <span className={`font-bold ${batchStatus.remaining > 0 ? "text-green-600" : "text-red-500"}`}>{batchStatus.remaining}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500">Opened At</span>
                          <span className="text-slate-700">{fmtDate(batchStatus.batch.openedAt)}</span>
                        </div>
                        {batchStatus.batch.closedAt && (
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Closed At</span>
                            <span className="text-slate-700">{fmtDate(batchStatus.batch.closedAt)}</span>
                          </div>
                        )}
                        {batchStatus.batch.nextOpenAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Auto-open At</span>
                            <span className="text-amber-600 font-semibold">{fmtDate(batchStatus.batch.nextOpenAt)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-6">No batch data yet. Open slots to create the first batch.</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === "settings" && (() => {
              const prices = platformSettingsData?.prices;
              const tiers = platformSettingsData?.tiers;
              const base = {
                plan1yr:           prices ? prices.plan1yr.toString()                  : "35",
                plan2yr:           prices ? prices.plan2yr.toString()                  : "45",
                plan3yr:           prices ? prices.plan3yr.toString()                  : "50",
                serviceChargeRate: prices ? (prices.serviceChargeRate * 100).toFixed(2): "10.00",
                silverMin:   tiers ? tiers.silver.min.toString()   : "110",
                silverMax:   tiers ? tiers.silver.max.toString()   : "130",
                goldMin:     tiers ? tiers.gold.min.toString()     : "160",
                goldMax:     tiers ? tiers.gold.max.toString()     : "180",
                platinumMin: tiers ? tiers.platinum.min.toString() : "225",
                platinumMax: tiers ? tiers.platinum.max.toString() : "230",
              };
              const currentForm = settingsForm.plan1yr ? settingsForm : base;
              const updateForm = (k: keyof typeof settingsForm, v: string) => setSettingsForm(f => ({ ...(f.plan1yr ? f : base), [k]: v }));
              const s1 = parseFloat(currentForm.plan1yr) || 35;
              const s2 = parseFloat(currentForm.plan2yr) || 45;
              const s3 = parseFloat(currentForm.plan3yr) || 50;
              const sc = parseFloat(currentForm.serviceChargeRate) || 10;
              return (
                <motion.div key="settings" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6 max-w-2xl">
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-tsia-green/10 flex items-center justify-center"><Settings className="w-5 h-5 text-tsia-green" /></div>
                        <div>
                          <CardTitle className="text-base">Swift-Pay Plan Prices</CardTitle>
                          <CardDescription>Update the base price students pay for each plan. Changes take effect immediately.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { key: "plan1yr" as const, label: "1-Year Plan", icon: "1" },
                          { key: "plan2yr" as const, label: "2-Year Plan", icon: "2" },
                          { key: "plan3yr" as const, label: "3-Year Plan", icon: "3" },
                        ].map(({ key, label, icon }) => (
                          <div key={key} className="space-y-2">
                            <Label className="font-semibold text-sm">{label}</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                              <Input
                                type="number"
                                min="1"
                                step="0.01"
                                className="pl-7 h-11 bg-muted/30 font-semibold text-base"
                                value={settingsForm.plan1yr ? settingsForm[key] : currentForm[key]}
                                onChange={e => updateForm(key, e.target.value)}
                                data-testid={`input-price-${key}`}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              +{sc}% charge = <strong>${(parseFloat(settingsForm.plan1yr ? settingsForm[key] : currentForm[key]) * (1 + sc / 100)).toFixed(2)} total</strong>
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label className="font-semibold text-sm">Service Charge Rate (%)</Label>
                        <div className="relative max-w-[200px]">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="pr-8 h-11 bg-muted/30 font-semibold"
                            value={settingsForm.plan1yr ? settingsForm.serviceChargeRate : currentForm.serviceChargeRate}
                            onChange={e => updateForm("serviceChargeRate", e.target.value)}
                            data-testid="input-service-charge-rate"
                          />
                          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-xs text-muted-foreground">This percentage is added on top of the base price as a service charge.</p>
                      </div>

                      <div className="bg-slate-50 rounded-xl border p-4 space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Price Preview</p>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[{ label: "1-Year", base: s1 }, { label: "2-Year", base: s2 }, { label: "3-Year", base: s3 }].map(p => (
                            <div key={p.label} className="bg-white rounded-lg border p-3">
                              <p className="text-xs text-slate-500 mb-1">{p.label}</p>
                              <p className="text-lg font-bold text-tsia-green">${(p.base * (1 + sc / 100)).toFixed(2)}</p>
                              <p className="text-[10px] text-slate-400">${p.base.toFixed(2)} + {sc}%</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        className="w-full h-11 font-semibold bg-tsia-green hover:bg-tsia-green/90"
                        disabled={saveSettingsMutation.isPending}
                        onClick={() => saveSettingsMutation.mutate(settingsForm.plan1yr ? settingsForm : currentForm)}
                        data-testid="button-save-settings"
                      >
                        {saveSettingsMutation.isPending
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Saving...</>
                          : settingsSaved
                            ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</>
                            : <><Save className="w-4 h-4 mr-2" /> Save All Settings</>}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* ── Tier Payout Offers ─────────────────────────────────── */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Award className="w-5 h-5 text-amber-500" /></div>
                        <div>
                          <CardTitle className="text-base">Payout Offer Ranges per Tier</CardTitle>
                          <CardDescription>Set the min–max payout offer shown to students after their WAEC results are verified. Applied to new verifications only.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                      {[
                        { label: "Silver Tier", desc: "Score 50%–59%", color: "bg-slate-100 text-slate-600 border-slate-200", minKey: "silverMin" as const, maxKey: "silverMax" as const },
                        { label: "Gold Tier",   desc: "Score 60%–74%", color: "bg-amber-100 text-amber-800 border-amber-200",   minKey: "goldMin"   as const, maxKey: "goldMax"   as const },
                        { label: "Platinum Tier", desc: "Score 75%+",  color: "bg-slate-800 text-white border-slate-700",       minKey: "platinumMin" as const, maxKey: "platinumMax" as const },
                      ].map(row => (
                        <div key={row.label} className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${row.color}`}>{row.label}</span>
                            <span className="text-xs text-muted-foreground">{row.desc}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Min payout ($/yr)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                                <Input
                                  type="number" min="0" step="1"
                                  className="pl-7 h-10 bg-muted/30 font-semibold"
                                  value={currentForm[row.minKey]}
                                  onChange={e => updateForm(row.minKey, e.target.value)}
                                  data-testid={`input-${row.minKey}`}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Max payout ($/yr)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                                <Input
                                  type="number" min="0" step="1"
                                  className="pl-7 h-10 bg-muted/30 font-semibold"
                                  value={currentForm[row.maxKey]}
                                  onChange={e => updateForm(row.maxKey, e.target.value)}
                                  data-testid={`input-${row.maxKey}`}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Students in this tier see: <strong>${currentForm[row.minKey] || "—"} – ${currentForm[row.maxKey] || "—"}/yr</strong>
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* ── WAEC Grade Scale ────────────────────────────────── */}
                  {(() => {
                    const GRADE_KEYS = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];
                    const DEFAULT_WEIGHTS: Record<string, number> = { A1: 12, B2: 11.5, B3: 11, C4: 10.5, C5: 10, C6: 9.5, D7: 9, E8: 8.5, F9: 8 };
                    const liveScale = waecScaleData?.scale ?? DEFAULT_WEIGHTS;
                    const getValue = (k: string) => waecScaleForm[k] ?? String(liveScale[k] ?? DEFAULT_WEIGHTS[k]);
                    const handleChange = (k: string, v: string) => setWaecScaleForm(f => ({ ...f, [k]: v }));
                    const handleSave = () => {
                      const scale: Record<string, number> = {};
                      for (const k of GRADE_KEYS) {
                        const v = parseFloat(getValue(k));
                        if (isNaN(v)) { toast({ variant: "destructive", title: "Invalid input", description: `Enter a valid number for ${k}` }); return; }
                        scale[k] = v;
                      }
                      saveWaecScaleMutation.mutate(scale);
                    };
                    const handleReset = () => {
                      setWaecScaleForm({});
                      refetchWaecScale();
                    };
                    const gradeColors: Record<string, string> = {
                      A1: "text-emerald-700 bg-emerald-50 border-emerald-200",
                      B2: "text-tsia-green bg-green-50 border-green-200",
                      B3: "text-tsia-green bg-green-50 border-green-200",
                      C4: "text-amber-700 bg-amber-50 border-amber-200",
                      C5: "text-amber-700 bg-amber-50 border-amber-200",
                      C6: "text-amber-600 bg-amber-50 border-amber-200",
                      D7: "text-orange-600 bg-orange-50 border-orange-200",
                      E8: "text-red-500 bg-red-50 border-red-200",
                      F9: "text-red-700 bg-red-100 border-red-300",
                    };
                    const isDirty = Object.keys(waecScaleForm).length > 0;
                    return (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <CardTitle className="text-base">WAEC Grade Point Scale</CardTitle>
                              <CardDescription>
                                Set the point value assigned to each WAEC grade. These values determine each student's score percentage and tier during application.
                                Points must be in descending order (A1 highest → F9 lowest).
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            {GRADE_KEYS.map(k => (
                              <div key={k} className="space-y-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColors[k] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>{k}</span>
                                </div>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  className="h-10 bg-muted/30 font-semibold text-center text-base"
                                  value={getValue(k)}
                                  onChange={e => handleChange(k, e.target.value)}
                                  data-testid={`input-waec-grade-${k}`}
                                />
                              </div>
                            ))}
                          </div>

                          <div className="bg-slate-50 rounded-xl border p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Score Preview</p>
                            <p className="text-xs text-slate-500">
                              A student with 5 A1s would score{" "}
                              <strong className="text-tsia-green">
                                {(() => {
                                  const a1 = parseFloat(getValue("A1")) || 0;
                                  const maxP = Math.max(...GRADE_KEYS.map(k => parseFloat(getValue(k)) || 0), 1);
                                  return ((a1 / maxP) * 100).toFixed(1);
                                })()}%
                              </strong>
                              . A student with 5 F9s would score{" "}
                              <strong className="text-red-500">
                                {(() => {
                                  const f9 = parseFloat(getValue("F9")) || 0;
                                  const maxP = Math.max(...GRADE_KEYS.map(k => parseFloat(getValue(k)) || 0), 1);
                                  return ((f9 / maxP) * 100).toFixed(1);
                                })()}%
                              </strong>.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              className="flex-1 h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={saveWaecScaleMutation.isPending}
                              onClick={handleSave}
                              data-testid="button-save-waec-scale"
                            >
                              {saveWaecScaleMutation.isPending
                                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Saving...</>
                                : waecScaleSaved
                                  ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</>
                                  : <><Save className="w-4 h-4 mr-2" /> Save Grade Scale</>}
                            </Button>
                            {isDirty && (
                              <Button variant="outline" className="h-11" onClick={handleReset} data-testid="button-reset-waec-scale">
                                Reset
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── Fintech Hub Kill-Switches ───────────────────────── */}
                  <Card className={`border-0 shadow-sm border-l-4 ${bankTransfersEnabled ? "border-l-emerald-500" : "border-l-red-500"}`}>
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bankTransfersEnabled ? "bg-emerald-50" : "bg-red-50"}`}>
                          <Banknote className={`w-5 h-5 ${bankTransfersEnabled ? "text-emerald-600" : "text-red-600"}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">Fintech Hub — Bank Transfers</CardTitle>
                          <CardDescription>Open or close outgoing bank transfers across the entire platform.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className={`flex items-center justify-between p-4 rounded-xl border-2 ${bankTransfersEnabled ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
                        <div className="space-y-1">
                          <p className="font-semibold text-sm flex items-center gap-2">
                            {bankTransfersEnabled
                              ? <><ToggleRight className="w-5 h-5 text-emerald-600" /> Bank Transfers are <span className="text-emerald-700">OPEN</span></>
                              : <><ToggleLeft className="w-5 h-5 text-red-600" /> Bank Transfers are <span className="text-red-700">CLOSED</span></>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {bankTransfersEnabled
                              ? "Users can send bank transfers via Korapay disburse from the Fintech Hub."
                              : "All bank transfer attempts return 503 with a friendly message. No wallets are debited."}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={bankTransfersEnabled ? "destructive" : "default"}
                          className={`font-semibold ${bankTransfersEnabled ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                          disabled={bankToggleSaving}
                          data-testid="button-toggle-bank-transfers"
                          onClick={async () => {
                            const next = !bankTransfersEnabled;
                            setBankToggleSaving(true);
                            try {
                              const res = await apiRequest("PUT", "/api/admin/trade-settings", {
                                feeExchangeWithdraw: tradeSettingsData?.feeExchangeWithdraw?.toString() ?? "0.05",
                                feeBankWithdraw:     tradeSettingsData?.feeBankWithdraw?.toString()     ?? "0.08",
                                reserveRate:         tradeSettingsData?.reserveRate?.toString()         ?? "0.20",
                                affiliateShareRate:  tradeSettingsData?.affiliateShareRate?.toString()  ?? "0.05",
                                minDeposit:          tradeSettingsData?.minDeposit?.toString()          ?? "10",
                                minWithdraw:         tradeSettingsData?.minWithdraw?.toString()         ?? "5",
                                botFullRate:         tradeSettingsData?.botFullRate?.toString()         ?? "0.02",
                                coAffiliatePoolRate: tradeSettingsData?.coAffiliatePoolRate != null ? tradeSettingsData.coAffiliatePoolRate.toString() : "",
                                bankTransfersEnabled: next,
                              });
                              if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
                              setBankTransfersEnabled(next);
                              refetchTradeSettings();
                              toast({ title: next ? "Bank Transfers Re-Opened ✓" : "Bank Transfers Closed ✓", description: next ? "Users can now send bank transfers again." : "All bank transfer attempts will be blocked." });
                            } catch (e: any) {
                              toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
                            } finally {
                              setBankToggleSaving(false);
                            }
                          }}
                        >
                          {bankToggleSaving
                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving…</>
                            : (bankTransfersEnabled ? <><ToggleLeft className="w-4 h-4 mr-1.5" />Close Bank Transfers</> : <><ToggleRight className="w-4 h-4 mr-1.5" />Re-Open Bank Transfers</>)}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <strong>Note:</strong> Airtime, data, and bill payments stay live regardless of this toggle. This only blocks the Korapay bank disburse flow.
                      </p>
                    </CardContent>
                  </Card>

                  {/* ── Trade Market Rate Controls ──────────────────────── */}
                  {(() => {
                    const td = tradeSettingsData;
                    const tf = {
                      feeExchangeWithdraw: tradeForm.feeExchangeWithdraw || (td ? (td.feeExchangeWithdraw * 100).toFixed(2) : "5.00"),
                      feeBankWithdraw:     tradeForm.feeBankWithdraw     || (td ? (td.feeBankWithdraw * 100).toFixed(2)     : "8.00"),
                      reserveRate:         tradeForm.reserveRate         || (td ? (td.reserveRate * 100).toFixed(2)         : "20.00"),
                      affiliateShareRate:  tradeForm.affiliateShareRate  || (td ? (td.affiliateShareRate * 100).toFixed(2)  : "5.00"),
                      minDeposit:          tradeForm.minDeposit          || (td ? td.minDeposit.toString()                  : "10"),
                      minWithdraw:         tradeForm.minWithdraw         || (td ? td.minWithdraw.toString()                 : "5"),
                      coAffiliatePoolRate: tradeForm.coAffiliatePoolRate || (td ? (td.coAffiliatePoolRate != null ? (td.coAffiliatePoolRate * 100).toFixed(2) : "") : ""),
                      botFullRate:         tradeForm.botFullRate         || (td ? (td.botFullRate * 100).toFixed(2)         : "2.00"),
                    };
                    const setTf = (k: keyof typeof tradeForm, v: string) => setTradeForm(f => ({ ...tf, [k]: v }));
                    const submitTrade = () => {
                      const payload = {
                        feeExchangeWithdraw: (parseFloat(tf.feeExchangeWithdraw) / 100).toString(),
                        feeBankWithdraw:     (parseFloat(tf.feeBankWithdraw) / 100).toString(),
                        reserveRate:         (parseFloat(tf.reserveRate) / 100).toString(),
                        affiliateShareRate:  (parseFloat(tf.affiliateShareRate) / 100).toString(),
                        minDeposit:          tf.minDeposit,
                        minWithdraw:         tf.minWithdraw,
                        coAffiliatePoolRate: tf.coAffiliatePoolRate ? (parseFloat(tf.coAffiliatePoolRate) / 100).toString() : "",
                        botFullRate:         (parseFloat(tf.botFullRate) / 100).toString(),
                      };
                      saveTradeSettingsMutation.mutate(payload as any);
                    };
                    return (
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="border-b pb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-500" /></div>
                            <div>
                              <CardTitle className="text-base">Trade Market Rate Controls</CardTitle>
                              <CardDescription>Set fee rates and limits for the TSIA trade market. Changes apply to new transactions.</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-5">
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { key: "feeExchangeWithdraw" as const, label: "Exchange Withdraw Fee", hint: "Fee on USDT→wallet" },
                              { key: "feeBankWithdraw"     as const, label: "Bank Withdraw Fee",     hint: "Fee on trade→bank" },
                              { key: "reserveRate"         as const, label: "Reserve Fund Rate",     hint: "% of deposits to reserve" },
                              { key: "affiliateShareRate"  as const, label: "Affiliate Share Rate",  hint: "Affiliate cut per deposit" },
                            ].map(({ key, label, hint }) => (
                              <div key={key} className="space-y-1">
                                <Label className="font-semibold text-sm">{label}</Label>
                                <div className="relative">
                                  <Input type="number" min="0" max="50" step="0.01" className="pr-8 h-10 bg-muted/30 font-semibold"
                                    value={tf[key]} onChange={e => setTf(key, e.target.value)} data-testid={`input-trade-${key}`} />
                                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-[10px] text-muted-foreground">{hint}</p>
                              </div>
                            ))}
                            {[
                              { key: "minDeposit"  as const, label: "Min Trade Deposit ($)",  hint: "Minimum deposit amount" },
                              { key: "minWithdraw" as const, label: "Min Trade Withdraw ($)", hint: "Minimum withdraw amount" },
                            ].map(({ key, label, hint }) => (
                              <div key={key} className="space-y-1">
                                <Label className="font-semibold text-sm">{label}</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                                  <Input type="number" min="1" step="1" className="pl-7 h-10 bg-muted/30 font-semibold"
                                    value={tf[key]} onChange={e => setTf(key, e.target.value)} data-testid={`input-trade-${key}`} />
                                </div>
                                <p className="text-[10px] text-muted-foreground">{hint}</p>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-1">
                              <Label className="font-semibold text-sm">Daily Bot Return Rate (%)</Label>
                              <div className="relative">
                                <Input type="number" min="0.1" max="20" step="0.01" className="pr-8 h-10 bg-muted/30 font-semibold"
                                  placeholder="2.00"
                                  value={tf.botFullRate} onChange={e => setTf("botFullRate", e.target.value)}
                                  data-testid="input-trade-botFullRate" />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-[10px] text-muted-foreground">Max daily return from the AI bot (0.1–20%). Default: 2%.</p>
                            </div>
                            <div className="space-y-1">
                              <Label className="font-semibold text-sm">Co-Affiliate Pool Rate Override (%)</Label>
                              <div className="relative">
                                <Input type="number" min="0" max="100" step="0.01" className="pr-8 h-10 bg-muted/30 font-semibold"
                                  placeholder="Auto (tiered)"
                                  value={tf.coAffiliatePoolRate} onChange={e => setTf("coAffiliatePoolRate", e.target.value)}
                                  data-testid="input-co-affiliate-pool-rate" />
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-[10px] text-muted-foreground">Leave blank to use auto tiered rate (20%→15%→10%→5%).</p>
                            </div>
                          </div>
                          <Button className="w-full h-11 font-semibold bg-blue-600 hover:bg-blue-700" disabled={saveTradeSettingsMutation.isPending}
                            onClick={submitTrade} data-testid="button-save-trade-settings">
                            {saveTradeSettingsMutation.isPending
                              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving…</>
                              : tradeSaved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</> : <><Save className="w-4 h-4 mr-2" />Save Trade Settings</>}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── Terms of Service — Email All Users ──────────────── */}
                  <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
                    <CardHeader className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Mail className="w-5 h-5 text-amber-500" /></div>
                        <div>
                          <CardTitle className="text-base">Terms of Service — Notify All Users</CardTitle>
                          <CardDescription>Send a ToS update email to every registered user via Brevo.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This will send an email to <strong>all registered students and affiliates</strong> notifying them of the updated Terms of Service. The email will include a link to the updated ToS page.
                      </p>
                      {tosEmailResult && (
                        <div className={`text-sm px-4 py-3 rounded-xl font-semibold ${tosEmailResult.includes("failed") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                          {tosEmailResult}
                        </div>
                      )}
                      <Button
                        className="w-full h-11 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                        disabled={tosEmailState === "sending"}
                        onClick={async () => {
                          setTosEmailState("sending");
                          setTosEmailResult("");
                          try {
                            const res = await apiRequest("POST", "/api/admin/email-tos-update");
                            const d = await res.json();
                            setTosEmailResult(d.message);
                            setTosEmailState("done");
                          } catch (e: any) {
                            setTosEmailResult("Error: " + e.message);
                            setTosEmailState("idle");
                          }
                        }}
                        data-testid="button-email-tos-update">
                        {tosEmailState === "sending"
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Sending emails…</>
                          : tosEmailState === "done"
                            ? <><CheckCircle2 className="w-4 h-4 mr-2" />Emails Sent</>
                            : <><Mail className="w-4 h-4 mr-2" />Send ToS Update to All Users</>}
                      </Button>
                    </CardContent>
                  </Card>

                  <p className="text-xs text-slate-500 text-center">Plan price changes apply immediately. Payout changes apply to new verifications only — existing students keep their current offers.</p>
                </motion.div>
              );
            })()}

          </AnimatePresence>
        </main>
      </div>

      {/* ═══════════════ DIALOGS ═══════════════ */}

      {/* Review verification dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={open => !open && setReviewDialog(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application — {reviewDialog?.user?.firstName} {reviewDialog?.user?.lastName}</DialogTitle>
            <DialogDescription>Verify the student's identity, academic records, and KYC status before approving.</DialogDescription>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 py-2">
              {reviewDialog.ageDisqualified && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <div><strong>Admin Flag:</strong> This applicant's estimated age exceeds the 29-year eligibility limit based on their WAEC year. The $3 fee was collected. Do not approve for sponsorship.</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identity</h4>
                  <p className="text-sm"><span className="text-slate-500">NIN:</span> <span className="font-mono font-semibold">{reviewDialog.nin || "Not provided"}</span></p>
                  <p className="text-sm"><span className="text-slate-500">Country:</span> <strong>{reviewDialog.user?.country || "—"}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">Phone:</span> <strong>{reviewDialog.user?.phone || "—"}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">Diaspora:</span> <strong>{reviewDialog.user?.isDiaspora ? "Yes" : "No"}</strong></p>
                </div>
                <div className="bg-slate-50 border rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Academic</h4>
                  <p className="text-sm"><span className="text-slate-500">WAEC Reg:</span> <span className="font-mono font-semibold">{reviewDialog.waecRegNumber || "Not provided"}</span></p>
                  <p className="text-sm"><span className="text-slate-500">Year:</span> <strong>{reviewDialog.waecYear || "—"}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">School:</span> <strong>{reviewDialog.schoolName || "—"}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">Location:</span> <strong>{reviewDialog.schoolLocation || "—"}</strong></p>
                </div>
              </div>
              <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">WAEC Grades</h4>
                {reviewDialog.waecSubjects ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {reviewDialog.waecSubjects.split(",").map((sub: string, i: number) => {
                        const gradesList = (reviewDialog.waecGrades || "").split(" ");
                        const grade = gradesList[i] || "—";
                        const isPass = ["A1","B2","B3","C4","C5","C6"].includes(grade);
                        return (
                          <div key={i} className={`border rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 ${isPass ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                            <span className="text-slate-600">{sub.trim()}</span>
                            <span className={`font-bold ${isPass ? "text-green-700" : "text-red-600"}`}>{grade}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                      <div><span className="text-xs text-slate-500">Score:</span> <span className="font-bold text-lg ml-1">{reviewDialog.waecPercentage ? `${reviewDialog.waecPercentage}%` : "—"}</span></div>
                      <TierBadge tier={reviewDialog.tier} />
                      {reviewDialog.tier !== "none" && <span className="text-sm font-semibold text-tsia-green">${reviewDialog.payoutMin}–${reviewDialog.payoutMax}</span>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">No WAEC grades submitted by this applicant.</p>
                )}
              </div>
              <div className="bg-slate-50 border rounded-xl p-4 space-y-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sponsorship Reason</h4>
                <p className="text-sm text-slate-800 font-medium">{reviewDialog.sponsorshipReason || <span className="italic text-slate-400">Not provided</span>}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: "Portal Fee", ok: reviewDialog.portalFeePaid }, { label: "Biometric", ok: reviewDialog.biometricVerified }, { label: "KYC Ready", ok: reviewDialog.portalFeePaid && reviewDialog.biometricVerified }].map(item => (
                  <div key={item.label} className={`rounded-xl border p-3 flex items-center gap-2 ${item.ok ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                    {item.ok ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className={`text-sm font-medium ${item.ok ? "text-green-700" : "text-slate-500"}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between border-t pt-4 gap-3 flex-col sm:flex-row">
            {reviewDialog?.status === "pending" ? (
              <>
                <Button variant="outline" className="border-red-400 text-red-600 hover:bg-red-50"
                  onClick={() => { setRejectDialog({ open: true, verification: reviewDialog }); setReviewDialog(null); }}
                  disabled={verifyMutation.isPending}>
                  <XCircle className="w-4 h-4 mr-2" /> Decline & Retry
                </Button>
                <Button className="bg-tsia-green hover:bg-tsia-green/90"
                  onClick={() => verifyMutation.mutate({ id: reviewDialog.id, approve: true })}
                  disabled={verifyMutation.isPending}
                  data-testid="button-approve">
                  {verifyMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Approving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Verify</>}
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-between w-full gap-3">
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${reviewDialog?.status === "verified" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {reviewDialog?.status === "verified" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {reviewDialog?.status === "verified" ? "Application Approved" : "Application Declined"}
                </span>
                <div className="flex gap-2">
                  {reviewDialog?.status === "verified" && (
                    <Button variant="outline" className="border-red-400 text-red-600 hover:bg-red-50"
                      onClick={() => { setRejectDialog({ open: true, verification: reviewDialog }); setReviewDialog(null); }}
                      disabled={verifyMutation.isPending}>
                      <XCircle className="w-4 h-4 mr-2" /> Decline & Retry
                    </Button>
                  )}
                  {reviewDialog?.status === "rejected" && (
                    <>
                      <Button variant="outline" className="border-amber-400 text-amber-600 hover:bg-amber-50"
                        onClick={() => resetVerifyMutation.mutate(reviewDialog.id)}
                        disabled={resetVerifyMutation.isPending}
                        data-testid="button-allow-retry-dialog">
                        <RefreshCw className="w-4 h-4 mr-2" /> Allow Retry
                      </Button>
                      <Button className="bg-tsia-green hover:bg-tsia-green/90"
                        onClick={() => { verifyMutation.mutate({ id: reviewDialog.id, approve: true }); setReviewDialog(null); }}
                        disabled={verifyMutation.isPending}
                        data-testid="button-re-approve">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Directly
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setReviewDialog(null)}>Close</Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline & Retry dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={open => { if (!open) { setRejectDialog({ open: false, verification: null }); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Decline & Allow Retry</DialogTitle>
            <DialogDescription>The student will be notified with the reason below and invited to correct and resubmit their application.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm">
              <strong>{rejectDialog.verification?.user?.firstName} {rejectDialog.verification?.user?.lastName}</strong>
              <p className="text-slate-500 text-xs mt-0.5">{rejectDialog.verification?.user?.email}</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Reason for declining <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="e.g. WAEC registration number could not be verified. Please resubmit with the correct registration number."
                className="bg-muted/30 min-h-[100px] resize-none"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                data-testid="input-reject-reason"
              />
              <p className="text-[11px] text-slate-400">This message is emailed to the student along with instructions to resubmit.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, verification: null }); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: rejectDialog.verification?.id, approve: false, reason: rejectReason })} data-testid="button-confirm-reject">
              {verifyMutation.isPending ? "Processing..." : "Decline & Notify Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process disbursement dialog */}
      <Dialog open={!!disburseDialog} onOpenChange={open => !open && setDisburseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payout Disbursement</DialogTitle>
            <DialogDescription>This will immediately credit funds to the student's wallet and send them a confirmation email. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {disburseDialog && (
            <div className="bg-slate-50 border rounded-2xl p-6 my-2 space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <span className="text-sm text-slate-500">Recipient</span>
                <span className="font-semibold">{disburseDialog.user?.firstName} {disburseDialog.user?.lastName}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-4">
                <span className="text-sm text-slate-500">Email</span>
                <span className="text-sm">{disburseDialog.user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Transfer Amount</span>
                <span className="text-2xl font-bold text-slate-900">{fmtUSD(disburseDialog.amount)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisburseDialog(null)}>Cancel</Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90" onClick={() => disburseMutation.mutate(disburseDialog.id)} disabled={disburseMutation.isPending} data-testid="button-execute-transfer">
              {disburseMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing...</> : <><Wallet className="w-4 h-4 mr-2" />Execute Transfer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit disbursement amount dialog */}
      <Dialog open={!!editDisburseDialog} onOpenChange={open => { if (!open) { setEditDisburseDialog(null); setEditDisburseAmount(""); setEditDisburseNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-4 h-4 text-amber-500" /> Edit Disbursement Amount</DialogTitle>
            <DialogDescription>Adjust the payout amount for this student. They will be notified by email of the change.</DialogDescription>
          </DialogHeader>
          {editDisburseDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 border rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Student</span><span className="font-medium">{editDisburseDialog.user?.firstName} {editDisburseDialog.user?.lastName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Current Amount</span><span className="font-bold text-slate-900">{fmtUSD(editDisburseDialog.amount)}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-disburse-amount">New Amount ($)</Label>
                <Input id="edit-disburse-amount" type="number" min="0.01" step="0.01" value={editDisburseAmount} onChange={e => setEditDisburseAmount(e.target.value)} placeholder="Enter new amount" data-testid="input-edit-disburse-amount" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-disburse-note">Admin Note (optional)</Label>
                <Textarea id="edit-disburse-note" value={editDisburseNote} onChange={e => setEditDisburseNote(e.target.value)} placeholder="Reason for adjustment..." rows={2} data-testid="input-edit-disburse-note" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditDisburseDialog(null); setEditDisburseAmount(""); setEditDisburseNote(""); }}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => editDisburseMutation.mutate({ id: editDisburseDialog.id, newAmount: editDisburseAmount, note: editDisburseNote })}
              disabled={editDisburseMutation.isPending || !editDisburseAmount.trim()}
              data-testid="button-save-edit-disburse">
              {editDisburseMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline disbursement dialog */}
      <Dialog open={!!declineDisburseDialog} onOpenChange={open => { if (!open) { setDeclineDisburseDialog(null); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Decline Disbursement</DialogTitle>
            <DialogDescription>This will mark the disbursement as declined. The student will be notified by email.</DialogDescription>
          </DialogHeader>
          {declineDisburseDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Student</span><span className="font-medium">{declineDisburseDialog.user?.firstName} {declineDisburseDialog.user?.lastName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Email</span><span>{declineDisburseDialog.user?.email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Amount</span><span className="font-bold text-red-700">{fmtUSD(declineDisburseDialog.amount)}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decline-reason">Reason for Declining (sent to student)</Label>
                <Textarea id="decline-reason" value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. Qualification criteria not met, please reapply after completing verification..." rows={3} data-testid="input-decline-reason" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeclineDisburseDialog(null); setDeclineReason(""); }}>Cancel</Button>
            <Button variant="destructive"
              onClick={() => declineDisburseMutation.mutate({ id: declineDisburseDialog.id, reason: declineReason })}
              disabled={declineDisburseMutation.isPending}
              data-testid="button-confirm-decline">
              {declineDisburseMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Declining...</> : <><XCircle className="w-4 h-4 mr-2" />Confirm Decline</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan action dialog */}
      <Dialog open={loanDialog.open} onOpenChange={open => !open && setLoanDialog({ open: false, loan: null, action: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{loanDialog.action === "active" ? "Approve & Disburse Loan" : "Reject Loan Application"}</DialogTitle>
            <DialogDescription>
              {loanDialog.action === "active" ? "Funds will be credited to the user's wallet immediately." : "The applicant will be notified of this decision."}
            </DialogDescription>
          </DialogHeader>
          {loanDialog.loan && (
            <div className="bg-slate-50 border rounded-2xl p-5 my-2 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-slate-500">Applicant</span><span className="font-semibold text-sm">{loanDialog.loan.user?.firstName} {loanDialog.loan.user?.lastName}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Role</span><Badge variant="outline" className="text-xs capitalize">{loanDialog.loan.userRole}</Badge></div>
              <div className="flex justify-between border-t pt-3"><span className="text-sm text-slate-500">Loan Amount</span><span className="text-2xl font-bold">{fmtUSD(loanDialog.loan.amountUsd)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Term / Rate</span><span className="text-sm">{loanDialog.loan.termMonths} months at {loanDialog.loan.interestRate}%</span></div>
              <div className="flex justify-between"><span className="text-sm text-slate-500">Total Repayable</span><span className="font-semibold text-sm">{fmtUSD(loanDialog.loan.totalPayableUsd)}</span></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLoanDialog({ open: false, loan: null, action: "" })}>Cancel</Button>
            <Button
              className={loanDialog.action === "active" ? "bg-tsia-green hover:bg-tsia-green/90" : ""}
              variant={loanDialog.action === "rejected" ? "destructive" : "default"}
              disabled={loanStatusMutation.isPending}
              onClick={() => loanStatusMutation.mutate({ id: loanDialog.loan?.id, status: loanDialog.action })}
              data-testid={`button-loan-${loanDialog.action}`}
            >
              {loanStatusMutation.isPending ? "Processing..." : loanDialog.action === "active" ? "Approve & Credit Wallet" : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit wallet balance dialog */}
      <Dialog open={editBalanceDialog.open} onOpenChange={open => { if (!open) { setEditBalanceDialog({ open: false, user: null }); setEditBalanceAmount(""); setEditBalanceNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Wallet Balance</DialogTitle>
            <DialogDescription>Set the wallet balance directly for this user. This will override the current balance.</DialogDescription>
          </DialogHeader>
          {editBalanceDialog.user && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 border rounded-xl p-3 text-sm">
                <strong>{editBalanceDialog.user.firstName} {editBalanceDialog.user.lastName}</strong>
                <p className="text-slate-500 text-xs mt-0.5">{editBalanceDialog.user.email} · Current balance: {fmtUSD(editBalanceDialog.user.wallet?.balance)}</p>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">New Balance (USD) <span className="text-red-400">*</span></Label>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 150.00" className="h-10 bg-muted/30" value={editBalanceAmount} onChange={e => setEditBalanceAmount(e.target.value)} data-testid="input-edit-balance" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Note (optional)</Label>
                <Input placeholder="Reason for adjustment" className="h-10 bg-muted/30" value={editBalanceNote} onChange={e => setEditBalanceNote(e.target.value)} data-testid="input-edit-balance-note" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditBalanceDialog({ open: false, user: null }); setEditBalanceAmount(""); setEditBalanceNote(""); }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!editBalanceAmount || editBalanceMutation.isPending} onClick={() => editBalanceMutation.mutate({ id: editBalanceDialog.user?.id, balance: editBalanceAmount, note: editBalanceNote })} data-testid="button-confirm-edit-balance">
              {editBalanceMutation.isPending ? "Updating..." : <><Edit className="w-4 h-4 mr-2" /> Set Balance</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Credit dialog */}
      <Dialog open={manualCreditOpen} onOpenChange={open => { if (!open) { setManualCreditOpen(false); setMcUserId(""); setMcAmount(""); setMcReference(""); setMcNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Payment Credit</DialogTitle>
            <DialogDescription>Credit a user's wallet for a Korapay/Squad payment that wasn't automatically applied. The full 100% is credited — no deductions at deposit time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>User ID</strong> — find it in the All Users table above (e.g. <code>26</code> for Ekong Friday). <strong>Gross amount</strong> is the full USD equivalent of what was paid.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">User ID <span className="text-red-400">*</span></Label>
                <Input type="number" min="1" placeholder="e.g. 26" className="h-10 bg-muted/30" value={mcUserId} onChange={e => setMcUserId(e.target.value)} data-testid="input-mc-userid" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Gross Amount (USD) <span className="text-red-400">*</span></Label>
                <Input type="number" min="0.01" step="0.01" placeholder="e.g. 10.00" className="h-10 bg-muted/30" value={mcAmount} onChange={e => setMcAmount(e.target.value)} data-testid="input-mc-amount" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Payment Reference (optional)</Label>
              <Input placeholder="e.g. TSIA-KORA-26-1234567890 or from Korapay dashboard" className="h-10 bg-muted/30 font-mono text-sm" value={mcReference} onChange={e => setMcReference(e.target.value)} data-testid="input-mc-reference" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Note (optional)</Label>
              <Input placeholder="e.g. Korapay payment confirmed by admin" className="h-10 bg-muted/30" value={mcNote} onChange={e => setMcNote(e.target.value)} data-testid="input-mc-note" />
            </div>
            {mcAmount && parseFloat(mcAmount) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 space-y-0.5">
                <p>Amount to credit: <strong>${parseFloat(mcAmount).toFixed(2)}</strong> (100% — no deductions at deposit)</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setManualCreditOpen(false); setMcUserId(""); setMcAmount(""); setMcReference(""); setMcNote(""); }}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!mcUserId || !mcAmount || manualCreditMutation.isPending}
              onClick={() => manualCreditMutation.mutate({ userId: mcUserId, amountUsd: mcAmount, reference: mcReference, note: mcNote })}
              data-testid="btn-confirm-manual-credit"
            >
              {manualCreditMutation.isPending ? "Crediting..." : "Credit Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit affiliate dialog */}
      <Dialog open={creditAffiliateDialog.open} onOpenChange={open => { if (!open) { setCreditAffiliateDialog({ open: false, affiliate: null }); setCreditAmount(""); setCreditNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit Affiliate Wallet</DialogTitle>
            <DialogDescription>Add funds directly to this affiliate's wallet. Amount is added to current balance.</DialogDescription>
          </DialogHeader>
          {creditAffiliateDialog.affiliate && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 border rounded-xl p-3 text-sm">
                <strong>{creditAffiliateDialog.affiliate.firstName} {creditAffiliateDialog.affiliate.lastName}</strong>
                <p className="text-slate-500 text-xs mt-0.5">{creditAffiliateDialog.affiliate.email} · Current balance: {fmtUSD(creditAffiliateDialog.affiliate.wallet?.balance)}</p>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Credit Amount (USD) <span className="text-red-400">*</span></Label>
                <Input type="number" min="0.01" step="0.01" placeholder="e.g. 50.00" className="h-10 bg-muted/30" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} data-testid="input-credit-amount" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Note (optional)</Label>
                <Input placeholder="e.g. Bonus payout, correction" className="h-10 bg-muted/30" value={creditNote} onChange={e => setCreditNote(e.target.value)} data-testid="input-credit-note" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreditAffiliateDialog({ open: false, affiliate: null }); setCreditAmount(""); setCreditNote(""); }}>Cancel</Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90" disabled={!creditAmount || parseFloat(creditAmount) <= 0 || creditAffiliateMutation.isPending} onClick={() => creditAffiliateMutation.mutate({ id: creditAffiliateDialog.affiliate?.id, amount: creditAmount, note: creditNote })} data-testid="button-confirm-credit">
              {creditAffiliateMutation.isPending ? "Crediting..." : <><PlusCircle className="w-4 h-4 mr-2" /> Credit Wallet</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user account dialog */}
      <Dialog open={editUserDialog.open} onOpenChange={open => { if (!open) { setEditUserDialog({ open: false, user: null }); setEditUserEmail(""); setEditUserFirst(""); setEditUserLast(""); setEditUserPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Account</DialogTitle>
            <DialogDescription>Update the user's name, email, or set a new password. Leave fields unchanged to keep their current values.</DialogDescription>
          </DialogHeader>
          {editUserDialog.user && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 border rounded-xl p-3 text-sm">
                <strong>{editUserDialog.user.firstName} {editUserDialog.user.lastName}</strong>
                <p className="text-slate-500 text-xs mt-0.5">{editUserDialog.user.email} · <span className="capitalize">{editUserDialog.user.role}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">First Name</Label>
                  <Input placeholder="First name" className="h-10 bg-muted/30" value={editUserFirst} onChange={e => setEditUserFirst(e.target.value)} data-testid="input-edit-user-first" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Last Name</Label>
                  <Input placeholder="Last name" className="h-10 bg-muted/30" value={editUserLast} onChange={e => setEditUserLast(e.target.value)} data-testid="input-edit-user-last" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Email Address</Label>
                <Input type="email" placeholder="user@email.com" className="h-10 bg-muted/30" value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} data-testid="input-edit-user-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">New Password <span className="text-slate-400 font-normal text-xs">(leave blank to keep unchanged)</span></Label>
                <Input type="password" placeholder="Min. 8 characters" className="h-10 bg-muted/30" value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} data-testid="input-edit-user-password" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditUserDialog({ open: false, user: null }); setEditUserEmail(""); setEditUserFirst(""); setEditUserLast(""); setEditUserPassword(""); }}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={editUserMutation.isPending}
              onClick={() => editUserMutation.mutate({
                id: editUserDialog.user?.id,
                email: editUserEmail || undefined,
                firstName: editUserFirst || undefined,
                lastName: editUserLast || undefined,
                newPassword: editUserPassword || undefined,
              })}
              data-testid="button-confirm-edit-user"
            >
              {editUserMutation.isPending ? "Saving..." : <><Edit className="w-4 h-4 mr-2" /> Save Changes</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirm dialog */}
      <Dialog open={deleteUserDialog.open} onOpenChange={open => { if (!open) setDeleteUserDialog({ open: false, user: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Account</DialogTitle>
            <DialogDescription>This will permanently delete the user and all their data. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteUserDialog.user && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm space-y-1 my-2">
              <p className="font-semibold text-red-800">{deleteUserDialog.user.firstName} {deleteUserDialog.user.lastName}</p>
              <p className="text-red-600">{deleteUserDialog.user.email}</p>
              <p className="text-red-500 text-xs">Wallet balance: {fmtUSD(deleteUserDialog.user.wallet?.balance)}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUserDialog({ open: false, user: null })}>Cancel</Button>
            <Button variant="destructive" disabled={deleteUserMutation.isPending} onClick={() => deleteUserMutation.mutate(deleteUserDialog.user?.id)} data-testid="button-confirm-delete-user">
              {deleteUserMutation.isPending ? "Deleting..." : <><Trash2 className="w-4 h-4 mr-2" /> Permanently Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Referrer dialog */}
      <Dialog open={setReferrerDialog.open} onOpenChange={open => { if (!open) { setSetReferrerDialog({ open: false, user: null }); setReferrerCode(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4 text-purple-600" /> Set Referral Source</DialogTitle>
            <DialogDescription>Manually assign which affiliate referred this user. Runs the back-fill after saving.</DialogDescription>
          </DialogHeader>
          {setReferrerDialog.user && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm space-y-0.5 my-2">
              <p className="font-semibold text-purple-900">{setReferrerDialog.user.firstName} {setReferrerDialog.user.lastName}</p>
              <p className="text-purple-700 text-xs">{setReferrerDialog.user.email}</p>
              {setReferrerDialog.user.referredBy && <p className="text-purple-600 text-xs mt-1">Currently: <strong>{setReferrerDialog.user.referredBy}</strong></p>}
            </div>
          )}
          <div className="space-y-2">
            <Label>Affiliate Code of Referrer</Label>
            <Input
              placeholder="e.g. TSIA-EMM0007"
              value={referrerCode}
              onChange={e => setReferrerCode(e.target.value.toUpperCase())}
              className="font-mono"
              data-testid="input-referrer-code"
            />
            <p className="text-xs text-muted-foreground">Enter the affiliate code of the person who referred this user. After saving, go to Affiliates → "Run Back-fill Now" to credit any owed commissions.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSetReferrerDialog({ open: false, user: null }); setReferrerCode(""); }}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!referrerCode.trim() || setReferrerMutation.isPending}
              onClick={() => setReferrerMutation.mutate({ id: setReferrerDialog.user?.id, affiliateCode: referrerCode.trim() })}
              data-testid="button-confirm-set-referrer"
            >
              {setReferrerMutation.isPending ? "Saving..." : "Save Referral Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify individual user dialog */}
      <Dialog open={notifyDialog && !!notifyTarget} onOpenChange={open => { if (!open) { setNotifyDialog(false); setNotifyTarget(null); setNotifyTitle(""); setNotifyMsg(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>Send a direct notification to {notifyTarget?.firstName} {notifyTarget?.lastName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 border rounded-xl p-3 text-sm">
              <strong>{notifyTarget?.firstName} {notifyTarget?.lastName}</strong>
              <p className="text-slate-500 text-xs mt-0.5">{notifyTarget?.email} · <span className="capitalize">{notifyTarget?.role}</span></p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Title</Label>
              <Input placeholder="Notification title" className="h-10 bg-muted/30" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Message</Label>
              <Textarea placeholder="Your message here..." className="bg-muted/30 resize-none min-h-[80px]" value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setNotifyDialog(false); setNotifyTarget(null); setNotifyTitle(""); setNotifyMsg(""); }}>Cancel</Button>
            <Button disabled={!notifyTitle || !notifyMsg || notifyMutation.isPending} onClick={() => notifyMutation.mutate()}>
              <Send className="w-4 h-4 mr-2" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
