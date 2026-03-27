import { useState, useRef } from "react";
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
  ChevronRight, ArrowLeft, Tag, Truck, CheckCircle2, X, Camera,
  TrendingUp, Loader2, Heart, Share2, Filter, Sparkles, Clock, BadgePercent
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ECOMMERCE } from "@shared/schema";

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

const CATEGORY_ICONS = ECOMMERCE.CATEGORY_ICONS;
const CATEGORY_LABELS = ECOMMERCE.CATEGORY_LABELS;
const CATEGORIES = ECOMMERCE.CATEGORIES;

const containerV = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemV = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } } };

function StarRating({ rating = 4.5 }: { rating?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= Math.floor(rating) ? "text-amber-400 fill-amber-400" : s - 0.5 <= rating ? "text-amber-400 fill-amber-200" : "text-gray-300"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">({Math.floor(Math.random() * 80 + 5)})</span>
    </div>
  );
}

function ProductCard({ product, onClick, onBuy }: { product: Product; onClick: () => void; onBuy: () => void }) {
  const img = product.images?.[0];
  const isOutOfStock = product.stock === 0;
  return (
    <motion.div variants={itemV} className="group">
      <div className="bg-card rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer" onClick={onClick}>
        {/* Image */}
        <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 overflow-hidden">
          {img ? (
            <img src={img} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Package className="w-12 h-12 text-slate-300" />
              <span className="text-xs text-slate-400 mt-2">{CATEGORY_ICONS[product.category] || "📦"}</span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.condition === "new" && <Badge className="bg-tsia-green text-white text-[10px] px-2 py-0.5 rounded-full">New</Badge>}
            {product.condition === "used" && <Badge variant="outline" className="bg-white/90 text-[10px] px-2 py-0.5 rounded-full">Used</Badge>}
            {isOutOfStock && <Badge className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">Out of Stock</Badge>}
          </div>
          <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white" onClick={e => e.stopPropagation()}>
            <Heart className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Info */}
        <div className="p-3">
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
            <span>{CATEGORY_ICONS[product.category]}</span> {CATEGORY_LABELS[product.category] || product.category}
          </p>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">{product.title}</h3>
          <StarRating />
          <div className="flex items-center gap-1 mt-1 mb-2">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{product.location}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xl font-bold text-primary">${parseFloat(product.price).toFixed(2)}</span>
              <p className="text-[10px] text-muted-foreground">by {product.sellerName.split(" ")[0]}</p>
            </div>
            <Button
              size="sm"
              disabled={isOutOfStock}
              onClick={e => { e.stopPropagation(); onBuy(); }}
              data-testid={`button-buy-${product.id}`}
              className="h-8 px-3 bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold text-xs rounded-xl"
            >
              <ShoppingCart className="w-3 h-3 mr-1" /> Buy
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
    const files = Array.from(e.target.files || []);
    files.slice(0, ECOMMERCE.MAX_IMAGES - images.length).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, ev.target?.result as string].slice(0, ECOMMERCE.MAX_IMAGES));
      reader.readAsDataURL(f);
    });
  };

  const commission = parseFloat(form.price || "0") * ECOMMERCE.COMMISSION_RATE;
  const youReceive = parseFloat(form.price || "0") - commission;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-tsia-green" /> List a Product for Sale</DialogTitle>
          <DialogDescription>Fill in your product details. TSIA takes a {ECOMMERCE.COMMISSION_RATE * 100}% commission on each sale.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Images */}
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
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary">
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] mt-1">Add photo</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImage} className="hidden" />
          </div>
          <div>
            <Label htmlFor="p-title">Product title *</Label>
            <Input id="p-title" placeholder="e.g. iPhone 14 Pro, Brand New" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} data-testid="input-product-title" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="p-desc">Description *</Label>
            <textarea id="p-desc" rows={3} placeholder="Describe your product — condition, features, specs..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} data-testid="input-product-description" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Price (USD) *</Label>
              <Input id="p-price" type="number" min={ECOMMERCE.MIN_PRICE} max={ECOMMERCE.MAX_PRICE} step={0.01} placeholder="0.00" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} data-testid="input-product-price" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="p-stock">Stock qty</Label>
              <Input id="p-stock" type="number" min={1} max={999} value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} data-testid="input-product-stock" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-cat">Category</Label>
              <select id="p-cat" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} data-testid="select-product-category" className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="p-cond">Condition</Label>
              <select id="p-cond" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))} data-testid="select-product-condition" className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-3 text-sm">
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="p-loc">Your location</Label>
            <Input id="p-loc" placeholder="London, UK" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} data-testid="input-product-location" className="mt-1" />
          </div>
          {/* Commission breakdown */}
          {parseFloat(form.price) > 0 && (
            <div className="bg-muted/50 rounded-xl p-4 border">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5" /> Price breakdown</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Listing price</span><span className="font-semibold">${parseFloat(form.price || "0").toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-red-500">TSIA commission (5%)</span><span className="text-red-500 font-semibold">-${commission.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">You receive</span><span className="font-bold text-tsia-green">${youReceive.toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate({ ...form, images, price: parseFloat(form.price), stock: parseInt(form.stock) })} disabled={createMutation.isPending || !form.title || !form.description || !form.price} data-testid="button-submit-product" className="bg-tsia-green text-white">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} List Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuyModal({ product, open, onClose, walletBalance }: { product: Product | null; open: boolean; onClose: () => void; walletBalance: number }) {
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const total = product ? parseFloat(product.price) * qty : 0;
  const commission = total * ECOMMERCE.COMMISSION_RATE;
  const canAfford = walletBalance >= total;

  const buyMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/orders", data); return res.json(); },
    onSuccess: (res: any) => {
      toast({ title: "Order placed!", description: res.message, className: "border-green-500" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      onClose();
      setQty(1); setAddress(""); setNote("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Purchase</DialogTitle>
          <DialogDescription>Payment will be deducted from your digital wallet instantly.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 flex gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {product.images?.[0] ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" /> : <Package className="w-full h-full p-3 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-2">{product.title}</p>
              <p className="text-xs text-muted-foreground">Sold by {product.sellerName}</p>
              <p className="text-lg font-bold text-primary mt-1">${parseFloat(product.price).toFixed(2)}</p>
            </div>
          </div>
          {product.stock > 1 && (
            <div>
              <Label>Quantity</Label>
              <div className="flex items-center gap-3 mt-1">
                <Button variant="outline" size="sm" onClick={() => setQty(q => Math.max(1, q - 1))}>-</Button>
                <span className="text-lg font-bold w-8 text-center">{qty}</span>
                <Button variant="outline" size="sm" onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</Button>
                <span className="text-xs text-muted-foreground">of {product.stock} in stock</span>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="buy-address">Delivery address (optional)</Label>
            <Input id="buy-address" placeholder="e.g. 12 Baker Street, London" value={address} onChange={e => setAddress(e.target.value)} data-testid="input-delivery-address" className="mt-1" />
          </div>
          {/* Payment breakdown */}
          <div className="bg-muted/50 rounded-xl p-3 border space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Unit price</span><span>${parseFloat(product.price).toFixed(2)}</span></div>
            {qty > 1 && <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>×{qty}</span></div>}
            <div className="flex justify-between border-t pt-1"><span className="font-bold">Total</span><span className="font-bold">${total.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">TSIA platform fee (5%)</span><span className="text-muted-foreground">${commission.toFixed(2)}</span></div>
          </div>
          <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${canAfford ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600"}`}>
            {canAfford ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
            {canAfford ? `Wallet balance: $${walletBalance.toFixed(2)} — sufficient` : `Insufficient balance. Wallet: $${walletBalance.toFixed(2)} — Need: $${(total - walletBalance).toFixed(2)} more`}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => buyMutation.mutate({ productId: product.id, quantity: qty, deliveryAddress: address || undefined })} disabled={buyMutation.isPending || !canAfford} data-testid="button-confirm-purchase" className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold">
            {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />} Pay ${total.toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailModal({ product, open, onClose, onBuy }: { product: Product | null; open: boolean; onClose: () => void; onBuy: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  if (!product) return null;
  const imgs = product.images?.length ? product.images : [];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{product.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Images */}
          <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
            {imgs.length > 0 ? (
              <>
                <img src={imgs[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
                {imgs.length > 1 && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {imgs.map((_, i) => <button key={i} onClick={() => setImgIdx(i)} className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/50"}`} />)}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">{CATEGORY_ICONS[product.category] || "📦"}</span>
              </div>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2">
              {imgs.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-colors ${i === imgIdx ? "border-primary" : "border-border"}`}>
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold text-primary">${parseFloat(product.price).toFixed(2)}</p>
              <StarRating />
            </div>
            <div className="text-right">
              <Badge className={product.condition === "new" ? "bg-tsia-green text-white" : "bg-muted text-muted-foreground"}>{product.condition}</Badge>
              <p className="text-xs text-muted-foreground mt-1">{product.stock} in stock</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {product.location}</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {product.viewCount} views</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(product.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">About this item</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{product.sellerName[0]}</div>
            <div>
              <p className="text-sm font-semibold">{product.sellerName}</p>
              <p className="text-xs text-muted-foreground">Verified seller</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onBuy} disabled={product.stock === 0} data-testid={`button-product-buy-${product.id}`} className="flex-1 bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold">
            <ShoppingCart className="w-4 h-4 mr-2" /> Buy Now — ${parseFloat(product.price).toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EcommerceSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);

  const { data: wallet } = useQuery<any>({ queryKey: ["/api/wallet"] });
  const walletBalance = parseFloat(wallet?.balance ?? "0");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", activeCategory, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCategory) params.set("category", activeCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: myListings = [] } = useQuery<Product[]>({ queryKey: ["/api/products/my"], enabled: tab === "my-listings" });
  const { data: purchases = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/purchases"], enabled: tab === "purchases" });
  const { data: sales = [] } = useQuery<Order[]>({ queryKey: ["/api/orders/sales"], enabled: tab === "sales" });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    sold: "bg-slate-100 text-slate-700",
    paused: "bg-amber-100 text-amber-800",
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => { const res = await apiRequest("PATCH", `/api/orders/${id}/status`, { status }); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/orders/sales"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleBuy = (p: Product) => { setBuyProduct(p); setBuyOpen(true); };
  const handleView = (p: Product) => { setSelectedProduct(p); setDetailOpen(true); };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "browse", label: "Marketplace", icon: ShoppingBag },
    { id: "my-listings", label: "My Listings", icon: Tag },
    { id: "purchases", label: "Purchases", icon: ShoppingCart },
    { id: "sales", label: "Sales", icon: TrendingUp },
  ];

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-tsia-green/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-6 h-6 text-tsia-gold" />
              <h2 className="text-2xl font-bold text-white">TSIA Market</h2>
              <Badge className="bg-tsia-gold/20 text-tsia-gold border-tsia-gold/30 text-xs">Live</Badge>
            </div>
            <p className="text-slate-400 text-sm">Buy and sell anything — 5% platform commission on every sale</p>
          </div>
          <Button onClick={() => setListOpen(true)} data-testid="button-list-product" className="bg-tsia-gold hover:bg-tsia-gold/90 text-slate-900 font-bold hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" /> Sell Something
          </Button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, electronics, fashion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-product-search"
            className="w-full h-12 rounded-xl bg-white/10 border border-white/20 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tsia-gold/40 focus:bg-white/15"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-muted/50 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-ecommerce-${t.id}`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-1 justify-center transition-all ${tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── BROWSE ── */}
      {tab === "browse" && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            <button onClick={() => setActiveCategory("")} data-testid="button-cat-all"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${!activeCategory ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
              <Sparkles className="w-3.5 h-3.5" /> All
            </button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setActiveCategory(activeCategory === c ? "" : c)} data-testid={`button-cat-${c}`}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${activeCategory === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
                {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (products as Product[]).length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products yet</h3>
              <p className="text-muted-foreground mb-6 text-sm">Be the first to list a product in the marketplace!</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-gold text-slate-900 font-bold">
                <Plus className="w-4 h-4 mr-2" /> List Your First Product
              </Button>
            </div>
          ) : (
            <motion.div variants={containerV} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(products as Product[]).map(p => (
                <ProductCard key={p.id} product={p} onClick={() => handleView(p)} onBuy={() => handleBuy(p)} />
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* ── MY LISTINGS ── */}
      {tab === "my-listings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{(myListings as Product[]).length} listing{(myListings as Product[]).length !== 1 ? "s" : ""}</p>
            <Button onClick={() => setListOpen(true)} size="sm" data-testid="button-new-listing" className="bg-tsia-green text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New listing
            </Button>
          </div>
          {(myListings as Product[]).length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-2xl">
              <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No listings yet</p>
              <p className="text-muted-foreground text-sm mb-4">Start selling and earn — TSIA only takes 5%.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white"><Plus className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (
            <motion.div variants={containerV} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(myListings as Product[]).map(p => (
                <motion.div key={p.id} variants={itemV}>
                  <div className="bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-muted relative">
                      {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">{CATEGORY_ICONS[p.category]}</div>}
                      <Badge className={`absolute top-2 left-2 text-[10px] ${statusColors[p.status] || ""}`}>{p.status}</Badge>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                      <p className="text-base font-bold text-primary">${parseFloat(p.price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{p.stock} in stock · {p.viewCount} views</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => handleView(p)} data-testid={`button-view-listing-${p.id}`}>View</Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7 text-red-500 border-red-300 hover:bg-red-50"
                          onClick={() => {
                            apiRequest("PATCH", `/api/products/${p.id}`, { status: "paused" })
                              .then(() => queryClient.invalidateQueries({ queryKey: ["/api/products/my"] }));
                          }}
                          data-testid={`button-pause-listing-${p.id}`}>Pause</Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* ── PURCHASES ── */}
      {tab === "purchases" && (
        <div className="space-y-3">
          {(purchases as Order[]).length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-2xl">
              <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No purchases yet</p>
              <p className="text-muted-foreground text-sm mb-4">Browse the marketplace and place your first order.</p>
              <Button onClick={() => setTab("browse")} variant="outline"><ShoppingBag className="w-4 h-4 mr-1.5" /> Browse products</Button>
            </div>
          ) : (purchases as Order[]).map((o) => (
            <motion.div key={o.id} variants={itemV} initial="hidden" animate="visible" data-testid={`row-purchase-${o.id}`}>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                      <p className="text-xs text-muted-foreground">Sold by {o.sellerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-base">${parseFloat(o.totalAmount).toFixed(2)}</p>
                      <Badge className={`${statusColors[o.status] || ""} text-[10px] mt-1`}>{o.status}</Badge>
                    </div>
                  </div>
                  {o.deliveryAddress && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Truck className="w-3 h-3" /> {o.deliveryAddress}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── SALES ── */}
      {tab === "sales" && (
        <div className="space-y-3">
          {(sales as Order[]).length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-2xl">
              <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold mb-1">No sales yet</p>
              <p className="text-muted-foreground text-sm mb-4">List a product to start earning.</p>
              <Button onClick={() => setListOpen(true)} className="bg-tsia-green text-white"><Tag className="w-4 h-4 mr-1.5" /> List a Product</Button>
            </div>
          ) : (sales as Order[]).map((o) => (
            <motion.div key={o.id} variants={itemV} initial="hidden" animate="visible" data-testid={`row-sale-${o.id}`}>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{o.product?.title ?? "Product"}</p>
                      <p className="text-xs text-muted-foreground">Bought by {o.buyerName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-base text-tsia-green">+${parseFloat(o.sellerReceives).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">after 5% commission</p>
                      <Badge className={`${statusColors[o.status] || ""} text-[10px] mt-1`}>{o.status}</Badge>
                    </div>
                  </div>
                  {o.status === "confirmed" && (
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs border-purple-300 text-purple-600 hover:bg-purple-50 mt-1"
                      onClick={() => updateStatusMutation.mutate({ id: o.id, status: "shipped" })}
                      data-testid={`button-mark-shipped-${o.id}`}>
                      <Truck className="w-3.5 h-3.5 mr-1.5" /> Mark as Shipped
                    </Button>
                  )}
                  {o.status === "shipped" && (
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs border-green-300 text-green-600 hover:bg-green-50 mt-1"
                      onClick={() => updateStatusMutation.mutate({ id: o.id, status: "delivered" })}
                      data-testid={`button-mark-delivered-${o.id}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark as Delivered
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Floating sell button (mobile) */}
      {tab === "browse" && (
        <button onClick={() => setListOpen(true)} data-testid="button-float-sell"
          className="fixed bottom-24 right-4 sm:hidden w-14 h-14 bg-tsia-gold rounded-full shadow-lg flex items-center justify-center z-50">
          <Plus className="w-7 h-7 text-slate-900" />
        </button>
      )}

      {/* Modals */}
      <ListProductModal open={listOpen} onClose={() => setListOpen(false)} />
      <ProductDetailModal product={selectedProduct} open={detailOpen} onClose={() => setDetailOpen(false)} onBuy={() => { setDetailOpen(false); setBuyProduct(selectedProduct); setBuyOpen(true); }} />
      <BuyModal product={buyProduct} open={buyOpen} onClose={() => setBuyOpen(false)} walletBalance={walletBalance} />
    </div>
  );
}
