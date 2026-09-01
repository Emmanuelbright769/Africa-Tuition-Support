import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ShoppingBag,
  Store,
  WalletCards,
} from "lucide-react";
import { useLocalCurrency } from "@/contexts/LocalCurrencyContext";
import ServiceWalletView from "@/components/ServiceWalletView";
import { apiRequest } from "@/lib/queryClient";

type MarketplaceOrder = {
  id: number;
  totalAmount: string;
  sellerReceives: string;
  status: string;
  escrowReleased: boolean;
  createdAt: string;
  product?: { title: string };
  productTitle?: string;
};

interface MarketplaceWalletViewProps {
  onClose: () => void;
}

const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MarketplaceWalletView({ onClose }: MarketplaceWalletViewProps) {
  const { formatAmount } = useLocalCurrency();
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useQuery<any>({
    queryKey: ["/api/service-wallets", "tsmart"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/service-wallets/tsmart");
      if (!response.ok) throw new Error("Could not load TS-Mart wallet");
      return response.json();
    },
    refetchInterval: 30000,
  });
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<MarketplaceOrder[]>({
    queryKey: ["/api/orders/purchases"],
    refetchInterval: 30000,
  });
  const { data: sales = [] } = useQuery<MarketplaceOrder[]>({
    queryKey: ["/api/orders/sales"],
    refetchInterval: 30000,
  });
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/service-wallets", "tsmart", "transactions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/service-wallets/tsmart/transactions");
      if (!response.ok) throw new Error("Could not load TS-Mart activity");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const walletBalance = Number(wallet?.balance ?? 0);
  const escrow = useMemo(
    () => purchases.filter(order => !order.escrowReleased && order.status !== "cancelled").reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [purchases],
  );
  const pendingProceeds = useMemo(
    () => sales.filter(order => !order.escrowReleased && order.status !== "cancelled").reduce((sum, order) => sum + Number(order.sellerReceives || 0), 0),
    [sales],
  );
  const activity = useMemo(() => {
    const orders = [
      ...purchases.map(order => ({ id: `purchase-${order.id}`, title: order.product?.title || order.productTitle || `Order #${order.id}`, detail: order.escrowReleased ? "Payment released" : order.status === "cancelled" ? "Refunded / cancelled" : "Held in escrow", amount: -Number(order.totalAmount || 0), date: order.createdAt, icon: ShoppingBag })),
      ...sales.filter(order => order.escrowReleased).map(order => ({ id: `sale-${order.id}`, title: order.product?.title || order.productTitle || `Sale #${order.id}`, detail: "Seller proceeds released", amount: Number(order.sellerReceives || 0), date: order.createdAt, icon: Store })),
    ];
    const ledger = transactions
      .filter(tx => ["escrow", "wallet_credit", "credit", "debit"].some(type => String(tx.type || "").includes(type)))
      .map(tx => ({ id: `tx-${tx.id}`, title: tx.description || "Wallet activity", detail: tx.status || "completed", amount: tx.type === "debit" ? -Number(tx.amount || 0) : Number(tx.amount || tx.netAmount || 0), date: tx.createdAt, icon: WalletCards }));
    return [...orders, ...ledger].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 12);
  }, [purchases, sales, transactions]);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#F5F7FF]" data-testid="tsmart-wallet-screen" role="dialog" aria-modal="true" aria-label="TS-Mart wallet">
      <div className="min-h-full">
        <header className="bg-gradient-to-br from-[#1B4FFF] to-[#4F7FFF] px-4 pb-7 pt-5 text-white">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between gap-4">
              <button onClick={onClose} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-white/80 hover:bg-white/15 hover:text-white" data-testid="btn-close-tsmart-wallet">
                <ArrowLeft className="h-5 w-5" /> Back to TS-Mart
              </button>
              <button onClick={() => refetchWallet()} className="rounded-xl bg-white/15 p-2.5 hover:bg-white/25" aria-label="Refresh TS-Mart wallet">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/70"><WalletCards className="h-4 w-4" /> TS-Mart wallet</div>
                <p className="mt-2 text-4xl font-black">{walletLoading ? "—" : money(walletBalance)}</p>
                <p className="mt-1 text-sm text-white/70">{formatAmount(walletBalance)} · available for marketplace purchases</p>
              </div>
              <div className="hidden rounded-2xl bg-white/15 p-3 text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Orders protected</p>
                <p className="mt-1 text-xl font-black">{purchases.length + sales.length}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-12">
          <section className="grid grid-cols-3 gap-2">
            {[
              { label: "Available", value: walletBalance, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "In escrow", value: escrow, icon: LockKeyhole, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Pending sales", value: pendingProceeds, icon: Clock3, color: "text-blue-600", bg: "bg-blue-50" },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${item.bg}`}><item.icon className={`h-4 w-4 ${item.color}`} /></div>
                <p className="text-[10px] font-semibold text-gray-400">{item.label}</p>
                <p className="mt-0.5 truncate text-sm font-black text-gray-800">{money(item.value)}</p>
              </div>
            ))}
          </section>

           <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-sm">
             <ServiceWalletView walletType="tsmart" description="Fund marketplace purchases directly, or return available funds to Swift Wallet." />
           </div>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#1B4FFF]" />
              <div><p className="text-xs font-bold text-[#1237CC]">Escrow protection is active</p><p className="mt-1 text-[11px] leading-relaxed text-blue-800/70">Buyer payments remain protected until delivery is confirmed. Seller proceeds become available after the buyer releases the order.</p></div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div><h2 className="font-black text-gray-900">Marketplace activity</h2><p className="text-[11px] text-gray-400">Purchases, escrow and released seller proceeds</p></div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#1B4FFF]">{activity.length} records</span>
            </div>
            {purchasesLoading ? <div className="space-y-3 py-4">{[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div> : activity.length === 0 ? (
              <div className="py-10 text-center"><WalletCards className="mx-auto mb-2 h-8 w-8 text-gray-200" /><p className="text-sm font-semibold text-gray-500">No TS-Mart activity yet</p><p className="mt-1 text-xs text-gray-400">Your purchases and seller proceeds will appear here.</p></div>
            ) : activity.map(item => (
              <div key={item.id} className="flex items-center gap-3 border-t border-gray-100 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#1B4FFF]"}`}><item.icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-gray-800">{item.title}</p><p className="truncate text-[10px] text-gray-400">{item.detail} · {item.date ? new Date(item.date).toLocaleDateString("en-GB") : ""}</p></div>
                <p className={`text-sm font-black ${item.amount >= 0 ? "text-emerald-600" : "text-gray-700"}`}>{item.amount >= 0 ? "+" : "-"}{money(Math.abs(item.amount))}</p>
              </div>
            ))}
          </section>

          <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-semibold text-gray-400"><ShoppingBag className="h-3.5 w-3.5" /> TS-Mart · Escrow protected marketplace</div>
        </main>
      </div>
    </div>
  );
}