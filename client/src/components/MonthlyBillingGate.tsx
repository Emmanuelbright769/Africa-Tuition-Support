import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import FinancialHub from "@/pages/FinancialHub";
import type { MonthlyBillingStatus } from "@shared/monthlyBillingPolicy";

export default function MonthlyBillingGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { data: billing, isLoading } = useQuery<MonthlyBillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then((response) => response.json()),
    enabled: !!user && user.role !== "admin",
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (!user || user.role === "admin") return <>{children}</>;

  if (isLoading || !billing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-semibold">Checking platform access…</span>
        </div>
      </div>
    );
  }

  if (billing.hasAccess) return <>{children}</>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-background to-background dark:from-amber-950/20">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
        <section className="rounded-3xl border border-amber-300/70 bg-card shadow-xl overflow-hidden" data-testid="monthly-billing-restriction">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-6 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                  <LockKeyhole className="w-3.5 h-3.5" />
                  Access temporarily restricted
                </div>
                <h1 className="text-2xl sm:text-3xl font-black">Monthly platform fees are due</h1>
                <p className="text-sm text-white/90 max-w-xl">
                  Add enough money to your SwiftWallet to cover all outstanding monthly charges. Access is restored automatically as soon as payment is collected.
                </p>
              </div>
              <ShieldCheck className="w-10 h-10 shrink-0 text-white/90" />
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Subscription fee</p>
                <p className="text-xl font-black">${billing.subscriptionFee.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Maintenance fee</p>
                <p className="text-xl font-black">${billing.maintenanceFee.toFixed(2)}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="font-semibold">Total required</span>
                  <span className="font-black">${billing.amountDue.toFixed(2)}</span>
                </div>
                {billing.unpaidMonths > 1 && (
                  <div className="flex justify-between gap-4 text-sm mt-1 text-muted-foreground">
                    <span>Unpaid months</span>
                    <span>{billing.unpaidMonths}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4 text-sm mt-1 text-muted-foreground">
                  <span>Current wallet balance</span>
                  <span>${billing.walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-4 text-sm mt-1 text-amber-700 dark:text-amber-300">
                  <span>Amount still needed</span>
                  <span className="font-bold">${billing.shortfall.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-card shadow-lg p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-black">Fund your account</h2>
            <p className="text-sm text-muted-foreground">
              Only funding channels are available until the monthly fees are paid.
            </p>
          </div>
          <FinancialHub restrictedFundingOnly />
        </section>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => logout()}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </main>
  );
}