import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, test } from 'node:test';
import { createAiDemoGate } from '../server/ai-demo-gate.mjs';
import { generateProjectDraft, ProjectDraftError } from '../server/project-ai.mjs';

const configNames = ['ASTRO_GATEWAY_URL', 'ASTRO_GATEWAY_API_KEY', 'ASTRO_GATEWAY_MODEL', 'MODEL_DEFAULT'];
let originalFetch;
let originalConfig;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalConfig = Object.fromEntries(configNames.map(name => [name, process.env[name]]));
  for (const name of configNames) delete process.env[name];
  globalThis.fetch = async () => { throw new Error('Real network access is disabled in AI demo gate tests.'); };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of configNames) {
    if (originalConfig[name] === undefined) delete process.env[name];
    else process.env[name] = originalConfig[name];
  }
});

function fixture(t, env = { AI_DEMO_MAX_REQUESTS: '20' }) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  return { db, gate: createAiDemoGate(db, env) };
}

function usage(db, scope, subject = '') {
  return db.prepare('SELECT attempts FROM ai_demo_usage WHERE scope = ? AND subject = ?')
    .get(scope, subject)?.attempts ?? 0;
}

function denied(code) {
  return error => {
    assert.ok(error instanceof ProjectDraftError);
    assert.equal(error.status, 503);
    assert.equal(error.code, code);
    return true;
  };
}

function configureGateway() {
  process.env.ASTRO_GATEWAY_URL = 'https://gateway.example.test';
  process.env.ASTRO_GATEWAY_API_KEY = 'unit-test-only-credential';
}

function completion(content = JSON.stringify({
  summary: '虚构观察资料记录入口亮光。', budgetFlags: ['所选资料未提供预算信息。'],
  task: { title: '阅读观察记录', instructions: '在资料中找到亮光的位置描述。', sourceIds: ['observation-notes'] },
})) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

test('absent or zero global limit leaves callbacks unchanged and creates no database schema', async t => {
  for (const env of [{}, { AI_DEMO_MAX_REQUESTS: '0' }]) {
    const { db, gate } = fixture(t, env);
    const expected = new Error('callback failure');
    const calls = Array.from({ length: 12 }, () => gate.run('a', async () => {
      gate.consumeAttempt('a');
      return 'unchanged';
    }));
    assert.deepEqual(await Promise.all(calls), Array(12).fill('unchanged'));
    await assert.rejects(gate.run('a', () => { throw expected; }), error => error === expected);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
  }
});

test('global cap atomically charges accepted attempts and denied attempts do not change either count', t => {
  const { db, gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '2' });
  gate.consumeAttempt('a');
  gate.consumeAttempt('b');
  assert.throws(() => gate.consumeAttempt('c'), denied('AI_DEMO_LIMIT_REACHED'));
  assert.equal(usage(db, 'global'), 2);
  assert.equal(usage(db, 'session', 'a'), 1);
  assert.equal(usage(db, 'session', 'b'), 1);
  assert.equal(usage(db, 'session', 'c'), 0);
});

test('default session cap is ten and a rejected session does not prevent another session using global budget', t => {
  const { db, gate } = fixture(t);
  for (let n = 0; n < 10; n += 1) gate.consumeAttempt('a');
  assert.throws(() => gate.consumeAttempt('a'), denied('AI_DEMO_LIMIT_REACHED'));
  gate.consumeAttempt('b');
  assert.equal(usage(db, 'global'), 11);
  assert.equal(usage(db, 'session', 'a'), 10);
  assert.equal(usage(db, 'session', 'b'), 1);
});

test('session cap can be configured independently of the global cap', t => {
  const { db, gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '10', AI_DEMO_SESSION_MAX_REQUESTS: '1' });
  gate.consumeAttempt('a');
  assert.throws(() => gate.consumeAttempt('a'), denied('AI_DEMO_LIMIT_REACHED'));
  gate.consumeAttempt('b');
  assert.equal(usage(db, 'global'), 2);
});

