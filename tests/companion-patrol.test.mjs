import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createGameStore } from '../server/game.mjs';
import { companionPatrols } from '../server/companion-patrol.mjs';

function fixture(options = {}, path = ':memory:') {
  const db = new DatabaseSync(path);
  const store = createGameStore(db, { rollDie: () => 1, random: () => .9, ...options });
  const state = (species, session = 'a') => store.patrolState(session, species);
  const body = (species, data = {}, session = 'a') => ({
    requestId: randomUUID(), expectedRevision: state(species, session).revision,
    ...(species === undefined ? {} : { species }), ...data,
  });
  const send = (species, action, data = {}, session = 'a') => store.patrolAction(session, action, body(species, data, session));
  const question = (species, event = state(species).pendingEvent) => companionPatrols[species].questions.find(item => item.id === event.questionId);
  const choose = (species, correct = true) => {
    const event = state(species).pendingEvent, definition = question(species, event);
    return send(species, 'choose', { eventVisitId: event.id, choiceId: correct ? definition.correctChoiceId : event.choices.find(item => item.id !== definition.correctChoiceId).id });
  };
  const finish = (species, correct = true) => {
    while (!state(species).completed || state(species).pendingEvent) {
      if (!state(species).pendingEvent) send(species, 'roll');
      choose(species, correct);
    }
    return state(species);
  };
  return { db, store, state, body, send, choose, question, finish };
}

test('patrol progress, questions and collections are isolated by species and session without modifying the legacy panda record', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  game.send(undefined, 'start', { theme: 'rest' });
  const panda = game.send(undefined, 'roll');
  const pandaRecord = game.db.prepare('SELECT * FROM patrol_states WHERE session_id = ?').get('a');
  assert.deepEqual(game.state('red-panda'), panda);
  assert.equal(Object.hasOwn(panda, 'species'), false, 'legacy default response stays compatible');
  for (const species of Object.keys(companionPatrols)) {
    const initial = game.state(species);
    assert.equal(initial.species, species); assert.equal(initial.revision, 0);
    assert.equal(initial.knowledgeCatalogSize, 6); assert.equal(initial.medalCatalog.length, 3);
    assert.deepEqual(initial.presentation, companionPatrols[species].presentation);
    game.send(species, 'start', { theme: 'rest' }); game.send(species, 'roll'); game.choose(species);
    assert.equal(game.state(species).knowledge.length, 1);
    assert.deepEqual(game.state(species, 'b'), initial, 'another player has a fresh route');
  }
  assert.deepEqual(game.state(), panda);
  assert.deepEqual(game.db.prepare('SELECT * FROM patrol_states WHERE session_id = ?').get('a'), pandaRecord);
  const questionIds = Object.values(companionPatrols).flatMap(item => item.questions.map(question => question.id));
  const medalIds = Object.values(companionPatrols).flatMap(item => item.medalCatalog.map(medal => medal.id));
  assert.equal(new Set(questionIds).size, 12); assert.equal(new Set(medalIds).size, 6);
});

