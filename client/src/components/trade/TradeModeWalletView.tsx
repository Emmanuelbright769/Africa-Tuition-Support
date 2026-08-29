import { ReactNode } from "react";
import { ArrowLeft, ShieldCheck, WalletCards } from "lucide-react";
import TradeWalletView from "./TradeWalletView";

export type TradeWalletMode = "manual" | "signals" | "bot";

const MODE_COPY: Record<TradeWalletMode, { title: string; description: string }> = {
  manual: {
    title: "Manual Trading Wallet",
    description: "Funds and activity for positions you open yourself.",
  },
  signals: {
    title: "Trading Signals Wallet",
    description: "Fund signal entries and track their settlement history.",
  },
  bot: {
    title: "Itera BOT Wallet",
    description: "Manage the balance used by your live Itera sessions.",
  },
};

interface TradeModeWalletViewProps {
  mode: TradeWalletMode;
  onClose: () => void;
  tradeSessionActive: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  onFund: () => void;
  onConnect: () => void;
  onReinvest: () => void;
  onBankDeposit: () => void;
}

export default function TradeModeWalletView({
  mode,
  onClose,
  tradeSessionActive,
  onDeposit,
  onWithdraw,
  onFund,
  onConnect,
  onReinvest,
  onBankDeposit,
}: TradeModeWalletViewProps) {
  const copy = MODE_COPY[mode];

  return (
    <div
      className="fixed inset-0 z-[45] overflow-y-auto bg-slate-950 text-white"
      data-testid={`trade-mode-wallet-${mode}`}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,.08),transparent_30%)]">
        <div className="mx-auto max-w-2xl px-4 pb-12 pt-4 sm:px-6">
          <header className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <button
              onClick={onClose}
              className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={`Back from ${copy.title}`}
              data-testid={`btn-close-${mode}-wallet`}
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-tsia-green">
                <WalletCards className="h-3.5 w-3.5" />
                Mode wallet
              </div>
              <p className="mt-1 text-sm font-black text-white">{copy.title}</p>
            </div>
          </header>

          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-tsia-green/20 bg-tsia-green/10 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-tsia-green" />
            <div>
              <p className="text-xs font-bold text-tsia-green">Protected trading balance</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">{copy.description} The existing Trade Market settlement and active-session safety rules still apply.</p>
            </div>
          </div>

          <TradeWalletView
            tradeSessionActive={tradeSessionActive}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
            onFund={onFund}
            onConnect={onConnect}
            onReinvest={onReinvest}
            onBankDeposit={onBankDeposit}
          />
        </div>
      </div>
    </div>
  );
}