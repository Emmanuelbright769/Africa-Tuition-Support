import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, ArrowLeftRight, Handshake, Coins, DollarSign,
  Plus, Check, Loader2, AlertCircle, Clock, CheckCircle2, Banknote,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────
type P2PTab    = "market" | "offers" | "trades";
type P2PView   = "list" | "buy" | "order-view";
type CreateView = "list" | "create";

const P2P_CURRENCIES = [
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira",     flag: "🇳🇬" },
  { code: "GHS", symbol: "₵",   name: "Ghanaian Cedi",      flag: "🇬🇭" },
  { code: "KES", symbol: "Ksh", name: "Kenyan Shilling",    flag: "🇰🇪" },
  { code: "ZAR", symbol: "R",   name: "South African Rand", flag: "🇿🇦" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling",   flag: "🇺🇬" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", flag: "🇹🇿" },
  { code: "RWF", symbol: "Fr",  name: "Rwandan Franc",      flag: "🇷🇼" },
];

const PAYMENT_METHODS = ["Bank Transfer", "Mobile Money"];

const getCurrInfo = (code: string) =>
  P2P_CURRENCIES.find(c => c.code === code) ?? { code, symbol: code, name: code, flag: "🌍" };

// ─── Sub-components ────────────────────────────────────────────────────────

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 text-sm font-semibold"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")   return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wide">Pending</span>;
  if (status === "paid")      return <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wide">Paid</span>;
  if (status === "completed") return <span className="px-2 py-0.5 rounded-full bg-tsia-green/20 text-tsia-green text-[10px] font-bold uppercase tracking-wide">Completed</span>;
  return <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-[10px] font-bold uppercase tracking-wide">Cancelled</span>;
}

