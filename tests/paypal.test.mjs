import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { capturePayPalOrder, createPayPalOrder, readPayPalOrder } from '../server/paypal.mjs';

const sandbox = 'https://api-m.sandbox.paypal.com';
const expected = { id: 'ORDER1234', reference: 'unit-test-reference', amountCents: 500, captureId: 'CAPTURE1234' };
let credentials = 0;

function order(status = 'COMPLETED') {
  return {
    id: expected.id, status: 'COMPLETED',
    purchase_units: [{
      reference_id: expected.reference, amount: { currency_code: 'USD', value: '5.00' },
      payments: { captures: [{ id: expected.captureId, status, amount: { currency_code: 'USD', value: '5.00' } }] },
    }],
  };
}

function gateway(t, { token, remote = () => order() } = {}) {
  const previous = { client: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  process.env.PAYPAL_CLIENT_ID = `paypal-unit-client-${++credentials}`;
  process.env.PAYPAL_CLIENT_SECRET = 'paypal-unit-secret-only';
  t.after(() => {
    if (previous.client === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = previous.client;
    if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
  });
  const calls = [];
  let tokens = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const call = { url: new URL(url), options };
    assert.equal(call.url.origin, sandbox, 'all provider traffic stays on the fixed Sandbox host');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(Object.hasOwn(options, 'cacheEntry'), false, 'private OAuth cache metadata is never sent to fetch');
    calls.push(call);
    let result;
    if (call.url.pathname === '/v1/oauth2/token') {
      tokens += 1;
      assert.equal(options.method, 'POST');
      assert.equal(options.body, 'grant_type=client_credentials');
      result = token ? await token(call, tokens) : { access_token: `unit-token-${tokens}`, expires_in: 3600 };
    } else {
      result = await remote(call);
    }
    return result instanceof Response ? result : new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  });
  return {
    calls,
    oauth: () => calls.filter(call => call.url.pathname === '/v1/oauth2/token'),
    operations: () => calls.filter(call => call.url.pathname !== '/v1/oauth2/token'),
  };
}

test('reconciliation uses only an order GET and preserves the verified capture identity', async t => {
  const mock = gateway(t);
  assert.deepEqual(await readPayPalOrder(expected), { status: 'completed', captureId: expected.captureId });
  assert.deepEqual(mock.operations().map(call => [call.options.method, call.url.pathname]), [['GET', `/v2/checkout/orders/${expected.id}`]]);
  assert.equal(mock.operations()[0].options.body, undefined);
  assert.equal(mock.operations()[0].options.headers['PayPal-Request-Id'], undefined);
});

test('both initial capture and reconciliation recognize each supported capture status', async t => {
  let response;
  const mock = gateway(t, { remote: () => response });
  const states = { PENDING: 'pending', COMPLETED: 'completed', DECLINED: 'failed', FAILED: 'failed', REFUNDED: 'refunded', PARTIALLY_REFUNDED: 'partially_refunded' };
  for (const [provider, local] of Object.entries(states)) {
    response = order(provider);
    assert.deepEqual(await readPayPalOrder(expected), { status: local, captureId: expected.captureId });
    assert.deepEqual(await capturePayPalOrder(expected), { status: local, captureId: expected.captureId });
  }
  assert.equal(mock.oauth().length, 1);
});

test('order-level completion does not turn a pending capture into a completed payment', async t => {
  gateway(t, { remote: () => order('PENDING') });
  assert.equal((await readPayPalOrder(expected)).status, 'pending');
});

test('read and capture normalize valid USD decimal amounts without floating point arithmetic', async t => {
  let response;
  gateway(t, { remote: () => response });
  for (const value of ['5', '5.0', '5.00', '0005.00']) {
    response = order();
    response.purchase_units[0].amount.value = value;
    response.purchase_units[0].payments.captures[0].amount.value = value;
    assert.equal((await readPayPalOrder(expected)).status, 'completed');
    assert.equal((await capturePayPalOrder(expected)).status, 'completed');
  }
  response = order();
  delete response.purchase_units[0].amount; // Capture responses can omit the unit-level amount.
  assert.equal((await capturePayPalOrder(expected)).status, 'completed');
});

