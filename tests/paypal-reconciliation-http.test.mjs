import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const sessionA = 'a'.repeat(64), sessionB = 'b'.repeat(64);
const processes = [];
let directory, runtime;

const gatewayMock = String.raw`
import { appendFileSync, readFileSync } from 'node:fs';
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
async function delay(milliseconds, signal) {
  if (signal?.aborted) throw signal.reason;
  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(signal.reason);
    const timer = setTimeout(() => finish(), milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input)), method = (options.method || 'GET').toUpperCase();
  const match = /^\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/.exec(url.pathname);
  appendFileSync(process.env.PAYPAL_MOCK_CALLS, JSON.stringify({
    method, path: url.pathname, orderId: match?.[1] || null, at: Date.now(),
  }) + '\n');
  if (url.origin !== 'https://api-m.sandbox.paypal.com') throw new Error('Real network is disabled in payment tests.');
  if (url.pathname === '/v1/oauth2/token' && method === 'POST') {
    return json({ access_token: 'isolated-payment-test-token', expires_in: 3600 });
  }
  const config = JSON.parse(readFileSync(process.env.PAYPAL_MOCK_CONFIG, 'utf8'));
  const row = match && config[match[1]];
  const capturing = Boolean(match?.[2]);
  if (!row || (!capturing && method !== 'GET') || (capturing && (method !== 'POST' || !row.allowCapture))) {
    throw new Error('Unexpected payment mutation or unknown mock order.');
  }
  if (row.delayMs) await delay(row.delayMs, options.signal);
  if (!capturing && row.httpStatus) return json({ details: [{ issue: 'MOCK_UPSTREAM_FAILURE' }] }, row.httpStatus);
  const status = capturing ? (row.captureStatus || 'PENDING') : (row.status || 'COMPLETED');
  const amount = { currency_code: row.currency || 'USD', value: row.amountValue || (row.amountCents / 100).toFixed(2) };
  return json({
    id: row.id, intent: 'CAPTURE', status: row.orderStatus || 'COMPLETED',
    purchase_units: [{
      reference_id: row.reference, amount,
      payments: { captures: [{ id: row.captureId || ('CAP' + row.id), status, amount, final_capture: true }] },
    }],
  });
};
`;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'helpani-paypal-reconciliation-http-'));
  runtime = join(directory, 'runtime');
  await mkdir(join(runtime, 'server'), { recursive: true });
  const source = fileURLToPath(new URL('../server/', import.meta.url));
  // Immutable local snapshot; no .env, player database, or real provider configuration.
  await Promise.all((await readdir(source)).filter(name => name.endsWith('.mjs')).map(async name => {
    await writeFile(join(runtime, 'server', name), await readFile(join(source, name)));
  }));
});

after(async () => {
  await Promise.all(processes.map(stop));
  if (directory) await rm(directory, { recursive: true, force: true });
});

function order(id, overrides = {}) {
  return {
    id, reference: randomUUID(), sessionId: sessionA, kind: 'donation',
    amountCents: 500, captureId: `CAP${id}`, status: 'pending', ...overrides,
  };
}

function database(path, action, readOnly = true) {
  const db = new DatabaseSync(path, { readOnly });
  try { db.exec('PRAGMA busy_timeout=5000'); return action(db); }
  finally { db.close(); }
}

function initialize(path, orders) {
  database(path, db => {
    // This is the original production schema, before terminal-status migration.
    db.exec(`CREATE TABLE paypal_orders (
      reference TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('donation','supply')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents>0), provider_id TEXT UNIQUE NOT NULL,
      capture_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','completed'))
    ) STRICT;
    CREATE TABLE town_events (session_id TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(session_id,kind)) STRICT;
    CREATE TABLE town_pets (session_id TEXT PRIMARY KEY NOT NULL, species TEXT NOT NULL) STRICT;
    CREATE TABLE pet_feeds (session_id TEXT NOT NULL, day TEXT NOT NULL, slot INTEGER NOT NULL, PRIMARY KEY(session_id,day,slot)) STRICT;
    CREATE TABLE activity_registrations (session_id TEXT NOT NULL, activity_id TEXT NOT NULL, verified INTEGER NOT NULL, PRIMARY KEY(session_id,activity_id)) STRICT;`);
    const insert = db.prepare('INSERT INTO paypal_orders VALUES (?,?,?,?,?,?,?)');
    for (const item of orders) insert.run(item.reference, item.sessionId, item.kind, item.amountCents, item.id, item.captureId, item.status);
    db.prepare('INSERT INTO town_pets VALUES (?,?)').run(sessionA, 'sea-turtle');
    db.prepare('INSERT INTO pet_feeds VALUES (?,?,?)').run(sessionA, '2026-11-13', 1);
    for (const kind of ['care', 'allocation']) db.prepare('INSERT INTO town_events VALUES (?,?)').run(sessionA, kind);
    db.prepare('INSERT INTO activity_registrations VALUES (?,?,?)').run(sessionA, 'park-cleanup', 1);
  }, false);
}

