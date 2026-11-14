import { createHash } from "node:crypto";

const SANDBOX_API = "https://api-m.sandbox.paypal.com";
const ORDERS_PATH = "/v2/checkout/orders";
const ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const TIMEOUT_MS = 12_000;
const TOKEN_REFRESH_EARLY_MS = 30_000;
const CAPTURE_STATUSES = new Map([
  ["PENDING", "pending"], ["COMPLETED", "completed"], ["DECLINED", "failed"], ["FAILED", "failed"],
  ["REFUNDED", "refunded"], ["PARTIALLY_REFUNDED", "partially_refunded"],
]);
let tokenCache;

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

async function sandboxRequest(path, { signal: callerSignal, cacheEntry, ...options } = {}) {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
  signal.throwIfAborted();
  const response = await fetch(new URL(path, SANDBOX_API), {
    ...options,
    redirect: "error",
    signal,
  });
  const data = await response.json().catch(() => { signal.throwIfAborted(); return null; });
  signal.throwIfAborted();
  if (!response.ok) {
    if (response.status === 401 && cacheEntry?.token
      && options.headers?.Authorization === `Bearer ${cacheEntry.token}`) {
      cacheEntry.token = undefined;
      cacheEntry.expiresAt = 0;
    }
    const error = new Error(`PayPal Sandbox request failed (HTTP ${response.status}).`);
    error.paypalIssue = data?.details?.[0]?.issue;
    error.paypalStatus = response.status;
    throw error;
  }
  if (!data) throw new Error("PayPal Sandbox returned an empty response.");
  return data;
}

function waitForToken(pending, signal) {
  if (signal?.aborted) {
    if (!pending.done && pending.waiters.size === 0) pending.controller.abort();
    return Promise.reject(signal.reason);
  }
  const waiter = {};
  pending.waiters.add(waiter);
  return new Promise((resolve, reject) => {
    const release = () => {
      signal?.removeEventListener("abort", abort);
      pending.waiters.delete(waiter);
    };
    const abort = () => {
      release();
      // A cancelled caller must not cancel a token another request still needs.
      if (!pending.done && pending.waiters.size === 0) pending.controller.abort();
      reject(signal.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    pending.promise.then(
      (token) => { release(); resolve(token); },
      (error) => { release(); reject(error); },
    );
  });
}

async function getAccessToken(signal) {
  signal?.throwIfAborted();
  if (!paypalConfigured()) throw new Error("PayPal Sandbox credentials are missing.");
  const clientId = process.env.PAYPAL_CLIENT_ID.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET.trim();
  const key = JSON.stringify([clientId, secret]);
  // Rotation discards the previous credential's cache. An older in-flight
  // request can finish for its own callers without replacing the new cache.
  if (tokenCache?.key !== key) tokenCache = { key, expiresAt: 0 };
  const entry = tokenCache;
  if (entry.token && Date.now() < entry.expiresAt) return { accessToken: entry.token, cacheEntry: entry };
  if (entry.pending?.controller.signal.aborted) entry.pending = null;
  if (!entry.pending) {
    const startedAt = Date.now();
    const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const pending = { controller: new AbortController(), waiters: new Set(), done: false };
    entry.pending = pending;
    pending.promise = (async () => {
      const data = await sandboxRequest("/v1/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: pending.controller.signal,
      });
      if (typeof data.access_token !== "string" || !data.access_token.trim()) {
        throw new Error("PayPal Sandbox did not return an access token.");
      }
      const lifetime = Number.isSafeInteger(data.expires_in) && data.expires_in > 0
        ? data.expires_in * 1000 : 0;
      entry.expiresAt = startedAt + Math.max(0, lifetime - TOKEN_REFRESH_EARLY_MS);
      entry.token = data.access_token;
      return data.access_token;
    })().finally(() => {
      pending.done = true;
      if (entry.pending === pending) entry.pending = null;
    });
    // Callers can all cancel before a shared token request finishes.
    pending.promise.catch(() => {});
  }
  const accessToken = await waitForToken(entry.pending, signal);
  signal?.throwIfAborted();
  return { accessToken, cacheEntry: entry };
}

function writeHeaders(accessToken, operation, reference) {
  const requestId = createHash("sha256").update(`${operation}:${reference}`).digest("hex");
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "PayPal-Request-Id": requestId.slice(0, 38),
    Prefer: "return=representation",
  };
}

function formatAmount(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("The PayPal amount must be a positive integer in cents.");
  }
  const cents = String(amountCents).padStart(3, "0");
  return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

