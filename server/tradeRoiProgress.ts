const PRIVATE_CYCLE_TARGETS: Record<number, number> = {
  60: 1.70,
  90: 1.80,
  120: 2.00,
};

export type PrivateTradeProgress = {
  progressPct: number;
  targetReached: boolean;
};

export function getPrivateTradeProgress(
  cumulativeProfits: number,
  lockedPrincipal: number,
  planDays: number,
): PrivateTradeProgress {
  const profits = Number.isFinite(cumulativeProfits) ? Math.max(0, cumulativeProfits) : 0;
  const locked = Number.isFinite(lockedPrincipal) ? Math.max(0, lockedPrincipal) : 0;
  const profitTarget = locked * (PRIVATE_CYCLE_TARGETS[planDays] ?? PRIVATE_CYCLE_TARGETS[120]);
  const exactProgress = profitTarget > 0 ? Math.min(100, (profits / profitTarget) * 100) : 0;

  // Return a whole-number visual percentage without exposing the private
  // target amount, multiplier, or amount remaining.
  const progressPct = Math.round(exactProgress);

  return {
    progressPct,
    targetReached: profitTarget > 0 && profits >= profitTarget,
  };
}