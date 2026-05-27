import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Search, Bell, Star, StarOff,
  ArrowLeft, X, Plus, Minus, Home, BarChart3, Briefcase,
  List, ChevronRight, RefreshCw, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip as RTooltip, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Stock {
  ticker: string; name: string; sector: string; exchange: string;
  region: "african" | "us" | "global";
  price: number; change: number; changePercent: number;
  open: number; high: number; low: number;
  volume: string; marketCap: string; description: string;
  color: string; seed: number;
}
interface Holding { ticker: string; shares: number; avgPrice: number; }
interface TradeOrder {
  id: string; type: "buy" | "sell"; ticker: string;
  shares: number; price: number; date: string; status: "filled" | "pending";
}
type Tab = "home" | "market" | "portfolio" | "watchlist" | "orders";
type TimeRange = "1D" | "1W" | "1M" | "3M" | "1Y";
type Category = "all" | "african" | "us" | "global";

// ─── Seed RNG + price history generator ───────────────────────────────────────
function seedRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function genHistory(basePrice: number, points: number, seed: number) {
  const rng = seedRng(seed);
  const result: { t: string; v: number }[] = [];
  let p = basePrice * (0.80 + rng() * 0.40);
  for (let i = points; i >= 0; i--) {
    p = Math.max(p * (1 + (rng() - 0.495) * 0.045), 0.01);
    const d = new Date(); d.setDate(d.getDate() - i);
    result.push({ t: d.toLocaleDateString("en", { month: "short", day: "numeric" }), v: +p.toFixed(2) });
  }
  result[result.length - 1].v = +basePrice.toFixed(2);
  return result;
}
function historyForRange(stock: Stock, range: TimeRange) {
  const pts = range === "1D" ? 24 : range === "1W" ? 7 : range === "1M" ? 30 : range === "3M" ? 90 : 365;
  return genHistory(stock.price, pts, stock.seed + range.charCodeAt(0));
}

