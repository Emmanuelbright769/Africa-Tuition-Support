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

export function isUserFundsOutRequest(method: string, originalUrl: string, body?: unknown): boolean {
  const normalizedMethod = method.toUpperCase();
  const path = normalizeApiPath(originalUrl);
  if (normalizedMethod === "POST" && path === "/trade/withdraw") {
    return typeof body === "object"
      && body !== null
      && "withdrawalType" in body
      && body.withdrawalType === "withdraw_bank";
  }
  return FUNDS_OUT_REQUESTS.some(
    ([expectedMethod, pattern]) => expectedMethod === normalizedMethod && pattern.test(path),
  );
}
