import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createGameStore } from '../server/game.mjs';

const definitions = {
  pangolin: { facility: 'leaf-nest', slots: ['root-den', 'leaf-bed'], construction: 'leaf-nest-built', use: 'shelter-rest', ordinary: ['ground-explore', 'dig', 'curled-rest'] },
  'sea-turtle': { facility: 'rest-ledge', slots: ['seagrass', 'rock-shelf'], construction: 'rest-ledge-built', use: 'ledge-rest', ordinary: ['swim', 'surface'] },
};

function fixture(path = ':memory:', options = {}) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS town_pets (session_id TEXT PRIMARY KEY, species TEXT NOT NULL);
    INSERT OR IGNORE INTO town_pets VALUES ('a', 'pangolin'), ('b', 'sea-turtle');`);
  const store = createGameStore(db, { rollDie: () => 6, random: () => .9, ...options });
  const state = (species, session = 'a') => store.habitatState(session, species);
  const body = (species, data = {}, session = 'a') => ({
    requestId: randomUUID(), expectedRevision: state(species, session).revision,
    ...(species === undefined ? {} : { species }), ...data,
  });
  const send = (species, action, data = {}, session = 'a') => store.habitatAction(session, action, body(species, data, session));
  const place = (species, slot = definitions[species].slots[0], session = 'a') => send(species, 'layout', { facilityId: definitions[species].facility, slotId: slot }, session);
  const apply = (species, session = 'a') => send(species, 'apply', { layoutVersion: state(species, session).layoutVersion }, session);
  const use = (species, session = 'a') => send(species, 'observe', { behavior: definitions[species].use, facilityId: definitions[species].facility, layoutVersion: state(species, session).appliedVersion }, session);
  return { db, store, state, body, send, place, apply, use };
}

test('each species has one independent starter facility; default and explicit panda preserve the old save', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const old = game.send(undefined, 'layout', { facilityId: 'rest-platform', slotId: 'trunk' });
  const storedPanda = game.db.prepare('SELECT * FROM habitat_states WHERE session_id = ?').get('a');
  assert.deepEqual(game.state('red-panda'), old);
  assert.deepEqual(game.state(undefined), old);
  for (const [species, definition] of Object.entries(definitions)) {
    const first = game.state(species);
    assert.deepEqual(first.inventory, [definition.facility]);
    assert.deepEqual(first.layout, { platform: null, bridge: false });
    assert.deepEqual(first.appliedLayout, first.layout);
    assert.equal(first.revision, 0); assert.equal(first.pending, false);
    assert.deepEqual(first.observations, []); assert.deepEqual(first.growth, []);
    assert.deepEqual(game.state(species), first);
    game.place(species);
    assert.deepEqual(game.state(species, 'b'), first, 'another session must keep its own empty habitat');
  }
  assert.deepEqual(game.state(), old, 'other animal layouts must not overwrite the legacy panda save');
  assert.deepEqual(game.db.prepare('SELECT * FROM habitat_states WHERE session_id = ?').get('a'), storedPanda);
});

for (const [species, definition] of Object.entries(definitions)) {
  test(`${species}: construction saves immediately, use follows application, relocation never repeats growth or first use`, (t) => {
    const game = fixture(); t.after(() => game.db.close());
    const empty = game.state(species);
    assert.deepEqual(game.state(species), empty, 'reading or cancelling a preview has no write');
    const saved = game.place(species);
    assert.equal(saved.layout.platform, definition.slots[0]);
    assert.equal(saved.layoutVersion, 1); assert.equal(saved.pending, true);
    assert.equal(saved.growth.length, 1); assert.equal(saved.growth[0].id, definition.construction);
    assert.deepEqual(saved.observations, []); assert.equal(saved.appliedLayout.platform, null);
    assert.throws(() => game.use(species), (error) => error.status === 409);
    assert.deepEqual(game.state(species), saved);
    const applied = game.apply(species);
    assert.equal(applied.pending, false); assert.equal(applied.appliedLayout.platform, definition.slots[0]);
    const used = game.use(species);
    assert.equal(used.observations.length, 1);
    assert.equal(used.observations[0].facilityId, definition.facility);
    assert.equal(used.observations[0].slotId, definition.slots[0]);
    assert.equal(used.observations[0].behavior, definition.use);
    assert.deepEqual(game.use(species), used, 'another report is the same first discovery');
    const moved = game.place(species, definition.slots[1]);
    assert.equal(moved.layout.platform, definition.slots[1]);
    assert.equal(moved.appliedLayout.platform, definition.slots[0]);
    assert.equal(moved.growth.length, 1);
    assert.deepEqual(game.place(species, definition.slots[1]), moved, 'saving the same slot must not change revision');
    const current = game.apply(species);
    assert.throws(() => game.send(species, 'observe', { behavior: definition.use, facilityId: definition.facility, layoutVersion: 1 }), (error) => error.status === 409);
    assert.deepEqual(game.state(species), current);
    const usedAgain = game.use(species);
    assert.equal(usedAgain.growth.length, 1); assert.equal(usedAgain.observations.length, 1);
    assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_rewards WHERE session_id = ?').get('a').n, 1);
  });
}

test('observations belong to their species and do not create construction, care XP or another species discovery', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  for (const [species, definition] of Object.entries(definitions)) {
    for (const behavior of definition.ordinary) {
      const first = game.send(species, 'observe', { behavior, layoutVersion: 0 });
      assert.deepEqual(game.send(species, 'observe', { behavior, layoutVersion: 0 }), first);
    }
    assert.equal(game.state(species).observations.length, definition.ordinary.length);
    assert.deepEqual(game.state(species).growth, []);
  }
  assert.deepEqual(game.state().observations, []);
  assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, 0);
  assert.deepEqual(game.db.prepare('SELECT * FROM town_pets ORDER BY session_id').all().map((row) => ({ ...row })), [{ session_id: 'a', species: 'pangolin' }, { session_id: 'b', species: 'sea-turtle' }]);
});

test('invalid species, cross-species facilities and behaviors are rejected without changing any habitat', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const initial = Object.fromEntries([undefined, 'pangolin', 'sea-turtle'].map((species) => [String(species), game.state(species)]));
  for (const invalid of ['fox', '', null, [], {}]) {
    assert.throws(() => game.state(invalid), (error) => error.status === 400);
    assert.throws(() => game.store.habitatAction('a', 'layout', { requestId: randomUUID(), expectedRevision: 0, species: invalid, facilityId: 'leaf-nest', slotId: 'root-den' }), (error) => error.status === 400);
  }
  for (const [species, definition] of Object.entries(definitions)) {
    const otherFacility = species === 'pangolin' ? 'rest-ledge' : 'leaf-nest';
    assert.throws(() => game.send(species, 'layout', { facilityId: 'rest-platform', slotId: 'trunk' }), (error) => error.status === 400);
    assert.throws(() => game.send(species, 'layout', { facilityId: otherFacility, slotId: definition.slots[0] }), (error) => error.status === 400);
    assert.throws(() => game.send(species, 'layout', { facilityId: definition.facility, slotId: 'trunk' }), (error) => error.status === 400);
    assert.throws(() => game.send(species, 'observe', { behavior: species === 'pangolin' ? 'swim' : 'dig', layoutVersion: 0 }), (error) => error.status === 400);
    assert.throws(() => game.send(species, 'observe', { behavior: definition.ordinary[0], facilityId: definition.facility, layoutVersion: 0 }), (error) => error.status === 400);
    assert.throws(() => game.use(species), (error) => error.status === 409);
  }
  assert.throws(() => game.send(undefined, 'layout', { facilityId: 'leaf-nest', slotId: 'root-den' }), (error) => error.status === 400);
  for (const species of [undefined, 'pangolin', 'sea-turtle']) assert.deepEqual(game.state(species), initial[String(species)]);
  assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_operations').get().n, 0);
});

test('retries return the latest state, revisions are independent, and an operation UUID cannot cross species', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const firstBody = game.body('pangolin', { facilityId: 'leaf-nest', slotId: 'root-den' });
  game.store.habitatAction('a', 'layout', firstBody);
  const moved = game.place('pangolin', 'leaf-bed');
  assert.deepEqual(game.store.habitatAction('a', 'layout', firstBody), moved);
  assert.equal(moved.growth.length, 1);
  const turtle = game.state('sea-turtle'), panda = game.state();
  assert.equal(turtle.revision, 0); assert.equal(panda.revision, 0);
  assert.throws(() => game.store.habitatAction('a', 'layout', { ...firstBody, species: 'sea-turtle', facilityId: 'rest-ledge', slotId: 'seagrass' }), (error) => error.status === 409);
  assert.throws(() => game.store.habitatAction('a', 'layout', { ...firstBody, species: 'red-panda', facilityId: 'rest-platform', slotId: 'trunk' }), (error) => error.status === 409);
  assert.throws(() => game.store.habitatAction('a', 'layout', { ...firstBody, requestId: randomUUID(), slotId: 'root-den' }), (error) => error.status === 409 && error.state.layout.platform === 'leaf-bed');
  assert.deepEqual(game.state('sea-turtle'), turtle); assert.deepEqual(game.state(), panda);
  // UUID identity is scoped to the browser session, not globally across visitors.
  const other = game.store.habitatAction('b', 'layout', firstBody);
  assert.equal(other.layout.platform, 'root-den'); assert.equal(other.growth.length, 1);
});

test('pending layouts, applied layouts and first discoveries recover per species after database reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'helpani-care-habitat-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'care.sqlite');
  const first = fixture(path);
  first.send(undefined, 'layout', { facilityId: 'rest-platform', slotId: 'edge' });
  first.place('pangolin'); first.apply('pangolin'); first.use('pangolin'); first.place('pangolin', 'leaf-bed');
  first.place('sea-turtle');
  const saved = Object.fromEntries([undefined, 'pangolin', 'sea-turtle'].map((species) => [String(species), first.state(species)]));
  first.db.close();
  const second = fixture(path);
  for (const species of [undefined, 'pangolin', 'sea-turtle']) assert.deepEqual(second.state(species), saved[String(species)]);
  second.apply('sea-turtle'); second.use('sea-turtle'); second.apply('pangolin'); second.use('pangolin');
  const restored = { pangolin: second.state('pangolin'), turtle: second.state('sea-turtle') };
  second.db.close();
  const third = fixture(path); t.after(() => third.db.close());
  assert.deepEqual(third.state(), saved.undefined);
  assert.deepEqual(third.state('pangolin'), restored.pangolin);
  assert.deepEqual(third.state('sea-turtle'), restored.turtle);
  for (const species of Object.keys(definitions)) { assert.equal(third.state(species).growth.length, 1); assert.equal(third.state(species).observations.length, 1); }
});

test('panda patrol unlocks only the panda bridge and leaves care, charity, payments and the other habitats intact', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  game.db.exec(`CREATE TABLE town_events (session_id TEXT, kind TEXT); INSERT INTO town_events VALUES ('a','allocation');
    CREATE TABLE pet_feeds (session_id TEXT, day TEXT, slot INTEGER); INSERT INTO pet_feeds VALUES ('a','2026-11-10',1);
    CREATE TABLE pet_checkins (session_id TEXT, day TEXT); INSERT INTO pet_checkins VALUES ('a','2026-11-10');
    CREATE TABLE pet_exchanges (session_id TEXT, request_id TEXT); INSERT INTO pet_exchanges VALUES ('a','existing-exchange');
    CREATE TABLE activity_registrations (session_id TEXT, activity_id TEXT, verified INTEGER); INSERT INTO activity_registrations VALUES ('a','park-cleanup',1);
    CREATE TABLE paypal_orders (reference TEXT, session_id TEXT, kind TEXT, amount_cents INTEGER, provider_id TEXT, status TEXT); INSERT INTO paypal_orders VALUES ('existing','a','donation',500,'sandbox-existing','completed');`);
  const tableNames = ['town_pets', 'town_events', 'pet_feeds', 'pet_checkins', 'pet_exchanges', 'activity_registrations', 'paypal_orders'];
  const snapshot = () => Object.fromEntries(tableNames.map((table) => [table, game.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const ledgerBefore = snapshot();
  for (const species of Object.keys(definitions)) { game.place(species); game.apply(species); game.use(species); }
  const habitatsBefore = { pangolin: game.state('pangolin'), turtle: game.state('sea-turtle') };
  const patrol = (action, data = {}) => game.store.patrolAction('a', action, { requestId: randomUUID(), expectedRevision: game.store.patrolState('a').revision, ...data });
  for (let run = 0; run < 2; run++) {
    patrol('start', { theme: 'habitat' });
    while (!game.store.patrolState('a').completed) {
      const event = patrol('roll').pendingEvent;
      patrol('choose', { eventVisitId: event.id, choiceId: event.choices[0].id });
    }
  }
  assert.deepEqual(game.state().inventory, ['rest-platform', 'woodland-bridge']);
  assert.equal(game.state().growth.filter((entry) => entry.id === 'woodland-bridge-unlocked').length, 1);
  assert.deepEqual(game.state('pangolin'), habitatsBefore.pangolin);
  assert.deepEqual(game.state('sea-turtle'), habitatsBefore.turtle);
  assert.deepEqual(snapshot(), ledgerBefore);
  assert.equal(game.state('pangolin').inventory.includes('woodland-bridge'), false);
  assert.equal(game.state('sea-turtle').inventory.includes('woodland-bridge'), false);
});