// ─── Stock catalogue ───────────────────────────────────────────────────────────
const STOCKS: Stock[] = [
  // ── African ──────────────────────────────────────────────────────────────────
  { ticker:"DANGCEM", name:"Dangote Cement",   sector:"Materials",   exchange:"NGX",    region:"african",
    price:458.30, change:12.50,  changePercent:2.80,  open:445.80, high:462.00, low:443.50,
    volume:"2.4M", marketCap:"₦7.8T",  color:"#e67e22", seed:101,
    description:"Nigeria's largest cement manufacturer, with production capacity across Sub-Saharan Africa." },
  { ticker:"GTCO",    name:"Guaranty Trust",   sector:"Finance",     exchange:"NGX",    region:"african",
    price:54.75,  change:-0.85,  changePercent:-1.53, open:55.60,  high:55.90,  low:54.10,
    volume:"18.2M",marketCap:"₦1.6T",  color:"#e74c3c", seed:102,
    description:"One of Africa's leading financial institutions offering retail, commercial, and investment banking." },
  { ticker:"ZENITHB", name:"Zenith Bank",      sector:"Finance",     exchange:"NGX",    region:"african",
    price:38.50,  change:0.60,   changePercent:1.58,  open:37.90,  high:39.20,  low:37.40,
    volume:"22.1M",marketCap:"₦1.2T",  color:"#2980b9", seed:103,
    description:"Nigeria's second-largest bank by assets, with a strong presence across West Africa." },
  { ticker:"MTNN",    name:"MTN Nigeria",      sector:"Telecom",     exchange:"NGX",    region:"african",
    price:190.60, change:-4.40,  changePercent:-2.26, open:195.00, high:196.50, low:189.80,
    volume:"5.7M", marketCap:"₦3.9T",  color:"#f39c12", seed:104,
    description:"Nigeria's largest mobile network operator with over 76 million subscribers." },
  { ticker:"SAFCOM",  name:"Safaricom",        sector:"Telecom",     exchange:"NSE",    region:"african",
    price:18.40,  change:0.25,   changePercent:1.38,  open:18.15,  high:18.75,  low:17.90,
    volume:"12.4M",marketCap:"KSh738B", color:"#27ae60", seed:105,
    description:"East Africa's largest telecom company and home to the M-Pesa mobile money platform." },
  { ticker:"EQUITY",  name:"Equity Group",     sector:"Finance",     exchange:"NSE",    region:"african",
    price:56.25,  change:1.50,   changePercent:2.74,  open:54.75,  high:57.00,  low:54.50,
    volume:"8.9M", marketCap:"KSh212B", color:"#8e44ad", seed:106,
    description:"Pan-African bank and insurance group operating across 7 African countries." },
  { ticker:"NPN",     name:"Naspers",          sector:"Tech/Media",  exchange:"JSE",    region:"african",
    price:3148.00,change:52.00,  changePercent:1.68,  open:3096.00,high:3165.00,low:3085.00,
    volume:"340K", marketCap:"R1.4T",   color:"#16a085", seed:107,
    description:"South Africa's largest company and a global technology investment holding group." },
  { ticker:"AIRTEL",  name:"Airtel Africa",    sector:"Telecom",     exchange:"LSE",    region:"african",
    price:142.80, change:3.20,   changePercent:2.29,  open:139.60, high:144.50, low:138.90,
    volume:"1.2M", marketCap:"£2.8B",   color:"#c0392b", seed:108,
    description:"One of Africa's leading providers of mobile communications and mobile money services." },
  { ticker:"STANBK",  name:"Standard Bank",   sector:"Finance",     exchange:"JSE",    region:"african",
    price:201.40, change:-2.60,  changePercent:-1.27, open:204.00, high:205.30, low:200.10,
    volume:"2.1M", marketCap:"R287B",   color:"#1a5276", seed:109,
    description:"Africa's largest bank by assets with operations in 20 African countries." },
  // ── US ───────────────────────────────────────────────────────────────────────
  { ticker:"AAPL",    name:"Apple Inc.",       sector:"Technology",  exchange:"NASDAQ", region:"us",
    price:213.49, change:3.27,   changePercent:1.56,  open:210.22, high:214.80, low:209.15,
    volume:"52.1M",marketCap:"$3.27T",  color:"#6c7a89", seed:201,
    description:"The world's most valuable company, known for the iPhone, Mac, and its growing services ecosystem." },
  { ticker:"NVDA",    name:"NVIDIA Corp.",     sector:"Technology",  exchange:"NASDAQ", region:"us",
    price:1208.88,change:43.22,  changePercent:3.71,  open:1165.66,high:1218.30,low:1162.40,
    volume:"31.8M",marketCap:"$2.97T",  color:"#76b900", seed:202,
    description:"World leader in AI computing hardware, GPUs, and deep learning platforms." },
  { ticker:"TSLA",    name:"Tesla Inc.",       sector:"Auto/Energy", exchange:"NASDAQ", region:"us",
    price:248.23, change:-8.15,  changePercent:-3.18, open:256.38, high:259.10, low:246.80,
    volume:"78.4M",marketCap:"$794B",   color:"#cc0000", seed:203,
    description:"Electric vehicle and clean energy pioneer, also developing robotics and AI." },
  { ticker:"GOOGL",   name:"Alphabet Inc.",    sector:"Technology",  exchange:"NASDAQ", region:"us",
    price:187.35, change:2.10,   changePercent:1.13,  open:185.25, high:188.90, low:184.60,
    volume:"18.3M",marketCap:"$2.33T",  color:"#4285f4", seed:204,
    description:"Parent company of Google, the world's dominant search engine and digital advertising platform." },
  { ticker:"META",    name:"Meta Platforms",   sector:"Technology",  exchange:"NASDAQ", region:"us",
    price:521.64, change:11.82,  changePercent:2.32,  open:509.82, high:524.70, low:507.30,
    volume:"14.7M",marketCap:"$1.33T",  color:"#0866ff", seed:205,
    description:"Operates Facebook, Instagram, WhatsApp, and is investing heavily in the metaverse." },
  { ticker:"MSFT",    name:"Microsoft Corp.",  sector:"Technology",  exchange:"NASDAQ", region:"us",
    price:420.21, change:5.44,   changePercent:1.31,  open:414.77, high:422.50, low:413.90,
    volume:"19.2M",marketCap:"$3.12T",  color:"#00a4ef", seed:206,
    description:"Enterprise software giant and cloud computing leader through its Azure platform." },
  { ticker:"AMZN",    name:"Amazon.com",       sector:"Retail/Cloud",exchange:"NASDAQ", region:"us",
    price:195.14, change:-2.86,  changePercent:-1.44, open:198.00, high:199.40, low:194.50,
    volume:"24.6M",marketCap:"$2.02T",  color:"#ff9900", seed:207,
    description:"The world's largest e-commerce marketplace and cloud infrastructure provider (AWS)." },
  { ticker:"JPM",     name:"JPMorgan Chase",   sector:"Finance",     exchange:"NYSE",   region:"us",
    price:218.72, change:1.48,   changePercent:0.68,  open:217.24, high:219.90, low:216.80,
    volume:"7.4M", marketCap:"$630B",   color:"#1a5276", seed:208,
    description:"Largest US bank by assets, offering investment, retail, and commercial banking services." },
  // ── Global ───────────────────────────────────────────────────────────────────
  { ticker:"SHEL",    name:"Shell plc",        sector:"Energy",      exchange:"LSE",    region:"global",
    price:2748.50,change:34.50,  changePercent:1.27,  open:2714.00,high:2758.00,low:2710.00,
    volume:"3.1M", marketCap:"£183B",   color:"#d4ac0d", seed:301,
    description:"One of the world's largest integrated oil and gas companies." },
  { ticker:"TSM",     name:"TSMC",             sector:"Semiconductor",exchange:"NYSE",  region:"global",
    price:185.60, change:4.20,   changePercent:2.32,  open:181.40, high:186.90, low:181.00,
    volume:"11.2M",marketCap:"$964B",   color:"#0077c8", seed:302,
    description:"World's largest semiconductor foundry, manufacturing chips for Apple, NVIDIA, and others." },
  { ticker:"BABA",    name:"Alibaba Group",    sector:"Retail/Cloud",exchange:"NYSE",   region:"global",
    price:81.40,  change:-1.20,  changePercent:-1.45, open:82.60,  high:83.10,  low:80.90,
    volume:"16.8M",marketCap:"$196B",   color:"#ff6900", seed:303,
    description:"China's largest e-commerce and cloud computing conglomerate." },
  { ticker:"SAP",     name:"SAP SE",           sector:"Software",    exchange:"NYSE",   region:"global",
    price:228.90, change:3.10,   changePercent:1.37,  open:225.80, high:230.20, low:225.10,
    volume:"3.8M", marketCap:"€277B",   color:"#008fdf", seed:304,
    description:"World's leading enterprise application software provider for business operations." },
];

