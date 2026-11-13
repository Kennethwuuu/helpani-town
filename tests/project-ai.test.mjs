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
    summary: '  The selected fictional notes describe two points of light.  ',
    budgetFlags: ['  The selected source provides no budget.  '],
    task: { title: '  Find the light  ', instructions: '  Read the notes and locate the described entrance.  ', sourceIds },
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
  assert.deepEqual(projectAiStatus(), { configured: false, model: 'claude-sonnet-4-6', issue: 'AI_NOT_CONFIGURED' });
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
  assert.deepEqual(result.generation, { provider: 'Astropods', model: 'platform-model', attempts: 1 });
  assert.equal(result.reviewRequired, true);
  assert.equal(JSON.stringify(result).includes(fakeKey), false);
});

test('draft language defaults to English and keeps the requested language on a format retry', async () => {
  configure();
  for (const locale of [undefined, 'en', 'zh-CN']) {
    const calls = [];
    const localized = locale === 'zh-CN' ? { ...draft(), summary: '虚构观察记录描述两处亮光。', task: { ...draft().task, title: '阅读观察记录', instructions: '阅读原文，找到亮光入口描述。' } } : {
      summary: 'The fictional observation notes describe light entering at two points.',
      budgetFlags: ['The selected source does not provide budget information.'],
      task: {
        title: 'Read the light-entry notes',
        instructions: 'Read the selected fictional notes and identify how many points of light are described.',
        sourceIds: ['observation-notes'],
      },
    };
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return completion(calls.length === 1 ? 'invalid JSON' : JSON.stringify(localized));
    };
    const result = await generateProjectDraft(['observation-notes'], locale === undefined ? undefined : { locale });
    assert.equal(calls.length, 2, `${locale ?? 'default'} gets only the bounded format retry`);
    for (const call of calls) {
      const prompt = call.messages[0].content;
      if (locale === 'zh-CN') {
        assert.match(prompt, /所有面向用户的文字使用简体中文/);
        assert.doesNotMatch(prompt, /Write all user-facing strings in English/);
      } else {
        assert.match(prompt, /Write all user-facing strings in English/);
        assert.match(prompt, /Keep source IDs unchanged/);
        assert.doesNotMatch(prompt, /所有面向用户的文字使用简体中文/);
      }
      assert.deepEqual(JSON.parse(call.messages[1].content), [projectSources[2]], 'changing output language must not change source evidence');
    }
    assert.equal(calls[0].messages.length, 2);
    const retryPrompt = calls[1].messages[2].content;
    if (locale === 'zh-CN') assert.match(retryPrompt, /使用简体中文/);
    else assert.match(retryPrompt, /All user-facing strings must be in English/);
    assert.equal(result.summary, localized.summary.trim());
    assert.deepEqual(result.task.sourceIds, ['observation-notes']);
    assert.deepEqual(result.budgetAudit, auditProjectBudget(['observation-notes']));
    assert.equal(result.reviewRequired, true);
  }
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

test('generation accepts one complete JSON fence with the same schema and citation validation as plain JSON', async () => {
  configure();
  const content = JSON.stringify(draft());
  const wrapped = [
    '```json\n' + content + '\n```',
    '```\n' + content + '\n```',
    ' \n```json\r\n' + content + '\r\n``` \n',
  ];
  for (const fenced of wrapped) {
    globalThis.fetch = async () => completion(fenced);
    const result = await generateProjectDraft(['observation-notes']);
    assert.equal(result.summary, draft().summary.trim());
    assert.deepEqual(result.task.sourceIds, ['observation-notes']);
    assert.deepEqual(result.budgetAudit, auditProjectBudget(['observation-notes']));
    assert.equal(result.reviewRequired, true);
  }
  const wrongCitation = JSON.stringify(draft(['rescue-plan']));
  globalThis.fetch = async () => completion('```json\n' + wrongCitation + '\n```');
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
});

test('generation rejects commentary, incomplete fences and multiple fenced responses', async () => {
  configure();
  const content = JSON.stringify(draft());
  const fenced = '```json\n' + content + '\n```';
  for (const invalid of [
    'Here is the draft:\n' + fenced,
    fenced + '\nPlease review it.',
    '```json\n' + content,
    content + '\n```',
    fenced + '\n' + fenced,
    '```json\n' + content + '\n```\n```\n```',
    '```javascript\n' + content + '\n```',
  ]) {
    globalThis.fetch = async () => completion(invalid);
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  }
});

test('a token-limit completion is rejected even if its partial content happens to parse as a valid draft', async () => {
  configure();
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: 'length', message: { content: JSON.stringify(draft()) } }],
  }), { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
});

