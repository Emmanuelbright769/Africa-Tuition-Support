import { useState } from "react";
import {
  Search, ShoppingCart, MapPin, ChevronDown, Star, Heart, Package,
  Tag, Truck, ChevronRight, ChevronLeft, Bell, User, Menu,
  Zap, BadgePercent, ShieldCheck, RefreshCw, Headphones, Flame
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type Product = {
  id: number; title: string; price: number; originalPrice: number;
  rating: number; reviews: number; prime: boolean; badge?: string;
  category: string; seller: string; freeReturn?: boolean; image: string;
  condition?: string; location?: string;
};

// ── Color palette ─────────────────────────────────────────────────────────
const TSIA = {
  navy:    "#232F3E",
  navyMid: "#37475A",
  navyAlt: "#485769",
  gold:    "#FFD814",
  goldHov: "#F7CA00",
  orange:  "#FF9900",
  text:    "#0F1111",
  muted:   "#565959",
  border:  "#D5D9D9",
  bg:      "#EAEDED",
  card:    "#FFFFFF",
  link:    "#007185",
  linkAlt: "#C45500",
  green:   "#067D62",
  prime:   "#00A8E1",
  forest:  "#1a6b3c",
};

// ── Mock products ─────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id:1, title:"Samsung 65\" 4K Smart TV - Crystal UHD Display", price:329999, originalPrice:450000, rating:4.5, reviews:2847, prime:true, badge:"Best Seller", category:"Electronics", seller:"TechHub NG", freeReturn:true, image:"https://images.unsplash.com/photo-1593359677879-a4bb92f829e1?w=300&q=80" },
  { id:2, title:"Men's Premium Ankara Suit - 2-Piece Kaftan Set", price:28500, originalPrice:45000, rating:4.3, reviews:512, prime:false, badge:"Hot Deal", category:"Fashion", seller:"African Styles", freeReturn:false, image:"https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300&q=80", location:"Lagos" },
  { id:3, title:"Standing Desk - Height Adjustable, Bamboo Top 140cm", price:89000, originalPrice:130000, rating:4.7, reviews:1203, prime:true, badge:"TSIA Pick", category:"Home", seller:"Furni World", freeReturn:true, image:"https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=300&q=80" },
  { id:4, title:"Wireless Noise-Cancelling Headphones ANC Pro", price:45000, originalPrice:70000, rating:4.6, reviews:3124, prime:true, badge:"Best Seller", category:"Electronics", seller:"SoundMax NG", freeReturn:true, image:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80" },
  { id:5, title:"Natural Shea Butter Cream — 500g Premium Grade", price:4500, originalPrice:7000, rating:4.4, reviews:876, prime:false, category:"Health", seller:"NatureCare", freeReturn:false, image:"https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=300&q=80" },
  { id:6, title:"Professional Football Boots — Adidas Copa Sense", price:38000, originalPrice:55000, rating:4.8, reviews:421, prime:true, badge:"New Arrival", category:"Sports", seller:"KickZone", freeReturn:true, image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80" },
  { id:7, title:"The Almanack of Naval Ravikant — Paperback", price:3800, originalPrice:5500, rating:4.9, reviews:6211, prime:true, category:"Books", seller:"PageTurner NG", freeReturn:false, image:"https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80" },
  { id:8, title:"Electric Air Fryer 5.5L — Digital Display, 1800W", price:32000, originalPrice:48000, rating:4.5, reviews:1547, prime:true, badge:"Flash Deal", category:"Home", seller:"KitchenPro", freeReturn:true, image:"https://images.unsplash.com/photo-1585515320310-259814833e62?w=300&q=80" },
  { id:9, title:"Women's Lace Bodycon Midi Dress — Elegant Evening", price:18500, originalPrice:28000, rating:4.2, reviews:334, prime:false, category:"Fashion", seller:"Glam House", freeReturn:false, image:"https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&q=80" },
  { id:10, title:"Organic Turmeric Powder 250g — Premium Grade", price:2800, originalPrice:3500, rating:4.7, reviews:2103, prime:false, category:"Food", seller:"OrganicFarm NG", freeReturn:false, image:"https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=300&q=80" },
];

const CATEGORIES = [
  { name:"All", emoji:"🛍️" },
  { name:"Electronics", emoji:"📱" },
  { name:"Fashion", emoji:"👗" },
  { name:"Books", emoji:"📚" },
  { name:"Health", emoji:"💊" },
  { name:"Home", emoji:"🏠" },
  { name:"Sports", emoji:"⚽" },
  { name:"Food", emoji:"🥘" },
  { name:"Services", emoji:"🛠️" },
];

const HERO_SLIDES = [
  { bg:"linear-gradient(135deg,#232F3E 0%,#1a6b3c 100%)", tag:"🔥 Flash Sale", title:"Up to 60% OFF Electronics", sub:"Limited time deals — ends midnight", cta:"Shop Now", emoji:"⚡" },
  { bg:"linear-gradient(135deg,#b8860b 0%,#232F3E 100%)", tag:"⭐ TSIA Members Only", title:"Exclusive Marketplace Deals", sub:"Member-only prices every day", cta:"Explore Deals", emoji:"💎" },
  { bg:"linear-gradient(135deg,#1a6b3c 0%,#0e3d25 100%)", tag:"🚀 New Arrivals", title:"Fresh Drops — Brand New Listings", sub:"Handpicked products added daily", cta:"See New Arrivals", emoji:"✨" },
];

// ── Helper: Star Row ──────────────────────────────────────────────────────
function Stars({ rating, count }: { rating: number; count: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, marginBottom:2 }}>
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={12}
          style={{ color: s <= Math.round(rating) ? "#FFA41C" : "#DDD", fill: s <= Math.round(rating) ? "#FFA41C" : "#DDD" }} />
      ))}
      <span style={{ color: TSIA.link, fontSize:12, marginLeft:2 }}>{count.toLocaleString()}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function Marketplace() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const [heroIdx, setHeroIdx] = useState(0);
  const [tab, setTab] = useState<"browse"|"listings"|"purchases"|"sales">("browse");

  const formatPrice = (n: number) => `₦${n.toLocaleString()}`;
  const discount = (p: number, o: number) => Math.round((1 - p/o) * 100);

  const filtered = PRODUCTS.filter(p =>
    (activeCategory === "All" || p.category === activeCategory) &&
    (search === "" || p.title.toLowerCase().includes(search.toLowerCase()))
  );

  const hero = HERO_SLIDES[heroIdx];

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", background: TSIA.bg, minHeight:"100vh", color: TSIA.text }}>

      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <header style={{ background: TSIA.navy, position:"sticky", top:0, zIndex:50 }}>
        {/* Main nav row */}
        <div style={{ maxWidth:1400, margin:"0 auto", display:"flex", alignItems:"center", gap:8, padding:"8px 12px" }}>
          {/* Logo */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginRight:4, cursor:"pointer", padding:"4px 6px", borderRadius:2, border:"1px solid transparent" }}
            onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
            onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
            <span style={{ color:"white", fontWeight:900, fontSize:20, letterSpacing:-1, lineHeight:1 }}>TSIA</span>
            <span style={{ color: TSIA.gold, fontSize:9, fontWeight:700, letterSpacing:1 }}>MARKETPLACE</span>
          </div>

          {/* Deliver to */}
          <div style={{ display:"flex", flexDirection:"column", cursor:"pointer", padding:"4px 6px", borderRadius:2, border:"1px solid transparent", marginRight:4 }}
            onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
            onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
            <span style={{ color:"#CCC", fontSize:10 }}>Deliver to</span>
            <div style={{ display:"flex", alignItems:"center", gap:2 }}>
              <MapPin size={14} style={{ color:"white" }} />
              <span style={{ color:"white", fontWeight:700, fontSize:12 }}>Lagos</span>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ flex:1, display:"flex", height:40 }}>
            <select style={{ background:"#F3F3F3", border:"none", borderRadius:"4px 0 0 4px", padding:"0 8px", fontSize:12, cursor:"pointer", outline:"none", minWidth:60 }}>
              <option>All</option>
              <option>Electronics</option>
              <option>Fashion</option>
              <option>Books</option>
            </select>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search TSIA Marketplace..."
              style={{ flex:1, border:"none", padding:"0 12px", fontSize:14, outline:"none" }}
            />
            <button style={{ background: TSIA.orange, border:"none", borderRadius:"0 4px 4px 0", padding:"0 14px", cursor:"pointer" }}>
              <Search size={18} style={{ color:"white" }} />
            </button>
          </div>

          {/* Right nav items */}
          <div style={{ display:"flex", gap:2 }}>
            {/* Account */}
            <div style={{ display:"flex", flexDirection:"column", cursor:"pointer", padding:"4px 8px", borderRadius:2, border:"1px solid transparent" }}
              onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
              onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
              <span style={{ color:"#CCC", fontSize:10 }}>Hello, Member</span>
              <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                <span style={{ color:"white", fontWeight:700, fontSize:12 }}>Account & Lists</span>
                <ChevronDown size={12} style={{ color:"white" }} />
              </div>
            </div>
            {/* Returns */}
            <div style={{ display:"flex", flexDirection:"column", cursor:"pointer", padding:"4px 8px", borderRadius:2, border:"1px solid transparent" }}
              onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
              onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
              <span style={{ color:"#CCC", fontSize:10 }}>Returns</span>
              <span style={{ color:"white", fontWeight:700, fontSize:12 }}>& Orders</span>
            </div>
            {/* Cart */}
            <div style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer", padding:"4px 8px", borderRadius:2, border:"1px solid transparent", position:"relative" }}
              onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
              onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
              <div style={{ position:"relative" }}>
                <ShoppingCart size={28} style={{ color:"white" }} />
                {cart.size > 0 && (
                  <span style={{ position:"absolute", top:-6, right:-6, background: TSIA.orange, color:"white", fontSize:11, fontWeight:700, borderRadius:"50%", width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {cart.size}
                  </span>
                )}
              </div>
              <span style={{ color:"white", fontWeight:700, fontSize:12 }}>Cart</span>
            </div>
          </div>
        </div>

        {/* Secondary nav bar */}
        <div style={{ background: TSIA.navyMid, display:"flex", alignItems:"center", gap:0, padding:"0 12px", overflowX:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 10px", cursor:"pointer", color:"white", fontSize:13, fontWeight:600, border:"1px solid transparent", borderRadius:2, whiteSpace:"nowrap" }}
            onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
            onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
            <Menu size={16} /> All
          </div>
          {["Today's Deals","TSIA Prime","Electronics","Fashion","Books","Health","Home","Sports","Sell on TSIA"].map(label => (
            <div key={label} style={{ padding:"6px 10px", cursor:"pointer", color:"white", fontSize:13, border:"1px solid transparent", borderRadius:2, whiteSpace:"nowrap" }}
              onMouseEnter={e=>(e.currentTarget.style.border=`1px solid white`)}
              onMouseLeave={e=>(e.currentTarget.style.border="1px solid transparent")}>
              {label}
            </div>
          ))}
          <div style={{ padding:"6px 10px", cursor:"pointer", color: TSIA.gold, fontSize:13, fontWeight:700, border:"1px solid transparent", borderRadius:2, whiteSpace:"nowrap" }}>
            🔥 Flash Sale
          </div>
        </div>
      </header>

      {/* ── PAGE TABS ────────────────────────────────────────────────────── */}
      <div style={{ background:"white", borderBottom:`1px solid ${TSIA.border}`, display:"flex", gap:0, paddingLeft:16 }}>
        {(["browse","listings","purchases","sales"] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:"10px 20px", background:"none", border:"none", borderBottom: tab===t ? `3px solid ${TSIA.orange}` : "3px solid transparent", cursor:"pointer", fontSize:14, fontWeight: tab===t ? 700 : 400, color: tab===t ? TSIA.text : TSIA.muted, textTransform:"capitalize" }}>
            {t === "browse" ? "Browse" : t === "listings" ? "My Listings" : t === "purchases" ? "Purchases" : "Sales"}
          </button>
        ))}
        <button style={{ marginLeft:"auto", marginRight:16, padding:"6px 16px", background: TSIA.gold, border:`1px solid ${TSIA.gold}`, borderRadius:4, cursor:"pointer", fontWeight:700, fontSize:13, color: TSIA.text, alignSelf:"center" }}>
          + List a Product
        </button>
      </div>

      {tab === "browse" && (
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 12px" }}>

          {/* ── HERO CAROUSEL ─────────────────────────────────────────── */}
          <div style={{ position:"relative", margin:"12px 0", borderRadius:8, overflow:"hidden" }}>
            <div style={{ background: hero.bg, minHeight:280, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"32px 48px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", right:-40, top:-40, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }} />
              <div style={{ position:"absolute", right:40, bottom:-60, width:150, height:150, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
              <div style={{ zIndex:1 }}>
                <span style={{ background:"rgba(255,255,255,0.2)", color:"white", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700 }}>{hero.tag}</span>
                <h2 style={{ color:"white", fontSize:30, fontWeight:900, margin:"12px 0 6px", lineHeight:1.2 }}>{hero.title}</h2>
                <p style={{ color:"rgba(255,255,255,0.8)", fontSize:14, marginBottom:20 }}>{hero.sub}</p>
                <button style={{ background: TSIA.gold, border:"none", borderRadius:4, padding:"10px 24px", fontWeight:700, fontSize:14, cursor:"pointer", color: TSIA.text }}>
                  {hero.cta} →
                </button>
              </div>
              <div style={{ fontSize:80, zIndex:1, userSelect:"none" }}>{hero.emoji}</div>
            </div>
            {/* Prev/Next */}
            <button onClick={()=>setHeroIdx(i=>(i-1+HERO_SLIDES.length)%HERO_SLIDES.length)}
              style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.9)", border:"none", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" }}>
              <ChevronLeft size={20} style={{ color: TSIA.navy }} />
            </button>
            <button onClick={()=>setHeroIdx(i=>(i+1)%HERO_SLIDES.length)}
              style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.9)", border:"none", borderRadius:"50%", width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.2)" }}>
              <ChevronRight size={20} style={{ color: TSIA.navy }} />
            </button>
            {/* Dots */}
            <div style={{ position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)", display:"flex", gap:6 }}>
              {HERO_SLIDES.map((_,i)=>(
                <button key={i} onClick={()=>setHeroIdx(i)}
                  style={{ width: i===heroIdx ? 20 : 8, height:8, borderRadius:4, border:"none", background: i===heroIdx ? TSIA.gold : "rgba(255,255,255,0.5)", transition:"all .3s", cursor:"pointer" }} />
              ))}
            </div>
          </div>

          {/* ── TRUST BADGES ──────────────────────────────────────────── */}
          <div style={{ background:"white", border:`1px solid ${TSIA.border}`, borderRadius:4, display:"flex", justifyContent:"space-around", padding:"14px 24px", marginBottom:12 }}>
            {[
              { icon:<ShieldCheck size={20} style={{ color: TSIA.forest }} />, label:"Escrow Protected", sub:"Funds held until delivery" },
              { icon:<Truck size={20} style={{ color: TSIA.link }} />, label:"TSIA Verified Sellers", sub:"All sellers vetted" },
              { icon:<RefreshCw size={20} style={{ color: TSIA.orange }} />, label:"Easy Returns", sub:"Buyer protection policy" },
              { icon:<Headphones size={20} style={{ color: TSIA.navy }} />, label:"Live Chat Support", sub:"Voice & text in-app" },
            ].map((b,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                {b.icon}
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color: TSIA.text }}>{b.label}</div>
                  <div style={{ fontSize:11, color: TSIA.muted }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── CATEGORY ROW ──────────────────────────────────────────── */}
          <div style={{ background:"white", border:`1px solid ${TSIA.border}`, borderRadius:4, marginBottom:12, padding:"16px 20px" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:16, fontWeight:700 }}>Shop by Category</h3>
            <div style={{ display:"flex", gap:16, overflowX:"auto", paddingBottom:4 }}>
              {CATEGORIES.map(c => (
                <button key={c.name} onClick={()=>setActiveCategory(c.name)}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:4, border: activeCategory===c.name ? `2px solid ${TSIA.orange}` : `1px solid ${TSIA.border}`, background: activeCategory===c.name ? "#FFF3E0" : "white", cursor:"pointer", minWidth:70 }}>
                  <span style={{ fontSize:24 }}>{c.emoji}</span>
                  <span style={{ fontSize:11, fontWeight: activeCategory===c.name ? 700 : 400, color: activeCategory===c.name ? TSIA.linkAlt : TSIA.text, whiteSpace:"nowrap" }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── PRODUCT GRID ──────────────────────────────────────────── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:14, color: TSIA.muted }}>
              {activeCategory !== "All" ? `${activeCategory} — ` : ""}{filtered.length} results
              {search && ` for "${search}"`}
            </span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, color: TSIA.muted }}>Sort by:</span>
              <select style={{ border:`1px solid ${TSIA.border}`, borderRadius:4, padding:"4px 8px", fontSize:13, background:"white" }}>
                <option>Featured</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Avg. Rating</option>
                <option>Newest</option>
              </select>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:12, marginBottom:24 }}>
            {filtered.map(p => {
              const inCart = cart.has(p.id);
              const inWish = wishlist.has(p.id);
              const disc = discount(p.price, p.originalPrice);
              return (
                <div key={p.id}
                  style={{ background: TSIA.card, border:`1px solid ${TSIA.border}`, borderRadius:4, overflow:"hidden", display:"flex", flexDirection:"column", cursor:"pointer", transition:"box-shadow .15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.15)")}
                  onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}
                >
                  {/* Image */}
                  <div style={{ position:"relative", background:"#F7F8F8", height:200, overflow:"hidden" }}>
                    <img src={p.image} alt={p.title}
                      style={{ width:"100%", height:"100%", objectFit:"cover" }}
                      onError={e=>{ (e.target as HTMLImageElement).src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=300&q=80"; }} />
                    {p.badge && (
                      <span style={{ position:"absolute", top:8, left:8, background: p.badge==="Best Seller" ? "#CC0C39" : p.badge==="TSIA Pick" ? TSIA.forest : p.badge==="Flash Deal" ? TSIA.orange : TSIA.navy, color:"white", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:2 }}>
                        {p.badge}
                      </span>
                    )}
                    {disc >= 20 && (
                      <span style={{ position:"absolute", top: p.badge ? 32 : 8, left:8, background: TSIA.gold, color: TSIA.text, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:2 }}>
                        -{disc}%
                      </span>
                    )}
                    <button
                      onClick={e=>{ e.stopPropagation(); setWishlist(w=>{ const n=new Set(w); n.has(p.id)?n.delete(p.id):n.add(p.id); return n; }); }}
                      style={{ position:"absolute", top:8, right:8, width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.9)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>
                      <Heart size={14} style={{ color: inWish ? "#B12704" : TSIA.muted, fill: inWish ? "#B12704" : "none" }} />
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{ padding:"10px 12px", flex:1, display:"flex", flexDirection:"column" }}>
                    {/* Prime badge */}
                    {p.prime && (
                      <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:4 }}>
                        <span style={{ color: TSIA.prime, fontWeight:900, fontSize:11, letterSpacing:.5 }}>prime</span>
                        <span style={{ color: TSIA.muted, fontSize:10 }}>FREE delivery</span>
                      </div>
                    )}

                    {/* Title */}
                    <div style={{ fontSize:13, color: TSIA.text, lineHeight:1.4, marginBottom:6, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                      {p.title}
                    </div>

                    {/* Stars */}
                    <Stars rating={p.rating} count={p.reviews} />

                    {/* Price */}
                    <div style={{ marginTop:4 }}>
                      <span style={{ color:"#CC0C39", fontSize:11, fontWeight:700 }}>-{disc}% </span>
                      <span style={{ color: TSIA.text, fontSize:18, fontWeight:700 }}>{formatPrice(p.price)}</span>
                      <div style={{ color: TSIA.muted, fontSize:11 }}>
                        M.R.P.: <s>{formatPrice(p.originalPrice)}</s>
                      </div>
                    </div>

                    {/* Location / Condition */}
                    {p.location && (
                      <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color: TSIA.muted, marginTop:3 }}>
                        <MapPin size={10} /> {p.location}
                      </div>
                    )}
                    {p.condition && (
                      <div style={{ fontSize:11, color: TSIA.muted, marginTop:2 }}>Condition: {p.condition}</div>
                    )}

                    {/* Free return */}
                    {p.freeReturn && (
                      <div style={{ fontSize:11, color: TSIA.forest, marginTop:4, fontWeight:600 }}>✓ Free return</div>
                    )}

                    {/* Seller */}
                    <div style={{ fontSize:11, color: TSIA.muted, marginTop:4 }}>
                      Sold by: <span style={{ color: TSIA.link }}>{p.seller}</span>
                    </div>

                    {/* CTA Buttons */}
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
                      <button
                        onClick={e=>{ e.stopPropagation(); setCart(c=>{ const n=new Set(c); n.has(p.id)?n.delete(p.id):n.add(p.id); return n; }); }}
                        style={{ background: inCart ? "#ffc107" : TSIA.gold, border:`1px solid ${inCart?"#c79100":TSIA.goldHov}`, borderRadius:20, padding:"7px 12px", fontWeight:700, fontSize:12, cursor:"pointer", color: TSIA.text, transition:"background .15s" }}>
                        {inCart ? "✓ Added to Cart" : "Add to Cart"}
                      </button>
                      <button
                        style={{ background:"#FFB81C", border:"1px solid #E47911", borderRadius:20, padding:"7px 12px", fontWeight:700, fontSize:12, cursor:"pointer", color: TSIA.text }}>
                        Buy with Escrow
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ background:"white", border:`1px solid ${TSIA.border}`, borderRadius:4, padding:"48px 24px", textAlign:"center" }}>
              <Package size={48} style={{ color: TSIA.muted, margin:"0 auto 12px" }} />
              <h3 style={{ color: TSIA.text, marginBottom:8 }}>No products found</h3>
              <p style={{ color: TSIA.muted, fontSize:14 }}>Try a different category or search term</p>
            </div>
          )}
        </div>
      )}

      {/* ── OTHER TABS ─────────────────────────────────────────────────── */}
      {tab !== "browse" && (
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"24px 12px" }}>
          <div style={{ background:"white", border:`1px solid ${TSIA.border}`, borderRadius:4, padding:"32px 24px", textAlign:"center" }}>
            {tab === "listings" && <><Package size={40} style={{ color: TSIA.muted, margin:"0 auto 12px" }} /><h3>My Listings</h3><p style={{ color: TSIA.muted, fontSize:14 }}>Products you have listed for sale will appear here</p><button style={{ marginTop:16, background: TSIA.gold, border:"none", borderRadius:4, padding:"10px 24px", fontWeight:700, cursor:"pointer" }}>+ List a Product</button></>}
            {tab === "purchases" && <><ShoppingCart size={40} style={{ color: TSIA.muted, margin:"0 auto 12px" }} /><h3>My Purchases</h3><p style={{ color: TSIA.muted, fontSize:14 }}>Your order history and active orders will appear here</p></>}
            {tab === "sales" && <><Tag size={40} style={{ color: TSIA.muted, margin:"0 auto 12px" }} /><h3>My Sales</h3><p style={{ color: TSIA.muted, fontSize:14 }}>Orders from buyers for your listings will appear here</p></>}
          </div>
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer>
        <div style={{ background: TSIA.navyAlt, padding:"4px 0", textAlign:"center", cursor:"pointer" }}
          onClick={()=>window.scrollTo({ top:0, behavior:"smooth" })}>
          <span style={{ color:"white", fontSize:13 }}>Back to top</span>
        </div>
        <div style={{ background: TSIA.navy, padding:"32px 40px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24 }}>
          {[
            { title:"Get to Know TSIA", links:["About SMAKEMGGOLD Ltd","Careers","Press Releases","TSIA Cares"] },
            { title:"Make Money with Us", links:["Sell on TSIA Marketplace","Affiliate Program","Trust Fund Co-Affiliate","Advertise Your Products"] },
            { title:"Payment Methods", links:["Squad Pay","Bank Transfer","Crypto Wallet","TSIA Wallet"] },
            { title:"Let Us Help You", links:["Your Account","Your Orders","Escrow Tracking","Contact Support"] },
          ].map(col => (
            <div key={col.title}>
              <h4 style={{ color:"white", fontSize:14, fontWeight:700, marginBottom:12 }}>{col.title}</h4>
              {col.links.map(l => (
                <div key={l} style={{ color:"#DDD", fontSize:13, marginBottom:8, cursor:"pointer" }}
                  onMouseEnter={e=>((e.target as HTMLElement).style.color="white")}
                  onMouseLeave={e=>((e.target as HTMLElement).style.color="#DDD")}>
                  {l}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ background: "#131A22", padding:"16px 40px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
            <span style={{ color:"white", fontWeight:900, fontSize:18, letterSpacing:-0.5 }}>TSIA</span>
            <span style={{ color: TSIA.gold, fontSize:9, fontWeight:700, letterSpacing:1 }}>MARKETPLACE</span>
          </div>
          <div style={{ color:"#999", fontSize:12, textAlign:"center" }}>
            © 2025 SMAKEMGGOLD Ltd RC: 1359954. All rights reserved.
            <br />Registered in England & Wales
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {["English (UK)","₦ NGN","Abuja, Nigeria"].map(t=>(
              <button key={t} style={{ background:"none", border:"1px solid #555", borderRadius:2, color:"#DDD", padding:"4px 10px", fontSize:11, cursor:"pointer" }}>{t}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
