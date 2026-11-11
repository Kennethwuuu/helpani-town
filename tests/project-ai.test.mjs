import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  auditProjectBudget, generateProjectDraft, projectAiConfigured, projectAiStatus,
  ProjectDraftError, projectSources,
} from '../server/project-ai.mjs';

const configNames = ['ASTRO_GATEWAY_URL', 'ASTRO_GATEWAY_API_KEY', 'ASTRO_GATEWAY_MODEL', 'MODEL_DEFAULT'];
const originalConfig = Object.fromEntries(configNames.map(name => [name, process.env[name]]));
const allSources = ['rescue-plan', 'supply-register', 'observation-notes'];
const fakeKey = 'unit-test-only-gateway-credential';
let restoreFetch;

beforeEach(() => {
  for (const name of configNames) delete process.env[name];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Real network access is disabled in project AI tests.'); };
  restoreFetch = () => { globalThis.fetch = originalFetch; };
});

afterEach(() => {
  restoreFetch();
  for (const name of configNames) {
    if (originalConfig[name] === undefined) delete process.env[name];
    else process.env[name] = originalConfig[name];
  }
});

function configure() {
  process.env.ASTRO_GATEWAY_URL = 'https://gateway.example.test';
  process.env.ASTRO_GATEWAY_API_KEY = fakeKey;
}

function draft(sourceIds = ['observation-notes']) {
  return {
    summary: '  所选虚构观察资料记录了两处入口亮光。  ',
    budgetFlags: ['  所选资料未提供预算。  '],
    task: { title: '  找到亮光  ', instructions: '  在虚拟地图辨认亮光位置。  ', sourceIds },
  };
}

function completion(content = JSON.stringify(draft())) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function expectedError(status, code) {
  return error => {
    assert.ok(error instanceof ProjectDraftError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    const exposed = `${error.message} ${JSON.stringify(error)}`;
    assert.equal(exposed.includes(fakeKey), false);
    assert.equal(exposed.includes('gateway.example.test'), false);
    return true;
  };
}

test('budget audit computes cents from selected source facts, with provenance and no model input', () => {
  const audit = auditProjectBudget(allSources);
  assert.equal(audit.currency, 'USD');
  assert.deepEqual([audit.targetCents, audit.itemizedCents, audit.unallocatedCents], [10_000, 6_400, 3_600]);
  assert.deepEqual(audit.lineItems, [{ label: '遮光护理布', quantity: 8, unitCents: 800, subtotalCents: 6_400, sourceIds: ['supply-register'] }]);
  assert.equal(audit.findings.length, 1);
  assert.equal(audit.findings[0].code, 'BUDGET_UNALLOCATED');
  assert.match(audit.findings[0].message, /US\$36/);
  assert.deepEqual(audit.findings[0].sourceIds, ['rescue-plan', 'supply-register']);
  assert.deepEqual(audit.sourceIds, allSources);
  audit.lineItems[0].quantity = 99;
  audit.findings[0].sourceIds.push('invented');
  assert.equal(auditProjectBudget(allSources).lineItems[0].quantity, 8, 'callers cannot alter stored source facts');
  assert.equal(auditProjectBudget(allSources).findings[0].sourceIds.includes('invented'), false);
});

test('every nonempty source subset keeps missing facts unknown rather than inferring a target or remainder', () => {
  const cases = [
    [['rescue-plan'], 10_000, null, null],
    [['supply-register'], null, 6_400, null],
    [['observation-notes'], null, null, null],
    [['rescue-plan', 'supply-register'], 10_000, 6_400, 3_600],
    [['rescue-plan', 'observation-notes'], 10_000, null, null],
    [['supply-register', 'observation-notes'], null, 6_400, null],
    [allSources, 10_000, 6_400, 3_600],
  ];
  for (const [ids, targetCents, itemizedCents, unallocatedCents] of cases) {
    const audit = auditProjectBudget(ids);
    assert.deepEqual([audit.targetCents, audit.itemizedCents, audit.unallocatedCents], [targetCents, itemizedCents, unallocatedCents]);
    assert.equal(audit.lineItems.length, ids.includes('supply-register') ? 1 : 0);
    for (const entry of [...audit.lineItems, ...audit.findings]) assert.ok(entry.sourceIds.every(id => ids.includes(id)));
  }
  const observation = auditProjectBudget(['observation-notes']);
  assert.deepEqual(observation.lineItems, []);
  assert.deepEqual(observation.findings.map(finding => finding.code), ['BUDGET_TARGET_MISSING', 'BUDGET_LINE_ITEMS_MISSING']);
  assert.doesNotMatch(JSON.stringify(observation), /(?:100|64|36|US\$8|"quantity":8)/);
  const supplyOnly = auditProjectBudget(['supply-register']);
  assert.ok(supplyOnly.findings.some(finding => finding.code === 'BUDGET_SOURCE_REMAINDER_UNVERIFIED'));
});

test('budget and draft reject the same invalid source selections before configuration or network work', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return completion(); };
  for (const ids of [undefined, null, [], 'rescue-plan', ['unknown'], ['rescue-plan', 'rescue-plan'], [...allSources, 'unknown'], [null], [1]]) {
    assert.throws(() => auditProjectBudget(ids), expectedError(400, 'AI_SOURCE_SELECTION_INVALID'));
    await assert.rejects(generateProjectDraft(ids), expectedError(400, 'AI_SOURCE_SELECTION_INVALID'));
  }
  assert.equal(calls, 0);
});

