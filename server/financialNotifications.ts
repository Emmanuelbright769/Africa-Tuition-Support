import { and, eq, sql } from "drizzle-orm";
import { ADMIN_EMAIL, sendTransactionReceiptEmail, type ReceiptEmailRow } from "./email";
import { db } from "./db";
import { pushToUser } from "./realtime";
import { financialEventOutbox, financialEvents, notifications } from "@shared/schema";
import {
  FINANCIAL_CLAIM_TIMEOUT_MS,
  FINANCIAL_DELIVERY_TYPES,
  MAX_FINANCIAL_DELIVERY_ATTEMPTS,
  financialRetryDelayMs,
  safeDeliveryError,
  type FinancialDeliveryType,
} from "./financialNotificationPolicy";

export type FinancialReceipt = {
  title: string;
  status: "success" | "processing" | "pending";
  amount: string;
  amountLabel?: string;
  reference: string;
  rows: ReceiptEmailRow[];
  footerNote?: string;
};

/** This payload is persisted as a transaction-time snapshot; do not put credentials or OTPs in it. */
export type FinancialNotificationPayload = {
  userEmail: string;
  userFirstName: string;
  receipt: FinancialReceipt;
  adminEmail?: string;
  inApp: { title: string; message: string; data?: Record<string, unknown> };
};

export type EnqueueFinancialEventInput = {
  eventKey: string;
  userId: number;
  eventType: string;
  payload: FinancialNotificationPayload;
};

type FinancialWriter = {
  insert: typeof db.insert;
  select: typeof db.select;
};

const isDeliveryType = (value: string): value is FinancialDeliveryType =>
  (FINANCIAL_DELIVERY_TYPES as readonly string[]).includes(value);

/**
 * Enqueue with the same transaction that records the financial state when
 * possible. `writer` may be a Drizzle transaction; omitting it starts one.
 */
export async function enqueueFinancialEventInTransaction(
  writer: FinancialWriter,
  input: EnqueueFinancialEventInput,
): Promise<{ eventId: number; created: boolean }> {
  if (!input.eventKey.trim()) throw new Error("Financial event key is required");

  const inserted = await writer.insert(financialEvents)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: financialEvents.id });
  let eventId = inserted[0]?.id;
  const created = eventId !== undefined;

  if (eventId === undefined) {
    const [existing] = await writer.select({ id: financialEvents.id })
      .from(financialEvents)
      .where(eq(financialEvents.eventKey, input.eventKey))
      .limit(1);
    if (!existing) throw new Error("Financial event could not be enqueued");
    eventId = existing.id;
  }

  // These inserts also repair an event written by an interrupted older deploy.
  await writer.insert(financialEventOutbox).values(
    FINANCIAL_DELIVERY_TYPES.map((deliveryType) => ({ financialEventId: eventId!, deliveryType })),
  ).onConflictDoNothing();
  return { eventId, created };
}

export function enqueueFinancialEvent(input: EnqueueFinancialEventInput) {
  return db.transaction((tx) => enqueueFinancialEventInTransaction(tx, input));
}

type ClaimedDelivery = {
  id: number;
  eventKey: string;
  userId: number;
  eventType: string;
  payload: FinancialNotificationPayload;
  deliveryType: string;
  attempts: number;
};

/**
 * Atomically leases pending work. SKIP LOCKED permits multiple workers, and
 * expired leases recover a process that died while handling a provider call.
 */