for (const species of ['pangolin', 'sea-turtle']) {
  test(`${species}: every die is saved before playback, never overshoots eight, and all-one rolls still complete`, (t) => {
    for (const die of [1, 2, 3, 4, 5, 6]) {
      const game = fixture({ rollDie: () => die }); t.after(() => game.db.close());
      game.send(species, 'start', { theme: 'rest' });
      const first = game.send(species, 'roll');
      assert.equal(first.position, die); assert.equal(first.remaining, 7);
      assert.deepEqual(first.lastRoll.steps, Array.from({ length: die }, (_, index) => index + 1));
      assert.equal(first.chapters.length, die >= 4 ? 1 : 0);
      assert.deepEqual(game.state(species), first, 'reload during movement sees the committed landing');
      assert.throws(() => game.send(species, 'roll'), error => error.status === 409);
      const done = game.finish(species);
      assert.equal(done.position, 8); assert.equal(done.completed, true);
      assert.equal(done.eventCount, Math.ceil(8 / die)); assert.equal(done.remaining, 8 - Math.ceil(8 / die));
      assert.equal(done.chapters.length, 2);
      assert.ok(done.medals.some(item => item.id === companionPatrols[species].medalCatalog[0].id));
      assert.ok(done.lastRoll.steps.every(position => position <= 8));
      assert.throws(() => game.send(species, 'roll'), error => error.status === 409);
    }
  });

  for (const correct of [true, false]) {
    test(`${species}: six unique sourced questions reveal answers and mistake feedback only after ${correct ? 'correct' : 'incorrect'} settlement`, (t) => {
      const game = fixture(); t.after(() => game.db.close());
      game.send(species, 'start', { theme: 'rest' });
      const seen = new Set();
      for (let index = 0; index < 6; index++) {
        const pending = game.send(species, 'roll').pendingEvent, definition = game.question(species, pending);
        assert.ok(definition); assert.equal(seen.has(definition.id), false); seen.add(definition.id);
        assert.equal(pending.choices.length, 3);
        for (const hidden of ['correctChoiceId', 'source', 'explanation', 'misconceptions']) assert.equal(Object.hasOwn(pending, hidden), false);
        for (const choice of pending.choices) assert.deepEqual(Object.keys(choice).sort(), ['id', 'label']);
        const settled = game.choose(species, correct), quiz = settled.lastResult.quiz;
        assert.equal(quiz.correct, correct); assert.equal(quiz.firstMastered, correct);
        assert.equal(quiz.explanation, definition.explanation); assert.deepEqual(quiz.source, definition.source);
        assert.match(quiz.source.url, /^https:\/\//); assert.ok(quiz.observationPrompt);
        if (!correct) assert.ok(quiz.misconception.length > 0);
        const fact = settled.knowledge.find(item => item.questionId === definition.id);
        assert.equal(fact.correct, correct); assert.equal(Object.hasOwn(fact, 'selectedAnswer'), false);
        assert.equal(settled.eventCount, index + 1); assert.equal(settled.knowledge.length, index + 1);
      }
    });
  }

  test(`${species}: route souvenir, milestone chapters and directed collections never duplicate or unlock a panda bridge`, (t) => {
    const game = fixture(); t.after(() => game.db.close());
    const habitats = Object.fromEntries(['red-panda', 'pangolin', 'sea-turtle'].map(item => [item, game.store.habitatState('a', item)]));
    game.send(species, 'start', { theme: 'habitat' });
    const first = game.finish(species, false), souvenir = first.medalCatalog[0].id;
    assert.deepEqual(first.medals.map(item => item.id), [souvenir], 'completion is guaranteed even with wrong answers and no random discoveries');
    const count = game.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n;
    assert.equal(count, 3, 'two chapters plus one route souvenir');
    assert.deepEqual(game.send(species, 'collect', { medalId: souvenir }), first, 'collecting an owned souvenir is a no-op');
    const collected = game.send(species, 'collect', { medalId: first.medalCatalog[1].id });
    assert.equal(collected.collectionClaims, 1); assert.equal(collected.medals.length, 2);
    assert.deepEqual(game.send(species, 'collect', { medalId: first.medalCatalog[1].id }), collected);
    game.send(species, 'start', { theme: 'rest' });
    const again = game.finish(species);
    assert.equal(again.chapters.length, 2); assert.equal(again.medals.filter(item => item.id === souvenir).length, 1);
    assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, count);
    for (const [animal, before] of Object.entries(habitats)) assert.deepEqual(game.store.habitatState('a', animal), before);
  });

  test(`${species}: retries and stale concurrent writes cannot spend another roll, change a settled answer or duplicate rewards`, (t) => {
    let rolled = 0, discoveries = 0;
    const game = fixture({ rollDie: () => { rolled++; return 3; }, random: () => { discoveries++; return 0; } }); t.after(() => game.db.close());
    game.send(species, 'start', { theme: 'rest' });
    const request = game.body(species), landing = game.store.patrolAction('a', 'roll', request);
    assert.deepEqual(game.store.patrolAction('a', 'roll', request), landing);
    assert.throws(() => game.store.patrolAction('a', 'roll', { ...request, requestId: randomUUID() }), error => error.status === 409 && error.state.position === 3);
    assert.equal(rolled, 1); assert.equal(game.state(species).remaining, 7);
    const event = landing.pendingEvent, choiceId = game.question(species, event).correctChoiceId;
    const selection = game.body(species, { eventVisitId: event.id, choiceId });
    const chosen = game.store.patrolAction('a', 'choose', selection);
    assert.deepEqual(game.store.patrolAction('a', 'choose', selection), chosen);
    assert.deepEqual(game.store.patrolAction('a', 'choose', { ...selection, requestId: randomUUID() }), chosen);
    assert.throws(() => game.store.patrolAction('a', 'choose', { ...selection, requestId: randomUUID(), choiceId: event.choices.find(item => item.id !== choiceId).id }), error => error.status === 409);
    assert.equal(discoveries, 1); assert.equal(chosen.eventCount, 1); assert.equal(chosen.medals.length, 1);
    const medalId = chosen.medals[0].id, equip = game.body(species, { medalId });
    const equipped = game.store.patrolAction('a', 'equip', equip);
    assert.equal(equipped.equippedMedalId, medalId);
    const removed = game.send(species, 'equip', { medalId: null });
    assert.deepEqual(game.store.patrolAction('a', 'equip', equip), removed, 'late retries return the latest photo preference');
    assert.deepEqual(game.store.patrolAction('a', 'roll', request), removed, 'a delayed roll retry does not rewind the route');
  });

  test(`${species}: pending events, frozen choices, knowledge, completed rewards and equipped photos survive database reopening`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'helpani-companion-patrol-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'patrol.sqlite');
    const one = fixture({ rollDie: () => 6 }, path);
    one.send(species, 'start', { theme: 'habitat' }); const pending = one.send(species, 'roll'); one.db.close();
    const two = fixture({ rollDie: () => 6 }, path);
    assert.deepEqual(two.state(species), pending); two.choose(species, false);
    const terminal = two.send(species, 'roll'); two.db.close();
    const three = fixture({}, path);
    assert.deepEqual(three.state(species), terminal);
    three.choose(species); const equipped = three.send(species, 'equip', { medalId: terminal.medalCatalog[0].id });
    const rewardCount = three.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n; three.db.close();
    const four = fixture({}, path); t.after(() => four.db.close());
    assert.deepEqual(four.state(species), equipped);
    assert.equal(four.state(species).knowledge.length, 2);
    assert.equal(four.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, rewardCount);
    assert.deepEqual(four.send(species, 'equip', { medalId: equipped.equippedMedalId }), equipped);
  });
}