export async function createPayPalOrder({ kind, amountCents, reference, origin, signal }) {
  const amount = formatAmount(amountCents);
  const returnUrl = new URL("/api/paypal/return", origin);
  const cancelUrl = new URL("/support?payment=cancelled#records", origin);
  const { accessToken, cacheEntry } = await getAccessToken(signal);
  const order = await sandboxRequest(ORDERS_PATH, {
    method: "POST",
    headers: writeHeaders(accessToken, "create", reference),
    signal,
    cacheEntry,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: reference,
        description: kind === "supply"
          ? "Helpani Town rescue supply funding (sandbox)"
          : "Helpani Town project support (sandbox)",
        amount: { currency_code: "USD", value: amount },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl.href,
            cancel_url: cancelUrl.href,
          },
        },
      },
    }),
  });
  const approval = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve");
  if (!ORDER_ID_PATTERN.test(order.id ?? "") || typeof approval?.href !== "string") {
    throw new Error("PayPal Sandbox did not return an approval link for this order.");
  }
  const approvalUrl = new URL(approval.href);
  const sandboxHost = approvalUrl.hostname === "www.sandbox.paypal.com"
    || approvalUrl.hostname === "sandbox.paypal.com";
  if (!sandboxHost || approvalUrl.protocol !== "https:" || approvalUrl.port
    || approvalUrl.username || approvalUrl.password) {
    throw new Error("PayPal returned a checkout URL outside the Sandbox.");
  }
  return { id: order.id, approvalUrl: approvalUrl.href };
}

function expectedOrder({ id, reference, amountCents }) {
  if (typeof id !== "string" || !ORDER_ID_PATTERN.test(id)) {
    throw new Error("The PayPal order ID is invalid.");
  }
  if (typeof reference !== "string" || !reference.trim()) {
    throw new Error("The PayPal order reference is invalid.");
  }
  return { id, reference, expectedAmount: formatAmount(amountCents) };
}

function normalizedAmount(amount) {
  const value = typeof amount?.value === "string" ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.value) : null;
  return value && amount.currency_code === "USD"
    ? `${value[1].replace(/^0+(?=\d)/, "")}.${(value[2] ?? "").padEnd(2, "0")}`
    : null;
}

function verifiedCapture(order, { id, reference, expectedAmount, captureId }) {
  const units = order?.purchase_units;
  const unit = units?.[0];
  const captures = unit?.payments?.captures;
  const capture = captures?.[0];
  if (order?.id !== id || !Array.isArray(units) || units.length !== 1 || unit?.reference_id !== reference
    || !Array.isArray(captures) || captures.length !== 1 || typeof capture?.id !== "string" || !capture.id.trim()
    || (captureId !== undefined && capture.id !== captureId)
    || normalizedAmount(capture.amount) !== expectedAmount
    || (unit.amount !== undefined && normalizedAmount(unit.amount) !== expectedAmount)) {
    throw new Error("The PayPal Sandbox capture does not match the expected order.");
  }
  const status = CAPTURE_STATUSES.get(capture.status);
  if (!status || (["completed", "refunded", "partially_refunded"].includes(status) && order.status !== "COMPLETED")) {
    throw new Error("PayPal Sandbox returned an unsupported capture state.");
  }
  return { status, captureId: capture.id };
}

export async function capturePayPalOrder({ id, reference, amountCents, signal }) {
  const expected = expectedOrder({ id, reference, amountCents });
  const { accessToken, cacheEntry } = await getAccessToken(signal);
  const orderPath = `${ORDERS_PATH}/${id}`;
  let order;
  try {
    order = await sandboxRequest(`${orderPath}/capture`, {
      method: "POST",
      headers: writeHeaders(accessToken, "capture", reference),
      body: "{}",
      signal,
      cacheEntry,
    });
  } catch (error) {
    if (error.paypalIssue !== "ORDER_ALREADY_CAPTURED") throw error;
    order = await sandboxRequest(orderPath, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
      cacheEntry,
    });
  }
  return verifiedCapture(order, expected);
}

export async function readPayPalOrder({ id, reference, amountCents, captureId, signal }) {
  const expected = expectedOrder({ id, reference, amountCents });
  if (typeof captureId !== "string" || !captureId.trim()) {
    throw new Error("A previously verified PayPal capture ID is required for reconciliation.");
  }
  const { accessToken, cacheEntry } = await getAccessToken(signal);
  const order = await sandboxRequest(`${ORDERS_PATH}/${id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
    cacheEntry,
  });
  return verifiedCapture(order, { ...expected, captureId });
}
