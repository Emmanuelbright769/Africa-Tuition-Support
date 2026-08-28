const FUNDS_OUT_REQUESTS: ReadonlyArray<readonly [string, RegExp]> = [
  ["POST", /^\/verification\/pay-fee$/],
  ["POST", /^\/sponsorship\/select$/],
  ["POST", /^\/scholarship\/pay-(?:fee|commitment|renewal)$/],

  ["POST", /^\/wallet\/send$/],
  ["POST", /^\/wallet\/withdraw(?:__disabled)?$/],
  ["POST", /^\/wallet\/withdraw-crypto(?:__disabled)?$/],
  ["POST", /^\/wallet\/bill$/],
  ["POST", /^\/wallet\/cashback\/withdraw$/],
  ["POST", /^\/korapay\/payout$/],

  ["POST", /^\/fintech\/crypto-withdraw$/],
  ["POST", /^\/fintech\/bank-transfer$/],
  ["POST", /^\/fintech\/(?:airtime|data|electricity|cable-tv|betting)$/],
  ["POST", /^\/fintech\/airtime-to-cash$/],
  ["POST", /^\/fintech\/virtual-card\/purchase(?:-disabled)?$/],

  ["POST", /^\/affiliate\/withdraw-commission$/],
  ["POST", /^\/affiliate\/scholarship-sponsor-code$/],
  ["POST", /^\/co-affiliate\/(?:subscribe|upgrade|withdraw)$/],

  ["POST", /^\/trade\/fund-from-wallet$/],
  ["POST", /^\/trade\/transfer-to-wallet$/],
  ["POST", /^\/trade\/reinvest$/],
  ["POST", /^\/trade\/withdraw$/],
  ["POST", /^\/trade\/bot\/activate$/],
  ["POST", /^\/trade\/signals\/enter$/],
  ["POST", /^\/trade\/manual\/open$/],

  ["POST", /^\/back-to-school\/children\/\d+\/(?:contributions|withdrawals)$/],
  ["POST", /^\/qce\/(?:contribute|withdraw)$/],
  ["POST", /^\/savings\/goals\/\d+\/(?:deposit|withdraw)$/],

  ["POST", /^\/exchange\/(?:fund|withdraw|order)$/],
  ["POST", /^\/p2p\/offers$/],
  ["POST", /^\/p2p\/orders$/],
  ["PATCH", /^\/p2p\/orders\/\d+\/paid$/],
  ["PATCH", /^\/p2p\/orders\/\d+\/complete$/],

  ["POST", /^\/orders$/],
  ["POST", /^\/orders\/\d+\/mark-received$/],
  ["POST", /^\/tour\/book$/],
  ["POST", /^\/movies\/subscribe$/],
] as const;

export function normalizeApiPath(originalUrl: string): string {
  const pathname = originalUrl.split("?")[0] || "/";
  const withoutApiPrefix = pathname.replace(/^\/api(?=\/|$)/, "");
  return withoutApiPrefix || "/";
}

export function isUserFundsOutRequest(method: string, originalUrl: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const path = normalizeApiPath(originalUrl);
  return FUNDS_OUT_REQUESTS.some(
    ([expectedMethod, pattern]) => expectedMethod === normalizedMethod && pattern.test(path),
  );
}
