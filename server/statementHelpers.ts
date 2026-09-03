export const LAGOS_TIME_ZONE = "Africa/Lagos";
export const MAX_STATEMENT_RANGE_DAYS = 366;

export type StatementRow = {
  source: string;
  service: string;
  timestamp: Date | string;
  type: string;
  amount: string | number;
  fee: string | number;
  status: string;
  reference: string | null;
  description: string;
};

/** Parses a date input as a calendar day in Africa/Lagos (UTC+01:00). */
export function lagosDayRange(startDate: string, endDate: string): { start: Date; endExclusive: Date } {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    throw new Error("Start and end dates must use YYYY-MM-DD.");
  }
  const start = new Date(`${startDate}T00:00:00.000+01:00`);
  const end = new Date(`${endDate}T00:00:00.000+01:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    || start.toLocaleDateString("en-CA", { timeZone: LAGOS_TIME_ZONE }) !== startDate
    || end.toLocaleDateString("en-CA", { timeZone: LAGOS_TIME_ZONE }) !== endDate) {
    throw new Error("Start and end dates must be valid calendar dates.");
  }
  if (end < start) throw new Error("End date must not be before start date.");
  const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  if ((endExclusive.getTime() - start.getTime()) / 86_400_000 > MAX_STATEMENT_RANGE_DAYS) {
    throw new Error(`Statement ranges cannot exceed ${MAX_STATEMENT_RANGE_DAYS} days.`);
  }
  return { start, endExclusive };
}

export function formatLagosTimestamp(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function sortStatementRows(rows: StatementRow[]): StatementRow[] {
  return [...rows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}