import assert from "node:assert/strict";
import test from "node:test";
import {
  BSC_USDT_CONTRACT,
  TRON_USDT_CONTRACT,
  TSIA_BEP20_ADDRESS,
  TSIA_TRC20_ADDRESS,
  validateCanonicalUsdtTransfer,
} from "./cryptoDepositPolicy";

test("crypto verification accepts only canonical USDT and the exact submitted amount", () => {
  assert.deepEqual(validateCanonicalUsdtTransfer({
    network: "trc20",
    recipient: TSIA_TRC20_ADDRESS,
    contract: TRON_USDT_CONTRACT,
    symbol: "USDT",
    rawAmount: "5000000",
    decimals: 6,
    expectedUsd: 5,
  }), { ok: true });

  assert.equal(validateCanonicalUsdtTransfer({
    network: "trc20",
    recipient: TSIA_TRC20_ADDRESS,
    contract: "TFakeTokenContract",
    symbol: "USDT",
    rawAmount: "5000000",
    decimals: 6,
    expectedUsd: 5,
  }).ok, false);

  assert.equal(validateCanonicalUsdtTransfer({
    network: "bep20",
    recipient: TSIA_BEP20_ADDRESS,
    contract: BSC_USDT_CONTRACT,
    symbol: "USDT",
    rawAmount: "4990000000000000000",
    decimals: 18,
    expectedUsd: 5,
  }).ok, false);
});