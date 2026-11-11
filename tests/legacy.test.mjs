import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
let server;
let serverClosed;
let testDirectory;
let origin;

before(async () => {
  testDirectory = await mkdtemp(join(tmpdir(), 'helpani-legacy-'));
  // Reserve an ephemeral port rather than assuming the normal demo port is free.
  const portReservation = createServer();
  portReservation.listen(0, '127.0.0.1');
  await once(portReservation, 'listening');
  const { port } = portReservation.address();
  await new Promise((resolve, reject) => portReservation.close((error) => error ? reject(error) : resolve()));
  origin = `http://127.0.0.1:${port}`;

  server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: origin,
      DB_PATH: join(testDirectory, 'legacy.sqlite'),
      PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: '',
    },
  });
  serverClosed = new Promise((resolve) => server.once('close', resolve));
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error(`Test server did not start: ${output}`)), 10_000);
    const onData = (data) => {
      output += data.toString();
      if (output.includes('Helpani Town running at')) finish();
    };
    const onExit = (code) => finish(new Error(`Test server exited (${code}): ${output}`));
    const finish = (error) => {
      clearTimeout(timeout);
      server.stdout.off('data', onData);
      server.stderr.off('data', onData);
      server.off('exit', onExit);
      server.off('error', finish);
      error ? reject(error) : resolve();
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('exit', onExit);
    server.once('error', finish);
  });
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  if (serverClosed) await serverClosed;
  if (testDirectory) await rm(testDirectory, { recursive: true, force: true });
});

