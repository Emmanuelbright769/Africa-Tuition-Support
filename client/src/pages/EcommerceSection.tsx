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
  Lock, PackageOpen, Clock, ChevronUp, Send, ShieldCheck, RotateCcw, Home,
  Layers, Bookmark, Settings, WalletCards
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ECOMMERCE } from "@shared/schema";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import { EcommerceChatDrawer, ProductChatModal } from "./EcommerceChatPanel";
import MarketplaceWalletView from "@/components/MarketplaceWalletView";

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
type Tab = "home" | "wishlist" | "account";
type AccountSubTab = "listings" | "orders" | "sales";

// ─── Constants ─────────────────────────────────────────────────────────────
const CATEGORY_ICONS = ECOMMERCE.CATEGORY_ICONS;
const CATEGORY_LABELS = ECOMMERCE.CATEGORY_LABELS;
const CATEGORIES = ECOMMERCE.CATEGORIES;

// ─── Shoppe Design Tokens ──────────────────────────────────────────────────
const S = {
  blue:       "#1B4FFF",
  blueDark:   "#1237CC",
  blueLight:  "#4F7FFF",
  blueBg:     "#EEF2FF",
  orange:     "#FF6B35",
  red:        "#FF3B30",
  bg:         "#F5F7FF",
  card:       "#FFFFFF",
  text:       "#111827",
  muted:      "#9CA3AF",
  border:     "#F0F0F0",
  green:      "#10B981",
  amber:      "#F59E0B",
};

const PROMO_SLIDES = [
  {
    id: 1,
    tag: "🔥 Flash Sale",
    headline: "Mega Sale\nUp to 40% Off",
    sub: "Limited time deals on top items",
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=400&fit=crop&auto=format",
    accent: "from-[#1B4FFF] to-[#4F7FFF]",
  },
  {
    id: 2,
    tag: "⚡ New Arrivals",
    headline: "Fresh Drops\nEvery Day",
    sub: "Brand new listings from verified sellers",
    img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=400&fit=crop&auto=format",
    accent: "from-[#FF6B35] to-[#FF3B30]",
  },
  {
    id: 3,
    tag: "💎 For Members",
    headline: "Exclusive\nPicks For You",
    sub: "Handpicked by TSIA for scholarship students",
    img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&h=400&fit=crop&auto=format",
    accent: "from-[#7C3AED] to-[#4F46E5]",
  },
];

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped:   "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  active:    "bg-green-100 text-green-700",
  sold:      "bg-slate-100 text-slate-600",
  paused:    "bg-amber-100 text-amber-700",
};

const originalPrice = (price: string) => (parseFloat(price) * 1.28).toFixed(2);

const CAT_ICONS_CIRCULAR = [
  { cat: "",              emoji: "🛍️", label: "All",       color: S.blue },
  { cat: "fashion",       emoji: "👗", label: "Fashion",   color: "#EC4899" },
  { cat: "electronics",   emoji: "🔌", label: "Gadgets",   color: "#8B5CF6" },
  { cat: "phones",        emoji: "📱", label: "Phones",    color: "#3B82F6" },
  { cat: "computers",     emoji: "💻", label: "Computers", color: "#0EA5E9" },
  { cat: "home",          emoji: "🏠", label: "Home",      color: "#92400E" },
  { cat: "sports",        emoji: "⚽", label: "Sports",    color: "#16A34A" },
  { cat: "beauty",        emoji: "💄", label: "Beauty",    color: "#DB2777" },
  { cat: "food",          emoji: "🍎", label: "Food",      color: "#65A30D" },
  { cat: "books",         emoji: "📚", label: "Books",     color: "#7C3AED" },
  { cat: "health",        emoji: "💊", label: "Health",    color: "#EF4444" },
  { cat: "other",         emoji: "📦", label: "More",      color: "#6B7280" },
];

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
      { label: "Smart TVs",         img: "https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=300&h=300&fit=crop&auto=format", cat: "electronics" },
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

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ rating = 0, count = 0, interactive = false, onRate }: { rating?: number; count?: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = interactive ? (hover || rating) : rating;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s}
          className={`transition-colors ${interactive ? "w-5 h-5 cursor-pointer" : "w-3 h-3"} ${s <= Math.floor(display) ? "fill-[#FFA41C] text-[#FFA41C]" : "fill-slate-200 text-slate-200"}`}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(s)}
        />
      ))}
      {!interactive && count > 0 && <span className="text-[10px] text-slate-400 ml-0.5">({count})</span>}
    </div>
  );
}

// ─── Countdown Badge ─────────────────────────────────────────────────────────
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
  const sec = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-white/20 text-white">
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(sec).padStart(2,"0")}
    </span>
  );
}

