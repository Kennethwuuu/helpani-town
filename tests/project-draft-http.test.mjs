import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

let origin, directory, child, closed, cookie;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'helpani-project-draft-'));
  // Test the current source from a local snapshot: cloud placeholders in Documents
  // must not become a child-process startup timeout or a mutable test baseline.
  const runtime = join(directory, 'runtime');
  await mkdir(join(runtime, 'server'), { recursive: true });
  await mkdir(join(runtime, 'public'), { recursive: true });
  const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
  const modules = (await readdir(join(sourceRoot, 'server'))).filter(name => name.endsWith('.mjs'));
  await Promise.all(modules.map(async name => {
    await writeFile(join(runtime, 'server', name), await readFile(join(sourceRoot, 'server', name)));
  }));
  await writeFile(join(runtime, 'public', 'project-draft.css'), await readFile(join(sourceRoot, 'public', 'project-draft.css')));
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: origin,
      DB_PATH: join(directory, 'town.sqlite'), PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: 'qa-placeholder-not-a-real-key',
      ASTRO_GATEWAY_MODEL: 'qa-model', MODEL_DEFAULT: '',
      RENDER_EXTERNAL_URL: '', AI_DEMO_MAX_REQUESTS: '0', AI_DEMO_SESSION_MAX_REQUESTS: '10', AI_DEMO_MAX_CONCURRENT: '1',
    },
  });
  closed = new Promise(resolve => child.once('close', resolve));
  await waitForStartup(child);
});

function waitForStartup(serverProcess) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Isolated AI test server did not start.')), 10000);
    const onData = value => { output += value; if (output.includes('Helpani Town running at')) finish(); };
    const onExit = () => finish(new Error('Isolated AI test server exited before startup.'));
    function finish(error) {
      clearTimeout(timeout); serverProcess.stdout.off('data', onData); serverProcess.stderr.off('data', onData);
      serverProcess.off('exit', onExit); serverProcess.off('error', finish); error ? reject(error) : resolve();
    }
    serverProcess.stdout.on('data', onData); serverProcess.stderr.on('data', onData);
    serverProcess.once('exit', onExit); serverProcess.once('error', finish);
  });
}