test('reconciliation rejects every mismatched binding, malformed representation and unknown state', async t => {
  let response;
  const mock = gateway(t, { remote: () => response });
  const invalid = [
    ['another order', data => { data.id = 'OTHERORDER'; }],
    ['another reference', data => { data.purchase_units[0].reference_id = 'other-reference'; }],
    ['another capture', data => { data.purchase_units[0].payments.captures[0].id = 'OTHERCAPTURE'; }],
    ['missing capture ID', data => { delete data.purchase_units[0].payments.captures[0].id; }],
    ['empty capture ID', data => { data.purchase_units[0].payments.captures[0].id = ''; }],
    ['blank capture ID', data => { data.purchase_units[0].payments.captures[0].id = ' '; }],
    ['missing units', data => { delete data.purchase_units; }],
    ['null unit', data => { data.purchase_units = [null]; }],
    ['multiple units', data => { data.purchase_units.push(structuredClone(data.purchase_units[0])); }],
    ['units must be an array', data => { data.purchase_units = { 0: data.purchase_units[0], length: 1 }; }],
    ['missing captures', data => { delete data.purchase_units[0].payments.captures; }],
    ['null capture', data => { data.purchase_units[0].payments.captures = [null]; }],
    ['multiple captures', data => { data.purchase_units[0].payments.captures.push(structuredClone(data.purchase_units[0].payments.captures[0])); }],
    ['captures must be an array', data => { data.purchase_units[0].payments.captures = { 0: data.purchase_units[0].payments.captures[0], length: 1 }; }],
    ['capture currency', data => { data.purchase_units[0].payments.captures[0].amount.currency_code = 'EUR'; }],
    ['capture amount mismatch', data => { data.purchase_units[0].payments.captures[0].amount.value = '5.01'; }],
    ['unit amount mismatch', data => { data.purchase_units[0].amount.value = '5.01'; }],
    ['unit currency', data => { data.purchase_units[0].amount.currency_code = 'EUR'; }],
    ['unknown capture state', data => { data.purchase_units[0].payments.captures[0].status = 'FUTURE_STATE'; }],
    ['prototype name is not a state', data => { data.purchase_units[0].payments.captures[0].status = 'toString'; }],
    ['completed capture on incomplete order', data => { data.status = 'APPROVED'; }],
    ['refund on incomplete order', data => { data.status = 'APPROVED'; data.purchase_units[0].payments.captures[0].status = 'REFUNDED'; }],
  ];
  for (const [label, mutate] of invalid) {
    response = order(); mutate(response);
    const before = mock.operations().length;
    await assert.rejects(readPayPalOrder(expected), /does not match|unsupported capture state/, label);
    assert.equal(mock.operations().length, before + 1, label + ' was checked against the provider response');
    assert.equal(mock.operations().at(-1).options.method, 'GET');
  }
});

test('invalid decimal formats cannot be accepted as the expected payment', async t => {
  let value;
  gateway(t, { remote: () => {
    const data = order(); data.purchase_units[0].payments.captures[0].amount.value = value; return data;
  } });
  for (value of ['5.000', '5e0', '+5.00', '-5.00', ' 5.00', '5.00 ', '.50', '5.', '', 5, null]) {
    await assert.rejects(readPayPalOrder(expected), /does not match/);
  }
});

test('invalid local identity, amount and missing stored capture fail before provider access', async t => {
  const mock = gateway(t);
  for (const overrides of [
    { id: '../capture' }, { id: '' }, { id: null }, { reference: '' }, { reference: null },
    { amountCents: 0 }, { amountCents: -1 }, { amountCents: 500.5 }, { amountCents: Number.MAX_SAFE_INTEGER + 1 },
    { captureId: undefined }, { captureId: '' }, { captureId: ' ' }, { captureId: 123 },
  ]) await assert.rejects(readPayPalOrder({ ...expected, ...overrides }));
  assert.equal(mock.calls.length, 0);
});

test('ORDER_ALREADY_CAPTURED recovers through GET with the original stable capture request ID', async t => {
  const mock = gateway(t, { remote: call => {
    if (call.options.method === 'POST') return new Response(JSON.stringify({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }), { status: 422 });
    return order('REFUNDED');
  } });
  assert.deepEqual(await capturePayPalOrder(expected), { status: 'refunded', captureId: expected.captureId });
  assert.deepEqual(await capturePayPalOrder(expected), { status: 'refunded', captureId: expected.captureId });
  const operations = mock.operations();
  assert.deepEqual(operations.map(call => call.options.method), ['POST', 'GET', 'POST', 'GET']);
  const requestId = createHash('sha256').update(`capture:${expected.reference}`).digest('hex').slice(0, 38);
  assert.equal(operations[0].options.headers['PayPal-Request-Id'], requestId);
  assert.equal(operations[2].options.headers['PayPal-Request-Id'], requestId);
  assert.equal(operations[0].options.body, '{}');
});

