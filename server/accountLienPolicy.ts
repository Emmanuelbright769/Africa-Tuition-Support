const FUNDS_OUT_REQUESTS: ReadonlyArray<readonly [string, RegExp]> = [
  ["POST", /^\/wallet\/withdraw(?:__disabled)?$/],
  ["POST", /^\/wallet\/withdraw-crypto(?:__disabled)?$/],
  ["POST", /^\/korapay\/payout$/],

  ["POST", /^\/fintech\/crypto-withdraw$/],
  ["POST", /^\/fintech\/bank-transfer$/],
] as const;

export function normalizeApiPath(originalUrl: string): string {
  const pathname = originalUrl.split("?")[0] || "/";
  const withoutApiPrefix = pathname.replace(/^\/api(?=\/|$)/, "");
  return withoutApiPrefix || "/";
}

export function isTradeMarketBankWithdrawal(method: string, originalUrl: string, body?: unknown): boolean {
  const normalizedMethod = method.toUpperCase();
  const path = normalizeApiPath(originalUrl);
  return normalizedMethod === "POST"
    && path === "/trade/withdraw"
    && typeof body === "object"
    && body !== null
    && "withdrawalType" in body
    && body.withdrawalType === "withdraw_bank";
}

export function isUserFundsOutRequest(method: string, originalUrl: string, body?: unknown): boolean {
  const normalizedMethod = method.toUpperCase();
  const path = normalizeApiPath(originalUrl);
  if (isTradeMarketBankWithdrawal(method, originalUrl, body)) return true;
  return FUNDS_OUT_REQUESTS.some(
    ([expectedMethod, pattern]) => expectedMethod === normalizedMethod && pattern.test(path),
  );
}

/**
 * Returns whether the generic student/SwiftWallet lien should block this
 * external payout. Trade Market bank withdrawals debit the separate Trade
 * wallet and therefore have their own balance and control checks.
 */
export function isStudentWalletLienProtectedFundsOutRequest(
  method: string,
  originalUrl: string,
  body?: unknown,
): boolean {
  return isUserFundsOutRequest(method, originalUrl, body)
    && !isTradeMarketBankWithdrawal(method, originalUrl, body);
}
