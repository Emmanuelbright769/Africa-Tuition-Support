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
  Banknote, Copy, Phone, ThumbsUp, ThumbsDown, Settings, Save, Percent
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
  { id: "ecommerce",     icon: ShoppingBag,    label: "E-commerce" },
  { id: "trade",         icon: BarChart2,      label: "Trade Market" },
  { id: "deposits",      icon: Coins,          label: "Deposits" },
  { id: "withdrawals",  icon: Banknote,       label: "Bank W/D",      badgeKey: "pendingWithdrawals" },
  { id: "crypto_withdrawals", icon: Coins,    label: "Crypto W/D",    badgeKey: "pendingCryptoWd" },
  { id: "reserve",      icon: ShieldCheck,    label: "Str. Reserve" },
  { id: "trustfunders", icon: Award,          label: "Trust Funders" },
  { id: "messages",     icon: MessageSquare,  label: "Forum Messages" },
  { id: "notifications", icon: Bell,          label: "Notifications" },
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
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<any>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyRole, setNotifyRole] = useState("all");
  const [txFilter, setTxFilter] = useState("all");
  const [editBalanceDialog, setEditBalanceDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editBalanceAmount, setEditBalanceAmount] = useState("");
  const [editBalanceNote, setEditBalanceNote] = useState("");
  const [creditAffiliateDialog, setCreditAffiliateDialog] = useState<{ open: boolean; affiliate: any }>({ open: false, affiliate: null });
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [setReferrerDialog, setSetReferrerDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [referrerCode, setReferrerCode] = useState("");
  // Withdrawal review state
  const [wdFilter, setWdFilter] = useState<"all" | "pending" | "approved" | "declined" | "refunded">("all");
  const [cwdFilter, setCwdFilter] = useState<"all" | "pending" | "approved" | "declined" | "refunded">("all");
  const [wdNoteDialogId, setWdNoteDialogId] = useState<number | null>(null);
  const [wdNote, setWdNote]               = useState("");
  const [settingsForm, setSettingsForm]   = useState({ plan1yr: "", plan2yr: "", plan3yr: "", serviceChargeRate: "", silverMin: "", silverMax: "", goldMin: "", goldMax: "", platinumMin: "", platinumMax: "" });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [wdAction, setWdAction]           = useState<"approve" | "decline" | null>(null);
  const [wdCopied, setWdCopied]           = useState<string | null>(null);

  const { user, logout, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: stats }                   = useQuery({ queryKey: ["/api/admin/enhanced-stats"] });
  const { data: pendingVerifications = [] } = useQuery({ queryKey: ["/api/admin/pending-verifications"] });
  const { data: pendingDisbursements = [] } = useQuery({ queryKey: ["/api/admin/pending-disbursements"] });
  const { data: allUsers = [] }            = useQuery({ queryKey: ["/api/admin/all-users"], enabled: activeTab === "users" });
  const { data: allAffiliates = [] }       = useQuery({ queryKey: ["/api/admin/affiliates-all"], enabled: activeTab === "affiliates" });
  const { data: allLoans = [] }            = useQuery({ queryKey: ["/api/admin/loans-all"], enabled: activeTab === "loans" });
  const { data: allTransactions = [] }     = useQuery({ queryKey: ["/api/admin/transactions-all"], enabled: activeTab === "transactions" });
  const { data: ecommerceStats }           = useQuery({ queryKey: ["/api/admin/ecommerce-stats"], enabled: activeTab === "ecommerce" });
  const { data: tradeStats }               = useQuery({ queryKey: ["/api/admin/trade-stats"], enabled: activeTab === "trade" });
  const { data: allDeposits = [] }         = useQuery({ queryKey: ["/api/admin/wallet-deposits"], enabled: activeTab === "deposits" });
  const { data: allMessages = [] }         = useQuery({ queryKey: ["/api/admin/messages"], enabled: activeTab === "messages" });
  const { data: reserveFundData }          = useQuery({ queryKey: ["/api/reserve-fund/live"], enabled: activeTab === "reserve" });
  const { data: reserveProfitData }        = useQuery({ queryKey: ["/api/reserve-fund/commission-profits"], enabled: activeTab === "reserve" });
  const { data: allTrustFunders = [] }     = useQuery({ queryKey: ["/api/admin/co-affiliates"], enabled: activeTab === "trustfunders" });
  const { data: referralsData }            = useQuery({ queryKey: ["/api/admin/referrals-all"], enabled: activeTab === "referrals" });
  const { data: allWithdrawals = [], refetch: refetchWithdrawals } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawals"], refetchInterval: 30000 });
  const { data: platformSettingsData, refetch: refetchPlatformSettings } = useQuery<{ prices: { plan1yr: number; plan2yr: number; plan3yr: number; serviceChargeRate: number }; tiers: { silver: { min: number; max: number }; gold: { min: number; max: number }; platinum: { min: number; max: number } } }>({ queryKey: ["/api/admin/platform-settings"], enabled: activeTab === "settings" });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: number; approve: boolean; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/verify/${id}`, { approve, reason });
      return res.json();
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      setReviewDialog(null);
      setRejectDialog({ open: false, verification: null });
      setRejectReason("");
      toast({ title: approve ? "Student Approved ✓" : "Application Rejected", description: approve ? "Verification approved. Wallet funding pending disbursement." : "Application rejected and student notified." });
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/process-disbursement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      setDisburseDialog(null);
      toast({ title: "Payout Processed ✓", description: "Funds credited to student wallet successfully." });
    },
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

  const wdActionMutation = useMutation({
    mutationFn: async ({ id, action, adminNote }: { id: number; action: "approve" | "decline"; adminNote: string }) => {
      const res = await apiRequest("POST", `/api/admin/withdrawals/${id}/${action}`, { adminNote });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      return d;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      setWdNoteDialogId(null); setWdNote(""); setWdAction(null);
      toast({ title: action === "approve" ? "Withdrawal Approved ✓" : "Withdrawal Declined & Refunded", description: action === "approve" ? "User notified by email and in-app." : "Funds refunded to user's wallet. Email sent." });
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

  const confirmDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/wallet-deposit/${id}/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enhanced-stats"] });
      toast({ title: "Deposit Confirmed ✓", description: "Wallet funded and user notified." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
  });

  const declineDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/wallet-deposit/${id}/decline`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-deposits"] });
      toast({ title: "Deposit Declined", description: "User has been notified." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
  });

  const pendingDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/wallet-deposit/${id}/pending`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet-deposits"] });
      toast({ title: "Reverted to Pending", description: "Deposit is now pending review." });
    },
    onError: (e: any) => { toast({ variant: "destructive", title: "Error", description: e.message }); },
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

  if (authLoading || (!user && !authLoading)) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-tsia-green border-t-transparent rounded-full" /></div>;

  const handleLogout = async () => { await logout(); setLocation("/"); };

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
  const filteredVerifications = (pendingVerifications as any[]).filter(v =>
    !q || `${v.user?.firstName} ${v.user?.lastName} ${v.user?.email} ${v.nin}`.toLowerCase().includes(q)
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
    pendingWithdrawals: (allWithdrawals as any[]).filter((w: any) => w.status === "pending" && w.type === "bank").length,
    pendingCryptoWd: (allWithdrawals as any[]).filter((w: any) => w.status === "pending" && w.type === "crypto").length,
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
    <div className="min-h-screen bg-slate-50 font-sans flex">
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
                  <StatCard title="E-commerce Commission" value={fmtUSD(stats?.totalEcommerceCommission)}  icon={ShoppingBag}  color="blue"  />
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
              <motion.div key="applications" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Verification Queue</CardTitle>
                    <CardDescription>{(pendingVerifications as any[]).length} applications pending review</CardDescription>
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
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVerifications.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">No pending applications.</TableCell></TableRow>
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
                            <TableCell className="text-right px-6">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewDialog(v)} data-testid={`button-review-${v.id}`}>
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Review
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
                            <TableCell className="font-bold text-slate-900">{fmtUSD(d.amount)}</TableCell>
                            <TableCell className="text-sm text-slate-600">{fmtDate(d.createdAt)}</TableCell>
                            <TableCell className="text-right px-6">
                              <Button size="sm" className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90" onClick={() => setDisburseDialog(d)} data-testid={`button-process-${d.id}`}>
                                Process
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
              <motion.div key="users" variants={slide} initial="hidden" animate="visible" exit="exit">
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
                      Credits any owed 5% referral commissions to affiliates whose referred users have activated wallets but never received commissions.
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
              </motion.div>
            )}

            {/* ═══════════════════════════════ TRADE MARKET ═══════════════════════════════ */}
            {activeTab === "trade" && (
              <motion.div key="trade" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Reserve Fund"    value={fmtUSD(tradeStats?.reserveBalance)}  icon={Wallet}     color="green"  />
                  <StatCard title="Total Deposited" value={fmtUSD(tradeStats?.totalDeposited)}  icon={TrendingUp} color="blue"   />
                  <StatCard title="Bot Earnings"    value={fmtUSD(tradeStats?.totalBotEarnings)}icon={BarChart2}  color="tsia"   />
                  <StatCard title="Active Affiliates" value={tradeStats?.affiliateCount ?? 0}   icon={Share2}     color="purple" />
                </div>
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
                            <TableCell className={`font-bold text-sm ${parseFloat(t.amount) >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {fmtUSD(t.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">{t.description || "—"}</TableCell>
                            <TableCell className="text-xs text-slate-500">{fmtDate(t.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══════════════════════════════ DEPOSITS ═══════════════════════════════ */}
            {activeTab === "deposits" && (
              <motion.div key="deposits" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base">Wallet Deposits</CardTitle>
                    <CardDescription>All crypto and fiat deposits. Approve pending crypto deposits here.</CardDescription>
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
                                {d.status === "pending" && (<>
                                  <Button size="sm" className="h-7 text-xs bg-tsia-green hover:bg-tsia-green/90" disabled={confirmDepositMutation.isPending} onClick={() => confirmDepositMutation.mutate(d.id)} data-testid={`button-confirm-deposit-${d.id}`}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Confirm
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" disabled={declineDepositMutation.isPending} onClick={() => declineDepositMutation.mutate(d.id)} data-testid={`button-decline-deposit-${d.id}`}>
                                    <XCircle className="w-3 h-3 mr-1" /> Decline
                                  </Button>
                                </>)}
                                {d.status === "declined" && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pendingDepositMutation.isPending} onClick={() => pendingDepositMutation.mutate(d.id)} data-testid={`button-pending-deposit-${d.id}`}>
                                    <Clock className="w-3 h-3 mr-1" /> Pending
                                  </Button>
                                )}
                                {d.status === "completed" && (
                                  <span className="text-xs text-slate-400 italic mr-1">Confirmed</span>
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

            {/* ═══════════════════════════ BANK WITHDRAWALS ═══════════════════════════ */}
            {activeTab === "withdrawals" && (
              <motion.div key="withdrawals" variants={slide} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Bank", value: (allWithdrawals as any[]).filter((w: any) => w.type === "bank").length, color: "text-slate-700" },
                    { label: "Pending", value: (allWithdrawals as any[]).filter((w: any) => w.type === "bank" && w.status === "pending").length, color: "text-amber-600" },
                    { label: "Approved", value: (allWithdrawals as any[]).filter((w: any) => w.type === "bank" && w.status === "approved").length, color: "text-tsia-green" },
                  ].map(s => (
                    <Card key={s.label} className="p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>

                {/* Filter + Cards */}
                {(() => {
                  const filtered = (allWithdrawals as any[]).filter((w: any) => w.type === "bank" && (wdFilter === "all" || w.status === wdFilter));
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
                                    <Badge variant="outline" className="text-[10px]">{wd.type === "bank" ? "Bank NGN" : "USDT Crypto"}</Badge>
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

                              {/* Bank details */}
                              {wd.type === "bank" && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-sm space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">Bank</span>
                                    <span className="font-semibold text-xs">{wd.bankName}</span>
                                  </div>
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
                                    <span className="text-muted-foreground text-xs">VAT</span>
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

                              {/* Action buttons (pending only) */}
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
                                    <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Decline & Refund
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Note/Confirm Dialog */}
                      <Dialog open={wdNoteDialogId !== null} onOpenChange={open => { if (!open) { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); } }}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>{wdAction === "approve" ? "Approve Withdrawal" : "Decline & Refund Withdrawal"}</DialogTitle>
                            <DialogDescription>
                              {wdAction === "approve"
                                ? "Confirm you have manually transferred the funds. The user will be notified."
                                : "This will refund the full amount back to the user's TSIA wallet and send them an email."}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Admin Note (optional)</Label>
                              <Textarea
                                placeholder={wdAction === "approve" ? "e.g. Transferred via Opay at 2:30PM" : "e.g. Incorrect account details"}
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
                              className={wdAction === "approve" ? "bg-tsia-green hover:bg-tsia-green/90" : ""}
                              variant={wdAction === "decline" ? "destructive" : "default"}
                              disabled={wdActionMutation.isPending}
                              onClick={() => wdActionMutation.mutate({ id: wdNoteDialogId!, action: wdAction!, adminNote: wdNote })}
                              data-testid="btn-confirm-wd-action"
                            >
                              {wdActionMutation.isPending ? "Processing…" : wdAction === "approve" ? "Confirm Approval" : "Confirm Decline & Refund"}
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
                                  <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Decline & Refund
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
                          <DialogTitle>{wdAction === "approve" ? "Approve Crypto Withdrawal" : "Decline & Refund"}</DialogTitle>
                          <DialogDescription>
                            {wdAction === "approve" ? "Confirm you have sent the USDT. The user will be notified." : "This will refund the full amount back to the user's wallet."}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Admin Note (optional)</Label>
                            <Textarea placeholder={wdAction === "approve" ? "e.g. Sent via TRC-20 at 3PM" : "e.g. Invalid address"} value={wdNote} onChange={e => setWdNote(e.target.value)} className="mt-1.5 h-20 text-sm" />
                          </div>
                        </div>
                        <DialogFooter className="gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setWdNoteDialogId(null); setWdNote(""); setWdAction(null); }}>Cancel</Button>
                          <Button size="sm" className={wdAction === "approve" ? "bg-tsia-green hover:bg-tsia-green/90" : ""} variant={wdAction === "decline" ? "destructive" : "default"} disabled={wdActionMutation.isPending}
                            onClick={() => wdActionMutation.mutate({ id: wdNoteDialogId!, action: wdAction!, adminNote: wdNote })}>
                            {wdActionMutation.isPending ? "Processing…" : wdAction === "approve" ? "Confirm Approval" : "Confirm Decline"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>);
                })()}
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
                    <CardDescription>E-commerce commissions + withdrawal fees, minus affiliate pool payouts</CardDescription>
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
              <motion.div key="trustfunders" variants={slide} initial="hidden" animate="visible" exit="exit">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-white py-4 px-6">
                    <CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Trust Funders (Co-Affiliates)</CardTitle>
                    <CardDescription>{(allTrustFunders as any[]).length} registered trust funders — investors backing the affiliate programme</CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Name / Email</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Tier</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Invested</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Share %</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</TableHead>
                          <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide">Joined</TableHead>
                          <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allTrustFunders as any[]).length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500">No trust funders yet.</TableCell></TableRow>
                        ) : (allTrustFunders as any[]).map((tf: any) => {
                          const tier = tf.investmentCategory >= 500 ? "Elite" : tf.investmentCategory >= 300 ? "Growth" : "Starter";
                          const tierColor = tier === "Elite" ? "bg-slate-800 text-white" : tier === "Growth" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200";
                          const isActive = tf.status === "active";
                          return (
                            <TableRow key={tf.id} className="hover:bg-slate-50/50">
                              <TableCell className="px-6">
                                <p className="font-medium text-sm text-slate-900">{tf.userName}</p>
                                <p className="text-xs text-slate-500">{tf.userEmail}</p>
                              </TableCell>
                              <TableCell><Badge variant="outline" className={`text-xs ${tierColor}`}>{tier}</Badge></TableCell>
                              <TableCell className="font-bold text-sm">{fmtUSD(tf.amountPaid)}</TableCell>
                              <TableCell className="text-sm font-mono">{parseFloat(tf.sharePercentage).toFixed(4)}%</TableCell>
                              <TableCell><StatusBadge status={tf.status} /></TableCell>
                              <TableCell className="text-xs text-slate-500">{fmtDate(tf.createdAt)}</TableCell>
                              <TableCell className="text-right px-6">
                                <div className="flex items-center justify-end gap-1">
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
                          <CardTitle className="text-base">Sponsorship Plan Prices</CardTitle>
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
                <div className="flex flex-wrap gap-2">
                  {reviewDialog.waecSubjects?.split(",").map((sub: string, i: number) => {
                    const gradesList = reviewDialog.waecGrades?.split(" ") || [];
                    return (
                      <div key={i} className="bg-white border rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
                        <span className="text-slate-600">{sub.trim()}</span>
                        <span className="font-bold text-slate-900">{gradesList[i] || "—"}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <div><span className="text-xs text-slate-500">Score:</span> <span className="font-bold text-lg ml-1">{reviewDialog.waecPercentage ? `${reviewDialog.waecPercentage}%` : "—"}</span></div>
                  <TierBadge tier={reviewDialog.tier} />
                  {reviewDialog.tier !== "none" && <span className="text-sm font-semibold text-tsia-green">${reviewDialog.payoutMin}–${reviewDialog.payoutMax}</span>}
                </div>
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
            <Button variant="destructive" onClick={() => { setRejectDialog({ open: true, verification: reviewDialog }); setReviewDialog(null); }} disabled={verifyMutation.isPending}>
              <XCircle className="w-4 h-4 mr-2" /> Reject Application
            </Button>
            <Button className="bg-tsia-green hover:bg-tsia-green/90" onClick={() => verifyMutation.mutate({ id: reviewDialog.id, approve: true })} disabled={verifyMutation.isPending} data-testid="button-approve">
              {verifyMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Approving...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Verify</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={open => { if (!open) { setRejectDialog({ open: false, verification: null }); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide a reason for rejection. This will be sent to the student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 border rounded-xl p-3 text-sm">
              <strong>{rejectDialog.verification?.user?.firstName} {rejectDialog.verification?.user?.lastName}</strong>
              <p className="text-slate-500 text-xs mt-0.5">{rejectDialog.verification?.user?.email}</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Rejection Reason <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="e.g. WAEC registration number could not be verified. Please resubmit with the correct details."
                className="bg-muted/30 min-h-[100px] resize-none"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, verification: null }); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: rejectDialog.verification?.id, approve: false, reason: rejectReason })} data-testid="button-confirm-reject">
              {verifyMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process disbursement dialog */}
      <Dialog open={!!disburseDialog} onOpenChange={open => !open && setDisburseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payout Disbursement</DialogTitle>
            <DialogDescription>This will immediately credit funds to the student's wallet. This action cannot be undone.</DialogDescription>
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