test('capture failures other than ORDER_ALREADY_CAPTURED are not repeated or converted into success', async t => {
  let status;
  const mock = gateway(t, { remote: () => new Response(JSON.stringify({ details: [{ issue: 'ORDER_NOT_APPROVED' }] }), { status }) });
  for (status of [401, 403, 404, 422, 429, 500]) {
    const before = mock.operations().length;
    await assert.rejects(capturePayPalOrder(expected), error => error.paypalStatus === status);
    assert.equal(mock.operations().length, before + 1);
  }
});

test('OAuth cache is reused and refreshed before its provider expiry', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const mock = gateway(t);
  await readPayPalOrder(expected);
  now += 3_569_999;
  await readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 1);
  now += 1;
  await readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 2, 'refresh starts thirty seconds before provider expiry');
  assert.deepEqual(mock.operations().map(call => call.options.headers.Authorization), ['Bearer unit-token-1', 'Bearer unit-token-1', 'Bearer unit-token-2']);
});

test('tokens without a usable lifetime are accepted for the operation but are not cached', async t => {
  const mock = gateway(t, { token: (_call, count) => ({ access_token: `unit-token-${count}` }) });
  await readPayPalOrder(expected);
  await readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 2);
});

test('credential rotation cannot reuse a token from a different client or secret', async t => {
  const mock = gateway(t);
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  await readPayPalOrder(expected);
  process.env.PAYPAL_CLIENT_SECRET = 'rotated-unit-secret-only';
  await readPayPalOrder(expected);
  process.env.PAYPAL_CLIENT_ID = `${client}-rotated`;
  await readPayPalOrder(expected);
  const decoded = mock.oauth().map(call => Buffer.from(call.options.headers.Authorization.slice('Basic '.length), 'base64').toString());
  assert.deepEqual(decoded, [`${client}:${secret}`, `${client}:rotated-unit-secret-only`, `${client}-rotated:rotated-unit-secret-only`]);
  assert.deepEqual(mock.operations().map(call => call.options.headers.Authorization), ['Bearer unit-token-1', 'Bearer unit-token-2', 'Bearer unit-token-3']);
});

test('a rejected cached bearer token is discarded without automatically repeating the operation', async t => {
  let reject = false;
  const mock = gateway(t, { remote: () => reject ? new Response('{}', { status: 401 }) : order() });
  await readPayPalOrder(expected);
  reject = true;
  await assert.rejects(readPayPalOrder(expected), error => error.paypalStatus === 401);
  assert.equal(mock.oauth().length, 1);
  reject = false;
  await readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 2);
  assert.equal(mock.operations().length, 3);
});

test('an old credential request cannot invalidate the new credential cache', async t => {
  const firstStarted = Promise.withResolvers(), firstResponse = Promise.withResolvers();
  let operations = 0;
  const mock = gateway(t, {
    token: () => ({ access_token: 'same-mocked-token-value', expires_in: 3600 }),
    remote: async () => {
      operations += 1;
      if (operations === 1) { firstStarted.resolve(); return firstResponse.promise; }
      return order();
    },
  });
  const first = assert.rejects(readPayPalOrder(expected), error => error.paypalStatus === 401);
  await firstStarted.promise;
  process.env.PAYPAL_CLIENT_SECRET = 'new-unit-secret-only';
  await readPayPalOrder(expected);
  firstResponse.resolve(new Response('{}', { status: 401 }));
  await first;
  await readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 2, 'the new credential keeps its own cached token');
});

test('concurrent OAuth callers share a request and cancelling one keeps the other active', async t => {
  const tokenReady = Promise.withResolvers();
  let tokenSignal;
  const mock = gateway(t, { token: async call => { tokenSignal = call.options.signal; return tokenReady.promise; } });
  const controller = new AbortController();
  const first = assert.rejects(readPayPalOrder({ ...expected, signal: controller.signal }), { name: 'AbortError' });
  const second = readPayPalOrder(expected);
  assert.equal(mock.oauth().length, 1);
  controller.abort();
  await first;
  assert.equal(tokenSignal.aborted, false, 'the surviving caller still needs this shared token request');
  tokenReady.resolve({ access_token: 'shared-token', expires_in: 3600 });
  assert.equal((await second).status, 'completed');
  assert.equal(mock.operations().length, 1, 'the cancelled caller must not send an order GET');
});

