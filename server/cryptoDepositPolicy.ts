export const TSIA_TRC20_ADDRESS = "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj";
export const TSIA_BEP20_ADDRESS = "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977";
export const TRON_USDT_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
export const BSC_USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

export function validateCanonicalUsdtTransfer(input: {
  network: "trc20" | "bep20";
  recipient: string;
  contract: string;
  symbol: string;
  rawAmount: string;
  decimals: number;
  expectedUsd: number;
}): { ok: true } | { ok: false; reason: string } {
  const isBsc = input.network === "bep20";
  const normalize = (value: string) => isBsc ? value.toLowerCase() : value;
  const expectedRecipient = isBsc ? TSIA_BEP20_ADDRESS : TSIA_TRC20_ADDRESS;
  const expectedContract = isBsc ? BSC_USDT_CONTRACT : TRON_USDT_CONTRACT;

  if (normalize(input.recipient) !== normalize(expectedRecipient)) {
    return { ok: false, reason: "recipient mismatch" };
  }
  if (normalize(input.contract) !== normalize(expectedContract)) {
    return { ok: false, reason: "token contract mismatch" };
  }
  if (input.symbol.toUpperCase() !== "USDT") {
    return { ok: false, reason: "unsupported token" };
  }
  if (!Number.isFinite(input.expectedUsd) || input.decimals < 2 || input.decimals > 30) {
    return { ok: false, reason: "invalid token amount metadata" };
  }

  try {
    const expectedCents = String(Math.round(input.expectedUsd * 100));
    const expectedUnits = `${expectedCents}${"0".repeat(input.decimals - 2)}`.replace(/^0+(?=\d)/, "");
    const actualUnits = input.rawAmount.replace(/^0+(?=\d)/, "");
    if (!/^\d+$/.test(actualUnits) || actualUnits !== expectedUnits) {
      return { ok: false, reason: "token amount does not exactly match the submitted amount" };
    }
  } catch {
    return { ok: false, reason: "invalid token amount" };
  }

  return { ok: true };
}