test('invalid species, foreign medals and reused UUIDs cannot mutate another patrol', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const initial = Object.fromEntries(['red-panda', 'pangolin', 'sea-turtle'].map(species => [species, game.state(species)]));
  for (const species of ['fox', '', null, [], {}]) {
    assert.throws(() => game.state(species), error => error.status === 400);
    assert.throws(() => game.store.patrolAction('a', 'start', { species, theme: 'rest', requestId: randomUUID(), expectedRevision: 0 }), error => error.status === 400);
  }
  const request = game.body('pangolin', { theme: 'rest' }); game.store.patrolAction('a', 'start', request);
  assert.throws(() => game.store.patrolAction('a', 'start', { ...request, species: 'sea-turtle' }), error => error.status === 409);
  assert.throws(() => game.store.patrolAction('a', 'start', { ...request, species: 'red-panda' }), error => error.status === 409);
  for (const species of ['pangolin', 'sea-turtle']) {
    assert.throws(() => game.send(species, 'equip', { medalId: 'canopy-listener' }), error => error.status === 400);
    const other = species === 'pangolin' ? 'sea-turtle' : 'pangolin';
    assert.throws(() => game.send(species, 'collect', { medalId: companionPatrols[other].medalCatalog[0].id }), error => error.status === 400);
    assert.throws(() => game.send(species, 'equip', { medalId: companionPatrols[species].medalCatalog[1].id }), error => error.status === 409);
  }
  assert.deepEqual(game.state('red-panda'), initial['red-panda']);
  assert.deepEqual(game.state('sea-turtle'), initial['sea-turtle']);
  assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_operations').get().n, 1);
});
