import { useMemo, useState, type PointerEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Clock3,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
  WalletCards,
} from "lucide-react";
import { apiRequest, parseApiError, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Timeframe = "1m" | "5m" | "15m" | "1h";

type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Market = {
  symbol: string;
  label: string;
  name: string;
  category: string;
  price: number | null;
  changePct: number;
  active: boolean;
};

type BotPosition = {
  active: boolean;
  symbol: string;
  symbolLabel: string;
  marketName: string;
  category: string;
  entryPrice: number;
  currentPrice: number;
  sessionHigh: number | null;
  sessionLow: number | null;
  size: number;
  baseSize: number;
  sizeMultiplier: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  elapsedHours: number;
  sessionStartedAt: string;
  sessionEndsAt: string;
  direction: "long" | "short";
  timeframe: Timeframe;
  candles: Candle[];
  markets: Market[];
  lastUpdated: string;
};

const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h"];

function formatPrice(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return "—";
  const digits = value >= 1000 ? 2 : value >= 10 ? 3 : 5;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function LiveChart({ candles, currentPrice }: { candles: Candle[]; currentPrice: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const usable = candles.filter(c => c.high > 0 && c.low > 0).slice(-64);
    if (usable.length < 2) return null;
    const minimum = Math.min(...usable.map(c => c.low));
    const maximum = Math.max(...usable.map(c => c.high));
    const padding = Math.max((maximum - minimum) * 0.1, maximum * 0.0005);
    const min = minimum - padding;
    const max = maximum + padding;
    const width = 1000;
    const height = 350;
    const chartRight = 906;
    const chartTop = 20;
    const chartBottom = 312;
    const priceY = (value: number) => chartTop + ((max - value) / Math.max(max - min, 0.000001)) * (chartBottom - chartTop);
    const step = chartRight / Math.max(usable.length, 1);
    const x = (index: number) => index * step + step / 2;
    const linePoints = usable.map((c, index) => `${x(index)},${priceY(c.close)}`).join(" ");
    return { usable, min, max, width, height, chartRight, chartTop, chartBottom, priceY, step, x, linePoints };
  }, [candles]);

  if (!geometry) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-sm text-slate-500">
        Waiting for live market candles…
      </div>
    );
  }

  const { usable, min, max, width, height, chartRight, chartTop, chartBottom, priceY, step, x, linePoints } = geometry;
  const lastY = priceY(currentPrice || usable[usable.length - 1].close);
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeCandle = activeIndex === null ? null : usable[activeIndex] ?? null;
  const candleIndexAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = Math.max(0, Math.min(chartRight, ((event.clientX - bounds.left) / bounds.width) * width));
    return Math.max(0, Math.min(usable.length - 1, Math.round((chartX - step / 2) / step)));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07111f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_25%,rgba(16,185,129,.08),transparent_35%)]" />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="relative h-[320px] w-full cursor-crosshair touch-none sm:h-[390px]"
        preserveAspectRatio="none"
        role="img"
        aria-label="Live Itera market chart. Move across the chart to inspect candle values."
        data-testid="itera-live-chart"
        onPointerMove={event => setHoveredIndex(candleIndexAtPointer(event))}
        onPointerDown={event => {
          const index = candleIndexAtPointer(event);
          setHoveredIndex(index);
          setSelectedIndex(index);
        }}
        onPointerLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="itera-line-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <filter id="itera-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {[0, 1, 2, 3, 4, 5].map(index => {
          const y = chartTop + ((chartBottom - chartTop) / 5) * index;
          const value = max - ((max - min) / 5) * index;
          return (
            <g key={index}>
              <line x1="0" y1={y} x2={chartRight} y2={y} stroke="#233044" strokeWidth="1" strokeDasharray="4 5" />
              <text x="920" y={y + 4} fill="#64748b" fontSize="15">{formatPrice(value)}</text>
            </g>
          );
        })}
        {usable.filter((_, index) => index % Math.max(1, Math.floor(usable.length / 6)) === 0).map((candle, index) => {
          const originalIndex = usable.indexOf(candle);
          const candleX = x(originalIndex);
          return (
            <g key={candle.time}>
              <line x1={candleX} y1={chartTop} x2={candleX} y2={chartBottom} stroke="#182538" strokeWidth="1" />
              <text x={candleX} y="338" fill="#64748b" fontSize="13" textAnchor="middle">
                {new Date(candle.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </text>
            </g>
          );
        })}
        <polygon points={`0,${chartBottom} ${linePoints} ${chartRight},${chartBottom}`} fill="url(#itera-line-glow)" />
        {usable.map((candle, index) => {
          const candleX = x(index);
          const rising = candle.close >= candle.open;
          const color = rising ? "#22c55e" : "#ef4444";
          const bodyTop = priceY(Math.max(candle.open, candle.close));
          const bodyBottom = priceY(Math.min(candle.open, candle.close));
          return (
            <g key={`${candle.time}-${index}`}>
              <line x1={candleX} y1={priceY(candle.high)} x2={candleX} y2={priceY(candle.low)} stroke={color} strokeWidth="1.5" opacity="0.85" />
              <rect
                x={candleX - Math.max(2, step * 0.23)}
                y={bodyTop}
                width={Math.max(4, step * 0.46)}
                height={Math.max(2, bodyBottom - bodyTop)}
                rx="1"
                fill={rising ? color : "#07111f"}
                stroke={color}
                strokeWidth="1.5"
                opacity="0.9"
              />
            </g>
          );
        })}
        <polyline points={linePoints} fill="none" stroke="#34d399" strokeWidth="2.2" opacity="0.8" filter="url(#itera-glow)" />
        <line x1="0" y1={lastY} x2={chartRight} y2={lastY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="7 5" />
        <rect x="910" y={lastY - 13} width="87" height="26" rx="5" fill="#d97706" />
        <text x="953" y={lastY + 5} fill="white" fontSize="14" fontWeight="700" textAnchor="middle">{formatPrice(currentPrice)}</text>
        {activeCandle && activeIndex !== null && (
          <>
            <line x1={x(activeIndex)} y1={chartTop} x2={x(activeIndex)} y2={chartBottom} stroke="#f8fafc" strokeWidth="1" strokeDasharray="3 4" opacity="0.65" />
            <circle cx={x(activeIndex)} cy={priceY(activeCandle.close)} r="4" fill="#f8fafc" stroke="#10b981" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-emerald-400/20 bg-slate-950/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300 backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live feed
      </div>
      {activeCandle && (
        <div
          className="pointer-events-none absolute top-4 z-10 min-w-32 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-[10px] shadow-xl backdrop-blur"
          style={{ left: `${Math.min(72, Math.max(4, ((activeIndex ?? 0) / Math.max(usable.length - 1, 1)) * 86))}%` }}
          data-testid="itera-candle-tooltip"
        >
          <p className="mb-1 font-bold text-emerald-300">
            {new Date(activeCandle.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-slate-300">
            <span>O {formatPrice(activeCandle.open)}</span>
            <span>H {formatPrice(activeCandle.high)}</span>
            <span>L {formatPrice(activeCandle.low)}</span>
            <span>C {formatPrice(activeCandle.close)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BotLiveView() {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const { data, isLoading, isFetching, error, refetch } = useQuery<BotPosition>({
    queryKey: ["/api/trade/bot-position", timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/trade/bot-position?timeframe=${timeframe}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      return response.json();
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const invalidateLivePosition = () => queryClient.invalidateQueries({
    predicate: query => String(query.queryKey[0]).startsWith("/api/trade/bot-position"),
  });

  const control = useMutation({
    mutationFn: async (action: "double_down" | "reverse") => {
      const response = await apiRequest("POST", "/api/trade/bot-position/override", { action });
      return response.json();
    },
    onSuccess: (result: any) => {
      toast({ title: "Itera position updated", description: result.message, className: "border-emerald-500" });
      invalidateLivePosition();
    },
    onError: error => toast({ title: "Control failed", description: parseApiError(error), variant: "destructive" }),
  });

  const closePosition = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/trade/bot/complete", {});
      return response.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Itera session closed",
        description: `${Number(result.earning) >= 0 ? "Earnings" : "Loss"}: $${Math.abs(Number(result.earning ?? 0)).toFixed(4)}. Your wallet has been settled.`,
        className: Number(result.earning) >= 0 ? "border-emerald-500" : undefined,
      });
      invalidateLivePosition();
      queryClient.invalidateQueries({ queryKey: ["/api/trade/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trade/transactions"] });
    },
    onError: error => toast({ title: "Could not close session", description: parseApiError(error), variant: "destructive" }),
  });

  if (isLoading) return <div className="h-[620px] animate-pulse rounded-[2rem] bg-slate-900/80" />;

  if (error) {
    return (
      <div className="rounded-[2rem] border border-rose-400/20 bg-slate-950 p-10 text-center text-white">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h2 className="font-black">Live desk unavailable</h2>
        <p className="mt-1 text-sm text-slate-400">{parseApiError(error)}</p>
        <button onClick={() => invalidateLivePosition()} className="mt-5 rounded-xl bg-white/10 px-5 py-2 text-sm font-bold hover:bg-white/15">Try again</button>
      </div>
    );
  }

  if (!data?.active) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f] p-10 text-center text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,.18),transparent_45%)]" />
        <div className="relative">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("tsia:open-trade-mode-wallet", { detail: { mode: "bot" } }))}
            className="absolute right-0 top-0 flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20"
            data-testid="itera-bot-wallet-inactive"
          >
            <WalletCards className="h-4 w-4" /> Itera Wallet
          </button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
            <Bot className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black">Itera live desk is offline</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Activate the Itera Trading BOT from Overview. Your rotating live market, chart and position controls will appear here immediately.</p>
        </div>
      </div>
    );
  }

  const positive = data.unrealizedPnl >= 0;
  const sessionProgress = Math.min(100, (data.elapsedHours / 12) * 100);
  const busy = control.isPending || closePosition.isPending;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#050b14] text-white shadow-[0_28px_90px_rgba(2,6,23,.5)]" data-testid="itera-live-workspace">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-[#0a1322] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight sm:text-lg">Itera Live Trading Desk</h1>
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">Active</span>
            </div>
            <p className="text-[11px] text-slate-500">Automated multi-market execution · Session pair rotates daily</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("tsia:open-trade-mode-wallet", { detail: { mode: "bot" } }))}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20"
            data-testid="itera-bot-wallet"
          >
            <WalletCards className="h-4 w-4" /> Wallet
          </button>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-white/5"
              aria-label="Refresh live market data"
              data-testid="itera-refresh-live-data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">Updated {new Date(data.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="order-3 border-t border-white/10 bg-[#08111e] p-4 lg:order-1 lg:border-r lg:border-t-0" data-testid="itera-market-list">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.15em] text-slate-300">Markets in play</p>
              <p className="mt-0.5 text-[10px] text-slate-600">{data.markets.length} monitored pairs</p>
            </div>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {data.markets.map(market => {
              const gaining = market.changePct >= 0;
              return (
                <div key={market.symbol} className={`rounded-xl border px-3 py-3 transition-colors ${market.active ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/5 bg-white/[.025]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {market.active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                        <p className="text-xs font-black">{market.label}</p>
                      </div>
                      <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-600">{market.category}</p>
                    </div>
                    <span className={`flex items-center text-[10px] font-bold ${gaining ? "text-emerald-400" : "text-rose-400"}`}>
                      {gaining ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {gaining ? "+" : ""}{market.changePct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs font-bold text-slate-300">{formatPrice(market.price)}</p>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="order-1 min-w-0 p-3 sm:p-5 lg:order-2">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight">{data.symbolLabel}</h2>
                <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${data.direction === "long" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
                  {data.direction}
                </span>
                {data.sizeMultiplier > 1 && <span className="rounded-md bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-300">2× exposure</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-2xl font-black">{formatPrice(data.currentPrice)}</span>
                <span className={`flex items-center gap-1 text-sm font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                  {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {positive ? "+" : ""}{data.unrealizedPnlPct.toFixed(3)}%
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-600">{data.marketName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[.035] p-1">
              {timeframes.map(option => (
                <button
                  key={option}
                  onClick={() => setTimeframe(option)}
                  type="button"
                  aria-pressed={timeframe === option}
                  className={`rounded-lg px-3 py-2 text-[11px] font-black transition-colors ${timeframe === option ? "bg-emerald-500 text-white" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}
                  data-testid={`itera-timeframe-${option}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <LiveChart candles={data.candles ?? []} currentPrice={data.currentPrice} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Day high</p>
              <p className="mt-1 font-mono text-xs font-bold">{formatPrice(data.sessionHigh)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Day low</p>
              <p className="mt-1 font-mono text-xs font-bold">{formatPrice(data.sessionLow)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Feed</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-400"><Zap className="h-3 w-3" /> Streaming</p>
            </div>
          </div>
        </main>

        <aside className="order-2 border-t border-white/10 bg-[#08111e] p-4 lg:order-3 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.15em] text-slate-300">Open position</p>
              <p className="mt-0.5 text-[10px] text-slate-600">Server-validated session</p>
            </div>
            <Gauge className="h-4 w-4 text-amber-400" />
          </div>

          <div className={`rounded-2xl border p-4 ${positive ? "border-emerald-400/20 bg-emerald-400/[.06]" : "border-rose-400/20 bg-rose-400/[.06]"}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-black">{data.symbolLabel}</p>
                <p className={`mt-0.5 text-[10px] font-black uppercase tracking-widest ${data.direction === "long" ? "text-emerald-400" : "text-rose-400"}`}>{data.direction} position</p>
              </div>
              <Sparkles className={`h-5 w-5 ${positive ? "text-emerald-400" : "text-rose-400"}`} />
            </div>
            <div className="mt-5">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Unrealized P&amp;L</p>
              <p className={`mt-1 text-2xl font-black ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                {positive ? "+" : "-"}${Math.abs(data.unrealizedPnl).toFixed(4)}
              </p>
              <p className={`text-xs font-bold ${positive ? "text-emerald-400/70" : "text-rose-400/70"}`}>{positive ? "+" : ""}{data.unrealizedPnlPct.toFixed(3)}%</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/5 bg-white/[.025] p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Entry</p>
              <p className="mt-1 font-mono text-xs font-bold">{formatPrice(data.entryPrice)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[.025] p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">Position size</p>
              <p className="mt-1 text-xs font-bold">${data.size.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-slate-500"><Clock3 className="h-3 w-3" /> Session progress</span>
              <span className="font-bold text-slate-300">{data.elapsedHours.toFixed(1)}h / 12h</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all" style={{ width: `${sessionProgress}%` }} />
            </div>
            <p className="mt-2 text-[9px] text-slate-600">Ends {new Date(data.sessionEndsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>

          <div className="mt-5 space-y-2">
            <button
              onClick={() => window.confirm("Increase this live position to the 2× session limit? Wallet settlement rules will not change.") && control.mutate("double_down")}
              disabled={busy || data.sizeMultiplier >= 2}
              className="flex w-full items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="itera-control-double-down"
            >
              <span>Increase to 2×</span>
              {control.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            </button>
            <button
              onClick={() => window.confirm(`Reverse this position from ${data.direction.toUpperCase()} to ${data.direction === "long" ? "SHORT" : "LONG"}?`) && control.mutate("reverse")}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-left text-xs font-bold text-sky-200 transition-colors hover:bg-sky-400/15 disabled:opacity-40"
              data-testid="itera-control-reverse"
            >
              <span>Reverse position</span>
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.confirm("Close the Itera session now? Earnings or loss will be settled immediately using the session rules.") && closePosition.mutate()}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-left text-xs font-bold text-rose-200 transition-colors hover:bg-rose-400/15 disabled:opacity-40"
              data-testid="itera-control-close"
            >
              <span>Close &amp; settle session</span>
              {closePosition.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-4 flex gap-2 rounded-xl border border-white/5 bg-white/[.025] p-3 text-[9px] leading-4 text-slate-500">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            Live controls change the displayed session strategy only. Closing the session uses the existing audited wallet settlement flow.
          </div>
        </aside>
      </div>
    </div>
  );
}