function otherLedgers(path) {
  return database(path, db => Object.fromEntries(['town_events', 'town_pets', 'pet_feeds', 'activity_registrations'].map(table => [
    table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row => ({ ...row })),
  ])));
}

async function stop(instance) {
  const { child, closed } = instance;
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await closed;
}

async function eventually(read, description, timeout = 7000) {
  const deadline = Date.now() + timeout;
  do {
    const result = await read();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 35));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${description}.`);
}

async function fixture(t, orders, outcomes = {}, environment = {}) {
  const path = await mkdtemp(join(directory, 'case-'));
  const dbPath = join(path, 'town.sqlite'), callsPath = join(path, 'calls.jsonl');
  const configPath = join(path, 'provider.json'), mockPath = join(path, 'provider.mjs');
  initialize(dbPath, orders);
  await writeFile(callsPath, ''); await writeFile(mockPath, gatewayMock);
  const values = Object.fromEntries(orders.map(item => [item.id, { ...item, status: 'PENDING', ...outcomes[item.id] }]));
  const client = {
    dbPath, origin: null,
    row: id => database(dbPath, db => ({ ...db.prepare('SELECT * FROM paypal_orders WHERE provider_id=?').get(id) })),
    queue: id => database(dbPath, db => {
      const row = db.prepare('SELECT * FROM paypal_reconciliations WHERE provider_id=?').get(id);
      return row ? { ...row } : null;
    }),
    calls: async () => (await readFile(callsPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
    set: async (id, updates) => {
      values[id] = { ...values[id], ...updates };
      await writeFile(configPath + '.next', JSON.stringify(values));
      await rename(configPath + '.next', configPath);
    },
    state: async (session = sessionA) => {
      const response = await fetch(client.origin + '/api/state', {
        headers: { Cookie: `helpani_demo=${session}` }, signal: AbortSignal.timeout(4000),
      });
      assert.equal(response.status, 200);
      return response.json();
    },
    returned: (id, session = sessionA) => fetch(client.origin + '/api/paypal/return?token=' + id, {
      headers: { Cookie: `helpani_demo=${session}` }, redirect: 'manual', signal: AbortSignal.timeout(4000),
    }),
    stop: () => stop(client.instance),
    start: async () => {
      const reservation = createServer(); reservation.listen(0, '127.0.0.1');
      await once(reservation, 'listening'); const { port } = reservation.address();
      await new Promise(resolve => reservation.close(resolve));
      client.origin = `http://127.0.0.1:${port}`;
      const child = spawn(process.execPath, ['--import', mockPath, 'server/index.mjs'], {
        cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: client.origin,
          DB_PATH: dbPath, RENDER_EXTERNAL_URL: '',
          PAYPAL_CLIENT_ID: 'isolated-http-fixture', PAYPAL_CLIENT_SECRET: 'not-a-real-secret',
          PAYPAL_RECONCILE_ENABLED: 'true', PAYPAL_RECONCILE_INTERVAL_MS: '1000',
          PAYPAL_MOCK_CALLS: callsPath, PAYPAL_MOCK_CONFIG: configPath,
          ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: '', AI_DEMO_MAX_REQUESTS: '0', ...environment,
        },
      });
      const closed = new Promise(resolve => child.once('close', resolve));
      client.instance = { child, closed }; processes.push(client.instance);
      await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => finish(new Error(`Payment fixture did not start: ${output}`)), 10000);
        const onData = chunk => { output += chunk; if (output.includes('Helpani Town running at')) finish(); };
        const onExit = () => finish(new Error(`Payment fixture exited before startup: ${output}`));
        function finish(error) {
          clearTimeout(timeout); child.stdout.off('data', onData); child.stderr.off('data', onData);
          child.off('exit', onExit); child.off('error', finish); error ? reject(error) : resolve();
        }
        child.stdout.on('data', onData); child.stderr.on('data', onData);
        child.once('exit', onExit); child.once('error', finish);
      });
    },
  };
  await writeFile(configPath, JSON.stringify(values));
  t.after(async () => { if (client.instance) await client.stop(); await rm(path, { recursive: true, force: true }); });
  await client.start();
  return client;
}