export async function claimFinancialEventDeliveries(workerId: string, limit = 25): Promise<ClaimedDelivery[]> {
  if (!workerId.trim()) throw new Error("Financial notification worker id is required");
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await db.execute(sql`
    WITH candidates AS (
      SELECT id FROM financial_event_outbox
      WHERE (status = 'pending' AND available_at <= NOW())
         OR (status = 'processing' AND claimed_at < NOW() - (${FINANCIAL_CLAIM_TIMEOUT_MS} * INTERVAL '1 millisecond'))
      ORDER BY available_at ASC, id ASC
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE financial_event_outbox AS outbox
    SET status = 'processing', attempts = outbox.attempts + 1,
        claimed_at = NOW(), claimed_by = ${workerId}, updated_at = NOW()
    FROM candidates, financial_events AS event
    WHERE outbox.id = candidates.id AND event.id = outbox.financial_event_id
    RETURNING outbox.id, outbox.delivery_type AS "deliveryType", outbox.attempts,
      event.event_key AS "eventKey", event.user_id AS "userId",
      event.event_type AS "eventType", event.payload
  `);
  return (result as unknown as { rows: ClaimedDelivery[] }).rows;
}

async function markDelivered(delivery: ClaimedDelivery, workerId: string): Promise<void> {
  await db.update(financialEventOutbox)
    .set({ status: "delivered", deliveredAt: new Date(), claimedAt: null, claimedBy: null, lastError: null, updatedAt: new Date() })
    .where(and(eq(financialEventOutbox.id, delivery.id), eq(financialEventOutbox.status, "processing"), eq(financialEventOutbox.claimedBy, workerId)));
}

async function rescheduleDelivery(delivery: ClaimedDelivery, workerId: string, error: unknown): Promise<void> {
  const exhausted = delivery.attempts >= MAX_FINANCIAL_DELIVERY_ATTEMPTS;
  await db.update(financialEventOutbox)
    .set({
      status: exhausted ? "failed" : "pending",
      availableAt: new Date(Date.now() + financialRetryDelayMs(delivery.attempts)),
      claimedAt: null,
      claimedBy: null,
      lastError: safeDeliveryError(error),
      updatedAt: new Date(),
    })
    .where(and(eq(financialEventOutbox.id, delivery.id), eq(financialEventOutbox.status, "processing"), eq(financialEventOutbox.claimedBy, workerId)));
}

async function deliverFinancialEvent(delivery: ClaimedDelivery): Promise<void> {
  if (!isDeliveryType(delivery.deliveryType)) throw new Error("Unknown financial delivery type");
  const { payload } = delivery;
  if (delivery.deliveryType === "user_email") {
    await sendTransactionReceiptEmail(payload.userEmail, payload.userFirstName, payload.receipt);
  } else if (delivery.deliveryType === "admin_email") {
    await sendTransactionReceiptEmail(payload.adminEmail || ADMIN_EMAIL, "TSIA Operations", {
      ...payload.receipt,
      title: `Admin copy — ${payload.receipt.title}`,
    });
  } else {
    const inserted = await db.insert(notifications).values({
      userId: delivery.userId,
      financialEventKey: delivery.eventKey,
      type: "system",
      title: payload.inApp.title,
      message: payload.inApp.message,
      data: { ...payload.inApp.data, financialEventKey: delivery.eventKey, eventType: delivery.eventType },
    }).onConflictDoNothing().returning({ id: notifications.id });
    if (inserted[0]) {
      pushToUser(delivery.userId, "notification", {
        id: inserted[0].id,
        title: payload.inApp.title, message: payload.inApp.message, financialEventKey: delivery.eventKey,
      });
    }
  }
}

/** Processes a bounded batch and intentionally logs only event identifiers, never payloads or provider errors. */
export async function processFinancialEventOutbox(workerId: string, limit = 25): Promise<{ claimed: number; delivered: number; retried: number }> {
  const deliveries = await claimFinancialEventDeliveries(workerId, limit);
  let delivered = 0;
  let retried = 0;
  for (const delivery of deliveries) {
    try {
      await deliverFinancialEvent(delivery);
      await markDelivered(delivery, workerId);
      delivered++;
    } catch (error) {
      await rescheduleDelivery(delivery, workerId, error);
      retried++;
      console.warn("[financial-outbox] delivery deferred", { deliveryType: delivery.deliveryType, attempt: delivery.attempts });
    }
  }
  return { claimed: deliveries.length, delivered, retried };
}