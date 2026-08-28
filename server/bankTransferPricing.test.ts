import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BANK_TRANSFER_FEE_RATE,
  calculateBankTransferQuote,
} from "@shared/bankTransferPricing";

test("bank payout quote applies the fee before the admin exchange rate", () => {
  const quote = calculateBankTransferQuote(5, 1500);

  assert.equal(BANK_TRANSFER_FEE_RATE, 0.075);
  assert.deepEqual(quote, {
    amountUsd: 5,
    feeRate: 0.075,
    feeUsd: 0.38,
    netAmountUsd: 4.62,
    exchangeRate: 1500,
    recipientAmountNgn: 6930,
  });
});

test("bank payout quote safely handles incomplete amount entry", () => {
  assert.deepEqual(calculateBankTransferQuote(Number.NaN, 1500), {
    amountUsd: 0,
    feeRate: 0.075,
    feeUsd: 0,
    netAmountUsd: 0,
    exchangeRate: 1500,
    recipientAmountNgn: 0,
  });
});

test("Swift Hub uses authoritative pricing and renders the realtime breakdown", () => {
  const client = readFileSync(
    new URL("../client/src/pages/FinancialHub.tsx", import.meta.url),
    "utf8",
  );
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");

  assert.doesNotMatch(client, /ng:\s*\{[^}]*rate:\s*1_280/);
  assert.match(client, /\/api\/fintech\/bank-transfer-pricing/);
  assert.match(client, /bank-transfer-price-breakdown/);
  assert.match(client, /text-bank-fee/);
  assert.match(client, /text-bank-rate/);
  assert.match(client, /text-bank-recipient/);

  assert.match(routes, /getUsdNgnRates\(\)/);
  assert.match(routes, /calculateBankTransferQuote\(transferAmount,\s*rates\.selling\)/);
  assert.match(routes, /PAYOUT_PRICING_CHANGED/);
});