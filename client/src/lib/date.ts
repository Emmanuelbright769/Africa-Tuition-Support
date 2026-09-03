/**
 * Formats persisted timestamps consistently for wallet and admin records.
 * The explicit zone label avoids relying on each viewer's local timezone.
 */
export function formatLagosDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return `${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Lagos",
  })} (Africa/Lagos)`;
}