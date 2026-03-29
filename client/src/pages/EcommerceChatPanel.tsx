import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Send, X, MessageCircle, ShoppingBag, AlertTriangle, ChevronLeft, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OFFPLATFORM_PATTERNS } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────
type ChatMessage = {
  id: number; chatId: number; senderId: number;
  content: string; isFlagged: boolean; createdAt: string; senderName: string;
};
type Chat = {
  id: number; productId: number; buyerId: number; sellerId: number;
  createdAt: string; productTitle: string; otherPersonName: string;
  lastMessage?: string; unread: number;
};

// ── Off-platform detector (client-side, same rules as server) ────────────────
function detectOffPlatform(text: string): { detected: boolean; labels: string[] } {
  const labels: string[] = [];
  for (const { pattern, label } of OFFPLATFORM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      if (!labels.includes(label)) labels.push(label);
    }
    pattern.lastIndex = 0;
  }
  return { detected: labels.length > 0, labels };
}

// ── Bubble ───────────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const time = new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[78%] group`}>
        {!isOwn && (
          <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.senderName}</p>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm relative ${
          isOwn
            ? "bg-tsia-green text-white rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        } ${msg.isFlagged ? "border border-amber-400" : ""}`}>
          {msg.isFlagged && (
            <span className="text-amber-400 text-[10px] font-bold block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 inline" /> Off-platform content removed
            </span>
          )}
          <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          <p className={`text-[10px] mt-1 text-right ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>{time}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Chat Window ───────────────────────────────────────────────────────────────
function ChatWindow({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<{ labels: string[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${chat.id}/messages`],
    queryFn: async () => { const r = await apiRequest("GET", `/api/chats/${chat.id}/messages`); return r.json(); },
    refetchInterval: 3000, // poll every 3s for new messages
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const r = await apiRequest("POST", `/api/chats/${chat.id}/messages`, { content });
      return r.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chat.id}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Client-side off-platform check before sending
    const { detected, labels } = detectOffPlatform(trimmed);
    if (detected) {
      setWarning({ labels });
      return;
    }

    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isOwnMessage = (msg: ChatMessage) => msg.senderId === user?.id;

  // Quick-offer chips for negotiation
  const OFFER_CHIPS = ["Is this still available?", "Can you do a lower price?", "I'm interested — let's talk.", "Can you ship?", "Deal — I'll buy now via TSIA."];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-tsia-green/10 flex items-center justify-center font-bold text-tsia-green shrink-0">
          {chat.otherPersonName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{chat.otherPersonName}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> {chat.productTitle}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-tsia-green font-semibold bg-tsia-green/10 px-2 py-1 rounded-full">
          <Shield className="w-3 h-3" /> Secure
        </div>
      </div>

      {/* Platform notice */}
      <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 shrink-0">
        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
        All negotiations and transactions must be completed inside TSIA. Sharing contact details, external platforms or payment methods is not allowed.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-sm">Start the conversation</p>
            <p className="text-xs text-muted-foreground mt-1">Negotiate price, ask questions — all inside TSIA.</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} isOwn={isOwnMessage(msg)} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick reply chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 shrink-0 scrollbar-none">
        {OFFER_CHIPS.map(chip => (
          <button key={chip} onClick={() => setInput(chip)}
            className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted border border-border hover:border-tsia-green hover:text-tsia-green transition-colors whitespace-nowrap">
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 pb-3 pt-1 border-t shrink-0">
        <Input
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-2xl bg-muted/40 min-h-[44px]"
          data-testid="input-chat-message"
        />
        <Button size="icon" className="w-11 h-11 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 shrink-0"
          onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}
          data-testid="button-send-message">
          <Send className="w-4 h-4 text-white" />
        </Button>
      </div>

      {/* Off-platform warning dialog */}
      <Dialog open={!!warning} onOpenChange={() => setWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Message Blocked
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>Your message contains <strong>{warning?.labels.join(", ")}</strong>, which is not allowed on TSIA.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
                All negotiations, price agreements, and payments must be completed <strong>directly inside the TSIA platform</strong>. Sharing contact details, external apps, or payment methods is against our policy and protects both buyers and sellers.
              </div>
              <p className="text-sm text-muted-foreground">Please edit your message and remove the flagged content before sending.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full bg-tsia-green hover:bg-tsia-green/90" onClick={() => setWarning(null)}>
              Edit my message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Chats Inbox List ──────────────────────────────────────────────────────────
function ChatsInbox({ onOpen }: { onOpen: (chat: Chat) => void }) {
  const { data: chats = [], isLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/chats"); return r.json(); },
    refetchInterval: 10000,
  });

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-tsia-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (chats.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <MessageCircle className="w-14 h-14 text-muted-foreground/30 mb-4" />
      <p className="font-semibold">No conversations yet</p>
      <p className="text-sm text-muted-foreground mt-1">Browse the marketplace and start chatting with sellers to negotiate prices.</p>
    </div>
  );

  return (
    <div className="space-y-1 p-3">
      {chats.map(chat => (
        <button key={chat.id} onClick={() => onOpen(chat)} data-testid={`chat-row-${chat.id}`}
          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/60 transition-colors text-left">
          <div className="w-11 h-11 rounded-full bg-tsia-green/10 flex items-center justify-center font-bold text-tsia-green text-lg shrink-0">
            {chat.otherPersonName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <p className="font-semibold text-sm truncate">{chat.otherPersonName}</p>
              <p className="text-[10px] text-muted-foreground shrink-0 ml-2">
                {new Date(chat.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 shrink-0" /> {chat.productTitle}
            </p>
            {chat.lastMessage && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Main Export: EcommerceChatDrawer ─────────────────────────────────────────
// Slide-over panel for chats inbox + chat window
export function EcommerceChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  const handleClose = () => { setActiveChat(null); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={handleClose} />

          {/* Panel */}
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background z-50 shadow-2xl flex flex-col">

            {/* Panel header */}
            {!activeChat && (
              <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0">
                <MessageCircle className="w-5 h-5 text-tsia-green" />
                <h2 className="font-bold text-lg flex-1">Messages</h2>
                <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
              {activeChat
                ? <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />
                : <div className="flex-1 overflow-y-auto"><ChatsInbox onOpen={setActiveChat} /></div>
              }
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Hook: open chat for a specific product (used from product detail) ─────────
export function useProductChat(productId: number | null) {
  const [chatId, setChatId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const openChatMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/chats", { productId });
      return r.json() as Promise<{ id: number; productId: number; buyerId: number; sellerId: number; createdAt: string }>;
    },
    onSuccess: (chat) => { setChatId(chat.id); setChatOpen(true); },
  });

  const openChat = () => {
    if (!productId) return;
    openChatMutation.mutate();
  };

  return { openChat, chatId, chatOpen, setChatOpen, loading: openChatMutation.isPending };
}

// ── Inline Chat Modal (opened from product detail) ────────────────────────────
export function ProductChatModal({ productId, productTitle, sellerName, open, onClose }: {
  productId: number; productTitle: string; sellerName: string; open: boolean; onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chatId, setChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<{ labels: string[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialise / get chat as soon as modal opens
  useEffect(() => {
    if (!open || !productId) return;
    apiRequest("POST", "/api/chats", { productId })
      .then(r => r.json())
      .then(chat => setChatId(chat.id))
      .catch(() => toast({ title: "Could not open chat", variant: "destructive" }));
  }, [open, productId]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${chatId}/messages`],
    queryFn: async () => { const r = await apiRequest("GET", `/api/chats/${chatId}/messages`); return r.json(); },
    enabled: !!chatId,
    refetchInterval: 3000,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const r = await apiRequest("POST", `/api/chats/${chatId}/messages`, { content });
      return r.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !chatId) return;
    const { detected, labels } = detectOffPlatform(trimmed);
    if (detected) { setWarning({ labels }); return; }
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const OFFER_CHIPS = ["Is this still available?", "Can you do a lower price?", "I'll take it — let's finalise on TSIA.", "Can you ship?", "What's the best you can do?"];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md p-0 gap-0 h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <div className="w-9 h-9 rounded-full bg-tsia-green/10 flex items-center justify-center font-bold text-tsia-green">
              {sellerName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{sellerName}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" /> {productTitle}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-tsia-green font-semibold bg-tsia-green/10 px-2 py-1 rounded-full shrink-0">
              <Shield className="w-3 h-3" /> Secure
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notice */}
          <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            All negotiations & payments must stay inside TSIA. Contact details and external platforms will be blocked.
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && chatId && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-semibold text-sm">Say hello to {sellerName}!</p>
                <p className="text-xs text-muted-foreground mt-1">Ask about the product, negotiate the price, or make an offer.</p>
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          <div className="flex gap-2 overflow-x-auto px-4 py-2 shrink-0 scrollbar-none">
            {OFFER_CHIPS.map(chip => (
              <button key={chip} onClick={() => setInput(chip)}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted border border-border hover:border-tsia-green hover:text-tsia-green transition-colors whitespace-nowrap">
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-3 pb-3 pt-1 border-t shrink-0">
            <Input placeholder="Negotiate or ask a question…" value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              className="flex-1 rounded-2xl bg-muted/40 min-h-[44px]"
              data-testid="input-product-chat-message" />
            <Button size="icon" className="w-11 h-11 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 shrink-0"
              onClick={handleSend} disabled={!input.trim() || !chatId || sendMutation.isPending}
              data-testid="button-product-chat-send">
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Off-platform warning */}
      <Dialog open={!!warning} onOpenChange={() => setWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Message Not Allowed
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>Your message contains <strong>{warning?.labels.join(", ")}</strong>.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">⚠️ TSIA Platform Policy</p>
                All price negotiations, agreements, and payments must be completed <strong>directly inside the TSIA marketplace</strong>. Moving transactions off-platform removes buyer and seller protections, and violates our terms of service.
              </div>
              <p className="text-sm text-muted-foreground">Please edit your message to remove the flagged content.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full bg-tsia-green hover:bg-tsia-green/90" onClick={() => setWarning(null)} data-testid="button-warning-dismiss">
              Got it — edit message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
