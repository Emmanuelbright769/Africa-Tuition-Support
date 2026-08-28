export const SPONSOR_CODE_PRICE_USD = 5.5;

export type SponsorCodeBuyer = {
  id: number;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

export type SponsorCodePurchaseTx = {
  findPurchase(userId: number, idempotencyKey: string): Promise<{ id: number } | undefined>;
  getWallet(userId: number): Promise<{ id: number; balance: string } | undefined>;
  createWallet(userId: number): Promise<{ id: number; balance: string }>;
  createCohort(data: {
    sponsorName: string;
    sponsorEmail: string;
    sponsorPhone: string | null;
    code: string;
  }): Promise<{ id: number }>;
  createTransaction(data: {
    userId: number;
    amount: string;
    code: string;
  }): Promise<{ id: number }>;
  createPurchase(data: {
    affiliateUserId: number;
    cohortId: number;
    transactionId: number;
    code: string;
    amountUsd: string;
    reference: string;
    idempotencyKey: string;
  }): Promise<{ id: number }>;
  debitWallet(walletId: number, amountUsd: number): Promise<{ balance: string } | undefined>;
};

export function isValidSponsorCodeIdempotencyKey(value: string): boolean {
  return /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

export async function executeSponsorCodePurchase(
  tx: SponsorCodePurchaseTx,
  data: {
    buyer: SponsorCodeBuyer;
    amountUsd: number;
    idempotencyKey: string;
    generateCode: () => string;
  },
): Promise<{ purchaseId: number; walletBalance: string; replayed: boolean }> {
  if (data.buyer.role !== "affiliate") {
    throw new Error("Only affiliates can purchase scholarship codes.");
  }
  if (!isValidSponsorCodeIdempotencyKey(data.idempotencyKey)) {
    throw new Error("A valid Idempotency-Key is required to safely purchase a code.");
  }

  const existing = await tx.findPurchase(data.buyer.id, data.idempotencyKey);
  if (existing) {
    const wallet = await tx.getWallet(data.buyer.id);
    return { purchaseId: existing.id, walletBalance: wallet?.balance ?? "0.00", replayed: true };
  }

  let wallet = await tx.getWallet(data.buyer.id);
  if (!wallet) wallet = await tx.createWallet(data.buyer.id);
  const balance = parseFloat(wallet.balance);
  if (!Number.isFinite(balance) || balance < data.amountUsd) {
    throw new Error(`Insufficient balance. You need $${data.amountUsd.toFixed(2)}.`);
  }

  const code = data.generateCode();
  const reference = `SC-${code}`;
  const cohort = await tx.createCohort({
    sponsorName: `${data.buyer.firstName} ${data.buyer.lastName} (Affiliate Scholarship)`,
    sponsorEmail: data.buyer.email,
    sponsorPhone: data.buyer.phone || null,
    code,
  });
  const transaction = await tx.createTransaction({
    userId: data.buyer.id,
    amount: (-data.amountUsd).toFixed(2),
    code,
  });
  const purchase = await tx.createPurchase({
    affiliateUserId: data.buyer.id,
    cohortId: cohort.id,
    transactionId: transaction.id,
    code,
    amountUsd: data.amountUsd.toFixed(2),
    reference,
    idempotencyKey: data.idempotencyKey,
  });
  const debitedWallet = await tx.debitWallet(wallet.id, data.amountUsd);
  if (!debitedWallet) {
    throw new Error(`Insufficient balance. You need $${data.amountUsd.toFixed(2)}.`);
  }
  const walletBalance = debitedWallet.balance;
  return { purchaseId: purchase.id, walletBalance, replayed: false };
}