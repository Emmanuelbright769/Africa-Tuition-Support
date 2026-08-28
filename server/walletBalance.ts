import { sql } from "drizzle-orm";
import { db } from "./db";

type SqlExecutor = {
  execute(query: unknown): Promise<unknown>;
};

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []);
  }
  return [];
}

export async function acquireWalletUserLock(executor: SqlExecutor, userId: number): Promise<void> {
  await executor.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${"swift-wallet-balance"}), ${userId})
  `);
}

export async function creditWalletBalanceAtomic(
  userId: number,
  amount: number,
): Promise<{ balance: string; activated: boolean }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Wallet credit must be a positive amount");
  }
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, userId);
    await tx.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${userId}, 0, FALSE, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `);
    const result = await tx.execute(sql`
      UPDATE wallets
      SET balance = balance + ${amount.toFixed(2)}
      WHERE user_id = ${userId}
      RETURNING balance::numeric AS balance, activated
    `);
    const wallet = rowsOf<{ balance: string; activated: boolean }>(result)[0];
    if (!wallet) throw new Error("Unable to credit wallet");
    return wallet;
  });
}

export async function creditVerifiedDepositAtomic(input: {
  depositId: number;
  userId: number;
  userCredit: number;
  fee: number;
  provider: string;
  reference: string;
  description: string;
  finalStatus?: "completed" | "verified";
}): Promise<{ credited: boolean; balance?: string; activated?: boolean; transactionId?: number }> {
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, input.userId);

    const claimResult = await tx.execute(sql`
      INSERT INTO wallet_credit_claims (provider, reference, user_id, deposit_id)
      VALUES (
        ${input.provider.toLowerCase()},
        ${input.reference.trim().toLowerCase()},
        ${input.userId},
        ${input.depositId}
      )
      ON CONFLICT (provider, reference) DO NOTHING
      RETURNING id
    `);
    if (rowsOf<{ id: number }>(claimResult).length === 0) {
      await tx.execute(sql`
        UPDATE wallet_deposits
        SET status = 'duplicate'
        WHERE id = ${input.depositId}
          AND status IN ('pending', 'confirmed')
      `);
      return { credited: false };
    }

    const depositResult = await tx.execute(sql`
      UPDATE wallet_deposits
      SET status = 'crediting'
      WHERE id = ${input.depositId}
        AND user_id = ${input.userId}
        AND status IN ('pending', 'confirmed')
      RETURNING id
    `);
    if (rowsOf<{ id: number }>(depositResult).length === 0) {
      throw new Error("Deposit is not eligible for credit");
    }

    await tx.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${input.userId}, 0, FALSE, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `);
    const walletResult = await tx.execute(sql`
      UPDATE wallets
      SET balance = balance + ${input.userCredit.toFixed(2)}
      WHERE user_id = ${input.userId}
      RETURNING balance::numeric AS balance, activated
    `);
    const wallet = rowsOf<{ balance: string; activated: boolean }>(walletResult)[0];
    if (!wallet) throw new Error("Unable to credit wallet");

    const transactionResult = await tx.execute(sql`
      INSERT INTO transactions (user_id, type, amount, fee, payment_method, description)
      VALUES (
        ${input.userId}, 'deposit', ${input.userCredit.toFixed(2)},
        ${input.fee.toFixed(2)}, ${input.provider}, ${input.description}
      )
      RETURNING id
    `);
    const transactionId = rowsOf<{ id: number }>(transactionResult)[0]?.id;
    await tx.execute(sql`
      UPDATE wallet_deposits
      SET status = ${input.finalStatus ?? "completed"}
      WHERE id = ${input.depositId}
    `);

    return {
      credited: true,
      balance: wallet.balance,
      activated: wallet.activated,
      transactionId,
    };
  });
}