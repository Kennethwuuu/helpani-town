import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

let directory, runtime, rendered, custom, limited;
const children = [];
const renderOrigin = 'https://helpani-qa.onrender.com';
const customOrigin = 'https://helpani-custom.example';

async function start(overrides, mockGateway = false) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  const local = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    ...(mockGateway ? ['--import', './gateway-mock.mjs'] : []), 'server/index.mjs',
  ], {
    cwd: runtime, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: '',
      RENDER_EXTERNAL_URL: '', DB_PATH: join(directory, `${port}.sqlite`),
      PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '', ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: '',
      ASTRO_GATEWAY_MODEL: 'qa-model', MODEL_DEFAULT: '', AI_DEMO_MAX_REQUESTS: '0',
      AI_DEMO_SESSION_MAX_REQUESTS: '10', AI_DEMO_MAX_CONCURRENT: '1', ...overrides,
    },
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  children.push({ child, closed });
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Deployment fixture did not start.')), 10000);
    const onData = chunk => { output += chunk; if (output.includes('Helpani Town running at')) finish(); };
    const onExit = () => finish(new Error('Deployment fixture exited before startup.'));
    function finish(error) {
      clearTimeout(timeout); child.stdout.off('data', onData); child.stderr.off('data', onData);
      child.off('exit', onExit); child.off('error', finish); error ? reject(error) : resolve();
    }
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', onExit); child.once('error', finish);
  });
  return { local, publicOrigin: overrides.PUBLIC_ORIGIN || overrides.RENDER_EXTERNAL_URL || local };
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'helpani-deployment-'));
  runtime = join(directory, 'runtime');
  await mkdir(join(runtime, 'server'), { recursive: true });
  const root = fileURLToPath(new URL('..', import.meta.url));
  await Promise.all((await readdir(join(root, 'server'))).filter(name => name.endsWith('.mjs')).map(async name => {
    await writeFile(join(runtime, 'server', name), await readFile(join(root, 'server', name)));
  }));
  // Child-only mock: no provider request can leave the fixture process.
  await writeFile(join(runtime, 'gateway-mock.mjs'), `
    globalThis.fetch = async url => {
      if (String(url) !== 'https://gateway.example.test/v1/chat/completions') throw new Error('Unexpected upstream');
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({
        summary:'Fictional notes describe light entering at two points.',budgetFlags:['No budget information is provided.'],
        task:{title:'Read the location notes',instructions:'Find where the light enters in the selected text.',sourceIds:['observation-notes']}
      })}}]}), {headers:{'Content-Type':'application/json'}});
    };
  `);
  [rendered, custom, limited] = await Promise.all([
    start({ RENDER_EXTERNAL_URL: renderOrigin }),
    start({ PUBLIC_ORIGIN: customOrigin, RENDER_EXTERNAL_URL: renderOrigin }),
    start({
      AI_DEMO_MAX_REQUESTS: '2', AI_DEMO_SESSION_MAX_REQUESTS: '1',
      ASTRO_GATEWAY_URL: 'https://gateway.example.test', ASTRO_GATEWAY_API_KEY: 'qa-only-not-a-real-key',
    }, true),
  ]);
});

after(async () => {
  for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await Promise.all(children.map(({ closed }) => closed));
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function post(fixture, path, body, cookie, origin = fixture.publicOrigin) {
  return fetch(fixture.local + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
}

test('health check reports liveness without creating visitor cookies', async () => {
  const response = await fetch(rendered.local + '/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('set-cookie'), null);
});

test('Render HTTPS origin controls POST acceptance and secure session cookies', async () => {
  const state = await fetch(rendered.local + '/api/state');
  const cookie = state.headers.get('set-cookie');
  assert.match(cookie, /; Secure(?:;|$)/);
  assert.match(cookie, /; HttpOnly(?:;|$)/);
  assert.match(cookie, /; SameSite=Lax(?:;|$)/);
  assert.equal((await post(rendered, '/api/project-budget', { sourceIds: ['observation-notes'] })).status, 200);
  assert.equal((await post(rendered, '/api/project-budget', { sourceIds: ['observation-notes'] }, '', 'https://unrelated.example')).status, 403);
});

test('explicit canonical domain overrides the Render default URL', async () => {
  const body = { sourceIds: ['observation-notes'] };
  assert.equal((await post(custom, '/api/project-budget', body)).status, 200);
  assert.equal((await post(custom, '/api/project-budget', body, '', renderOrigin)).status, 403);
});

test('HTTP wiring enforces session/global AI limits while keeping local budget and funding state usable', async () => {
  const initial = await fetch(limited.local + '/api/state');
  const session = initial.headers.get('set-cookie').split(';')[0];
  const before = await initial.json();
  const body = { sourceIds: ['observation-notes'] };
  const first = await post(limited, '/api/project-draft', body, session);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).generation.attempts, 1);
  const sessionDenied = await post(limited, '/api/project-draft', body, session);
  assert.equal(sessionDenied.status, 503);
  assert.equal((await sessionDenied.json()).code, 'AI_DEMO_LIMIT_REACHED');
  assert.equal((await post(limited, '/api/project-draft', body)).status, 200, 'another session can use remaining global allowance');
  const globalDenied = await post(limited, '/api/project-draft', body);
  assert.equal(globalDenied.status, 503);
  assert.equal((await globalDenied.json()).code, 'AI_DEMO_LIMIT_REACHED');
  assert.equal((await post(limited, '/api/project-budget', body, session)).status, 200);
  const after = await (await fetch(limited.local + '/api/state', { headers: { Cookie: session } })).json();
  assert.deepEqual(after, before);
});
