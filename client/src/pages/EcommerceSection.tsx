import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Search, ShoppingBag, Package, Star, MapPin, Plus, Eye, ShoppingCart,
  Tag, Truck, CheckCircle2, X, Camera, TrendingUp, Loader2, Heart,
  Filter, ChevronRight, ChevronLeft, BadgePercent, Bell, Zap, ArrowRight, Flame,
  Grid3X3, List, SlidersHorizontal, ArrowUpDown, ChevronDown, Check, MessageCircle,
  Mail, HandCoins, AlertCircle, ArrowLeftRight, User, Expand,
  Lock, PackageOpen, Clock, ChevronUp, Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ECOMMERCE } from "@shared/schema";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { EcommerceChatDrawer, ProductChatModal } from "./EcommerceChatPanel";

// ─── Types ─────────────────────────────────────────────────────────────────
type Product = {
  id: number; sellerId: number; title: string; description: string;
  price: string; category: string; condition: string; images: string[] | null;
  stock: number; location: string; status: string; viewCount: number;
  createdAt: string; sellerName: string; sellerEmail?: string;
  negotiable?: boolean;
  avgRating?: number; ratingCount?: number;
};
type ProductRatingEntry = {
  id: number; productId: number; userId: number; rating: number; comment: string | null;
  userName: string; createdAt: string;
};
type Order = {
  id: number; buyerId: number; sellerId: number; productId: number; quantity: number;
  unitPrice: string; totalAmount: string; commissionAmount: string; sellerReceives: string;
  status: string; deliveryAddress: string | null; note: string | null;
  escrowReleased: boolean; trackingNumber: string | null;
  createdAt: string; product?: { title: string; price: string };
  sellerName?: string; buyerName?: string;
};
type TrackingEntry = {
  id: number; orderId: number; statusLabel: string; description: string;
  location: string | null; createdAt: string;
};
type Tab = "browse" | "my-listings" | "purchases" | "sales";

// ─── Constants ─────────────────────────────────────────────────────────────
const CATEGORY_ICONS = ECOMMERCE.CATEGORY_ICONS;
const CATEGORY_LABELS = ECOMMERCE.CATEGORY_LABELS;
const CATEGORIES = ECOMMERCE.CATEGORIES;

const CATEGORY_GRADIENTS: Record<string, string> = {
  electronics:  "from-blue-500 to-indigo-600",
  fashion:      "from-pink-500 to-rose-500",
  books:        "from-amber-400 to-orange-500",
  food:         "from-green-400 to-emerald-500",
  health:       "from-red-400 to-pink-500",
  home:         "from-violet-500 to-purple-600",
  sports:       "from-sky-400 to-blue-500",
  services:     "from-teal-400 to-cyan-500",
  other:        "from-slate-400 to-slate-600",
};

const PROMO_SLIDES = [
  {
    id: 1,
    badge: "🔥 Hot Deal",
    headline: "Mega Sale",
    sub: "Up to 40% off selected items",
    accent: "from-[#1a5c38] to-[#0e3d25]",
    emoji: "🛍️",
    tag: "Limited time",
  },
  {
    id: 2,
    badge: "⚡ New Arrivals",
    headline: "Fresh Drops",
    sub: "Brand new listings every day",
    accent: "from-[#b8860b] to-[#8b6508]",
    emoji: "✨",
    tag: "Explore now",
  },
  {
    id: 3,
    badge: "🎁 For You",
    headline: "Exclusive Picks",
    sub: "Handpicked by TSIA for members",
    accent: "from-[#1e3a5f] to-[#0f2040]",
    emoji: "💎",
    tag: "Members only",
  },
];

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  shipped:   "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  active:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  sold:      "bg-slate-100 text-slate-600",
  paused:    "bg-amber-100 text-amber-700",
};

// Fake "original" price for discount display
const originalPrice = (price: string) => (parseFloat(price) * 1.28).toFixed(2);

// ─── Sub-components ─────────────────────────────────────────────────────────

function StarRating({ rating = 0, count = 0, interactive = false, onRate }: { rating?: number; count?: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = interactive ? (hover || rating) : rating;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={`transition-colors ${interactive ? "w-5 h-5 cursor-pointer" : "w-2.5 h-2.5"} ${s <= Math.floor(display) ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300 dark:text-gray-600 dark:fill-gray-600"}`}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(s)}
        />
      ))}
      {!interactive && count > 0 && <span className="text-[10px] text-muted-foreground ml-0.5">({count})</span>}
      {!interactive && count === 0 && <span className="text-[10px] text-muted-foreground ml-0.5">No ratings</span>}
    </div>
  );
}

