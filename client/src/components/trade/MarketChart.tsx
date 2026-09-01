import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { BarChart3, RefreshCw } from "lucide-react";

export type MarketChartTimeframe = "1m" | "5m" | "15m" | "1h";

type MarketCandle = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type CandleResponse = {
  candles: MarketCandle[];
  lastUpdated?: string;
  stale?: boolean;
};

type MarketChartProps = {
  symbol: string;
  timeframe?: MarketChartTimeframe;
  onTimeframeChange?: (timeframe: MarketChartTimeframe) => void;
  className?: string;
};

const TIMEFRAMES: MarketChartTimeframe[] = ["1m", "5m", "15m", "1h"];

function toTimestamp(time: MarketCandle["time"]): UTCTimestamp | null {
  const milliseconds = typeof time === "number"
    ? (time < 10_000_000_000 ? time * 1000 : time)
    : Date.parse(time);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) as UTCTimestamp : null;
}

function formatUpdated(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function MarketChart({
  symbol,
  timeframe: controlledTimeframe,
  onTimeframeChange,
  className = "",
}: MarketChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<MarketChartTimeframe>("5m");
  const timeframe = controlledTimeframe ?? internalTimeframe;
  const [response, setResponse] = useState<CandleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartHost = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  const changeTimeframe = (next: MarketChartTimeframe) => {
    if (!controlledTimeframe) setInternalTimeframe(next);
    onTimeframeChange?.(next);
  };

  const load = async (manual = false) => {
    if (!symbol) return;
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetch(`/api/trade/market-candles?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!result.ok) throw new Error(`Market feed unavailable (${result.status})`);
      const payload = await result.json() as CandleResponse;
      setResponse(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load market candles.");
      setResponse(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [symbol, timeframe]);

  useEffect(() => {
    const host = chartHost.current;
    if (!host || loading || error || !response?.candles?.length) return;

    const nextChart = createChart(host, {
      width: host.clientWidth,
      height: 400,
      layout: { background: { type: ColorType.Solid, color: "#09131a" }, textColor: "#82929a", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      grid: { vertLines: { color: "rgba(130, 146, 154, 0.07)" }, horzLines: { color: "rgba(130, 146, 154, 0.07)" } },
      rightPriceScale: { borderColor: "rgba(130, 146, 154, 0.18)", textColor: "#82929a", scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: "rgba(130, 146, 154, 0.18)", timeVisible: true, secondsVisible: timeframe === "1m", rightOffset: 4, barSpacing: 8 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(215,182,106,.6)", labelBackgroundColor: "#8a7342" }, horzLine: { color: "rgba(215,182,106,.6)", labelBackgroundColor: "#8a7342" } },
      handleScroll: true,
      handleScale: true,
    });
    const candles = response.candles
      .map(candle => ({ ...candle, time: toTimestamp(candle.time) }))
      .filter((candle): candle is MarketCandle & { time: UTCTimestamp } =>
        candle.time !== null && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
      .sort((a, b) => a.time - b.time)
      .filter((candle, index, values) => index === 0 || candle.time !== values[index - 1].time);
    const series = nextChart.addSeries(CandlestickSeries, {
      upColor: "#36b37e", downColor: "#e36b75", borderVisible: false,
      wickUpColor: "#56d39a", wickDownColor: "#f28b92",
    });
    series.setData(candles.map(candle => ({ time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close })));
    if (candles.some(candle => Number.isFinite(candle.volume) && Number(candle.volume) > 0)) {
      const volume = nextChart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", lastValueVisible: false, priceLineVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      volume.setData(candles.map(candle => ({ time: candle.time, value: Number(candle.volume ?? 0), color: candle.close >= candle.open ? "rgba(34,197,94,.32)" : "rgba(244,63,94,.32)" })));
    }
    nextChart.timeScale().fitContent();
    chart.current = nextChart;
    const resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) nextChart.applyOptions({ width });
    });
    resizeObserver.observe(host);
    return () => {
      resizeObserver.disconnect();
      nextChart.remove();
      chart.current = null;
    };
  }, [response, loading, error, timeframe]);

  const candles = response?.candles ?? [];
  const isEmpty = !loading && !error && candles.length === 0;
  const updated = formatUpdated(response?.lastUpdated);

  return (
    <section className={`overflow-hidden rounded-xl border border-foreground/10 bg-[#09131a] shadow-[0_18px_45px_rgba(2,6,23,.22)] ${className}`} data-testid="market-chart">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] bg-[#0d1921] px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#d7b66a]" />
          <span className={`h-1.5 w-1.5 rounded-full ${response?.stale ? "bg-amber-400" : error ? "bg-rose-400" : "bg-emerald-400"}`} />
          <span className="text-xs font-black tracking-wide text-slate-100">{symbol}</span>
          <span className={`text-[10px] font-bold ${response?.stale ? "text-amber-300" : "text-slate-500"}`}>{response?.stale ? "Delayed feed" : updated ? `Updated ${updated}` : "Live market"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-white/10 bg-white/[.035] p-0.5">
             {TIMEFRAMES.map(option => <button key={option} type="button" onClick={() => changeTimeframe(option)} aria-pressed={timeframe === option} className={`rounded-md px-2.5 py-1.5 text-[10px] font-black transition-colors ${timeframe === option ? "bg-[#d7b66a] text-[#152029]" : "text-slate-500 hover:text-white"}`}>{option}</button>)}
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Refresh market chart">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
       <div className="relative min-h-[400px]">
         {!loading && !error && !isEmpty && <div ref={chartHost} className="h-[400px] w-full cursor-crosshair" aria-label={`${symbol} candlestick chart. Scroll or drag to zoom and pan.`} />}
         {loading && <div className="absolute inset-0 flex flex-col justify-center gap-3 px-6"><div className="h-3 w-32 animate-pulse rounded bg-white/10" /><div className="h-56 animate-pulse rounded bg-white/[.025]" /><div className="h-3 w-48 animate-pulse rounded bg-white/10" /></div>}
         {(error || isEmpty) && <div className="flex h-[400px] items-center justify-center px-6 text-center text-sm text-slate-400">
           {error ? <div><p className="font-semibold text-rose-300">{error}</p><button type="button" onClick={() => void load(true)} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/10">Try again</button></div> : "No candle data is available for this market and timeframe."}
        </div>}
      </div>
      {response?.stale && <div className="border-t border-amber-400/15 bg-amber-400/[.06] px-4 py-2 text-[10px] font-medium text-amber-200">Showing the latest available candles. The market feed is currently delayed.</div>}
    </section>
  );
}