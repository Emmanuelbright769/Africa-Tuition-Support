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
  Lock, PackageOpen, Clock, ChevronUp, Send, ShieldCheck, RotateCcw
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

// ─── Amazon-style color palette ──────────────────────────────────────────────
const AMZ = {
  navy:    "#232F3E",
  navyMid: "#37475A",
  gold:    "#FFD814",
  goldHov: "#F7CA00",
  orange:  "#FF9900",
  text:    "#0F1111",
  muted:   "#565959",
  border:  "#D5D9D9",
  bg:      "#EAEDED",
  link:    "#007185",
  linkAlt: "#C45500",
  green:   "#067D62",
  red:     "#CC0C39",
  prime:   "#00A8E1",
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function StarRating({ rating = 0, count = 0, interactive = false, onRate }: { rating?: number; count?: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = interactive ? (hover || rating) : rating;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={`transition-colors ${interactive ? "w-5 h-5 cursor-pointer" : "w-3 h-3"} ${s <= Math.floor(display) ? "fill-[#FFA41C] text-[#FFA41C]" : "fill-[#DDD] text-[#DDD]"}`}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(s)}
        />
      ))}
      {!interactive && count > 0 && <span className="text-[11px] text-[#007185] ml-0.5">{count.toLocaleString()}</span>}
      {!interactive && count === 0 && <span className="text-[11px] text-muted-foreground ml-0.5">No ratings</span>}
    </div>
  );
}