function readOnlyProviderCalls(calls, allowedCaptures = 0) {
  const captures = calls.filter(call => call.path.endsWith('/capture'));
  assert.equal(captures.length, allowedCaptures, 'background reconciliation must never add a capture request');
  assert.ok(calls.every(call =>
    (call.path === '/v1/oauth2/token' && call.method === 'POST') ||
    (/^\/v2\/checkout\/orders\/[A-Z0-9]+$/.test(call.path) && call.method === 'GET') ||
    (allowedCaptures && call.path.endsWith('/capture') && call.method === 'POST')
  ), 'only expected Sandbox token and order queries may run');
}

test('stored pending orders resolve automatically, preserving sessions, all other ledgers, and existing terminal rows', { timeout: 20000 }, async t => {
  const items = [order('AUTOCOMPLETE'), order('OTHERSESSION', { sessionId: sessionB, amountCents: 1000 }),
    order('ALREADYDONE', { status: 'completed', amountCents: 2000 }), order('ABANDONED', { status: 'created', captureId: null })];
  const client = await fixture(t, items);
  const before = await client.state(), otherRows = otherLedgers(client.dbPath);
  await eventually(() => client.queue('AUTOCOMPLETE')?.attempts >= 1, 'the original pending result to be deferred');
  await client.set('AUTOCOMPLETE', { status: 'COMPLETED' });
  await eventually(() => client.row('AUTOCOMPLETE').status === 'completed', 'automatic completion');
  const after = await client.state(), { payments: ignoredBefore, ...beforeGame } = before;
  const { payments: ignoredAfter, ...afterGame } = after;
  assert.deepEqual(afterGame, beforeGame, 'payment reconciliation must not alter care, points, or sponsor state');
  assert.deepEqual(otherLedgers(client.dbPath), otherRows);
  assert.deepEqual(after.payments.map(item => item.amountCents).sort((a, b) => a - b), [500, 2000]);
  assert.equal((await client.state(sessionB)).payments[0].status, 'pending');
  assert.equal(client.row('AUTOCOMPLETE').capture_id, items[0].captureId);
  assert.equal(client.queue('AUTOCOMPLETE'), null, 'a terminal order leaves the retry queue');
  const calls = await client.calls();
  assert.ok(!calls.some(call => ['ALREADYDONE', 'ABANDONED'].includes(call.orderId)));
  readOnlyProviderCalls(calls);
});