test('budgets survive gate creation and database reopening; raising limits does not reset usage', t => {
  const directory = mkdtempSync(join(tmpdir(), 'helpani-ai-gate-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'usage.sqlite');
  let db = new DatabaseSync(path);
  let gate = createAiDemoGate(db, { AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '1' });
  gate.consumeAttempt('a');
  gate = createAiDemoGate(db, { AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '1' });
  assert.throws(() => gate.consumeAttempt('a'), denied('AI_DEMO_LIMIT_REACHED'));
  db.close();
  db = new DatabaseSync(path);
  try {
    gate = createAiDemoGate(db, { AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '1' });
    gate.consumeAttempt('b');
    assert.throws(() => gate.consumeAttempt('c'), denied('AI_DEMO_LIMIT_REACHED'));
    gate = createAiDemoGate(db, { AI_DEMO_MAX_REQUESTS: '3', AI_DEMO_SESSION_MAX_REQUESTS: '2' });
    gate.consumeAttempt('a');
    assert.equal(usage(db, 'global'), 3);
    assert.equal(usage(db, 'session', 'a'), 2);
  } finally { db.close(); }
});

test('concurrent requests are denied without charge and a thrown callback always releases its slot', async t => {
  const { db, gate } = fixture(t);
  let rejectFirst;
  const failure = new Error('upstream failed');
  const first = gate.run('a', async () => {
    gate.consumeAttempt('a');
    await new Promise((_resolve, reject) => { rejectFirst = reject; });
  });
  await assert.rejects(gate.run('b', () => {
    assert.fail('busy callbacks must not execute');
  }), denied('AI_DEMO_BUSY'));
  assert.equal(usage(db, 'global'), 1);
  assert.equal(usage(db, 'session', 'b'), 0);
  rejectFirst(failure);
  await assert.rejects(first, error => error === failure);
  assert.equal(await gate.run('b', () => 'released'), 'released');
  assert.equal(usage(db, 'global'), 1, 'leasing a slot alone does not consume an attempt');
});

test('configured concurrency admits exactly its number of in-flight callbacks and releases successful slots', async t => {
  const { gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '10', AI_DEMO_MAX_CONCURRENT: '2' });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const first = gate.run('a', () => pending);
  const second = gate.run('b', () => pending);
  await assert.rejects(gate.run('c', () => 'busy'), denied('AI_DEMO_BUSY'));
  release('done');
  assert.deepEqual(await Promise.all([first, second]), ['done', 'done']);
  assert.equal(await gate.run('c', () => 'available'), 'available');
});

test('each actual gateway retry is charged before fetch and shares the existing deadline', async t => {
  const { db, gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '2' });
  configureGateway();
  const signals = [];
  globalThis.fetch = async (_url, options) => {
    signals.push(options.signal);
    assert.equal(usage(db, 'global'), signals.length, 'charge must be committed before upstream work');
    return completion(signals.length === 1 ? 'invalid JSON' : undefined);
  };
  const generate = () => gate.run('a', () => generateProjectDraft(['observation-notes'], {
    beforeGatewayRequest: () => gate.consumeAttempt('a'),
  }));
  const result = await generate();
  assert.equal(result.generation.attempts, 2);
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
  await assert.rejects(generate(), denied('AI_DEMO_LIMIT_REACHED'));
  assert.equal(signals.length, 2, 'exhausted requests never reach the gateway');
  assert.equal(usage(db, 'global'), 2);
});

test('a quota error before the retry propagates once without another fetch or charge', async t => {
  const { db, gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '1' });
  configureGateway();
  let fetches = 0;
  let hooks = 0;
  globalThis.fetch = async () => { fetches += 1; return completion('invalid JSON'); };
  await assert.rejects(gate.run('a', () => generateProjectDraft(['observation-notes'], {
    beforeGatewayRequest() { hooks += 1; gate.consumeAttempt('a'); },
  })), denied('AI_DEMO_LIMIT_REACHED'));
  assert.equal(fetches, 1);
  assert.equal(hooks, 2);
  assert.equal(usage(db, 'global'), 1);
  assert.equal(await gate.run('b', () => 'released'), 'released');
});

test('a failed upstream request still consumes its attempt and cannot bypass the cap', async t => {
  const { db, gate } = fixture(t, { AI_DEMO_MAX_REQUESTS: '1' });
  configureGateway();
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new TypeError('network unavailable'); };
  const generate = () => gate.run('a', () => generateProjectDraft(['observation-notes'], {
    beforeGatewayRequest: () => gate.consumeAttempt('a'),
  }));
  await assert.rejects(generate(), error => error.code === 'AI_UNAVAILABLE');
  await assert.rejects(generate(), denied('AI_DEMO_LIMIT_REACHED'));
  assert.equal(fetches, 1);
  assert.equal(usage(db, 'global'), 1);
});

test('invalid configuration fails before schema creation and names only the invalid setting', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const cases = [
    ['AI_DEMO_MAX_REQUESTS', ['-1', '1.5', 'NaN', '1e3', '9007199254740992', '', 'secret-config-value']],
    ['AI_DEMO_SESSION_MAX_REQUESTS', ['0', '-1', '2.5', 'secret-config-value']],
    ['AI_DEMO_MAX_CONCURRENT', ['0', '-1', '1.5', 'secret-config-value']],
  ];
  for (const [name, values] of cases) {
    for (const value of values) {
      assert.throws(() => createAiDemoGate(db, { AI_DEMO_MAX_REQUESTS: '2', [name]: value }), error => {
        assert.match(error.message, new RegExp(name));
        assert.doesNotMatch(error.message, /secret-config-value/);
        return true;
      });
    }
  }
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), []);
});