test('when all OAuth callers cancel the fetch is aborted and the next caller can retry', async t => {
  let signal;
  const mock = gateway(t, { token: (call, count) => {
    if (count > 1) return { access_token: 'recovered-token', expires_in: 3600 };
    signal = call.options.signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const controller = new AbortController();
  const first = assert.rejects(readPayPalOrder({ ...expected, signal: controller.signal }), { name: 'AbortError' });
  controller.abort();
  await first;
  assert.equal(signal.aborted, true);
  assert.equal((await readPayPalOrder(expected)).status, 'completed');
  assert.equal(mock.oauth().length, 2);
  assert.equal(mock.operations().length, 1);
});

test('an already-cancelled reconciliation never obtains credentials or queries the order', async t => {
  const mock = gateway(t);
  await assert.rejects(readPayPalOrder({ ...expected, signal: AbortSignal.abort() }), { name: 'AbortError' });
  assert.equal(mock.calls.length, 0);
});

test('caller cancellation aborts an in-flight order GET without falling back to capture', async t => {
  const started = Promise.withResolvers();
  const mock = gateway(t, { remote: call => new Promise((resolve, reject) => {
    started.resolve(call.options.signal);
    call.options.signal.addEventListener('abort', () => reject(call.options.signal.reason), { once: true });
  }) });
  const controller = new AbortController();
  const result = assert.rejects(readPayPalOrder({ ...expected, signal: controller.signal }), { name: 'AbortError' });
  const signal = await started.promise;
  controller.abort();
  await result;
  assert.equal(signal.aborted, true);
  assert.deepEqual(mock.operations().map(call => call.options.method), ['GET']);
});

test('the 12-second provider deadline remains active when a caller signal is supplied', async t => {
  const mock = gateway(t);
  let deadlines = 0;
  t.mock.method(AbortSignal, 'timeout', delay => {
    assert.equal(delay, 12_000);
    deadlines += 1;
    return deadlines === 1 ? new AbortController().signal : AbortSignal.abort(new DOMException('Mock deadline', 'TimeoutError'));
  });
  await assert.rejects(readPayPalOrder({ ...expected, signal: new AbortController().signal }), { name: 'TimeoutError' });
  assert.equal(mock.oauth().length, 1);
  assert.equal(mock.operations().length, 0);
  assert.equal(deadlines, 2);
});

test('invalid OAuth and malformed order responses cannot advance a payment', async t => {
  let token = {};
  const mock = gateway(t, { token: () => token, remote: () => new Response('not json') });
  await assert.rejects(readPayPalOrder(expected), /did not return an access token/);
  assert.equal(mock.operations().length, 0);
  token = { access_token: 'valid-unit-token', expires_in: 3600 };
  await assert.rejects(readPayPalOrder(expected), /returned an empty response/);
  assert.equal(mock.operations().length, 1);
});

test('creation retains separate stable idempotency and Sandbox approval-link validation', async t => {
  let approvalUrl = 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1234';
  const mock = gateway(t, { remote: () => ({ id: expected.id, links: [{ rel: 'payer-action', href: approvalUrl }] }) });
  const request = { kind: 'donation', amountCents: 500, reference: expected.reference, origin: 'https://helpani.example.test' };
  assert.deepEqual(await createPayPalOrder(request), { id: expected.id, approvalUrl });
  const created = mock.operations()[0];
  const body = JSON.parse(created.options.body);
  assert.equal(body.purchase_units[0].amount.value, '5.00');
  assert.equal(body.payment_source.paypal.experience_context.return_url, 'https://helpani.example.test/api/paypal/return');
  assert.equal(created.options.headers['PayPal-Request-Id'], createHash('sha256').update(`create:${expected.reference}`).digest('hex').slice(0, 38));
  for (approvalUrl of ['https://www.paypal.com/checkoutnow', 'https://www.sandbox.paypal.com.evil.test/checkoutnow', 'http://www.sandbox.paypal.com/checkoutnow', 'https://user:password@www.sandbox.paypal.com/checkoutnow', 'https://www.sandbox.paypal.com:444/checkoutnow']) {
    await assert.rejects(createPayPalOrder(request), /outside the Sandbox/);
  }
});
