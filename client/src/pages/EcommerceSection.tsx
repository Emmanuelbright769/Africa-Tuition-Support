import { useState, useRef, useEffect, useCallback } from "react";
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
  Filter, Mic, ChevronRight, BadgePercent, Bell, Zap, ArrowRight, Flame
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ECOMMERCE } from "@shared/schema";

// ─── Types ─────────────────────────────────────────────────────────────────
type Product = {
  id: number; sellerId: number; title: string; description: string;
  price: string; category: string; condition: string; images: string[] | null;
  stock: number; location: string; status: string; viewCount: number;
  createdAt: string; sellerName: string;
};
type Order = {
  id: number; buyerId: number; sellerId: number; productId: number; quantity: number;
  unitPrice: string; totalAmount: string; commissionAmount: string; sellerReceives: string;
  status: string; deliveryAddress: string | null; note: string | null;
  createdAt: string; product?: { title: string; price: string };
  sellerName?: string; buyerName?: string;
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

function StarRating({ rating = 4.5, count }: { rating?: number; count?: number }) {
  const c = count ?? Math.floor(Math.random() * 80 + 5);
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-2.5 h-2.5 ${s <= Math.floor(rating) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`} />
      ))}
      <span className="text-[10px] text-muted-foreground ml-0.5">({c})</span>
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

// ─── Product Card (Grid) ───────────────────────────────────────────────────
function ProductCard({ product, onView, onBuy, wishlisted, onWishlist }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
}) {
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer group border border-border/50"
      onClick={onView}
      data-testid={`card-product-${product.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 overflow-hidden">
        {img ? (
          <img src={img} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-3xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
          </div>
        )}
        {/* Wishlist */}
        <button
          onClick={e => { e.stopPropagation(); onWishlist(); }}
          data-testid={`btn-wishlist-${product.id}`}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110"
        >
          <Heart className={`w-4 h-4 transition-colors ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
        </button>
        {/* New badge */}
        {product.condition === "new" && (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] font-bold bg-tsia-green text-white px-2 py-0.5 rounded-full">NEW</span>
          </div>
        )}
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
        <StarRating />
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-base font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</span>
            <span className="text-[11px] text-muted-foreground line-through ml-1">${orig}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onBuy(); }}
            disabled={product.stock === 0}
            data-testid={`btn-buy-${product.id}`}
            className="w-8 h-8 bg-tsia-green rounded-full flex items-center justify-center shadow-md hover:bg-tsia-green/90 disabled:opacity-40 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Featured Card (Horizontal scroll) ────────────────────────────────────
function FeaturedCard({ product, onView, onBuy, wishlisted, onWishlist }: {
  product: Product; onView: () => void; onBuy: () => void; wishlisted: boolean; onWishlist: () => void;
}) {
  const img = product.images?.[0];
  const orig = originalPrice(product.price);
  return (
    <div
      onClick={onView}
      data-testid={`card-featured-${product.id}`}
      className="shrink-0 w-40 bg-card rounded-2xl overflow-hidden shadow-md border border-border/50 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="relative w-40 h-44 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
        {img ? (
          <img src={img} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
        )}
        <button onClick={e => { e.stopPropagation(); onWishlist(); }}
          className="absolute top-2 right-2 w-7 h-7 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center">
          <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[12px] font-semibold line-clamp-2 leading-snug mb-1">{product.title}</p>
        <div className="flex items-end justify-between gap-1">
          <div>
            <p className="text-[13px] font-black text-tsia-green">${parseFloat(product.price).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground line-through">${orig}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onBuy(); }}
            className="w-7 h-7 bg-tsia-gold rounded-full flex items-center justify-center shadow hover:scale-105 transition-transform"
            data-testid={`btn-featured-buy-${product.id}`}>
            <Plus className="w-3.5 h-3.5 text-slate-900" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── List Product Modal ────────────────────────────────────────────────────
function ListProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK" });
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/products", data); return res.json(); },
    onSuccess: () => {
      toast({ title: "Product listed!", description: "Your product is now live in the marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/my"] });
      onClose();
      setForm({ title: "", description: "", price: "", category: "other", condition: "new", stock: "1", location: "London, UK" });
      setImages([]);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).slice(0, ECOMMERCE.MAX_IMAGES - images.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setImages(prev => [...prev, ev.target?.result as string].slice(0, ECOMMERCE.MAX_IMAGES));
      reader.readAsDataURL(f);
    });
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
            <div><Label>Price (USD) *</Label><Input type="number" min={ECOMMERCE.MIN_PRICE} max={ECOMMERCE.MAX_PRICE} step={0.01} placeholder="0.00" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} className="mt-1" data-testid="input-product-price" /></div>
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
          {parseFloat(form.price) > 0 && (
            <div className="bg-tsia-green/5 rounded-xl p-4 border border-tsia-green/20">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5 text-tsia-green" /> Earnings breakdown</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Listing price</span><span className="font-semibold">${parseFloat(form.price || "0").toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-red-500">TSIA commission (5%)</span><span className="text-red-500">−${commission.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">You receive</span><span className="font-bold text-tsia-green">${youReceive.toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate({...form, images, price: parseFloat(form.price), stock: parseInt(form.stock)})} disabled={createMutation.isPending || !form.title || !form.description || !form.price} data-testid="button-submit-product" className="bg-tsia-green text-white">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} List Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Buy Modal ─────────────────────────────────────────────────────────────
function BuyModal({ product, open, onClose, walletBalance }: { product: Product | null; open: boolean; onClose: () => void; walletBalance: number }) {
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");

  const total = product ? parseFloat(product.price) * qty : 0;
  const commission = total * ECOMMERCE.COMMISSION_RATE;
  const canAfford = walletBalance >= total;

  const buyMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/orders", data); return res.json(); },
    onSuccess: (res: any) => {
      toast({ title: "Order placed!", description: res.message, className: "border-tsia-green" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      onClose(); setQty(1); setAddress("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!product) return null;
  const img = product.images?.[0];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
          <DialogDescription>Payment from your TSIA wallet — instant & secure.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{CATEGORY_ICONS[product.category]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-2">{product.title}</p>
              <p className="text-xs text-muted-foreground">by {product.sellerName}</p>
              <p className="text-xl font-black text-tsia-green mt-1">${parseFloat(product.price).toFixed(2)}</p>
            </div>
          </div>
          {product.stock > 1 && (
            <div className="flex items-center gap-3">
              <Label className="shrink-0">Qty:</Label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => Math.max(1,q-1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold hover:bg-muted/70">−</button>
                <span className="w-8 text-center font-bold text-lg">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock,q+1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold hover:bg-muted/70">+</button>
                <span className="text-xs text-muted-foreground">of {product.stock}</span>
              </div>
            </div>
          )}
          <div><Label>Delivery address (optional)</Label><Input placeholder="e.g. 12 Baker Street, London" value={address} onChange={e => setAddress(e.target.value)} className="mt-1" data-testid="input-delivery-address" /></div>
          <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>TSIA fee (5%)</span><span>${commission.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
          <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${canAfford ? "bg-green-50 dark:bg-green-900/20 text-green-700" : "bg-red-50 dark:bg-red-900/20 text-red-600"}`}>
            {canAfford ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            {canAfford ? `Wallet: $${walletBalance.toFixed(2)} — Ready` : `Need $${(total - walletBalance).toFixed(2)} more in wallet`}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => buyMutation.mutate({productId: product.id, quantity: qty, deliveryAddress: address || undefined})} disabled={buyMutation.isPending || !canAfford} data-testid="button-confirm-purchase" className="flex-1 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold">
            {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />} Pay ${total.toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Detail Modal ──────────────────────────────────────────────────
function ProductDetailModal({ product, open, onClose, onBuy }: { product: Product | null; open: boolean; onClose: () => void; onBuy: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  if (!product) return null;
  const imgs = product.images?.length ? product.images : [];
  const orig = originalPrice(product.price);
  const disc = Math.round((1 - parseFloat(product.price) / parseFloat(orig)) * 100);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Image hero */}
        <div className="relative w-full aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-t-2xl overflow-hidden">
          {imgs.length > 0 ? (
            <img src={imgs[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{CATEGORY_ICONS[product.category] || "📦"}</div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"><X className="w-4 h-4 text-white" /></button>
          {disc > 0 && <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">−{disc}%</div>}
          {imgs.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {imgs.map((_, i) => <button key={i} onClick={() => setImgIdx(i)} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-white" : "bg-white/40"}`} />)}
            </div>
          )}
        </div>
        {/* Thumb strip */}
        {imgs.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
            {imgs.map((img, i) => (
              <button key={i} onClick={() => setImgIdx(i)} className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 ${i === imgIdx ? "border-tsia-green" : "border-transparent"}`}>
                <img src={img} className="w-full h-full object-cover" alt="" />
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
            </div>
            <Badge className={product.condition === "new" ? "bg-tsia-green/10 text-tsia-green border-tsia-green/30" : "bg-muted text-muted-foreground"}>{product.condition}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <StarRating />
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{product.location}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-tsia-green/10 flex items-center justify-center font-bold text-tsia-green text-lg">{product.sellerName?.[0]}</div>
            <div><p className="text-sm font-semibold">{product.sellerName}</p><p className="text-xs text-muted-foreground">Verified TSIA seller</p></div>
            <Badge className="ml-auto bg-tsia-green/10 text-tsia-green text-[10px]">✓ Verified</Badge>
          </div>
          <div className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
            <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1"><Package className="w-3.5 h-3.5" />{product.stock} in stock</span>
            <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1"><Truck className="w-3.5 h-3.5" />Free shipping</span>
          </div>
        </div>
        <div className="px-5 pb-5">
          <Button onClick={onBuy} disabled={product.stock === 0} className="w-full h-13 py-4 bg-tsia-green hover:bg-tsia-green/90 text-white font-bold rounded-2xl text-base" data-testid={`btn-detail-buy-${product.id}`}>
            <ShoppingCart className="w-5 h-5 mr-2" /> Buy Now — ${parseFloat(product.price).toFixed(2)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function EcommerceSection() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const { data: cartItems = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/purchases"] });

  const toggleWishlist = (id: number) => {
    setWishlist(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem("tsia_wishlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleView = (p: Product) => { setSelectedProduct(p); setDetailOpen(true); };
  const handleBuy = (p: Product) => { setBuyProduct(p); setBuyOpen(true); };

  const updateStatusMutation = useMutation({
    mutationFn: async ({id, status}: {id: number; status: string}) => { const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status }); return res.json(); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders/sales"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const featured = (products as Product[]).slice(0, 8);
  const gridProducts = showAllProducts ? (products as Product[]) : (products as Product[]).slice(0, 12);

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
          <button onClick={() => { setTab("purchases"); }} data-testid="btn-cart" className="relative w-10 h-10 bg-card rounded-full border flex items-center justify-center shadow-sm hover:shadow transition-shadow">
            <ShoppingCart className="w-5 h-5" />
            {(cartItems as Order[]).length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {Math.min((cartItems as Order[]).length, 99)}
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
          <button onClick={() => setActiveSearch(search)} className="text-muted-foreground hover:text-foreground"><Mic className="w-4 h-4" /></button>
        </div>
        <button className="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-md shrink-0" onClick={() => {}}>
          <Filter className="w-5 h-5 text-white dark:text-slate-900" />
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
              <button className="text-xs text-tsia-green font-semibold flex items-center gap-0.5">View All <ChevronRight className="w-3.5 h-3.5" /></button>
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
                    <FeaturedCard key={p.id} product={p} onView={() => handleView(p)} onBuy={() => handleBuy(p)} wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
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
              {(products as Product[]).length > 12 && !showAllProducts && (
                <button className="text-xs text-tsia-green font-semibold" onClick={() => setShowAllProducts(true)}>See all {(products as Product[]).length}</button>
              )}
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
                  {gridProducts.map(p => (
                    <ProductCard key={p.id} product={p} onView={() => handleView(p)} onBuy={() => handleBuy(p)} wishlisted={wishlist.has(p.id)} onWishlist={() => toggleWishlist(p.id)} />
                  ))}
                </div>
                {!showAllProducts && (products as Product[]).length > 12 && (
                  <Button variant="outline" className="w-full mt-4 rounded-2xl" onClick={() => setShowAllProducts(true)}>
                    Load more products <ChevronRight className="w-4 h-4 ml-1" />
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
              <p className="text-muted-foreground text-sm mb-4">Start selling — TSIA only takes 5%.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white"><Plus className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
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
          ) : (purchases as Order[]).map(o => (
            <div key={o.id} data-testid={`row-purchase-${o.id}`} className="bg-card border rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                  <p className="text-xs text-muted-foreground">From {o.sellerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(o.createdAt).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})}</p>
                  {o.deliveryAddress && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Truck className="w-3 h-3" />{o.deliveryAddress}</p>}
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-black text-base">${parseFloat(o.totalAmount).toFixed(2)}</p>
                  <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                </div>
              </div>
            </div>
          ))}
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
          ) : (sales as Order[]).map(o => (
            <div key={o.id} data-testid={`row-sale-${o.id}`} className="bg-card border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                  <p className="text-xs text-muted-foreground">By {o.buyerName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-black text-base text-tsia-green">+${parseFloat(o.sellerReceives).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">after 5% fee</p>
                  <Badge className={`${STATUS_COLORS[o.status] || ""} text-[10px] mt-1 rounded-full`}>{o.status}</Badge>
                </div>
              </div>
              {o.status === "confirmed" && (
                <Button size="sm" variant="outline" className="w-full h-8 text-xs rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 mt-1"
                  onClick={() => updateStatusMutation.mutate({id: o.id, status: "shipped"})} data-testid={`btn-ship-${o.id}`}>
                  <Truck className="w-3.5 h-3.5 mr-1.5" /> Mark as Shipped
                </Button>
              )}
              {o.status === "shipped" && (
                <Button size="sm" variant="outline" className="w-full h-8 text-xs rounded-xl border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 mt-1"
                  onClick={() => updateStatusMutation.mutate({id: o.id, status: "delivered"})} data-testid={`btn-deliver-${o.id}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark as Delivered
                </Button>
              )}
            </div>
          ))}
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
            { label: "Commission", value: "5%", icon: BadgePercent, color: "text-tsia-green" },
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
      <ProductDetailModal product={selectedProduct} open={detailOpen} onClose={() => setDetailOpen(false)} onBuy={() => { setDetailOpen(false); setBuyProduct(selectedProduct); setBuyOpen(true); }} />
      <BuyModal product={buyProduct} open={buyOpen} onClose={() => setBuyOpen(false)} walletBalance={walletBalance} />
    </div>
  );
}