// ─── Promo Banner Carousel (Amazon style) ──────────────────────────────────
function PromoBanner() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PROMO_SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);
  const s = PROMO_SLIDES[idx];
  return (
    <div className="relative mb-3 rounded overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          style={{ background: `linear-gradient(135deg,${s.accent.replace("from-[","").replace("] to-[",",").replace("]","")})` }}
          className="relative flex items-center justify-between px-8 py-8 min-h-[200px] overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5" />
          <div className="absolute right-10 -bottom-8 w-28 h-28 rounded-full bg-white/5" />
          <div className="z-10">
            <span className="text-[11px] font-bold bg-black/20 text-white px-3 py-1 rounded-full">{s.badge}</span>
            <h2 className="text-white text-3xl font-black mt-3 mb-1 leading-tight">{s.headline}</h2>
            <p className="text-white/80 text-sm mb-4">{s.sub}</p>
            <button style={{ background: AMZ.gold, color: AMZ.text, border: `1px solid ${AMZ.goldHov}` }}
              className="text-sm font-bold px-6 py-2 rounded flex items-center gap-2 hover:opacity-90 transition-opacity">
              {s.tag} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-8xl z-10 select-none">{s.emoji}</div>
        </motion.div>
      </AnimatePresence>
      {/* Prev / Next */}
      <button onClick={() => setIdx(i => (i - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow transition-colors z-20">
        <ChevronLeft className="w-5 h-5 text-gray-700" />
      </button>
      <button onClick={() => setIdx(i => (i + 1) % PROMO_SLIDES.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow transition-colors z-20">
        <ChevronRight className="w-5 h-5 text-gray-700" />
      </button>
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{ background: i === idx ? AMZ.gold : "rgba(255,255,255,0.5)" }}
            className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-2" : "w-2 h-2"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Category Row (Amazon style) ─────────────────────────────────────────────
function CategoryRow({ activeCategory, setActiveCategory }: { activeCategory: string; setActiveCategory: (c: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button onClick={() => setActiveCategory("")} data-testid="cat-all"
        style={{ border: !activeCategory ? `2px solid ${AMZ.orange}` : `1px solid ${AMZ.border}`, background: !activeCategory ? "#FFF3E0" : "white" }}
        className="flex flex-col items-center gap-1.5 shrink-0 px-4 py-3 rounded text-center min-w-[70px] transition-all">
        <span className="text-2xl">🛍️</span>
        <span style={{ color: !activeCategory ? AMZ.linkAlt : AMZ.text }} className="text-[11px] font-semibold whitespace-nowrap">All</span>
      </button>
      {CATEGORIES.map(c => (
        <button key={c} onClick={() => setActiveCategory(activeCategory === c ? "" : c)} data-testid={`cat-${c}`}
          style={{ border: activeCategory === c ? `2px solid ${AMZ.orange}` : `1px solid ${AMZ.border}`, background: activeCategory === c ? "#FFF3E0" : "white" }}
          className="flex flex-col items-center gap-1.5 shrink-0 px-4 py-3 rounded text-center min-w-[70px] transition-all">
          <span className="text-2xl">{CATEGORY_ICONS[c]}</span>
          <span style={{ color: activeCategory === c ? AMZ.linkAlt : AMZ.text }} className="text-[11px] font-semibold whitespace-nowrap truncate max-w-[68px]">{CATEGORY_LABELS[c]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Countdown timer (resets daily) ──────────────────────────────────────────
function CountdownBadge() {
  const [remaining, setRemaining] = useState(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return end.getTime() - Date.now();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      setRemaining(end.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return (
    <span style={{ background: AMZ.red, color: "white" }} className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded">
      <Clock className="w-2.5 h-2.5" /> Ends in {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ─── Hero category tile grid ─────────────────────────────────────────────────
const HERO_TILES = [
  { cat: "phones",     emoji: "📱", gradient: "linear-gradient(135deg,#1a73e8,#0d47a1)", label: "Phones & Tablets",      sub: "Smartphones, tablets & accessories" },
  { cat: "computers",  emoji: "💻", gradient: "linear-gradient(135deg,#1a5c38,#0e3d25)", label: "Computers & Laptops",   sub: "Laptops, desktops & peripherals" },
  { cat: "fashion",    emoji: "👗", gradient: "linear-gradient(135deg,#c2185b,#880e4f)", label: "Fashion & Style",        sub: "Clothing, shoes & accessories" },
  { cat: "beauty",     emoji: "💄", gradient: "linear-gradient(135deg,#e65100,#bf360c)", label: "Beauty & Personal Care", sub: "Skincare, makeup & wellness" },
  { cat: "electronics",emoji: "🔌", gradient: "linear-gradient(135deg,#4a148c,#311b92)", label: "Electronics & Gadgets",  sub: "Cameras, audio & smart devices" },
  { cat: "gaming",     emoji: "🎮", gradient: "linear-gradient(135deg,#00695c,#004d40)", label: "Gaming & Consoles",      sub: "Games, consoles & controllers" },
  { cat: "home",       emoji: "🏠", gradient: "linear-gradient(135deg,#795548,#4e342e)", label: "Home & Living",          sub: "Furniture, décor & kitchen" },
  { cat: "sports",     emoji: "⚽", gradient: "linear-gradient(135deg,#0277bd,#01579b)", label: "Sports & Fitness",       sub: "Equipment, apparel & outdoor gear" },
];

function HeroCategoryTiles({ products, onPick }: { products: Product[]; onPick: (cat: string) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {HERO_TILES.slice(0, 4).map(t => {
        const items = products.filter(p => p.category === t.cat || (t.cat === "fashion" && ["fashion_women","fashion_men","fashion_kids"].includes(p.category))).slice(0, 1);
        const heroImg = items[0]?.images?.[0];
        return (
          <button
            key={t.cat}
            onClick={() => onPick(t.cat)}
            style={{ background: "white", border: `1px solid ${AMZ.border}`, textAlign: "left" }}
            className="rounded p-0 overflow-hidden hover:shadow-md transition-shadow"
            data-testid={`hero-tile-${t.cat}`}
          >
            {/* Gradient header with emoji */}
            <div style={{ background: heroImg ? "none" : t.gradient, position: "relative", overflow: "hidden" }} className="h-28 flex items-center justify-center">
              {heroImg ? (
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div style={{ position: "absolute", inset: 0, background: t.gradient, opacity: 0.9 }} />
                  <span style={{ fontSize: 56, position: "relative", zIndex: 1, lineHeight: 1 }}>{t.emoji}</span>
                </>
              )}
            </div>
            {/* Label */}
            <div className="p-2.5">
              <p style={{ color: AMZ.text }} className="font-black text-[12px] leading-tight">{t.label}</p>
              <p style={{ color: AMZ.muted }} className="text-[10px] mt-0.5 leading-tight line-clamp-1">{t.sub}</p>
              <span style={{ color: AMZ.link }} className="text-[11px] font-semibold mt-1 block">Shop now →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Extended category shelf (scrollable row) ─────────────────────────────────
function CategoryShelf({ onPick }: { onPick: (cat: string) => void }) {
  return (
    <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ color: AMZ.text }} className="font-bold text-sm">Browse by Category</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {HERO_TILES.map(t => (
          <button key={t.cat} onClick={() => onPick(t.cat)} className="flex flex-col items-center gap-1.5 shrink-0 min-w-[60px]" data-testid={`shelf-cat-${t.cat}`}>
            <div style={{ background: t.gradient }} className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
              {t.emoji}
            </div>
            <span style={{ color: AMZ.text }} className="text-[10px] font-semibold text-center leading-tight max-w-[64px]">
              {t.label.split(" & ")[0].split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Top Sellers (Amazon "Sponsored Brands" style) ───────────────────────────
function SellerStories({ products }: { products: Product[] }) {
  const seen = new Set<number>();
  const unique = products.filter(p => { if (seen.has(p.sellerId)) return false; seen.add(p.sellerId); return true; }).slice(0, 8);
  const BADGE_COLORS = ["#E57728","#1BA39C","#8059D4","#C0392B","#2980B9","#27AE60","#7F8C8D","#D35400"];
  if (unique.length === 0) return null;
  return (
    <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ color: AMZ.text }} className="font-bold text-sm">Top Sellers on TSIA Market</h3>
        <span style={{ color: AMZ.link }} className="text-xs font-semibold cursor-pointer hover:underline">See all sellers →</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {unique.map((p, i) => (
          <div key={p.sellerId} className="flex flex-col items-center gap-2 shrink-0 min-w-[64px]">
            <div style={{ background: BADGE_COLORS[i % BADGE_COLORS.length] }}
              className="w-14 h-14 rounded flex items-center justify-center text-white text-xl font-black shadow-sm">
              {p.sellerName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <span style={{ color: AMZ.link }} className="text-[10px] font-semibold truncate max-w-[64px] text-center hover:underline cursor-pointer">
              {p.sellerName?.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Image Lightbox ────────────────────────────────────────────────────────
// Uses createPortal to render directly onto document.body, completely outside
// any Radix Dialog stacking context or overflow-hidden ancestor — this is the
// only 100% reliable fix for the "lightbox is offset / black area" bug on mobile.
function ImageLightbox({ images, startIndex = 0, open, onClose }: {
  images: string[]; startIndex?: number; open: boolean; onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => { setIdx(startIndex); }, [startIndex, open]);
  useEffect(() => { if (open) setImgLoaded(false); }, [open, idx]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!images.length || !open) return null;

  return createPortal(
    <div
      data-testid="image-lightbox"
      style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", touchAction: "none" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        style={{ position: "absolute", top: 16, right: 16, zIndex: 2, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={e => { e.stopPropagation(); onClose(); }} data-testid="btn-lightbox-close"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 2, background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500, padding: "4px 14px", borderRadius: 20 }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Loading spinner */}
      {!imgLoaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Image */}
      <img
        key={idx}
        src={images[idx]}
        alt={`Image ${idx + 1}`}
        style={{ maxWidth: "95vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, userSelect: "none", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.15s" }}
        onLoad={() => setImgLoaded(true)}
        draggable={false}
        decoding="async"
        onClick={e => e.stopPropagation()}
      />

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i => (i - 1 + images.length) % images.length); }}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 2, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            data-testid="btn-lightbox-prev"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i => (i + 1) % images.length); }}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 2, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            data-testid="btn-lightbox-next"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Dot strip */}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 24, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
          {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setImgLoaded(false); setIdx(i); }}
                className={`rounded-full transition-all ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 56, display: "flex", gap: 8, overflowX: "auto", maxWidth: "90vw", padding: "0 8px", zIndex: 2 }}
            onClick={e => e.stopPropagation()}>
            {images.map((src, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i); }}
                style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 8, overflow: "hidden", border: i === idx ? "2px solid white" : "2px solid rgba(255,255,255,0.2)", opacity: i === idx ? 1 : 0.6, cursor: "pointer", padding: 0, background: "none" }}
              >
                <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}
    </div>,
    document.body
  );
}

// ─── Cart Drawer ───────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, cartIds, onBuy, onRemove, onClearAll }: {
  open: boolean; onClose: () => void; cartIds: Set<number>;
  onBuy: (product: Product) => void; onRemove: (id: number) => void; onClearAll: () => void;
}) {
  const { formatAmount } = useLocalCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = 0; }, [open]);
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
            <div className="flex items-center justify-between px-4 py-4 border-b shrink-0 bg-card z-10">
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
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
  const discPct = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);
  return (
    <div
      style={{ background: "white", border: `1px solid ${AMZ.border}` }}
      className="rounded overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group flex flex-col"
      onClick={onView}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image area */}
      <div className="relative bg-[#F7F8F8] flex items-center justify-center overflow-hidden" style={{ aspectRatio: "1/1" }}>
        {img ? (
          <img src={img} alt={product.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-400 p-2" />
        ) : (
          <span className="text-5xl select-none">{CATEGORY_ICONS[product.category] || "📦"}</span>
        )}
        {/* Wishlist */}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          data-testid={`btn-wishlist-${product.id}`}
          className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
          <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
        </button>
        {onWatch && (
          <button onClick={e => { e.stopPropagation(); onWatch(); }}
            data-testid={`btn-watch-${product.id}`}
            className="absolute top-12 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
            <Bell className={`w-4 h-4 ${watched ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
          </button>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.condition === "new" && (
            <span style={{ background: AMZ.green }} className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-sm">NEW</span>
          )}
          {discPct > 0 && (
            <span style={{ background: AMZ.red }} className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-sm">-{discPct}%</span>
          )}
          {product.negotiable && (
            <span className="text-[9px] font-bold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-sm">NEGO</span>
          )}
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/70 px-3 py-1 rounded-sm">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p style={{ color: AMZ.muted }} className="text-[11px] uppercase tracking-wide">{CATEGORY_LABELS[product.category]}</p>
        <h3 style={{ color: AMZ.link }} className="text-[13px] leading-snug line-clamp-2 min-h-[2.5rem] hover:underline cursor-pointer">{product.title}</h3>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="mt-1">
          <span style={{ color: AMZ.red }} className="text-[11px] font-bold">{discPct}% off </span>
          <span style={{ color: AMZ.text }} className="text-base font-black">${parseFloat(product.price).toFixed(2)}</span>
          <span style={{ color: AMZ.muted }} className="text-[11px] line-through ml-1">${orig}</span>
        </div>
        <p style={{ color: AMZ.muted }} className="text-[10px]">{formatAmount(parseFloat(product.price))}</p>
        {/* Stock indicator */}
        {product.stock > 0 && product.stock <= 5 && (
          <p style={{ color: AMZ.red }} className="text-[11px] font-semibold">Only {product.stock} left in stock!</p>
        )}
        {product.stock > 5 && (
          <p style={{ color: AMZ.green }} className="text-[11px] font-semibold">In Stock</p>
        )}
      </div>

      {/* CTA buttons — Amazon style */}
      {!isSeller && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 mt-auto">
          <button
            onClick={e => { e.stopPropagation(); onCart(); }}
            data-testid={`btn-cart-add-${product.id}`}
            style={{ background: inCart ? AMZ.goldHov : AMZ.gold, border: `1px solid ${AMZ.goldHov}`, color: AMZ.text }}
            className="w-full py-2 text-[12px] font-bold rounded-full transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <ShoppingCart className="w-3.5 h-3.5" />
            {inCart ? "In Cart ✓" : "Add to Cart"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onBuy(); }}
            disabled={product.stock === 0}
            data-testid={`btn-buy-${product.id}`}
            style={{ background: AMZ.orange, border: `1px solid #E07B00`, color: "white" }}
            className="w-full py-2 text-[12px] font-bold rounded-full transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Lock className="w-3.5 h-3.5" />
            Buy Now (Escrow)
          </button>
        </div>
      )}
      {isSeller && (
        <div className="px-3 pb-3">
          <span style={{ color: AMZ.muted }} className="text-[10px] font-semibold block text-center py-1">Your listing</span>
        </div>
      )}
    </div>
  );
}

// ─── Featured Card (Amazon horizontal scroll) ─────────────────────────────
function FeaturedCard({ product, onView, onBuy, wishlisted, onWishlist, inCart, onCart, watched, onWatch, isSeller }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
  inCart: boolean; onCart: () => void; watched?: boolean; onWatch?: () => void; isSeller?: boolean;
}) {
  const { formatAmount } = useLocalCurrency();
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  const discPct = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);
  return (
    <div
      onClick={onView}
      data-testid={`card-featured-${product.id}`}
      style={{ background: "white", border: `1px solid ${AMZ.border}` }}
      className="shrink-0 w-44 rounded overflow-hidden cursor-pointer hover:shadow-md transition-shadow group flex flex-col"
    >
      {/* Image */}
      <div className="relative bg-[#F7F8F8] flex items-center justify-center" style={{ height: 160 }}>
        {img ? (
          <img src={img} alt={product.title} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform" />
        ) : (
          <span className="text-5xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 hover:bg-gray-50">
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
        </button>
        {discPct > 0 && (
          <span style={{ background: AMZ.red }} className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-sm">-{discPct}%</span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-[9px] font-bold bg-black/70 px-2 py-0.5 rounded-sm">Out of Stock</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p style={{ color: AMZ.link }} className="text-[12px] line-clamp-2 leading-snug hover:underline">{product.title}</p>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div>
          <span style={{ color: AMZ.text }} className="text-[13px] font-black">${parseFloat(product.price).toFixed(2)}</span>
          <span style={{ color: AMZ.muted }} className="text-[10px] line-through ml-1">${orig}</span>
        </div>
        <p style={{ color: AMZ.muted }} className="text-[9px]">{formatAmount(parseFloat(product.price))}</p>
      </div>
      {/* CTA */}
      {!isSeller ? (
        <div className="px-2.5 pb-2.5 flex gap-1.5">
          <button onClick={e => { e.stopPropagation(); onCart(); }}
            data-testid={`btn-featured-cart-${product.id}`}
            style={{ background: inCart ? AMZ.goldHov : AMZ.gold, border: `1px solid ${AMZ.goldHov}`, color: AMZ.text }}
            className="flex-1 py-1.5 text-[10px] font-bold rounded-full flex items-center justify-center gap-0.5">
            <ShoppingCart className="w-3 h-3" /> {inCart ? "✓" : "Cart"}
          </button>
          <button onClick={e => { e.stopPropagation(); onBuy(); }}
            disabled={product.stock === 0}
            data-testid={`btn-featured-buy-${product.id}`}
            style={{ background: AMZ.orange, border: "1px solid #E07B00", color: "white" }}
            className="flex-1 py-1.5 text-[10px] font-bold rounded-full flex items-center justify-center gap-0.5 disabled:opacity-40">
            <Lock className="w-3 h-3" /> Buy
          </button>
        </div>
      ) : (
        <div className="px-2.5 pb-2.5">
          <span style={{ color: AMZ.muted }} className="text-[9px] font-semibold block text-center">Your listing</span>
        </div>
      )}
    </div>
  );
}

// ─── List Product Modal ────────────────────────────────────────────────────
function ListProductModal({ open, onClose, editProduct }: { open: boolean; onClose: () => void; editProduct?: Product | null }) {
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const isEdit = !!editProduct;
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK", negotiable: false });
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editProduct) {
      setForm({
        title: editProduct.title,
        description: editProduct.description,
        price: parseFloat(editProduct.price).toString(),
        category: editProduct.category,
        condition: editProduct.condition,
        stock: String(editProduct.stock),
        location: editProduct.location,
        negotiable: !!editProduct.negotiable,
      });
      setImages(editProduct.images ?? []);
    } else {
      setForm({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK", negotiable: false });
      setImages([]);
    }
  }, [editProduct, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = isEdit ? "PATCH" : "POST";
      const url = isEdit ? `/api/products/${editProduct!.id}` : "/api/products";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Listing updated!" : "Product listed!", description: isEdit ? "Your changes are live." : "Your product is now live in the marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/my"] });
      onClose();
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
          <DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-tsia-green" /> {isEdit ? "Edit Listing" : "List a Product"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update your listing details below." : `TSIA takes ${ECOMMERCE.COMMISSION_RATE * 100}% commission. You keep ${(1 - ECOMMERCE.COMMISSION_RATE) * 100}%.`}</DialogDescription>
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
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} {isEdit ? "Save Changes" : "List Product"}
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
  const [editingListing, setEditingListing] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
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
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("tsia_recently_viewed") || "[]"); } catch { return []; }
  });
  const [deliverTo, setDeliverTo] = useState<string>(() => {
    try { return localStorage.getItem("tsia_deliver_to") || ""; } catch { return ""; }
  });
  const [deliverToOpen, setDeliverToOpen] = useState(false);
  const [deliverToInput, setDeliverToInput] = useState("");
  const [cart, setCart] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tsia_cart") || "[]")); } catch { return new Set(); }
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tsia_recent_searches") || "[]"); } catch { return []; }
  });
  const searchBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const submitSearch = (q: string) => {
    const term = q.trim();
    setActiveSearch(term);
    setSearch(term);
    setSearchFocused(false);
    if (term) {
      const next = [term, ...recentSearches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      setRecentSearches(next);
      try { localStorage.setItem("tsia_recent_searches", JSON.stringify(next)); } catch {}
    }
  };
  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem("tsia_recent_searches"); } catch {}
  };

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/products/${id}`); },
    onSuccess: () => {
      toast({ title: "Listing removed", description: "Your listing has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/my"] });
      setDeleteConfirmId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleView = (p: Product) => {
    setSelectedProduct(p); setDetailOpen(true);
    setRecentlyViewed(prev => {
      const next = [p.id, ...prev.filter(id => id !== p.id)].slice(0, 12);
      try { localStorage.setItem("tsia_recently_viewed", JSON.stringify(next)); } catch {}
      return next;
    });
  };
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
    <div className="relative pb-24 w-full" style={{ background: AMZ.bg, margin: "-16px", padding: "0", width: "calc(100% + 32px)", maxWidth: "none", overflowX: "clip" }}>

      {/* ── Amazon-style header ──────────────────────────────────────────── */}
      <div style={{ background: AMZ.navy }} className="px-4 pt-4 pb-2">
        {/* Top row: branding + icons */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xl tracking-tight">TSIA</span>
              <span style={{ color: AMZ.gold }} className="font-black text-xl tracking-tight">Market</span>
            </div>
            <button
              onClick={() => { setDeliverToInput(deliverTo); setDeliverToOpen(true); }}
              data-testid="btn-deliver-to"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <MapPin style={{ color: "#ccc" }} className="w-3 h-3" />
              <p style={{ color: "#ccc" }} className="text-[11px]">
                Hello, {user?.firstName || "Shopper"} ·
                <span className="text-white font-semibold ml-1">
                  {deliverTo ? `Deliver to ${deliverTo}` : "Add delivery address"}
                </span>
              </p>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setChatDrawerOpen(true)} data-testid="btn-messages" className="relative flex items-center gap-1 text-white hover:opacity-80 transition-opacity">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button onClick={() => setCartOpen(true)} data-testid="btn-cart" className="relative flex items-center gap-1 text-white hover:opacity-80 transition-opacity">
              <ShoppingCart className="w-6 h-6" />
              {cart.size > 0 && (
                <span style={{ background: AMZ.gold, color: AMZ.text }} className="absolute -top-2 -right-2 w-5 h-5 text-[9px] font-black rounded-full flex items-center justify-center">
                  {Math.min(cart.size, 99)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-0 mb-2 relative" ref={searchBoxRef}>
          <div className="flex-1 flex items-center gap-2 bg-white rounded-l-md px-3 h-10 border border-white">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search TSIA Market..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={e => { if (e.key === "Enter") submitSearch(search); }}
              data-testid="input-search"
              style={{ color: AMZ.text }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            {search && <button onClick={() => { setSearch(""); setActiveSearch(""); }} data-testid="btn-clear-search"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
          </div>
          <button
            style={{ background: AMZ.orange }}
            className="w-12 h-10 rounded-r-md flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
            onClick={() => submitSearch(search)}
            data-testid="btn-search"
          >
            <Search className="w-5 h-5 text-white" />
          </button>

          {/* Search suggestions dropdown */}
          {searchFocused && (() => {
            const q = search.trim().toLowerCase();
            const allProducts = (products as Product[]);
            const liveSuggestions = q
              ? allProducts.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 6)
              : [];
            const trending = [...allProducts].sort((a, b) => b.viewCount - a.viewCount).slice(0, 6);
            const trendingTerms = Array.from(new Set(trending.map(p => p.title.split(" ").slice(0, 3).join(" ")))).slice(0, 6);
            return (
              <div
                className="absolute left-0 right-14 top-11 z-50 bg-white rounded-md shadow-2xl border border-gray-200 max-h-[70vh] overflow-y-auto"
                data-testid="search-suggestions-dropdown"
                style={{ color: AMZ.text }}
              >
                {q && liveSuggestions.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Products matching "{search}"</div>
                    {liveSuggestions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setDetailOpen(true); setSearchFocused(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                        data-testid={`suggestion-product-${p.id}`}
                      >
                        <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">{CATEGORY_ICONS[p.category] || "📦"}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.title}</div>
                          <div className="text-[11px] text-gray-500">{CATEGORY_LABELS[p.category]} · {formatAmount(parseFloat(p.price))}</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {q && (
                  <button
                    onClick={() => submitSearch(search)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-orange-50 border-b border-gray-100 text-left font-semibold text-sm"
                    style={{ color: AMZ.linkAlt }}
                    data-testid="btn-see-all-results"
                  >
                    <span className="flex items-center gap-2"><Search className="w-4 h-4" /> See all results for "{search}"</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {!q && recentSearches.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Your recent searches</span>
                      <button onClick={clearRecentSearches} className="text-[10px] text-gray-400 hover:text-red-500" data-testid="btn-clear-recent-searches">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {recentSearches.map(s => (
                        <button
                          key={s}
                          onClick={() => submitSearch(s)}
                          className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs text-gray-700"
                          data-testid={`recent-search-${s}`}
                        >
                          <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!q && trendingTerms.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Trending on TSIA Market
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {trendingTerms.map(t => (
                        <button
                          key={t}
                          onClick={() => submitSearch(t)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: "#FFF3E0", color: AMZ.linkAlt }}
                          data-testid={`trending-${t}`}
                        >
                          🔥 {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!q && (
                  <div>
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Browse by category</div>
                    <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                      {CATEGORIES.slice(0, 12).map(c => (
                        <button
                          key={c}
                          onClick={() => { setActiveCategory(c); setSearchFocused(false); }}
                          className="flex flex-col items-center gap-0.5 py-2 rounded hover:bg-gray-50"
                          data-testid={`suggest-cat-${c}`}
                        >
                          <span className="text-lg">{CATEGORY_ICONS[c]}</span>
                          <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight px-1 line-clamp-1">{CATEGORY_LABELS[c]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <button
            style={{ background: AMZ.navyMid, border: `1px solid ${AMZ.gold}` }}
            className="relative w-10 h-10 ml-2 rounded-md flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
            onClick={() => setFilterOpen(true)}
            data-testid="btn-filter"
          >
            <SlidersHorizontal className="w-4 h-4 text-white" />
            {activeFilterCount > 0 && (
              <span style={{ background: AMZ.gold, color: AMZ.text }} className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Amazon sub-nav (tabs) ─────────────────────────────────────────── */}
      <div style={{ background: AMZ.navyMid }} className="flex overflow-x-auto scrollbar-none border-b border-[#3a5068]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
            style={{
              color: tab === t.id ? AMZ.gold : "rgba(255,255,255,0.85)",
              borderBottom: tab === t.id ? `2px solid ${AMZ.gold}` : "2px solid transparent",
            }}
            className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold shrink-0 whitespace-nowrap transition-colors hover:text-white">
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
        <button onClick={() => setListOpen(true)} data-testid="btn-sell"
          style={{ background: AMZ.gold, color: AMZ.text, marginLeft: "auto", marginRight: 8, marginTop: 6, marginBottom: 6 }}
          className="flex items-center gap-1 px-4 text-[11px] font-black rounded shrink-0 hover:opacity-90 transition-opacity">
          <Plus className="w-3.5 h-3.5" /> Sell
        </button>
      </div>

      {/* ── Trust badge strip ─────────────────────────────────────────────── */}
      <div style={{ background: "white", borderBottom: `1px solid ${AMZ.border}` }} className="flex items-center justify-around px-4 py-2.5">
        {[
          { icon: Lock, label: "Escrow Protected", color: "#067D62" },
          { icon: ShieldCheck, label: "Verified Sellers", color: "#007185" },
          { icon: RotateCcw, label: "Easy Returns", color: "#C45500" },
          { icon: MessageCircle, label: "Live Chat", color: "#232F3E" },
        ].map(b => (
          <div key={b.label} className="flex flex-col items-center gap-0.5">
            <b.icon style={{ color: b.color }} className="w-5 h-5" />
            <span style={{ color: AMZ.text }} className="text-[9px] font-semibold text-center leading-tight">{b.label}</span>
          </div>
        ))}
      </div>

      {/* ── Main content wrapper ──────────────────────────────────────────── */}
      <div className="px-4 pt-4">

      {/* ═══════════ BROWSE TAB ════════════════════════════════════════ */}
      {tab === "browse" && (
        <div className="space-y-3">
          {/* When a search is active, jump straight to results — hide categories/promo/rails */}
          {activeSearch && (
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => { setActiveSearch(""); setSearch(""); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold hover:opacity-80"
                style={{ background: AMZ.navyMid, color: "white" }}
                data-testid="btn-back-from-search"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to home
              </button>
              <span style={{ color: AMZ.muted }}>Showing results for <strong style={{ color: AMZ.text }}>"{activeSearch}"</strong></span>
            </div>
          )}

          {/* Categories — hidden during active search */}
          {!activeSearch && (
            <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ color: AMZ.text }} className="font-bold text-sm">Shop by Category</h3>
                <button onClick={() => setShowCategoriesModal(true)} style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline flex items-center gap-0.5" data-testid="btn-view-all-cats">See all <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              <CategoryRow activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
            </div>
          )}

          {/* Promo Banner — hidden during active search */}
          {!activeSearch && <PromoBanner />}

          {/* Hero category tiles — always visible, fall back to gradient emoji when no products */}
          {!activeSearch && (
            <HeroCategoryTiles products={products as Product[]} onPick={(c) => setActiveCategory(c)} />
          )}

          {/* Category shelf — scrollable row of all categories */}
          {!activeSearch && (
            <CategoryShelf onPick={(c) => setActiveCategory(c)} />
          )}

          {/* Today's Deals — with live countdown */}
          {!activeSearch && filteredProducts.length > 0 && (
            <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4" data-testid="rail-todays-deals">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 style={{ color: AMZ.text }} className="font-bold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: AMZ.red }} /> Today's Deals
                  <CountdownBadge />
                </h3>
                <button style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline flex items-center gap-0.5" onClick={() => setShowAllProducts(true)}>See all deals <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                {[...filteredProducts].sort((a, b) => b.viewCount - a.viewCount).slice(0, 12).map((p, i) => {
                  const discountPct = 15 + ((p.id * 7) % 35);
                  return (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`deal-card-${p.id}`}
                      className="w-40 shrink-0 cursor-pointer group">
                      <div className="aspect-square bg-gray-50 rounded overflow-hidden relative">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl">{CATEGORY_ICONS[p.category]}</div>}
                        <div style={{ background: AMZ.red, color: "white" }} className="absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded">
                          -{discountPct}%
                        </div>
                      </div>
                      <p style={{ color: AMZ.red }} className="text-[11px] font-black mt-1.5">Up to {discountPct}% off</p>
                      <p style={{ color: AMZ.text }} className="text-xs line-clamp-1 font-semibold">{p.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buy it again — purchase history */}
          {!activeSearch && (purchases as Order[]).length > 0 && (
            <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4" data-testid="rail-buy-again">
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ color: AMZ.text }} className="font-bold text-sm flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" style={{ color: AMZ.green }} /> Buy it again
                </h3>
                <button style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline flex items-center gap-0.5" onClick={() => setTab("purchases")}>Your orders <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                {(() => {
                  const seen = new Set<number>();
                  const items = (purchases as Order[])
                    .filter(o => { if (seen.has(o.productId)) return false; seen.add(o.productId); return true; })
                    .map(o => (products as Product[]).find(p => p.id === o.productId))
                    .filter(Boolean) as Product[];
                  if (items.length === 0) {
                    return <p style={{ color: AMZ.muted }} className="text-xs">Items from your past orders will appear here.</p>;
                  }
                  return items.slice(0, 10).map(p => (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`buy-again-${p.id}`}
                      className="w-32 shrink-0 cursor-pointer group">
                      <div className="aspect-square bg-gray-50 rounded overflow-hidden">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                      </div>
                      <p style={{ color: AMZ.text }} className="text-xs line-clamp-2 mt-1.5">{p.title}</p>
                      <button onClick={e => { e.stopPropagation(); handleBuy(p); }}
                        style={{ background: AMZ.gold, color: AMZ.text, border: `1px solid ${AMZ.goldHov}` }}
                        className="w-full mt-1.5 py-1 text-[11px] font-bold rounded hover:opacity-90"
                        data-testid={`btn-reorder-${p.id}`}>
                        Buy again
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Featured */}
          {!activeSearch && (
            <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ color: AMZ.text }} className="font-bold text-sm flex items-center gap-1.5">
                  <Flame className="w-4 h-4" style={{ color: AMZ.orange }} /> Best Sellers
                </h3>
                <button style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline flex items-center gap-0.5" onClick={() => setShowAllProducts(true)}>See all <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3 overflow-hidden">
                  {[1,2,3].map(i => <div key={i} className="w-44 h-64 rounded bg-gray-100 animate-pulse shrink-0" />)}
                </div>
              ) : featured.length === 0 ? (
                <div style={{ color: AMZ.muted }} className="text-center py-8 text-sm">No products yet — be the first to list!</div>
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

          {/* Recently viewed */}
          {!activeSearch && recentlyViewed.length > 0 && (() => {
            const items = recentlyViewed
              .map(id => (products as Product[]).find(p => p.id === id))
              .filter(Boolean) as Product[];
            if (items.length === 0) return null;
            return (
              <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4" data-testid="rail-recently-viewed">
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ color: AMZ.text }} className="font-bold text-sm flex items-center gap-1.5">
                    <Eye className="w-4 h-4" style={{ color: AMZ.link }} /> Inspired by your browsing
                  </h3>
                  <button onClick={() => { setRecentlyViewed([]); try { localStorage.removeItem("tsia_recently_viewed"); } catch {} }}
                    style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline" data-testid="btn-clear-recent">Clear</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                  {items.map(p => (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`recent-${p.id}`}
                      className="w-28 shrink-0 cursor-pointer group">
                      <div className="aspect-square bg-gray-50 rounded overflow-hidden">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                      </div>
                      <p style={{ color: AMZ.text }} className="text-[11px] line-clamp-2 mt-1.5">{p.title}</p>
                      <p style={{ color: AMZ.text }} className="text-xs font-black">${parseFloat(p.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* All Products / Search results */}
          <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ color: AMZ.text }} className="font-bold text-sm">
                {activeSearch ? `Results for "${activeSearch}"` : activeCategory ? `${CATEGORY_LABELS[activeCategory] || activeCategory}` : "New Arrivals"}
              </h3>
              <div className="flex items-center gap-2">
                {activeCategory && user && (
                  <button
                    onClick={() => toggleCategorySubscription(activeCategory)}
                    data-testid={`btn-subscribe-cat-${activeCategory}`}
                    title={subscribedCats.has(activeCategory) ? "Unsubscribe from new arrivals" : "Get notified of new arrivals"}
                    style={{ color: subscribedCats.has(activeCategory) ? AMZ.green : AMZ.link, borderColor: subscribedCats.has(activeCategory) ? AMZ.green : AMZ.link }}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
                  >
                    <Bell className="w-3 h-3" />
                    {subscribedCats.has(activeCategory) ? "Subscribed" : "Subscribe"}
                  </button>
                )}
                {(products as Product[]).length > 12 && !showAllProducts && (
                  <button style={{ color: AMZ.link }} className="text-xs font-semibold hover:underline" onClick={() => setShowAllProducts(true)}>See all {(products as Product[]).length}</button>
                )}
              </div>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="aspect-square rounded bg-gray-100 animate-pulse" />)}
              </div>
            ) : (products as Product[]).length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded">
                <ShoppingBag style={{ color: AMZ.muted }} className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p style={{ color: AMZ.text }} className="font-semibold mb-1">No products found</p>
                <p style={{ color: AMZ.muted }} className="text-sm mb-4">Try a different search or category.</p>
                <Button onClick={() => setListOpen(true)} style={{ background: AMZ.gold, color: AMZ.text, border: `1px solid ${AMZ.goldHov}` }} className="font-bold rounded-full"><Plus className="w-4 h-4 mr-1.5" /> Be the first to list</Button>
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
                  <button
                    style={{ background: AMZ.gold, color: AMZ.text, border: `1px solid ${AMZ.goldHov}` }}
                    className="w-full mt-4 py-2.5 font-bold text-sm rounded-full hover:opacity-90 flex items-center justify-center gap-2"
                    onClick={() => setShowAllProducts(true)}>
                    Load more ({filteredProducts.length - 12} more) <ChevronRight className="w-4 h-4" />
                  </button>
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
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl" onClick={() => handleView(p)} data-testid={`btn-view-listing-${p.id}`}>View</Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-amber-600 border-amber-300"
                          onClick={() => { apiRequest("PATCH", `/api/products/${p.id}`, { status: p.status === "paused" ? "active" : "paused" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/products/my"] })); }}
                          data-testid={`btn-toggle-listing-${p.id}`}>
                          {p.status === "paused" ? "Activate" : "Pause"}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-blue-600 border-blue-300"
                          onClick={() => { setEditingListing(p); setListOpen(true); }}
                          data-testid={`btn-edit-listing-${p.id}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-red-600 border-red-300"
                          onClick={() => setDeleteConfirmId(p.id)}
                          data-testid={`btn-delete-listing-${p.id}`}>
                          Remove
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
        <div style={{ background: "white", border: `1px solid ${AMZ.border}` }} className="grid grid-cols-3 gap-0 mt-3 rounded overflow-hidden">
          {[
            { label: "Products", value: (products as Product[]).length, icon: Package, color: "#007185" },
            { label: "Saved", value: wishlist.size, icon: Heart, color: "#CC0C39" },
            { label: "Commission", value: "8%", icon: BadgePercent, color: "#067D62" },
          ].map((s, i) => (
            <div key={s.label} style={{ borderRight: i < 2 ? `1px solid ${AMZ.border}` : "none" }} className="p-3 text-center">
              <s.icon style={{ color: s.color }} className="w-5 h-5 mx-auto mb-1" />
              <p style={{ color: AMZ.text }} className="font-black text-lg">{s.value}</p>
              <p style={{ color: AMZ.muted }} className="text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      </div>{/* close content wrapper */}

      {/* Modals */}
      <ListProductModal open={listOpen} editProduct={editingListing} onClose={() => { setListOpen(false); setEditingListing(null); }} />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Listing</DialogTitle>
            <DialogDescription>
              This will permanently delete this listing and all associated data including chats and ratings. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirmId !== null) deleteMutation.mutate(deleteConfirmId); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-listing"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Yes, Remove Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

      {/* ── Deliver-to dialog ────────────────────────────────────────── */}
      <Dialog open={deliverToOpen} onOpenChange={setDeliverToOpen}>
        <DialogContent className="max-w-sm" data-testid="modal-deliver-to">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Choose your location</DialogTitle>
            <DialogDescription>Delivery options and shipping fees update based on this address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="e.g. Lagos, NG · Manchester, UK"
              value={deliverToInput}
              onChange={e => setDeliverToInput(e.target.value)}
              data-testid="input-deliver-to"
              className="rounded-xl"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => {
                setDeliverTo(""); try { localStorage.removeItem("tsia_deliver_to"); } catch {}
                setDeliverToOpen(false);
              }} data-testid="btn-deliver-clear">Remove</Button>
              <Button className="flex-1 rounded-xl bg-tsia-green text-white" onClick={() => {
                const v = deliverToInput.trim();
                setDeliverTo(v);
                try { v ? localStorage.setItem("tsia_deliver_to", v) : localStorage.removeItem("tsia_deliver_to"); } catch {}
                setDeliverToOpen(false);
                if (v) toast({ description: `Delivering to ${v}` });
              }} data-testid="btn-deliver-save">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Service footer + back to top ──────────────────────────────── */}
      <div style={{ background: AMZ.navyMid }} className="mt-6 -mx-4 px-4 py-3 text-center cursor-pointer hover:opacity-90"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} data-testid="btn-back-to-top">
        <span className="text-white text-xs font-semibold flex items-center justify-center gap-1.5">
          <ChevronUp className="w-3.5 h-3.5" /> Back to top
        </span>
      </div>
      <div style={{ background: AMZ.navy }} className="-mx-4 px-4 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-white">
        {[
          { title: "Get to Know Us", links: ["About TSIA", "Careers", "Press"] },
          { title: "Make Money With Us", links: ["Sell on TSIA Market", "Become an Affiliate", "Advertise"] },
          { title: "Payment Products", links: ["TSIA Wallet", "Reward Points", "Reload Balance"] },
          { title: "Let Us Help You", links: ["Your Account", "Your Orders", "Help Center"] },
        ].map(col => (
          <div key={col.title}>
            <p className="font-bold text-xs mb-2">{col.title}</p>
            <ul className="space-y-1">
              {col.links.map(l => <li key={l} className="text-[11px] opacity-80 hover:opacity-100 cursor-pointer">{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ background: "#131A22" }} className="-mx-4 px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <span className="text-white font-black text-sm">TSIA</span>
          <span style={{ color: AMZ.gold }} className="font-black text-sm">Market</span>
        </div>
        <p className="text-[10px] text-white/50">SMAKEMGGOLD Ltd · RC: 1359954 · Escrow Protected · Verified Sellers</p>
      </div>

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
