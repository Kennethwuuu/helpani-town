import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createGameStore } from '../server/game.mjs';

function fixture(path = ':memory:', options = {}) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS town_pets (session_id TEXT PRIMARY KEY, species TEXT NOT NULL);
    INSERT OR IGNORE INTO town_pets VALUES ('a', 'red-panda'), ('b', 'red-panda'), ('turtle', 'sea-turtle'), ('pangolin', 'pangolin');`);
  const store = createGameStore(db, options);
  const send = (action, data = {}, session = 'a') => store.habitatAction(session, action, {
    requestId: randomUUID(), expectedRevision: store.habitatState(session).revision, ...data,
  });
  return { db, store, send };
}

test('first visit gifts one virtual platform and sessions retain independent layouts', (t) => {
  const { db, store, send } = fixture(); t.after(() => db.close());
  assert.deepEqual(store.habitatState('a').inventory, ['rest-platform']);
  assert.deepEqual(store.habitatState('a').inventory, ['rest-platform']);
  const state = send('layout', { facilityId: 'rest-platform', slotId: 'trunk' });
  assert.equal(state.layout.platform, 'trunk');
  assert.equal(state.pending, true);
  assert.equal(state.appliedLayout.platform, null);
  assert.deepEqual(store.habitatState('b').layout, { platform: null, bridge: false });
  assert.deepEqual(store.habitatState('turtle').inventory, ['rest-platform']);
  assert.deepEqual(store.habitatState('turtle').layout, { platform: null, bridge: false });
});

test('saving construction grants progress immediately; relocation and repeat confirms never grant it twice', (t) => {
  const { db, send } = fixture(); t.after(() => db.close());
  let state = send('layout', { facilityId: 'rest-platform', slotId: 'trunk' });
  assert.equal(state.growth.length, 1);
  assert.equal(state.observations.length, 0);
  assert.equal(state.growth[0].id, 'rest-platform-built');
  state = send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  const version = state.layoutVersion;
  state = send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  assert.equal(state.layoutVersion, version);
  assert.equal(state.layout.platform, 'edge');
  assert.equal(state.growth.length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, 1);
});

test('retry after response loss returns current state without repeating writes or rolling back a later change', (t) => {
  const { db, store, send } = fixture(); t.after(() => db.close());
  const body = { requestId: randomUUID(), expectedRevision: 0, facilityId: 'rest-platform', slotId: 'trunk' };
  store.habitatAction('a', 'layout', body);
  const current = send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  const retry = store.habitatAction('a', 'layout', body);
  assert.deepEqual(retry, current);
  assert.equal(retry.layout.platform, 'edge');
  assert.equal(retry.growth.length, 1);
  assert.throws(() => store.habitatAction('a', 'layout', { ...body, slotId: 'edge' }), (e) => e.status === 409);
});

test('two clients with the same revision cannot overwrite each other', (t) => {
  const { db, store, send } = fixture(); t.after(() => db.close());
  const old = store.habitatState('a');
  const current = send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  assert.throws(() => store.habitatAction('a', 'layout', {
    requestId: randomUUID(), expectedRevision: old.revision, facilityId: 'rest-platform', slotId: 'trunk',
  }), (e) => e.status === 409 && e.state.layout.platform === 'edge');
  assert.deepEqual(store.habitatState('a'), current);
});

test('platform use requires the applied layout and delayed reports cannot pollute a newer layout', (t) => {
  const { db, send, store } = fixture(); t.after(() => db.close());
  let state = send('layout', { facilityId: 'rest-platform', slotId: 'trunk' });
  assert.throws(() => send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: 1 }), (e) => e.status === 409);
  state = send('apply', { layoutVersion: state.layoutVersion });
  assert.equal(state.pending, false);
  assert.equal(state.observations.length, 0);
  state = send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: state.appliedVersion });
  assert.equal(state.observations.length, 1);
  assert.equal(state.observations[0].slotId, 'trunk');
  state = send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  assert.equal(state.appliedLayout.platform, 'trunk'); // Current rest remains supported.
  state = send('apply', { layoutVersion: state.layoutVersion });
  assert.throws(() => send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: 1 }), (e) => e.status === 409);
  state = send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: state.appliedVersion });
  assert.equal(state.observations.length, 1);
  assert.equal(store.habitatState('a').growth.length, 1);
});

test('pending placement and first-use record survive database close and reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'helpani-habitat-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'test.sqlite');
  const first = fixture(path);
  first.send('layout', { facilityId: 'rest-platform', slotId: 'edge' });
  first.db.close();
  const second = fixture(path);
  const pending = second.store.habitatState('a');
  assert.equal(pending.pending, true);
  assert.equal(pending.layout.platform, 'edge');
  assert.equal(pending.appliedLayout.platform, null);
  second.send('apply', { layoutVersion: pending.layoutVersion });
  second.send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: pending.layoutVersion });
  second.db.close();
  const third = fixture(path); t.after(() => third.db.close());
  assert.equal(third.store.habitatState('a').pending, false);
  assert.equal(third.store.habitatState('a').observations.length, 1);
});

test('invalid positions, locked content, malformed commands and stale application do not consume revisions', (t) => {
  const { db, store, send } = fixture(); t.after(() => db.close());
  const state = store.habitatState('a');
  assert.throws(() => send('layout', { facilityId: 'rest-platform', slotId: 'anywhere' }), (e) => e.status === 400);
  assert.throws(() => send('layout', { facilityId: 'woodland-bridge', slotId: 'canopy' }), (e) => e.status === 409);
  assert.throws(() => send('apply', { layoutVersion: 23 }), (e) => e.status === 409);
  assert.throws(() => store.habitatAction('a', 'layout', null), (e) => e.status === 400);
  assert.throws(() => store.habitatAction('a', 'layout', { requestId: 'invalid', expectedRevision: 0 }), (e) => e.status === 400);
  assert.deepEqual(store.habitatState('a'), state);
});

test('ordinary discoveries are unique and facilities cannot be credited to unrelated behaviors', (t) => {
  const { db, send } = fixture(); t.after(() => db.close());
  const request = { behavior: 'climb', facilityId: null, layoutVersion: 0 };
  send('observe', request);
  const state = send('observe', request);
  assert.equal(state.observations.length, 1);
  assert.equal(state.observations[0].title, '沿着树干向上');
  assert.throws(() => send('observe', { ...request, facilityId: 'rest-platform' }), (e) => e.status === 400);
  assert.equal(state.growth.length, 0);
});


for (const session of ['turtle', 'pangolin', 'visitor']) {
  test(`${session}: woodland visits preserve adoption while retaining layout and patrol progress`, (t) => {
    const { db, store, send } = fixture(':memory:', { rollDie: () => 6, random: () => .9 });
    t.after(() => db.close());
    const pets = db.prepare('SELECT session_id, species FROM town_pets ORDER BY session_id');
    const beforePets = pets.all();
    assert.deepEqual(store.habitatState(session).inventory, ['rest-platform']);
    const placement = {
      requestId: randomUUID(), expectedRevision: 0, facilityId: 'rest-platform', slotId: 'trunk',
    };
    let habitat = store.habitatAction(session, 'layout', placement);
    assert.deepEqual(store.habitatAction(session, 'layout', placement), habitat);
    habitat = send('apply', { layoutVersion: habitat.layoutVersion }, session);
    habitat = send('observe', { behavior: 'platform-rest', facilityId: 'rest-platform', layoutVersion: habitat.appliedVersion }, session);
    assert.equal(habitat.growth.length, 1);
    assert.equal(habitat.observations.length, 1);

    const patrol = (action, data = {}) => store.patrolAction(session, action, {
      requestId: randomUUID(), expectedRevision: store.patrolState(session).revision, ...data,
    });
    const completeRoute = () => {
      patrol('start', { theme: 'habitat' });
      while (!store.patrolState(session).completed) {
        const rolled = patrol('roll');
        patrol('choose', { eventVisitId: rolled.pendingEvent.id, choiceId: rolled.pendingEvent.choices[0].id });
      }
    };
    completeRoute();
    habitat = store.habitatState(session);
    assert.deepEqual(habitat.inventory, ['rest-platform', 'woodland-bridge']);
    assert.equal(store.patrolState(session).chapters.length, 2);
    const rewardCount = db.prepare('SELECT COUNT(*) AS n FROM game_rewards WHERE session_id = ?').get(session).n;
    completeRoute();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_rewards WHERE session_id = ?').get(session).n, rewardCount);
    assert.equal(store.patrolState(session).chapters.length, 2);
    assert.deepEqual(store.habitatState(session).inventory, habitat.inventory);

    // A subsequent visit uses the same session progress, without an implicit adoption.
    const revisited = createGameStore(db);
    assert.equal(revisited.habitatState(session).layout.platform, 'trunk');
    assert.equal(revisited.habitatState(session).growth.length, 2);
    assert.equal(revisited.patrolState(session).position, 8);
    assert.deepEqual(pets.all(), beforePets);
    if (session === 'visitor') assert.equal(db.prepare('SELECT 1 FROM town_pets WHERE session_id = ?').get(session), undefined);
  });
}
