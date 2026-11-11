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
    },
  });
  closed = new Promise(resolve => child.once('close', resolve));
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Isolated AI test server did not start.')), 10000);
    const onData = value => { output += value; if (output.includes('Helpani Town running at')) finish(); };
    const onExit = () => finish(new Error('Isolated AI test server exited before startup.'));
    function finish(error) {
      clearTimeout(timeout); child.stdout.off('data', onData); child.stderr.off('data', onData);
      child.off('exit', onExit); child.off('error', finish); error ? reject(error) : resolve();
    }
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', onExit); child.once('error', finish);
  });
});

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
