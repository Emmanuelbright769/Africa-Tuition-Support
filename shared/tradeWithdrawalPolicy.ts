export function getTradeProfitWithdrawable(
  tradeBalance: number,
  lockedPrincipal: number,
): number {
  const balance = Number.isFinite(tradeBalance) ? Math.max(0, tradeBalance) : 0;
  const locked = Number.isFinite(lockedPrincipal) ? Math.max(0, lockedPrincipal) : 0;
  return Math.max(0, balance - locked);
}

export type TradeEarlyExitQuote = {
  capital: number;
  realisedProfit: number;
  capitalPayout: number;
  profitPayout: number;
  payout: number;
  forfeited: number;
};

export function parseTradeMoneyMicros(value: number | string): bigint {
  const source = typeof value === "number"
    ? (Number.isFinite(value) ? value.toFixed(6) : "0")
    : String(value).trim();
  const match = source.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match || match[1] === "-") return 0n;
  const fraction = (match[3] ?? "").slice(0, 6).padEnd(6, "0");
  return BigInt(match[2]) * 1_000_000n + BigInt(fraction);
}

export function formatTradeMoneyMicros(micros: bigint): string {
  const sign = micros < 0n ? "-" : "";
  const absolute = micros < 0n ? -micros : micros;
  const whole = absolute / 1_000_000n;
  const fraction = String(absolute % 1_000_000n).padStart(6, "0");
  return `${sign}${whole}.${fraction}`;
}

export function getTradeEarlyExitQuote(
  tradeBalance: number | string,
  lockedPrincipal: number | string,
): TradeEarlyExitQuote {
  const asNumber = (micros: bigint) => Number(micros) / 1_000_000;
  const asCents = (cents: bigint) => Number(cents) / 100;

  const balanceMicros = parseTradeMoneyMicros(tradeBalance);
  const lockedMicros = parseTradeMoneyMicros(lockedPrincipal);
  const capitalMicros = balanceMicros < lockedMicros ? balanceMicros : lockedMicros;
  const realisedProfitMicros = balanceMicros > lockedMicros ? balanceMicros - lockedMicros : 0n;
  // Divide each component by two, then truncate to whole cents. Source values
  // are never rounded upward, so the payout cannot exceed the promised 50%.
  const capitalPayoutCents = (capitalMicros / 2n) / 10_000n;
  const profitPayoutCents = (realisedProfitMicros / 2n) / 10_000n;
  const payoutCents = capitalPayoutCents + profitPayoutCents;
  const payoutMicros = payoutCents * 10_000n;

  return {
    capital: asNumber(capitalMicros),
    realisedProfit: asNumber(realisedProfitMicros),
    capitalPayout: asCents(capitalPayoutCents),
    profitPayout: asCents(profitPayoutCents),
    payout: asCents(payoutCents),
    forfeited: asNumber(balanceMicros - payoutMicros),
  };
}

export function areBankTransfersEnabled(setting: string | null | undefined): boolean {
  return setting !== "false";
}