const INDICES = [
  { name: "S&P 500",  value: "5,308",    change: "+0.57%", up: true  },
  { name: "NASDAQ",   value: "16,742",   change: "+0.68%", up: true  },
  { name: "NGX All",  value: "99,154",   change: "-0.23%", up: false },
  { name: "FTSE 100", value: "8,231",    change: "+0.34%", up: true  },
  { name: "NSE 20",   value: "1,892",    change: "+1.12%", up: true  },
  { name: "JSE Top40",value: "74,380",   change: "-0.19%", up: false },
];

const INIT_HOLDINGS: Holding[] = [
  { ticker: "NVDA",    shares: 2,   avgPrice: 875.40 },
  { ticker: "DANGCEM", shares: 50,  avgPrice: 410.00 },
  { ticker: "SAFCOM",  shares: 200, avgPrice: 16.80  },
  { ticker: "META",    shares: 3,   avgPrice: 395.20 },
  { ticker: "GTCO",    shares: 500, avgPrice: 52.00  },
];

const INIT_ORDERS: TradeOrder[] = [
  { id:"o1", type:"buy",  ticker:"NVDA",    shares:2,   price:875.40,  date:"May 12, 2026", status:"filled" },
  { id:"o2", type:"buy",  ticker:"DANGCEM", shares:50,  price:410.00,  date:"May 8, 2026",  status:"filled" },
  { id:"o3", type:"sell", ticker:"TSLA",    shares:1,   price:268.90,  date:"Apr 29, 2026", status:"filled" },
  { id:"o4", type:"buy",  ticker:"META",    shares:3,   price:395.20,  date:"Apr 22, 2026", status:"filled" },
  { id:"o5", type:"buy",  ticker:"SAFCOM",  shares:200, price:16.80,   date:"Apr 15, 2026", status:"filled" },
  { id:"o6", type:"buy",  ticker:"GTCO",    shares:500, price:52.00,   date:"Apr 3, 2026",  status:"filled" },
  { id:"o7", type:"sell", ticker:"AAPL",    shares:5,   price:198.40,  date:"Mar 28, 2026", status:"filled" },
];

const INIT_WATCHLIST = ["AAPL", "TSLA", "MTNN", "EQUITY", "MSFT"];
const PORTFOLIO_HISTORY = genHistory(12840, 30, 9999);
const PIE_COLORS = ["#22c55e","#e6b800","#3b82f6","#8b5cf6","#f97316","#06b6d4","#f43f5e","#ec4899","#14b8a6"];

// ─── Utilities ─────────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const upColor   = "#22c55e";
const downColor = "#ef4444";
const pctColor  = (v: number) => v >= 0 ? upColor : downColor;
const pctBg     = (v: number) => v >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

