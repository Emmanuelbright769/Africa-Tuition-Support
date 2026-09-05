export const MONTHLY_BILLING_START_AT = new Date("2026-09-01T00:00:00+01:00");
export const MONTHLY_SUBSCRIPTION_FEE_USD = 1.50;
export const MONTHLY_MAINTENANCE_FEE_USD = 0.50;
export const MONTHLY_TOTAL_FEE_USD = 2.00;

export type MonthlyBillingState =
  | "not_started"
  | "exempt"
  | "paid"
  | "payment_required";

export type MonthlyBillingStatus = {
  required: boolean;
  hasAccess: boolean;
  state: MonthlyBillingState;
  monthKey: string | null;
  subscriptionFee: number;
  maintenanceFee: number;
  totalFee: number;
  amountDue: number;
  unpaidMonths: number;
  walletBalance: number;
  shortfall: number;
  chargedNow?: boolean;
};

export function getLagosBillingMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Unable to determine the current billing month");
  return `${year}-${month}`;
}

export function isMonthlyBillingStarted(now = new Date()): boolean {
  return now.getTime() >= MONTHLY_BILLING_START_AT.getTime();
}

export function isAccountEligibleForMonthlyBilling(accountCreatedAt: Date, now = new Date()): boolean {
  if (!isMonthlyBillingStarted(now)) return false;
  return getLagosBillingMonthKey(accountCreatedAt) < getLagosBillingMonthKey(now);
}

export function getMonthlyBillingDecision(balance: number, amountDue = MONTHLY_TOTAL_FEE_USD): "charge" | "restrict" {
  return Number.isFinite(balance) && balance >= amountDue
    ? "charge"
    : "restrict";
}

function normalizeApiPath(path: string): string {
  const withoutQuery = path.split("?")[0] || "/";
  const withoutApi = withoutQuery.startsWith("/api/")
    ? withoutQuery.slice(4)
    : withoutQuery;
  return withoutApi.startsWith("/") ? withoutApi : `/${withoutApi}`;
}

export function isMonthlyBillingAllowedRequest(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizeApiPath(path);

  if (normalizedMethod === "OPTIONS") return true;
  if (normalizedPath.startsWith("/auth/")) return true;
  if (normalizedPath.startsWith("/security/transaction-pin/")) return true;
  if (normalizedPath === "/billing/status") return true;
  if (normalizedPath.startsWith("/identity-verifications/")) return true;
  if (
    normalizedPath === "/verification/status"
    || normalizedPath === "/verification/identity"
    || normalizedPath === "/verification/wallet-kyc"
    || normalizedPath === "/user/country"
  ) return true;

  if (
    normalizedMethod === "GET"
    && (
      normalizedPath === "/wallet"
      || normalizedPath === "/wallet/balances"
      || normalizedPath === "/wallet/deposits"
      || normalizedPath === "/wallet/banks"
      || normalizedPath === "/exchange-rates"
    )
  ) return true;

  if (
    normalizedMethod === "POST"
    && (
      normalizedPath === "/wallet/squad/initiate"
      || normalizedPath === "/wallet/squad/verify"
      || normalizedPath === "/wallet/korapay/initiate"
      || normalizedPath === "/wallet/korapay/verify"
      || normalizedPath === "/wallet/paystack/initialize"
      || normalizedPath === "/wallet/paystack/verify"
      || normalizedPath === "/wallet/deposit"
    )
  ) return true;

  return false;
}