function player() {
  let cookie;
  async function request(path, body, expectedStatus = 200) {
    const headers = cookie ? { Cookie: cookie } : {};
    const options = { headers, signal: AbortSignal.timeout(5_000) };
    if (body !== undefined) {
      options.method = 'POST';
      headers['Content-Type'] = 'application/json';
      headers.Origin = origin;
      options.body = JSON.stringify(body);
    }
    const response = await fetch(new URL(path, origin), options);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const result = await response.json();
    assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(result)}`);
    return result;
  }
  return {
    state: () => request('/api/state'),
    get: (path) => request(path),
    post: (path, body = {}, expectedStatus = 200) => request(path, body, expectedStatus),
  };
}

test('woodland serves the medal photo module, rewards stylesheet and all three PNG badges', async () => {
  const page = await fetch(new URL('/woodland', origin), { signal: AbortSignal.timeout(5_000) });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /^text\/html(?:;|$)/i);
  const html = await page.text();
  const rewardsStylesheet = html.match(/<link\b[^>]*\bhref=["']([^"']*\/patrol-rewards\.css(?:\?[^"']*)?)["']/i)?.[1];
  assert.ok(rewardsStylesheet, '/woodland must load the rewards stylesheet');

  const assets = [
    { path: '/medal-photo.js?v=asset-smoke', mime: /^text\/javascript(?:;|$)/i },
    { path: rewardsStylesheet, mime: /^text\/css(?:;|$)/i },
    ...['canopy-listener', 'leaf-reader', 'trail-finder'].map((id) => ({
      path: `/assets/medals/${id}.png`, mime: /^image\/png(?:;|$)/i, png: true,
    })),
  ];
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const { path, mime, png } of assets) {
    try {
      const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(5_000) });
      assert.equal(response.status, 200, `${path} is required for the earned photo reward`);
      assert.match(response.headers.get('content-type') || '', mime, `${path} must have a browser-usable MIME type`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (png) {
        assert.ok(bytes.length > 24, `${path} must contain image data`);
        assert.deepEqual(bytes.subarray(0, 8), pngSignature, `${path} must be a PNG rather than an error page`);
      } else {
        assert.ok(bytes.toString('utf8').trim().length > 0, `${path} must contain source content`);
      }
    } catch (error) {
      throw new Error(`GET ${path} failed: ${error.message || error.name}`, { cause: error });
    }
  }
});

for (const species of ['sea-turtle', 'red-panda', 'pangolin']) {
  test(`${species}: adoption, greeting, first letter progress and daily care survive retries`, async () => {
    const client = player();
    const empty = await client.state();
    assert.equal(empty.pet, null);
    let state = await client.post('/api/pet/adopt', { species });
    assert.equal(state.pet.species, species);
    assert.equal(state.food, 1);
    assert.equal(state.pet.feedCount, 0);
    state = await client.post('/api/pet/adopt', { species });
    assert.equal(state.food, 1, 'adoption retry must not grant more food');
    state = await client.post('/api/pet/touch', { species });
    assert.equal(state.pet.encountered, true);

    const firstFeed = { slot: 1, day: state.gameDay, species };
    state = await client.post('/api/pet/feed', firstFeed);
    assert.equal(state.pet.feedCount, 1, 'first story unlock threshold');
    assert.equal(state.pet.feedsToday, 1);
    assert.equal(state.xp, 10);
    assert.equal(state.food, 0);
    const firstResult = state;
    state = await client.post('/api/pet/feed', firstFeed);
    assert.deepEqual(state, firstResult, 'first feed retry must not consume or reward twice');

    state = await client.post('/api/pet/check-in', { day: state.gameDay });
    assert.equal(state.food, 1);
    assert.equal(state.checkInAvailable, false);
    assert.deepEqual(await client.post('/api/pet/check-in', { day: state.gameDay }), state);
    state = await client.post('/api/pet/feed', { slot: 2, day: state.gameDay, species });
    assert.equal(state.pet.feedsToday, 2);
    assert.equal(state.pet.feedCount, 2);
    assert.equal(state.food, 0);
    assert.equal(state.points, 0, 'virtual care must not create charity points');
    assert.deepEqual(await client.post('/api/pet/feed', { slot: 2, day: state.gameDay, species }), state);
    await client.post('/api/pet/feed', { slot: 3, day: state.gameDay, species }, 400);
    assert.deepEqual(await client.state(), state, 'reload preserves the completed day');

    const previousDay = state.gameDay;
    state = await client.post('/api/demo/next-day', { day: previousDay });
    assert.equal(state.demoDay, 2);
    assert.equal(state.pet.feedCount, 2);
    assert.equal(state.pet.feedsToday, 0);
    assert.equal(state.checkInAvailable, true);
    assert.deepEqual(await client.post('/api/demo/next-day', { day: previousDay }), state);
    await client.post('/api/pet/feed', { slot: 1, day: previousDay, species }, 409);
    state = await client.post('/api/pet/check-in', { day: state.gameDay });
    state = await client.post('/api/pet/feed', { slot: 1, day: state.gameDay, species });
    assert.equal(state.pet.feedCount, 3);
    assert.equal(state.xp, 30);
  });
}

test('activity registration, organizer verification and sessions remain isolated and idempotent', async () => {
  const client = player();
  const other = player();
  await client.state();
  const isolated = await other.state();
  assert.equal(isolated.points, 0);
  await client.post('/api/organizer/verify', { id: 'park-cleanup' }, 409);

  for (const id of ['park-cleanup', 'bird-safe-windows']) {
    const beforeRegistration = await client.state();
    let state = await client.post('/api/activity/signup', { id });
    assert.equal(state.activities[id], 'signed_up');
    assert.equal(state.points, beforeRegistration.points, 'signup must not grant points');
    assert.deepEqual(await client.post('/api/activity/signup', { id }), state);
    const roster = await client.get('/api/organizer/registrations');
    assert.equal(roster.registrations.filter((entry) => entry.id === id).length, 1);
    const verified = await client.post('/api/organizer/verify', { id });
    assert.equal(verified.points, beforeRegistration.points + 100);
    assert.deepEqual(await client.post('/api/organizer/verify', { id }), verified);
    state = await client.state();
    assert.equal(state.activities[id], 'verified');
    assert.equal(state.points, beforeRegistration.points + 100);
  }

  assert.deepEqual(await other.state(), isolated);
  assert.deepEqual((await other.get('/api/organizer/registrations')).registrations, []);
});

test('food exchange and sponsor allocation debit the shared charity balance once', async () => {
  const client = player();
  await client.state();
  await client.post('/api/pet/adopt', { species: 'red-panda' });
  await client.post('/api/pet/exchange', { requestId: randomUUID() }, 409);
  await client.post('/api/pet/exchange', { requestId: 'invalid' }, 400);
  for (const id of ['park-cleanup', 'bird-safe-windows']) {
    await client.post('/api/activity/signup', { id });
    await client.post('/api/organizer/verify', { id });
  }
  const requestId = randomUUID();
  let state = await client.post('/api/pet/exchange', { requestId });
  assert.equal(state.points, 150);
  assert.equal(state.food, 2);
  assert.equal(state.foodExchanges, 1);
  assert.deepEqual(await client.post('/api/pet/exchange', { requestId }), state);

  state = await client.post('/api/sponsor/allocate');
  assert.equal(state.points, 50);
  assert.equal(state.allocatedCents, 200);
  assert.equal(state.budgetCents, 800);
  assert.deepEqual(await client.post('/api/sponsor/allocate'), state);
  state = await client.post('/api/pet/exchange', { requestId: randomUUID() });
  assert.equal(state.points, 0);
  assert.equal(state.food, 3);
  assert.equal(state.foodExchanges, 2);
  await client.post('/api/pet/exchange', { requestId: randomUUID() }, 409);
  assert.deepEqual(await client.state(), state, 'failed exchange leaves the ledger unchanged');
  assert.deepEqual(state.payments, [], 'simulated allocation must not create a payment');
});

test('disabled PayPal rejects valid orders clearly and invalid amounts before configuration', async () => {
  const client = player();
  const beforeOrder = await client.state();
  assert.equal(beforeOrder.paypalEnabled, false);
  const missingConfiguration = await client.post('/api/paypal/order', { kind: 'donation', amountCents: 500 }, 503);
  assert.match(missingConfiguration.error, /沙箱尚未配置/);
  await client.post('/api/paypal/order', { kind: 'supply' }, 503);
  for (const amountCents of [0, -500, 501, 5.5, '500']) {
    await client.post('/api/paypal/order', { kind: 'donation', amountCents }, 400);
  }
  await client.post('/api/paypal/order', { kind: 'supply', amountCents: 1 }, 400);
  assert.deepEqual(await client.state(), beforeOrder);
});

test('trying an earned photo accent through HTTP preserves care, charity balance and payment records', async () => {
  const client = player();
  await client.state();
  let town = await client.post('/api/pet/adopt', { species: 'red-panda' });
  await client.post('/api/pet/feed', { slot: 1, day: town.gameDay, species: 'red-panda' });
  await client.post('/api/activity/signup', { id: 'park-cleanup' });
  await client.post('/api/organizer/verify', { id: 'park-cleanup' });
  await client.post('/api/sponsor/allocate');
  const townBefore = await client.state();
  assert.equal(townBefore.xp, 10);
  assert.equal(townBefore.allocatedCents, 200);
  assert.equal(townBefore.budgetCents, 800);

  let patrol = await client.get('/api/patrol/state');
  const patrolPost = async (action, data = {}) => {
    patrol = await client.post(`/api/patrol/${action}`, {
      requestId: randomUUID(), expectedRevision: patrol.revision, ...data,
    });
    return patrol;
  };
  // Four answered events guarantee a deliberate claim even when no random medal drops.
  while (patrol.eventCount < 4) {
    if (!patrol.runId || patrol.completed) await patrolPost('start', { theme: 'rest' });
    const pending = (await patrolPost('roll')).pendingEvent;
    await patrolPost('choose', { eventVisitId: pending.id, choiceId: pending.choices[0].id });
  }
  if (!patrol.medals.length) await patrolPost('collect', { medalId: patrol.medalCatalog[0].id });
  const medalId = patrol.medals[0].id;
  const patrolBefore = patrol;
  const habitatBefore = await client.get('/api/habitat/state');
  const request = { requestId: randomUUID(), expectedRevision: patrol.revision, medalId };
  const equipped = await client.post('/api/patrol/equip', request);
  assert.equal(equipped.equippedMedalId, medalId);
  assert.equal(equipped.revision, patrolBefore.revision + 1);
  const { revision: beforeRevision, equippedMedalId: previousAccent, ...beforeProgress } = patrolBefore;
  const { revision: equippedRevision, equippedMedalId: selectedAccent, ...equippedProgress } = equipped;
  assert.deepEqual(equippedProgress, beforeProgress);
  assert.deepEqual(await client.post('/api/patrol/equip', request), equipped, 'a lost response does not equip or reward twice');
  assert.deepEqual(await client.state(), townBefore, 'equipping cannot touch care, points, simulated sponsorship or PayPal records');
  assert.deepEqual(await client.get('/api/habitat/state'), habitatBefore);
  assert.deepEqual(await client.get('/api/patrol/state'), equipped);

  const removed = await client.post('/api/patrol/equip', {
    requestId: randomUUID(), expectedRevision: equipped.revision, medalId: null,
  });
  assert.equal(removed.equippedMedalId, null);
  assert.deepEqual(await client.state(), townBefore);
  assert.deepEqual(await client.get('/api/habitat/state'), habitatBefore);
});
