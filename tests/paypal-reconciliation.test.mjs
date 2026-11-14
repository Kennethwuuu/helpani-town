import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createPayPalLedger } from '../server/paypal-ledger.mjs';
import { createPayPalReconciler, paypalReconciliationSettings } from '../server/paypal-reconciliation.mjs';

function fixture(t, path = ':memory:') {
  const db = new DatabaseSync(path);
  t.after(() => db.close());
  let time = 10_000;
  const ledger = createPayPalLedger(db, { now: () => time, intervalMs: 1000 });
  const pending = (id = 'ORDER1', session = 'alice') => {
    ledger.create(`ref-${id}`, session, 'donation', 500, id);
    ledger.saveCapture(id, { status: 'pending', captureId: `CAP-${id}` });
    return ledger.find(id);
  };
  return { db, ledger, pending, setTime: value => { time = value; } };
}

test('upgrading the original ledger preserves every payment, unique capture and unrelated game row', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE paypal_orders (
    reference TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('donation','supply')), amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    provider_id TEXT UNIQUE NOT NULL, capture_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','completed'))
  ) STRICT;
  INSERT INTO paypal_orders VALUES ('r1','alice','donation',500,'ORDER1','CAP1','pending'),
    ('r2','bob','supply',800,'ORDER2','CAP2','completed'), ('r3','alice','donation',2000,'ORDER3',NULL,'created');
  CREATE TABLE town_events (session_id TEXT, kind TEXT); INSERT INTO town_events VALUES ('alice','allocation');`);
  const before = db.prepare('SELECT * FROM paypal_orders ORDER BY reference').all();
  db.prepare("UPDATE paypal_orders SET rowid = 10 WHERE reference = 'r3'").run();
  const rowIds = db.prepare('SELECT rowid FROM paypal_orders ORDER BY reference').all();
  const ledger = createPayPalLedger(db);
  assert.deepEqual(db.prepare('SELECT * FROM paypal_orders ORDER BY reference').all(), before);
  assert.deepEqual(db.prepare('SELECT rowid FROM paypal_orders ORDER BY reference').all(), rowIds, 'record ordering keys survive the upgrade');
  assert.equal(ledger.due().length, 1, 'startup resumes existing pending captures only');
  ledger.finishCheck(ledger.find('ORDER1'), { status: 'failed', captureId: 'CAP1' });
  const upgraded = db.prepare('SELECT * FROM paypal_orders ORDER BY reference').all();
  createPayPalLedger(db);
  assert.deepEqual(db.prepare('SELECT * FROM paypal_orders ORDER BY reference').all(), upgraded, 'upgrade is idempotent');
  assert.throws(() => ledger.saveCapture('ORDER3', { status: 'pending', captureId: 'CAP2' }), /UNIQUE/);
  assert.equal(ledger.find('ORDER3').status, 'created', 'a capture collision must roll back the whole change');
  assert.deepEqual(db.prepare('SELECT * FROM town_events').all().map(row => ({ ...row })), [{ session_id: 'alice', kind: 'allocation' }]);
  assert.deepEqual(db.prepare('PRAGMA quick_check').all().map(row => Object.values(row)[0]), ['ok']);
});

test('an unexpected legacy schema is rejected without dropping records or custom indexes', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE paypal_orders (reference TEXT, extra TEXT);
    INSERT INTO paypal_orders VALUES ('keep','preserve'); CREATE INDEX custom_order_index ON paypal_orders(reference);`);
  assert.throws(() => createPayPalLedger(db), /Unexpected PayPal ledger schema/);
  assert.equal(db.prepare('SELECT extra FROM paypal_orders').get().extra, 'preserve');
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='custom_order_index'").get());
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='paypal_orders_upgrade'").get(), undefined);
});

