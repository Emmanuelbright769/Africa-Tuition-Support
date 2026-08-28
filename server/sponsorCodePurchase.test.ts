import assert from "node:assert/strict";
import test from "node:test";
import {
  executeSponsorCodePurchase,
  isValidSponsorCodeIdempotencyKey,
  type SponsorCodePurchaseTx,
} from "./sponsorCodePurchase";

type State = {
  balance: string;
  cohorts: { id: number; code: string }[];
  transactions: { id: number; amount: string }[];
  purchases: { id: number; userId: number; key: string; code: string }[];
};

const buyer = {
  id: 7,
  role: "affiliate",
  firstName: "Ada",
  lastName: "Okafor",
  email: "ada@example.test",
  phone: "",
};

function adapter(state: State, failAt?: "cohort" | "transaction" | "purchase" | "wallet"): SponsorCodePurchaseTx {
  return {
    async findPurchase(userId, key) {
      const row = state.purchases.find((purchase) => purchase.userId === userId && purchase.key === key);
      return row ? { id: row.id } : undefined;
    },
    async getWallet() {
      return { id: 1, balance: state.balance };
    },
    async createWallet() {
      return { id: 1, balance: state.balance };
    },
    async createCohort({ code }) {
      if (failAt === "cohort") throw new Error("cohort failed");
      const row = { id: state.cohorts.length + 1, code };
      state.cohorts.push(row);
      return row;
    },
    async createTransaction({ amount }) {
      if (failAt === "transaction") throw new Error("transaction failed");
      const row = { id: state.transactions.length + 1, amount };
      state.transactions.push(row);
      return row;
    },
    async createPurchase(data) {
      if (failAt === "purchase") throw new Error("purchase failed");
      const row = {
        id: state.purchases.length + 1,
        userId: data.affiliateUserId,
        key: data.idempotencyKey,
        code: data.code,
      };
      state.purchases.push(row);
      return row;
    },
    async debitWallet(_walletId, amountUsd) {
      if (failAt === "wallet") throw new Error("wallet failed");
      const current = Number(state.balance);
      if (current < amountUsd) return undefined;
      state.balance = (current - amountUsd).toFixed(2);
      return { balance: state.balance };
    },
  };
}

async function transactional<T>(state: State, action: (draft: State) => Promise<T>): Promise<T> {
  const draft = structuredClone(state);
  const result = await action(draft);
  Object.assign(state, draft);
  return result;
}

test("accepts only suitably strong idempotency keys", () => {
  assert.equal(isValidSponsorCodeIdempotencyKey("1234567890abcdef"), true);
  assert.equal(isValidSponsorCodeIdempotencyKey("too-short"), false);
  assert.equal(isValidSponsorCodeIdempotencyKey("invalid key with spaces"), false);
});

test("creates a code and one negative wallet transaction", async () => {
  const state: State = { balance: "20.00", cohorts: [], transactions: [], purchases: [] };
  const result = await transactional(state, (draft) => executeSponsorCodePurchase(adapter(draft), {
    buyer,
    amountUsd: 5.5,
    idempotencyKey: "purchase-request-0001",
    generateCode: () => "TSIA-TESTCODE01",
  }));
  assert.deepEqual(result, { purchaseId: 1, walletBalance: "14.50", replayed: false });
  assert.equal(state.balance, "14.50");
  assert.equal(state.cohorts.length, 1);
  assert.deepEqual(state.transactions, [{ id: 1, amount: "-5.50" }]);
  assert.equal(state.purchases[0]?.code, "TSIA-TESTCODE01");
});

test("rejects insufficient funds without creating financial records", async () => {
  const state: State = { balance: "5.49", cohorts: [], transactions: [], purchases: [] };
  await assert.rejects(() => transactional(state, (draft) => executeSponsorCodePurchase(adapter(draft), {
    buyer,
    amountUsd: 5.5,
    idempotencyKey: "purchase-request-0002",
    generateCode: () => "TSIA-TESTCODE02",
  })), /Insufficient balance/);
  assert.deepEqual(state, { balance: "5.49", cohorts: [], transactions: [], purchases: [] });
});

test("replays a completed request without charging twice", async () => {
  const state: State = { balance: "20.00", cohorts: [], transactions: [], purchases: [] };
  const request = {
    buyer,
    amountUsd: 5.5,
    idempotencyKey: "purchase-request-0003",
    generateCode: () => "TSIA-TESTCODE03",
  };
  await transactional(state, (draft) => executeSponsorCodePurchase(adapter(draft), request));
  const replay = await transactional(state, (draft) => executeSponsorCodePurchase(adapter(draft), request));
  assert.equal(replay.replayed, true);
  assert.equal(replay.purchaseId, 1);
  assert.equal(state.balance, "14.50");
  assert.equal(state.transactions.length, 1);
  assert.equal(state.purchases.length, 1);
});

test("rolls back all changes when purchase persistence fails", async () => {
  const state: State = { balance: "20.00", cohorts: [], transactions: [], purchases: [] };
  await assert.rejects(() => transactional(state, (draft) => executeSponsorCodePurchase(adapter(draft, "purchase"), {
    buyer,
    amountUsd: 5.5,
    idempotencyKey: "purchase-request-0004",
    generateCode: () => "TSIA-TESTCODE04",
  })), /purchase failed/);
  assert.deepEqual(state, { balance: "20.00", cohorts: [], transactions: [], purchases: [] });
});

test("does not allow a non-affiliate to use the purchase coordinator", async () => {
  const state: State = { balance: "20.00", cohorts: [], transactions: [], purchases: [] };
  await assert.rejects(() => executeSponsorCodePurchase(adapter(state), {
    buyer: { ...buyer, role: "student" },
    amountUsd: 5.5,
    idempotencyKey: "purchase-request-0005",
    generateCode: () => "TSIA-TESTCODE05",
  }), /Only affiliates/);
  assert.equal(state.transactions.length, 0);
});