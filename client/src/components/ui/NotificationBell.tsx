import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BotMessageSquare, MessageSquare, Wallet, TrendingUp, FileCheck, Users, ShoppingBag, Package, Info, Trash2, CheckCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

type NotifType =
  | "bot_reminder" | "chat_message" | "order_update" | "wallet_credit"
  | "loan_update"  | "verification_update" | "referral" | "trade_deposit" | "system";

interface Notification {
  id: number;
  userId: number;
  type: NotifType;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

interface NotifResponse {
  notifications: Notification[];
  unreadCount: number;
}

const TYPE_META: Record<NotifType, { icon: any; color: string; bg: string }> = {
  bot_reminder:        { icon: BotMessageSquare, color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  chat_message:        { icon: MessageSquare,    color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  order_update:        { icon: Package,          color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
  wallet_credit:       { icon: Wallet,           color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30" },
  loan_update:         { icon: FileCheck,        color: "text-teal-600",   bg: "bg-teal-100 dark:bg-teal-900/30" },
  verification_update: { icon: FileCheck,        color: "text-tsia-green", bg: "bg-green-100 dark:bg-green-900/30" },
  referral:            { icon: Users,            color: "text-pink-600",   bg: "bg-pink-100 dark:bg-pink-900/30" },
  trade_deposit:       { icon: TrendingUp,       color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  system:              { icon: Info,             color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-800" },
};

function NotifItem({ n, onRead }: { n: Notification; onRead?: () => void }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-default",
        !n.isRead && "bg-primary/5"
      )}
      onClick={onRead}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
        <Icon className={cn("w-4 h-4", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold leading-snug", !n.isRead && "text-foreground")}>{n.title}</p>
          {!n.isRead && <span className="w-2 h-2 rounded-full bg-tsia-green shrink-0 mt-1.5" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notifications"] }); setOpen(false); },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Mark all read when opening
  const handleOpen = () => {
    setOpen(prev => !prev);
    if (!open && unread > 0) {
      setTimeout(() => markRead.mutate(), 800);
    }
  };

  return (
    <div className={cn("relative", className)} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        data-testid="button-notification-bell"
        className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md"
              data-testid="badge-unread-count"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-24px)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
            data-testid="panel-notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-tsia-green" />
                <span className="font-semibold text-sm text-foreground">Notifications</span>
                {unread > 0 && (
                  <Badge variant="default" className="bg-red-500 hover:bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full h-auto">
                    {unread} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => markRead.mutate()}
                    className="text-xs text-muted-foreground hover:text-tsia-green flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => clearAll.mutate()}
                    className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors ml-1">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[420px] scrollbar-none divide-y divide-border/50">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    <Bell className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">All caught up</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">New activity will appear here</p>
                </div>
              ) : (
                notifications.map(n => (
                  <NotifItem key={n.id} n={n} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
