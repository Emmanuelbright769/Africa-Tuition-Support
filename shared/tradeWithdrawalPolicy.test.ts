import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPrivateTradeProgress } from "../server/tradeRoiProgress";

test("ROI progress uses cumulative realised profits, excluding current capital", () => {
  const result = getPrivateTradeProgress(133.164499, 99, 120);

  assert.equal(result.progressPct, 60);
  assert.equal(result.targetReached, false);
});

test("ROI progress scales net profit against each plan's private target", () => {
  const sixtyDay = getPrivateTradeProgress(169, 100, 60);
  assert.equal(sixtyDay.progressPct, 90);
  assert.equal(sixtyDay.targetReached, false);

  const ninetyDay = getPrivateTradeProgress(180, 100, 90);
  assert.equal(ninetyDay.progressPct, 100);
  assert.equal(ninetyDay.targetReached, true);

  const exactSixtyDayTarget = getPrivateTradeProgress(170, 100, 60);
  assert.equal(exactSixtyDayTarget.progressPct, 100);
  assert.equal(exactSixtyDayTarget.targetReached, true);

  const exactOneHundredPercentPromise = getPrivateTradeProgress(200, 100, 120);
  assert.equal(exactOneHundredPercentPromise.progressPct, 100);
  assert.equal(exactOneHundredPercentPromise.targetReached, true);
});

test("losses cannot produce false ROI progress", () => {
  const result = getPrivateTradeProgress(-29.385037, 30, 120);

  assert.equal(result.progressPct, 0);
  assert.equal(result.targetReached, false);
});

test("withdrawing realised earnings does not reduce cycle progress", () => {
  const beforeWithdrawal = getPrivateTradeProgress(150, 100, 90);
  const afterWithdrawal = getPrivateTradeProgress(150, 100, 90);

  assert.equal(beforeWithdrawal.progressPct, 80);
  assert.equal(afterWithdrawal.progressPct, 80);
});

test("Trade Market interfaces do not reveal private cycle return percentages", () => {
  const dashboard = readFileSync("client/src/pages/AffiliateDashboard.tsx", "utf8");
  const wallet = readFileSync("client/src/components/trade/TradeWalletView.tsx", "utf8");
  const assistant = readFileSync("client/src/components/AiAssistant.tsx", "utf8");
  const promo = readFileSync("client/src/pages/PromoLanding.tsx", "utf8");
  const terms = readFileSync("client/src/pages/TermsAndConditions.tsx", "utf8");
  const email = readFileSync("server/email.ts", "utf8");
  const routes = readFileSync("server/routes.ts", "utf8");
  const serverIndex = readFileSync("server/index.ts", "utf8");
  const completion = readFileSync("server/tradeBotCompletion.ts", "utf8");
  const publicPlans = readFileSync("shared/schema.ts", "utf8").slice(
    readFileSync("shared/schema.ts", "utf8").indexOf("export const TRADING_PLANS"),
    readFileSync("shared/schema.ts", "utf8").indexOf("export const TRADING_PLANS") + 800,
  );
  const userFacingTradeSource = `${dashboard}\n${wallet}\n${assistant}\n${promo}\n${terms}\n${email}\n${publicPlans}`;

  for (const forbidden of [
    "% cap",
    "% ROI",
    "% daily trades",
    "% / session",
    "profitCapPct",
    "plan.rateLabel",
    "activePlanConfig.rateLabel",
    "activePlanConfig.dailyRate",
    "2% daily ROI",
    "2% daily profit",
    "100% total return",
    "Earnings cap resets to 100%",
    "ratePercent",
    "Daily profit rate varies by plan",
    "4% (60-day)",
    "3% (90-day)",
    "2% (120-day)",
    "profitTarget",
    "remainingToTarget",
    "getTradeRoiProgress",
    "plan.lossMax",
  ]) {
    assert.equal(userFacingTradeSource.includes(forbidden), false, `leaked private return copy: ${forbidden}`);
  }

  const notificationSource = `${routes}\n${serverIndex}`;
  assert.equal(/(?:today'?s|daily|capture)[^\n"]*\b(?:2|3|4)%/i.test(notificationSource), false);
  assert.equal(completion.includes("ratePercent"), false, "bot completion response exposes the internal rate");
});