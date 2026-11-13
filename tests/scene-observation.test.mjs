import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createGameStore } from '../server/game.mjs';
import { WoodlandScene } from '../public/woodland-scene.js';
import { CompanionScene } from '../public/companion-scene.js';

const cases = [
  { species: 'red-panda', Scene: WoodlandScene, behavior: 'ground-explore', facilityId: 'rest-platform', slotId: 'trunk', movedSlot: 'edge', facilityBehavior: 'platform-rest', node: 'clearing' },
  { species: 'pangolin', Scene: CompanionScene, behavior: 'dig', facilityId: 'leaf-nest', slotId: 'root-den', movedSlot: 'leaf-bed', facilityBehavior: 'shelter-rest', node: 'moss' },
  { species: 'sea-turtle', Scene: CompanionScene, behavior: 'swim', facilityId: 'rest-ledge', slotId: 'seagrass', movedSlot: 'rock-shelf', facilityBehavior: 'ledge-rest', node: 'reef' },
];

for (const config of cases) {
  test(`${config.species}: a failed observation can recur after applying a new layout`, (t) => {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    const store = createGameStore(db);
    const state = () => store.habitatState('observer', config.species);
    const send = (action, data) => store.habitatAction('observer', action, {
      ...data, species: config.species, requestId: randomUUID(), expectedRevision: state().revision,
    });
    const emitted = [];
    // Exercise the real layout/report methods without starting a Canvas animation.
    const scene = Object.assign(Object.create(config.Scene.prototype), {
      species: config.species, reported: new Set(), layoutVersion: -1,
      actor: { node: config.node }, callbacks: { onObserve: record => emitted.push(record) },
    });
    scene.updateLayout(state());
    scene.report(config.behavior);
    const abandoned = emitted[0]; // Transport failed, so this was never stored.
    scene.report(config.behavior);
    assert.equal(emitted.length, 1, 'repeated animation frames must not flood the outbox');

    send('layout', { facilityId: config.facilityId, slotId: config.slotId });
    scene.updateLayout(state());
    send('apply', { layoutVersion: scene.layoutVersion });
    assert.equal(emitted.length, 1, 'applying a layout must not invent an observation');
    assert.throws(() => send('observe', abandoned), error => error.status === 409);
    assert.deepEqual(state().observations, []);

    scene.report(config.behavior); // The animal actually performs the behavior again.
    assert.equal(emitted.length, 2);
    assert.equal(emitted[1].layoutVersion, 1);
    assert.equal(abandoned.layoutVersion, 0, 'old events keep their original layout');
    send('observe', emitted[1]);
    scene.report(config.behavior);
    assert.equal(emitted.length, 2);

    scene.report(config.facilityBehavior, config.facilityId);
    send('observe', emitted.at(-1));
    send('layout', { facilityId: config.facilityId, slotId: config.movedSlot });
    scene.updateLayout(state());
    send('apply', { layoutVersion: scene.layoutVersion });
    scene.report(config.behavior);
    send('observe', emitted.at(-1));
    scene.report(config.facilityBehavior, config.facilityId);
    send('observe', emitted.at(-1));
    assert.deepEqual(state().observations.map(item => item.behavior).sort(), [config.behavior, config.facilityBehavior].sort());
    assert.equal(state().growth.length, 1, 'moving and rediscovering must preserve first-use rewards');
  });
}