test('one invalid response gets one retry with the same sources and shared deadline', async () => {
  configure();
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push({ payload: JSON.parse(options.body), signal: options.signal });
    return completion(calls.length === 1 ? 'not valid JSON' : JSON.stringify(draft()));
  };
  const result = await generateProjectDraft(['observation-notes']);
  assert.equal(calls.length, 2);
  assert.equal(result.generation.attempts, 2);
  assert.equal(calls[0].signal, calls[1].signal, 'retry must not restart the 45-second deadline');
  for (const call of calls) assert.deepEqual(JSON.parse(call.payload.messages[1].content), [projectSources[2]]);
  assert.equal(calls[1].payload.messages.length, 3);
  assert.deepEqual(result.task.sourceIds, ['observation-notes']);
});

test('two invalid responses stop with a safe error rather than retrying indefinitely', async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return completion('not valid JSON'); };
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  assert.equal(calls, 2);
});

test('upstream authentication, rate limits and other HTTP failures have distinct safe codes without retries', async () => {
  configure();
  for (const [status, expectedStatus, code] of [[401, 502, 'AI_AUTHENTICATION_FAILED'], [429, 503, 'AI_RATE_LIMITED'], [403, 502, 'AI_UNAVAILABLE'], [500, 502, 'AI_UNAVAILABLE'], [503, 502, 'AI_UNAVAILABLE']]) {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response(fakeKey, { status }); };
    await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(expectedStatus, code));
    assert.equal(calls, 1);
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

test('cancellation before generation skips the Gateway and does not charge an attempt', async () => {
  configure();
  let attempts = 0;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return completion(); };
  await assert.rejects(generateProjectDraft(['observation-notes'], {
    signal: AbortSignal.abort(),
    beforeGatewayRequest: () => { attempts += 1; },
  }), expectedError(499, 'AI_CANCELLED'));
  assert.equal(attempts, 0);
  assert.equal(calls, 0);
});

test('cancelling an in-flight generation aborts the Gateway without retrying or refunding the attempt', async () => {
  configure();
  const controller = new AbortController();
  const started = Promise.withResolvers();
  let attempts = 0;
  let calls = 0;
  globalThis.fetch = (_url, { signal }) => new Promise((resolve, reject) => {
    calls += 1;
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    started.resolve(signal);
  });
  const cancelled = assert.rejects(generateProjectDraft(['observation-notes'], {
    signal: controller.signal,
    beforeGatewayRequest: () => { attempts += 1; },
  }), expectedError(499, 'AI_CANCELLED'));
  const gatewaySignal = await started.promise;
  controller.abort();
  await cancelled;
  assert.equal(gatewaySignal.aborted, true);
  assert.equal(attempts, 1);
  assert.equal(calls, 1);
});

test('cancellation while reading an invalid response suppresses the format retry', async () => {
  configure();
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    controller.abort();
    return completion('invalid JSON');
  };
  await assert.rejects(generateProjectDraft(['observation-notes'], {
    signal: controller.signal,
  }), expectedError(499, 'AI_CANCELLED'));
  assert.equal(calls, 1);
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


test('English drafts translate quoted source titles; mixed-language output uses only the bounded retry', async () => {
  configure();
  const mixed = {...draft(), task:{...draft().task, instructions:"Read the source '观察区说明' and identify the described entrance."}};
  let calls = 0;
  globalThis.fetch = async () => completion(JSON.stringify(++calls === 1 ? mixed : draft()));
  const corrected = await generateProjectDraft(['observation-notes']);
  assert.equal(calls, 2);
  assert.equal(corrected.generation.attempts, 2);
  assert.equal(/\p{Script=Han}/u.test(corrected.task.instructions), false);
  calls = 0;
  globalThis.fetch = async () => { calls++; return completion(JSON.stringify(mixed)); };
  await assert.rejects(generateProjectDraft(['observation-notes']), expectedError(502, 'AI_RESPONSE_INVALID'));
  assert.equal(calls, 2);
  const chinese = await generateProjectDraft(['observation-notes'], {locale:'zh-CN'});
  assert.equal(chinese.task.instructions, mixed.task.instructions.trim());
});
