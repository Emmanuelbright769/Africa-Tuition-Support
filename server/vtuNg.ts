/**
 * VTU.ng API v2 helper
 * Base URL: https://vtu.ng/wp-json
 *
 * Auth: POST /jwt-auth/v1/token  → Bearer JWT (expires 7 days)
 * Token is cached in memory and refreshed automatically on every call
 * (VTU.ng invalidates older tokens when a new one is issued, so we
 * re-authenticate before each transactional request to stay current).
 */

const VTU_BASE = "https://vtu.ng/wp-json";
const TIMEOUT_MS = 30_000;

interface VtuToken { token: string; fetchedAt: number }
let _cachedToken: VtuToken | null = null;
const TOKEN_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (expires after 7)

async function getToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && now - _cachedToken.fetchedAt < TOKEN_TTL_MS) {
    return _cachedToken.token;
  }
  const username = process.env.VTUNG_USERNAME;
  const password = process.env.VTUNG_PASSWORD;
  if (!username || !password) throw new Error("VTU.ng credentials not configured (VTUNG_USERNAME / VTUNG_PASSWORD)");

  const r = await fetch(`${VTU_BASE}/jwt-auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const d = await r.json() as any;
  if (!d.token) throw new Error(`VTU.ng auth failed: ${d.message ?? JSON.stringify(d)}`);
  _cachedToken = { token: d.token, fetchedAt: now };
  console.log("[VTUNG] JWT refreshed");
  return d.token;
}

function reqId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function vtuPost(path: string, body: Record<string, any>): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${VTU_BASE}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return r.json();
}

async function vtuGet(path: string): Promise<any> {
  const token = await getToken();
  const r = await fetch(`${VTU_BASE}${path}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return r.json();
}

// ── Public (no auth) ────────────────────────────────────────────────────────

export async function vtuGetDataVariations(serviceId?: string): Promise<any> {
  // Use authenticated endpoint for better coverage (all networks including Glo)
  return vtuGet(`/api/v2/variations/data${serviceId ? `?service_id=${serviceId}` : ""}`);
}

export async function vtuGetTvVariations(serviceId?: string): Promise<any> {
  return vtuGet(`/api/v2/variations/tv${serviceId ? `?service_id=${serviceId}` : ""}`);
}

// ── Customer verification ────────────────────────────────────────────────────

export async function vtuVerifyCustomer(customerId: string, serviceId: string, variationId?: string): Promise<any> {
  const body: any = { customer_id: customerId, service_id: serviceId };
  if (variationId) body.variation_id = variationId;
  return vtuPost("/api/v2/verify-customer", body);
}

// ── Airtime ─────────────────────────────────────────────────────────────────

export async function vtuBuyAirtime(phone: string, serviceId: string, amountNgn: number): Promise<{ ok: boolean; msg?: string; orderId?: number; status?: string; ref: string }> {
  const ref = reqId("AIR");
  try {
    const d = await vtuPost("/api/v2/airtime", { request_id: ref, phone, service_id: serviceId, amount: amountNgn });
    const ok = d.code === "success" && d.data?.status !== "refunded" && d.data?.status !== "failed";
    return { ok, msg: d.message ?? d.code, orderId: d.data?.order_id, status: d.data?.status, ref };
  } catch (e: any) {
    return { ok: false, msg: e.message, ref };
  }
}

// ── Data ────────────────────────────────────────────────────────────────────

export async function vtuBuyData(phone: string, serviceId: string, variationId: string | number): Promise<{ ok: boolean; msg?: string; orderId?: number; status?: string; ref: string; planName?: string }> {
  const ref = reqId("DATA");
  try {
    const d = await vtuPost("/api/v2/data", { request_id: ref, phone, service_id: serviceId, variation_id: String(variationId) });
    const ok = d.code === "success" && d.data?.status !== "refunded" && d.data?.status !== "failed";
    return { ok, msg: d.message ?? d.code, orderId: d.data?.order_id, status: d.data?.status, ref, planName: d.data?.data_plan };
  } catch (e: any) {
    return { ok: false, msg: e.message, ref };
  }
}

// ── Electricity ──────────────────────────────────────────────────────────────

export async function vtuBuyElectricity(customerId: string, serviceId: string, meterType: "prepaid" | "postpaid", amountNgn: number): Promise<{ ok: boolean; msg?: string; orderId?: number; status?: string; ref: string; token?: string; units?: string; customerName?: string }> {
  const ref = reqId("ELEC");
  try {
    const d = await vtuPost("/api/v2/electricity", { request_id: ref, customer_id: customerId, service_id: serviceId, variation_id: meterType, amount: amountNgn });
    const ok = d.code === "success" && d.data?.status !== "refunded" && d.data?.status !== "failed";
    return { ok, msg: d.message ?? d.code, orderId: d.data?.order_id, status: d.data?.status, ref, token: d.data?.token ?? undefined, units: d.data?.units ?? undefined, customerName: d.data?.customer_name };
  } catch (e: any) {
    return { ok: false, msg: e.message, ref };
  }
}

// ── Cable TV ─────────────────────────────────────────────────────────────────

export async function vtuBuyTv(customerId: string, serviceId: string, variationId: string | number, subscriptionType?: "change" | "renew", amount?: number): Promise<{ ok: boolean; msg?: string; orderId?: number; status?: string; ref: string; customerName?: string }> {
  const ref = reqId("TV");
  const body: any = { request_id: ref, customer_id: customerId, service_id: serviceId, variation_id: String(variationId) };
  if (subscriptionType) body.subscription_type = subscriptionType;
  if (amount) body.amount = amount;
  try {
    const d = await vtuPost("/api/v2/tv", body);
    const ok = d.code === "success" && d.data?.status !== "refunded" && d.data?.status !== "failed";
    return { ok, msg: d.message ?? d.code, orderId: d.data?.order_id, status: d.data?.status, ref, customerName: d.data?.customer_name };
  } catch (e: any) {
    return { ok: false, msg: e.message, ref };
  }
}

// ── Betting ──────────────────────────────────────────────────────────────────

export async function vtuFundBetting(customerId: string, serviceId: string, amountNgn: number): Promise<{ ok: boolean; msg?: string; orderId?: number; status?: string; ref: string; customerName?: string }> {
  const ref = reqId("BET");
  try {
    const d = await vtuPost("/api/v2/betting", { request_id: ref, customer_id: customerId, service_id: serviceId, amount: amountNgn });
    const ok = d.code === "success" && d.data?.status !== "refunded" && d.data?.status !== "failed";
    return { ok, msg: d.message ?? d.code, orderId: d.data?.order_id, status: d.data?.status, ref, customerName: d.data?.customer_name };
  } catch (e: any) {
    return { ok: false, msg: e.message, ref };
  }
}

// ── Wallet balance check ─────────────────────────────────────────────────────

export async function vtuGetBalance(): Promise<{ ok: boolean; balance?: number; msg?: string }> {
  try {
    const d = await vtuGet("/api/v2/balance");
    if (d.code === "success") return { ok: true, balance: d.data?.balance };
    return { ok: false, msg: d.message };
  } catch (e: any) {
    return { ok: false, msg: e.message };
  }
}

// ── Requery ──────────────────────────────────────────────────────────────────

export async function vtuRequery(requestId: string): Promise<any> {
  return vtuPost("/api/v2/requery", { request_id: requestId });
}
