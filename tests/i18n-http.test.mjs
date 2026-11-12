import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const assets = ['i18n.js', 'i18n-town.js', 'i18n-woodland.js', 'i18n-organizer.js', 'i18n.css'];
const pages = ['index.html', 'organizer.html', 'project-draft.html'];
const expected = new Map();
let directory, child, closed, origin;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'helpani-i18n-http-'));
  await Promise.all(['server', 'public'].map(name => mkdir(join(directory, name))));
  const root = fileURLToPath(new URL('..', import.meta.url));
  await Promise.all((await readdir(join(root, 'server'))).filter(name => name.endsWith('.mjs')).map(async name => {
    await writeFile(join(directory, 'server', name), await readFile(join(root, 'server', name)));
  }));
  await Promise.all([...assets, ...pages].map(async name => {
    const content = await readFile(join(root, 'public', name), 'utf8');
    expected.set(name, content);
    await writeFile(join(directory, 'public', name), content);
  }));
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: directory, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, HOST: '127.0.0.1', PORT: String(port), PUBLIC_ORIGIN: origin,
      RENDER_EXTERNAL_URL: '', DB_PATH: ':memory:',
      PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: '',
    },
  });
  closed = new Promise(resolve => child.once('close', resolve));
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Language HTTP fixture did not start.')), 10000);
    const onData = chunk => { output += chunk; if (output.includes('Helpani Town running at')) finish(); };
    const onExit = () => finish(new Error('Language HTTP fixture exited before startup.'));
    function finish(error) {
      clearTimeout(timeout);
      child.stdout.off('data', onData); child.stderr.off('data', onData);
      child.off('exit', onExit); child.off('error', finish);
      error ? reject(error) : resolve();
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

test('language scripts and stylesheet are served by the explicit HTTP asset allowlist', async () => {
  await Promise.all(assets.map(async name => {
    const response = await fetch(`${origin}/${name}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, `${name} must be reachable`);
    assert.match(response.headers.get('content-type'), name.endsWith('.css') ? /^text\/css\b/ : /^text\/javascript\b/);
    assert.equal(await response.text(), expected.get(name), `${name} must serve its own content`);
  }));
});

test('every entry page declares English and loads language support before page behavior', async () => {
  for (const [route, page, behavior] of [['/', 'index.html', 'app.js'], ['/organizer', 'organizer.html', 'organizer.js'], ['/project-draft', 'project-draft.html', 'project-draft.js']]) {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.equal(html, expected.get(page));
    assert.match(html, /<html\s+lang="en"/);
    assert.match(html, /href="\/i18n\.css(?:[?"][^>]*)?/);
    const runtime = html.indexOf('src="/i18n.js');
    const application = html.indexOf(`src="/${behavior}`);
    assert.ok(runtime >= 0 && runtime < application, `${route} must load language support before behavior`);
    for (const name of assets.filter(name => name.endsWith('.js') && name !== 'i18n.js')) {
      assert.ok(html.includes(`src="/${name}`), `${route} must load ${name}`);
    }
  }
});
