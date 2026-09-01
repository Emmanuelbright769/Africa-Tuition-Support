const PRIVATE_CYCLE_TARGETS: Record<number, number> = {
  60: 0.70,
  90: 0.80,
  120: 1.00,
};

export type PrivateTradeProgress = {
  progressPct: number;
  targetReached: boolean;
};

export function getPrivateTradeProgress(
  tradeBalance: number,
  lockedPrincipal: number,
  planDays: number,
): PrivateTradeProgress {
  const balance = Number.isFinite(tradeBalance) ? Math.max(0, tradeBalance) : 0;
  const locked = Number.isFinite(lockedPrincipal) ? Math.max(0, lockedPrincipal) : 0;
  const netProfit = Math.max(0, balance - locked);
  const target = locked * (PRIVATE_CYCLE_TARGETS[planDays] ?? PRIVATE_CYCLE_TARGETS[120]);
  const exactProgress = target > 0 ? Math.min(100, (netProfit / target) * 100) : 0;

  // The browser receives only a coarse visual step. It never receives the
  // private target, multiplier, exact target-relative ratio, or amount left.
  const progressPct = exactProgress >= 100 ? 100 : Math.floor(exactProgress / 10) * 10;

  return {
    progressPct,
    targetReached: target > 0 && netProfit >= target,
  };
}