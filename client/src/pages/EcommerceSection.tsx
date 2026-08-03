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

// ─── Modern design tokens ────────────────────────────────────────────────────
const AMZ = {
  navy:    "#FFFFFF",       // header/card backgrounds → white
  navyMid: "#F1F5F9",      // light gray for secondary surfaces
  gold:    "#10B981",      // primary CTA → tsia-green
  goldHov: "#059669",
  orange:  "#F59E0B",      // deal/accent → amber
  text:    "#0F172A",      // dark slate text
  muted:   "#64748B",      // muted slate
  border:  "#E2E8F0",
  bg:      "#F1F5F9",      // page background
  link:    "#10B981",
  linkAlt: "#D97706",
  green:   "#10B981",
  red:     "#EF4444",
  prime:   "#6366F1",
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

// ─── Promo Banner Carousel (modern rounded) ──────────────────────────────────
function PromoBanner({ onAction }: { onAction: (slideId: number) => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PROMO_SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);
  const s = PROMO_SLIDES[idx];
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.35 }}
          style={{ background: `linear-gradient(135deg,${s.accent.replace("from-[","").replace("] to-[",",").replace("]","")})` }}
          className="relative flex items-center justify-between px-6 py-7 min-h-[180px] overflow-hidden cursor-pointer"
          onClick={() => onAction(s.id)}
        >
          {/* decorative circles */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute right-8 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -left-4 -bottom-8 w-28 h-28 rounded-full bg-black/10" />
          <div className="z-10 flex-1">
            <span className="text-[11px] font-bold bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full">{s.badge}</span>
            <h2 className="text-white text-2xl font-black mt-3 mb-1 leading-tight drop-shadow">{s.headline}</h2>
            <p className="text-white/85 text-sm mb-4 leading-snug">{s.sub}</p>
            <button
              className="text-sm font-bold px-5 py-2 bg-white/90 backdrop-blur-sm rounded-xl flex items-center gap-1.5 hover:bg-white transition-colors shadow-sm active:scale-95"
              style={{ color: "#1E293B" }}
              onClick={e => { e.stopPropagation(); onAction(s.id); }}
            >
              {s.tag} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-7xl z-10 select-none ml-4 drop-shadow-md">{s.emoji}</div>
        </motion.div>
      </AnimatePresence>
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
            className={`rounded-full transition-all duration-300 ${i === idx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Category Row (modern pill chips) ────────────────────────────────────────
function CategoryRow({ activeCategory, setActiveCategory }: { activeCategory: string; setActiveCategory: (c: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button onClick={() => setActiveCategory("")} data-testid="cat-all"
        className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
          !activeCategory
            ? "bg-tsia-green text-white border-tsia-green shadow-sm"
            : "bg-white text-slate-600 border-slate-200 hover:border-tsia-green/50"
        }`}>
        <span className="text-base">🛍️</span> All
      </button>
      {CATEGORIES.map(c => (
        <button key={c} onClick={() => setActiveCategory(activeCategory === c ? "" : c)} data-testid={`cat-${c}`}
          className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
            activeCategory === c
              ? "bg-tsia-green text-white border-tsia-green shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:border-tsia-green/50"
          }`}>
          <span className="text-base">{CATEGORY_ICONS[c]}</span>
          <span className="truncate max-w-[60px]">{CATEGORY_LABELS[c]}</span>
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
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500 text-white">
      <Clock className="w-2.5 h-2.5" /> {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
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
            className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 border border-slate-100 text-left"
            data-testid={`hero-tile-${t.cat}`}
          >
            {/* Gradient header */}
            <div style={{ background: heroImg ? "none" : t.gradient, position: "relative", overflow: "hidden" }} className="h-28 flex items-center justify-center">
              {heroImg ? (
                <img src={heroImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div style={{ position: "absolute", inset: 0, background: t.gradient, opacity: 0.9 }} />
                  <span style={{ fontSize: 48, position: "relative", zIndex: 1, lineHeight: 1 }}>{t.emoji}</span>
                </>
              )}
            </div>
            {/* Label */}
            <div className="p-3">
              <p className="font-bold text-[12px] text-slate-800 leading-tight">{t.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-1">{t.sub}</p>
              <span className="text-[11px] font-semibold text-tsia-green mt-1 block">Shop now →</span>
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
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-slate-800">Browse by Category</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {HERO_TILES.map(t => (
          <button key={t.cat} onClick={() => onPick(t.cat)} className="flex flex-col items-center gap-2 shrink-0 min-w-[60px] group" data-testid={`shelf-cat-${t.cat}`}>
            <div style={{ background: t.gradient }} className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform">
              {t.emoji}
            </div>
            <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight max-w-[64px]">
              {t.label.split(" & ")[0].split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Category Browser Data ────────────────────────────────────────────────────
const CAT_BROWSER = [
  {
    id: "phones", label: "Phones & Telecom", icon: "📱", color: "#10B981",
    subs: [
      { label: "Smartphones",       img: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300&h=300&fit=crop&auto=format", cat: "phones" },
      { label: "Tablets",           img: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=300&h=300&fit=crop&auto=format", cat: "phones" },
      { label: "Phone Cases",       img: "https://images.unsplash.com/photo-1588492885706-b8917f06df77?w=300&h=300&fit=crop&auto=format", cat: "phones" },
      { label: "Chargers & Cables", img: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=300&h=300&fit=crop&auto=format", cat: "phones" },
      { label: "Power Banks",       img: "https://images.unsplash.com/photo-1625314868143-20e93ce3ff33?w=300&h=300&fit=crop&auto=format", cat: "phones" },
      { label: "Earphones & Buds",  img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
    ],
  },
  {
    id: "computers", label: "Computers & Laptops", icon: "💻", color: "#1a5c38",
    subs: [
      { label: "Laptops",           img: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop&auto=format", cat: "computers" },
      { label: "Desktops",          img: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&h=300&fit=crop&auto=format", cat: "computers" },
      { label: "Monitors",          img: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=300&h=300&fit=crop&auto=format", cat: "computers" },
      { label: "Keyboards",         img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300&h=300&fit=crop&auto=format", cat: "computers" },
      { label: "Mouse & Pads",      img: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&h=300&fit=crop&auto=format", cat: "computers" },
      { label: "External Drives",   img: "https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=300&h=300&fit=crop&auto=format", cat: "computers" },
    ],
  },
  {
    id: "electronics", label: "Electronics", icon: "🔌", color: "#6366F1",
    subs: [
      { label: "Cameras & DSLR",    img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
      { label: "Smart TVs",         img: "https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=300&h=300&fit=crop&auto=format", cat: "tvs_audio" },
      { label: "Speakers",          img: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
      { label: "Drones",            img: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
      { label: "Gaming Consoles",   img: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=300&h=300&fit=crop&auto=format", cat: "gaming" },
      { label: "Smart Home",        img: "https://images.unsplash.com/photo-1558002038-1055907df827?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
    ],
  },
  {
    id: "watches", label: "Jewelry & Watch", icon: "⌚", color: "#8B5CF6",
    subs: [
      { label: "Men's Watches",     img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop&auto=format", cat: "watches" },
      { label: "Women's Watches",   img: "https://images.unsplash.com/photo-1548171915-e1aebc9a3b7e?w=300&h=300&fit=crop&auto=format", cat: "watches" },
      { label: "Smart Watches",     img: "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=300&h=300&fit=crop&auto=format", cat: "watches" },
      { label: "Gold Jewelry",      img: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300&h=300&fit=crop&auto=format", cat: "jewelry" },
      { label: "Bracelets",         img: "https://images.unsplash.com/photo-1573408301185-9519f94816b5?w=300&h=300&fit=crop&auto=format", cat: "jewelry" },
      { label: "Necklaces",         img: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=300&h=300&fit=crop&auto=format", cat: "jewelry" },
    ],
  },
  {
    id: "fashion_men", label: "Men's Clothing", icon: "👔", color: "#3B82F6",
    subs: [
      { label: "Casual Shirts",     img: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
      { label: "Suits & Blazers",   img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
      { label: "Trousers",          img: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
      { label: "T-Shirts",          img: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
      { label: "Polo Shirts",       img: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
      { label: "Jackets & Coats",   img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&h=300&fit=crop&auto=format", cat: "fashion_men" },
    ],
  },
  {
    id: "fashion_women", label: "Women's Clothing", icon: "👗", color: "#EC4899",
    subs: [
      { label: "Dresses",           img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&h=300&fit=crop&auto=format", cat: "fashion_women" },
      { label: "Tops & Blouses",    img: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=300&h=300&fit=crop&auto=format", cat: "fashion_women" },
      { label: "Skirts",            img: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300&h=300&fit=crop&auto=format", cat: "fashion_women" },
      { label: "Handbags",          img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop&auto=format", cat: "bags" },
      { label: "Ladies' Shoes",     img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Accessories",       img: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=300&h=300&fit=crop&auto=format", cat: "jewelry" },
    ],
  },
  {
    id: "automotive", label: "Automobiles & Parts", icon: "🚗", color: "#F59E0B",
    subs: [
      { label: "Car Accessories",   img: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
      { label: "Car Audio",         img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
      { label: "Tyres & Wheels",    img: "https://images.unsplash.com/photo-1621335539234-c7a4f5e0fa89?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
      { label: "Motorcycle Parts",  img: "https://images.unsplash.com/photo-1558981852-426c349a49ed?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
      { label: "Car Care Products", img: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
      { label: "Spare Parts",       img: "https://images.unsplash.com/photo-1597638289770-4b41a8bd6c1f?w=300&h=300&fit=crop&auto=format", cat: "automotive" },
    ],
  },
  {
    id: "health", label: "Health & Beauty", icon: "💊", color: "#EF4444",
    subs: [
      { label: "Skincare",          img: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=300&fit=crop&auto=format", cat: "beauty" },
      { label: "Hair Care",         img: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop&auto=format", cat: "beauty" },
      { label: "Perfumes",          img: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=300&h=300&fit=crop&auto=format", cat: "beauty" },
      { label: "Vitamins & Supps",  img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop&auto=format", cat: "health" },
      { label: "Makeup",            img: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=300&h=300&fit=crop&auto=format", cat: "beauty" },
      { label: "Personal Care",     img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&h=300&fit=crop&auto=format", cat: "health" },
    ],
  },
  {
    id: "home", label: "Home & Living", icon: "🏠", color: "#92400E",
    subs: [
      { label: "Furniture",         img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=300&fit=crop&auto=format", cat: "furniture" },
      { label: "Bedding & Pillows", img: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=300&h=300&fit=crop&auto=format", cat: "home" },
      { label: "Kitchen Items",     img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop&auto=format", cat: "kitchen" },
      { label: "Lighting",          img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=300&h=300&fit=crop&auto=format", cat: "home" },
      { label: "Home Appliances",   img: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=300&h=300&fit=crop&auto=format", cat: "appliances" },
      { label: "Garden & Outdoor",  img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=300&fit=crop&auto=format", cat: "garden" },
    ],
  },
  {
    id: "sports", label: "Sports & Fitness", icon: "⚽", color: "#0277BD",
    subs: [
      { label: "Gym Equipment",     img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=300&fit=crop&auto=format", cat: "sports" },
      { label: "Football & Soccer", img: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=300&h=300&fit=crop&auto=format", cat: "sports" },
      { label: "Running Shoes",     img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop&auto=format", cat: "sports" },
      { label: "Sportswear",        img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300&h=300&fit=crop&auto=format", cat: "sports" },
      { label: "Cycling",           img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop&auto=format", cat: "sports" },
      { label: "Swimming",          img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&h=300&fit=crop&auto=format", cat: "sports" },
    ],
  },
  {
    id: "food", label: "Food & Grocery", icon: "🍎", color: "#65A30D",
    subs: [
      { label: "Fresh Fruits",      img: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&h=300&fit=crop&auto=format", cat: "food" },
      { label: "Packaged Food",     img: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=300&fit=crop&auto=format", cat: "groceries" },
      { label: "Cooking Oils",      img: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop&auto=format", cat: "food" },
      { label: "Beverages",         img: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=300&fit=crop&auto=format", cat: "food" },
      { label: "Snacks",            img: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=300&h=300&fit=crop&auto=format", cat: "groceries" },
      { label: "Spices",            img: "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=300&h=300&fit=crop&auto=format", cat: "food" },
    ],
  },
  {
    id: "baby", label: "Baby & Mum", icon: "👶", color: "#F472B6",
    subs: [
      { label: "Baby Clothes",      img: "https://images.unsplash.com/photo-1522771930-78848d9293e8?w=300&h=300&fit=crop&auto=format", cat: "baby" },
      { label: "Baby Toys",         img: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&h=300&fit=crop&auto=format", cat: "toys" },
      { label: "Diapers & Care",    img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=300&fit=crop&auto=format", cat: "baby" },
      { label: "Baby Strollers",    img: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=300&h=300&fit=crop&auto=format", cat: "baby" },
      { label: "Feeding & Nursing", img: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=300&h=300&fit=crop&auto=format", cat: "baby" },
      { label: "Maternity",         img: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300&h=300&fit=crop&auto=format", cat: "baby" },
    ],
  },
  {
    id: "shoes", label: "Shoes & Footwear", icon: "👟", color: "#DC2626",
    subs: [
      { label: "Sneakers",          img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Formal Shoes",      img: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Sandals & Slippers",img: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Boots",             img: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Sports Shoes",      img: "https://images.unsplash.com/photo-1556906781-9a412961a28c?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
      { label: "Kids' Shoes",       img: "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=300&h=300&fit=crop&auto=format", cat: "shoes" },
    ],
  },
  {
    id: "books", label: "Books & Education", icon: "📚", color: "#7C3AED",
    subs: [
      { label: "Textbooks",         img: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&h=300&fit=crop&auto=format", cat: "books" },
      { label: "Fiction & Novels",  img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=300&fit=crop&auto=format", cat: "books" },
      { label: "Self Development",  img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&h=300&fit=crop&auto=format", cat: "books" },
      { label: "Children's Books",  img: "https://images.unsplash.com/photo-1529539795054-3c162aab037a?w=300&h=300&fit=crop&auto=format", cat: "books" },
      { label: "Art & Crafts",      img: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop&auto=format", cat: "art" },
      { label: "Music Instruments", img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop&auto=format", cat: "music" },
    ],
  },
];

// ─── Category Browser Overlay (full-screen, portal-rendered) ─────────────────
function CategoryBrowserOverlay({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (cat: string) => void;
}) {
  const [activeCat, setActiveCat] = useState(CAT_BROWSER[0]);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // scroll right panel to top when category changes
  useEffect(() => {
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0;
  }, [activeCat]);

  // lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const ACCENT = "#E53935";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99998, display: "flex", flexDirection: "column", background: "#F5F5F5" }}>

      {/* ── Header ── */}
      <div style={{ background: ACCENT, display: "flex", alignItems: "center", padding: "0 4px", height: 52, flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer" }}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", color: "white", fontWeight: 700, fontSize: 18, letterSpacing: 0.3 }}>Category</h1>
        <div style={{ width: 44 }} />
      </div>

      {/* ── Body: left sidebar + right grid ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left sidebar */}
        <div style={{ width: 96, background: "white", borderRight: "1px solid #E8E8E8", overflowY: "auto", flexShrink: 0 }}>
          {CAT_BROWSER.map(cat => {
            const active = activeCat.id === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat)}
                data-testid={`sidebar-cat-${cat.id}`}
                style={{
                  width: "100%", padding: "14px 8px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  background: active ? "#FFF5F5" : "white",
                  borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                  borderBottom: "1px solid #F0F0F0",
                  cursor: "pointer", border: "none",
                  borderLeftColor: active ? ACCENT : "transparent",
                  borderLeftWidth: 3, borderLeftStyle: "solid",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{cat.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  color: active ? ACCENT : "#555",
                  textAlign: "center", lineHeight: 1.3,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right content panel */}
        <div ref={rightPanelRef} style={{ flex: 1, overflowY: "auto", padding: "14px 10px" }}>
          {/* Category header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{activeCat.label}</span>
            <button
              onClick={() => { onPick(activeCat.id); onClose(); }}
              style={{ color: ACCENT, fontSize: 13, fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}
            >
              All
            </button>
          </div>

          {/* 2-column sub-category grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {activeCat.subs.map(sub => (
              <button
                key={sub.label}
                onClick={() => { onPick(sub.cat); onClose(); }}
                data-testid={`sub-cat-${sub.label.replace(/\s+/g, "-").toLowerCase()}`}
                style={{
                  background: "white", border: "none", borderRadius: 8,
                  overflow: "hidden", cursor: "pointer", padding: 0,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  display: "flex", flexDirection: "column",
                }}
              >
                <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#f5f5f5" }}>
                  <img
                    src={sub.img}
                    alt={sub.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ padding: "8px 8px 10px", textAlign: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#333", lineHeight: 1.35, display: "block" }}>
                    {sub.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Top Sellers (modern stories style) ──────────────────────────────────────
function SellerStories({ products }: { products: Product[] }) {
  const seen = new Set<number>();
  const unique = products.filter(p => { if (seen.has(p.sellerId)) return false; seen.add(p.sellerId); return true; }).slice(0, 8);
  const BADGE_COLORS = ["#10B981","#6366F1","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#EC4899","#14B8A6"];
  if (unique.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-slate-800">Top Sellers</h3>
        <span className="text-xs font-semibold text-tsia-green cursor-pointer hover:underline">See all →</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {unique.map((p, i) => (
          <div key={p.sellerId} className="flex flex-col items-center gap-2 shrink-0 min-w-[56px]">
            {/* Ring story-style */}
            <div className="w-14 h-14 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${BADGE_COLORS[i % BADGE_COLORS.length]}, ${BADGE_COLORS[(i+2) % BADGE_COLORS.length]})` }}>
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-[2px]">
                <div style={{ background: BADGE_COLORS[i % BADGE_COLORS.length] }}
                  className="w-full h-full rounded-full flex items-center justify-center text-white text-base font-black">
                  {p.sellerName?.[0]?.toUpperCase() ?? "S"}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[56px] text-center">
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
  // Touch swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => { setIdx(startIndex); }, [startIndex, open]);
  useEffect(() => { if (open) setImgLoaded(false); }, [open, idx]);

  // NOTE: Do NOT lock body scroll here — the parent Dialog already does it.
  // Double-locking causes iOS to drop touch events on the close button.

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const goNext = () => { setImgLoaded(false); setIdx(i => (i + 1) % images.length); };
  const goPrev = () => { setImgLoaded(false); setIdx(i => (i - 1 + images.length) % images.length); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Swipe left/right to navigate (ignore small or mostly-vertical swipes)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && images.length > 1) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }
    // Swipe down to close
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
    }
  };

  if (!images.length || !open) return null;

  return createPortal(
    <div
      data-testid="image-lightbox"
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.96)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        // Use "manipulation" not "none" — "none" blocks tap events on iOS
        touchAction: "manipulation",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close — large tap area, explicit pointer-events so iOS never misses it */}
      <button
        style={{ position: "absolute", top: 52, right: 16, zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        onClick={e => { e.stopPropagation(); onClose(); }}
        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClose(); }}
        data-testid="btn-lightbox-close"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Hint */}
      <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", alignItems: "center", gap: 12 }}>
        {images.length > 1 && (
          <div style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, padding: "4px 14px", borderRadius: 20 }}>
            {idx + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Swipe hint label */}
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 2, color: "rgba(255,255,255,0.35)", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {images.length > 1 ? "Swipe to navigate · Swipe down to close" : "Swipe down to close"}
      </div>

      {/* Loading spinner */}
      {!imgLoaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 1 }}>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Image — stopPropagation prevents the overlay click-to-close firing on image tap */}
      <img
        key={idx}
        src={images[idx]}
        alt={`Image ${idx + 1}`}
        style={{ maxWidth: "95vw", maxHeight: "78vh", objectFit: "contain", borderRadius: 12, userSelect: "none", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.15s", zIndex: 2, cursor: "default", touchAction: "pinch-zoom" }}
        onLoad={() => setImgLoaded(true)}
        draggable={false}
        decoding="async"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      />

      {/* Arrows (desktop / tablet) */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); goPrev(); }}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}
            data-testid="btn-lightbox-prev"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); goNext(); }}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}
            data-testid="btn-lightbox-next"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 40, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }} onClick={e => e.stopPropagation()}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i); }}
              style={{ touchAction: "manipulation" }}
              className={`rounded-full transition-all ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40"}`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 60, display: "flex", gap: 8, overflowX: "auto", maxWidth: "90vw", padding: "0 8px", zIndex: 2 }}
          onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          {images.map((src, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i); }}
              style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 10, overflow: "hidden", border: i === idx ? "2.5px solid white" : "2px solid rgba(255,255,255,0.2)", opacity: i === idx ? 1 : 0.55, cursor: "pointer", padding: 0, background: "none", touchAction: "manipulation" }}
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