test('durable backoff survives reopening; created and terminal orders never become due', t => {
  const dir = mkdtempSync(join(tmpdir(), 'helpani-paypal-backoff-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'payments.sqlite');
  const first = new DatabaseSync(path);
  let now = 10_000;
  let ledger = createPayPalLedger(first, { now: () => now, intervalMs: 1000 });
  ledger.create('r1', 'alice', 'donation', 500, 'ORDER1');
  ledger.saveCapture('ORDER1', { status: 'pending', captureId: 'CAP1' });
  ledger.create('r2', 'alice', 'donation', 500, 'ORDER2');
  ledger.create('r3', 'alice', 'supply', 800, 'ORDER3');
  ledger.saveCapture('ORDER3', { status: 'completed', captureId: 'CAP3' });
  assert.equal(ledger.due().length, 0);
  now = 11_000;
  ledger.finishCheck(ledger.due()[0], null, 'PAYPAL_CHECK_FAILED');
  const saved = first.prepare('SELECT * FROM paypal_reconciliations').get();
  assert.equal(saved.attempts, 1); assert.equal(saved.next_check_at, 12_000);
  first.close();
  const second = new DatabaseSync(path);
  t.after(() => second.close());
  ledger = createPayPalLedger(second, { now: () => now, intervalMs: 1000 });
  assert.equal(ledger.due().length, 0, 'restart does not reset a provider-error backoff');
  assert.deepEqual(second.prepare('SELECT * FROM paypal_reconciliations').get(), saved);
  now = 12_000;
  ledger.finishCheck(ledger.due()[0], { status: 'pending', captureId: 'CAP1' });
  assert.equal(second.prepare('SELECT next_check_at FROM paypal_reconciliations').get().next_check_at, 14_000);
  for (let attempt = 0; attempt < 16; attempt++) {
    now = second.prepare('SELECT next_check_at FROM paypal_reconciliations').get().next_check_at;
    ledger.finishCheck(ledger.due()[0], null, 'PAYPAL_CHECK_FAILED');
  }
  assert.equal(second.prepare('SELECT next_check_at FROM paypal_reconciliations').get().next_check_at - now, 3_600_000);
  now += 3_600_000;
  ledger.finishCheck(ledger.due()[0], { status: 'completed', captureId: 'CAP1' });
  assert.deepEqual(ledger.due(), []);
  assert.equal(second.prepare('SELECT COUNT(*) AS n FROM paypal_reconciliations').get().n, 0);
  assert.equal(ledger.find('ORDER2').status, 'created');
  assert.equal(ledger.find('ORDER3').status, 'completed');
});

for (const status of ['completed', 'failed', 'refunded', 'partially_refunded']) {
  test(`pending resolves to ${status} once, preserving tenant ownership and resisting stale responses`, t => {
    const { db, ledger, pending } = fixture(t);
    const order = pending(); pending('ORDER2', 'bob');
    ledger.finishCheck(order, { status, captureId: order.captureId });
    ledger.finishCheck(order, { status: 'pending', captureId: order.captureId });
    ledger.saveCapture(order.id, { status: 'pending', captureId: order.captureId });
    assert.equal(ledger.find(order.id).status, status);
    assert.equal(ledger.find(order.id, 'bob'), undefined);
    assert.deepEqual(ledger.list('alice').map(row => ({ ...row })), [{ kind: 'donation', amountCents: 500, status }]);
    assert.equal(ledger.list('bob')[0].status, 'pending');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM paypal_orders').get().n, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM paypal_reconciliations WHERE provider_id=?').get(order.id).n, 0);
  });
}

test('capture mismatches and unknown states cannot change a pending ledger entry', t => {
  const { ledger, pending } = fixture(t);
  const order = pending();
  assert.throws(() => ledger.finishCheck(order, { status: 'completed', captureId: 'ANOTHER' }), /mismatch/);
  assert.throws(() => ledger.finishCheck(order, { status: 'unknown', captureId: order.captureId }), /mismatch/);
  assert.throws(() => ledger.saveCapture(order.id, { status: 'completed', captureId: 'ANOTHER' }), /mismatch/);
  assert.deepEqual(ledger.find(order.id), order);
});

test('overlapping scans and buyer returns share one serial read per order', async t => {
  const { ledger, pending, setTime } = fixture(t);
  pending('ORDER1'); pending('ORDER2'); setTime(11_000);
  const entered = [Promise.withResolvers(), Promise.withResolvers()];
  const gates = [Promise.withResolvers(), Promise.withResolvers()];
  let calls = 0, active = 0, maximum = 0;
  const worker = createPayPalReconciler({ ledger, configured: () => true, readOrder: async order => {
    const index = calls++;
    active++; maximum = Math.max(maximum, active); entered[index].resolve();
    await gates[index].promise;
    active--;
    return { status: 'completed', captureId: order.captureId };
  } });
  t.after(() => worker.stop());
  const scan = worker.runOnce();
  assert.equal(worker.runOnce(), scan);
  await entered[0].promise;
  const one = worker.reconcileOrder('ORDER1');
  assert.equal(worker.reconcileOrder('ORDER1'), one);
  const two = worker.reconcileOrder('ORDER2');
  assert.equal(calls, 1);
  gates[0].resolve(); await entered[1].promise;
  gates[1].resolve(); await Promise.all([scan, one, two]);
  assert.equal(calls, 2); assert.equal(maximum, 1);
  assert.equal(ledger.find('ORDER1').status, 'completed'); assert.equal(ledger.find('ORDER2').status, 'completed');
});