after(async () => {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (closed) await closed;
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function request(path, payload, requestOrigin = origin) {
  const response = await fetch(new URL(path, origin), {
    method: payload === undefined ? 'GET' : 'POST',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(payload === undefined ? {} : { Origin: requestOrigin, 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(5000),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, body: await response.json() };
}

test('source metadata exposes configuration readiness and a local audit without a gateway credential', async () => {
  const result = await request('/api/project-draft');
  assert.equal(result.status, 200);
  assert.equal(result.body.enabled, false);
  assert.equal(result.body.configuration.configured, false);
  assert.equal(result.body.configuration.model, 'qa-model');
  assert.equal(result.body.sources.length, 3);
  assert.equal(result.body.budgetAudit.targetCents, 10000);
  const serialized = JSON.stringify(result.body);
  assert.ok(!serialized.includes('qa-placeholder-not-a-real-key'));
  assert.ok(!Object.hasOwn(result.body.configuration, 'key'));
  assert.ok(!Object.hasOwn(result.body.configuration, 'endpoint'));
  const stylesheet = await fetch(new URL('/project-draft.css', origin), { signal: AbortSignal.timeout(5000) });
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);
});

test('selected-source budget checks run without AI and never alter gameplay or funding', async () => {
  const before = await request('/api/state');
  const all = await request('/api/project-budget', { sourceIds: ['rescue-plan', 'supply-register', 'observation-notes'] });
  assert.equal(all.status, 200);
  assert.deepEqual([all.body.targetCents, all.body.itemizedCents, all.body.unallocatedCents], [10000, 6400, 3600]);
  const observation = await request('/api/project-budget', { sourceIds: ['observation-notes'] });
  assert.equal(observation.status, 200);
  assert.deepEqual([observation.body.targetCents, observation.body.itemizedCents, observation.body.unallocatedCents], [null, null, null]);
  assert.deepEqual(observation.body.lineItems, []);
  assert.deepEqual((await request('/api/state')).body, before.body);
});

test('invalid source selection and unconfigured generation have actionable, sanitized API errors', async () => {
  for (const sourceIds of [[], ['unknown'], ['rescue-plan', 'rescue-plan'], null]) {
    const invalid = await request('/api/project-budget', { sourceIds });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'AI_SOURCE_SELECTION_INVALID');
  }
  const generation = await request('/api/project-draft', { sourceIds: ['observation-notes'] });
  assert.equal(generation.status, 503);
  assert.ok(['AI_NOT_CONFIGURED', 'AI_CONFIGURATION_INVALID'].includes(generation.body.code));
  assert.ok(!JSON.stringify(generation.body).includes('qa-placeholder-not-a-real-key'));
  const foreign = await request('/api/project-budget', { sourceIds: ['rescue-plan'] }, 'https://unrelated.example');
  assert.equal(foreign.status, 403);
});

test('HTTP locale allowlist preserves both paid attempts for English-default and Chinese drafts', async t => {
  const callsFile = join(directory, 'locale-gateway-calls.jsonl');
  const mockFile = join(directory, 'locale-gateway-mock.mjs');
  await writeFile(callsFile, '');
  await writeFile(mockFile, `
    import { appendFileSync } from 'node:fs';
    globalThis.fetch = async (url, options) => {
      if (String(url) !== 'https://locale-gateway.example.test/v1/chat/completions') {
        throw new Error('Real network access is disabled in HTTP locale tests.');
      }
      const payload = JSON.parse(options.body);
      appendFileSync(process.env.LOCALE_GATEWAY_CALLS_FILE, JSON.stringify(payload) + '\\n');
      const english = payload.messages[0].content.includes('Write all user-facing strings in English');
      const draft = {
        summary: english ? 'Fictional notes describe light entering at two points.' : '虚构记录描述两处入口亮光。',
        budgetFlags: [],
        task: {
          title: english ? 'Read the fictional notes' : '阅读虚构记录',
          instructions: english ? 'Read the selected notes and identify the number of light-entry points.' : '阅读所选记录，找出亮光入口的数量。',
          sourceIds: ['observation-notes'],
        },
      };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draft) } }] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };
  `);
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  const localeOrigin = `http://127.0.0.1:${port}`;
  const localeServer = spawn(process.execPath, ['--import', mockFile, 'server/index.mjs'], {
    cwd: join(directory, 'runtime'), stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: localeOrigin,
      DB_PATH: join(directory, 'locale-town.sqlite'), PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: 'https://locale-gateway.example.test', ASTRO_GATEWAY_API_KEY: 'locale-unit-test-only',
      ASTRO_GATEWAY_MODEL: 'locale-test-model', MODEL_DEFAULT: '', RENDER_EXTERNAL_URL: '',
      AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '2', AI_DEMO_MAX_CONCURRENT: '1',
      LOCALE_GATEWAY_CALLS_FILE: callsFile,
    },
  });
  const localeClosed = new Promise(resolve => localeServer.once('close', resolve));
  t.after(async () => {
    if (localeServer.exitCode === null && localeServer.signalCode === null) localeServer.kill('SIGTERM');
    await localeClosed;
  });
  await waitForStartup(localeServer);
  let localeCookie;
  async function generate(payload) {
    const response = await fetch(new URL('/api/project-draft', localeOrigin), {
      method: 'POST',
      headers: {
        Origin: localeOrigin, 'Content-Type': 'application/json',
        ...(localeCookie ? { Cookie: localeCookie } : {}),
      },
      body: JSON.stringify({ sourceIds: ['observation-notes'], ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) localeCookie = setCookie.split(';')[0];
    return { status: response.status, body: await response.json() };
  }
  for (const locale of ['fr', 'zh', 'en-US', 'English', null, {}, ['en']]) {
    const rejected = await generate({ locale });
    assert.equal(rejected.status, 400, `unsupported locale ${JSON.stringify(locale)} is rejected`);
  }
  assert.equal(await readFile(callsFile, 'utf8'), '', 'invalid locales never reach the Gateway');
  const english = await generate({});
  assert.equal(english.status, 200, 'the omitted locale uses the first remaining attempt');
  assert.match(english.body.summary, /^Fictional notes/);
  const chinese = await generate({ locale: 'zh-CN' });
  assert.equal(chinese.status, 200, 'Chinese uses the second remaining attempt');
  assert.match(chinese.body.summary, /^虚构记录/);
  const exhausted = await generate({ locale: 'en' });
  assert.equal(exhausted.status, 503);
  assert.equal(exhausted.body.code, 'AI_DEMO_LIMIT_REACHED');
  const calls = (await readFile(callsFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.length, 2, 'only the two accepted generations consume the finite allowance');
  assert.match(calls[0].messages[0].content, /Write all user-facing strings in English/);
  assert.match(calls[1].messages[0].content, /所有面向用户的文字使用简体中文/);
  for (const call of calls) {
    assert.deepEqual(JSON.parse(call.messages[1].content).map(source => source.id), ['observation-notes']);
  }
});

test('abandoning an HTTP draft aborts the Gateway, promptly frees the slot, and keeps its attempt charged', { timeout: 15000 }, async t => {
  const mockFile = join(directory, 'cancel-gateway-mock.mjs');
  await writeFile(mockFile, `
    let calls = 0;
    globalThis.fetch = async (url, { signal }) => {
      if (String(url) !== 'https://cancel-gateway.example.test/v1/chat/completions') {
        throw new Error('Real network access is disabled in HTTP cancellation tests.');
      }
      calls += 1;
      if (calls === 1) return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          process.send({ type: 'gateway-aborted' });
          reject(signal.reason);
        }, { once: true });
        process.send({ type: 'gateway-started' });
      });
      const draft = {
        summary: 'Fictional notes describe light entering at two points.', budgetFlags: [],
        task: {
          title: 'Read the fictional notes',
          instructions: 'Read the selected notes and identify the number of light-entry points.',
          sourceIds: ['observation-notes'],
        },
      };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draft) } }] }));
    };
  `);
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  const cancelOrigin = `http://127.0.0.1:${port}`;
  const cancelServer = spawn(process.execPath, ['--import', mockFile, 'server/index.mjs'], {
    cwd: join(directory, 'runtime'), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: cancelOrigin,
      DB_PATH: join(directory, 'cancel-town.sqlite'), PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: 'https://cancel-gateway.example.test', ASTRO_GATEWAY_API_KEY: 'cancel-unit-test-only',
      ASTRO_GATEWAY_MODEL: 'cancel-test-model', MODEL_DEFAULT: '', RENDER_EXTERNAL_URL: '',
      AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '2', AI_DEMO_MAX_CONCURRENT: '1',
    },
  });
  const cancelClosed = new Promise(resolve => cancelServer.once('close', resolve));
  t.after(async () => {
    if (cancelServer.exitCode === null && cancelServer.signalCode === null) cancelServer.kill('SIGTERM');
    await cancelClosed;
  });
  await waitForStartup(cancelServer);
  function waitForGateway(type) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error(`Gateway did not report ${type}.`)), 3000);
      const onMessage = message => { if (message.type === type) finish(); };
      function finish(error) {
        clearTimeout(timeout);
        cancelServer.off('message', onMessage);
        error ? reject(error) : resolve();
      }
      cancelServer.on('message', onMessage);
    });
  }
  const metadata = await fetch(new URL('/api/project-draft', cancelOrigin));
  const cancelCookie = metadata.headers.get('set-cookie').split(';')[0];
  await metadata.json();
  async function generate(signal = AbortSignal.timeout(5000)) {
    const response = await fetch(new URL('/api/project-draft', cancelOrigin), {
      method: 'POST',
      headers: { Origin: cancelOrigin, Cookie: cancelCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds: ['observation-notes'] }), signal,
    });
    return { status: response.status, body: await response.json() };
  }
  const controller = new AbortController();
  const started = waitForGateway('gateway-started');
  const first = assert.rejects(generate(controller.signal), { name: 'AbortError' });
  await started;
  const busy = await generate();
  assert.equal(busy.status, 503, 'the first request holds the sole slot while its client remains connected');
  assert.equal(busy.body.code, 'AI_DEMO_BUSY');
  const aborted = waitForGateway('gateway-aborted');
  controller.abort();
  await first;
  await aborted;
  const next = await generate();
  assert.equal(next.status, 200, 'a new draft can start immediately after the abandoned upstream request aborts');
  const exhausted = await generate();
  assert.equal(exhausted.status, 503);
  assert.equal(exhausted.body.code, 'AI_DEMO_LIMIT_REACHED', 'the abandoned Gateway attempt is still charged');
});
