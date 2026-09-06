import { sql } from "drizzle-orm";
import { db } from "./db";
import { ADMIN_EMAIL } from "./email";
import { enqueueFinancialEventInTransaction } from "./financialNotifications";

type SqlExecutor = {
  execute(query: unknown): Promise<unknown>;
};

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []);
  }
  return [];
}

async function requireVerifiedIdentity(executor: SqlExecutor, userId: number): Promise<void> {
  const result = await executor.execute(sql`
    SELECT 1
    FROM identity_verifications
    WHERE user_id = ${userId}
      AND status = 'verified'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (document_expires_at IS NULL OR document_expires_at > NOW())
    LIMIT 1
  `);
  if (rowsOf(result).length === 0) {
    throw new Error("Completed identity verification is required before a wallet can be credited");
  }
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
      VALUES (${userId}, 0, TRUE, 0, 0)
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
  claimProvider?: string;
  reference: string;
  description: string;
  finalStatus?: "completed" | "verified";
  providerRecoveryVerified?: boolean;
}): Promise<{ credited: boolean; balance?: string; activated?: boolean; transactionId?: number }> {
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, input.userId);
    await requireVerifiedIdentity(tx, input.userId);

    const claimResult = await tx.execute(sql`
      INSERT INTO wallet_credit_claims (provider, reference, user_id, deposit_id)
      VALUES (
        ${(input.claimProvider ?? input.provider).toLowerCase()},
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
        AND (
          status IN ('pending', 'confirmed')
          OR (${input.providerRecoveryVerified === true} AND status IN ('rejected', 'manual_review'))
        )
      RETURNING id
    `);
    if (rowsOf<{ id: number }>(depositResult).length === 0) {
      throw new Error("Deposit is not eligible for credit");
    }

    await tx.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${input.userId}, 0, TRUE, 0, 0)
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
    if (!transactionId) throw new Error("Unable to create deposit ledger entry");
    if (input.fee > 0) {
      const affiliateCountResult = await tx.execute(sql`
        SELECT COUNT(*)::int AS count FROM users WHERE role = 'affiliate'
      `);
      const affiliateCount = Number(rowsOf<{ count: number }>(affiliateCountResult)[0]?.count ?? 0);
      await tx.execute(sql`
        INSERT INTO affiliate_trade_shares (
          transaction_id, total_pool_amount, affiliate_count, per_affiliate_amount, source_type
        ) VALUES (
          ${transactionId},
          ${input.fee.toFixed(6)},
          ${affiliateCount},
          ${(affiliateCount ? input.fee / affiliateCount : 0).toFixed(6)},
          'deposit'
        )
      `);
    }
    await tx.execute(sql`
      UPDATE wallet_deposits
      SET status = ${input.finalStatus ?? "completed"}
      WHERE id = ${input.depositId}
    `);

    const userResult = await tx.execute(sql`
      SELECT email, first_name AS "firstName", last_name AS "lastName"
      FROM users WHERE id = ${input.userId}
    `);
    const user = rowsOf<{ email: string; firstName: string; lastName: string }>(userResult)[0];
    if (!user) throw new Error("Deposit user not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `deposit:${input.provider.toLowerCase()}:${input.reference.trim().toLowerCase()}:credited`,
      userId: input.userId,
      eventType: "deposit_credited",
      payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Wallet Deposit Confirmed",
          status: "success",
          amount: `$${input.userCredit.toFixed(2)}`,
          amountLabel: `Net amount credited · fee $${input.fee.toFixed(2)}`,
          reference: input.reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "Destination", value: "TSIA SwiftWallet" },
            { label: "Method", value: input.provider.toUpperCase() },
            { label: "Status", value: "Verified and credited", color: "green" },
          ],
          footerNote: "This receipt was generated from the authoritative deposit and wallet ledger.",
        },
        inApp: {
          title: "Wallet Funded ✓",
          message: `$${input.userCredit.toFixed(2)} was verified and credited to your SwiftWallet.`,
          data: { depositId: input.depositId, transactionId, reference: input.reference },
        },
      },
    });

    return {
      credited: true,
      balance: wallet.balance,
      activated: wallet.activated,
      transactionId,
    };
  });
}