test('status exposes only safe readiness and model selection with the documented precedence', () => {
  assert.deepEqual(projectAiStatus(), { configured: false, model: 'claude-haiku-4-5', issue: 'AI_NOT_CONFIGURED' });
  assert.equal(projectAiConfigured(), false);
  process.env.MODEL_DEFAULT = '  platform-model  ';
  assert.equal(projectAiStatus().model, 'platform-model');
  process.env.ASTRO_GATEWAY_MODEL = '  selected-model  ';
  assert.equal(projectAiStatus().model, 'selected-model');
  configure();
  assert.deepEqual(projectAiStatus(), { configured: true, model: 'selected-model', issue: null });
  assert.equal(projectAiConfigured(), true);
  assert.equal(JSON.stringify(projectAiStatus()).includes(fakeKey), false);
  assert.equal(JSON.stringify(projectAiStatus()).includes('gateway.example.test'), false);
});

test('missing and invalid gateway configuration return separate safe errors without network access', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return completion(); };
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(503, 'AI_NOT_CONFIGURED'));
  configure();
  for (const url of ['not-a-url', 'http://gateway.example.test', 'https://gateway.example.test/v1', 'https://user:password@gateway.example.test', 'https://gateway.example.test?query=1', 'https://gateway.example.test#fragment']) {
    process.env.ASTRO_GATEWAY_URL = url;
    assert.equal(projectAiStatus().issue, 'AI_CONFIGURATION_INVALID');
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(503, 'AI_CONFIGURATION_INVALID'));
  }
  assert.equal(calls, 0);
});

test('generation sends only selected original sources to the host endpoint and returns a reviewed draft plus deterministic audit', async () => {
  configure();
  process.env.MODEL_DEFAULT = 'platform-model';
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(String(url), 'https://gateway.example.test/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`);
    assert.ok(options.signal instanceof AbortSignal);
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'platform-model');
    assert.equal(payload.stream, false);
    assert.equal(payload.max_tokens, 1400);
    assert.equal(Object.hasOwn(payload, 'response_format'), false, 'portable JSON prompting does not assume provider-native schema support');
    assert.deepEqual(JSON.parse(payload.messages[1].content), [projectSources[2]]);
    assert.equal(options.body.includes(fakeKey), false);
    return completion();
  };
  const result = await generateProjectDraft(['observation-notes']);
  assert.equal(calls, 1);
  assert.equal(result.summary, draft().summary.trim());
  assert.deepEqual(result.budgetFlags, draft().budgetFlags.map(flag => flag.trim()));
  assert.equal(result.task.title, draft().task.title.trim());
  assert.equal(result.task.instructions, draft().task.instructions.trim());
  assert.deepEqual(result.task.sourceIds, ['observation-notes']);
  assert.deepEqual(result.budgetAudit, auditProjectBudget(['observation-notes']));
  assert.deepEqual(result.generation, { provider: 'Astropods', model: 'platform-model' });
  assert.equal(result.reviewRequired, true);
  assert.equal(JSON.stringify(result).includes(fakeKey), false);
});

