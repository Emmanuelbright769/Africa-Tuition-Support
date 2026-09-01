import { sql } from "drizzle-orm";
import { db } from "./db";

export const SERVICE_WALLET_TYPES = ["manual", "signals", "tsmart"] as const;
export type ServiceWalletType = typeof SERVICE_WALLET_TYPES[number];

type Executor = { execute(query: unknown): Promise<any> };
const rows = <T>(result: any): T[] => result?.rows ?? [];

export function isServiceWalletType(value: string): value is ServiceWalletType {
  return (SERVICE_WALLET_TYPES as readonly string[]).includes(value);
}
function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
}
function assertCentAmount(amount: number) {
  assertAmount(amount);
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
    throw new Error("Amount must use no more than two decimal places");
  }
}
async function verified(tx: Executor, userId: number) {
  const result = await tx.execute(sql`SELECT 1 FROM identity_verifications
    WHERE user_id = ${userId} AND status = 'verified'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (document_expires_at IS NULL OR document_expires_at > NOW()) LIMIT 1`);
  if (!rows(result).length) throw new Error("Completed identity verification is required before a service wallet can be credited");
}
export async function getOrCreateServiceWalletAtomic(userId: number, serviceType: ServiceWalletType) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-wallet:${serviceType}`}), ${userId})`);
    await tx.execute(sql`INSERT INTO service_wallets (user_id, service_type, balance)
      VALUES (${userId}, ${serviceType}, 0) ON CONFLICT (user_id, service_type) DO NOTHING`);
    const result = await tx.execute(sql`SELECT * FROM service_wallets WHERE user_id = ${userId} AND service_type = ${serviceType}`);
    const wallet = rows<any>(result)[0]; if (!wallet) throw new Error("Unable to create service wallet"); return wallet;
  });
}
export async function debitServiceWalletInTransaction(tx: Executor, input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string; kind: string; metadata?: object }) {
  assertAmount(input.amount);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-wallet:${input.serviceType}`}), ${input.userId})`);
  await tx.execute(sql`INSERT INTO service_wallets (user_id, service_type, balance) VALUES (${input.userId}, ${input.serviceType}, 0) ON CONFLICT DO NOTHING`);
  const result = await tx.execute(sql`UPDATE service_wallets SET balance = balance - ${input.amount.toFixed(6)}, updated_at = NOW()
    WHERE user_id = ${input.userId} AND service_type = ${input.serviceType} AND balance >= ${input.amount.toFixed(6)} RETURNING id, balance`);
  const wallet = rows<any>(result)[0]; if (!wallet) throw new Error(`Insufficient ${input.serviceType} wallet balance`);
  await tx.execute(sql`INSERT INTO service_wallet_transactions (wallet_id, user_id, service_type, amount, reference, kind, metadata)
    VALUES (${wallet.id}, ${input.userId}, ${input.serviceType}, ${(-input.amount).toFixed(6)}, ${input.reference}, ${input.kind}, ${JSON.stringify(input.metadata ?? {})}::jsonb)`);
  return wallet;
}
export async function creditServiceWalletInTransaction(tx: Executor, input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string; kind: string; metadata?: object }) {
  assertAmount(input.amount);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-wallet:${input.serviceType}`}), ${input.userId})`);
  await tx.execute(sql`INSERT INTO service_wallets (user_id, service_type, balance) VALUES (${input.userId}, ${input.serviceType}, 0) ON CONFLICT DO NOTHING`);
  const result = await tx.execute(sql`UPDATE service_wallets SET balance = balance + ${input.amount.toFixed(6)}, updated_at = NOW()
    WHERE user_id = ${input.userId} AND service_type = ${input.serviceType} RETURNING id, balance`);
  const wallet = rows<any>(result)[0]; if (!wallet) throw new Error("Unable to credit service wallet");
  await tx.execute(sql`INSERT INTO service_wallet_transactions (wallet_id, user_id, service_type, amount, reference, kind, metadata)
    VALUES (${wallet.id}, ${input.userId}, ${input.serviceType}, ${input.amount.toFixed(6)}, ${input.reference}, ${input.kind}, ${JSON.stringify(input.metadata ?? {})}::jsonb)`);
  return wallet;
}
export async function transferSwiftToServiceWalletAtomic(input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string }) {
  assertCentAmount(input.amount);
  return db.transaction(async tx => {
    await verified(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"swift-wallet-balance"}), ${input.userId})`);
    const swift = rows<any>(await tx.execute(sql`UPDATE wallets SET balance = balance - ${input.amount.toFixed(2)}
      WHERE user_id = ${input.userId} AND balance >= ${input.amount.toFixed(2)} RETURNING balance`))[0];
    if (!swift) throw new Error("Insufficient SwiftWallet balance");
    const wallet = await creditServiceWalletInTransaction(tx, { ...input, kind: "swift_transfer_in" });
    await tx.execute(sql`INSERT INTO transactions (user_id, type, amount, fee, payment_method, description)
      VALUES (${input.userId}, 'trade_transfer', ${(-input.amount).toFixed(2)}, 0, 'internal', ${`SwiftWallet to ${input.serviceType} wallet (${input.reference})`})`);
    return { swiftBalance: swift.balance, serviceBalance: wallet.balance };
  });
}
export async function transferServiceToSwiftWalletAtomic(input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string }) {
  assertCentAmount(input.amount);
  return db.transaction(async tx => {
    await verified(tx, input.userId);
    const wallet = await debitServiceWalletInTransaction(tx, { ...input, kind: "swift_transfer_out" });
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"swift-wallet-balance"}), ${input.userId})`);
    const swift = rows<any>(await tx.execute(sql`UPDATE wallets SET balance = balance + ${input.amount.toFixed(2)}
      WHERE user_id = ${input.userId} RETURNING balance`))[0];
    if (!swift) throw new Error("SwiftWallet not found");
    await tx.execute(sql`INSERT INTO transactions (user_id, type, amount, fee, payment_method, description)
      VALUES (${input.userId}, 'deposit', ${input.amount.toFixed(2)}, 0, 'internal', ${`${input.serviceType} wallet to SwiftWallet (${input.reference})`})`);
    return { swiftBalance: swift.balance, serviceBalance: wallet.balance };
  });
}
export async function createServiceDepositIntentAtomic(input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string; metadata: object }) {
  assertCentAmount(input.amount);
  return db.transaction(async tx => {
    await verified(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-wallet:${input.serviceType}`}), ${input.userId})`);
    const existing = rows<any>(await tx.execute(sql`SELECT * FROM wallet_deposits WHERE tx_hash = ${input.reference} FOR UPDATE`))[0];
    if (existing) {
      if (existing.user_id === input.userId && existing.wallet_type === `service_${input.serviceType}_korapay` && Number(existing.amount_usd) === Number(input.amount.toFixed(2))) return existing;
      throw new Error("Payment reference already belongs to another deposit");
    }
    const result = await tx.execute(sql`INSERT INTO wallet_deposits (user_id, amount_usd, tx_hash, wallet_type, status, metadata)
      VALUES (${input.userId}, ${input.amount.toFixed(2)}, ${input.reference}, ${`service_${input.serviceType}_korapay`}, 'pending', ${JSON.stringify(input.metadata)}::jsonb) RETURNING *`);
    return rows<any>(result)[0];
  });
}
export async function creditServiceDepositAtomic(input: { userId: number; serviceType: ServiceWalletType; amount: number; reference: string }) {
  assertAmount(input.amount);
  return db.transaction(async tx => {
    await verified(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`service-wallet:${input.serviceType}`}), ${input.userId})`);
    const deposit = rows<any>(await tx.execute(sql`SELECT * FROM wallet_deposits WHERE user_id = ${input.userId} AND tx_hash = ${input.reference} AND wallet_type = ${`service_${input.serviceType}_korapay`} FOR UPDATE`))[0];
    if (!deposit) throw new Error("No matching service wallet deposit intent exists");
    if (["completed", "verified"].includes(deposit.status)) return { credited: false };
    if (!["pending", "confirmed"].includes(deposit.status) || Number(deposit.amount_usd) !== Number(input.amount.toFixed(2))) throw new Error("Deposit is not eligible for credit");
    const claim = rows<any>(await tx.execute(sql`INSERT INTO wallet_credit_claims (provider, reference, user_id, deposit_id)
      VALUES (${`service_${input.serviceType}_korapay`}, ${input.reference.trim().toLowerCase()}, ${input.userId}, ${deposit.id})
      ON CONFLICT (provider, reference) DO NOTHING RETURNING id`))[0];
    if (!claim) return { credited: false };
    const wallet = await creditServiceWalletInTransaction(tx, { userId: input.userId, serviceType: input.serviceType, amount: input.amount, reference: `deposit-${input.reference}`, kind: "korapay_deposit", metadata: { depositId: deposit.id } });
    await tx.execute(sql`UPDATE wallet_deposits SET status = 'completed', verified_at = NOW(), updated_at = NOW() WHERE id = ${deposit.id}`);
    return { credited: true, balance: wallet.balance };
  });
}