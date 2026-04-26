import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Send, X, MessageCircle, ShoppingBag, AlertTriangle, ChevronLeft,
  Shield, Phone, PhoneOff, PhoneIncoming, Mic, MicOff, ArrowLeft,
  Check, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OFFPLATFORM_PATTERNS } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChatMessage = {
  id: number; chatId: number; senderId: number;
  content: string; isFlagged: boolean; isRead: boolean; createdAt: string; senderName: string;
};
type Chat = {
  id: number; productId: number; buyerId: number; sellerId: number;
  createdAt: string; productTitle: string; otherPersonName: string;
  lastMessage?: string; unread: number;
};
type CallSession = {
  id: number; callerId: number; calleeId: number; status: string;
  callerSdp: string | null; calleeSdp: string | null;
  callerIce: any[]; calleeIce: any[]; createdAt: string;
};

// ── Off-platform detector ──────────────────────────────────────────────────────
function detectOffPlatform(text: string): { detected: boolean; labels: string[] } {
  const labels: string[] = [];
  for (const { pattern, label } of OFFPLATFORM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) { if (!labels.includes(label)) labels.push(label); }
    pattern.lastIndex = 0;
  }
  return { detected: labels.length > 0, labels };
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const time = new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div className="max-w-[78%]">
        {!isOwn && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.senderName}</p>}
        <div className={`rounded-2xl px-4 py-2.5 text-sm ${
          isOwn ? "bg-tsia-green text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
        } ${msg.isFlagged ? "border border-amber-400" : ""}`}>
          {msg.isFlagged && (
            <span className="text-amber-400 text-[10px] font-bold block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 inline" /> Off-platform content removed
            </span>
          )}
          <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          <div className={`flex items-center justify-end gap-1 mt-1`}>
            <p className={`text-[10px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>{time}</p>
            {isOwn && (
              msg.isRead
                ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" title="Read" />
                : <Check className="w-3.5 h-3.5 text-white/50" title="Sent" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── WebRTC Call Panel ──────────────────────────────────────────────────────────
const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

function CallPanel({
  callId, isCaller, otherName, onEnd
}: { callId: number; isCaller: boolean; otherName: string; onEnd: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<"connecting" | "ringing" | "active" | "ended">("connecting");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceBatchRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteIceApplied = useRef(new Set<string>());

  const endCall = useCallback(async (reason: "hangup" | "reject" = "hangup") => {
    try {
      await apiRequest("DELETE", `/api/calls/${callId}`, { reason });
    } catch {}
    cleanup();
    onEnd();
  }, [callId, onEnd]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setStatus("ended");
  };

  // Flush ICE candidates to server
  const flushIce = useCallback(async () => {
    if (!iceBatchRef.current.length) return;
    const batch = [...iceBatchRef.current];
    iceBatchRef.current = [];
    try {
      await apiRequest("POST", `/api/calls/${callId}/ice`, {
        candidates: batch,
        side: isCaller ? "caller" : "callee",
      });
    } catch {}
  }, [callId, isCaller]);

  // Poll for remote SDP + ICE
  const poll = useCallback(async () => {
    try {
      const r = await apiRequest("GET", `/api/calls/${callId}`);
      const session: CallSession = await r.json();

      if (session.status === "ended" || session.status === "rejected") {
        cleanup(); onEnd(); return;
      }

      const pc = pcRef.current;
      if (!pc) return;

      // Caller: apply callee's answer once available
      if (isCaller && session.calleeSdp && pc.remoteDescription === null) {
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: session.calleeSdp });
          setStatus("active");
          timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        } catch {}
      }

      // Apply remote ICE candidates
      const remoteCandidates = isCaller ? (session.calleeIce ?? []) : (session.callerIce ?? []);
      for (const c of remoteCandidates as RTCIceCandidateInit[]) {
        const key = JSON.stringify(c);
        if (!remoteIceApplied.current.has(key) && pc.remoteDescription) {
          try { await pc.addIceCandidate(c); remoteIceApplied.current.add(key); } catch {}
        }
      }
    } catch {}
  }, [callId, isCaller, onEnd]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection(STUN);
        pcRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        // Remote audio
        const remoteAudio = new Audio();
        pc.ontrack = e => { remoteAudio.srcObject = e.streams[0]; remoteAudio.play().catch(() => {}); };

        // ICE gathering
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            iceBatchRef.current.push(e.candidate.toJSON());
            flushIce();
          }
        };

        if (isCaller) {
          // Create offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await apiRequest("PATCH", `/api/calls/${callId}`, {
            callerSdp: offer.sdp,
            status: "ringing",
          });
          setStatus("ringing");
        } else {
          // Callee: get offer from server
          const r = await apiRequest("GET", `/api/calls/${callId}`);
          const session: CallSession = await r.json();
          if (!session.callerSdp) { onEnd(); return; }
          await pc.setRemoteDescription({ type: "offer", sdp: session.callerSdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await apiRequest("PATCH", `/api/calls/${callId}`, {
            calleeSdp: answer.sdp,
            status: "active",
          });
          setStatus("active");
          timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        }

        // Start polling
        pollRef.current = setInterval(poll, 2000);
      } catch (err: any) {
        if (!cancelled) {
          toast({ title: "Microphone access required", description: "Please allow microphone to make calls.", variant: "destructive" });
          onEnd();
        }
      }
    };

    init();
    return () => { cancelled = true; cleanup(); };
  }, []);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
      setMuted(!muted);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center text-white"
    >
      {/* Avatar */}
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center text-4xl font-bold mb-5 shadow-2xl">
        {otherName[0]?.toUpperCase()}
      </div>

      <p className="text-2xl font-bold mb-1">{otherName}</p>
      <p className="text-base text-white/60 mb-8">
        {status === "connecting" && "Connecting..."}
        {status === "ringing" && (isCaller ? "Calling..." : "Incoming call")}
        {status === "active" && fmtTime(seconds)}
        {status === "ended" && "Call ended"}
      </p>

      {/* Animated ring */}
      {(status === "ringing" || status === "connecting") && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-36 h-36 rounded-full border-2 border-tsia-green/30 animate-ping" />
          <div className="absolute w-48 h-48 rounded-full border-2 border-tsia-green/15 animate-ping" style={{ animationDelay: "0.3s" }} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6 mt-4">
        {status === "active" && (
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"}`}
          >
            {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        )}
        <button
          onClick={() => endCall("hangup")}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-colors"
          data-testid="button-end-call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>

      {status === "ringing" && isCaller && (
        <p className="text-sm text-white/40 mt-6">Waiting for {otherName} to answer...</p>
      )}
    </motion.div>
  );
}

