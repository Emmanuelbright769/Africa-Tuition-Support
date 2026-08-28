export const BANK_TRANSFER_FEE_RATE = 0.075;

export type BankTransferQuote = {
  amountUsd: number;
  feeRate: number;
  feeUsd: number;
  netAmountUsd: number;
  exchangeRate: number;
  recipientAmountNgn: number;
};

export function calculateBankTransferQuote(
  amountUsd: number,
  exchangeRate: number,
  feeRate = BANK_TRANSFER_FEE_RATE,
): BankTransferQuote {
  const safeAmount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;
  const safeRate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 0;
  const safeFeeRate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : 0;
  const feeUsd = Number((safeAmount * safeFeeRate).toFixed(2));
  const netAmountUsd = Number((safeAmount - feeUsd).toFixed(2));

  return {
    amountUsd: safeAmount,
    feeRate: safeFeeRate,
    feeUsd,
    netAmountUsd,
    exchangeRate: safeRate,
    recipientAmountNgn: Math.round(netAmountUsd * safeRate),
  };
}