// ─── Shoppe Promo Banner ──────────────────────────────────────────────────────
function ShoppePromo({ onAction }: { onAction: (slideId: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PROMO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const s = PROMO_SLIDES[idx];
  const lines = s.headline.split("\n");

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height: 180 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 cursor-pointer"
          onClick={() => onAction(s.id)}
        >
          {/* Background image */}
          <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-r ${s.accent} opacity-80`} />
          {/* Decorative circles */}
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute right-10 -bottom-4 w-20 h-20 rounded-full bg-white/10" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div>
              <span className="inline-block text-[11px] font-bold bg-white/25 text-white px-3 py-1 rounded-full mb-2">{s.tag}</span>
              {lines.map((l, i) => (
                <div key={i} className={`text-white font-black leading-tight ${i === 0 ? "text-xl" : "text-2xl"}`}>{l}</div>
              ))}
              <p className="text-white/80 text-xs mt-1">{s.sub}</p>
            </div>
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-1.5 text-xs font-bold bg-white text-gray-900 px-4 py-2 rounded-full hover:bg-white/90 transition active:scale-95"
                onClick={e => { e.stopPropagation(); onAction(s.id); }}
              >
                Shop Now <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {/* Flash sale timer on slide 1 */}
              {s.id === 1 && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  <CountdownBadge />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-3 right-5 flex gap-1.5 z-10">
        {PROMO_SLIDES.map((_, i) => (
          <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
            className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Category Icons Row (Shoppe circular style) ───────────────────────────────
function CategoryIconsRow({ activeCategory, onPick, onSeeAll }: {
  activeCategory: string;
  onPick: (cat: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none px-1">
      {CAT_ICONS_CIRCULAR.map(c => {
        const active = activeCategory === c.cat;
        return (
          <button key={c.cat} onClick={() => c.label === "More" ? onSeeAll() : onPick(c.cat)}
            data-testid={`cat-icon-${c.cat || "all"}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${active ? "shadow-lg scale-105" : "group-hover:scale-105"}`}
              style={{ background: active ? c.color : `${c.color}18`, border: active ? `2px solid ${c.color}` : "2px solid transparent" }}>
              {c.emoji}
            </div>
            <span className={`text-[10px] font-semibold text-center leading-tight max-w-[56px] transition-colors ${active ? "text-[#1B4FFF]" : "text-slate-500"}`}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Category Browser Overlay ─────────────────────────────────────────────────
function CategoryBrowserOverlay({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (cat: string) => void;
}) {
  const [activeCat, setActiveCat] = useState(CAT_BROWSER[0]);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0; }, [activeCat]);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99998, display: "flex", flexDirection: "column", background: "#F5F7FF" }}>
      {/* Header */}
      <div style={{ background: S.blue, display: "flex", alignItems: "center", padding: "0 4px", height: 56, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer" }}>
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", color: "white", fontWeight: 800, fontSize: 18 }}>Categories</h1>
        <div style={{ width: 44 }} />
      </div>
      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left sidebar */}
        <div style={{ width: 96, background: "white", borderRight: "1px solid #E8E8E8", overflowY: "auto", flexShrink: 0 }}>
          {CAT_BROWSER.map(cat => {
            const active = activeCat.id === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCat(cat)} data-testid={`sidebar-cat-${cat.id}`}
                style={{
                  width: "100%", padding: "14px 8px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  background: active ? `${S.blue}10` : "white",
                  borderLeft: `3px solid ${active ? S.blue : "transparent"}`,
                  borderBottom: "1px solid #F0F0F0",
                  borderRight: "none", borderTop: "none",
                  cursor: "pointer",
                }}>
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? S.blue : "#555", textAlign: "center", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Right panel */}
        <div ref={rightPanelRef} style={{ flex: 1, overflowY: "auto", padding: "14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{activeCat.label}</span>
            <button onClick={() => { onPick(activeCat.id); onClose(); }} style={{ color: S.blue, fontSize: 13, fontWeight: 600, border: "none", background: "none", cursor: "pointer" }}>All</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {activeCat.subs.map(sub => (
              <button key={sub.label} onClick={() => { onPick(sub.cat); onClose(); }} data-testid={`sub-cat-${sub.label.replace(/\s+/g,"-").toLowerCase()}`}
                style={{ background: "white", border: "none", borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column" }}>
                <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#f5f5f5" }}>
                  <img src={sub.img} alt={sub.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
                </div>
                <div style={{ padding: "8px 8px 10px", textAlign: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#333", lineHeight: 1.35, display: "block" }}>{sub.label}</span>
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

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ images, startIndex, open, onClose }: { images: string[]; startIndex: number; open: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const [imgLoaded, setImgLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => { if (open) { setIdx(startIndex); setImgLoaded(false); } }, [open, startIndex]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { setImgLoaded(false); setIdx(i => (i + 1) % images.length); }
      if (e.key === "ArrowLeft")  { setImgLoaded(false); setIdx(i => (i - 1 + images.length) % images.length); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, images.length, onClose]);

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
    if (Math.abs(dy) > Math.abs(dx)) { if (dy > 60) onClose(); }
    else if (Math.abs(dx) > 40) { if (dx < 0) goNext(); else goPrev(); }
    touchStartX.current = null; touchStartY.current = null;
  };

  if (!images.length || !open) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", touchAction: "manipulation", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      onClick={onClose} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <button style={{ position: "absolute", top: 52, right: 16, zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}
        onClick={e => { e.stopPropagation(); onClose(); }}>
        <X className="w-5 h-5 text-white" />
      </button>
      {images.length > 1 && <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 2, background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.85)", fontSize: 13, padding: "4px 14px", borderRadius: 20 }}>{idx + 1} / {images.length}</div>}
      {!imgLoaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>}
      <img key={idx} src={images[idx]} alt={`Image ${idx + 1}`} style={{ maxWidth: "95vw", maxHeight: "78vh", objectFit: "contain", borderRadius: 12, userSelect: "none", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.15s", zIndex: 2, cursor: "default", touchAction: "pinch-zoom" }}
        onLoad={() => setImgLoaded(true)} draggable={false} decoding="async" onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} />
      {images.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); goPrev(); }} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <button onClick={e => { e.stopPropagation(); goNext(); }} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </>}
      {images.length > 1 && <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 8, zIndex: 2 }} onClick={e => e.stopPropagation()}>
        {images.map((_, i) => <button key={i} onClick={e => { e.stopPropagation(); setImgLoaded(false); setIdx(i); }} className={`rounded-full transition-all ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40"}`} />)}
      </div>}
    </div>,
    document.body
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function CartDrawer({ open, onClose, cartIds, onBuy, onRemove, onClearAll }: {
  open: boolean; onClose: () => void; cartIds: Set<number>;
  onBuy: (product: Product) => void; onRemove: (id: number) => void; onClearAll: () => void;
}) {
  const { formatAmount } = useLocalCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = 0; }, [open]);

  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/browse-all"],
    queryFn: async () => { const res = await fetch("/api/products", { credentials: "include" }); return res.json(); },
    enabled: open && cartIds.size > 0,
    staleTime: 30_000,
  });

  const cartItems = (allProducts as Product[]).filter(p => cartIds.has(p.id));
  const stalePids = Array.from(cartIds).filter(id => !allProducts.find(p => p.id === id));
  const outOfStockCount = cartItems.filter(p => p.stock === 0).length;
  const totalValue = cartItems.reduce((s, p) => s + parseFloat(p.price), 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="cart-panel"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: S.bg }}
          data-testid="cart-drawer">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b shrink-0" style={{ background: S.blue }}>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center" data-testid="btn-cart-close">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-white" />
              <h3 className="font-bold text-lg text-white">My Cart</h3>
              {cartIds.size > 0 && <span className="w-6 h-6 bg-white text-xs font-bold rounded-full flex items-center justify-center" style={{ color: S.blue }}>{cartIds.size}</span>}
            </div>
            {cartIds.size > 0 ? (
              <button onClick={onClearAll} className="text-xs text-white/70 font-semibold hover:text-white transition-colors">Clear all</button>
            ) : <div className="w-16" />}
          </div>

          {outOfStockCount > 0 && (
            <div className="mx-4 mt-3 shrink-0 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span><strong>{outOfStockCount}</strong> item{outOfStockCount > 1 ? "s are" : " is"} out of stock.</span>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartIds.size === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <ShoppingCart className="w-8 h-8" style={{ color: S.blue }} />
                </div>
                <p className="font-bold text-lg text-gray-800 mb-1">Your cart is empty</p>
                <p className="text-gray-400 text-sm">Browse and add items to your cart</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white animate-pulse" />)}</div>
            ) : (<>
              {cartItems.map(p => {
                const img = p.images?.[0];
                const outOfStock = p.stock === 0;
                return (
                  <div key={p.id} data-testid={`cart-item-${p.id}`}
                    className={`flex items-center gap-3 rounded-2xl p-3 border transition-all ${outOfStock ? "bg-red-50 border-red-200 opacity-80" : "bg-white border-gray-100 shadow-sm"}`}>
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[p.category]}</div>}
                      {outOfStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-[9px] font-bold text-white text-center leading-tight px-1">OUT OF STOCK</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-1 text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{p.condition}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-sm font-black" style={{ color: S.orange }}>${parseFloat(p.price).toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400">{formatAmount(parseFloat(p.price))}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => onBuy(p)} disabled={outOfStock} data-testid={`btn-cart-buy-${p.id}`}
                        className="h-8 px-3 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-all"
                        style={{ background: outOfStock ? "#ccc" : S.blue }}>
                        {outOfStock ? "N/A" : "Buy"}
                      </button>
                      <button onClick={() => onRemove(p.id)} data-testid={`btn-cart-remove-${p.id}`}
                        className="h-8 px-3 border border-red-200 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 transition-all">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {stalePids.map(id => (
                <div key={id} className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-3 opacity-60 bg-white">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center"><Package className="w-6 h-6 text-gray-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-500">Product no longer available</p>
                  </div>
                  <button onClick={() => onRemove(id)} className="h-8 px-3 border text-xs font-medium rounded-xl hover:bg-gray-50">Remove</button>
                </div>
              ))}
            </>)}
          </div>

          {cartItems.length > 0 && (
            <div className="p-4 border-t shrink-0 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">Total ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})</span>
                <span className="font-black text-xl" style={{ color: S.orange }}>${totalValue.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-gray-400 text-center">Each item is bought separately with escrow protection.</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Product Card (Shoppe grid style) ────────────────────────────────────────
function ProductCard({ product, onView, onBuy, wishlisted, onWishlist, inCart, onCart, watched, onWatch, isSeller }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
  inCart: boolean; onCart: () => void; watched?: boolean; onWatch?: () => void; isSeller?: boolean;
}) {
  const { formatAmount } = useLocalCurrency();
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  const discPct = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);

  return (
    <div className="bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group"
      onClick={onView} data-testid={`card-product-${product.id}`}
      style={{ boxShadow: "0 2px 12px rgba(27,79,255,0.06)" }}>
      {/* Image */}
      <div className="relative overflow-hidden rounded-t-2xl bg-gray-50" style={{ aspectRatio: "1/1" }}>
        {img ? (
          <img src={img} alt={product.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gray-50">{CATEGORY_ICONS[product.category] || "📦"}</div>
        )}
        {/* Wishlist */}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          data-testid={`btn-wishlist-${product.id}`}
          className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
          <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500 text-red-500" : "text-gray-300"}`} />
        </button>
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.condition === "new" && (
            <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: S.blue }}>NEW</span>
          )}
          {discPct > 0 && (
            <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: S.red }}>-{discPct}%</span>
          )}
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 rounded-t-2xl flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-xl">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{CATEGORY_LABELS[product.category]}</p>
        <h3 className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">{product.title}</h3>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
          <span className="text-base font-black" style={{ color: S.orange }}>${parseFloat(product.price).toFixed(2)}</span>
          <span className="text-[11px] text-gray-300 line-through">${orig}</span>
        </div>
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-[10px] font-semibold" style={{ color: S.red }}>Only {product.stock} left!</p>
        )}
      </div>

      {/* CTAs */}
      {!isSeller ? (
        <div className="px-3 pb-3 flex gap-2">
          <button onClick={e => { e.stopPropagation(); onCart(); }} data-testid={`btn-cart-add-${product.id}`}
            className="flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 border"
            style={inCart ? { background: `${S.blue}15`, borderColor: S.blue, color: S.blue } : { background: "#F3F4F6", borderColor: "#E5E7EB", color: "#6B7280" }}>
            <ShoppingCart className="w-3.5 h-3.5" />
            {inCart ? "✓" : "Cart"}
          </button>
          <button onClick={e => { e.stopPropagation(); onBuy(); }} disabled={product.stock === 0} data-testid={`btn-buy-${product.id}`}
            className="flex-1 py-2 text-[11px] font-bold text-white rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-40"
            style={{ background: S.blue }}>
            <Lock className="w-3.5 h-3.5" />
            Buy
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3">
          <span className="text-[10px] font-semibold rounded-lg px-2 py-1 block text-center" style={{ background: `${S.blue}10`, color: S.blue }}>Your listing</span>
        </div>
      )}
    </div>
  );
}

// ─── Featured Card (horizontal scroll) ───────────────────────────────────────
function FeaturedCard({ product, onView, onBuy, wishlisted, onWishlist, inCart, onCart, isSeller }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
  inCart: boolean; onCart: () => void; isSeller?: boolean;
}) {
  const { formatAmount } = useLocalCurrency();
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  const discPct = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);

  return (
    <div onClick={onView} data-testid={`card-featured-${product.id}`}
      className="shrink-0 w-44 bg-white rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group flex flex-col border border-gray-100"
      style={{ boxShadow: "0 2px 12px rgba(27,79,255,0.06)" }}>
      <div className="relative bg-gray-50 rounded-t-2xl overflow-hidden" style={{ height: 160 }}>
        {img ? (
          <img src={img} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-gray-300"}`} />
        </button>
        {discPct > 0 && <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: S.red }}>-{discPct}%</span>}
        {product.stock === 0 && <div className="absolute inset-0 bg-black/50 rounded-t-2xl flex items-center justify-center"><span className="text-white text-[9px] font-bold bg-black/60 px-2 py-1 rounded-lg">Out of Stock</span></div>}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-[12px] font-semibold text-gray-800 line-clamp-2 leading-snug">{product.title}</p>
        <StarRating rating={product.avgRating ?? 0} count={product.ratingCount ?? 0} />
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[13px] font-black" style={{ color: S.orange }}>${parseFloat(product.price).toFixed(2)}</span>
          <span className="text-[10px] text-gray-300 line-through">${orig}</span>
        </div>
      </div>
      {!isSeller ? (
        <div className="px-2.5 pb-2.5 flex gap-1.5">
          <button onClick={e => { e.stopPropagation(); onCart(); }} data-testid={`btn-featured-cart-${product.id}`}
            className="flex-1 py-1.5 text-[10px] font-bold rounded-xl flex items-center justify-center gap-0.5 transition-all border"
            style={inCart ? { background: `${S.blue}15`, borderColor: S.blue, color: S.blue } : { background: "#F3F4F6", borderColor: "#E5E7EB", color: "#6B7280" }}>
            <ShoppingCart className="w-3 h-3" /> {inCart ? "✓" : "Cart"}
          </button>
          <button onClick={e => { e.stopPropagation(); onBuy(); }} disabled={product.stock === 0} data-testid={`btn-featured-buy-${product.id}`}
            className="flex-1 py-1.5 text-[10px] font-bold text-white rounded-xl flex items-center justify-center gap-0.5 disabled:opacity-40 transition-all"
            style={{ background: S.blue }}>
            Buy
          </button>
        </div>
      ) : (
        <div className="px-2.5 pb-2.5"><span className="text-[9px] font-semibold rounded-lg block text-center py-1" style={{ background: `${S.blue}10`, color: S.blue }}>Your listing</span></div>
      )}
    </div>
  );
}

