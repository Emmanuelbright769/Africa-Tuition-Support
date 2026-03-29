import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BotMessageSquare, MessageSquare, Wallet, TrendingUp, FileCheck, Users, Package, Info, Trash2, CheckCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

type NotifType =
  | "bot_reminder" | "chat_message" | "order_update" | "wallet_credit"
  | "loan_update"  | "verification_update" | "referral" | "trade_deposit" | "system";

interface Notification {
  id: number; userId: number; type: NotifType;
  title: string; message: string; data: any;
  isRead: boolean; createdAt: string;
}
interface NotifResponse { notifications: Notification[]; unreadCount: number; }

const TYPE_META: Record<NotifType, { icon: any; color: string; bg: string; accent: string }> = {
  bot_reminder:        { icon: BotMessageSquare, color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/40",   accent: "border-l-amber-400" },
  chat_message:        { icon: MessageSquare,    color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/40",     accent: "border-l-blue-400" },
  order_update:        { icon: Package,          color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/40", accent: "border-l-purple-400" },
  wallet_credit:       { icon: Wallet,           color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/40",   accent: "border-l-green-500" },
  loan_update:         { icon: FileCheck,        color: "text-teal-600",   bg: "bg-teal-100 dark:bg-teal-900/40",     accent: "border-l-teal-400" },
  verification_update: { icon: FileCheck,        color: "text-tsia-green", bg: "bg-green-100 dark:bg-green-900/40",   accent: "border-l-tsia-green" },
  referral:            { icon: Users,            color: "text-pink-600",   bg: "bg-pink-100 dark:bg-pink-900/40",     accent: "border-l-pink-400" },
  trade_deposit:       { icon: TrendingUp,       color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/40", accent: "border-l-indigo-400" },
  system:              { icon: Info,             color: "text-slate-500",  bg: "bg-slate-100 dark:bg-slate-800",      accent: "border-l-slate-400" },
};

function NotifItem({ n }: { n: Notification }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;
  return (
    <div className={cn(
      "flex gap-4 px-5 py-4 border-l-4 transition-colors",
      meta.accent,
      !n.isRead ? "bg-primary/5" : "bg-transparent"
    )}>
      <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", meta.bg)}>
        <Icon className={cn("w-5 h-5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-bold leading-snug", !n.isRead ? "text-foreground" : "text-muted-foreground")}>{n.title}</p>
          {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-tsia-green shrink-0 mt-1" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
        <p className="text-xs text-muted-foreground/60 mt-1.5">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery<NotifResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all").then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const clearAll = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/notifications").then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notifications"] }); },
  });

  // Lock scroll when full-screen is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    if (unread > 0) setTimeout(() => markRead.mutate(), 600);
  };

  // Group by date
  const grouped: { label: string; items: Notification[] }[] = [];
  notifications.forEach(n => {
    const d = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const label =
      d.toDateString() === today.toDateString() ? "Today" :
      d.toDateString() === yesterday.toDateString() ? "Yesterday" :
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const g = grouped.find(g => g.label === label);
    if (g) g.items.push(n); else grouped.push({ label, items: [n] });
  });

  return (
    <>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        data-testid="button-notification-bell"
        className={cn("relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors", className)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md"
              data-testid="badge-unread-count">
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Full-screen overlay ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-fullscreen"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-[9999] bg-background flex flex-col"
            data-testid="panel-notifications-fullscreen"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0 safe-area-top">
              <button onClick={() => setOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-tsia-green" />
                <span className="font-bold text-base">Notifications</span>
                {unread > 0 && (
                  <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full h-auto">
                    {unread} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={() => markRead.mutate()}
                    className="flex items-center gap-1 text-xs text-tsia-green font-semibold px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                    title="Mark all read">
                    <CheckCheck className="w-3.5 h-3.5" /> Read all
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={() => clearAll.mutate()}
                    className="flex items-center gap-1 text-xs text-red-500 font-semibold px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                    title="Clear all">
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-none">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
                    <Bell className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                  <p className="font-bold text-lg text-muted-foreground">All caught up!</p>
                  <p className="text-sm text-muted-foreground/60 mt-2 leading-relaxed">
                    Activity across your wallet, trades, orders, chats and referrals will show up here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {grouped.map(group => (
                    <div key={group.label}>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 bg-muted/30 sticky top-0 z-10">
                        {group.label}
                      </p>
                      {group.items.map(n => <NotifItem key={n.id} n={n} />)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
