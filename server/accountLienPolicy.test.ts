import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isUserFundsOutRequest, normalizeApiPath } from "./accountLienPolicy";

test("normalizes mounted API paths without losing route parameters", () => {
  assert.equal(normalizeApiPath("/api/wallet/send?source=swift"), "/wallet/send");
  assert.equal(normalizeApiPath("/trade/withdraw"), "/trade/withdraw");
});

test("classifies every product's user-initiated funds-out routes", () => {
  const coveredRequests: Array<[string, string]> = [
    ["POST", "/api/wallet/send"],
    ["POST", "/api/wallet/withdraw__disabled"],
    ["POST", "/api/fintech/crypto-withdraw"],
    ["POST", "/api/fintech/bank-transfer"],
    ["POST", "/api/fintech/airtime"],
    ["POST", "/api/wallet/bill"],
    ["POST", "/api/korapay/payout"],
    ["POST", "/api/trade/fund-from-wallet"],
    ["POST", "/api/trade/transfer-to-wallet"],
    ["POST", "/api/trade/reinvest"],
    ["POST", "/api/trade/withdraw"],
    ["POST", "/api/trade/bot/activate"],
    ["POST", "/api/trade/signals/enter"],
    ["POST", "/api/trade/manual/open"],
    ["POST", "/api/affiliate/withdraw-commission"],
    ["POST", "/api/affiliate/scholarship-sponsor-code"],
    ["POST", "/api/co-affiliate/subscribe"],
    ["POST", "/api/co-affiliate/withdraw"],
    ["POST", "/api/qce/contribute"],
    ["POST", "/api/qce/withdraw"],
    ["POST", "/api/savings/goals/42/deposit"],
    ["POST", "/api/savings/goals/42/withdraw"],
    ["POST", "/api/back-to-school/children/7/contributions"],
    ["POST", "/api/back-to-school/children/7/withdrawals"],
    ["POST", "/api/exchange/fund"],
    ["POST", "/api/exchange/withdraw"],
    ["POST", "/api/exchange/order"],
    ["POST", "/api/p2p/offers"],
    ["POST", "/api/p2p/orders"],
    ["PATCH", "/api/p2p/orders/9/paid"],
    ["PATCH", "/api/p2p/orders/9/complete"],
    ["POST", "/api/orders"],
    ["POST", "/api/orders/31/mark-received"],
    ["POST", "/api/tour/book"],
    ["POST", "/api/movies/subscribe"],
    ["POST", "/api/sponsorship/select"],
    ["POST", "/api/verification/pay-fee"],
    ["POST", "/api/scholarship/pay-commitment"],
  ];

  for (const [method, path] of coveredRequests) {
    assert.equal(isUserFundsOutRequest(method, path), true, `${method} ${path}`);
  }
});

test("allows incoming credits, refunds, reads, and non-financial account activity", () => {
  const allowedRequests: Array<[string, string]> = [
    ["POST", "/api/wallet/deposit"],
    ["POST", "/api/wallet/paystack/verify"],
    ["POST", "/api/trade/deposit"],
    ["POST", "/api/trade/korapay/verify"],
    ["POST", "/api/exchange/korapay/verify"],
    ["DELETE", "/api/p2p/offers/4"],
    ["PATCH", "/api/p2p/orders/4/cancel"],
    ["POST", "/api/loans/4/respond"],
    ["POST", "/api/auth/logout"],
    ["PATCH", "/api/user/profile"],
    ["GET", "/api/wallet"],
  ];

  for (const [method, path] of allowedRequests) {
    assert.equal(isUserFundsOutRequest(method, path), false, `${method} ${path}`);
  }
});

test("server guard checks linked accounts and serializes against admin lien changes", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const middlewareStart = routes.indexOf("// A lien is an account-wide funds-out lock.");
  const middlewareEnd = routes.indexOf("const requireWalletFundingIdentity", middlewareStart);
  const middleware = routes.slice(middlewareStart, middlewareEnd);

  assert.match(routes, /pg_try_advisory_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(routes, /pg_advisory_unlock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(middleware, /LOWER\(TRIM\(u\.email\)\) = \$1/);
  assert.match(middleware, /u\.id = \$2/);
  assert.match(middleware, /w\.lien_amount::numeric > 0/);
  assert.match(routes, /fundsLockPool\.connect\(\)/);
  assert.match(routes, /lockClient\.release\(error as Error\)/);
  assert.match(middleware, /res\.once\("finish"/);
  assert.match(middleware, /code: "ACCOUNT_LIENED"/);

  const adminSetStart = routes.indexOf('app.post("/api/admin/wallet-liens/:userId"');
  const adminReleaseEnd = routes.indexOf("// ─── ADMIN: Edit disbursement", adminSetStart);
  const adminLienRoutes = routes.slice(adminSetStart, adminReleaseEnd);
  assert.equal(
    (adminLienRoutes.match(/withAccountFundsLock\(targetId/g) ?? []).length,
    2,
    "both lien placement and release must use the same account lock",
  );
});

test("loan lifecycle cannot overwrite or release a different active lien", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const helperStart = routes.indexOf("const placeLoanLien");
  const helperEnd = routes.indexOf("// A lien is an account-wide funds-out lock.", helperStart);
  const loanLienHelpers = routes.slice(helperStart, helperEnd);

  assert.match(
    loanLienHelpers,
    /if \(currentAmount > 0\)[\s\S]*existing account lien must be resolved[\s\S]*setWalletLien/,
    "loan activation must refuse to replace any active lien",
  );
  assert.match(
    loanLienHelpers,
    /expectedReasons\.has\(currentWallet\.lienReason \?\? ""\)[\s\S]*releaseWalletLien/,
    "loan completion must only release its own matching lien",
  );

  const adminLoanStart = routes.indexOf('app.post("/api/admin/loans/:id/status"');
  const adminLoanEnd = routes.indexOf("// ─── ADMIN: All transactions", adminLoanStart);
  const adminLoanRoute = routes.slice(adminLoanStart, adminLoanEnd);
  assert.ok(
    adminLoanRoute.indexOf("placeLoanLien(") < adminLoanRoute.indexOf("storage.updateLoan(loanId, updatePayload)"),
    "admin activation must validate and place the lien before changing loan state",
  );

  const userLoanStart = routes.indexOf('app.post("/api/loans/:id/respond"');
  const userLoanEnd = routes.indexOf("// ───", userLoanStart + 20);
  const userLoanRoute = routes.slice(userLoanStart, userLoanEnd);
  assert.ok(
    userLoanRoute.indexOf("placeLoanLien(") < userLoanRoute.indexOf('storage.updateLoan(loanId, { status: "active"'),
    "user acceptance must place the lien before changing loan state",
  );
});