// ─── List Product Modal ───────────────────────────────────────────────────────
function ListProductModal({ open, onClose, editProduct }: { open: boolean; onClose: () => void; editProduct?: Product | null }) {
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const isEdit = !!editProduct;
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK", negotiable: false });
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editProduct) {
      setForm({ title: editProduct.title, description: editProduct.description, price: parseFloat(editProduct.price).toString(), category: editProduct.category, condition: editProduct.condition, stock: String(editProduct.stock), location: editProduct.location, negotiable: !!editProduct.negotiable });
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
          const MAX = 900; let { width, height } = img;
          if (width > MAX || height > MAX) { if (width > height) { height = Math.round(height * MAX / width); width = MAX; } else { width = Math.round(width * MAX / height); height = MAX; } }
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, ECOMMERCE.MAX_IMAGES - images.length);
    e.target.value = "";
    files.forEach(f => compressImage(f).then(dataUrl => setImages(prev => [...prev, dataUrl].slice(0, ECOMMERCE.MAX_IMAGES))).catch(err => toast({ title: "Image error", description: err.message, variant: "destructive" })));
  };

  const commission = parseFloat(form.price || "0") * ECOMMERCE.COMMISSION_RATE;
  const youReceive = parseFloat(form.price || "0") - commission;

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ background: S.blue }}>
          <h2 className="text-white font-bold text-xl">{isEdit ? "Edit Listing" : "List a Product"}</h2>
          <p className="text-white/70 text-sm mt-0.5">TSIA takes only 8% commission</p>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Image uploader */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Photos ({images.length}/{ECOMMERCE.MAX_IMAGES})</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {images.map((src, i) => (
                <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200">
                  <img src={src} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => setImages(p => p.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
              {images.length < ECOMMERCE.MAX_IMAGES && (
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-blue-300 transition-colors shrink-0">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] text-gray-400">Add</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImage} data-testid="input-product-image" />
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Product Title *</label>
            <input placeholder="e.g. iPhone 14 Pro Max 256GB" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} data-testid="input-product-title"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Description *</label>
            <textarea rows={3} placeholder="Describe your product — condition, specs, what's included..." value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} data-testid="input-product-description"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Price (USD) *</label>
              <input type="number" min={ECOMMERCE.MIN_PRICE} max={ECOMMERCE.MAX_PRICE} step={0.01} placeholder="0.00" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200" data-testid="input-product-price" />
              {parseFloat(form.price) > 0 && <p className="text-[11px] text-gray-400 mt-1">≈ {formatAmount(parseFloat(form.price))}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Stock qty</label>
              <input type="number" min={1} value={form.stock} onChange={e => setForm(p => ({...p, stock: e.target.value}))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200" data-testid="input-product-stock" />
            </div>
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} data-testid="select-product-category"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Condition</label>
              <select value={form.condition} onChange={e => setForm(p => ({...p, condition: e.target.value}))} data-testid="select-product-condition"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Your location</label>
            <input placeholder="London, UK" value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200" data-testid="input-product-location" />
          </div>

          {/* Negotiable toggle */}
          <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all`}
            style={form.negotiable ? { borderColor: S.blue, background: `${S.blue}08` } : { borderColor: "#E5E7EB", background: "#F9FAFB" }}
            onClick={() => setForm(p => ({...p, negotiable: !p.negotiable}))} data-testid="toggle-negotiable">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">Accept Price Negotiations</p>
                <p className="text-xs text-gray-400 mt-0.5">Let buyers propose a price via chat</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-3`} style={{ background: form.negotiable ? S.blue : "#D1D5DB" }}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.negotiable ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>
          </div>

          {/* Earnings */}
          {parseFloat(form.price) > 0 && (
            <div className="rounded-2xl p-4 border" style={{ background: `${S.blue}08`, borderColor: `${S.blue}20` }}>
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: S.blue }}>
                <BadgePercent className="w-3.5 h-3.5" /> Earnings breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Listing price</span><span className="font-semibold">${parseFloat(form.price || "0").toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>TSIA commission (8%)</span><span>−${commission.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1">
                  <span className="font-bold text-gray-800">You receive</span>
                  <span className="font-bold" style={{ color: S.blue }}>${youReceive.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-gray-100 flex gap-2.5">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl border-gray-200 text-gray-600">Cancel</Button>
          <Button onClick={() => createMutation.mutate({...form, images, price: parseFloat(form.price), stock: parseInt(form.stock), negotiable: form.negotiable})}
            disabled={createMutation.isPending || !form.title || !form.description || !form.price}
            data-testid="button-submit-product"
            className="flex-1 text-white rounded-xl font-bold shadow-sm"
            style={{ background: S.blue }}>
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isEdit ? "Save Changes" : "List Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tracking Timeline ────────────────────────────────────────────────────────
function TrackingTimeline({ orderId }: { orderId: number }) {
  const { data: tracking = [], isLoading } = useQuery<TrackingEntry[]>({
    queryKey: [`/api/orders/${orderId}/tracking`],
    refetchInterval: 600_000,
  });
  if (isLoading) return <div className="flex items-center gap-2 text-xs text-gray-400 py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tracking…</div>;
  if (!tracking.length) return <p className="text-xs text-gray-400 py-2">No tracking updates yet.</p>;
  return (
    <div className="mt-3 space-y-0">
      {[...tracking].reverse().map((t, i) => (
        <div key={t.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5`} style={{ background: i === 0 ? S.blue : "#D1D5DB" }} />
            {i < tracking.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: i === 0 ? S.blue : "#374151" }}>{t.statusLabel}</span>
              {t.location && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{t.location}</span>}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">{t.description}</p>
            <p className="text-[10px] text-gray-300 mt-0.5">{new Date(t.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Purchase Modal (Escrow) ──────────────────────────────────────────────────
function PurchaseModal({ product, open, onClose, walletBalance, onChat }: {
  product: Product | null; open: boolean; onClose: () => void; walletBalance: number; onChat?: () => void;
}) {
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();
  const [qty, setQty] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const total = product ? parseFloat(product.price) * qty : 0;
  const commission = total * ECOMMERCE.COMMISSION_RATE;
  const canAfford = walletBalance >= total;

  const buyMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/orders", data); return res.json(); },
    onSuccess: () => {
      toast({ title: "Order Placed — Funds in Escrow", description: "Your payment is secured. Release it to the seller once you receive your item." });
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
        <div className="px-5 pt-5 pb-4" style={{ background: S.blue }}>
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
          {/* Product thumbnail */}
          <div className="flex gap-3 bg-gray-50 rounded-xl p-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[product.category]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black" style={{ color: S.orange }}>${parseFloat(product.price).toFixed(2)}</span>
                <span className="text-xs text-gray-400">({formatAmount(parseFloat(product.price))})</span>
                {product.negotiable && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full">Negotiable</span>}
              </div>
              <p className="text-xs text-gray-400 capitalize">{product.condition} · {CATEGORY_LABELS[product.category]}</p>
            </div>
          </div>

          {/* Qty */}
          {product.stock > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold shrink-0">Qty</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => Math.max(1,q-1))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg leading-none">−</button>
                <span className="w-8 text-center font-bold text-lg">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock,q+1))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg leading-none">+</button>
                <span className="text-xs text-gray-400">/{product.stock}</span>
              </div>
            </div>
          )}

          {/* Delivery address */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery Address</Label>
            <Input placeholder="e.g. 14 Lagos Street, Abuja" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="mt-1.5 rounded-xl text-sm" />
          </div>

          {/* Escrow info */}
          <div className="rounded-xl p-4 space-y-2 border" style={{ background: `${S.blue}08`, borderColor: `${S.blue}20` }}>
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: S.blue }}><Lock className="w-3.5 h-3.5" /> How Escrow Protection Works</p>
            {["Your payment is held securely by TSIA — the seller doesn't receive it yet.", "Seller confirms, ships, and adds real-time tracking updates.", "Once you receive your item, tap \"Mark as Received\" to release payment.", "Seller gets paid instantly. Both parties are protected."].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${S.blue}20`, color: S.blue }}>{i+1}</span>
                <p className="text-[11px] text-blue-700/80 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-gray-400 text-xs"><span>Unit price × {qty}</span><span>${(parseFloat(product.price) * qty).toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>TSIA fee (8%)</span><span>−${commission.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5 text-sm"><span>You pay (escrow)</span><span style={{ color: S.orange }}>${total.toFixed(2)}</span></div>
          </div>

          {/* Wallet */}
          <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${canAfford ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {canAfford ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            {canAfford ? `Wallet: $${walletBalance.toFixed(2)} — Sufficient` : `Insufficient — need $${(total - walletBalance).toFixed(2)} more`}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          {onChat && (
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-semibold" onClick={() => { onClose(); onChat(); }} data-testid="btn-chat-seller">
              <MessageCircle className="w-4 h-4 mr-1.5" /> {product.negotiable ? "Negotiate" : "Chat"}
            </Button>
          )}
          <Button onClick={() => buyMutation.mutate({ productId: product.id, quantity: qty, deliveryAddress: deliveryAddress || undefined })}
            disabled={buyMutation.isPending || !canAfford} data-testid="button-confirm-purchase"
            className="flex-1 text-white font-bold rounded-xl h-11" style={{ background: S.blue }}>
            {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
            Place Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
function ProductDetailModal({ product, open, onClose, onBuy, onChat, isSeller, inCart, onCart }: {
  product: Product | null; open: boolean; onClose: () => void; onBuy: () => void;
  onChat?: () => void; isSeller?: boolean; inCart?: boolean; onCart?: () => void;
}) {
  const { formatAmount } = useLocalCurrency();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMyListing = isSeller || product?.sellerId === user?.id || (!!product?.sellerEmail && !!user?.email && product.sellerEmail === user.email);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [ratingComment, setRatingComment] = useState("");
  const [pendingRating, setPendingRating] = useState(0);

  const { data: ratingsData, refetch: refetchRatings } = useQuery<{ ratings: ProductRatingEntry[]; summary: { avgRating: number; count: number } }>({
    queryKey: [`/api/products/${product?.id}/ratings`],
    queryFn: async () => { const res = await fetch(`/api/products/${product!.id}/ratings`, { credentials: "include" }); return res.json(); },
    enabled: !!product?.id && open,
  });
  const { data: myRating } = useQuery<{ rating: number; comment: string | null } | null>({
    queryKey: [`/api/products/${product?.id}/my-rating`],
    queryFn: async () => { const res = await fetch(`/api/products/${product!.id}/my-rating`, { credentials: "include" }); return res.json(); },
    enabled: !!product?.id && open,
  });

  useEffect(() => { if (!open) setLightboxOpen(false); }, [open]);
  useEffect(() => {
    if (myRating) { setPendingRating(myRating.rating); setRatingComment(myRating.comment ?? ""); }
    else { setPendingRating(0); setRatingComment(""); }
  }, [myRating]);

  const rateMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment: string }) => {
      const res = await apiRequest("POST", `/api/products/${product!.id}/rate`, { rating, comment }); return res.json();
    },
    onSuccess: () => { toast({ title: "Rating submitted!", description: "Thank you for your feedback." }); refetchRatings(); queryClient.invalidateQueries({ queryKey: [`/api/products/${product?.id}/my-rating`] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!product) return null;
  const imgs = product.images?.length ? product.images : [];
  const orig = originalPrice(product.price);
  const disc = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);
  const avgRating = ratingsData?.summary?.avgRating ?? product.avgRating ?? 0;
  const ratingCount = ratingsData?.summary?.count ?? product.ratingCount ?? 0;

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0 bg-white text-gray-900 border-0 rounded-2xl">
        {/* Image hero */}
        <div className="relative w-full bg-gray-100 rounded-t-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {imgs.length > 0 ? (
            <img src={imgs[imgIdx]} alt={product.title} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightboxOpen(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center" style={{ touchAction: "manipulation" }}>
            <X className="w-4 h-4 text-white" />
          </button>
          {disc > 0 && <div className="absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow" style={{ background: S.red }}>−{disc}%</div>}
          {imgs.length > 0 && <button onClick={() => setLightboxOpen(true)} className="absolute bottom-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center" style={{ touchAction: "manipulation" }}><Expand className="w-4 h-4 text-white" /></button>}
          {imgs.length > 1 && (
            <div className="absolute bottom-3 left-0 right-12 flex justify-center gap-1.5">
              {imgs.map((_, i) => <button key={i} onClick={() => setImgIdx(i)} style={{ touchAction: "manipulation" }} className={`rounded-full transition-all ${i === imgIdx ? "w-4 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />)}
            </div>
          )}
        </div>

        {/* Thumb strip */}
        {imgs.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none bg-white">
            {imgs.map((src, i) => (
              <button key={i} onClick={() => setImgIdx(i)} style={{ touchAction: "manipulation", borderColor: i === imgIdx ? S.blue : undefined }}
                className={`w-13 h-13 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${i === imgIdx ? "scale-105" : "border-gray-200 opacity-60 hover:opacity-100"}`}>
                <img src={src} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4 bg-white">
          <div>
            <p className="text-xs text-gray-400 font-medium">{CATEGORY_ICONS[product.category]} {CATEGORY_LABELS[product.category]}</p>
            <h2 className="text-xl font-bold mt-1 leading-tight text-gray-900">{product.title}</h2>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ color: S.orange }}>${parseFloat(product.price).toFixed(2)}</span>
                <span className="text-sm text-gray-400 line-through">${orig}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{formatAmount(parseFloat(product.price))}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border`}
              style={product.condition === "new" ? { background: `${S.blue}10`, color: S.blue, borderColor: `${S.blue}20` } : { background: "#F3F4F6", color: "#6B7280", borderColor: "#E5E7EB" }}>
              {product.condition}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <div className="flex items-center gap-1">
              <StarRating rating={avgRating} count={ratingCount} />
              {avgRating > 0 && <span className="text-[11px] font-semibold text-amber-500 ml-0.5">{avgRating.toFixed(1)}</span>}
            </div>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{product.location}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</span>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>

          {/* Seller card */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base shrink-0" style={{ background: S.blue }}>
              {product.sellerName?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">{product.sellerName}</p>
              <p className="text-xs text-gray-400">Verified TSIA seller</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: `${S.blue}10`, color: S.blue }}>✓ Verified</span>
          </div>

          {/* Stock */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl p-3">
            <span className="text-amber-700 text-sm flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />{product.stock} in stock</span>
            {product.negotiable && <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full"><HandCoins className="w-3 h-3" /> Negotiable</span>}
          </div>

          {/* Shipping note */}
          <div className="rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2 border" style={{ background: `${S.blue}08`, borderColor: `${S.blue}20` }}>
            <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: S.blue }} />
            <span>Shipping details are arranged with the seller in chat. Use your TSIA email for all payments to stay protected.</span>
          </div>

          {/* Rate this product */}
          {!isMyListing && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-800">{myRating ? "Update your rating" : "Rate this product"}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={pendingRating} interactive onRate={r => setPendingRating(r)} />
                {pendingRating > 0 && <span className="text-sm font-bold text-amber-500">{pendingRating}/5</span>}
              </div>
              <input placeholder="Leave a comment (optional)" value={ratingComment} onChange={e => setRatingComment(e.target.value)} data-testid="input-rating-comment"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <Button onClick={() => rateMutation.mutate({ rating: pendingRating, comment: ratingComment })}
                disabled={pendingRating === 0 || rateMutation.isPending} size="sm"
                className="text-white rounded-xl w-full font-semibold" style={{ background: S.blue }} data-testid="btn-submit-rating">
                {rateMutation.isPending ? "Submitting…" : myRating ? "Update rating" : "Submit rating"}
              </Button>
            </div>
          )}

          {/* Reviews */}
          {(ratingsData?.ratings?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">{ratingsData!.ratings.length} Review{ratingsData!.ratings.length !== 1 ? "s" : ""}</p>
              {ratingsData!.ratings.slice(0, 5).map(r => (
                <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800">{r.userName}</p>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />)}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-gray-500">{r.comment}</p>}
                  <p className="text-[10px] text-gray-300">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isMyListing && (
          <div className="px-5 pb-6 flex gap-2 bg-white border-t border-gray-100 pt-4">
            {onCart && (
              <button onClick={() => { onCart(); }}
                className="flex-1 h-12 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={inCart ? { borderColor: S.blue, background: `${S.blue}10`, color: S.blue } : { borderColor: "#E5E7EB", background: "white", color: "#374151" }}
                data-testid={`btn-detail-cart`}>
                <ShoppingCart className="w-4 h-4" />
                {inCart ? "In Cart ✓" : "Add to Cart"}
              </button>
            )}
            {onChat && (
              <button onClick={() => { onClose(); onChat?.(); }}
                className="flex-1 h-12 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ borderColor: "#E5E7EB", background: "white", color: "#374151" }}
                data-testid="btn-chat-seller">
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            )}
            <button onClick={() => { onClose(); onBuy(); }} disabled={product.stock === 0}
              className="flex-1 h-12 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: S.blue }} data-testid={`btn-detail-buy`}>
              <Lock className="w-4 h-4" />
              Buy Now
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <ImageLightbox images={imgs} startIndex={imgIdx} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
  </>);
}

// ─── Splash Screen ──────────────────────────────────────────────────────────
const SPLASH_EMOJIS = ["👗","👟","📚","💻","🎮","🎧","🏠","🌿","🍜","💄","⌚","🛋️","📷","🎸","🧸"];
function EcommerceSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  const floaters = SPLASH_EMOJIS.map((emoji, i) => {
    const angle = (i / SPLASH_EMOJIS.length) * 360;
    const radius = 38 + (i % 3) * 10;
    const duration = 6 + (i % 4) * 1.5;
    const delay = -(i * 0.4);
    return { emoji, angle, radius, duration, delay };
  });

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.06 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden select-none"
        style={{ background: "linear-gradient(160deg, #05103A 0%, #0F2080 40%, #1B4FFF 75%, #4F7FFF 100%)" }}
      >
        {/* Animated background rings */}
        {[1,2,3,4].map(n => (
          <motion.div key={n}
            className="absolute rounded-full border border-white/10"
            style={{ width: `${n * 22}vw`, height: `${n * 22}vw`, minWidth: `${n * 120}px`, minHeight: `${n * 120}px` }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.15, 0.08, 0.15] }}
            transition={{ duration: 3 + n, repeat: Infinity, ease: "easeInOut", delay: n * 0.5 }}
          />
        ))}

        {/* Floating emoji icons */}
        {floaters.map(({ emoji, angle, radius, duration, delay }, i) => (
          <motion.div key={i}
            className="absolute text-2xl pointer-events-none"
            style={{ top: "50%", left: "50%", transformOrigin: "center" }}
            animate={{ rotate: [angle, angle + 360] }}
            transition={{ duration, repeat: Infinity, ease: "linear", delay }}
          >
            <motion.span
              style={{ display: "block", transform: `translate(-50%, calc(-${radius}vw - 60px))` }}
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
            >
              {emoji}
            </motion.span>
          </motion.div>
        ))}

        {/* Central glow */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 220, height: 220, background: "radial-gradient(circle, rgba(79,127,255,0.45) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Logo area */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-5"
          initial={{ scale: 0.7, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1], delay: 0.15 }}
        >
          {/* Icon badge */}
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-[28px]"
              style={{ background: "rgba(255,255,255,0.18)", filter: "blur(16px)" }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative w-24 h-24 rounded-[28px] flex items-center justify-center shadow-2xl"
              style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)", border: "1.5px solid rgba(255,255,255,0.25)" }}>
              <ShoppingBag className="w-12 h-12 text-white" strokeWidth={1.6} />
            </div>
          </div>

          {/* Brand name */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.h1
              className="text-white font-black tracking-[0.18em] text-4xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              TS-MART
            </motion.h1>
            <motion.div
              className="h-0.5 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }}
              initial={{ width: 0 }}
              animate={{ width: 160 }}
              transition={{ delay: 0.65, duration: 0.6, ease: "easeOut" }}
            />
            <motion.p
              className="text-white/65 text-sm font-medium tracking-widest uppercase mt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              Africa's Student Marketplace
            </motion.p>
          </div>

          {/* Feature pills */}
          <motion.div
            className="flex items-center gap-2 mt-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5 }}
          >
            {["🛡️ Secure Escrow", "🚀 Fast Delivery", "🌍 Pan-Africa"].map(f => (
              <span key={f} className="text-[11px] px-3 py-1 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.18)" }}>
                {f}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full overflow-hidden"
          style={{ width: 160, height: 3, background: "rgba(255,255,255,0.15)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.5), white)" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.3, duration: 2.1, ease: "easeInOut" }}
          />
        </motion.div>

        {/* TSIA footer badge */}
        <motion.p
          className="absolute bottom-5 text-white/40 text-[11px] font-medium tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Powered by TSIA
        </motion.p>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ─── Main EcommerceSection Component ─────────────────────────────────────────
export default function EcommerceSection({ initialOpenChatId, onBack }: { initialOpenChatId?: number | null; onBack?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatAmount } = useLocalCurrency();

  // ── Splash ──
  const [showSplash, setShowSplash] = useState(true);

  // ── Tab state ──
  const [tab, setTab] = useState<Tab>("home");
  const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>("listings");

  // ── Browse/search state ──
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // ── Filter state ──
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSort, setFilterSort] = useState<"newest"|"price-asc"|"price-desc"|"popular">("newest");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterCondition, setFilterCondition] = useState<""|"new"|"used"|"refurbished">("");
  const [filterViewMode, setFilterViewMode] = useState<"grid"|"list">("grid");

  // ── Product state ──
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // ── Listing management ──
  const [listOpen, setListOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ── Wishlist + cart ──
  const [wishlist, setWishlist] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tsia_wishlist") || "[]")); } catch { return new Set(); }
  });
  const [cart, setCart] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tsia_cart") || "[]")); } catch { return new Set(); }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  // ── Deliver-to ──
  const [deliverTo, setDeliverTo] = useState<string>(() => {
    try { return localStorage.getItem("tsia_deliver_to") || ""; } catch { return ""; }
  });
  const [deliverToOpen, setDeliverToOpen] = useState(false);
  const [deliverToInput, setDeliverToInput] = useState("");

  // ── Search ──
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tsia_recent_searches") || "[]"); } catch { return []; }
  });
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchFocused(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submitSearch = (q: string) => {
    const term = q.trim();
    setActiveSearch(term); setSearch(term); setSearchFocused(false);
    if (term) {
      const next = [term, ...recentSearches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, 8);
      setRecentSearches(next);
      try { localStorage.setItem("tsia_recent_searches", JSON.stringify(next)); } catch {}
    }
  };

  // ── Recently viewed ──
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("tsia_recently_viewed") || "[]"); } catch { return []; }
  });

  // ── Chat ──
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [pendingChatId, setPendingChatId] = useState<number | null>(initialOpenChatId ?? null);
  const [chatProduct, setChatProduct] = useState<Product | null>(null);
  const [chatProductOpen, setChatProductOpen] = useState(false);

  // ── Escrow / tracking state ──
  const [expandedTracking, setExpandedTracking] = useState<Set<number>>(new Set());
  const [shipOrderId, setShipOrderId] = useState<number | null>(null);
  const [shipTrackingNumber, setShipTrackingNumber] = useState("");
  const [trackUpdateOrderId, setTrackUpdateOrderId] = useState<number | null>(null);
  const [trackLabel, setTrackLabel] = useState("");
  const [trackDesc, setTrackDesc] = useState("");
  const [trackLocation, setTrackLocation] = useState("");

  // ── Auto-open chat ──
  useEffect(() => { if (initialOpenChatId) { setChatDrawerOpen(true); setPendingChatId(initialOpenChatId); } }, [initialOpenChatId]);
  useEffect(() => {
    const handler = (e: Event) => { const chatId = (e as CustomEvent).detail?.chatId; if (chatId) { setPendingChatId(chatId); setChatDrawerOpen(true); } };
    window.addEventListener("tsia:open-chat", handler);
    return () => window.removeEventListener("tsia:open-chat", handler);
  }, []);

  // ── Data ──
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
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const { data: myListings = [] } = useQuery<Product[]>({ queryKey: ["/api/products/my"], enabled: tab === "account" && accountSubTab === "listings", staleTime: 30_000 });
  const { data: purchases = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/purchases"], enabled: !!user, staleTime: 30_000 });
  const { data: sales = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/sales"], enabled: tab === "account" && accountSubTab === "sales", staleTime: 30_000 });

  const { data: alertData } = useQuery<{ productIds: number[] }>({ queryKey: ["/api/price-alerts"], enabled: !!user });
  const watchedIds = new Set(alertData?.productIds ?? []);
  const toggleWatch = async (product: Product) => {
    if (!user) return toast({ title: "Sign in to watch prices", variant: "destructive" });
    try {
      if (watchedIds.has(product.id)) { await apiRequest("DELETE", `/api/price-alerts/${product.id}`); toast({ description: `Stopped watching "${product.title}"` }); }
      else { await apiRequest("POST", "/api/price-alerts", { productId: product.id }); toast({ description: `Watching "${product.title}" for price drops` }); }
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const { data: catSubData } = useQuery<{ categories: string[] }>({ queryKey: ["/api/category-subscriptions"], enabled: !!user });
  const subscribedCats = new Set(catSubData?.categories ?? []);
  const toggleCategorySubscription = async (category: string) => {
    if (!user) return toast({ title: "Sign in to subscribe", variant: "destructive" });
    try {
      if (subscribedCats.has(category)) { await apiRequest("DELETE", `/api/category-subscriptions/${encodeURIComponent(category)}`); toast({ description: `Unsubscribed from "${CATEGORY_LABELS[category] || category}"` }); }
      else { await apiRequest("POST", "/api/category-subscriptions", { category }); toast({ description: `You'll be notified of new items in "${CATEGORY_LABELS[category] || category}"` }); }
      queryClient.invalidateQueries({ queryKey: ["/api/category-subscriptions"] });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const toggleCart = (id: number) => {
    setCart(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem("tsia_cart", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };
  const toggleWishlist = (id: number) => {
    setWishlist(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem("tsia_wishlist", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/products/${id}`); },
    onSuccess: () => {
      toast({ title: "Listing removed" });
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
    if (p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)) { toast({ title: "Your listing", description: "You cannot buy your own product.", variant: "destructive" }); return; }
    if (p.stock <= 0 || p.status !== "active") { toast({ title: "Unavailable", variant: "destructive" }); return; }
    setBuyProduct(p); setBuyOpen(true);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({id, status, trackingNumber}: {id: number; status: string; trackingNumber?: string}) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status, trackingNumber }); return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/orders/sales"] }); queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] }); setShipOrderId(null); setShipTrackingNumber(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markReceivedMutation = useMutation({
    mutationFn: async (orderId: number) => { const res = await apiRequest("POST", `/api/orders/${orderId}/mark-received`, {}); return res.json(); },
    onSuccess: (data: any) => {
      toast({ title: "Receipt Confirmed!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addTrackingMutation = useMutation({
    mutationFn: async ({orderId, statusLabel, description, location}: {orderId: number; statusLabel: string; description: string; location?: string}) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/tracking`, { statusLabel, description, location }); return res.json();
    },
    onSuccess: (_: any, vars: any) => {
      toast({ title: "Tracking Updated", description: "Buyer has been notified." });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${vars.orderId}/tracking`] });
      setTrackUpdateOrderId(null); setTrackLabel(""); setTrackDesc(""); setTrackLocation("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Filtered products ──
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
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeFilterCount = [filterCondition, filterMinPrice, filterMaxPrice, filterSort !== "newest" ? filterSort : ""].filter(Boolean).length;
  const featuredProducts = filteredProducts.slice(0, 10);
  const gridProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, 12);

  // Wishlist products
  const wishlistProducts = (products as Product[]).filter(p => wishlist.has(p.id));

  return (
    <>
      {showSplash && <EcommerceSplash onDone={() => setShowSplash(false)} />}

    <div
      className="relative"
      style={{ background: S.bg, minHeight: "100vh", paddingBottom: "80px" }}
    >

      {/* ═══════════════════════════════════════════════════════════════════
          STICKY HEADER — Shoppe blue gradient
          No transform on this motion wrapper → sticky works correctly
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30" style={{ background: `linear-gradient(135deg, ${S.blue} 0%, ${S.blueLight} 100%)` }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Back button */}
            {onBack && (
              <button onClick={onBack}
                className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0"
                aria-label="Go back" data-testid="btn-ecommerce-back">
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base shrink-0">
              {user?.firstName?.[0]?.toUpperCase() ?? "G"}
            </div>
            <div>
              <p className="text-white/70 text-xs">Hello, {user?.firstName || "Shopper"}! 👋</p>
              <button onClick={() => { setDeliverToInput(deliverTo); setDeliverToOpen(true); }} data-testid="btn-deliver-to"
                className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                <MapPin className="w-3 h-3 text-white/70" />
                <p className="text-white text-sm font-bold">{deliverTo || "Set your location"}</p>
                <ChevronDown className="w-3.5 h-3.5 text-white/70" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setWalletOpen(true)} data-testid="btn-tsmart-wallet"
               className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-colors"
               aria-label="Open TS-Mart wallet">
               <WalletCards className="w-5 h-5 text-white" />
             </button>
            <button onClick={() => setChatDrawerOpen(true)} data-testid="btn-messages"
              className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-colors">
              <MessageCircle className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => setCartOpen(true)} data-testid="btn-cart"
              className="relative w-9 h-9 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-colors">
              <ShoppingCart className="w-5 h-5 text-white" />
              {cart.size > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {Math.min(cart.size, 99)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-4 relative" ref={searchBoxRef}>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-2xl px-4 h-11 shadow-sm">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input type="text" placeholder="Search TSIA Market..."
                value={search} onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={e => { if (e.key === "Enter") submitSearch(search); }}
                data-testid="input-search"
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400" />
              {search && <button onClick={() => { setSearch(""); setActiveSearch(""); }} data-testid="btn-clear-search"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
            </div>
            <button className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors relative"
              onClick={() => setFilterOpen(true)} data-testid="btn-filter">
              <SlidersHorizontal className="w-4 h-4 text-white" />
              {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-gray-900 text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>

          {/* Search suggestions */}
          {searchFocused && (() => {
            const q = search.trim().toLowerCase();
            const allProds = (products as Product[]);
            const liveSuggestions = q ? allProds.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 6) : [];
            const trending = [...allProds].sort((a, b) => b.viewCount - a.viewCount).slice(0, 6);
            const trendingTerms = Array.from(new Set(trending.map(p => p.title.split(" ").slice(0, 3).join(" ")))).slice(0, 6);
            return (
              <div className="absolute left-4 right-4 top-12 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[70vh] overflow-y-auto" data-testid="search-suggestions-dropdown">
                {q && liveSuggestions.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Matching "{search}"</div>
                    {liveSuggestions.map(p => (
                      <button key={p.id} onClick={() => { setSelectedProduct(p); setDetailOpen(true); setSearchFocused(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left" data-testid={`suggestion-product-${p.id}`}>
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">{CATEGORY_ICONS[p.category] || "📦"}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{p.title}</div>
                          <div className="text-[11px] text-gray-400">{CATEGORY_LABELS[p.category]} · {formatAmount(parseFloat(p.price))}</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {q && (
                  <button onClick={() => submitSearch(search)} className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-blue-50 border-b border-gray-100 text-left font-semibold text-sm" style={{ color: S.blue }} data-testid="btn-see-all-results">
                    <span className="flex items-center gap-2"><Search className="w-4 h-4" /> See all results for "{search}"</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {!q && recentSearches.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Recent</span>
                      <button onClick={() => { setRecentSearches([]); try { localStorage.removeItem("tsia_recent_searches"); } catch {} }} className="text-[10px] text-gray-400 hover:text-red-500" data-testid="btn-clear-recent-searches">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {recentSearches.map(s => (
                        <button key={s} onClick={() => submitSearch(s)} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 flex items-center gap-1" data-testid={`recent-search-${s}`}>
                          <Clock className="w-3 h-3" />{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!q && trendingTerms.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Trending</div>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {trendingTerms.map(t => (
                        <button key={t} onClick={() => submitSearch(t)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" data-testid={`trending-${t}`}>🔥 {t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {!q && (
                  <div>
                    <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Browse Categories</div>
                    <div className="grid grid-cols-3 gap-1 px-3 pb-3">
                      {CATEGORIES.slice(0, 12).map(c => (
                        <button key={c} onClick={() => { setActiveCategory(c); setSearchFocused(false); }}
                          className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl hover:bg-gray-50" data-testid={`suggest-cat-${c}`}>
                          <span className="text-xl">{CATEGORY_ICONS[c]}</span>
                          <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight px-1 line-clamp-1">{CATEGORY_LABELS[c]}</span>
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

      {/* ═══════════════════════════════════════════════════════════════════
          HOME TAB
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "home" && (
        <div className="space-y-4 px-4 pt-4">

          {/* Active search breadcrumb */}
          {activeSearch && (
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => { setActiveSearch(""); setSearch(""); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold text-white hover:opacity-80"
                style={{ background: S.blue }} data-testid="btn-back-from-search">
                <ChevronLeft className="w-3.5 h-3.5" /> Back to home
              </button>
              <span className="text-gray-500">Results for <strong className="text-gray-800">"{activeSearch}"</strong></span>
            </div>
          )}

          {/* ── Promo Banner ── */}
          {!activeSearch && (
            <ShoppePromo onAction={(slideId) => {
              setActiveCategory(""); setActiveSearch(""); setSearch("");
              if (slideId === 1) { setFilterSort("popular"); setShowAllProducts(true); }
              else if (slideId === 2) { setFilterSort("newest"); setShowAllProducts(true); }
              else { setFilterSort("popular"); setShowAllProducts(true); }
            }} />
          )}

          {/* ── Category Icons ── */}
          {!activeSearch && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-800">Shop by Category</h3>
                <button onClick={() => setShowCategoriesModal(true)} className="text-xs font-semibold flex items-center gap-0.5" style={{ color: S.blue }} data-testid="btn-view-all-cats">
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <CategoryIconsRow activeCategory={activeCategory} onPick={c => setActiveCategory(c === activeCategory ? "" : c)} onSeeAll={() => setShowCategoriesModal(true)} />
            </div>
          )}

          {/* ── Flash Sale (horizontal scroll) ── */}
          {!activeSearch && filteredProducts.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" data-testid="rail-todays-deals">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" style={{ color: S.red }} /> Flash Sale
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ background: S.red }}>
                    Ends in {(() => {
                      const end = new Date(); end.setHours(23, 59, 59, 999);
                      const ms = end.getTime() - Date.now();
                      const h = Math.floor(ms / 3600000);
                      const m = Math.floor((ms % 3600000) / 60000);
                      return `${h}h ${m}m`;
                    })()}
                  </span>
                </div>
                <button className="text-xs font-semibold flex items-center gap-0.5" style={{ color: S.blue }} onClick={() => setShowAllProducts(true)}>
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                {[...filteredProducts].sort((a, b) => b.viewCount - a.viewCount).slice(0, 12).map(p => {
                  const discPct = 15 + ((p.id * 7) % 35);
                  return (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`deal-card-${p.id}`}
                      className="w-36 shrink-0 cursor-pointer group bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                      <div className="relative" style={{ aspectRatio: "1/1", overflow: "hidden" }}>
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                        <span className="absolute top-1.5 left-1.5 text-[10px] font-black text-white px-1.5 py-0.5 rounded" style={{ background: S.red }}>-{discPct}%</span>
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-700 font-semibold line-clamp-1 mb-0.5">{p.title}</p>
                        <span className="text-sm font-black" style={{ color: S.orange }}>${parseFloat(p.price).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── New Arrivals / Featured (horizontal scroll) ── */}
          {!activeSearch && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" /> Best Sellers
                </h3>
                <button className="text-xs font-semibold flex items-center gap-0.5" style={{ color: S.blue }} onClick={() => setShowAllProducts(true)}>
                  See all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3 overflow-hidden">
                  {[1,2,3].map(i => <div key={i} className="w-44 h-64 rounded-2xl bg-gray-100 animate-pulse shrink-0" />)}
                </div>
              ) : featuredProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No products yet — be the first to list!</div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                  {featuredProducts.map(p => (
                    <FeaturedCard key={p.id} product={p}
                      onView={() => handleView(p)} onBuy={() => handleBuy(p)}
                      wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)}
                      inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) toast({ title: "Added to cart", description: `${p.title} saved.` }); }}
                      isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Buy it again ── */}
          {!activeSearch && (purchases as Order[]).length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" data-testid="rail-buy-again">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><RotateCcw className="w-4 h-4" style={{ color: S.blue }} /> Buy it again</h3>
                <button className="text-xs font-semibold flex items-center gap-0.5" style={{ color: S.blue }} onClick={() => { setTab("account"); setAccountSubTab("orders"); }}>
                  Your orders <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                {(() => {
                  const seen = new Set<number>();
                  const items = (purchases as Order[]).filter(o => { if (seen.has(o.productId)) return false; seen.add(o.productId); return true; }).map(o => (products as Product[]).find(p => p.id === o.productId)).filter(Boolean) as Product[];
                  if (!items.length) return <p className="text-xs text-gray-400">Past orders will appear here.</p>;
                  return items.slice(0, 10).map(p => (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`buy-again-${p.id}`} className="w-28 shrink-0 cursor-pointer group">
                      <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                        {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[p.category]}</div>}
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-2 mt-1.5 font-medium">{p.title}</p>
                      <button onClick={e => { e.stopPropagation(); handleBuy(p); }}
                        className="w-full mt-1.5 py-1 text-[11px] font-bold text-white rounded-xl hover:opacity-90" style={{ background: S.blue }} data-testid={`btn-reorder-${p.id}`}>
                        Buy again
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── Recently Viewed ── */}
          {!activeSearch && recentlyViewed.length > 0 && (() => {
            const items = recentlyViewed.map(id => (products as Product[]).find(p => p.id === id)).filter(Boolean) as Product[];
            if (!items.length) return null;
            return (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" data-testid="rail-recently-viewed">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><Eye className="w-4 h-4" style={{ color: S.blue }} /> Recently Viewed</h3>
                  <button onClick={() => { setRecentlyViewed([]); try { localStorage.removeItem("tsia_recently_viewed"); } catch {} }}
                    className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors" data-testid="btn-clear-recent">Clear</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                  {items.map(p => (
                    <div key={p.id} onClick={() => handleView(p)} data-testid={`recent-${p.id}`} className="w-24 shrink-0 cursor-pointer group">
                      <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                        {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[p.category]}</div>}
                      </div>
                      <p className="text-[11px] text-gray-700 line-clamp-2 mt-1">{p.title}</p>
                      <p className="text-xs font-black" style={{ color: S.orange }}>${parseFloat(p.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Main Product Grid (New Arrivals / Search Results) ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-800">
                {activeSearch ? `Results for "${activeSearch}"` : activeCategory ? (CATEGORY_LABELS[activeCategory] || activeCategory) : "New Arrivals"}
              </h3>
              <div className="flex items-center gap-2">
                {activeCategory && user && (
                  <button onClick={() => toggleCategorySubscription(activeCategory)} data-testid={`btn-subscribe-cat-${activeCategory}`}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all"
                    style={subscribedCats.has(activeCategory) ? { color: S.blue, borderColor: S.blue, background: `${S.blue}10` } : { color: "#6B7280", borderColor: "#E5E7EB" }}>
                    <Bell className="w-3 h-3" />{subscribedCats.has(activeCategory) ? "Subscribed" : "Subscribe"}
                  </button>
                )}
                {(products as Product[]).length > 12 && !showAllProducts && (
                  <button className="text-xs font-semibold" style={{ color: S.blue }} onClick={() => setShowAllProducts(true)}>See all {(products as Product[]).length}</button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : (products as Product[]).length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${S.blue}10` }}>
                  <ShoppingBag className="w-8 h-8" style={{ color: S.blue }} />
                </div>
                <p className="font-semibold mb-1 text-gray-700">No products found</p>
                <p className="text-sm mb-4 text-gray-400">Try a different search or category.</p>
                <Button onClick={() => setListOpen(true)} className="font-bold rounded-full text-white" style={{ background: S.blue }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Be the first to list
                </Button>
              </div>
            ) : (
              <>
                {filterViewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {gridProducts.map(p => (
                      <ProductCard key={p.id} product={p}
                        onView={() => handleView(p)} onBuy={() => handleBuy(p)}
                        wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)}
                        inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) toast({ title: "Added to cart", description: `${p.title} saved.` }); }}
                        watched={watchedIds.has(p.id)} onWatch={() => toggleWatch(p)}
                        isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gridProducts.map(p => {
                      const img = p.images?.[0];
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 hover:shadow-md transition-shadow cursor-pointer shadow-sm" onClick={() => handleView(p)}>
                          <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden shrink-0">
                            {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xl">{CATEGORY_ICONS[p.category]}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm line-clamp-1 text-gray-800">{p.title}</p>
                            <p className="text-xs text-gray-400 capitalize">{p.condition} · {p.category}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-black text-sm" style={{ color: S.orange }}>${parseFloat(p.price).toFixed(2)}</span>
                              <span className="text-[11px] text-gray-300 line-through">${originalPrice(p.price)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)) ? (
                              <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: `${S.blue}10`, color: S.blue }}>Your listing</span>
                            ) : (
                              <>
                                <button onClick={e => { e.stopPropagation(); toggleCart(p.id); if (!cart.has(p.id)) toast({ title: "Added to cart" }); }}
                                  data-testid={`btn-list-cart-${p.id}`}
                                  className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shrink-0"
                                  style={cart.has(p.id) ? { background: `${S.blue}10`, borderColor: S.blue, color: S.blue } : { background: "#F9FAFB", borderColor: "#E5E7EB", color: "#6B7280" }}>
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleBuy(p); }}
                                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors text-white"
                                  style={{ background: S.blue }}>
                                  <Lock className="w-4 h-4" />
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
                  <button className="w-full mt-4 py-3 font-bold text-sm rounded-2xl text-white flex items-center justify-center gap-2 transition-colors"
                    style={{ background: S.blue }} onClick={() => setShowAllProducts(true)}>
                    Load more ({filteredProducts.length - 12} more) <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Stats */}
          {(products as Product[]).length > 0 && (
            <div className="grid grid-cols-3 gap-0 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              {[
                { label: "Products", value: (products as Product[]).length, icon: Package, color: S.blue },
                { label: "Saved", value: wishlist.size, icon: Heart, color: S.red },
                { label: "Commission", value: "8%", icon: BadgePercent, color: S.green },
              ].map((s, i) => (
                <div key={s.label} className="p-3 text-center" style={{ borderRight: i < 2 ? "1px solid #F0F0F0" : "none" }}>
                  <s.icon style={{ color: s.color }} className="w-5 h-5 mx-auto mb-1" />
                  <p className="font-black text-lg text-gray-800">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          WISHLIST TAB
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "wishlist" && (
        <div className="px-4 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-gray-800">My Wishlist</h2>
              <p className="text-xs text-gray-400">{wishlist.size} saved item{wishlist.size !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {wishlist.size === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${S.blue}10` }}>
                <Heart className="w-9 h-9" style={{ color: S.blue }} />
              </div>
              <p className="font-bold text-gray-800 mb-1 text-lg">No saved items yet</p>
              <p className="text-gray-400 text-sm mb-5">Tap the ♡ on any product to save it here</p>
              <button onClick={() => setTab("home")} className="px-6 py-3 rounded-2xl text-white font-bold text-sm" style={{ background: S.blue }}>
                Browse Products
              </button>
            </div>
          ) : wishlistProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 text-sm">Loading saved items…</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {wishlistProducts.map(p => (
                <ProductCard key={p.id} product={p}
                  onView={() => handleView(p)} onBuy={() => handleBuy(p)}
                  wishlisted={true} onWishlist={() => toggleWishlist(p.id)}
                  inCart={cart.has(p.id)} onCart={() => { toggleCart(p.id); if (!cart.has(p.id)) toast({ title: "Added to cart" }); }}
                  watched={watchedIds.has(p.id)} onWatch={() => toggleWatch(p)}
                  isSeller={p.sellerId === user?.id || (!!p.sellerEmail && p.sellerEmail === user?.email)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCOUNT TAB
          ═══════════════════════════════════════════════════════════════════ */}
      {tab === "account" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Profile card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${S.blue}, ${S.blueLight})` }}>
              {user?.firstName?.[0]?.toUpperCase() ?? "G"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-gray-800">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-gray-400">{user?.email}</p>
              <div className="flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: S.blue }} />
                <span className="text-xs font-semibold" style={{ color: S.blue }}>Verified TSIA Member</span>
              </div>
            </div>
            <button onClick={() => setListOpen(true)} data-testid="btn-new-listing"
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{ background: S.blue }}>
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-2 bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
            {[
              { id: "listings" as AccountSubTab, label: "My Listings", icon: Tag },
              { id: "orders" as AccountSubTab, label: "My Orders", icon: ShoppingCart },
              { id: "sales" as AccountSubTab, label: "My Sales", icon: TrendingUp },
            ].map(t => (
              <button key={t.id} onClick={() => setAccountSubTab(t.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={accountSubTab === t.id ? { background: S.blue, color: "white" } : { background: "transparent", color: "#6B7280" }}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* ─ Listings sub-tab ─ */}
          {accountSubTab === "listings" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{(myListings as Product[]).length} listing{(myListings as Product[]).length !== 1 ? "s" : ""}</p>
                <Button onClick={() => setListOpen(true)} size="sm" data-testid="btn-new-listing-2"
                  className="text-white rounded-xl h-9 shadow-sm text-xs font-bold" style={{ background: S.blue }}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> New listing
                </Button>
              </div>
              {(myListings as Product[]).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${S.blue}10` }}>
                    <Tag className="w-7 h-7" style={{ color: S.blue }} />
                  </div>
                  <p className="font-bold text-gray-800 mb-1">No listings yet</p>
                  <p className="text-gray-400 text-sm mb-4">Start selling — TSIA only takes 8%.</p>
                  <Button onClick={() => setListOpen(true)} className="text-white rounded-xl shadow-sm font-bold" style={{ background: S.blue }}>
                    <Plus className="w-4 h-4 mr-1.5" /> List a Product
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(myListings as Product[]).map(p => {
                    const img = p.images?.[0];
                    return (
                      <div key={p.id} data-testid={`card-listing-${p.id}`} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all shadow-sm">
                        <div className="aspect-square bg-gray-50 relative">
                          {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                          <Badge className={`absolute top-2 left-2 text-[10px] rounded-full ${STATUS_COLORS[p.status] || ""}`}>{p.status}</Badge>
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm line-clamp-1 text-gray-800">{p.title}</p>
                          <p className="text-base font-black" style={{ color: S.orange }}>${parseFloat(p.price).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{p.stock} in stock · {p.viewCount} views</p>
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl border-gray-200" onClick={() => handleView(p)} data-testid={`btn-view-listing-${p.id}`}>View</Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-amber-600 border-amber-200"
                              onClick={() => { apiRequest("PATCH", `/api/products/${p.id}`, { status: p.status === "paused" ? "active" : "paused" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/products/my"] })); }}
                              data-testid={`btn-toggle-listing-${p.id}`}>
                              {p.status === "paused" ? "Activate" : "Pause"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-blue-600 border-blue-200"
                              onClick={() => { setEditingListing(p); setListOpen(true); }} data-testid={`btn-edit-listing-${p.id}`}>Edit</Button>
                            <Button size="sm" variant="outline" className="text-xs h-7 rounded-xl text-red-500 border-red-200"
                              onClick={() => setDeleteConfirmId(p.id)} data-testid={`btn-delete-listing-${p.id}`}>Remove</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─ Orders sub-tab ─ */}
          {accountSubTab === "orders" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">{(purchases as Order[]).length} order{(purchases as Order[]).length !== 1 ? "s" : ""}</p>
              {(purchases as Order[]).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="font-bold text-gray-800 mb-1">No orders yet</p>
                  <p className="text-gray-400 text-sm mb-4">Browse the marketplace and place your first order.</p>
                  <Button onClick={() => setTab("home")} variant="outline" className="rounded-xl"><ShoppingBag className="w-4 h-4 mr-1.5" /> Shop now</Button>
                </div>
              ) : (purchases as Order[]).map(o => {
                const trackingOpen = expandedTracking.has(o.id);
                const canMarkReceived = !o.escrowReleased && ["confirmed","shipped"].includes(o.status);
                return (
                  <div key={o.id} data-testid={`row-purchase-${o.id}`} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{o.product?.title ?? "Product"}</p>
                        <p className="text-xs text-gray-400">From {o.sellerName} · Order #{o.id}</p>
                        <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</p>
                        {o.trackingNumber && <p className="text-xs text-amber-600 font-mono mt-1 flex items-center gap-1"><Package className="w-3 h-3" />Tracking: {o.trackingNumber}</p>}
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="font-black text-base text-gray-800">${parseFloat(o.totalAmount).toFixed(2)}</p>
                        <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                        {!o.escrowReleased && o.status !== "cancelled" && (
                          <div className="mt-1 flex items-center gap-1 justify-end">
                            <Lock className="w-2.5 h-2.5 text-amber-500" />
                            <span className="text-[9px] font-bold text-amber-600">In Escrow</span>
                          </div>
                        )}
                        {o.escrowReleased && (
                          <div className="mt-1 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-2.5 h-2.5" style={{ color: S.green }} />
                            <span className="text-[9px] font-bold" style={{ color: S.green }}>Paid to Seller</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setExpandedTracking(s => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}
                      className="w-full flex items-center justify-between text-xs font-semibold py-2 border-t border-gray-100"
                      style={{ color: S.blue }} data-testid={`btn-tracking-${o.id}`}>
                      <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Track Delivery</span>
                      {trackingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {trackingOpen && <TrackingTimeline orderId={o.id} />}
                    {canMarkReceived && (
                      <Button size="sm" className="w-full text-white font-bold rounded-xl min-h-11 text-xs" style={{ background: S.blue }}
                        onClick={() => markReceivedMutation.mutate(o.id)} disabled={markReceivedMutation.isPending}
                        data-testid={`btn-received-${o.id}`}>
                        {markReceivedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PackageOpen className="w-3.5 h-3.5 mr-1.5" />}
                        I Received My Item — Release Payment
                      </Button>
                    )}
                    {o.escrowReleased && (
                      <p className="text-[11px] text-center font-semibold flex items-center justify-center gap-1.5" style={{ color: S.green }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Payment released · Order complete
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─ Sales sub-tab ─ */}
          {accountSubTab === "sales" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">{(sales as Order[]).length} sale{(sales as Order[]).length !== 1 ? "s" : ""}</p>
              {(sales as Order[]).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${S.blue}10` }}>
                    <TrendingUp className="w-7 h-7" style={{ color: S.blue }} />
                  </div>
                  <p className="font-bold text-gray-800 mb-1">No sales yet</p>
                  <p className="text-gray-400 text-sm mb-4">List a product to start earning.</p>
                  <Button onClick={() => setListOpen(true)} className="text-white rounded-xl shadow-sm font-bold" style={{ background: S.blue }}>
                    <Tag className="w-4 h-4 mr-1.5" /> List a Product
                  </Button>
                </div>
              ) : (sales as Order[]).map(o => {
                const trackingOpen = expandedTracking.has(o.id);
                const isShippingThis = shipOrderId === o.id;
                const isTrackingThis = trackUpdateOrderId === o.id;
                return (
                  <div key={o.id} data-testid={`row-sale-${o.id}`} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{o.product?.title ?? "Product"}</p>
                        <p className="text-xs text-gray-400">Buyer: {o.buyerName} · Order #{o.id}</p>
                        <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</p>
                        {o.trackingNumber && <p className="text-xs text-amber-600 font-mono mt-1 flex items-center gap-1"><Package className="w-3 h-3" />Tracking: {o.trackingNumber}</p>}
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        {o.escrowReleased
                          ? <p className="font-black text-base" style={{ color: S.green }}>+${parseFloat(o.sellerReceives).toFixed(2)}</p>
                          : <div><p className="font-black text-base text-amber-600">${parseFloat(o.sellerReceives).toFixed(2)}</p><div className="flex items-center gap-1 justify-end mt-0.5"><Lock className="w-2.5 h-2.5 text-amber-500" /><span className="text-[9px] text-amber-600 font-bold">Pending</span></div></div>}
                        <p className="text-[10px] text-gray-400">after 8% fee</p>
                        <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                      </div>
                    </div>

                    {o.status === "pending" && (
                      <Button size="sm" className="w-full min-h-11 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        onClick={() => updateStatusMutation.mutate({id: o.id, status: "confirmed"})} disabled={updateStatusMutation.isPending}
                        data-testid={`btn-confirm-${o.id}`}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm Order
                      </Button>
                    )}

                    {o.status === "confirmed" && !isShippingThis && (
                      <Button size="sm" variant="outline" className="w-full min-h-11 text-xs rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50"
                        onClick={() => setShipOrderId(o.id)} data-testid={`btn-ship-open-${o.id}`}>
                        <Truck className="w-3.5 h-3.5 mr-1.5" /> Mark as Shipped
                      </Button>
                    )}

                    {o.status === "confirmed" && isShippingThis && (
                      <div className="space-y-2 bg-gray-50 rounded-xl p-3">
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

                    {["shipped","confirmed"].includes(o.status) && !o.escrowReleased && !isTrackingThis && (
                      <button className="w-full min-h-11 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border-t border-gray-100 pt-2"
                        onClick={() => setTrackUpdateOrderId(o.id)} data-testid={`btn-add-tracking-${o.id}`}>
                        <MapPin className="w-3 h-3" /> Add tracking update
                      </button>
                    )}

                    {isTrackingThis && (
                      <div className="space-y-2 bg-gray-50 rounded-xl p-3 border-t border-gray-100">
                        <p className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Add Tracking Update</p>
                        <Input placeholder="Status (e.g. In Transit)" value={trackLabel} onChange={e => setTrackLabel(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                        <Input placeholder="Description" value={trackDesc} onChange={e => setTrackDesc(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                        <Input placeholder="Location (optional)" value={trackLocation} onChange={e => setTrackLocation(e.target.value)} className="min-h-11 text-xs rounded-xl" />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 min-h-11 text-xs rounded-xl" onClick={() => { setTrackUpdateOrderId(null); setTrackLabel(""); setTrackDesc(""); setTrackLocation(""); }}>Cancel</Button>
                          <Button size="sm" className="flex-1 min-h-11 text-xs rounded-xl text-white font-bold" style={{ background: S.blue }}
                            onClick={() => addTrackingMutation.mutate({orderId: o.id, statusLabel: trackLabel, description: trackDesc, location: trackLocation || undefined})}
                            disabled={addTrackingMutation.isPending || !trackLabel || !trackDesc} data-testid={`btn-tracking-submit-${o.id}`}>
                            {addTrackingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />} Send Update
                          </Button>
                        </div>
                      </div>
                    )}

                    <button onClick={() => setExpandedTracking(s => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })}
                      className="w-full min-h-11 flex items-center justify-between text-xs text-gray-400 hover:text-gray-700 border-t border-gray-100 pt-2">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {trackingOpen ? "Hide" : "View"} tracking timeline</span>
                      {trackingOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {trackingOpen && <TrackingTimeline orderId={o.id} />}

                    {o.escrowReleased && (
                      <p className="text-[11px] text-center font-semibold flex items-center justify-center gap-1.5 border-t border-gray-100 pt-2" style={{ color: S.green }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Payment released to your wallet · Completed
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mini footer */}
          <div className="py-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: S.blue }}>
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-gray-800">TSIA <span style={{ color: S.blue }}>Market</span></span>
            </div>
            <p className="text-[10px] text-gray-400">Escrow Protected · Verified Sellers · SMAKEMGGOLD Ltd</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS & OVERLAYS
          ═══════════════════════════════════════════════════════════════════ */}

      <ListProductModal open={listOpen} editProduct={editingListing} onClose={() => { setListOpen(false); setEditingListing(null); }} />

      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Remove Listing</DialogTitle>
            <DialogDescription>This will permanently delete this listing and all associated data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirmId !== null) deleteMutation.mutate(deleteConfirmId); }} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-listing">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Yes, Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailModal
        product={selectedProduct} open={detailOpen} onClose={() => setDetailOpen(false)}
        onBuy={() => { setDetailOpen(false); setBuyProduct(selectedProduct); setBuyOpen(true); }}
        isSeller={selectedProduct?.sellerId === user?.id || (!!selectedProduct?.sellerEmail && selectedProduct.sellerEmail === user?.email)}
        onChat={() => { setDetailOpen(false); setChatProduct(selectedProduct); setChatProductOpen(true); }}
        inCart={selectedProduct ? cart.has(selectedProduct.id) : false}
        onCart={() => {
          if (!selectedProduct) return;
          const wasIn = cart.has(selectedProduct.id);
          toggleCart(selectedProduct.id);
          toast({ title: wasIn ? "Removed from cart" : "Saved to cart", description: wasIn ? `${selectedProduct.title} removed.` : `${selectedProduct.title} saved.` });
        }}
      />

      <PurchaseModal product={buyProduct} open={buyOpen} onClose={() => setBuyOpen(false)} walletBalance={walletBalance}
        onChat={() => { setBuyOpen(false); setChatProduct(buyProduct); setChatProductOpen(true); }} />

      <EcommerceChatDrawer open={chatDrawerOpen} onClose={() => { setChatDrawerOpen(false); setPendingChatId(null); }} initialChatId={pendingChatId} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cartIds={cart}
        onBuy={p => { setCartOpen(false); handleBuy(p); }}
        onRemove={id => { setCart(prev => { const next = new Set(prev); next.delete(id); try { localStorage.setItem("tsia_cart", JSON.stringify(Array.from(next))); } catch {} return next; }); }}
        onClearAll={() => { setCart(new Set()); try { localStorage.removeItem("tsia_cart"); } catch {}; }} />

      <AnimatePresence>
        {walletOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MarketplaceWalletView onClose={() => setWalletOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {chatProduct && (
        <ProductChatModal productId={chatProduct.id} productTitle={chatProduct.title} sellerName={chatProduct.sellerName}
          open={chatProductOpen} onClose={() => { setChatProductOpen(false); setChatProduct(null); }} />
      )}

      <CategoryBrowserOverlay open={showCategoriesModal} onClose={() => setShowCategoriesModal(false)}
        onPick={(cat) => { setActiveCategory(cat); setShowCategoriesModal(false); }} />

      <Dialog open={deliverToOpen} onOpenChange={setDeliverToOpen}>
        <DialogContent className="max-w-sm" data-testid="modal-deliver-to">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Choose your location</DialogTitle>
            <DialogDescription>Delivery options update based on this address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="e.g. Lagos, NG · Manchester, UK" value={deliverToInput} onChange={e => setDeliverToInput(e.target.value)} data-testid="input-deliver-to" className="rounded-xl" autoFocus />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setDeliverTo(""); try { localStorage.removeItem("tsia_deliver_to"); } catch {}; setDeliverToOpen(false); }} data-testid="btn-deliver-clear">Remove</Button>
              <Button className="flex-1 rounded-xl text-white font-bold" style={{ background: S.blue }} onClick={() => {
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

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM NAVIGATION — Shoppe 5-tab style with center Cart FAB
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-area-inset-bottom"
        style={{ boxShadow: "0 -4px 20px rgba(27,79,255,0.08)" }}>
        <div className="flex items-center px-2 pb-1 pt-1">
          {/* Home */}
          <button onClick={() => setTab("home")} data-testid="tab-home"
            className="flex-1 flex flex-col items-center gap-0.5 py-2">
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all ${tab === "home" ? "shadow-sm" : ""}`}
              style={tab === "home" ? { background: `${S.blue}15` } : {}}>
              <Home className="w-5 h-5 transition-colors" style={{ color: tab === "home" ? S.blue : "#9CA3AF" }} />
            </div>
            <span className="text-[10px] font-semibold transition-colors" style={{ color: tab === "home" ? S.blue : "#9CA3AF" }}>Home</span>
          </button>

          {/* Categories */}
          <button onClick={() => setShowCategoriesModal(true)} data-testid="tab-categories"
            className="flex-1 flex flex-col items-center gap-0.5 py-2">
            <div className="w-8 h-8 rounded-2xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-[10px] font-semibold text-gray-400">Categories</span>
          </button>

          {/* Cart FAB (center, elevated) */}
          <button onClick={() => setCartOpen(true)} data-testid="tab-cart"
            className="flex-1 flex flex-col items-center -mt-4 relative">
            <div className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg relative"
              style={{ background: `linear-gradient(135deg, ${S.blue}, ${S.blueLight})`, boxShadow: `0 4px 20px ${S.blue}50` }}>
              <ShoppingBag className="w-6 h-6" />
              {cart.size > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {Math.min(cart.size, 9)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-gray-400 mt-0.5">Cart</span>
          </button>

          {/* Wishlist */}
          <button onClick={() => setTab("wishlist")} data-testid="tab-wishlist"
            className="flex-1 flex flex-col items-center gap-0.5 py-2">
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all ${tab === "wishlist" ? "shadow-sm" : ""}`}
              style={tab === "wishlist" ? { background: `${S.blue}15` } : {}}>
              <Heart className="w-5 h-5 transition-colors" style={{ color: tab === "wishlist" ? S.blue : "#9CA3AF" }} />
              {wishlist.size > 0 && tab !== "wishlist" && (
                <span className="absolute ml-4 -mt-3 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{Math.min(wishlist.size, 9)}</span>
              )}
            </div>
            <span className="text-[10px] font-semibold transition-colors" style={{ color: tab === "wishlist" ? S.blue : "#9CA3AF" }}>Wishlist</span>
          </button>

          {/* Account */}
          <button onClick={() => setTab("account")} data-testid="tab-account"
            className="flex-1 flex flex-col items-center gap-0.5 py-2">
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all ${tab === "account" ? "shadow-sm" : ""}`}
              style={tab === "account" ? { background: `${S.blue}15` } : {}}>
              <User className="w-5 h-5 transition-colors" style={{ color: tab === "account" ? S.blue : "#9CA3AF" }} />
            </div>
            <span className="text-[10px] font-semibold transition-colors" style={{ color: tab === "account" ? S.blue : "#9CA3AF" }}>Account</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FILTER PANEL
          ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div key="filter-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setFilterOpen(false)} />
            <motion.div key="filter-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
              data-testid="filter-panel">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" style={{ color: S.blue }} /> Filter & Sort
                </h3>
                <button onClick={() => setFilterOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-6">
                {/* Sort */}
                <div>
                  <p className="font-bold text-sm mb-3 flex items-center gap-1.5"><ArrowUpDown className="w-4 h-4" /> Sort by</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "newest",     label: "Newest",           icon: "🆕" },
                      { id: "price-asc",  label: "Price: Low→High",  icon: "⬆️" },
                      { id: "price-desc", label: "Price: High→Low",  icon: "⬇️" },
                      { id: "popular",    label: "Most Popular",     icon: "🔥" },
                    ] as const).map(s => (
                      <button key={s.id} onClick={() => setFilterSort(s.id)}
                        className="flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all"
                        style={filterSort === s.id ? { borderColor: S.blue, background: `${S.blue}08`, color: S.blue } : { borderColor: "#E5E7EB", background: "#F9FAFB", color: "#6B7280" }}
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
                    <span className="text-gray-400 font-bold">–</span>
                    <Input type="number" placeholder="Max" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} className="rounded-xl" data-testid="input-max-price" min={0} />
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <p className="font-bold text-sm mb-3">📦 Condition</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["", "new", "used", "refurbished"] as const).map(c => (
                      <button key={c} onClick={() => setFilterCondition(c)}
                        className="px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all capitalize"
                        style={filterCondition === c ? { borderColor: S.blue, background: `${S.blue}08`, color: S.blue } : { borderColor: "#E5E7EB", background: "#F9FAFB", color: "#6B7280" }}
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
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold"
                      style={filterViewMode === "grid" ? { borderColor: S.blue, background: `${S.blue}08`, color: S.blue } : { borderColor: "#E5E7EB", background: "#F9FAFB", color: "#6B7280" }}
                      data-testid="view-grid">
                      <Grid3X3 className="w-4 h-4" /> Grid
                    </button>
                    <button onClick={() => setFilterViewMode("list")}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold"
                      style={filterViewMode === "list" ? { borderColor: S.blue, background: `${S.blue}08`, color: S.blue } : { borderColor: "#E5E7EB", background: "#F9FAFB", color: "#6B7280" }}
                      data-testid="view-list">
                      <List className="w-4 h-4" /> List
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-6 flex gap-2">
                <Button variant="outline" className="flex-1 rounded-2xl border-gray-200 font-semibold"
                  onClick={() => { setFilterSort("newest"); setFilterMinPrice(""); setFilterMaxPrice(""); setFilterCondition(""); }} data-testid="btn-clear-filters">
                  Reset
                </Button>
                <Button className="flex-1 rounded-2xl text-white font-bold" style={{ background: S.blue }}
                  onClick={() => setFilterOpen(false)} data-testid="btn-apply-filters">
                  <Check className="w-4 h-4 mr-1.5" /> Apply Filters
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
    </>
  );
}
