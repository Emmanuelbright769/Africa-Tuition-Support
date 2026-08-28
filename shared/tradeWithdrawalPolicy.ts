export function getTradeProfitWithdrawable(
  tradeBalance: number,
  lockedPrincipal: number,
): number {
  const balance = Number.isFinite(tradeBalance) ? Math.max(0, tradeBalance) : 0;
  const locked = Number.isFinite(lockedPrincipal) ? Math.max(0, lockedPrincipal) : 0;
  return Math.max(0, balance - locked);
}

export function areBankTransfersEnabled(setting: string | null | undefined): boolean {
  return setting !== "false";
}