// ─── Dark input wrapper ─────────────────────────────────────────────────────
function DarkInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white/10 border border-white/20 rounded-xl px-3 h-11 text-white font-bold placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-tsia-green/50 transition-all ${className}`}
    />
  );
}

function DarkTextArea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-tsia-green/50 transition-all resize-none ${className}`}
    />
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function P2PExchange() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Sub-view state
  const [tab, setTab]                       = useState<P2PTab>("market");
  const [view, setView]                     = useState<P2PView>("list");
  const [createView, setCreateView]         = useState<CreateView>("list");
  const [offerSelected, setOfferSelected]   = useState<any>(null);
  const [orderSelected, setOrderSelected]   = useState<any>(null);
  const [buyAmount, setBuyAmount]           = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  // ── Create-offer form state
  const [sellAmount, setSellAmount]           = useState("");
  const [sellRate, setSellRate]               = useState("");
  const [sellCurrency, setSellCurrency]       = useState("NGN");
  const [sellMinOrder, setSellMinOrder]       = useState("5");
  const [sellPaymentMethod, setSellPaymentMethod] = useState("Bank Transfer");
  const [sellPaymentDetails, setSellPaymentDetails] = useState("");

  // ── Queries
  const { data: wallet } = useQuery<{ balance: string }>({ queryKey: ["/api/wallet"] });
  const balance = parseFloat(wallet?.balance ?? "0");

  const { data: marketOffers = [], refetch: refetchMarket } = useQuery<any[]>({
    queryKey: ["/api/p2p/offers"],
    staleTime: 20_000,
  });
  const { data: myOffers = [], refetch: refetchMyOffers } = useQuery<any[]>({
    queryKey: ["/api/p2p/offers/my"],
    staleTime: 20_000,
  });
  const { data: myOrders = [], refetch: refetchMyOrders } = useQuery<any[]>({
    queryKey: ["/api/p2p/orders/my"],
    staleTime: 20_000,
  });

  // ── Mutations
  const createOfferMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/p2p/offers", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      refetchMyOffers();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setCreateView("list");
      setSellAmount(""); setSellRate(""); setSellPaymentDetails("");
      toast({ title: "Offer created ✓", description: "Your USD is in escrow and visible to buyers.", className: "border-tsia-green" });
    },
    onError: (e: any) => toast({ title: "Failed to create offer", description: e.message, variant: "destructive" }),
  });

  const placeOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/p2p/orders", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchMyOrders();
      setTab("trades");
      setOrderSelected(data.order);
      setView("order-view");
      toast({ title: "Order placed ✓", description: "Send payment to the seller then tap 'I've Paid'.", className: "border-tsia-green" });
    },
    onError: (e: any) => toast({ title: "Order failed", description: e.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("PATCH", `/api/p2p/orders/${orderId}/paid`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchMyOrders();
      setOrderSelected(data.order);
      toast({ title: "Payment confirmed ✓", description: "Waiting for seller to release USD.", className: "border-tsia-green" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("PATCH", `/api/p2p/orders/${orderId}/complete`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchMyOrders(); refetchMyOffers();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      setOrderSelected(data.order);
      toast({ title: "Trade complete! 🎉", description: `$${parseFloat(data.order.amountUsd).toFixed(2)} released to buyer.`, className: "border-tsia-green" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("PATCH", `/api/p2p/orders/${orderId}/cancel`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      refetchMyOrders(); refetchMyOffers();
      setView("list"); setOrderSelected(null);
      toast({ title: "Order cancelled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelOfferMutation = useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("DELETE", `/api/p2p/offers/${offerId}`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      refetchMyOffers();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({ title: "Offer cancelled", description: "USD returned to your wallet." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pauseOfferMutation = useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("PATCH", `/api/p2p/offers/${offerId}/pause`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { refetchMyOffers(); refetchMarket(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Order detail view ─────────────────────────────────────────────────────
  if (view === "order-view" && orderSelected) {
    const o        = orderSelected;
    const ci       = getCurrInfo(o.localCurrency);
    const isBuyer  = o.buyerId  === user?.id;
    const isSeller = o.sellerId === user?.id;
    const localAmt = parseFloat(o.localAmount);
    const usdAmt   = parseFloat(o.amountUsd);
    return (
      <AnimatePresence mode="wait">
        <motion.div key="p2p-order" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }} className="space-y-4 pb-4">
          <BackBtn onBack={() => { setView("list"); setOrderSelected(null); }} />

          {/* Status card */}
          <div className={`rounded-2xl p-4 border ${
            o.status === "completed" ? "bg-tsia-green/15 border-tsia-green/30" :
            o.status === "paid"      ? "bg-blue-500/15 border-blue-500/30" :
            o.status === "cancelled" ? "bg-white/5 border-white/10" :
            "bg-amber-500/10 border-amber-500/30"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-black text-sm text-white">Order #{o.id}</p>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-2xl font-black text-white">${usdAmt.toFixed(2)} USD</p>
            <p className="text-xs text-white/50 mt-0.5">≈ {ci.symbol}{localAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })} {o.localCurrency} · Rate: {ci.symbol}{parseFloat(o.ratePerUsd).toLocaleString()}/USD</p>
          </div>

          {/* Parties */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="font-bold text-[10px] uppercase tracking-wider text-white/40 mb-3">Trade Parties</p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-tsia-green/20 flex items-center justify-center shrink-0">
                  <span className="font-black text-tsia-green text-sm">{o.sellerName[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-white truncate">
                    {o.sellerName.split(" ")[0]} {o.sellerName.split(" ")[1]?.[0]}.{" "}
                    {isSeller && <span className="text-tsia-green text-[10px]">(You)</span>}
                  </p>
                  <p className="text-[10px] text-white/40">Seller</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
              <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <p className="font-semibold text-sm text-white truncate">
                    {o.buyerName.split(" ")[0]} {o.buyerName.split(" ")[1]?.[0]}.{" "}
                    {isBuyer && <span className="text-blue-400 text-[10px]">(You)</span>}
                  </p>
                  <p className="text-[10px] text-white/40">Buyer</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="font-black text-blue-400 text-sm">{o.buyerName[0]}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment instructions — pending buyer */}
          {isBuyer && o.status === "pending" && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-amber-400" />
                </div>
                <p className="font-bold text-sm text-white">Payment Instructions</p>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Send exactly <span className="font-bold text-white">{ci.symbol}{localAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })} {o.localCurrency}</span> via <span className="font-bold text-white">{o.paymentMethod}</span>:
              </p>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs font-mono text-white/80 whitespace-pre-line leading-relaxed">{o.paymentDetails}</p>
              </div>
              <div className="flex items-start gap-2 bg-amber-500/10 rounded-xl p-3">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300 leading-relaxed">Only click "I've Paid" after completing the payment. False confirmations may result in account suspension.</p>
              </div>
            </div>
          )}

          {/* Waiting — paid buyer */}
          {isBuyer && o.status === "paid" && (
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-4 flex gap-3">
              <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-blue-400">Awaiting Seller Confirmation</p>
                <p className="text-xs text-blue-300/70 mt-0.5">The seller will verify your payment and release the USD.</p>
              </div>
            </div>
          )}

          {/* Seller — buyer has paid */}
          {isSeller && o.status === "paid" && (
            <div className="rounded-2xl bg-tsia-green/10 border border-tsia-green/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-tsia-green" />
                <p className="font-bold text-sm text-white">Buyer Has Paid!</p>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                {o.buyerName.split(" ")[0]} has confirmed sending <span className="font-bold text-white">{ci.symbol}{localAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })} {o.localCurrency}</span> via {o.paymentMethod}. Once you verify receipt, release the USD.
              </p>
            </div>
          )}

          {/* Completed */}
          {o.status === "completed" && (
            <div className="rounded-2xl bg-tsia-green/10 border border-tsia-green/30 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-9 h-9 text-tsia-green shrink-0" />
              <div>
                <p className="font-bold text-sm text-white">Trade Completed!</p>
                <p className="text-xs text-white/50 mt-0.5">${usdAmt.toFixed(2)} transferred to {isSeller ? "the buyer's" : "your"} wallet.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {isBuyer && o.status === "pending" && (
              <button
                className="w-full h-12 rounded-xl bg-gradient-to-r from-tsia-green to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                onClick={() => markPaidMutation.mutate(o.id)}
                disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Confirming…</>
                  : <><Check className="w-4 h-4" />I've Paid</>}
              </button>
            )}
            {isSeller && o.status === "paid" && (
              <button
                className="w-full h-12 rounded-xl bg-gradient-to-r from-tsia-green to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                onClick={() => completeOrderMutation.mutate(o.id)}
                disabled={completeOrderMutation.isPending}>
                {completeOrderMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Releasing…</>
                  : <><Coins className="w-4 h-4" />Release USD to Buyer</>}
              </button>
            )}
            {(o.status === "pending" || o.status === "paid") && (
              <button
                className="w-full h-11 rounded-xl border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => cancelOrderMutation.mutate(o.id)}
                disabled={cancelOrderMutation.isPending}>
                {cancelOrderMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Cancelling…</> : "Cancel Order"}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Buy sub-view ──────────────────────────────────────────────────────────
  if (tab === "market" && view === "buy" && offerSelected) {
    const offer  = offerSelected;
    const ci     = getCurrInfo(offer.localCurrency);
    const buyAmt = parseFloat(buyAmount) || 0;
    const rate   = parseFloat(offer.ratePerUsd);
    const minOrd = parseFloat(offer.minOrderUsd);
    const maxOrd = Math.min(parseFloat(offer.maxOrderUsd), parseFloat(offer.availableUsd));
    const isValid = buyAmt >= minOrd && buyAmt <= maxOrd;
    return (
      <AnimatePresence mode="wait">
        <motion.div key="p2p-buy" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }} className="space-y-4 pb-4">
          <BackBtn onBack={() => { setView("list"); setOfferSelected(null); setBuyAmount(""); }} />

          {/* Seller card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-tsia-green/20 flex items-center justify-center shrink-0">
              <span className="font-black text-tsia-green text-base">{offer.sellerName[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">{offer.sellerName.split(" ")[0]} {offer.sellerName.split(" ")[1]?.[0]}.</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <div className="w-1.5 h-1.5 rounded-full bg-tsia-green" />
                <span className="text-[10px] text-tsia-green font-semibold">Online</span>
                {offer.completedTrades > 0 && <span className="text-[10px] text-white/40">· {offer.completedTrades} trades</span>}
                <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full">{offer.paymentMethod}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-tsia-green">{ci.symbol}{parseFloat(offer.ratePerUsd).toLocaleString()}</p>
              <p className="text-[10px] text-white/40">per USD</p>
            </div>
          </div>

          {/* Amount input */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-white/60">Amount to Buy (USD)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-white/40">$</span>
              <DarkInput type="number" min={minOrd} max={maxOrd} step="0.01"
                value={buyAmount} onChange={e => setBuyAmount(e.target.value)}
                placeholder={`${minOrd}–${maxOrd.toFixed(2)}`}
                className="pl-7 text-lg" />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>Min: <span className="font-bold text-white">${minOrd}</span></span>
              <span>Max: <span className="font-bold text-white">${maxOrd.toFixed(2)}</span></span>
            </div>
            {buyAmt > 0 && (
              <div className="rounded-xl bg-tsia-green/10 border border-tsia-green/20 p-3 flex items-center justify-between">
                <span className="text-xs text-white/50 font-semibold">You'll pay</span>
                <span className="font-black text-lg text-white">{ci.symbol}{(buyAmt * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-white/40 font-semibold">{offer.localCurrency}</span></span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="font-bold text-xs uppercase tracking-wider text-white/40 mb-1.5">Payment Method</p>
            <p className="font-semibold text-sm text-white">{offer.paymentMethod}</p>
            <p className="text-[11px] text-white/40 mt-1">Payment details will be shown after order placement.</p>
          </div>

          <button
            className="w-full h-12 rounded-xl bg-gradient-to-r from-tsia-green to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={!isValid || placeOrderMutation.isPending}
            onClick={() => placeOrderMutation.mutate({ offerId: offer.id, amountUsd: buyAmt })}>
            {placeOrderMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Placing Order…</>
              : <><Handshake className="w-4 h-4" />Place Order · ${buyAmt > 0 ? buyAmt.toFixed(2) : "—"}</>}
          </button>
          {!isValid && buyAmt > 0 && (
            <p className="text-center text-xs text-red-400">Amount must be between ${minOrd} and ${maxOrd.toFixed(2)}</p>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Create offer sub-view ─────────────────────────────────────────────────
  if (tab === "offers" && createView === "create") {
    const amt     = parseFloat(sellAmount) || 0;
    const rate    = parseFloat(sellRate) || 0;
    const minOrd  = parseFloat(sellMinOrder) || 5;
    const ci      = getCurrInfo(sellCurrency);
    const ledger  = Math.min(balance, 2);
    const avail   = Math.max(0, balance - ledger);
    const isValid = amt >= 5 && amt <= avail && rate > 0 && sellPaymentMethod.trim() !== "" && sellPaymentDetails.trim() !== "";
    return (
      <AnimatePresence mode="wait">
        <motion.div key="p2p-create" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }} className="space-y-4 pb-4">
          <BackBtn onBack={() => setCreateView("list")} />

          {/* Wallet info */}
          <div className="rounded-2xl bg-tsia-green/10 border border-tsia-green/20 p-4">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wide mb-0.5">Available to list</p>
            <p className="text-2xl font-black text-white">${avail.toFixed(2)}</p>
            <p className="text-[10px] text-white/40 mt-0.5">(After $2 ledger reserve)</p>
          </div>

          {/* Amount */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-white/60">Amount to Sell (USD)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-white/40">$</span>
              <DarkInput type="number" min="5" max={avail} step="0.01"
                value={sellAmount} onChange={e => setSellAmount(e.target.value)}
                placeholder="e.g. 50" className="pl-7" />
            </div>
            <p className="text-[10px] text-white/40">Minimum $5 · Max ${avail.toFixed(2)}</p>
          </div>

          {/* Currency + Rate */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-white/60 mb-2">Local Currency</p>
              <div className="grid grid-cols-4 gap-2">
                {P2P_CURRENCIES.map(c => (
                  <button key={c.code} onClick={() => setSellCurrency(c.code)}
                    className={`rounded-xl border py-2 text-[11px] font-bold transition-all ${sellCurrency === c.code ? "border-tsia-green bg-tsia-green/20 text-tsia-green" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"}`}>
                    {c.flag} {c.code}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/60 mb-1.5">Your Rate ({ci.symbol} per $1 USD)</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">{ci.symbol}</span>
                <DarkInput type="number" min="1" step="1"
                  value={sellRate} onChange={e => setSellRate(e.target.value)}
                  placeholder="e.g. 1650" className="pl-7" />
              </div>
              {amt > 0 && rate > 0 && (
                <p className="text-[11px] text-white/40 mt-1.5">Buyer pays <span className="font-bold text-white">{ci.symbol}{(amt * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> for ${amt.toFixed(2)} USD</p>
              )}
            </div>
          </div>

          {/* Min order */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-white/60">Minimum Order Size (USD)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-white/40">$</span>
              <DarkInput type="number" min="1" max={amt || 100} step="1"
                value={sellMinOrder} onChange={e => setSellMinOrder(e.target.value)}
                placeholder="5" className="pl-7" />
            </div>
          </div>

          {/* Payment method — no Cash */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-white/60 mb-2">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setSellPaymentMethod(m)}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${sellPaymentMethod === m ? "border-tsia-green bg-tsia-green/20 text-tsia-green" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/60 mb-1.5">Payment Details <span className="text-white/30 font-normal">(shown to buyer)</span></p>
              <DarkTextArea
                value={sellPaymentDetails}
                onChange={e => setSellPaymentDetails(e.target.value)}
                placeholder={"e.g.\nBank: GTBank\nAccount: 0123456789\nName: John Doe"}
                className="h-24" />
            </div>
          </div>

          <button
            className="w-full h-12 rounded-xl bg-gradient-to-r from-tsia-green to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={!isValid || createOfferMutation.isPending}
            onClick={() => createOfferMutation.mutate({
              amountUsd: amt, ratePerUsd: rate, localCurrency: sellCurrency,
              minOrderUsd: minOrd, maxOrderUsd: amt, paymentMethod: sellPaymentMethod,
              paymentDetails: sellPaymentDetails,
            })}>
            {createOfferMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
              : <><Coins className="w-4 h-4" />List ${amt > 0 ? amt.toFixed(2) : "—"} for Sale</>}
          </button>
          {amt > 0 && amt > avail && (
            <p className="text-center text-xs text-red-400">Amount exceeds available balance (${avail.toFixed(2)})</p>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Main tabbed view ──────────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div key="p2p-main" initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }} transition={{ duration:0.22 }} className="space-y-4 pb-4">

        {/* Tab bar */}
        <div className="flex rounded-2xl bg-white/5 border border-white/10 p-1">
          {(["market", "offers", "trades"] as const).map(t => (
            <button key={t} onClick={() => {
              setTab(t);
              if (t === "market") { refetchMarket(); setView("list"); }
              if (t === "offers") refetchMyOffers();
              if (t === "trades") refetchMyOrders();
            }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === t ? "bg-tsia-green text-white shadow" : "text-white/40 hover:text-white/70"
              }`}>
              {t === "market" ? "Market" : t === "offers" ? "My Offers" : "My Trades"}
            </button>
          ))}
        </div>

        {/* ── Market ── */}
        {tab === "market" && (
          <div className="space-y-3">
            {/* Currency filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button onClick={() => setCurrencyFilter("all")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${currencyFilter === "all" ? "bg-tsia-green text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
                All
              </button>
              {P2P_CURRENCIES.map(c => (
                <button key={c.code} onClick={() => setCurrencyFilter(c.code)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 flex items-center gap-1 transition-all ${currencyFilter === c.code ? "bg-tsia-green text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
                  {c.flag} {c.code}
                </button>
              ))}
            </div>

            {/* Offer list */}
            {(() => {
              const filtered = marketOffers
                .filter(o => currencyFilter === "all" || o.localCurrency === currencyFilter)
                .filter(o => parseFloat(o.availableUsd) >= 1);
              if (filtered.length === 0) return (
                <div className="text-center py-14">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                    <Handshake className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="font-bold text-sm text-white">No offers yet</p>
                  <p className="text-xs text-white/40 mt-1 mb-4">Be the first — sell your USD and set your own rate!</p>
                  <button onClick={() => { setTab("offers"); setCreateView("create"); }}
                    className="bg-tsia-green text-white rounded-xl font-bold text-xs px-5 h-9 hover:opacity-90 transition-opacity">
                    Create an Offer
                  </button>
                </div>
              );
              return (
                <div className="space-y-3">
                  {filtered.map(offer => {
                    const ci = getCurrInfo(offer.localCurrency);
                    return (
                      <div key={offer.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3 hover:border-tsia-green/30 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full bg-tsia-green/20 flex items-center justify-center shrink-0">
                              <span className="font-black text-tsia-green">{offer.sellerName[0]}</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white">{offer.sellerName.split(" ")[0]} {offer.sellerName.split(" ")[1]?.[0]}.</p>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-tsia-green" />
                                <span className="text-[10px] text-tsia-green font-semibold">Online</span>
                                {offer.completedTrades > 0 && <span className="text-[10px] text-white/40">· {offer.completedTrades} trades</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-tsia-green text-lg leading-none">{ci.symbol}{parseFloat(offer.ratePerUsd).toLocaleString()}</p>
                            <p className="text-[10px] text-white/40">per USD</p>
                          </div>
                        </div>
                        <div className="border-t border-white/10 pt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-wide">Available</p>
                              <p className="font-bold text-white">${parseFloat(offer.availableUsd).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-wide">Limit</p>
                              <p className="font-bold text-white">${parseFloat(offer.minOrderUsd).toFixed(0)}–${parseFloat(offer.maxOrderUsd).toFixed(0)}</p>
                            </div>
                          </div>
                          <button onClick={() => { setOfferSelected(offer); setView("buy"); setBuyAmount(""); }}
                            className="px-4 py-2 rounded-xl bg-tsia-green text-white text-xs font-black hover:opacity-90 active:scale-95 transition-all">
                            Buy USD
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 -mt-1">
                          <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{offer.paymentMethod}</span>
                          <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{ci.flag} {offer.localCurrency}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── My Offers ── */}
        {tab === "offers" && (
          <div className="space-y-3">
            <button
              onClick={() => { setCreateView("create"); setSellAmount(""); setSellRate(""); setSellPaymentDetails(""); setSellCurrency("NGN"); setSellMinOrder("5"); setSellPaymentMethod("Bank Transfer"); }}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-tsia-green to-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Create New Offer
            </button>

            {myOffers.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-8 h-8 text-white/20" />
                </div>
                <p className="font-bold text-sm text-white">No offers yet</p>
                <p className="text-xs text-white/40 mt-1">Create an offer to sell your USD at your own rate</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOffers.map(offer => {
                  const ci = getCurrInfo(offer.localCurrency);
                  const isCancelled = offer.status === "cancelled";
                  return (
                    <div key={offer.id} className={`rounded-2xl border p-4 space-y-3 transition-all ${isCancelled ? "bg-white/3 border-white/5 opacity-50" : "bg-white/5 border-white/10"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-base text-white">${parseFloat(offer.amountUsd).toFixed(2)} USD</p>
                            {offer.status === "active"    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-tsia-green/20 text-tsia-green font-bold">Active</span>}
                            {offer.status === "paused"    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">Paused</span>}
                            {offer.status === "cancelled" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40 font-bold">Cancelled</span>}
                            {offer.status === "completed" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-tsia-green/20 text-tsia-green font-bold">Sold Out</span>}
                          </div>
                          <p className="text-xs text-white/40 mt-1">Rate: {ci.symbol}{parseFloat(offer.ratePerUsd).toLocaleString()} · Available: ${parseFloat(offer.availableUsd).toFixed(2)}</p>
                        </div>
                        <div className="text-right text-xs shrink-0 ml-2">
                          <p className="font-bold text-white/40">{offer.completedTrades} trade{offer.completedTrades !== 1 ? "s" : ""}</p>
                          <p className="text-white/30 mt-0.5">{ci.flag} {offer.localCurrency}</p>
                        </div>
                      </div>
                      {!isCancelled && offer.status !== "completed" && (
                        <div className="flex gap-2 border-t border-white/10 pt-3">
                          <button onClick={() => pauseOfferMutation.mutate(offer.id)}
                            disabled={pauseOfferMutation.isPending}
                            className="flex-1 py-2 rounded-xl border border-white/15 text-xs font-bold text-white/60 hover:bg-white/10 transition-all">
                            {offer.status === "paused" ? "Resume" : "Pause"}
                          </button>
                          <button onClick={() => cancelOfferMutation.mutate(offer.id)}
                            disabled={cancelOfferMutation.isPending}
                            className="flex-1 py-2 rounded-xl border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all">
                            Cancel &amp; Return
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── My Trades ── */}
        {tab === "trades" && (
          <div className="space-y-3">
            {myOrders.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <ArrowLeftRight className="w-8 h-8 text-white/20" />
                </div>
                <p className="font-bold text-sm text-white">No trades yet</p>
                <p className="text-xs text-white/40 mt-1 mb-4">Browse the market to buy USD at great rates</p>
                <button onClick={() => setTab("market")}
                  className="bg-tsia-green text-white rounded-xl font-bold text-xs px-5 h-9 hover:opacity-90 transition-opacity">
                  Browse Market
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => {
                  const ci       = getCurrInfo(order.localCurrency);
                  const isBuyer  = order.buyerId === user?.id;
                  const localAmt = parseFloat(order.localAmount);
                  const usdAmt   = parseFloat(order.amountUsd);
                  const needsAction = (isBuyer && order.status === "pending") || (!isBuyer && order.status === "paid");
                  return (
                    <button key={order.id}
                      onClick={() => { setOrderSelected(order); setView("order-view"); }}
                      className={`w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                        needsAction ? "border-tsia-green/40 bg-tsia-green/10" : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {needsAction && <div className="w-1.5 h-1.5 rounded-full bg-tsia-green animate-pulse" />}
                            <p className="font-black text-sm text-white">{isBuyer ? "Buy" : "Sell"} ${usdAmt.toFixed(2)} USD</p>
                          </div>
                          <p className="text-[10px] text-white/40">
                            {isBuyer ? `From ${order.sellerName.split(" ")[0]}` : `To ${order.buyerName.split(" ")[0]}`} &nbsp;·&nbsp; {ci.symbol}{localAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })} {order.localCurrency}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={order.status} />
                          {needsAction && <span className="text-[9px] font-black text-tsia-green uppercase tracking-wide">Action needed</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-white/30 border-t border-white/10 pt-2">
                        <span>Order #{order.id}</span>
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </motion.div>
    </AnimatePresence>
  );
}
