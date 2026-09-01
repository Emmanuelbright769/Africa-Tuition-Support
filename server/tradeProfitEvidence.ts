import { sql } from "drizzle-orm";

type TradeTransactionAlias = "t" | undefined;

function column(alias: TradeTransactionAlias, name: string) {
  return sql.raw(`${alias ? `${alias}.` : ""}${name}`);
}

export function canonicalBotProfitPredicate(alias?: TradeTransactionAlias) {
  const userId = column(alias, "user_id");
  const txHash = column(alias, "tx_hash");
  const createdAt = column(alias, "created_at");
  const note = column(alias, "note");
  return sql`
    ${column(alias, "type")} = 'bot_earning'
    AND ${column(alias, "status")} = 'completed'
    AND ${column(alias, "amount_usd")}::numeric > 0
    AND (
      ${txHash} ~ (
        '^BOT-SESSION-' || ${userId}::text ||
        '-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
      )
      OR (
        ${txHash} IS NULL
        AND ${createdAt} < '2026-09-01T00:00:00Z'::timestamptz
        AND COALESCE(${note}, '') ~
          '^Bot session day [0-9]+/(60|90|120): [0-9]+([.][0-9]+)?h → [0-9]+([.][0-9]+)?% on [$][0-9]+([.][0-9]+)?$'
      )
    )
  `;
}

export function isCanonicalBotProfitRecord(record: {
  userId: number;
  type: string;
  status: string;
  amountUsd: number;
  txHash: string | null;
  note?: string | null;
  createdAt?: Date | string;
}) {
  const escapedUserId = String(record.userId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sessionHash = new RegExp(
    `^BOT-SESSION-${escapedUserId}-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$`,
  );
  const modernEvidence = typeof record.txHash === "string" && sessionHash.test(record.txHash);
  const legacyEvidence = record.txHash === null
    && new Date(record.createdAt ?? 0).getTime() < Date.parse("2026-09-01T00:00:00Z")
    && /^Bot session day [0-9]+\/(60|90|120): [0-9]+([.][0-9]+)?h → [0-9]+([.][0-9]+)?% on [$][0-9]+([.][0-9]+)?$/.test(record.note ?? "");
  return record.type === "bot_earning"
    && record.status === "completed"
    && record.amountUsd > 0
    && (modernEvidence || legacyEvidence);
}