test('confirmed declined, failed, refunded, and partially-refunded captures leave pending with their accurate terminal status', { timeout: 15000 }, async t => {
  const items = [order('DECLINEDORDER'), order('FAILEDORDER', { amountCents: 1000 }),
    order('REFUNDEDORDER', { amountCents: 2000 }), order('PARTIALORDER', { kind: 'supply', amountCents: 800 })];
  const statuses = ['DECLINED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
  const client = await fixture(t, items, Object.fromEntries(items.map((item, index) => [item.id, { status: statuses[index] }])));
  await eventually(async () => (await client.state()).payments.every(item => item.status !== 'pending'), 'all definitive terminal states');
  assert.deepEqual(items.map(item => client.row(item.id).status), ['failed', 'failed', 'refunded', 'partially_refunded']);
  for (const item of items) assert.equal(client.queue(item.id), null);
  assert.deepEqual((await client.state()).payments.map(item => item.status).sort(), ['failed', 'failed', 'partially_refunded', 'refunded']);
  readOnlyProviderCalls(await client.calls());
});

test('upstream errors and amount mismatches retain pending, back off, and later recover without another capture', { timeout: 20000 }, async t => {
  const client = await fixture(t, [order('TRANSIENT'), order('BADAMOUNT', { amountCents: 1000 })], {
    TRANSIENT: { httpStatus: 503 }, BADAMOUNT: { status: 'COMPLETED', amountValue: '9.99' },
  });
  for (const id of ['TRANSIENT', 'BADAMOUNT']) {
    await eventually(() => client.queue(id)?.attempts >= 1, `${id} retry schedule`);
    const queue = client.queue(id);
    assert.equal(client.row(id).status, 'pending');
    assert.ok(queue.next_check_at > queue.last_checked_at);
    assert.ok(queue.last_error, 'an unsuccessful verification retains a diagnostic reason');
  }
  const before = (await client.calls()).filter(call => call.method === 'GET').length;
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal((await client.calls()).filter(call => call.method === 'GET').length, before, 'a refresh or loop must not bypass the scheduled backoff');
  await client.set('TRANSIENT', { httpStatus: null, status: 'COMPLETED' });
  await client.set('BADAMOUNT', { amountValue: '10.00' });
  await eventually(() => ['TRANSIENT', 'BADAMOUNT'].every(id => client.row(id).status === 'completed'), 'deferred orders to recover');
  readOnlyProviderCalls(await client.calls());
});

test('the retry schedule and pending capture survive a server restart without resetting their due time', { timeout: 20000 }, async t => {
  const client = await fixture(t, [order('RESTARTORDER')], { RESTARTORDER: { httpStatus: 503 } });
  await eventually(() => client.queue('RESTARTORDER')?.attempts >= 1, 'a persisted failed check');
  await client.stop();
  const due = Date.now() + 1500, previous = client.queue('RESTARTORDER');
  database(client.dbPath, db => db.prepare('UPDATE paypal_reconciliations SET next_check_at=? WHERE provider_id=?').run(due, 'RESTARTORDER'), false);
  await client.set('RESTARTORDER', { httpStatus: null, status: 'COMPLETED' });
  const callsBefore = (await client.calls()).filter(call => call.method === 'GET').length;
  await client.start();
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(client.queue('RESTARTORDER').next_check_at, due);
  assert.equal(client.queue('RESTARTORDER').attempts, previous.attempts);
  assert.equal((await client.calls()).filter(call => call.method === 'GET').length, callsBefore);
  await eventually(() => client.row('RESTARTORDER').status === 'completed', 'the restarted worker to resume the due order');
  readOnlyProviderCalls(await client.calls());
});

test('pending callbacks share an in-flight background read, reject another session, and cannot regress a completed order', { timeout: 15000 }, async t => {
  const client = await fixture(t, [order('RACINGORDER')], { RACINGORDER: { status: 'COMPLETED', delayMs: 800 } });
  await eventually(async () => (await client.calls()).some(call => call.orderId === 'RACINGORDER'), 'the held background GET');
  const foreign = await client.returned('RACINGORDER', sessionB);
  assert.equal(foreign.status, 303); assert.match(foreign.headers.get('location'), /payment=error/);
  for (const response of await Promise.all([client.returned('RACINGORDER'), client.returned('RACINGORDER')])) {
    assert.equal(response.status, 303); assert.match(response.headers.get('location'), /payment=(pending|completed)/);
  }
  await eventually(() => client.row('RACINGORDER').status === 'completed', 'the shared read to finish');
  assert.equal((await client.calls()).filter(call => call.orderId === 'RACINGORDER').length, 1);
  await client.set('RACINGORDER', { status: 'PENDING', delayMs: 0 });
  const completed = await client.returned('RACINGORDER');
  assert.match(completed.headers.get('location'), /payment=completed/);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(client.row('RACINGORDER').status, 'completed');
  assert.equal((await client.calls()).filter(call => call.orderId === 'RACINGORDER').length, 1, 'completed rows must no longer contact PayPal');
  assert.equal(database(client.dbPath, db => db.prepare('SELECT COUNT(*) AS n FROM paypal_orders').get().n), 1);
  readOnlyProviderCalls(await client.calls());
});

test('a newly captured pending result is enrolled for automatic completion, and later returns never recapture it', { timeout: 15000 }, async t => {
  const client = await fixture(t, [order('NEWPENDING', { status: 'created', captureId: null })], {
    NEWPENDING: { allowCapture: true, captureStatus: 'PENDING', status: 'COMPLETED' },
  });
  const returned = await client.returned('NEWPENDING');
  assert.equal(returned.status, 303); assert.match(returned.headers.get('location'), /payment=pending/);
  assert.equal((await client.state()).payments[0].status, 'pending');
  await eventually(() => client.row('NEWPENDING').status === 'completed', 'the newly queued capture');
  const replay = await client.returned('NEWPENDING');
  assert.match(replay.headers.get('location'), /payment=completed/);
  const calls = await client.calls();
  assert.equal(calls.filter(call => call.path.endsWith('/capture')).length, 1, 'only the explicit initial return performs a capture');
  assert.ok(calls.some(call => call.orderId === 'NEWPENDING' && call.method === 'GET'));
  readOnlyProviderCalls(calls, 1);
});

test('the configured reconciliation opt-out leaves pending orders untouched and makes no provider request', { timeout: 15000 }, async t => {
  const client = await fixture(t, [order('DISABLEDORDER')], {}, { PAYPAL_RECONCILE_ENABLED: 'false' });
  await new Promise(resolve => setTimeout(resolve, 1150));
  assert.equal(client.row('DISABLEDORDER').status, 'pending');
  assert.deepEqual(await client.calls(), []);
});