test('a synchronous provider failure releases its lease and retries only when due', async t => {
  const { db, ledger, pending, setTime } = fixture(t);
  pending(); setTime(11_000);
  let calls = 0, warnings = 0;
  const worker = createPayPalReconciler({ ledger, configured: () => true, warn: () => warnings++, readOrder: order => {
    calls++;
    if (calls === 1) throw new Error('Simulated provider failure');
    return { status: 'completed', captureId: order.captureId };
  } });
  t.after(() => worker.stop());
  await worker.runOnce();
  assert.equal(ledger.find('ORDER1').status, 'pending'); assert.equal(warnings, 1);
  assert.equal(db.prepare('SELECT last_error FROM paypal_reconciliations').get().last_error, 'PAYPAL_CHECK_FAILED');
  await worker.runOnce(); assert.equal(calls, 1);
  setTime(12_000); await worker.runOnce();
  assert.equal(calls, 2); assert.equal(ledger.find('ORDER1').status, 'completed');
});

test('each scan is bounded and disabled or unconfigured workers make no provider requests', async t => {
  const { ledger, pending, setTime } = fixture(t);
  for (let i = 0; i < 7; i++) pending(`ORDER${i}`);
  setTime(11_000);
  let calls = 0;
  const options = { ledger, configured: () => true, readOrder: order => { calls++; return { status: 'completed', captureId: order.captureId }; } };
  for (const overrides of [{ enabled: false }, { configured: () => false }]) {
    const idle = createPayPalReconciler({ ...options, ...overrides });
    idle.start(); await idle.runOnce(); await idle.reconcileOrder('ORDER0'); idle.stop();
    assert.equal(calls, 0);
  }
  const worker = createPayPalReconciler(options);
  t.after(() => worker.stop());
  await worker.runOnce(); assert.equal(calls, 5);
  await worker.runOnce(); assert.equal(calls, 7);
});

test('stopping a worker aborts its read, skips queued orders, and leaves durable work intact', async t => {
  const { db, ledger, pending, setTime } = fixture(t);
  pending('ORDER1'); pending('ORDER2'); setTime(11_000);
  const entered = Promise.withResolvers();
  let calls = 0;
  const worker = createPayPalReconciler({ ledger, configured: () => true, readOrder: ({ signal }) => new Promise((resolve, reject) => {
    calls++; entered.resolve(); signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) });
  const scan = worker.runOnce(); await entered.promise;
  const queued = worker.reconcileOrder('ORDER2');
  worker.stop(); await Promise.all([scan, queued]);
  assert.equal(calls, 1);
  assert.equal(ledger.find('ORDER1').status, 'pending'); assert.equal(ledger.find('ORDER2').status, 'pending');
  assert.equal(db.prepare('SELECT SUM(attempts) AS n FROM paypal_reconciliations').get().n, 0);
});

test('timer lifecycle starts once, unreferences the timer and ignores callbacks from a stopped generation', async t => {
  const { ledger } = fixture(t);
  const timers = [];
  const worker = createPayPalReconciler({ ledger, configured: () => true,
    setTimer: callback => { const timer = { callback, unref() { this.unreferenced = true; } }; timers.push(timer); return timer; },
    clearTimer: timer => { timer.cleared = true; }, readOrder: () => { throw new Error('No work expected'); } });
  t.after(() => worker.stop());
  worker.start(); worker.start(); await new Promise(setImmediate);
  assert.equal(timers.length, 1); assert.equal(timers[0].unreferenced, true);
  worker.stop(); assert.equal(timers[0].cleared, true);
  worker.start(); await new Promise(setImmediate);
  assert.equal(timers.length, 2);
  await timers[0].callback();
  assert.equal(timers.length, 2, 'an old callback cannot schedule a second new-generation timer');
});

test('reconciliation settings bound the interval and allow an explicit operational off switch', () => {
  assert.deepEqual(paypalReconciliationSettings({}), { enabled: true, intervalMs: 60_000 });
  assert.deepEqual(paypalReconciliationSettings({ PAYPAL_RECONCILE_ENABLED: '0', PAYPAL_RECONCILE_INTERVAL_MS: '1000' }), { enabled: false, intervalMs: 1000 });
  for (const value of ['', '-1', '999', '3600001', '1.5', 'oops']) {
    assert.throws(() => paypalReconciliationSettings({ PAYPAL_RECONCILE_INTERVAL_MS: value }), /PAYPAL_RECONCILE_INTERVAL_MS/);
  }
  assert.throws(() => paypalReconciliationSettings({ PAYPAL_RECONCILE_ENABLED: 'maybe' }), /PAYPAL_RECONCILE_ENABLED/);
});
