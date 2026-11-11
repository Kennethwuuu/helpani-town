import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

let origin, directory, server, closed;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'helpani-adoption-state-'));
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: origin,
      DB_PATH: join(directory, 'adoption.sqlite'), PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
      ASTRO_GATEWAY_URL: '', ASTRO_GATEWAY_API_KEY: '' },
  });
  closed = new Promise(resolve => server.once('close', resolve));
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => finish(new Error(`Test server did not start: ${output}`)), 10000);
    const onData = bytes => { output += bytes; if (output.includes('Helpani Town running at')) finish(); };
    const onExit = code => finish(new Error(`Test server exited (${code}): ${output}`));
    function finish(error) {
      clearTimeout(timeout); server.stdout.off('data', onData); server.stderr.off('data', onData);
      server.off('exit', onExit); server.off('error', finish); error ? reject(error) : resolve();
    }
    server.stdout.on('data', onData); server.stderr.on('data', onData);
    server.once('exit', onExit); server.once('error', finish);
  });
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  if (closed) await closed;
  if (directory) await rm(directory, { recursive: true, force: true });
});

function player() {
  let cookie;
  return async (bodyOrPath, payload) => {
    const body = typeof bodyOrPath === 'string' ? payload : bodyOrPath;
    const path = typeof bodyOrPath === 'string' ? bodyOrPath : body ? '/api/pet/adopt' : '/api/state';
    const response = await fetch(new URL(path, origin), {
      method: body ? 'POST' : 'GET',
      headers: { ...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type':'application/json',Origin:origin} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(5000),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status:response.status, state:await response.json() };
  };
}

test('explicit fresh pangolin adoption and reload preserve the selected species', async () => {
  const request = player();
  assert.equal((await request()).state.pet, null);
  const adopted = await request({species:'pangolin',previousSpecies:null});
  assert.equal(adopted.status, 200); assert.equal(adopted.state.pet.species, 'pangolin');
  assert.equal((await request()).state.pet.species, 'pangolin');
});

test('an older client cannot report success with a turtle after explicitly selecting pangolin', async () => {
  const request = player();
  await request();
  const original = await request({species:'sea-turtle'});
  assert.equal(original.status, 200); assert.equal(original.state.pet.species, 'sea-turtle');
  const sameSpeciesRetry = await request({species:'sea-turtle'});
  assert.equal(sameSpeciesRetry.status, 200);
  assert.deepEqual(sameSpeciesRetry.state, original.state, 'retrying the same animal must remain idempotent');
  const mismatch = await request({species:'pangolin'});
  assert.equal(mismatch.status, 409, 'a different requested animal must not return HTTP 200 with the existing turtle');
  assert.match(mismatch.state.error, /选择尚未生效/);
  assert.deepEqual((await request()).state, original.state, 'rejected adoption must preserve the current companion and care');
});

test('legacy random and explicit same-species retries preserve all progress without food or money rewards', async () => {
  const request = player();
  await request();
  const original = await request({species:'pangolin',previousSpecies:null});
  for (const selection of ['pangolin','random']) {
    const retried = await request({species:selection});
    assert.equal(retried.status, 200);
    assert.deepEqual(retried.state, original.state);
  }
});

test('stale explicit companion versions cannot replace or pretend to replace the current animal', async () => {
  const request = player();
  await request();
  const original = await request({species:'sea-turtle',previousSpecies:null});
  for (const previousSpecies of [null,'red-panda']) {
    const stale = await request({species:'pangolin',previousSpecies});
    assert.equal(stale.status, 409);
    assert.match(stale.state.error, /当前伙伴已更新/);
  }
  assert.deepEqual((await request()).state, original.state);
});

async function earnedTurtle(request) {
  await request();
  let state = (await request({species:'sea-turtle',previousSpecies:null})).state;
  while (state.pet.feedCount < 6) {
    if (state.pet.feedsToday >= 2 || (state.food === 0 && !state.checkInAvailable)) {
      state = (await request('/api/demo/next-day',{day:state.gameDay})).state;
    }
    if (state.food === 0) state = (await request('/api/pet/check-in',{day:state.gameDay})).state;
    const fed = await request('/api/pet/feed',{day:state.gameDay,slot:state.pet.feedsToday+1,species:'sea-turtle'});
    assert.equal(fed.status, 200); state = fed.state;
  }
  const medal = await request('/api/pet/medal',{species:'sea-turtle'});
  assert.equal(medal.status, 200); assert.ok(medal.state.medals.includes('sea-turtle'));
  return medal.state;
}

test('an earned turtle still requires an explicit previous companion to adopt pangolin, preserving ledgers and the archive', async () => {
  const request = player();
  const earned = await earnedTurtle(request);
  const implicit = await request({species:'pangolin'});
  assert.equal(implicit.status, 409, 'completed stories do not make an ambiguous old request safe');
  assert.deepEqual((await request()).state, earned);
  const adopted = await request({species:'pangolin',previousSpecies:'sea-turtle'});
  assert.equal(adopted.status, 200); assert.equal(adopted.state.pet.species, 'pangolin');
  assert.equal(adopted.state.pet.feedCount, 0);
  assert.equal(adopted.state.food, earned.food+1, 'the next companion grants exactly one care food');
  assert.deepEqual(adopted.state.medals, earned.medals);
  for (const key of ['xp','points','budgetCents','allocatedCents','payments','activities','foodExchanges','gameDay','demoDay']) {
    assert.deepEqual(adopted.state[key], earned[key], `${key} must be retained through adoption`);
  }
  assert.deepEqual((await request()).state, adopted.state, 'reload must preserve the explicit new companion');
  const retriedOldRequest = await request({species:'pangolin',previousSpecies:'sea-turtle'});
  assert.equal(retriedOldRequest.status, 409, 'a stale successful request must not add food again');
  assert.deepEqual((await request()).state, adopted.state);
  const isolated = player();
  const other = await isolated();
  assert.equal(other.state.pet, null); assert.equal(other.state.food, 0); assert.equal(other.state.xp, 0);
});
