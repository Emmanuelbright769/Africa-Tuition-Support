import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Grid2X2, Home, WalletCards, X,
  Radio, CandlestickChart, BarChart2, Bot, Handshake,
} from "lucide-react";
import TradeSplashScreen from "./TradeSplashScreen";
import TradingSignals from "./trade/TradingSignals";
import BotLiveView from "./trade/BotLiveView";
import ManualTrading from "./trade/ManualTrading";
import TradeWalletView from "./trade/TradeWalletView";
import P2PExchange from "./trade/P2PExchange";

type Tab = "home" | "wallet" | "signals" | "botlive" | "manual" | "activity" | "p2p";

interface TradeMarketSectionProps {
  children: ReactNode;
  tradeBalance: number;
  userId: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onFund: () => void;
  onConnect: () => void;
  onReinvest: () => void;
}

const PRIMARY_TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "home",    label: "Overview", Icon: Home },
  { id: "wallet",  label: "Wallet",   Icon: WalletCards },
  { id: "signals", label: "Signals",  Icon: Radio },
];

const EXTRA_TABS: { id: Tab; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: "botlive",  label: "Itera BOT",      desc: "Live bot position & controls",    Icon: Bot },
  { id: "manual",   label: "Manual Trading", desc: "Open your own market position",   Icon: CandlestickChart },
  { id: "activity", label: "Activity",       desc: "Your full market history",        Icon: BarChart2 },
  { id: "p2p",      label: "P2P Exchange",   desc: "Buy & sell USD peer-to-peer",     Icon: Handshake },
];

// Tabs that render dedicated components (not the scrollable children)
const COMPONENT_TABS = new Set<Tab>(["wallet", "signals", "botlive", "manual", "activity", "p2p"]);

export default function TradeMarketSection({
  children, tradeBalance, onDeposit, onWithdraw, onFund, onConnect, onReinvest,
}: TradeMarketSectionProps) {
  const [tab, setTab]       = useState<Tab>("home");
  const [more, setMore]     = useState(false);
  const [splash, setSplash] = useState(true);

  const isExtra = EXTRA_TABS.some(t => t.id === tab);

  const goTab = (next: Tab) => {
    setTab(next);
    setMore(false);
    if (next === "home") {
      // scroll back to top of the trade section
      setTimeout(() => {
        const el = document.querySelector("[data-trade-anchor='home']");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  // We keep `children` always mounted to prevent blank flash on return.
  // Component-tabs are lazily mounted once and kept in DOM thereafter.
  const showChildren = !COMPONENT_TABS.has(tab);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="trade-market-shell relative -mx-2 px-2 pb-28 sm:-mx-4 sm:px-4 lg:-mx-8 lg:px-8"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-tsia-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute top-96 -left-24 h-80 w-80 rounded-full bg-tsia-green/10 blur-3xl" />

      {/* ── Scroll-based children (home) — always mounted, shown/hidden via CSS ── */}
      <div
        className="relative z-10"
        style={{ display: showChildren ? undefined : "none" }}
        aria-hidden={!showChildren}
      >
        {children}
      </div>

      {/* ── Component-based tabs — animate in/out ── */}
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {tab === "wallet" && (
            <motion.div key="wallet"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <TradeWalletView
                onDeposit={onDeposit} onWithdraw={onWithdraw}
                onFund={onFund} onConnect={onConnect} onReinvest={onReinvest}
              />
            </motion.div>
          )}
          {tab === "signals" && (
            <motion.div key="signals"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <TradingSignals tradeBalance={tradeBalance} />
            </motion.div>
          )}
          {tab === "botlive" && (
            <motion.div key="botlive"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <BotLiveView />
            </motion.div>
          )}
          {tab === "manual" && (
            <motion.div key="manual"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <ManualTrading tradeBalance={tradeBalance} />
            </motion.div>
          )}
          {tab === "activity" && (
            <motion.div key="activity"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              {/* Activity placeholder — reuses closed positions from scroll content */}
              <div className="py-12 text-center text-white/30">
                <BarChart2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="font-bold text-white/50">Activity Log</p>
                <p className="mt-1 text-sm">Scroll to Activity in Overview to see your history.</p>
                <button
                  onClick={() => goTab("home")}
                  className="mt-4 rounded-xl border border-white/10 px-5 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                >
                  Go to Overview
                </button>
              </div>
            </motion.div>
          )}
          {tab === "p2p" && (
            <motion.div key="p2p"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              <P2PExchange />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Splash screen overlay */}
      {splash && <TradeSplashScreen onDone={() => setSplash(false)} />}

      {/* ── More drawer ── */}
      <AnimatePresence>
        {more && (
          <>
            {/* Backdrop */}
            <motion.button
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMore(false)}
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Drawer panel */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[min(88vw,340px)] flex-col border-l border-white/15 bg-slate-900 shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-white">More Features</h2>
                  <p className="text-[11px] text-white/40 mt-0.5">Trade Market extras</p>
                </div>
                <button
                  onClick={() => setMore(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Drawer items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {EXTRA_TABS.map(({ id, label, desc, Icon }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => goTab(id)}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]
                        ${active
                          ? "border-tsia-green/40 bg-tsia-green/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                        ${active ? "bg-tsia-green" : "bg-white/10"}`}>
                        <Icon className={`h-5 w-5 ${active ? "text-white" : "text-tsia-green"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold leading-tight ${active ? "text-tsia-green" : "text-white"}`}>
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs text-white/50 leading-snug">{desc}</p>
                      </div>
                      {active && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-tsia-green animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer footer */}
              <div className="border-t border-white/10 px-5 py-4">
                <p className="text-[10px] text-white/30 text-center">
                  Eduvault Trade Market · USDT Secured
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom navigation ── */}
      <nav className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-1 rounded-[1.5rem] border border-white/20 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-xl">
        {PRIMARY_TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => goTab(id)}
              className="relative flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-[11px] font-bold transition-colors"
              data-testid={`trade-tab-${id}`}
            >
              {active && (
                <motion.span
                  layoutId="trade-tab-pill"
                  className="absolute inset-0 rounded-2xl bg-tsia-green"
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              )}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-white" : "text-white/50"}`} />
              <span className={`relative z-10 hidden sm:inline ${active ? "text-white" : "text-white/50"}`}>
                {label}
              </span>
            </button>
          );
        })}

        {/* Hamburger / More button */}
        <button
          onClick={() => setMore(true)}
          className={`relative flex items-center justify-center rounded-2xl px-3 py-3 transition-colors
            ${isExtra ? "bg-tsia-gold" : "hover:bg-white/10"}`}
        >
          <Grid2X2 className={`h-5 w-5 ${isExtra ? "text-slate-950" : "text-white/50"}`} />
          {isExtra && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-tsia-green border-2 border-slate-950 animate-pulse" />
          )}
        </button>
      </nav>
    </motion.section>
  );
}
