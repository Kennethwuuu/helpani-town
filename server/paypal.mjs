import { createHash } from "node:crypto";

const SANDBOX_API = "https://api-m.sandbox.paypal.com";
const ORDERS_PATH = "/v2/checkout/orders";
const ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const TIMEOUT_MS = 12_000;

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

async function sandboxRequest(path, options) {
  const response = await fetch(new URL(path, SANDBOX_API), {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`PayPal Sandbox request failed (HTTP ${response.status}).`);
    error.paypalIssue = data?.details?.[0]?.issue;
    throw error;
  }
  if (!data) throw new Error("PayPal Sandbox returned an empty response.");
  return data;
}

async function getAccessToken() {
  if (!paypalConfigured()) throw new Error("PayPal Sandbox credentials are missing.");
  const clientId = process.env.PAYPAL_CLIENT_ID.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET.trim();
  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const data = await sandboxRequest("/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("PayPal Sandbox did not return an access token.");
  }
  return data.access_token;
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

export async function createPayPalOrder({ kind, amountCents, reference, origin }) {
  const amount = formatAmount(amountCents);
  const returnUrl = new URL("/api/paypal/return", origin);
  const cancelUrl = new URL("/support?payment=cancelled#records", origin);
  const accessToken = await getAccessToken();
  const order = await sandboxRequest(ORDERS_PATH, {
    method: "POST",
    headers: writeHeaders(accessToken, "create", reference),
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

export async function capturePayPalOrder({ id, reference, amountCents }) {
  if (typeof id !== "string" || !ORDER_ID_PATTERN.test(id)) {
    throw new Error("The PayPal order ID is invalid.");
  }
  const expectedAmount = formatAmount(amountCents);
  const accessToken = await getAccessToken();
  const orderPath = `${ORDERS_PATH}/${id}`;
  let order;
  try {
    order = await sandboxRequest(`${orderPath}/capture`, {
      method: "POST",
      headers: writeHeaders(accessToken, "capture", reference),
      body: "{}",
    });
  } catch (error) {
    if (error.paypalIssue !== "ORDER_ALREADY_CAPTURED") throw error;
    order = await sandboxRequest(orderPath, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const units = order.purchase_units;
  const captures = units?.[0]?.payments?.captures;
  const capture = captures?.[0];
  const value = typeof capture?.amount?.value === "string"
    ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(capture.amount.value)
    : null;
  const capturedAmount = value
    ? `${value[1].replace(/^0+(?=\d)/, "")}.${(value[2] ?? "").padEnd(2, "0")}`
    : null;
  if (order.id !== id || units?.length !== 1 || units[0].reference_id !== reference
    || captures?.length !== 1 || typeof capture.id !== "string" || !capture.id
    || capture.amount?.currency_code !== "USD" || capturedAmount !== expectedAmount) {
    throw new Error("The PayPal Sandbox capture does not match the expected order.");
  }
  if (capture.status === "PENDING") return { status: "pending", captureId: capture.id };
  if (order.status !== "COMPLETED" || capture.status !== "COMPLETED") {
    throw new Error("PayPal Sandbox did not complete the capture.");
  }
  return { status: "completed", captureId: capture.id };
}
