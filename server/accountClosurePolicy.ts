export const ACCOUNT_CLOSE_CONFIRMATION = "CLOSE MY ACCOUNT";

export type AccountClosureBlockerRow = {
  swift_balance?: boolean;
  trade_balance?: boolean;
  service_balance?: boolean;
  manual_position?: boolean;
  signal_position?: boolean;
  trade_cycle?: boolean;
  pending_withdrawal?: boolean;
  pending_deposit?: boolean;
  pending_order?: boolean;
  loan_obligation?: boolean;
};

const blockerLabels: Array<[keyof AccountClosureBlockerRow, string]> = [
  ["swift_balance", "positive SwiftWallet balance"],
  ["trade_balance", "positive Trade Market balance"],
  ["service_balance", "positive Manual, Signals, or TS-Mart balance"],
  ["manual_position", "open Manual Trading position"],
  ["signal_position", "open Trading Signals position"],
  ["trade_cycle", "active Trade bot or cycle"],
  ["pending_withdrawal", "pending withdrawal"],
  ["pending_deposit", "pending deposit"],
  ["pending_order", "pending TS-Mart order"],
  ["loan_obligation", "pending loan obligation"],
];

export function isAccountCloseConfirmationValid(value: unknown): boolean {
  return value === ACCOUNT_CLOSE_CONFIRMATION;
}

export function getAccountClosureBlockers(row: AccountClosureBlockerRow | undefined): string[] {
  if (!row) return [];
  return blockerLabels.filter(([key]) => row[key] === true).map(([, label]) => label);
}