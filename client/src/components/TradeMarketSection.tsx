import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Bot, Home, WalletCards, Radio, ArrowUpRight } from "lucide-react";

type TradeTab = "home" | "bot" | "wallet" | "activity";

const tabs: { id: TradeTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Overview", icon: Home },
  { id: "bot", label: "Itera BOT", icon: Bot },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "activity", label: "Activity", icon: Activity },
];

export default function TradeMarketSection({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TradeTab>("home");

  const jump = (next: TradeTab) => {
    setTab(next);
    const target = document.querySelector(`[data-trade-anchor="${next}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="trade-market-shell relative -mx-2 sm:-mx-4 lg:-mx-8 px-2 sm:px-4 lg:px-8 pb-28"
    >
      <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-tsia-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute top-96 -left-24 h-80 w-80 rounded-full bg-tsia-green/10 blur-3xl" />
      <div className="relative z-10">{children}</div>

      <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-1 rounded-[1.5rem] border border-white/50 bg-white/70 p-1.5 shadow-[0_18px_55px_rgba(27,55,44,.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75 sm:bottom-6">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-3 text-[11px] font-bold transition-all duration-300 sm:text-xs ${
                active ? "bg-tsia-green text-white shadow-lg shadow-tsia-green/20" : "text-muted-foreground hover:bg-tsia-green/10 hover:text-tsia-green"
              }`}
              data-testid={`trade-tab-${id}`}
            >
              {active && <motion.span layoutId="trade-tab-pill" className="absolute inset-0 -z-0 rounded-2xl bg-tsia-green" transition={{ type: "spring", stiffness: 400, damping: 28 }} />}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10 hidden sm:inline">{label}</span>
              {id === "activity" && <Radio className={`relative z-10 h-2.5 w-2.5 ${active ? "text-tsia-gold" : "text-tsia-green"} animate-pulse`} />}
            </button>
          );
        })}
        <ArrowUpRight className="mr-1 hidden h-4 w-4 text-tsia-gold sm:block" />
      </div>
    </motion.section>
  );
}