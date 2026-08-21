export const BACK_TO_SCHOOL_TARGET_USD = 30;
export const BACK_TO_SCHOOL_DEPOSIT_FEE_RATE = 0.05;
export const BACK_TO_SCHOOL_WITHDRAWAL_FEE_RATE = 0.075;

export function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBackToSchoolDeposit(amountUsd: number) {
  const feeAmount = roundUsd(amountUsd * BACK_TO_SCHOOL_DEPOSIT_FEE_RATE);
  return { feeAmount, totalDebited: roundUsd(amountUsd + feeAmount) };
}

export function calculateBackToSchoolWithdrawal(amountUsd: number) {
  const feeAmount = roundUsd(amountUsd * BACK_TO_SCHOOL_WITHDRAWAL_FEE_RATE);
  return { feeAmount, netReceived: roundUsd(amountUsd - feeAmount) };
}