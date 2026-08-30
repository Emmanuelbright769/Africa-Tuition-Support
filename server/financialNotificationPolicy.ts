export const FINANCIAL_DELIVERY_TYPES = ["user_email", "admin_email", "in_app"] as const;
export type FinancialDeliveryType = typeof FINANCIAL_DELIVERY_TYPES[number];

export const MAX_FINANCIAL_DELIVERY_ATTEMPTS = 8;
export const FINANCIAL_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

/** Exponential retry with a cap prevents a failing mail provider from being hammered. */
export function financialRetryDelayMs(attempts: number): number {
  const safeAttempts = Math.max(1, Math.floor(attempts));
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** (safeAttempts - 1));
}

/**
 * Provider errors can contain connection strings or authorization headers.
 * Keep a short diagnostic, but never persist or log those values.
 */
export function safeDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Delivery failed";
  return message
    .replace(/(authorization|api[_ -]?key|password|token)\s*[:=]\s*(?:Bearer\s+)?\S+/gi, "$1=[redacted]")
    .replace(/:\/\/[^/\s:@]+:[^@\s]+@/g, "://[redacted]@")
    .slice(0, 500);
}