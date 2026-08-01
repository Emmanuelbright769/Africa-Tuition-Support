import { useEffect } from "react";
import { motion } from "framer-motion";

export default function TradeSplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 2800); return () => window.clearTimeout(t); }, [onDone]);
  return <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 2.45, duration: .35 }} className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-slate-950/95 backdrop-blur-xl">
    <div className="absolute h-56 w-56 rounded-full bg-gradient-to-br from-tsia-gold via-tsia-green to-emerald-400 blur-3xl opacity-50 animate-pulse" />
    <div className="relative w-[min(86vw,420px)] text-center">
      <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .6 }} className="mb-3 text-3xl font-black tracking-tight"><span className="text-tsia-gold">Eduvault</span><span className="text-tsia-green"> Trade</span><span className="text-rose-400"> Market</span></motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .45 }} className="text-xs tracking-[.18em] text-slate-300"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />Powered by Itera · USDT Secured</motion.p>
      <div className="mt-12 space-y-3 text-left">{["Markets Live", "Signals Active", "AI Bot Ready"].map((label, i) => <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300"><span>{label}</span><motion.div initial={{ width: 0 }} animate={{ width: `${72 + i * 9}%` }} transition={{ delay: .65 + i * .15, duration: 1.4 }} className="ml-5 h-1 rounded-full bg-gradient-to-r from-tsia-green to-tsia-gold" /></div>)}</div>
      <div className="mt-10 h-1 overflow-hidden rounded-full bg-white/10"><motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2.8, ease: "linear" }} className="h-full bg-tsia-green" /></div>
    </div>
  </motion.div>;
}