// ─── Promo Banner Carousel ─────────────────────────────────────────────────
function PromoBanner() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PROMO_SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);
  const s = PROMO_SLIDES[idx];
  return (
    <div className="relative mx-0 mb-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35 }}
          className={`bg-gradient-to-r ${s.accent} rounded-2xl px-6 py-5 flex items-center justify-between overflow-hidden relative min-h-[120px]`}
        >
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/10" />
          <div className="absolute right-20 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="z-10">
            <span className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full">{s.badge}</span>
            <h2 className="text-white text-2xl font-black mt-2 leading-tight">{s.headline}</h2>
            <p className="text-white/80 text-xs mt-0.5 mb-3">{s.sub}</p>
            <button className="bg-white text-[10px] font-bold text-slate-800 px-3 py-1.5 rounded-full flex items-center gap-1">
              {s.tag} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="text-7xl z-10 select-none">{s.emoji}</div>
        </motion.div>
      </AnimatePresence>
      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={`rounded-full transition-all duration-300 ${i === idx ? "w-6 h-2 bg-tsia-green" : "w-2 h-2 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Category Circle Row ───────────────────────────────────────────────────
function CategoryRow({ activeCategory, setActiveCategory }: { activeCategory: string; setActiveCategory: (c: string) => void }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
      {/* All */}
      <button onClick={() => setActiveCategory("")} data-testid="cat-all" className="flex flex-col items-center gap-1.5 shrink-0">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${!activeCategory ? "border-tsia-green shadow-lg shadow-tsia-green/20" : "border-transparent bg-muted"}`}>
          🛍️
        </div>
        <span className={`text-[11px] font-semibold ${!activeCategory ? "text-tsia-green" : "text-muted-foreground"}`}>All</span>
      </button>
      {CATEGORIES.map(c => (
        <button key={c} onClick={() => setActiveCategory(activeCategory === c ? "" : c)} data-testid={`cat-${c}`} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${CATEGORY_GRADIENTS[c]} flex items-center justify-center text-2xl border-2 transition-all ${activeCategory === c ? "border-white ring-2 ring-tsia-green shadow-lg" : "border-transparent"}`}>
            {CATEGORY_ICONS[c]}
          </div>
          <span className={`text-[11px] font-semibold truncate max-w-[56px] text-center ${activeCategory === c ? "text-tsia-green" : "text-muted-foreground"}`}>{CATEGORY_LABELS[c]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Seller Stories ────────────────────────────────────────────────────────
function SellerStories({ products }: { products: Product[] }) {
  const seen = new Set<number>();
  const unique = products.filter(p => { if (seen.has(p.sellerId)) return false; seen.add(p.sellerId); return true; }).slice(0, 8);
  const STORY_GRADIENTS = [
    "from-pink-500 to-orange-400","from-purple-500 to-indigo-500","from-teal-400 to-green-500",
    "from-yellow-400 to-orange-500","from-blue-500 to-cyan-400","from-red-500 to-pink-400",
  ];
  if (unique.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base">Top Sellers</h3>
        <button className="text-xs text-tsia-green font-semibold flex items-center gap-0.5">View all <ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {unique.map((p, i) => (
          <div key={p.sellerId} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${STORY_GRADIENTS[i % STORY_GRADIENTS.length]} flex items-center justify-center text-xl font-bold text-white ring-2 ring-tsia-green ring-offset-2`}>
              {p.sellerName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <span className="text-[10px] text-muted-foreground truncate max-w-[56px] text-center font-medium">{p.sellerName?.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Image Lightbox ────────────────────────────────────────────────────────
function ImageLightbox({ images, startIndex = 0, open, onClose }: {
  images: string[]; startIndex?: number; open: boolean; onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => { setIdx(startIndex); }, [startIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, images.length, onClose]);

  if (!images.length) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox-bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center"
          onClick={onClose}
          data-testid="image-lightbox"
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
            onClick={onClose} data-testid="btn-lightbox-close"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
              {idx + 1} / {images.length}
            </div>
          )}

          {/* Image */}
          <motion.img
            key={idx}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2 }}
            src={images[idx]}
            alt={`Image ${idx + 1}`}
            className="max-w-[95vw] max-h-[80vh] object-contain rounded-xl select-none"
            onClick={e => e.stopPropagation()}
            draggable={false}
          />

          {/* Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
                data-testid="btn-lightbox-prev"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
                data-testid="btn-lightbox-next"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Dot strip */}
          {images.length > 1 && (
            <div className="absolute bottom-6 flex items-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setIdx(i); }}
                  className={`rounded-full transition-all ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          )}

          {/* Thumbnail strip (multi-image) */}
          {images.length > 1 && (
            <div className="absolute bottom-14 flex gap-2 overflow-x-auto max-w-[90vw] px-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setIdx(i); }}
                  className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? "border-white" : "border-white/20 opacity-60 hover:opacity-90"}`}
                >
                  <img src={src} className="w-full h-full object-cover" alt="" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Cart Drawer ───────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, cartIds, onBuy, onRemove, onClearAll }: {
  open: boolean; onClose: () => void; cartIds: Set<number>;
  onBuy: (product: Product) => void; onRemove: (id: number) => void; onClearAll: () => void;
}) {
  const { formatAmount } = useLocalCurrency();
  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/browse-all"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      return res.json();
    },
    enabled: open && cartIds.size > 0,
    staleTime: 30_000,
  });

  const cartItems = (allProducts as Product[]).filter(p => cartIds.has(p.id));
  const stalePids = [...cartIds].filter(id => !allProducts.find(p => p.id === id));
  const outOfStockCount = cartItems.filter(p => p.stock === 0).length;
  const totalValue = cartItems.reduce((s, p) => s + parseFloat(p.price), 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="cart-panel"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-card flex flex-col"
            data-testid="cart-drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b shrink-0 bg-card/95 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform" data-testid="btn-cart-close">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-tsia-green" />
                  <h3 className="font-bold text-lg">My Cart</h3>
                  {cartIds.size > 0 && (
                    <span className="w-6 h-6 bg-tsia-green text-white text-xs font-bold rounded-full flex items-center justify-center">{cartIds.size}</span>
                  )}
                </div>
              </div>
              {cartIds.size > 0 && (
                <button onClick={onClearAll} className="text-xs text-red-500 font-semibold hover:text-red-700 transition-colors">Clear all</button>
              )}
            </div>

            {/* Out-of-stock warning */}
            {outOfStockCount > 0 && (
              <div className="mx-5 mt-4 shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span><strong>{outOfStockCount}</strong> item{outOfStockCount > 1 ? "s are" : " is"} out of stock — you cannot order {outOfStockCount > 1 ? "them" : "it"} right now.</span>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartIds.size === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-14 h-14 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-semibold mb-1">Your cart is empty</p>
                  <p className="text-muted-foreground text-sm">Browse the marketplace and save items here.</p>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
                </div>
              ) : (
                <>
                  {cartItems.map(p => {
                    const img = p.images?.[0];
                    const outOfStock = p.stock === 0;
                    return (
                      <div key={p.id} data-testid={`cart-item-${p.id}`}
                        className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${outOfStock ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800 opacity-80" : "bg-card border-border hover:shadow-sm"}`}
                      >
                        {/* Image */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                          {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[p.category]}</div>}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-white text-center leading-tight px-1">OUT OF STOCK</span>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.condition}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm font-black text-tsia-green">${parseFloat(p.price).toFixed(2)}</span>
                            <span className="text-[11px] text-muted-foreground">{formatAmount(parseFloat(p.price))}</span>
                            {p.negotiable && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">NEGO</span>}
                          </div>
                          {outOfStock ? (
                            <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" />Out of stock</span>
                          ) : (
                            <span className="text-[11px] text-tsia-green font-medium">{p.stock} available</span>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => { onBuy(p); }}
                            disabled={outOfStock}
                            data-testid={`btn-cart-buy-${p.id}`}
                            className="h-8 px-3 bg-tsia-green hover:bg-tsia-green/90 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            {outOfStock ? "Unavailable" : "Buy"}
                          </button>
                          <button
                            onClick={() => onRemove(p.id)}
                            data-testid={`btn-cart-remove-${p.id}`}
                            className="h-8 px-3 border border-red-200 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Products removed from platform */}
                  {stalePids.map(id => (
                    <div key={id} className="flex items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/20 p-3 opacity-60">
                      <div className="w-16 h-16 rounded-xl bg-muted shrink-0 flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-muted-foreground">Product no longer available</p>
                        <p className="text-xs text-muted-foreground">This listing was removed by the seller.</p>
                      </div>
                      <button onClick={() => onRemove(id)} className="h-8 px-3 border text-xs font-medium rounded-xl hover:bg-muted transition-all">Remove</button>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer total */}
            {cartItems.length > 0 && (
              <div className="p-5 border-t shrink-0 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Estimated total ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})</span>
                  <span className="font-black text-lg text-tsia-green">${totalValue.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">Prices may vary after negotiation. Buy each item separately — your payment is held in escrow until you confirm receipt.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Product Card (Grid) ───────────────────────────────────────────────────
function ProductCard({ product, onView, onBuy, wishlisted, onWishlist, inCart, onCart, watched, onWatch, isSeller }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
  inCart: boolean; onCart: () => void; watched?: boolean; onWatch?: () => void; isSeller?: boolean;
}) {
  const { formatAmount } = useLocalCurrency();
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  return (
    <>
    <motion.div
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group border border-border/50"
      onClick={onView}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 overflow-hidden">
        {img ? (
          <img
            src={img} alt={product.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-3xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 pointer-events-none">
            <Eye className="w-3 h-3" /> View details
          </span>
        </div>
        {/* Wishlist + Watch */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={e => { e.stopPropagation(); onWishlist(); }}
            data-testid={`btn-wishlist-${product.id}`}
            className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-sm transition-colors hover:bg-white"
          >
            <Heart className={`w-4 h-4 transition-colors ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
          </button>
          {onWatch && (
            <button
              onClick={e => { e.stopPropagation(); onWatch(); }}
              data-testid={`btn-watch-${product.id}`}
              title={watched ? "Unwatch price" : "Watch price drop"}
              className="w-10 h-10 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-sm transition-colors hover:bg-white"
            >
              <Bell className={`w-4 h-4 transition-colors ${watched ? "fill-tsia-green text-tsia-green" : "text-slate-400"}`} />
            </button>
          )}
        </div>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.condition === "new" && (
            <span className="text-[9px] font-bold bg-tsia-green text-white px-2 py-0.5 rounded-full">NEW</span>
          )}
          {product.negotiable && (
            <span className="text-[9px] font-bold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full">NEGO</span>
          )}
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-muted-foreground mb-0.5 truncate">{CATEGORY_LABELS[product.category]}</p>
        <h3 className="font-semibold text-[13px] leading-snug line-clamp-2 mb-1.5 min-h-[2.5rem]">{product.title}</h3>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="flex items-center justify-between mt-2">
          <div>
            <div>
              <span className="text-base font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
              <span className="text-[11px] text-muted-foreground line-through ml-1">${orig}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{formatAmount(parseFloat(product.price))}</p>
          </div>
          {isSeller ? (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">Your listing</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={e => { e.stopPropagation(); onCart(); }}
                data-testid={`btn-cart-add-${product.id}`}
                title={inCart ? "Remove from cart" : "Add to cart"}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors border ${inCart ? "bg-tsia-green/10 border-tsia-green text-tsia-green" : "bg-muted border-border text-muted-foreground hover:border-tsia-green hover:text-tsia-green"}`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onBuy(); }}
                disabled={product.stock === 0}
                data-testid={`btn-buy-${product.id}`}
                className="w-10 h-10 bg-tsia-green rounded-full flex items-center justify-center shadow-md hover:bg-tsia-green/90 disabled:opacity-40 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    </>
  );
}

// ─── Featured Card (Horizontal scroll) ────────────────────────────────────
function FeaturedCard({ product, onView, onBuy, wishlisted, onWishlist, inCart, onCart, watched, onWatch, isSeller }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
  inCart: boolean; onCart: () => void; watched?: boolean; onWatch?: () => void; isSeller?: boolean;
}) {
  const { formatAmount } = useLocalCurrency();
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  return (
    <div
      onClick={onView}
      data-testid={`card-featured-${product.id}`}
      className="shrink-0 w-40 bg-card rounded-2xl overflow-hidden shadow-md border border-border/50 cursor-pointer hover:shadow-lg transition-shadow group"
    >
      <div className="relative w-40 h-44 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
        {img ? (
          <img src={img} alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          className="absolute top-2 right-2 w-7 h-7 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center">
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
        </button>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-[9px] font-bold bg-black/60 px-2 py-0.5 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-[12px] font-semibold line-clamp-2 leading-snug mb-1">{product.title}</p>
        <div className="flex items-end justify-between gap-1">
          <div>
            <p className="text-[13px] font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground line-through">${orig}</p>
            <p className="text-[9px] text-muted-foreground">{formatAmount(parseFloat(product.price))}</p>
          </div>
          {isSeller ? (
            <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Yours</span>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={e => { e.stopPropagation(); onCart(); }}
                data-testid={`btn-featured-cart-${product.id}`}
                title={inCart ? "Remove from cart" : "Add to cart"}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all hover:scale-105 ${inCart ? "bg-tsia-green/10 border-tsia-green text-tsia-green" : "bg-muted border-border text-muted-foreground"}`}>
                <ShoppingCart className="w-3 h-3" />
              </button>
              <button onClick={e => { e.stopPropagation(); onBuy(); }}
                disabled={product.stock === 0}
                className="w-7 h-7 bg-tsia-gold rounded-full flex items-center justify-center shadow hover:scale-105 transition-transform disabled:opacity-40"
                data-testid={`btn-featured-buy-${product.id}`}>
                <ArrowLeftRight className="w-3 h-3 text-slate-900" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── List Product Modal ────────────────────────────────────────────────────
function ListProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK", negotiable: false });
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/products", data); return res.json(); },
    onSuccess: () => {
      toast({ title: "Product listed!", description: "Your product is now live in the marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/my"] });
      onClose();
      setForm({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK", negotiable: false });
      setImages([]);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const compressImage = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, ECOMMERCE.MAX_IMAGES - images.length);
    files.forEach(f => {
      compressImage(f).then(dataUrl =>
        setImages(prev => [...prev, dataUrl].slice(0, ECOMMERCE.MAX_IMAGES))
      );
    });
    e.target.value = "";
  };

  const commission = parseFloat(form.price || "0") * ECOMMERCE.COMMISSION_RATE;
  const youReceive = parseFloat(form.price || "0") - commission;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-tsia-green" /> List a Product</DialogTitle>
          <DialogDescription>TSIA takes {ECOMMERCE.COMMISSION_RATE * 100}% commission. You keep {(1 - ECOMMERCE.COMMISSION_RATE) * 100}%.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Photos (up to {ECOMMERCE.MAX_IMAGES})</Label>
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-border">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => setImages(p => p.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {images.length < ECOMMERCE.MAX_IMAGES && (
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                  <Camera className="w-5 h-5" /><span className="text-[10px] mt-1">Add photo</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImage} className="hidden" />
          </div>
          <div><Label>Title *</Label><Input placeholder="e.g. iPhone 14 Pro, Brand New" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} className="mt-1" data-testid="input-product-title" /></div>
          <div><Label>Description *</Label><textarea rows={3} placeholder="Describe condition, features, specs..." value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} data-testid="input-product-description" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price (USD) *</Label>
              <Input type="number" min={ECOMMERCE.MIN_PRICE} max={ECOMMERCE.MAX_PRICE} step={0.01} placeholder="0.00" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} className="mt-1" data-testid="input-product-price" />
              {parseFloat(form.price) > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">≈ {formatAmount(parseFloat(form.price))}</p>
              )}
            </div>
            <div><Label>Stock qty</Label><Input type="number" min={1} value={form.stock} onChange={e => setForm(p => ({...p, stock: e.target.value}))} className="mt-1" data-testid="input-product-stock" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} data-testid="select-product-category" className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label>Condition</Label>
              <select value={form.condition} onChange={e => setForm(p => ({...p, condition: e.target.value}))} data-testid="select-product-condition" className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                <option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>
          <div><Label>Your location</Label><Input placeholder="London, UK" value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} className="mt-1" data-testid="input-product-location" /></div>

          {/* Negotiable toggle */}
          <div className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${form.negotiable ? "border-tsia-green bg-tsia-green/5" : "border-border bg-muted/30"}`}
            onClick={() => setForm(p => ({...p, negotiable: !p.negotiable}))}
            data-testid="toggle-negotiable"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Accept Price Negotiations</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow buyers to propose a different price via chat before paying</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-3 ${form.negotiable ? "bg-tsia-green" : "bg-muted-foreground/30"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.negotiable ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>
          </div>

          {parseFloat(form.price) > 0 && (
            <div className="bg-tsia-green/5 rounded-xl p-4 border border-tsia-green/20">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5 text-tsia-green" /> Earnings breakdown</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Listing price</span><span className="font-semibold">${parseFloat(form.price || "0").toFixed(2)} <span className="text-xs font-normal text-muted-foreground">({formatAmount(parseFloat(form.price || "0"))})</span></span></div>
                <div className="flex justify-between"><span className="text-red-500">TSIA commission (8%)</span><span className="text-red-500">−${commission.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">You receive</span><span className="font-bold text-tsia-green">${youReceive.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">({formatAmount(youReceive)})</span></span></div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate({...form, images, price: parseFloat(form.price), stock: parseInt(form.stock), negotiable: form.negotiable})} disabled={createMutation.isPending || !form.title || !form.description || !form.price} data-testid="button-submit-product" className="bg-tsia-green text-white">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} List Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tracking Timeline ───────────────────────────────────────────────────────
function TrackingTimeline({ orderId }: { orderId: number }) {
  const { data: tracking = [], isLoading } = useQuery<TrackingEntry[]>({
    queryKey: [`/api/orders/${orderId}/tracking`],
    refetchInterval: 600_000,
  });
  if (isLoading) return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tracking…</div>;
  if (!tracking.length) return <p className="text-xs text-muted-foreground py-2">No tracking updates yet.</p>;
  return (
    <div className="mt-3 space-y-0">
      {[...tracking].reverse().map((t, i) => (
        <div key={t.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${i === 0 ? "bg-tsia-green" : "bg-muted-foreground/30"}`} />
            {i < tracking.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${i === 0 ? "text-tsia-green" : "text-foreground"}`}>{t.statusLabel}</span>
              {t.location && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{t.location}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{t.description}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(t.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Purchase Modal (Escrow) ─────────────────────────────────────────────────
function PurchaseModal({ product, open, onClose, walletBalance, onChat }: {
  product: Product | null; open: boolean; onClose: () => void; walletBalance: number; onChat?: () => void;
}) {
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const [qty, setQty] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const total = product ? parseFloat(product.price) * qty : 0;
  const commission = total * ECOMMERCE.COMMISSION_RATE;
  const sellerReceives = total - commission;
  const canAfford = walletBalance >= total;

  const buyMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/orders", data); return res.json(); },
    onSuccess: () => {
      toast({ title: "Order Placed — Funds in Escrow", description: "Your payment is secured. Release it to the seller once you receive your item.", className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      onClose(); setQty(1); setDeliveryAddress("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!product) return null;
  const img = product.images?.[0];

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setQty(1); setDeliveryAddress(""); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a5c38] to-[#0e3d25] px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Lock className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Escrow-Protected Order</span>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">{product.title}</h2>
          <p className="text-white/60 text-xs mt-0.5">Seller: {product.sellerName}</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Product thumbnail + price */}
          <div className="flex gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[product.category]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-2xl font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">({formatAmount(parseFloat(product.price))})</span>
                {product.negotiable && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">Negotiable</span>}
              </div>
              <p className="text-xs text-muted-foreground capitalize">{product.condition} · {CATEGORY_LABELS[product.category]}</p>
            </div>
          </div>

          {/* Qty selector */}
          {product.stock > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold shrink-0">Qty</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => Math.max(1,q-1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold hover:bg-muted/70 text-lg leading-none">−</button>
                <span className="w-8 text-center font-bold text-lg">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock,q+1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold hover:bg-muted/70 text-lg leading-none">+</button>
                <span className="text-xs text-muted-foreground">/{product.stock} available</span>
              </div>
            </div>
          )}

          {/* Delivery address */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery Address</Label>
            <Input placeholder="e.g. 14 Lagos Street, Abuja" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="mt-1.5 rounded-xl text-sm" />
          </div>

          {/* Escrow explanation */}
          <div className="bg-[#1a5c38]/8 dark:bg-[#1a5c38]/20 border border-[#1a5c38]/20 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-[#1a5c38] dark:text-green-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> How Escrow Protection Works</p>
            {[
              "Your payment is held securely by TSIA — the seller doesn't receive it yet.",
              "Seller confirms, ships, and adds real-time tracking updates.",
              "Once you receive your item, tap \"Mark as Received\" to release payment.",
              "Seller gets paid instantly. Both parties are protected.",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#1a5c38]/20 text-[#1a5c38] dark:text-green-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                <p className="text-[11px] text-[#1a5c38]/80 dark:text-green-400/80 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground text-xs"><span>Unit price × {qty}</span><span>${(parseFloat(product.price) * qty).toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>TSIA marketplace fee (8%)</span><span>−${commission.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5 text-sm"><span>You pay (held in escrow)</span><span className="text-tsia-green">${total.toFixed(2)}</span></div>
          </div>

          {/* Wallet status */}
          <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${canAfford ? "bg-green-50 dark:bg-green-900/20 text-green-700" : "bg-red-50 dark:bg-red-900/20 text-red-600"}`}>
            {canAfford ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            {canAfford ? `Wallet: $${walletBalance.toFixed(2)} — Sufficient` : `Insufficient — need $${(total - walletBalance).toFixed(2)} more`}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 flex gap-2">
          {onChat && (
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-semibold" onClick={() => { onClose(); onChat(); }} data-testid="btn-chat-seller">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              {product.negotiable ? "Negotiate" : "Chat Seller"}
            </Button>
          )}
          <Button
            onClick={() => buyMutation.mutate({ productId: product.id, quantity: qty, deliveryAddress: deliveryAddress || undefined })}
            disabled={buyMutation.isPending || !canAfford}
            data-testid="button-confirm-purchase"
            className="flex-1 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-xl h-11"
          >
            {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
            Place Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Detail Modal ──────────────────────────────────────────────────
function ProductDetailModal({ product, open, onClose, onBuy, onChat, isSeller, inCart, onCart }: { product: Product | null; open: boolean; onClose: () => void; onBuy: () => void; onChat?: () => void; isSeller?: boolean; inCart?: boolean; onCart?: () => void }) {
  const { formatAmount } = useLocalCurrency();
  const { user } = useAuth();
  const { toast } = useToast();
  // Re-derive locally so same-email cross-account owners are always caught,
  // even if the parent passed an incorrect isSeller prop.
  const isMyListing = isSeller
    || product?.sellerId === user?.id
    || (!!product?.sellerEmail && !!user?.email && product.sellerEmail === user.email);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [ratingComment, setRatingComment] = useState("");
  const [pendingRating, setPendingRating] = useState(0);

  const { data: ratingsData, refetch: refetchRatings } = useQuery<{ ratings: ProductRatingEntry[]; summary: { avgRating: number; count: number } }>({
    queryKey: [`/api/products/${product?.id}/ratings`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/ratings`, { credentials: "include" });
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  const { data: myRating } = useQuery<{ rating: number; comment: string | null } | null>({
    queryKey: [`/api/products/${product?.id}/my-rating`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/my-rating`, { credentials: "include" });
      return res.json();
    },
    enabled: !!product?.id && open,
  });

  useEffect(() => {
    if (myRating) {
      setPendingRating(myRating.rating);
      setRatingComment(myRating.comment ?? "");
    } else {
      setPendingRating(0);
      setRatingComment("");
    }
  }, [myRating]);

  const rateMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment: string }) => {
      const res = await apiRequest("POST", `/api/products/${product!.id}/rate`, { rating, comment });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rating submitted!", description: "Thank you for your feedback." });
      refetchRatings();
      queryClient.invalidateQueries({ queryKey: [`/api/products/${product?.id}/my-rating`] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!product) return null;
  const imgs = product.images?.length ? product.images : [];
  const orig = originalPrice(product.price);
  const disc = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);
  const avgRating = ratingsData?.summary?.avgRating ?? product.avgRating ?? 0;
  const ratingCount = ratingsData?.summary?.count ?? product.ratingCount ?? 0;
  const canRate = !isMyListing;

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Image hero */}
        <div className="relative w-full aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-t-2xl overflow-hidden group">
          {imgs.length > 0 ? (
            <img
              src={imgs[imgIdx]} alt={product.title}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"><X className="w-4 h-4 text-white" /></button>
          {disc > 0 && <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">−{disc}%</div>}
          {imgs.length > 0 && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
              data-testid={`btn-detail-expand-${product.id}`}
            >
              <Expand className="w-4 h-4 text-white" />
            </button>
          )}
          {imgs.length > 1 && (
            <div className="absolute bottom-3 left-0 right-12 flex justify-center gap-1">
              {imgs.map((_, i) => <button key={i} onClick={() => setImgIdx(i)} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-white" : "bg-white/40"}`} />)}
            </div>
          )}
        </div>
        {/* Thumb strip */}
        {imgs.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
            {imgs.map((src, i) => (
              <button key={i}
                onClick={() => { setImgIdx(i); }}
                onDoubleClick={() => { setImgIdx(i); setLightboxOpen(true); }}
                className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === imgIdx ? "border-tsia-green" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                <img src={src} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}
        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">{CATEGORY_ICONS[product.category]} {CATEGORY_LABELS[product.category]}</p>
            <h2 className="text-xl font-bold mt-0.5 leading-tight">{product.title}</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
              <span className="text-sm text-muted-foreground line-through ml-2">${orig}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{formatAmount(parseFloat(product.price))}</p>
            </div>
            <Badge className={product.condition === "new" ? "bg-tsia-green/10 text-tsia-green border-tsia-green/30" : "bg-muted text-muted-foreground"}>{product.condition}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <StarRating rating={avgRating} count={ratingCount} />
              {avgRating > 0 && <span className="text-[11px] font-semibold text-amber-500 ml-0.5">{avgRating.toFixed(1)}</span>}
            </div>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{product.location}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-tsia-green/10 flex items-center justify-center font-bold text-tsia-green text-lg">{product.sellerName?.[0]}</div>
            <div><p className="text-sm font-semibold">{product.sellerName}</p><p className="text-xs text-muted-foreground">Verified TSIA seller</p></div>
            <Badge className="ml-auto bg-tsia-green/10 text-tsia-green text-[10px]">✓ Verified</Badge>
          </div>
          <div className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex-wrap gap-2">
            <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1"><Package className="w-3.5 h-3.5" />{product.stock} in stock</span>
            {product.negotiable && (
              <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-1 rounded-full">
                <HandCoins className="w-3 h-3" /> Price Negotiable
              </span>
            )}
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Shipping details are arranged directly with the seller in chat. Use your TSIA email address for all payments to stay protected.</span>
          </div>

          {/* ── Rate this product ── */}
          {canRate && (
            <div className="border rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold">{myRating ? "Update your rating" : "Rate this product"}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={pendingRating} interactive onRate={r => setPendingRating(r)} />
                {pendingRating > 0 && <span className="text-sm font-bold text-amber-500">{pendingRating}/5</span>}
              </div>
              <Input
                placeholder="Leave a comment (optional)"
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                className="rounded-xl text-sm"
                data-testid="input-rating-comment"
              />
              <Button
                onClick={() => rateMutation.mutate({ rating: pendingRating, comment: ratingComment })}
                disabled={pendingRating === 0 || rateMutation.isPending}
                size="sm"
                className="bg-tsia-green text-white rounded-xl w-full"
                data-testid="btn-submit-rating"
              >
                {rateMutation.isPending ? "Submitting…" : myRating ? "Update rating" : "Submit rating"}
              </Button>
            </div>
          )}

          {/* ── Reviews list ── */}
          {(ratingsData?.ratings?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{ratingsData!.ratings.length} Review{ratingsData!.ratings.length !== 1 ? "s" : ""}</p>
              {ratingsData!.ratings.slice(0, 5).map(r => (
                <div key={r.id} className="bg-muted/40 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{r.userName}</p>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-2.5 h-2.5 ${s <= r.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-300"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                  <p className="text-[10px] text-muted-foreground/60">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex flex-col gap-3">
          {isMyListing ? (
            <div className="w-full py-3 px-4 bg-muted rounded-2xl text-center text-sm font-semibold text-muted-foreground">
              This is your listing
            </div>
          ) : (
            <>
              <Button onClick={onBuy} disabled={product.stock === 0} className="w-full py-4 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-base" data-testid={`btn-detail-buy-${product.id}`}>
                <Lock className="w-5 h-5 mr-2" />
                {product.negotiable ? "Negotiate & Buy" : "Buy with Escrow"}
                {" "}— ${parseFloat(product.price).toFixed(2)}
              </Button>
              {onCart && (
                <Button
                  variant="outline"
                  onClick={onCart}
                  className={`w-full rounded-2xl font-semibold h-11 transition-all ${inCart ? "border-tsia-green text-tsia-green bg-tsia-green/5" : ""}`}
                  data-testid={`btn-detail-cart-${product.id}`}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {inCart ? "Remove from Cart" : "Save to Cart"}
                </Button>
              )}
            </>
          )}
          {!isMyListing && onChat && (
            <Button variant="outline" onClick={onChat} className="w-full rounded-2xl font-semibold h-11" data-testid={`btn-detail-chat-${product.id}`}>
              <MessageCircle className="w-4 h-4 mr-2" /> Chat with Seller
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {imgs.length > 0 && <ImageLightbox images={imgs} startIndex={imgIdx} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />}
  </>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function EcommerceSection({ initialOpenChatId }: { initialOpenChatId?: number | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tsia_wishlist") || "[]")); } catch { return new Set(); }
  });
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSort, setFilterSort] = useState<"newest"|"price-asc"|"price-desc"|"popular">("newest");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterCondition, setFilterCondition] = useState<""|"new"|"used"|"refurbished">("");
  const [filterViewMode, setFilterViewMode] = useState<"grid"|"list">("grid");
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [pendingChatId, setPendingChatId] = useState<number | null>(initialOpenChatId ?? null);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [chatProductOpen, setChatProductOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tsia_cart") || "[]")); } catch { return new Set(); }
  });

  // Escrow / tracking state
  const [expandedTracking, setExpandedTracking] = useState<Set<number>>(new Set());
  const [shipOrderId, setShipOrderId] = useState<number | null>(null);
  const [shipTrackingNumber, setShipTrackingNumber] = useState("");
  const [trackUpdateOrderId, setTrackUpdateOrderId] = useState<number | null>(null);
  const [trackLabel, setTrackLabel] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [trackLocation, setTrackLocation] = useState("");

  // Auto-open chat drawer if initialOpenChatId is set
  useEffect(() => {
    if (initialOpenChatId) { setChatDrawerOpen(true); setPendingChatId(initialOpenChatId); }
  }, [initialOpenChatId]);

  // Listen for tsia:open-chat events (from notification bell)
  useEffect(() => {
    const handler = (e: Event) => {
      const chatId = (e as CustomEvent).detail?.chatId;
      if (chatId) { setPendingChatId(chatId); setChatDrawerOpen(true); }
    };
    window.addEventListener("tsia:open-chat", handler);
    return () => window.removeEventListener("tsia:open-chat", handler);
  }, []);

  const { data: wallet } = useQuery<any>({ queryKey: ["/api/wallet"] });
  const walletBalance = parseFloat(wallet?.balance ?? "0");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", activeCategory, activeSearch],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (activeCategory) p.set("category", activeCategory);
      if (activeSearch) p.set("search", activeSearch);
      const res = await fetch(`/api/products?${p}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: myListings = [] } = useQuery<Product[]>({ queryKey: ["/api/products/my"], enabled: tab === "my-listings" });
  const { data: purchases = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/purchases"], enabled: tab === "purchases" });
  const { data: sales = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/sales"], enabled: tab === "sales" });

  // Price alerts
  const { data: alertData } = useQuery<{ productIds: number[] }>({
    queryKey: ["/api/price-alerts"],
    enabled: !!user,
  });
  const watchedIds = new Set(alertData?.productIds ?? []);
  const toggleWatch = async (product: Product) => {
    if (!user) return toast({ title: "Sign in to watch prices", variant: "destructive" });
    try {
      if (watchedIds.has(product.id)) {
        await apiRequest("DELETE", `/api/price-alerts/${product.id}`);
        toast({ description: `Stopped watching "${product.title}"` });
      } else {
        await apiRequest("POST", "/api/price-alerts", { productId: product.id });
        toast({ description: `Watching "${product.title}" for price drops` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  // Category subscriptions
  const { data: catSubData } = useQuery<{ categories: string[] }>({
    queryKey: ["/api/category-subscriptions"],
    enabled: !!user,
  });
  const subscribedCats = new Set(catSubData?.categories ?? []);
  const toggleCategorySubscription = async (category: string) => {
    if (!user) return toast({ title: "Sign in to subscribe to categories", variant: "destructive" });
    try {
      if (subscribedCats.has(category)) {
        await apiRequest("DELETE", `/api/category-subscriptions/${encodeURIComponent(category)}`);
        toast({ description: `Unsubscribed from "${CATEGORY_LABELS[category] || category}"` });
      } else {
        await apiRequest("POST", "/api/category-subscriptions", { category });
        toast({ description: `You'll be notified when new items are listed in "${CATEGORY_LABELS[category] || category}"` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/category-subscriptions"] });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const toggleCart = (id: number) => {
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try { localStorage.setItem("tsia_cart", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const toggleWishlist = (id: number) => {
    setWishlist(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem("tsia_wishlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleView = (p: Product) => { setSelectedProduct(p); setDetailOpen(true); };
  const handleBuy = (p: Product) => {
    if (p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)) {
      toast({ title: "Your listing", description: "You cannot buy your own product.", variant: "destructive" });
      return;
    }
    if (p.stock <= 0 || p.status !== "active") {
      toast({ title: "Unavailable", description: "This product is not available for purchase.", variant: "destructive" });
      return;
    }
    setBuyProduct(p);
    setBuyOpen(true);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({id, status, trackingNumber, trackingLocation}: {id: number; status: string; trackingNumber?: string; trackingLocation?: string}) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status, trackingNumber, trackingLocation });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      setShipOrderId(null); setShipTrackingNumber("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markReceivedMutation = useMutation({
    mutationFn: async (orderId: number) => { const res = await apiRequest("POST", `/api/orders/${orderId}/mark-received`, {}); return res.json(); },
    onSuccess: (data: any) => {
      toast({ title: "Receipt Confirmed!", description: data.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addTrackingMutation = useMutation({
    mutationFn: async ({orderId, statusLabel, description, location}: {orderId: number; statusLabel: string; description: string; location?: string}) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/tracking`, { statusLabel, description, location });
      return res.json();
    },
    onSuccess: (_: any, vars: any) => {
      toast({ title: "Tracking Updated", description: "Buyer has been notified.", className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${vars.orderId}/tracking`] });
      setTrackUpdateOrderId(null); setTrackLabel(""); setTrackDesc(""); setTrackLocation("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Apply client-side filter/sort
  const filteredProducts = (products as Product[]).filter(p => {
    if (filterCondition && p.condition !== filterCondition) return false;
    const price = parseFloat(p.price);
    if (filterMinPrice && price < parseFloat(filterMinPrice)) return false;
    if (filterMaxPrice && price > parseFloat(filterMaxPrice)) return false;
    return true;
  }).sort((a, b) => {
    if (filterSort === "price-asc")  return parseFloat(a.price) - parseFloat(b.price);
    if (filterSort === "price-desc") return parseFloat(b.price) - parseFloat(a.price);
    if (filterSort === "popular")    return b.viewCount - a.viewCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
  });
  const activeFilterCount = [filterCondition, filterMinPrice, filterMaxPrice, filterSort !== "newest" ? filterSort : ""].filter(Boolean).length;
  const featured = filteredProducts.slice(0, 8);
  const gridProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, 12);

  const TABS = [
    { id: "browse" as Tab, label: "Home", icon: ShoppingBag },
    { id: "my-listings" as Tab, label: "Listings", icon: Tag },
    { id: "purchases" as Tab, label: "Orders", icon: ShoppingCart },
    { id: "sales" as Tab, label: "Sales", icon: TrendingUp },
  ];

  return (
    <div className="relative pb-24">
      {/* ── Top header (always visible) ─────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">Hello, {user?.firstName || "Shopper"}</p>
          <h1 className="text-2xl font-black tracking-tight">Welcome 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setChatDrawerOpen(true)} data-testid="btn-messages"
            className="relative w-10 h-10 bg-card rounded-full border flex items-center justify-center shadow-sm hover:shadow transition-shadow">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button onClick={() => setCartOpen(true)} data-testid="btn-cart" className="relative w-10 h-10 bg-card rounded-full border flex items-center justify-center shadow-sm hover:shadow transition-shadow">
            <ShoppingCart className="w-5 h-5" />
            {cart.size > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-tsia-green text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {Math.min(cart.size, 99)}
              </span>
            )}
          </button>
          <button onClick={() => setListOpen(true)} data-testid="btn-sell" className="w-10 h-10 bg-tsia-green rounded-full flex items-center justify-center shadow-md hover:bg-tsia-green/90">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-muted/60 rounded-2xl px-4 h-12 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setActiveSearch(search)}
            data-testid="input-search"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && <button onClick={() => { setSearch(""); setActiveSearch(""); }}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
        <button
          className="relative w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-md shrink-0 hover:opacity-90 transition-opacity"
          onClick={() => setFilterOpen(true)}
          data-testid="btn-filter"
        >
          <SlidersHorizontal className="w-5 h-5 text-white dark:text-slate-900" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-tsia-green text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-muted/40 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1 justify-center transition-all ${tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ BROWSE TAB ════════════════════════════════════════ */}
      {tab === "browse" && (
        <div className="space-y-7">
          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Categories</h3>
              <button onClick={() => setShowCategoriesModal(true)} className="text-xs text-tsia-green font-semibold flex items-center gap-0.5" data-testid="btn-view-all-cats">View All <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <CategoryRow activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
          </div>

          {/* Promo Banner */}
          <PromoBanner />

          {/* Featured */}
          {!activeSearch && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500" /> Featured</h3>
                <button className="text-xs text-tsia-green font-semibold flex items-center gap-0.5" onClick={() => setShowAllProducts(true)}>View All <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-4 overflow-hidden">
                  {[1,2,3].map(i => <div key={i} className="w-40 h-60 rounded-2xl bg-muted animate-pulse shrink-0" />)}
                </div>
              ) : featured.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No products yet — be the first to list!</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                  {featured.map(p => (
                    <FeaturedCard key={p.id} product={p} onView={() => handleView(p)} onBuy={() => handleBuy(p)} wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)} inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) { toast({ title: "Added to cart", description: `${p.title} saved to your cart.` }); } }} watched={watchedIds.has(p.id)} onWatch={() => toggleWatch(p)} isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stories / Top Sellers */}
          {!activeSearch && (products as Product[]).length > 0 && (
            <SellerStories products={products as Product[]} />
          )}

          {/* All Products / Search results */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">
                {activeSearch ? `Results for "${activeSearch}"` : activeCategory ? `${CATEGORY_LABELS[activeCategory] || activeCategory}` : "New Arrivals"}
              </h3>
              <div className="flex items-center gap-2">
                {activeCategory && user && (
                  <button
                    onClick={() => toggleCategorySubscription(activeCategory)}
                    data-testid={`btn-subscribe-cat-${activeCategory}`}
                    title={subscribedCats.has(activeCategory) ? "Unsubscribe from new arrivals" : "Get notified of new arrivals"}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${subscribedCats.has(activeCategory) ? "bg-tsia-green/10 border-tsia-green text-tsia-green" : "border-border text-muted-foreground hover:border-tsia-green hover:text-tsia-green"}`}
                  >
                    <Bell className="w-3 h-3" />
                    {subscribedCats.has(activeCategory) ? "Subscribed" : "Subscribe"}
                  </button>
                )}
                {(products as Product[]).length > 12 && !showAllProducts && (
                  <button className="text-xs text-tsia-green font-semibold" onClick={() => setShowAllProducts(true)}>See all {(products as Product[]).length}</button>
                )}
              </div>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1,2,3,4].map(i => <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />)}
              </div>
            ) : (products as Product[]).length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl">
                <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold mb-1">No products found</p>
                <p className="text-muted-foreground text-sm mb-4">Try a different search or category.</p>
                <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white"><Plus className="w-4 h-4 mr-1.5" /> Be the first to list</Button>
              </div>
            ) : (
              <>
                {filterViewMode === "grid" ? (
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {gridProducts.map(p => (
                      <ProductCard key={p.id} product={p} onView={() => handleView(p)} onBuy={() => handleBuy(p)} wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)} inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) { toast({ title: "Added to cart", description: `${p.title} saved to your cart.` }); } }} watched={watchedIds.has(p.id)} onWatch={() => toggleWatch(p)} isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gridProducts.map(p => {
                      const img = p.images?.[0];
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-card border rounded-2xl p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleView(p)}>
                          <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                            {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xl">{CATEGORY_ICONS[p.category]}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm line-clamp-1">{p.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{p.condition} · {p.category}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-tsia-green font-black text-sm">${parseFloat(p.price).toFixed(2)}</span>
                              <span className="text-[11px] text-muted-foreground line-through">${originalPrice(p.price)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)) ? (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">Your listing</span>
                            ) : (
                              <>
                                <button onClick={e => { e.stopPropagation(); toggleCart(p.id); if (!cart.has(p.id)) { toast({ title: "Added to cart", description: `${p.title} saved to your cart.` }); } }}
                                  data-testid={`btn-list-cart-${p.id}`}
                                  className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${cart.has(p.id) ? "bg-tsia-green/10 border-tsia-green text-tsia-green" : "bg-muted border-border text-muted-foreground"}`}
                                  title={cart.has(p.id) ? "Remove from cart" : "Add to cart"}>
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleBuy(p); }} className="w-11 h-11 bg-tsia-green rounded-xl flex items-center justify-center shrink-0" title="Buy (Escrow Protected)">
                                  <Lock className="w-4 h-4 text-white" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!showAllProducts && filteredProducts.length > 12 && (
                  <Button variant="outline" className="w-full mt-4 rounded-2xl" onClick={() => setShowAllProducts(true)}>
                    Load more products ({filteredProducts.length - 12} more) <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MY LISTINGS ══════════════════════════════════════ */}
      {tab === "my-listings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">{(myListings as Product[]).length} listing{(myListings as Product[]).length !== 1 ? "s" : ""}</p>
            <Button onClick={() => setListOpen(true)} size="sm" data-testid="btn-new-listing" className="bg-tsia-green text-white rounded-xl h-9">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New listing
            </Button>
          </div>
          {(myListings as Product[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl">
              <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No listings yet</p>
              <p className="text-muted-foreground text-sm mb-4">Start selling — TSIA only takes 8%.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white"><Plus className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {(myListings as Product[]).map(p => {
                const img = p.images?.[0];
                return (
                  <div key={p.id} data-testid={`card-listing-${p.id}`} className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-muted relative">
                      {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                      <Badge className={`absolute top-2 left-2 text-[10px] ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                      <p className="text-base font-black text-tsia-green">${parseFloat(p.price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{p.stock} in stock · {p.viewCount} views</p>
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7 rounded-xl" onClick={() => handleView(p)} data-testid={`btn-view-listing-${p.id}`}>View</Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7 rounded-xl text-amber-600 border-amber-300"
                          onClick={() => { apiRequest("PATCH", `/api/products/${p.id}`, { status: p.status === "paused" ? "active" : "paused" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/products/my"] })); }}>
                          {p.status === "paused" ? "Activate" : "Pause"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ PURCHASES ════════════════════════════════════════ */}
      {tab === "purchases" && (
        <div className="space-y-3">
          {(purchases as Order[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No orders yet</p>
              <p className="text-muted-foreground text-sm mb-4">Browse the marketplace and place your first order.</p>
              <Button onClick={() => setTab("browse")} variant="outline" className="rounded-2xl"><ShoppingBag className="w-4 h-4 mr-1.5" /> Shop now</Button>
            </div>
          ) : (purchases as Order[]).map(o => {
            const trackingOpen = expandedTracking.has(o.id);
            const canMarkReceived = !o.escrowReleased && ["confirmed","shipped"].includes(o.status);
            return (
              <div key={o.id} data-testid={`row-purchase-${o.id}`} className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">From {o.sellerName} · Order #{o.id}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})}</p>
                    {o.deliveryAddress && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Truck className="w-3 h-3" />{o.deliveryAddress}</p>}
                    {o.trackingNumber && <p className="text-xs text-amber-600 font-mono mt-1 flex items-center gap-1"><Package className="w-3 h-3" />Tracking: {o.trackingNumber}</p>}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-black text-base">${parseFloat(o.totalAmount).toFixed(2)}</p>
                    <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                    {!o.escrowReleased && o.status !== "cancelled" && (
                      <div className="mt-1 flex items-center gap-1 justify-end">
                        <Lock className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[9px] font-bold text-amber-600">In Escrow</span>
                      </div>
                    )}
                    {o.escrowReleased && (
                      <div className="mt-1 flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-2.5 h-2.5 text-tsia-green" />
                        <span className="text-[9px] font-bold text-tsia-green">Paid to Seller</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tracking toggle */}
                <button
                  onClick={() => setExpandedTracking(s => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}
                  className="w-full flex items-center justify-between text-xs font-semibold text-tsia-green py-3 border-t border-border/40"
                  data-testid={`btn-tracking-${o.id}`}
                >
                  <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Track Delivery</span>
                  {trackingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {trackingOpen && <TrackingTimeline orderId={o.id} />}

                {/* Mark as Received */}
                {canMarkReceived && (
                  <Button
                    size="sm"
                    className="w-full bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-xl min-h-11 text-xs"
                    onClick={() => markReceivedMutation.mutate(o.id)}
                    disabled={markReceivedMutation.isPending}
                    data-testid={`btn-received-${o.id}`}
                  >
                    {markReceivedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PackageOpen className="w-3.5 h-3.5 mr-1.5" />}
                    I Received My Item — Release Payment
                  </Button>
                )}
                {o.escrowReleased && (
                  <p className="text-[11px] text-center text-tsia-green font-semibold flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Payment released to seller · Order complete</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ SALES ════════════════════════════════════════════ */}
      {tab === "sales" && (
        <div className="space-y-3">
          {(sales as Order[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl">
              <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No sales yet</p>
              <p className="text-muted-foreground text-sm mb-4">List a product to start earning.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white rounded-2xl"><Tag className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (sales as Order[]).map(o => {
            const trackingOpen = expandedTracking.has(o.id);
            const isShippingThis = shipOrderId === o.id;
            const isTrackingThis = trackUpdateOrderId === o.id;
            return (
              <div key={o.id} data-testid={`row-sale-${o.id}`} className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">Buyer: {o.buyerName} · Order #{o.id}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})}</p>
                    {o.trackingNumber && <p className="text-xs text-amber-600 font-mono mt-1 flex items-center gap-1"><Package className="w-3 h-3" />Tracking: {o.trackingNumber}</p>}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    {o.escrowReleased
                      ? <p className="font-black text-base text-tsia-green">+${parseFloat(o.sellerReceives).toFixed(2)}</p>
                      : <div><p className="font-black text-base text-amber-600">${parseFloat(o.sellerReceives).toFixed(2)}</p><div className="flex items-center gap-1 justify-end mt-0.5"><Lock className="w-2.5 h-2.5 text-amber-500" /><span className="text-[9px] text-amber-600 font-bold">Pending</span></div></div>
                    }
                    <p className="text-[10px] text-muted-foreground">after 8% fee</p>
                    <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                  </div>
                </div>

                {/* Seller actions */}
                {o.status === "pending" && (
                  <Button size="sm" className="w-full min-h-11 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    onClick={() => updateStatusMutation.mutate({id: o.id, status: "confirmed"})} disabled={updateStatusMutation.isPending}
                    data-testid={`btn-confirm-${o.id}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Order
                  </Button>
                )}

                {o.status === "confirmed" && !isShippingThis && (
                  <Button size="sm" variant="outline" className="w-full min-h-11 text-xs rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    onClick={() => setShipOrderId(o.id)} data-testid={`btn-ship-open-${o.id}`}>
                    <Truck className="w-3.5 h-3.5 mr-1.5" /> Mark as Shipped
                  </Button>
                )}

                {o.status === "confirmed" && isShippingThis && (
                  <div className="space-y-2 bg-muted/40 rounded-xl p-3">
                    <p className="text-xs font-semibold">Add tracking number (optional)</p>
                    <Input placeholder="e.g. NG1234567890" value={shipTrackingNumber} onChange={e => setShipTrackingNumber(e.target.value)} className="min-h-11 text-xs rounded-xl font-mono" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 min-h-11 text-xs rounded-xl" onClick={() => setShipOrderId(null)}>Cancel</Button>
                      <Button size="sm" className="flex-1 min-h-11 text-xs rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
                        onClick={() => updateStatusMutation.mutate({id: o.id, status: "shipped", trackingNumber: shipTrackingNumber || undefined})}
                        disabled={updateStatusMutation.isPending} data-testid={`btn-ship-confirm-${o.id}`}>
                        {updateStatusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Truck className="w-3.5 h-3.5 mr-1" />} Confirm Shipped
                      </Button>
                    </div>
                  </div>
                )}

                {/* Add tracking update (available once shipped) */}
                {["shipped","confirmed"].includes(o.status) && !o.escrowReleased && !isTrackingThis && (
                  <button className="w-full min-h-11 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border-t border-border/40 pt-2"
                    onClick={() => setTrackUpdateOrderId(o.id)} data-testid={`btn-add-tracking-${o.id}`}>
                    <MapPin className="w-3 h-3" /> Add tracking update
                  </button>
                )}

                {isTrackingThis && (
                  <div className="space-y-2 bg-muted/40 rounded-xl p-3 border-t border-border/40">
                    <p className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Add Tracking Update</p>
                    <Input placeholder="Status (e.g. In Transit, Out for Delivery)" value={trackLabel} onChange={e => setTrackLabel(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                    <Input placeholder="Description" value={trackDesc} onChange={e => setTrackDesc(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                    <Input placeholder="Location (optional, e.g. Lagos Hub)" value={trackLocation} onChange={e => setTrackLocation(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 min-h-11 text-xs rounded-xl" onClick={() => { setTrackUpdateOrderId(null); setTrackLabel(""); setTrackDesc(""); setTrackLocation(""); }}>Cancel</Button>
                      <Button size="sm" className="flex-1 min-h-11 text-xs rounded-xl bg-tsia-green hover:bg-tsia-green/90 text-white font-bold"
                        onClick={() => addTrackingMutation.mutate({orderId: o.id, statusLabel: trackLabel, description: trackDesc, location: trackLocation || undefined})}
                        disabled={addTrackingMutation.isPending || !trackLabel || !trackDesc} data-testid={`btn-tracking-submit-${o.id}`}>
                        {addTrackingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />} Send Update
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tracking timeline toggle */}
                <button
                  onClick={() => setExpandedTracking(s => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}
                  className="w-full min-h-11 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground border-t border-border/40 pt-2"
                >
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {trackingOpen ? "Hide" : "View"} tracking timeline</span>
                  {trackingOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {trackingOpen && <TrackingTimeline orderId={o.id} />}

                {o.escrowReleased && (
                  <p className="text-[11px] text-center text-tsia-green font-semibold flex items-center justify-center gap-1.5 border-t border-border/40 pt-2"><CheckCircle2 className="w-3.5 h-3.5" /> Payment released to your wallet · Completed</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Floating sell button (browse tab, mobile) ─────────────────── */}
      {tab === "browse" && (
        <button onClick={() => setListOpen(true)} data-testid="btn-float-sell"
          className="fixed bottom-24 right-4 sm:hidden w-14 h-14 bg-tsia-green rounded-full shadow-xl flex items-center justify-center z-50 hover:bg-tsia-green/90">
          <Plus className="w-7 h-7 text-white" />
        </button>
      )}

      {/* ── Stats bar (browse tab only) ───────────────────────────────── */}
      {tab === "browse" && (products as Product[]).length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t">
          {[
            { label: "Products live", value: (products as Product[]).length, icon: Package, color: "text-blue-500" },
            { label: "In wishlist", value: wishlist.size, icon: Heart, color: "text-red-500" },
            { label: "Commission", value: "8%", icon: BadgePercent, color: "text-tsia-green" },
          ].map(s => (
            <div key={s.label} className="bg-card border rounded-2xl p-3 text-center">
              <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
              <p className="font-black text-lg">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <ListProductModal open={listOpen} onClose={() => setListOpen(false)} />
      <ProductDetailModal
        product={selectedProduct}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBuy={() => { setDetailOpen(false); setBuyProduct(selectedProduct); setBuyOpen(true); }}
        isSeller={selectedProduct?.sellerId === user?.id || (!!selectedProduct?.sellerEmail && selectedProduct.sellerEmail === user?.email)}
        onChat={() => { setDetailOpen(false); setChatProduct(selectedProduct); setChatProductOpen(true); }}
        inCart={selectedProduct ? cart.has(selectedProduct.id) : false}
        onCart={() => {
          if (!selectedProduct) return;
          const wasIn = cart.has(selectedProduct.id);
          toggleCart(selectedProduct.id);
          toast({ title: wasIn ? "Removed from cart" : "Saved to cart", description: wasIn ? `${selectedProduct.title} removed.` : `${selectedProduct.title} saved to your cart.` });
        }}
      />
      <PurchaseModal
        product={buyProduct}
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        walletBalance={walletBalance}
        onChat={() => { setBuyOpen(false); setChatProduct(buyProduct); setChatProductOpen(true); }}
      />

      {/* Chat components */}
      <EcommerceChatDrawer open={chatDrawerOpen} onClose={() => { setChatDrawerOpen(false); setPendingChatId(null); }} initialChatId={pendingChatId} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartIds={cart}
        onBuy={p => { setCartOpen(false); handleBuy(p); }}
        onRemove={id => {
          setCart(prev => {
            const next = new Set(prev);
            next.delete(id);
            try { localStorage.setItem("tsia_cart", JSON.stringify([...next])); } catch {}
            return next;
          });
        }}
        onClearAll={() => {
          setCart(new Set());
          try { localStorage.removeItem("tsia_cart"); } catch {}
        }}
      />
      {chatProduct && (
        <ProductChatModal
          productId={chatProduct.id}
          productTitle={chatProduct.title}
          sellerName={chatProduct.sellerName}
          open={chatProductOpen}
          onClose={() => { setChatProductOpen(false); setChatProduct(null); }}
        />
      )}

      {/* ── Categories Grid Modal ──────────────────────────────────────── */}
      <Dialog open={showCategoriesModal} onOpenChange={setShowCategoriesModal}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto" data-testid="modal-categories">
          <DialogHeader>
            <DialogTitle>All Categories</DialogTitle>
            <DialogDescription>Select a category to filter products</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {/* All */}
            <button
              onClick={() => { setActiveCategory(""); setShowCategoriesModal(false); }}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${!activeCategory ? "border-tsia-green bg-tsia-green/5" : "border-transparent bg-muted/50 hover:bg-muted"}`}
              data-testid="cat-modal-all"
            >
              <span className="text-2xl">🛍️</span>
              <div className="text-left">
                <p className="font-bold text-sm">All</p>
                <p className="text-[10px] text-muted-foreground">Everything</p>
              </div>
              {!activeCategory && <Check className="w-4 h-4 text-tsia-green ml-auto" />}
            </button>
            {CATEGORIES.map(c => (
              <button key={c}
                onClick={() => { setActiveCategory(c); setShowCategoriesModal(false); }}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${activeCategory === c ? "border-tsia-green bg-tsia-green/5" : "border-transparent bg-muted/50 hover:bg-muted"}`}
                data-testid={`cat-modal-${c}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CATEGORY_GRADIENTS[c]} flex items-center justify-center text-xl shrink-0`}>
                  {CATEGORY_ICONS[c]}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-bold text-sm truncate">{CATEGORY_LABELS[c]}</p>
                </div>
                {activeCategory === c && <Check className="w-4 h-4 text-tsia-green ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Filter Panel (slide-up sheet) ────────────────────────────── */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div key="filter-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setFilterOpen(false)} />
            <motion.div key="filter-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
              data-testid="filter-panel"
            >
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="font-bold text-lg flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-tsia-green" /> Filter & Sort</h3>
                <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {/* Sort */}
                <div>
                  <p className="font-bold text-sm mb-3 flex items-center gap-1.5"><ArrowUpDown className="w-4 h-4" /> Sort by</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "newest",     label: "Newest",        icon: "🆕" },
                      { id: "price-asc",  label: "Price: Low→High", icon: "⬆️" },
                      { id: "price-desc", label: "Price: High→Low", icon: "⬇️" },
                      { id: "popular",    label: "Most Popular",  icon: "🔥" },
                    ] as const).map(s => (
                      <button key={s.id} onClick={() => setFilterSort(s.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${filterSort === s.id ? "border-tsia-green bg-tsia-green/5 text-tsia-green" : "border-muted bg-muted/50"}`}
                        data-testid={`sort-${s.id}`}>
                        <span>{s.icon}</span> {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <p className="font-bold text-sm mb-3">💰 Price Range (USD)</p>
                  <div className="flex items-center gap-3">
                    <Input type="number" placeholder="Min" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} className="rounded-xl" data-testid="input-min-price" min={0} />
                    <span className="text-muted-foreground font-bold">–</span>
                    <Input type="number" placeholder="Max" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} className="rounded-xl" data-testid="input-max-price" min={0} />
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <p className="font-bold text-sm mb-3">📦 Condition</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["", "new", "used", "refurbished"] as const).map(c => (
                      <button key={c} onClick={() => setFilterCondition(c)}
                        className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all capitalize ${filterCondition === c ? "border-tsia-green bg-tsia-green/5 text-tsia-green" : "border-muted bg-muted/50"}`}
                        data-testid={`cond-${c || "any"}`}>
                        {c || "Any"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* View mode */}
                <div>
                  <p className="font-bold text-sm mb-3">🖼️ View mode</p>
                  <div className="flex gap-2">
                    <button onClick={() => setFilterViewMode("grid")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold ${filterViewMode === "grid" ? "border-tsia-green bg-tsia-green/5 text-tsia-green" : "border-muted bg-muted/50"}`}
                      data-testid="view-grid">
                      <Grid3X3 className="w-4 h-4" /> Grid
                    </button>
                    <button onClick={() => setFilterViewMode("list")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold ${filterViewMode === "list" ? "border-tsia-green bg-tsia-green/5 text-tsia-green" : "border-muted bg-muted/50"}`}
                      data-testid="view-list">
                      <List className="w-4 h-4" /> List
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => { setFilterSort("newest"); setFilterMinPrice(""); setFilterMaxPrice(""); setFilterCondition(""); }}>
                    Clear all
                  </Button>
                  <Button className="flex-1 rounded-2xl bg-tsia-green text-white" onClick={() => setFilterOpen(false)}>
                    Apply {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
