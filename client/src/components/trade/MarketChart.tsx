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
import { RefreshCw } from "lucide-react";

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
      height: 360,
      layout: { background: { type: ColorType.Solid, color: "#07111f" }, textColor: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      grid: { vertLines: { color: "rgba(148, 163, 184, 0.08)" }, horzLines: { color: "rgba(148, 163, 184, 0.08)" } },
      rightPriceScale: { borderColor: "rgba(148, 163, 184, 0.16)" },
      timeScale: { borderColor: "rgba(148, 163, 184, 0.16)", timeVisible: true, secondsVisible: timeframe === "1m" },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(226,232,240,.42)", labelBackgroundColor: "#334155" }, horzLine: { color: "rgba(226,232,240,.42)", labelBackgroundColor: "#334155" } },
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
      upColor: "#22c55e", downColor: "#f43f5e", borderVisible: false,
      wickUpColor: "#34d399", wickDownColor: "#fb7185",
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
    <section className={`overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] shadow-[0_18px_45px_rgba(2,6,23,.3)] ${className}`} data-testid="market-chart">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0a1322] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${response?.stale ? "bg-amber-400" : error ? "bg-rose-400" : "bg-emerald-400"}`} />
          <span className="text-xs font-black text-slate-100">{symbol}</span>
          <span className={`text-[10px] font-bold ${response?.stale ? "text-amber-300" : "text-slate-500"}`}>{response?.stale ? "Delayed feed" : updated ? `Updated ${updated}` : "Live market"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-white/10 bg-white/[.035] p-0.5">
            {TIMEFRAMES.map(option => <button key={option} type="button" onClick={() => changeTimeframe(option)} aria-pressed={timeframe === option} className={`rounded-md px-2.5 py-1.5 text-[10px] font-black ${timeframe === option ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-white"}`}>{option}</button>)}
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Refresh market chart">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="relative min-h-[360px]">
        {!loading && !error && !isEmpty && <div ref={chartHost} className="h-[360px] w-full cursor-crosshair" aria-label={`${symbol} candlestick chart. Scroll or drag to zoom and pan.`} />}
        {(loading || error || isEmpty) && <div className="flex h-[360px] items-center justify-center px-6 text-center text-sm text-slate-400">
          {loading ? "Loading live market candles…" : error ? <div><p className="font-semibold text-rose-300">{error}</p><button type="button" onClick={() => void load(true)} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/10">Try again</button></div> : "No candle data is available for this market and timeframe."}
        </div>}
      </div>
      {response?.stale && <div className="border-t border-amber-400/15 bg-amber-400/[.06] px-4 py-2 text-[10px] font-medium text-amber-200">Showing the latest available candles. The market feed is currently delayed.</div>}
    </section>
  );
}