// ─── Shared sub-components ─────────────────────────────────────────────────────
function MiniSparkline({ data, up }: { data: { v: number }[]; up: boolean }) {
  return (
    <ResponsiveContainer width={64} height={30}>
      <LineChart data={data}>
        <Line dataKey="v" stroke={up ? upColor : downColor} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Avatar({ stock }: { stock: Stock }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
      style={{ background: stock.color }}>
      {stock.ticker.slice(0, 2)}
    </div>
  );
}

function PctBadge({ v }: { v: number }) {
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap"
      style={{ color: pctColor(v), background: pctBg(v) }}>
      {v >= 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

// ─── Buy / Sell modal ──────────────────────────────────────────────────────────
function TradeModal({ stock, type, cash, onClose, onConfirm }: {
  stock: Stock; type: "buy" | "sell"; cash: number;
  onClose: () => void;
  onConfirm: (shares: number, price: number, type: "buy" | "sell") => void;
}) {
  const [shares, setShares] = useState(1);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitInput, setLimitInput] = useState(stock.price.toFixed(2));
  const [done, setDone] = useState(false);

  const execPrice = orderType === "market" ? stock.price : parseFloat(limitInput) || stock.price;
  const subtotal = shares * execPrice;
  const fee = +(subtotal * 0.001).toFixed(2);
  const grand = type === "buy" ? subtotal + fee : subtotal - fee;
  const canAfford = type === "buy" ? grand <= cash : true;

  function submit() {
    if (!canAfford) return;
    setDone(true);
    setTimeout(() => { onConfirm(shares, execPrice, type); onClose(); }, 1500);
  }

  return (
    <motion.div className="absolute inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.75)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="w-full rounded-t-3xl px-5 pt-5 pb-10 overflow-y-auto"
        style={{ background: "#111827", maxHeight: "88%" }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}>

        {done ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
            <p className="text-white font-bold text-xl">Order Placed!</p>
            <p className="text-gray-400 text-sm">{type === "buy" ? "Bought" : "Sold"} {shares} × {stock.ticker}</p>
          </div>
        ) : <>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Avatar stock={stock} />
              <div>
                <p className="text-white font-bold">{stock.ticker}</p>
                <p className="text-gray-400 text-xs">{stock.name}</p>
              </div>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          {/* Buy/Sell tab */}
          <div className="flex rounded-2xl overflow-hidden mb-5" style={{ background: "#1f2937" }}>
            {(["buy","sell"] as const).map(t => (
              <button key={t}
                className={`flex-1 py-2.5 text-sm font-bold capitalize transition-all ${type===t ? (t==="buy" ? "bg-green-500 text-white" : "bg-red-500 text-white") : "text-gray-500"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div className="flex gap-2 mb-4">
            {(["market","limit"] as const).map(ot => (
              <button key={ot} onClick={() => setOrderType(ot)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all
                  ${orderType===ot ? "border-tsia-green text-tsia-green" : "border-gray-700 text-gray-500"}`}>
                {ot} Order
              </button>
            ))}
          </div>

          {orderType === "limit" && (
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Limit Price</label>
              <Input value={limitInput} onChange={e => setLimitInput(e.target.value)} type="number" step="0.01"
                className="text-sm text-white border-gray-700" style={{ background: "#1f2937" }} />
            </div>
          )}

          {/* Market price */}
          <div className="flex justify-between items-center px-3 py-2.5 rounded-xl mb-4" style={{ background: "#1f2937" }}>
            <span className="text-xs text-gray-400">Market Price</span>
            <span className="text-white font-bold">${fmt(stock.price)}</span>
          </div>

          {/* Quantity */}
          <div className="mb-5">
            <label className="text-xs text-gray-400 mb-2 block">Number of Shares</label>
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => setShares(Math.max(1, shares - 1))}
                className="w-9 h-9 rounded-full border border-gray-600 flex items-center justify-center text-white hover:border-tsia-green transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-white font-black text-2xl w-12 text-center">{shares}</span>
              <button onClick={() => setShares(shares + 1)}
                className="w-9 h-9 rounded-full border border-gray-600 flex items-center justify-center text-white hover:border-tsia-green transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-4 mb-4 space-y-2.5" style={{ background: "#1f2937" }}>
            {[
              ["Subtotal", `$${fmt(subtotal)}`],
              ["Fee (0.1%)", `$${fmt(fee)}`],
              ["Total", `$${fmt(grand)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-xs text-gray-400">{k}</span>
                <span className={`text-xs font-bold ${k === "Total" ? "text-white" : "text-gray-300"}`}>{v}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-xs text-gray-400">Available Cash</span>
              <span className="text-xs font-bold text-green-400">${fmt(cash)}</span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 mb-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" /> Insufficient balance for this order.
            </div>
          )}

          <button onClick={submit} disabled={!canAfford}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-opacity disabled:opacity-40"
            style={{ background: type === "buy" ? upColor : downColor }}
            data-testid="btn-confirm-trade">
            Confirm {type === "buy" ? "Buy" : "Sell"} Order
          </button>
        </>}
      </motion.div>
    </motion.div>
  );
}

// ─── Stock Detail screen ───────────────────────────────────────────────────────
function StockDetail({ stock, inWatchlist, cash, onBack, onToggleWatch, onTrade }: {
  stock: Stock; inWatchlist: boolean; cash: number;
  onBack: () => void; onToggleWatch: () => void;
  onTrade: (type: "buy" | "sell") => void;
}) {
  const [range, setRange] = useState<TimeRange>("1M");
  const history = useMemo(() => historyForRange(stock, range), [stock, range]);
  const isUp = stock.changePercent >= 0;
  const chartColor = isUp ? upColor : downColor;
  const RANGES: TimeRange[] = ["1D","1W","1M","3M","1Y"];

  const stats = [
    { label:"Open",       value: fmt(stock.open)  },
    { label:"High",       value: fmt(stock.high)  },
    { label:"Low",        value: fmt(stock.low)   },
    { label:"Volume",     value: stock.volume     },
    { label:"Market Cap", value: stock.marketCap  },
    { label:"Exchange",   value: stock.exchange   },
  ];

  return (
    <motion.div className="absolute inset-0 overflow-y-auto z-10" style={{ background: "#0a0f1a" }}
      initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
      transition={{ type:"spring", damping:26, stiffness:260 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background:"rgba(255,255,255,0.07)" }}
          data-testid="btn-stock-back">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-bold">{stock.ticker}</p>
          <p className="text-gray-400 text-xs">{stock.exchange}</p>
        </div>
        <button onClick={onToggleWatch}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background:"rgba(255,255,255,0.07)" }}
          data-testid="btn-toggle-watchlist">
          {inWatchlist
            ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            : <StarOff className="w-4 h-4 text-gray-400" />}
        </button>
      </div>

      {/* Price */}
      <div className="px-5 pb-4">
        <p className="text-gray-400 text-sm mb-1">{stock.name}</p>
        <div className="flex items-end gap-3">
          <span className="text-white text-3xl font-black">{fmt(stock.price)}</span>
          <PctBadge v={stock.changePercent} />
        </div>
        <p className="text-sm mt-1 font-semibold" style={{ color: pctColor(stock.changePercent) }}>
          {stock.change >= 0 ? "+" : ""}{fmt(stock.change)} today
        </p>
      </div>

      {/* Area chart */}
      <div className="px-2 pb-2">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={history} margin={{ top:8, right:4, left:-28, bottom:0 }}>
            <defs>
              <linearGradient id={`grad${stock.seed}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={chartColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={["auto","auto"]} tick={{ fill:"#6b7280", fontSize:9 }} axisLine={false} tickLine={false} />
            <RTooltip
              contentStyle={{ background:"#1f2937", border:"none", borderRadius:8, color:"#fff", fontSize:11 }}
              formatter={(v: number) => [`$${fmt(v)}`, stock.ticker]} labelFormatter={() => ""} />
            <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2} fill={`url(#grad${stock.seed})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        {/* Range pills */}
        <div className="flex justify-center gap-1 mt-2">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: range===r ? "var(--color-tsia-green)" : "rgba(255,255,255,0.06)", color: range===r ? "#fff" : "#6b7280" }}
              data-testid={`btn-range-${r}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Key stats */}
      <div className="mx-4 rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3" style={{ background:"#111827" }}>
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <p className="text-gray-500 text-[10px] mb-0.5">{s.label}</p>
            <p className="text-white text-xs font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div className="mx-4 mb-5">
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">About</p>
        <p className="text-gray-300 text-sm leading-relaxed">{stock.description}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{stock.sector}</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{stock.exchange}</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400 capitalize">{stock.region}</Badge>
        </div>
      </div>

      {/* Buy / Sell */}
      <div className="flex gap-3 mx-4 mb-8 pb-4">
        <button onClick={() => onTrade("sell")}
          className="flex-1 py-4 rounded-2xl font-bold text-sm border transition-colors"
          style={{ color: downColor, borderColor: "rgba(239,68,68,0.4)" }}
          data-testid="btn-sell">
          Sell
        </button>
        <button onClick={() => onTrade("buy")}
          className="flex-1 py-4 rounded-2xl font-bold text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: upColor }}
          data-testid="btn-buy">
          Buy Now
        </button>
      </div>
    </motion.div>
  );
}

// ─── Home tab ──────────────────────────────────────────────────────────────────
function HomeTab({ holdings, orders, cash, watchlistSet, onSelectStock, onGoMarket }: {
  holdings: Holding[]; orders: TradeOrder[]; cash: number;
  watchlistSet: Set<string>; onSelectStock: (s: Stock) => void; onGoMarket: () => void;
}) {
  const totalHoldings = holdings.reduce((sum, h) => {
    const s = STOCKS.find(st => st.ticker === h.ticker);
    return sum + (s ? s.price * h.shares : 0);
  }, 0);
  const totalPortfolio = cash + totalHoldings;
  const dayChange = holdings.reduce((sum, h) => {
    const s = STOCKS.find(st => st.ticker === h.ticker);
    return sum + (s ? s.change * h.shares : 0);
  }, 0);
  const dayChangePct = totalHoldings > 0 ? (dayChange / (totalHoldings - Math.abs(dayChange))) * 100 : 0;

  const topMovers = useMemo(() =>
    [...STOCKS].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6),
  []);

  const watchedStocks = STOCKS.filter(s => watchlistSet.has(s.ticker)).slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-5">
      {/* Portfolio card */}
      <div className="rounded-3xl p-5 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg, hsl(142 60% 14%) 0%, hsl(142 52% 24%) 100%)" }}>
        <div className="absolute inset-0" style={{ backgroundImage:"radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />
        <p className="text-green-300/80 text-xs font-medium mb-0.5 relative">Total Portfolio</p>
        <p className="text-white text-3xl font-black relative tracking-tight">${fmt(totalPortfolio)}</p>
        <div className="flex items-center gap-1.5 mt-1 relative">
          {dayChange >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-green-300" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
          <span className={`text-xs font-semibold ${dayChange >= 0 ? "text-green-300" : "text-red-300"}`}>
            {dayChange >= 0 ? "+" : ""}{fmt(dayChange)} ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%) today
          </span>
        </div>
        {/* Sparkline overlay */}
        <div className="mt-2 relative opacity-50">
          <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={PORTFOLIO_HISTORY.slice(-22)}>
              <defs>
                <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgba(255,255,255,0.9)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="rgba(255,255,255,0.1)" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} fill="url(#pfGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Cash / Invested row */}
        <div className="flex justify-between mt-1 pt-2 border-t border-white/10 relative">
          <div>
            <p className="text-green-300/70 text-[10px]">Invested</p>
            <p className="text-white text-sm font-bold">${fmt(totalHoldings)}</p>
          </div>
          <div className="text-right">
            <p className="text-green-300/70 text-[10px]">Cash</p>
            <p className="text-white text-sm font-bold">${fmt(cash)}</p>
          </div>
        </div>
      </div>

      {/* Market overview / indices */}
      <div>
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Market Overview</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {INDICES.map(idx => (
            <div key={idx.name} className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl shrink-0 border"
              style={{ background:"rgba(255,255,255,0.04)", borderColor:"rgba(255,255,255,0.07)" }}>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">{idx.name}</span>
              <span className="text-xs font-black text-white">{idx.value}</span>
              <span className={`text-[10px] font-bold ${idx.up ? "text-green-400":"text-red-400"}`}>{idx.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top movers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Top Movers</p>
          <button onClick={onGoMarket} className="flex items-center gap-0.5 text-xs font-semibold text-tsia-gold">
            See all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {topMovers.map(s => {
            const spark = genHistory(s.price, 12, s.seed + 1);
            return (
              <button key={s.ticker} onClick={() => onSelectStock(s)}
                className="flex flex-col p-3 rounded-2xl shrink-0 w-32 border text-left transition-all hover:border-tsia-green/30"
                style={{ background:"#111827", borderColor:"#1f2937" }}
                data-testid={`card-mover-${s.ticker}`}>
                <div className="flex items-center justify-between mb-2">
                  <Avatar stock={s} />
                  <PctBadge v={s.changePercent} />
                </div>
                <p className="text-white text-xs font-black">{s.ticker}</p>
                <p className="text-gray-500 text-[10px] mb-1.5 truncate">{s.name}</p>
                <MiniSparkline data={spark} up={s.changePercent >= 0} />
                <p className="text-white text-sm font-bold mt-1">{fmt(s.price)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Watchlist preview */}
      {watchedStocks.length > 0 && (
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Your Watchlist</p>
          <div className="space-y-2">
            {watchedStocks.map(s => {
              const spark = genHistory(s.price, 12, s.seed + 2);
              return (
                <button key={s.ticker} onClick={() => onSelectStock(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
                  style={{ background:"#111827", borderColor:"#1f2937" }}
                  data-testid={`row-watchlist-${s.ticker}`}>
                  <Avatar stock={s} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">{s.ticker}</p>
                    <p className="text-gray-500 text-xs truncate">{s.name}</p>
                  </div>
                  <MiniSparkline data={spark} up={s.changePercent >= 0} />
                  <div className="text-right ml-1 shrink-0">
                    <p className="text-white text-sm font-bold">{fmt(s.price)}</p>
                    <PctBadge v={s.changePercent} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {orders.length > 0 && (
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Recent Activity</p>
          <div className="space-y-2">
            {orders.slice(0, 3).map(o => {
              const s = STOCKS.find(st => st.ticker === o.ticker);
              return (
                <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl border"
                  style={{ background:"#111827", borderColor:"#1f2937" }}>
                  {s && <Avatar stock={s} />}
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{o.ticker}</p>
                    <p className="text-gray-500 text-xs">{o.date}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${o.type==="buy" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                      {o.type==="buy" ? "+" : "-"}{o.shares} shares
                    </span>
                    <p className="text-white text-xs mt-0.5">${fmt(o.shares * o.price)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Market tab ────────────────────────────────────────────────────────────────
function MarketTab({ onSelectStock }: { onSelectStock: (s: Stock) => void }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Category>("all");

  const CATS: { id: Category; label: string }[] = [
    { id:"all",     label:"All"        },
    { id:"african", label:"🌍 African"  },
    { id:"us",      label:"🇺🇸 US"      },
    { id:"global",  label:"🌐 Global"   },
  ];

  const filtered = useMemo(() => STOCKS.filter(s => {
    const q = search.toLowerCase();
    return (s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
           (cat === "all" || s.region === cat);
  }), [search, cat]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky search + filters */}
      <div className="px-4 pt-3 pb-2 space-y-2" style={{ background:"#0a0f1a" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search stocks…" data-testid="input-stock-search"
            className="pl-9 text-sm text-white border-0"
            style={{ background:"#111827" }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{ background: cat===c.id ? "var(--color-tsia-green)" : "#111827", color: cat===c.id ? "#fff" : "#6b7280" }}
              data-testid={`filter-${c.id}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column heads */}
      <div className="flex items-center px-5 py-1.5">
        <span className="flex-1 text-[10px] text-gray-600 uppercase tracking-wider font-bold">Stock</span>
        <span className="w-16 text-center text-[10px] text-gray-600 uppercase tracking-wider font-bold">Chart</span>
        <span className="w-24 text-right text-[10px] text-gray-600 uppercase tracking-wider font-bold">Price</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {filtered.map(s => {
          const spark = genHistory(s.price, 14, s.seed + 3);
          return (
            <button key={s.ticker} onClick={() => onSelectStock(s)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
              style={{ background:"#111827", borderColor:"#1f2937" }}
              data-testid={`row-stock-${s.ticker}`}>
              <Avatar stock={s} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-black">{s.ticker}</p>
                <p className="text-gray-500 text-xs truncate">{s.name}</p>
                <span className="text-[10px] text-gray-600">{s.exchange}</span>
              </div>
              <MiniSparkline data={spark} up={s.changePercent >= 0} />
              <div className="text-right shrink-0 ml-1">
                <p className="text-white text-sm font-bold">{fmt(s.price)}</p>
                <PctBadge v={s.changePercent} />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-600">
            <Search className="w-8 h-8" />
            <p className="text-sm">No stocks found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Portfolio tab ─────────────────────────────────────────────────────────────
function PortfolioTab({ holdings, cash, onSelectStock }: {
  holdings: Holding[]; cash: number; onSelectStock: (s: Stock) => void;
}) {
  const enriched = useMemo(() => holdings.map(h => {
    const s = STOCKS.find(st => st.ticker === h.ticker)!;
    const value = s.price * h.shares;
    const cost  = h.avgPrice * h.shares;
    const pnl   = value - cost;
    const pnlPct = ((s.price - h.avgPrice) / h.avgPrice) * 100;
    return { ...h, stock: s, value, cost, pnl, pnlPct };
  }), [holdings]);

  const totalValue    = enriched.reduce((a, b) => a + b.value, 0);
  const totalCost     = enriched.reduce((a, b) => a + b.cost,  0);
  const totalPnl      = totalValue - totalCost;
  const totalPnlPct   = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const pieData = enriched.map((h, i) => ({ name: h.ticker, value: h.value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
      {/* Summary card */}
      <div className="rounded-3xl p-5 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg, hsl(142 60% 14%) 0%, hsl(142 52% 24%) 100%)" }}>
        <div className="absolute inset-0" style={{ backgroundImage:"radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 60%)" }} />
        <p className="text-green-300/80 text-xs mb-0.5 relative">Portfolio Value</p>
        <p className="text-white text-3xl font-black relative">${fmt(totalValue + cash)}</p>
        <div className="flex items-center gap-1.5 mt-1 relative">
          {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-300" /> : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
          <span className={`text-xs font-semibold ${totalPnl >= 0 ? "text-green-300":"text-red-300"}`}>
            {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)} ({totalPnlPct.toFixed(2)}%) all time
          </span>
        </div>
        <div className="flex justify-between mt-3 pt-3 border-t border-white/10 relative">
          <div><p className="text-green-300/70 text-[10px]">Invested</p><p className="text-white font-bold">${fmt(totalValue)}</p></div>
          <div className="text-center"><p className="text-green-300/70 text-[10px]">Cash</p><p className="text-white font-bold">${fmt(cash)}</p></div>
          <div className="text-right"><p className="text-green-300/70 text-[10px]">P&L</p>
            <p className={`font-bold ${totalPnl >= 0 ? "text-green-300":"text-red-300"}`}>{totalPnl >= 0 ? "+":""}{fmt(totalPnl)}</p>
          </div>
        </div>
      </div>

      {/* Allocation chart */}
      {enriched.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background:"#111827" }}>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-3">Allocation</p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background:d.color }} />
                  <span className="text-gray-300 text-xs flex-1">{d.name}</span>
                  <span className="text-white text-xs font-bold">{((d.value / totalValue) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holdings list */}
      <div>
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Holdings</p>
        {enriched.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-gray-600">
            <Briefcase className="w-10 h-10" />
            <p className="text-sm">No holdings yet — buy some stocks!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map(h => (
              <button key={h.ticker} onClick={() => onSelectStock(h.stock)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all hover:border-tsia-green/30"
                style={{ background:"#111827", borderColor:"#1f2937" }}
                data-testid={`row-holding-${h.ticker}`}>
                <Avatar stock={h.stock} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-black">{h.ticker}</p>
                  <p className="text-gray-500 text-xs">{h.shares} shares · avg ${fmt(h.avgPrice)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-bold">${fmt(h.value)}</p>
                  <span className="text-xs font-semibold" style={{ color: pctColor(h.pnlPct) }}>
                    {h.pnl >= 0 ? "+" : ""}{fmt(h.pnl)} ({h.pnlPct.toFixed(2)}%)
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Watchlist tab ─────────────────────────────────────────────────────────────
function WatchlistTab({ watchlistSet, onSelectStock, onRemove, onTrade }: {
  watchlistSet: Set<string>; onSelectStock: (s: Stock) => void;
  onRemove: (t: string) => void; onTrade: (s: Stock, type: "buy"|"sell") => void;
}) {
  const watched = STOCKS.filter(s => watchlistSet.has(s.ticker));

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
      {watched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Star className="w-12 h-12 text-gray-700" />
          <p className="text-gray-400 font-semibold">Watchlist is empty</p>
          <p className="text-gray-600 text-sm">Tap ☆ on any stock to add it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {watched.map(s => {
            const spark = genHistory(s.price, 14, s.seed + 4);
            return (
              <div key={s.ticker} className="rounded-2xl border overflow-hidden"
                style={{ background:"#111827", borderColor:"#1f2937" }}>
                <button onClick={() => onSelectStock(s)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  data-testid={`row-watch-${s.ticker}`}>
                  <Avatar stock={s} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-black">{s.ticker}</p>
                    <p className="text-gray-500 text-xs truncate">{s.name}</p>
                  </div>
                  <MiniSparkline data={spark} up={s.changePercent >= 0} />
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-white text-sm font-bold">{fmt(s.price)}</p>
                    <PctBadge v={s.changePercent} />
                  </div>
                </button>
                <div className="flex border-t" style={{ borderColor:"#1f2937" }}>
                  <button onClick={() => onRemove(s.ticker)}
                    className="flex-1 py-2 text-xs text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center gap-1">
                    <StarOff className="w-3 h-3" /> Remove
                  </button>
                  <div className="w-px" style={{ background:"#1f2937" }} />
                  <button onClick={() => onTrade(s, "buy")}
                    className="flex-1 py-2 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors">
                    Buy
                  </button>
                  <div className="w-px" style={{ background:"#1f2937" }} />
                  <button onClick={() => onTrade(s, "sell")}
                    className="flex-1 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors">
                    Sell
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab({ orders }: { orders: TradeOrder[] }) {
  const [filter, setFilter] = useState<"all"|"buy"|"sell">("all");
  const filtered = orders.filter(o => filter === "all" || o.type === filter);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex gap-2" style={{ background:"#0a0f1a" }}>
        {(["all","buy","sell"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all"
            style={{ background: filter===f ? "var(--color-tsia-green)" : "#111827", color: filter===f ? "#fff" : "#6b7280" }}
            data-testid={`filter-orders-${f}`}>
            {f === "all" ? "All Orders" : f === "buy" ? "Buys" : "Sells"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(o => {
          const s = STOCKS.find(st => st.ticker === o.ticker);
          return (
            <div key={o.id} className="flex items-center gap-3 p-3 rounded-2xl border"
              style={{ background:"#111827", borderColor:"#1f2937" }}
              data-testid={`row-order-${o.id}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${o.type==="buy" ? "bg-green-400/12" : "bg-red-400/12"}`}>
                {o.type === "buy"
                  ? <TrendingUp   className="w-4 h-4 text-green-400" />
                  : <TrendingDown className="w-4 h-4 text-red-400"   />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-black">{o.ticker}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${o.type==="buy" ? "bg-green-400/12 text-green-400" : "bg-red-400/12 text-red-400"}`}>
                    {o.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-500 text-xs">{o.shares} shares @ ${fmt(o.price)}</p>
                <p className="text-gray-700 text-[10px]">{o.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white text-sm font-bold">${fmt(o.shares * o.price)}</p>
                <span className="text-[10px] text-green-400 flex items-center justify-end gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {o.status}
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2 text-gray-600">
            <List className="w-8 h-8" />
            <p className="text-sm">No {filter} orders</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
interface ExchangeMarketProps { walletBalance?: number; }

export default function ExchangeMarket({ walletBalance = 0 }: ExchangeMarketProps) {
  const [tab, setTab]               = useState<Tab>("home");
  const [selected, setSelected]     = useState<Stock | null>(null);
  const [tradeModal, setTradeModal]  = useState<{ stock: Stock; type: "buy"|"sell" } | null>(null);
  const [watchlist, setWatchlist]   = useState(new Set<string>(INIT_WATCHLIST));
  const [holdings, setHoldings]     = useState<Holding[]>(INIT_HOLDINGS);
  const [orders, setOrders]         = useState<TradeOrder[]>(INIT_ORDERS);
  const [cash, setCash]             = useState(walletBalance > 0 ? walletBalance : 2340.50);

  const toggleWatch = useCallback((ticker: string) =>
    setWatchlist(prev => { const n = new Set(prev); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n; })
  , []);

  const confirmTrade = useCallback((shares: number, price: number, type: "buy"|"sell", ticker: string) => {
    const subtotal = shares * price;
    const fee = subtotal * 0.001;
    if (type === "buy") {
      setCash(c => c - subtotal - fee);
      setHoldings(prev => {
        const idx = prev.findIndex(h => h.ticker === ticker);
        if (idx >= 0) {
          const h = prev[idx];
          const ns = h.shares + shares;
          return prev.map((h2, i) => i === idx ? { ...h2, shares: ns, avgPrice: (h.avgPrice * h.shares + price * shares) / ns } : h2);
        }
        return [...prev, { ticker, shares, avgPrice: price }];
      });
    } else {
      setCash(c => c + subtotal - fee);
      setHoldings(prev => prev.map(h => h.ticker === ticker ? { ...h, shares: Math.max(0, h.shares - shares) } : h).filter(h => h.shares > 0));
    }
    setOrders(prev => [{
      id: `o${Date.now()}`, type, ticker, shares, price, status: "filled",
      date: new Date().toLocaleDateString("en", { month:"short", day:"numeric", year:"numeric" }),
    }, ...prev]);
  }, []);

  const TABS = [
    { id:"home"      as Tab, Icon: Home,     label:"Home"      },
    { id:"market"    as Tab, Icon: BarChart3, label:"Market"    },
    { id:"portfolio" as Tab, Icon: Briefcase, label:"Portfolio" },
    { id:"watchlist" as Tab, Icon: Star,      label:"Watchlist" },
    { id:"orders"    as Tab, Icon: List,      label:"Orders"    },
  ];

  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden border border-gray-800"
      style={{ background:"#0a0f1a", height:"calc(100vh - 140px)", minHeight:560, maxHeight:820 }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b" style={{ borderColor:"#1f2937" }}>
        <div>
          <h2 className="text-white font-black text-base tracking-tight">Exchange Market</h2>
          <p className="text-gray-600 text-[10px]">Live stock trading · {STOCKS.length} instruments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-1">
            <p className="text-gray-600 text-[10px]">Cash</p>
            <p className="text-white text-xs font-black">${fmt(cash)}</p>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"#111827" }}
            data-testid="btn-notifications">
            <Bell className="w-4 h-4 text-gray-500" />
          </button>
          <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"#111827" }}
            data-testid="btn-refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {tab === "home" && (
          <HomeTab holdings={holdings} orders={orders} cash={cash} watchlistSet={watchlist}
            onSelectStock={setSelected} onGoMarket={() => setTab("market")} />
        )}
        {tab === "market" && (
          <MarketTab onSelectStock={setSelected} />
        )}
        {tab === "portfolio" && (
          <PortfolioTab holdings={holdings} cash={cash} onSelectStock={setSelected} />
        )}
        {tab === "watchlist" && (
          <WatchlistTab watchlistSet={watchlist} onSelectStock={setSelected}
            onRemove={toggleWatch}
            onTrade={(s, type) => setTradeModal({ stock: s, type })} />
        )}
        {tab === "orders" && (
          <OrdersTab orders={orders} />
        )}

        {/* Stock detail overlay */}
        <AnimatePresence>
          {selected && (
            <StockDetail key={selected.ticker} stock={selected}
              inWatchlist={watchlist.has(selected.ticker)} cash={cash}
              onBack={() => setSelected(null)}
              onToggleWatch={() => toggleWatch(selected.ticker)}
              onTrade={type => setTradeModal({ stock: selected, type })} />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center border-t shrink-0 px-1 py-1" style={{ borderColor:"#1f2937", background:"#0a0f1a" }}>
        {TABS.map(({ id, Icon, label }) => {
          const active = tab === id && !selected;
          return (
            <button key={id} onClick={() => { setTab(id); setSelected(null); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-all"
              data-testid={`tab-${id}`}>
              <Icon className="w-5 h-5 transition-colors" style={{ color: active ? "var(--color-tsia-green)" : "#374151" }} />
              <span className="text-[10px] font-bold transition-colors"
                style={{ color: active ? "var(--color-tsia-green)" : "#374151" }}>{label}</span>
              {active && <div className="w-1 h-1 rounded-full" style={{ background:"var(--color-tsia-green)" }} />}
            </button>
          );
        })}
      </div>

      {/* Trade modal portal */}
      <AnimatePresence>
        {tradeModal && (
          <TradeModal key="modal" stock={tradeModal.stock} type={tradeModal.type} cash={cash}
            onClose={() => setTradeModal(null)}
            onConfirm={(shares, price, type) => {
              confirmTrade(shares, price, type, tradeModal.stock.ticker);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}