test('model-supplied budget fields and metadata cannot replace independently computed facts or review requirement', async () => {
  configure();
  const modelOutput = { ...draft(['supply-register']), budgetAudit: { targetCents: 999 }, generation: { provider: 'invented' }, reviewRequired: false };
  globalThis.fetch = async () => completion(JSON.stringify(modelOutput));
  const result = await generateProjectDraft(allSources);
  assert.equal(result.budgetAudit.targetCents, 10_000);
  assert.equal(result.budgetAudit.itemizedCents, 6_400);
  assert.equal(result.budgetAudit.unallocatedCents, 3_600);
  assert.equal(result.generation.provider, 'Astropods');
  assert.equal(result.reviewRequired, true);
});

test('upstream authentication, rate limits and other HTTP failures have distinct safe codes', async () => {
  configure();
  for (const [status, expectedStatus, code] of [[401, 502, 'AI_AUTHENTICATION_FAILED'], [429, 503, 'AI_RATE_LIMITED'], [403, 502, 'AI_UNAVAILABLE'], [500, 502, 'AI_UNAVAILABLE'], [503, 502, 'AI_UNAVAILABLE']]) {
    globalThis.fetch = async () => new Response(fakeKey, { status });
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(expectedStatus, code));
  }
});

test('network failures are unavailable, while the 45-second abort is a timeout without waiting in tests', async t => {
  configure();
  globalThis.fetch = async () => { throw new TypeError(`Network failure with ${fakeKey}`); };
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_UNAVAILABLE'));
  t.mock.method(AbortSignal, 'timeout', delay => {
    assert.equal(delay, 45_000);
    return AbortSignal.abort(new DOMException('Mock timeout', 'TimeoutError'));
  });
  globalThis.fetch = async (_url, options) => { throw options.signal.reason; };
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(504, 'AI_TIMEOUT'));
});

test('malformed upstream envelopes, JSON and schema or citation violations cannot produce a draft', async () => {
  configure();
  const base = draft();
  const badDrafts = [
    null,
    {},
    { ...base, summary: '' },
    { ...base, summary: 'x'.repeat(481) },
    { ...base, budgetFlags: ['x'.repeat(161)] },
    { ...base, budgetFlags: ['1', '2', '3', '4', '5'] },
    { ...base, task: { ...base.task, title: 'x'.repeat(101) } },
    { ...base, task: { ...base.task, instructions: 'x'.repeat(501) } },
    { ...base, task: { ...base.task, sourceIds: [] } },
    { ...base, task: { ...base.task, sourceIds: ['rescue-plan'] } },
    { ...base, task: { ...base.task, sourceIds: ['unknown'] } },
    { ...base, task: { ...base.task, sourceIds: ['observation-notes', 'observation-notes'] } },
  ];
  for (const invalid of badDrafts) {
    globalThis.fetch = async () => completion(JSON.stringify(invalid));
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  }
  for (const content of ['', 'not JSON', '```json\n{}\n```', 'x'.repeat(8001), null]) {
    globalThis.fetch = async () => completion(content);
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  }
  for (const payload of ['not JSON', JSON.stringify({ choices: [] })]) {
    globalThis.fetch = async () => new Response(payload);
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  }
});