// ── Incoming call overlay ──────────────────────────────────────────────────────
function IncomingCallBanner({ session, callerName, onAccept, onReject }: {
  session: CallSession; callerName: string; onAccept: () => void; onReject: () => void;
}) {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] bg-slate-800 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px] max-w-[90vw]"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center font-bold text-lg shrink-0 animate-pulse">
        {callerName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">Incoming voice call</p>
        <p className="text-xs text-white/60 truncate">{callerName}</p>
      </div>
      <button onClick={onReject} className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center">
        <PhoneOff className="w-5 h-5" />
      </button>
      <button onClick={onAccept} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center">
        <Phone className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// ── Full-screen Chat Window ───────────────────────────────────────────────────
function ChatWindow({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<{ labels: string[] } | null>(null);
  const [activeCall, setActiveCall] = useState<{ callId: number; isCaller: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${chat.id}/messages`],
    queryFn: async () => { const r = await apiRequest("GET", `/api/chats/${chat.id}/messages`); return r.json(); },
    refetchInterval: 300_000,
  });

  // Mark messages as read whenever new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      apiRequest("PATCH", `/api/chats/${chat.id}/read`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }).catch(() => {});
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for incoming calls
  useQuery({
    queryKey: ["/api/calls/incoming"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/calls/incoming");
      const data = await r.json();
      if (data?.id && !activeCall) {
        setIncomingCall(data);
      }
      return data;
    },
    refetchInterval: 60_000,
    enabled: !activeCall,
  });

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

  const initiateCall = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/calls/initiate", {
        calleeId: chat.buyerId === user?.id ? chat.sellerId : chat.buyerId,
        productId: chat.productId,
        chatId: chat.id,
      });
      return r.json();
    },
    onSuccess: (data: CallSession) => {
      setActiveCall({ callId: data.id, isCaller: true });
    },
    onError: (e: any) => toast({ title: "Could not start call", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const { detected, labels } = detectOffPlatform(trimmed);
    if (detected) { setWarning({ labels }); return; }
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const OFFER_CHIPS = ["Is this still available?", "Can you do a lower price?", "I'm interested — let's talk.", "Can you ship?", "Deal — I'll buy now via TSIA."];

  return (
    <div className="fixed inset-0 z-[9000] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center font-bold text-white shrink-0">
          {chat.otherPersonName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{chat.otherPersonName}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> {chat.productTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-tsia-green font-semibold bg-tsia-green/10 px-2 py-1 rounded-full">
            <Shield className="w-3 h-3" /> Secure
          </div>
          <button
            onClick={() => initiateCall.mutate()}
            disabled={initiateCall.isPending || !!activeCall}
            className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center justify-center transition-colors"
            title="Voice call"
            data-testid="button-start-call"
          >
            <Phone className={`w-4 h-4 text-green-600 ${initiateCall.isPending ? "animate-pulse" : ""}`} />
          </button>
        </div>
      </div>

      {/* Platform notice */}
      <div className="mx-4 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 shrink-0">
        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
        All negotiations and transactions must be completed inside TSIA. Contact details and external platforms are blocked.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-none space-y-0.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <MessageCircle className="w-14 h-14 text-muted-foreground/20 mb-3" />
            <p className="font-semibold text-sm">Start the conversation</p>
            <p className="text-xs text-muted-foreground mt-1">Negotiate price, ask questions — all inside TSIA.</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />)}
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
      <div className="flex items-end gap-2 px-4 pb-4 pt-1 border-t bg-background shrink-0">
        <Input placeholder="Type a message…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          className="flex-1 rounded-2xl bg-muted/40 min-h-[44px]"
          data-testid="input-chat-message" />
        <Button size="icon" className="w-11 h-11 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 shrink-0"
          onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}
          data-testid="button-send-message">
          <Send className="w-4 h-4 text-white" />
        </Button>
      </div>

      {/* Off-platform warning */}
      <Dialog open={!!warning} onOpenChange={() => setWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" /> Message Blocked</DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>Your message contains <strong>{warning?.labels.join(", ")}</strong>, which is not allowed.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
                All negotiations and payments must be completed <strong>inside TSIA</strong>. Off-platform contact removes protections.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full bg-tsia-green hover:bg-tsia-green/90" onClick={() => setWarning(null)}>Edit my message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active call overlay */}
      <AnimatePresence>
        {activeCall && (
          <CallPanel
            callId={activeCall.callId}
            isCaller={activeCall.isCaller}
            otherName={chat.otherPersonName}
            onEnd={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>

      {/* Incoming call banner */}
      <AnimatePresence>
        {incomingCall && !activeCall && (
          <IncomingCallBanner
            session={incomingCall}
            callerName={chat.otherPersonName}
            onAccept={() => {
              setActiveCall({ callId: incomingCall.id, isCaller: false });
              setIncomingCall(null);
            }}
            onReject={async () => {
              try { await apiRequest("DELETE", `/api/calls/${incomingCall.id}`, { reason: "reject" }); } catch {}
              setIncomingCall(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Chats Inbox ───────────────────────────────────────────────────────────────
function ChatsInbox({ onOpen, onClose }: { onOpen: (chat: Chat) => void; onClose: () => void }) {
  const { data: chats = [], isLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/chats"); return r.json(); },
    refetchInterval: 300_000,
  });

  return (
    <div className="fixed inset-0 z-[9000] bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-card shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <MessageCircle className="w-5 h-5 text-tsia-green" />
        <h2 className="font-bold text-lg flex-1">Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-tsia-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
            <MessageCircle className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="font-bold text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Browse the marketplace and start chatting with sellers to negotiate prices.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {chats.map(chat => (
              <button key={chat.id} onClick={() => onOpen(chat)} data-testid={`chat-row-${chat.id}`}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/50 transition-colors text-left">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center font-bold text-white text-lg shrink-0">
                  {chat.otherPersonName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-bold text-sm truncate">{chat.otherPersonName}</p>
                    <p className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {new Date(chat.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3 shrink-0" /> {chat.productTitle}
                  </p>
                  {chat.lastMessage && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{chat.lastMessage}</p>}
                </div>
                <ChevronLeft className="w-4 h-4 rotate-180 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EcommerceChatDrawer — now full-screen ────────────────────────────────────
export function EcommerceChatDrawer({
  open, onClose, initialChatId,
}: { open: boolean; onClose: () => void; initialChatId?: number | null }) {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [resolving, setResolving] = useState(false);

  // Reset on close
  useEffect(() => { if (!open) setActiveChat(null); }, [open]);

  // Auto-open a specific chat when initialChatId is provided
  useEffect(() => {
    if (!open || !initialChatId) return;
    setResolving(true);
    apiRequest("GET", "/api/chats")
      .then(r => r.json())
      .then((chats: Chat[]) => {
        const found = chats.find(c => c.id === initialChatId);
        if (found) setActiveChat(found);
      })
      .catch(() => {})
      .finally(() => setResolving(false));
  }, [open, initialChatId]);

  if (!open) return null;
  if (resolving) return (
    <div className="fixed inset-0 z-[9000] bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-tsia-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (activeChat) return <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />;
  return <ChatsInbox onOpen={setActiveChat} onClose={onClose} />;
}

// ── ProductChatModal — full-screen from product detail ───────────────────────
export function ProductChatModal({ productId, productTitle, sellerName, open, onClose }: {
  productId: number; productTitle: string; sellerName: string; open: boolean; onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<{ labels: string[] } | null>(null);
  const [activeCall, setActiveCall] = useState<{ callId: number; isCaller: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !productId) return;
    apiRequest("POST", "/api/chats", { productId })
      .then(r => r.json())
      .then((chat: any) => setChatData({
        id: chat.id, productId: chat.productId,
        buyerId: chat.buyerId, sellerId: chat.sellerId,
        createdAt: chat.createdAt, productTitle,
        otherPersonName: sellerName, lastMessage: undefined, unread: 0,
      }))
      .catch(() => toast({ title: "Could not open chat", variant: "destructive" }));
  }, [open, productId]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${chatData?.id}/messages`],
    queryFn: async () => { const r = await apiRequest("GET", `/api/chats/${chatData!.id}/messages`); return r.json(); },
    enabled: !!chatData?.id,
    refetchInterval: 300_000,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for incoming calls
  useQuery({
    queryKey: ["/api/calls/incoming"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/calls/incoming");
      const data = await r.json();
      if (data?.id && !activeCall) setIncomingCall(data);
      return data;
    },
    refetchInterval: 60_000,
    enabled: !!chatData && !activeCall,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const r = await apiRequest("POST", `/api/chats/${chatData!.id}/messages`, { content });
      return r.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatData?.id}/messages`] });
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const initiateCall = useMutation({
    mutationFn: async () => {
      if (!chatData) throw new Error("No chat");
      const r = await apiRequest("POST", "/api/calls/initiate", {
        calleeId: chatData.buyerId === user?.id ? chatData.sellerId : chatData.buyerId,
        productId: chatData.productId,
        chatId: chatData.id,
      });
      return r.json();
    },
    onSuccess: (data: CallSession) => setActiveCall({ callId: data.id, isCaller: true }),
    onError: (e: any) => toast({ title: "Could not start call", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !chatData?.id) return;
    const { detected, labels } = detectOffPlatform(trimmed);
    if (detected) { setWarning({ labels }); return; }
    sendMutation.mutate(trimmed);
  };

  const CHIPS = ["Is this still available?", "Can you do a lower price?", "I'll take it — let's finalise on TSIA.", "Can you ship?", "What's the best you can do?"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center font-bold text-white shrink-0">
          {sellerName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{sellerName}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> {productTitle}
          </p>
        </div>
        <button
          onClick={() => initiateCall.mutate()}
          disabled={initiateCall.isPending || !!activeCall || !chatData}
          className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 hover:bg-green-200 flex items-center justify-center transition-colors"
          title="Voice call"
          data-testid="button-start-call-modal"
        >
          <Phone className="w-4 h-4 text-green-600" />
        </button>
        <div className="flex items-center gap-1 text-[10px] text-tsia-green font-semibold bg-tsia-green/10 px-2 py-1 rounded-full">
          <Shield className="w-3 h-3" /> Secure
        </div>
      </div>

      <div className="mx-4 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2 shrink-0">
        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
        All negotiations & payments must stay inside TSIA. Contact details and external platforms are blocked.
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-none">
        {messages.length === 0 && chatData && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="font-bold text-sm">Say hello to {sellerName}!</p>
            <p className="text-xs text-muted-foreground mt-1">Ask about the product, negotiate the price, or make a voice call.</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-2 shrink-0 scrollbar-none">
        {CHIPS.map(chip => (
          <button key={chip} onClick={() => setInput(chip)}
            className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-muted border border-border hover:border-tsia-green hover:text-tsia-green transition-colors whitespace-nowrap">
            {chip}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2 px-4 pb-4 pt-1 border-t bg-background shrink-0">
        <Input placeholder="Negotiate or ask a question…" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          className="flex-1 rounded-2xl bg-muted/40 min-h-[44px]"
          data-testid="input-product-chat-message" />
        <Button size="icon" className="w-11 h-11 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 shrink-0"
          onClick={handleSend} disabled={!input.trim() || !chatData?.id || sendMutation.isPending}
          data-testid="button-product-chat-send">
          <Send className="w-4 h-4 text-white" />
        </Button>
      </div>

      <Dialog open={!!warning} onOpenChange={() => setWarning(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" /> Message Not Allowed</DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <p>Contains <strong>{warning?.labels.join(", ")}</strong> — blocked by TSIA policy.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
                All negotiations must stay <strong>inside TSIA</strong> to protect buyers and sellers.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full bg-tsia-green hover:bg-tsia-green/90" onClick={() => setWarning(null)} data-testid="button-warning-dismiss">
              Edit message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {activeCall && chatData && (
          <CallPanel callId={activeCall.callId} isCaller={activeCall.isCaller}
            otherName={sellerName} onEnd={() => setActiveCall(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingCall && !activeCall && (
          <IncomingCallBanner
            session={incomingCall}
            callerName={sellerName}
            onAccept={() => { setActiveCall({ callId: incomingCall.id, isCaller: false }); setIncomingCall(null); }}
            onReject={async () => {
              try { await apiRequest("DELETE", `/api/calls/${incomingCall.id}`, { reason: "reject" }); } catch {}
              setIncomingCall(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Keep backward-compat exports
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
  return { openChat: () => { if (productId) openChatMutation.mutate(); }, chatId, chatOpen, setChatOpen, loading: openChatMutation.isPending };
}