// ─── Product Card (Grid — modern mobile design) ────────────────────────────
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
      className="bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group flex flex-col border border-slate-100"
      onClick={onView}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image area */}
      <div className="relative bg-slate-50 flex items-center justify-center overflow-hidden rounded-t-2xl" style={{ aspectRatio: "1/1" }}>
        {img ? (
          <img src={img} alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="text-5xl select-none">{CATEGORY_ICONS[product.category] || "📦"}</span>
        )}
        {/* Wishlist */}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          data-testid={`btn-wishlist-${product.id}`}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white/80 hover:scale-110 transition-transform">
          <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
        </button>
        {onWatch && (
          <button onClick={e => { e.stopPropagation(); onWatch(); }}
            data-testid={`btn-watch-${product.id}`}
            className="absolute top-12 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white/80 hover:scale-110 transition-transform">
            <Bell className={`w-4 h-4 ${watched ? "fill-amber-400 text-amber-400" : "text-slate-400"}`} />
          </button>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.condition === "new" && (
            <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-tsia-green">NEW</span>
          )}
          {discPct > 0 && (
            <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-red-500">-{discPct}%</span>
          )}
          {product.negotiable && (
            <span className="text-[9px] font-bold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full">NEGO</span>
          )}
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 rounded-t-2xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-xl">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{CATEGORY_LABELS[product.category]}</p>
        <h3 className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2 min-h-[2.5rem]">{product.title}</h3>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-base font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
          <span className="text-[11px] text-slate-400 line-through">${orig}</span>
          {discPct > 0 && <span className="text-[10px] font-bold text-red-500">{discPct}% off</span>}
        </div>
        <p className="text-[10px] text-slate-400">{formatAmount(parseFloat(product.price))}</p>
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-[10px] font-semibold text-red-500">Only {product.stock} left!</p>
        )}
      </div>

      {/* CTA buttons */}
      {!isSeller && (
        <div className="px-3 pb-3 flex gap-2 mt-auto">
          <button
            onClick={e => { e.stopPropagation(); onCart(); }}
            data-testid={`btn-cart-add-${product.id}`}
            className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 border ${
              inCart
                ? "bg-tsia-green/10 border-tsia-green text-tsia-green"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-tsia-green/10 hover:border-tsia-green hover:text-tsia-green"
            }`}>
            <ShoppingCart className="w-3.5 h-3.5" />
            {inCart ? "✓" : "Cart"}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onBuy(); }}
            disabled={product.stock === 0}
            data-testid={`btn-buy-${product.id}`}
            className="flex-1 py-2 text-[11px] font-bold bg-tsia-green hover:bg-tsia-green/90 text-white rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <Lock className="w-3.5 h-3.5" />
            Buy
          </button>
        </div>
      )}
      {isSeller && (
        <div className="px-3 pb-3">
          <span className="text-[10px] font-semibold text-tsia-green bg-tsia-green/10 rounded-lg px-2 py-1 block text-center">Your listing</span>
        </div>
      )}
    </div>
  );
}

// ─── Featured Card (horizontal scroll — modern design) ────────────────────
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
      className="shrink-0 w-44 bg-white rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group flex flex-col border border-slate-100"
    >
      {/* Image */}
      <div className="relative bg-slate-50 flex items-center justify-center rounded-t-2xl overflow-hidden" style={{ height: 152 }}>
        {img ? (
          <img src={img} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="text-5xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-white/80">
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
        </button>
        {discPct > 0 && (
          <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-red-500">-{discPct}%</span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-t-2xl">
            <span className="text-white text-[9px] font-bold bg-black/60 px-2 py-1 rounded-lg">Out of Stock</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-[12px] font-semibold text-slate-800 line-clamp-2 leading-snug">{product.title}</p>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[13px] font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 line-through">${orig}</span>
        </div>
        <p className="text-[9px] text-slate-400">{formatAmount(parseFloat(product.price))}</p>
      </div>
      {/* CTA */}
      {!isSeller ? (
        <div className="px-2.5 pb-2.5 flex gap-1.5">
          <button onClick={e => { e.stopPropagation(); onCart(); }}
            data-testid={`btn-featured-cart-${product.id}`}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-0.5 transition-all border ${
              inCart
                ? "bg-tsia-green/10 border-tsia-green text-tsia-green"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-tsia-green/10 hover:border-tsia-green hover:text-tsia-green"
            }`}>
            <ShoppingCart className="w-3 h-3" /> {inCart ? "✓" : "Cart"}
          </button>
          <button onClick={e => { e.stopPropagation(); onBuy(); }}
            disabled={product.stock === 0}
            data-testid={`btn-featured-buy-${product.id}`}
            className="flex-1 py-1.5 text-[10px] font-bold bg-tsia-green hover:bg-tsia-green/90 text-white rounded-lg flex items-center justify-center gap-0.5 disabled:opacity-40 transition-all">
            <Lock className="w-3 h-3" /> Buy
          </button>
        </div>
      ) : (
        <div className="px-2.5 pb-2.5">
          <span className="text-[9px] font-semibold text-tsia-green bg-tsia-green/10 rounded-lg block text-center py-1">Your listing</span>
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
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Cannot read file: ${file.name}`));
      reader.onload = ev => {
        const img = new Image();
        img.onerror = () => reject(new Error(`Cannot decode image: ${file.name}. Try a JPEG or PNG file.`));
        img.onload = () => {
          const MAX = 900;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, ECOMMERCE.MAX_IMAGES - images.length);
    e.target.value = "";
    files.forEach(f => {
      compressImage(f)
        .then(dataUrl => setImages(prev => [...prev, dataUrl].slice(0, ECOMMERCE.MAX_IMAGES)))
        .catch(err => {
          console.warn("[image upload]", err.message);
          toast({ title: "Image error", description: err.message, variant: "destructive" });
        });
    });
  };

  const commission = parseFloat(form.price || "0") * ECOMMERCE.COMMISSION_RATE;
  const youReceive = parseFloat(form.price || "0") - commission;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Explicit white/light background — prevents dark-mode bleed on device */}
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto bg-white text-slate-900 border-0 rounded-2xl p-0 gap-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-tsia-green/10 rounded-2xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-tsia-green" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">{isEdit ? "Edit Listing" : "List a Product"}</h2>
              <p className="text-xs text-slate-400">{isEdit ? "Update your listing details below." : `TSIA takes ${ECOMMERCE.COMMISSION_RATE * 100}% commission. You keep ${(1 - ECOMMERCE.COMMISSION_RATE) * 100}%.`}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Photos */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Photos (up to {ECOMMERCE.MAX_IMAGES})</p>
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => setImages(p => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {images.length < ECOMMERCE.MAX_IMAGES && (
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-tsia-green hover:text-tsia-green transition-colors bg-slate-50">
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] mt-1 font-medium">Add photo</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImage} className="hidden" />
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Title *</label>
            <input
              placeholder="e.g. iPhone 14 Pro, Brand New"
              value={form.title}
              onChange={e => setForm(p => ({...p, title: e.target.value}))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
              data-testid="input-product-title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Description *</label>
            <textarea
              rows={3}
              placeholder="Describe condition, features, specs..."
              value={form.description}
              onChange={e => setForm(p => ({...p, description: e.target.value}))}
              data-testid="input-product-description"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-green/30 resize-none"
            />
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Price (USD) *</label>
              <input
                type="number" min={ECOMMERCE.MIN_PRICE} max={ECOMMERCE.MAX_PRICE} step={0.01} placeholder="0.00"
                value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
                data-testid="input-product-price"
              />
              {parseFloat(form.price) > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">≈ {formatAmount(parseFloat(form.price))}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Stock qty</label>
              <input
                type="number" min={1} value={form.stock} onChange={e => setForm(p => ({...p, stock: e.target.value}))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
                data-testid="input-product-stock"
              />
            </div>
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Category</label>
              <select
                value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                data-testid="select-product-category"
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Condition</label>
              <select
                value={form.condition} onChange={e => setForm(p => ({...p, condition: e.target.value}))}
                data-testid="select-product-condition"
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
              >
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Your location</label>
            <input
              placeholder="London, UK" value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
              data-testid="input-product-location"
            />
          </div>

          {/* Negotiable toggle */}
          <div
            className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${form.negotiable ? "border-tsia-green bg-tsia-green/5" : "border-slate-200 bg-slate-50"}`}
            onClick={() => setForm(p => ({...p, negotiable: !p.negotiable}))}
            data-testid="toggle-negotiable"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-800">Accept Price Negotiations</p>
                <p className="text-xs text-slate-400 mt-0.5">Let buyers propose a price via chat before paying</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-3 ${form.negotiable ? "bg-tsia-green" : "bg-slate-300"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.negotiable ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>
          </div>

          {/* Earnings breakdown */}
          {parseFloat(form.price) > 0 && (
            <div className="bg-tsia-green/5 rounded-2xl p-4 border border-tsia-green/20">
              <p className="text-xs font-bold text-tsia-green mb-2 flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5" /> Earnings breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Listing price</span>
                  <span className="font-semibold text-slate-800">${parseFloat(form.price || "0").toFixed(2)} <span className="text-xs font-normal text-slate-400">({formatAmount(parseFloat(form.price || "0"))})</span></span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>TSIA commission (8%)</span>
                  <span>−${commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
                  <span className="font-bold text-slate-800">You receive</span>
                  <span className="font-bold text-tsia-green">${youReceive.toFixed(2)} <span className="text-xs font-normal text-slate-400">({formatAmount(youReceive)})</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex gap-2.5">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl border-slate-200 text-slate-600">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({...form, images, price: parseFloat(form.price), stock: parseInt(form.stock), negotiable: form.negotiable})}
            disabled={createMutation.isPending || !form.title || !form.description || !form.price}
            data-testid="button-submit-product"
            className="flex-1 bg-tsia-green text-white rounded-xl font-bold shadow-sm"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isEdit ? "Save Changes" : "List Product"}
          </Button>
        </div>
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

  useEffect(() => { if (!open) setLightboxOpen(false); }, [open]);

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
      {/* Explicit white/light so device dark-mode doesn't bleed in */}
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 bg-white text-slate-900 border-0 rounded-2xl">
        {/* ── Image hero ── */}
        <div className="relative w-full bg-slate-100 rounded-t-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {imgs.length > 0 ? (
            <img
              src={imgs[imgIdx]} alt={product.title}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
          )}
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center"
            style={{ touchAction: "manipulation" }}
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {/* Discount badge */}
          {disc > 0 && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">−{disc}%</div>
          )}
          {/* Expand to fullscreen */}
          {imgs.length > 0 && (
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center"
              data-testid={`btn-detail-expand-${product.id}`}
              style={{ touchAction: "manipulation" }}
            >
              <Expand className="w-4 h-4 text-white" />
            </button>
          )}
          {/* Dot nav */}
          {imgs.length > 1 && (
            <div className="absolute bottom-3 left-0 right-12 flex justify-center gap-1.5">
              {imgs.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{ touchAction: "manipulation" }}
                  className={`rounded-full transition-all ${i === imgIdx ? "w-4 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />
              ))}
            </div>
          )}
        </div>

        {/* ── Thumb strip ── */}
        {imgs.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none bg-white">
            {imgs.map((src, i) => (
              <button key={i}
                onClick={() => setImgIdx(i)}
                onDoubleClick={() => { setImgIdx(i); setLightboxOpen(true); }}
                style={{ touchAction: "manipulation" }}
                className={`w-13 h-13 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === imgIdx ? "border-tsia-green scale-105" : "border-slate-200 opacity-60 hover:opacity-100"}`}
              >
                <img src={src} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div className="p-5 space-y-4 bg-white">
          {/* Title + category */}
          <div>
            <p className="text-xs text-slate-400 font-medium">{CATEGORY_ICONS[product.category]} {CATEGORY_LABELS[product.category]}</p>
            <h2 className="text-xl font-bold mt-1 leading-tight text-slate-900">{product.title}</h2>
          </div>

          {/* Price row */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
                <span className="text-sm text-slate-400 line-through">${orig}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{formatAmount(parseFloat(product.price))}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${product.condition === "new" ? "bg-tsia-green/10 text-tsia-green border-tsia-green/20" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
              {product.condition}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <div className="flex items-center gap-1">
              <StarRating rating={avgRating} count={ratingCount} />
              {avgRating > 0 && <span className="text-[11px] font-semibold text-amber-500 ml-0.5">{avgRating.toFixed(1)}</span>}
              {ratingCount === 0 && <span className="text-slate-400">No ratings</span>}
            </div>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{product.location}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</span>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>

          {/* Seller card */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
            <div className="w-11 h-11 rounded-full bg-tsia-green flex items-center justify-center font-bold text-white text-base shrink-0">
              {product.sellerName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">{product.sellerName}</p>
              <p className="text-xs text-slate-400">Verified TSIA seller</p>
            </div>
            <span className="text-[11px] font-bold text-tsia-green bg-tsia-green/10 border border-tsia-green/20 px-2.5 py-1 rounded-full shrink-0">✓ Verified</span>
          </div>

          {/* Stock + negotiable */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl p-3">
            <span className="text-amber-700 text-sm flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />{product.stock} in stock</span>
            {product.negotiable && (
              <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                <HandCoins className="w-3 h-3" /> Negotiable
              </span>
            )}
          </div>

          {/* Shipping note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
            <span>Shipping details are arranged with the seller in chat. Use your TSIA email for all payments to stay protected.</span>
          </div>

          {/* ── Rate this product ── */}
          {canRate && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-slate-800">{myRating ? "Update your rating" : "Rate this product"}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={pendingRating} interactive onRate={r => setPendingRating(r)} />
                {pendingRating > 0 && <span className="text-sm font-bold text-amber-500">{pendingRating}/5</span>}
              </div>
              <input
                placeholder="Leave a comment (optional)"
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-green/30"
                data-testid="input-rating-comment"
              />
              <Button
                onClick={() => rateMutation.mutate({ rating: pendingRating, comment: ratingComment })}
                disabled={pendingRating === 0 || rateMutation.isPending}
                size="sm"
                className="bg-tsia-green text-white rounded-xl w-full font-semibold"
                data-testid="btn-submit-rating"
              >
                {rateMutation.isPending ? "Submitting…" : myRating ? "Update rating" : "Submit rating"}
              </Button>
            </div>
          )}

          {/* ── Reviews list ── */}
          {(ratingsData?.ratings?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-800">{ratingsData!.ratings.length} Review{ratingsData!.ratings.length !== 1 ? "s" : ""}</p>
              {ratingsData!.ratings.slice(0, 5).map(r => (
                <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">{r.userName}</p>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-2.5 h-2.5 ${s <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-slate-500">{r.comment}</p>}
                  <p className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="px-5 pb-6 pt-2 bg-white flex flex-col gap-2.5 border-t border-slate-100">
          {isMyListing ? (
            <div className="w-full py-3 px-4 bg-slate-100 rounded-2xl text-center text-sm font-semibold text-slate-500">
              This is your listing
            </div>
          ) : (
            <>
              <Button onClick={onBuy} disabled={product.stock === 0} className="w-full py-4 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-base shadow-sm" data-testid={`btn-detail-buy-${product.id}`}>
                <Lock className="w-5 h-5 mr-2" />
                {product.negotiable ? "Negotiate & Buy" : "Buy with Escrow"}
                {" "}— ${parseFloat(product.price).toFixed(2)}
              </Button>
              {onCart && (
                <Button
                  variant="outline"
                  onClick={onCart}
                  className={`w-full rounded-2xl font-semibold h-11 border-slate-200 text-slate-700 transition-all ${inCart ? "border-tsia-green text-tsia-green bg-tsia-green/5" : ""}`}
                  data-testid={`btn-detail-cart-${product.id}`}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {inCart ? "Remove from Cart" : "Save to Cart"}
                </Button>
              )}
            </>
          )}
          {!isMyListing && onChat && (
            <Button variant="outline" onClick={onChat} className="w-full rounded-2xl font-semibold h-11 border-slate-200 text-slate-700" data-testid={`btn-detail-chat-${product.id}`}>
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
  const { data: purchases = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/purchases"], enabled: !!user });
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
    <div className="relative" style={{ background: "#F1F5F9", marginTop: "-24px", marginBottom: "-24px", marginLeft: "-16px", marginRight: "-16px", paddingBottom: "96px", width: "calc(100% + 32px)", maxWidth: "none" }}>

      {/* ── Clean mobile header ────────────────────────────────────────────── */}
      <div className="bg-white shadow-sm sticky top-0 z-30 px-4 pt-4 pb-3">
        {/* Top row: greeting + icons */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* User avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tsia-green to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {user?.firstName?.[0]?.toUpperCase() ?? "G"}
            </div>
            <div>
              <p className="text-xs text-slate-500">Welcome back,</p>
              <button
                onClick={() => { setDeliverToInput(deliverTo); setDeliverToOpen(true); }}
                data-testid="btn-deliver-to"
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <p className="text-sm font-bold text-slate-800">{user?.firstName || "Shopper"}</p>
                {deliverTo && <p className="text-[11px] text-tsia-green flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{deliverTo}</p>}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setChatDrawerOpen(true)} data-testid="btn-messages" className="relative w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
              <MessageCircle className="w-4.5 h-4.5 text-slate-700 w-5 h-5" />
            </button>
            <button onClick={() => setCartOpen(true)} data-testid="btn-cart" className="relative w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ShoppingCart className="w-5 h-5 text-slate-700" />
              {cart.size > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 w-[18px] h-[18px] bg-tsia-green text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {Math.min(cart.size, 99)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 relative" ref={searchBoxRef}>
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-2xl px-4 h-11 border border-transparent focus-within:border-tsia-green/50 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search TSIA Market..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={e => { if (e.key === "Enter") submitSearch(search); }}
              data-testid="input-search"
              className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            {search && <button onClick={() => { setSearch(""); setActiveSearch(""); }} data-testid="btn-clear-search"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
          </div>
          <button
            className="w-11 h-11 bg-tsia-green rounded-2xl flex items-center justify-center shrink-0 hover:bg-tsia-green/90 transition-colors shadow-sm relative"
            onClick={() => setFilterOpen(true)}
            data-testid="btn-filter"
          >
            <SlidersHorizontal className="w-4 h-4 text-white" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-900 text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
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
                className="absolute left-0 right-14 top-12 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[70vh] overflow-y-auto"
                data-testid="search-suggestions-dropdown"
              >
                {q && liveSuggestions.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Matching "{search}"</div>
                    {liveSuggestions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setDetailOpen(true); setSearchFocused(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left"
                        data-testid={`suggestion-product-${p.id}`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">{CATEGORY_ICONS[p.category] || "📦"}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{p.title}</div>
                          <div className="text-[11px] text-slate-400">{CATEGORY_LABELS[p.category]} · {formatAmount(parseFloat(p.price))}</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {q && (
                  <button
                    onClick={() => submitSearch(search)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-tsia-green/5 border-b border-slate-100 text-left font-semibold text-sm text-tsia-green"
                    data-testid="btn-see-all-results"
                  >
                    <span className="flex items-center gap-2"><Search className="w-4 h-4" /> See all results for "{search}"</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {!q && recentSearches.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Recent searches</span>
                      <button onClick={clearRecentSearches} className="text-[10px] text-slate-400 hover:text-red-500" data-testid="btn-clear-recent-searches">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {recentSearches.map(s => (
                        <button
                          key={s}
                          onClick={() => submitSearch(s)}
                          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 flex items-center gap-1"
                          data-testid={`recent-search-${s}`}
                        >
                          <Clock className="w-3 h-3" />{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!q && trendingTerms.length > 0 && (
                  <div className="border-b border-slate-100">
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Trending
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {trendingTerms.map(t => (
                        <button
                          key={t}
                          onClick={() => submitSearch(t)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
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
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Browse by category</div>
                    <div className="grid grid-cols-3 gap-1 px-3 pb-3">
                      {CATEGORIES.slice(0, 12).map(c => (
                        <button
                          key={c}
                          onClick={() => { setActiveCategory(c); setSearchFocused(false); }}
                          className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl hover:bg-slate-50"
                          data-testid={`suggest-cat-${c}`}
                        >
                          <span className="text-xl">{CATEGORY_ICONS[c]}</span>
                          <span className="text-[10px] font-semibold text-slate-700 text-center leading-tight px-1 line-clamp-1">{CATEGORY_LABELS[c]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800">Shop by Category</h3>
                <button onClick={() => setShowCategoriesModal(true)} className="text-xs font-semibold text-tsia-green hover:underline flex items-center gap-0.5" data-testid="btn-view-all-cats">See all <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
              <CategoryRow activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
            </div>
          )}

          {/* Hero category tiles — shown first so content is visible before promo */}
          {!activeSearch && (
            <HeroCategoryTiles products={products as Product[]} onPick={(c) => setActiveCategory(c)} />
          )}

          {/* Promo Banner — after tiles so it doesn't feel like part of the header */}
          {!activeSearch && (
            <PromoBanner onAction={(slideId) => {
              setActiveCategory("");
              setActiveSearch("");
              setSearch("");
              if (slideId === 1) {
                // Mega Sale → show popular / most-viewed items
                setFilterSort("popular");
                setShowAllProducts(true);
              } else if (slideId === 2) {
                // Fresh Drops → show newest listings
                setFilterSort("newest");
                setShowAllProducts(true);
              } else {
                // Exclusive Picks → show all products sorted by popularity
                setFilterSort("popular");
                setShowAllProducts(true);
              }
            }} />
          )}

          {/* Category shelf — scrollable row of all categories */}
          {!activeSearch && (
            <CategoryShelf onPick={(c) => setActiveCategory(c)} />
          )}

          {/* Today's Deals — with live countdown */}
          {!activeSearch && filteredProducts.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" data-testid="rail-todays-deals">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-500" /> Today's Deals
                  <CountdownBadge />
                </h3>
                <button className="text-xs font-semibold text-tsia-green hover:underline flex items-center gap-0.5" onClick={() => setShowAllProducts(true)}>See all <ChevronRight className="w-3.5 h-3.5" /></button>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" data-testid="rail-buy-again">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-tsia-green" /> Buy it again
                </h3>
                <button className="text-xs font-semibold text-tsia-green hover:underline flex items-center gap-0.5" onClick={() => setTab("purchases")}>Your orders <ChevronRight className="w-3.5 h-3.5" /></button>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" /> Best Sellers
                </h3>
                <button className="text-xs font-semibold text-tsia-green hover:underline flex items-center gap-0.5" onClick={() => setShowAllProducts(true)}>See all <ChevronRight className="w-3.5 h-3.5" /></button>
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
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100" data-testid="rail-recently-viewed">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-tsia-green" /> Recently Viewed
                  </h3>
                  <button onClick={() => { setRecentlyViewed([]); try { localStorage.removeItem("tsia_recently_viewed"); } catch {} }}
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors" data-testid="btn-clear-recent">Clear</button>
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
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-800">
                {activeSearch ? `Results for "${activeSearch}"` : activeCategory ? `${CATEGORY_LABELS[activeCategory] || activeCategory}` : "New Arrivals"}
              </h3>
              <div className="flex items-center gap-2">
                {activeCategory && user && (
                  <button
                    onClick={() => toggleCategorySubscription(activeCategory)}
                    data-testid={`btn-subscribe-cat-${activeCategory}`}
                    title={subscribedCats.has(activeCategory) ? "Unsubscribe from new arrivals" : "Get notified of new arrivals"}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all hover:opacity-80 ${
                      subscribedCats.has(activeCategory)
                        ? "text-tsia-green border-tsia-green bg-tsia-green/5"
                        : "text-slate-500 border-slate-300"
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    {subscribedCats.has(activeCategory) ? "Subscribed" : "Subscribe"}
                  </button>
                )}
                {(products as Product[]).length > 12 && !showAllProducts && (
                  <button className="text-xs font-semibold text-tsia-green hover:underline" onClick={() => setShowAllProducts(true)}>See all {(products as Product[]).length}</button>
                )}
              </div>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : (products as Product[]).length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold mb-1 text-slate-700">No products found</p>
                <p className="text-sm mb-4 text-slate-400">Try a different search or category.</p>
                <Button onClick={() => setListOpen(true)} className="font-bold rounded-full bg-tsia-green text-white"><Plus className="w-4 h-4 mr-1.5" /> Be the first to list</Button>
              </div>
            ) : (
              <>
                {filterViewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {gridProducts.map(p => (
                      <ProductCard key={p.id} product={p} onView={() => handleView(p)} onBuy={() => handleBuy(p)} wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)} inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) { toast({ title: "Added to cart", description: `${p.title} saved to your cart.` }); } }} watched={watchedIds.has(p.id)} onWatch={() => toggleWatch(p)} isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gridProducts.map(p => {
                      const img = p.images?.[0];
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleView(p)}>
                          <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0">
                            {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xl">{CATEGORY_ICONS[p.category]}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm line-clamp-1 text-slate-800">{p.title}</p>
                            <p className="text-xs text-slate-400 capitalize">{p.condition} · {p.category}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-tsia-green font-black text-sm">${parseFloat(p.price).toFixed(2)}</span>
                              <span className="text-[11px] text-slate-400 line-through">${originalPrice(p.price)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)) ? (
                              <span className="text-[10px] font-semibold text-tsia-green bg-tsia-green/10 px-2 py-1 rounded-full shrink-0">Your listing</span>
                            ) : (
                              <>
                                <button onClick={e => { e.stopPropagation(); toggleCart(p.id); if (!cart.has(p.id)) { toast({ title: "Added to cart", description: `${p.title} saved to your cart.` }); } }}
                                  data-testid={`btn-list-cart-${p.id}`}
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${cart.has(p.id) ? "bg-tsia-green/10 border-tsia-green text-tsia-green" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-tsia-green/5"}`}
                                  title={cart.has(p.id) ? "Remove from cart" : "Add to cart"}>
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleBuy(p); }} className="w-10 h-10 bg-tsia-green hover:bg-tsia-green/90 rounded-xl flex items-center justify-center shrink-0 transition-colors" title="Buy (Escrow Protected)">
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
                    className="w-full mt-4 py-2.5 font-bold text-sm rounded-2xl bg-tsia-green text-white hover:bg-tsia-green/90 flex items-center justify-center gap-2 transition-colors shadow-sm"
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
            <div>
              <h2 className="font-bold text-base text-slate-800">My Listings</h2>
              <p className="text-xs text-slate-400">{(myListings as Product[]).length} product{(myListings as Product[]).length !== 1 ? "s" : ""}</p>
            </div>
            <Button onClick={() => setListOpen(true)} size="sm" data-testid="btn-new-listing" className="bg-tsia-green text-white rounded-xl h-9 shadow-sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New listing
            </Button>
          </div>
          {(myListings as Product[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <div className="w-16 h-16 bg-tsia-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-tsia-green" />
              </div>
              <p className="font-bold text-slate-800 mb-1">No listings yet</p>
              <p className="text-slate-400 text-sm mb-4">Start selling — TSIA only takes 8%.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white rounded-xl shadow-sm"><Plus className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(myListings as Product[]).map(p => {
                const img = p.images?.[0];
                return (
                  <div key={p.id} data-testid={`card-listing-${p.id}`} className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
                    <div className="aspect-square bg-slate-50 relative">
                      {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                      <Badge className={`absolute top-2 left-2 text-[10px] rounded-full ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm line-clamp-1 text-slate-800">{p.title}</p>
                      <p className="text-base font-black text-tsia-green">${parseFloat(p.price).toFixed(2)}</p>
                      <p className="text-xs text-slate-400">{p.stock} in stock · {p.viewCount} views</p>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl border-slate-200" onClick={() => handleView(p)} data-testid={`btn-view-listing-${p.id}`}>View</Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-amber-600 border-amber-200"
                          onClick={() => { apiRequest("PATCH", `/api/products/${p.id}`, { status: p.status === "paused" ? "active" : "paused" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/products/my"] })); }}
                          data-testid={`btn-toggle-listing-${p.id}`}>
                          {p.status === "paused" ? "Activate" : "Pause"}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-blue-600 border-blue-200"
                          onClick={() => { setEditingListing(p); setListOpen(true); }}
                          data-testid={`btn-edit-listing-${p.id}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-red-500 border-red-200"
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
          <div>
            <h2 className="font-bold text-base text-slate-800">My Orders</h2>
            <p className="text-xs text-slate-400">{(purchases as Order[]).length} order{(purchases as Order[]).length !== 1 ? "s" : ""}</p>
          </div>
          {(purchases as Order[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-bold text-slate-800 mb-1">No orders yet</p>
              <p className="text-slate-400 text-sm mb-4">Browse the marketplace and place your first order.</p>
              <Button onClick={() => setTab("browse")} variant="outline" className="rounded-xl"><ShoppingBag className="w-4 h-4 mr-1.5" /> Shop now</Button>
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
          <div>
            <h2 className="font-bold text-base text-slate-800">My Sales</h2>
            <p className="text-xs text-slate-400">{(sales as Order[]).length} sale{(sales as Order[]).length !== 1 ? "s" : ""}</p>
          </div>
          {(sales as Order[]).length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <div className="w-16 h-16 bg-tsia-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-tsia-green" />
              </div>
              <p className="font-bold text-slate-800 mb-1">No sales yet</p>
              <p className="text-slate-400 text-sm mb-4">List a product to start earning.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white rounded-xl shadow-sm"><Tag className="w-4 h-4 mr-1.5" /> List a Product</Button>
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

      {/* ── Stats bar (browse tab only) ───────────────────────────────── */}
      {tab === "browse" && (products as Product[]).length > 0 && (
        <div className="grid grid-cols-3 gap-0 mt-3 bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
          {[
            { label: "Products", value: (products as Product[]).length, icon: Package, color: "#10B981" },
            { label: "Saved", value: wishlist.size, icon: Heart, color: "#EF4444" },
            { label: "Commission", value: "8%", icon: BadgePercent, color: "#10B981" },
          ].map((s, i) => (
            <div key={s.label} style={{ borderRight: i < 2 ? "1px solid #E2E8F0" : "none" }} className="p-3 text-center">
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

      {/* ── Category Browser Overlay ────────────────────────────────── */}
      <CategoryBrowserOverlay
        open={showCategoriesModal}
        onClose={() => setShowCategoriesModal(false)}
        onPick={(cat) => { setActiveCategory(cat); setShowCategoriesModal(false); }}
      />

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

      {/* ── Mini footer ──────────────────────────────────────────────────── */}
      <div className="mt-6 -mx-4 px-4 py-4 bg-white border-t border-slate-100">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-xl bg-tsia-green flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-slate-800">TSIA <span className="text-tsia-green">Market</span></span>
        </div>
        <p className="text-[10px] text-slate-400 text-center">Escrow Protected · Verified Sellers · SMAKEMGGOLD Ltd</p>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} data-testid="btn-back-to-top"
          className="mt-3 w-full text-xs text-slate-500 flex items-center justify-center gap-1 hover:text-tsia-green transition-colors">
          <ChevronUp className="w-3.5 h-3.5" /> Back to top
        </button>
      </div>

      {/* ── Bottom Navigation Bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
        <div className="flex items-center px-2 py-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-2xl transition-all relative"
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                tab === t.id
                  ? "bg-tsia-green text-white shadow-sm shadow-tsia-green/30"
                  : "text-slate-400"
              }`}>
                <t.icon className="w-5 h-5" />
                {t.id === "purchases" && (purchases as Order[]).length > 0 && tab !== "purchases" && (
                  <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${tab === t.id ? "text-tsia-green" : "text-slate-400"}`}>
                {t.label}
              </span>
            </button>
          ))}
          {/* Sell FAB */}
          <button
            onClick={() => setListOpen(true)}
            data-testid="btn-sell"
            className="flex-1 flex flex-col items-center gap-1 py-2 px-1"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-tsia-green to-emerald-600 flex items-center justify-center shadow-sm shadow-tsia-green/30">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-semibold text-tsia-green">Sell</span>
          </button>
        </div>
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
