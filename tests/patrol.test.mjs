import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createGameStore } from '../server/game.mjs';
import { questions } from '../server/patrol-questions.mjs';

const questionFor = (event) => questions.find((question) => question.id === event.questionId);
const correctChoice = (event) => questionFor(event)?.correctChoiceId || 'wait';
const incorrectChoice = (event) => event.choices.find((choice) => choice.id !== correctChoice(event)).id;

function fixture(options = {}, path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS town_pets (session_id TEXT PRIMARY KEY, species TEXT NOT NULL);
    INSERT OR IGNORE INTO town_pets VALUES ('a', 'red-panda'), ('b', 'red-panda');`);
  const store = createGameStore(db, { rollDie: () => 1, random: () => .9, ...options });
  const body = (data = {}, session = 'a') => ({ requestId: randomUUID(), expectedRevision: store.patrolState(session).revision, ...data });
  const send = (action, data, session = 'a') => store.patrolAction(session, action, body(data, session));
  const choose = (choiceId) => {
    const event = store.patrolState('a').pendingEvent;
    return send('choose', { eventVisitId: event.id, choiceId: choiceId || correctChoice(event) });
  };
  const complete = () => { while (!store.patrolState('a').completed) { send('roll'); choose(); } };
  return { db, store, body, send, choose, complete };
}

for (const die of [1, 2, 3, 4, 5, 6]) {
  test(`server die ${die} produces exactly ${die} forward steps and one landing event`, (t) => {
    const { db, store, send } = fixture({ rollDie: () => die }); t.after(() => db.close());
    assert.equal(store.patrolState('a').runId, null);
    send('start', { theme: 'rest' });
    const state = send('roll');
    assert.equal(state.lastRoll.die, die);
    assert.deepEqual(state.lastRoll.steps, Array.from({ length: die }, (_, index) => index + 1));
    assert.equal(state.position, die);
    assert.equal(state.remaining, 7);
    assert.equal(state.pendingEvent.kind, 'quiz');
    assert.equal(state.pendingEvent.choices.length, 3);
    assert.equal(new Set(state.pendingEvent.choices.map((choice) => choice.id)).size, 3);
    assert.equal(state.chapters.length, die >= 4 ? 1 : 0);
    assert.throws(() => send('roll'), (e) => e.status === 409);
    assert.equal(store.patrolState('a').remaining, 7);
  });
}

test('eight ones guarantee completion; crossing the terminal with surplus steps stops at eight', (t) => {
  const one = fixture(); t.after(() => one.db.close());
  one.send('start', { theme: 'rest' }); one.complete();
  const worst = one.store.patrolState('a');
  assert.equal(worst.position, 8); assert.equal(worst.remaining, 0); assert.equal(worst.completed, true);
  assert.equal(worst.journal.length, 8); assert.equal(worst.chapters.length, 2);
  const six = fixture({ rollDie: () => 6 }); t.after(() => six.db.close());
  six.send('start', { theme: 'habitat' }); const firstEvent = six.send('roll').pendingEvent; six.choose(incorrectChoice(firstEvent));
  const final = six.send('roll');
  assert.equal(final.lastRoll.die, 6); assert.deepEqual(final.lastRoll.steps, [7, 8]); assert.equal(final.position, 8);
  assert.equal(final.chapters.length, 2);
  assert.throws(() => six.send('start', { theme: 'rest' }), (e) => e.status === 409); // Terminal event remains pending.
});

test('a duplicate roll and stale concurrent roll cannot consume a second opportunity', (t) => {
  let generated = 0;
  const { db, store, send, body } = fixture({ rollDie: () => { generated += 1; return 3; } }); t.after(() => db.close());
  send('start', { theme: 'rest' });
  const request = body();
  const first = store.patrolAction('a', 'roll', request);
  const retry = store.patrolAction('a', 'roll', request);
  assert.deepEqual(retry, first); assert.equal(generated, 1); assert.equal(retry.remaining, 7);
  assert.throws(() => store.patrolAction('a', 'roll', { ...request, requestId: randomUUID() }), (e) => e.status === 409);
  assert.equal(generated, 1);
});

test('settled event choices survive response loss and do not reroll medals or add observations twice', (t) => {
  let surprises = 0;
  const { db, store, send, body } = fixture({ random: () => { surprises += 1; return 0; } }); t.after(() => db.close());
  send('start', { theme: 'rest' }); const rolled = send('roll');
  const request = body({ eventVisitId: rolled.pendingEvent.id, choiceId: correctChoice(rolled.pendingEvent) });
  const chosen = store.patrolAction('a', 'choose', request);
  assert.equal(chosen.eventCount, 1); assert.equal(chosen.journal.length, 1); assert.equal(chosen.medals.length, 1); assert.equal(chosen.knowledge.length, 1);
  assert.equal(chosen.lastResult.quiz.firstMastered, true);
  assert.deepEqual(store.patrolAction('a', 'choose', request), chosen);
  assert.deepEqual(store.patrolAction('a', 'choose', { ...request, requestId: randomUUID() }), chosen);
  assert.equal(surprises, 1);
  assert.throws(() => send('choose', { eventVisitId: request.eventVisitId, choiceId: incorrectChoice(rolled.pendingEvent) }), (e) => e.status === 409);
  send('roll');
  const current = store.patrolState('a');
  const oldRetry = store.patrolAction('a', 'choose', request);
  assert.deepEqual(oldRetry, current); assert.ok(oldRetry.pendingEvent); // A retry never rolls the UI backward.
});

test('correct and incorrect answers keep the same 25 percent extra discovery chance', (t) => {
  for (const isCorrect of [true, false]) {
    const below = fixture({ random: () => .249999 }), boundary = fixture({ random: () => .25 });
    t.after(() => { below.db.close(); boundary.db.close(); });
    for (const game of [below, boundary]) {
      game.send('start', { theme: 'rest' }); const event = game.send('roll').pendingEvent;
      const answered = game.choose(isCorrect ? correctChoice(event) : incorrectChoice(event));
      assert.equal(answered.lastResult.quiz.correct, isCorrect);
      assert.equal(answered.eventCount, 1); assert.equal(answered.remaining, 7);
      assert.equal(answered.lastResult.observation, true);
    }
    assert.equal(below.store.patrolState('a').medals.length, 1);
    assert.equal(boundary.store.patrolState('a').medals.length, 0);
  }
});

test('four accumulated events permit a deliberate missing medal and retries never spend the next claim', (t) => {
  const { db, store, send, choose } = fixture(); t.after(() => db.close());
  send('start', { theme: 'rest' });
  for (let index = 0; index < 3; index++) { send('roll'); choose(); }
  const id = store.patrolState('a').medalCatalog[0].id;
  assert.throws(() => send('collect', { medalId: id }), (e) => e.status === 409);
  send('roll'); choose();
  const collected = send('collect', { medalId: id });
  assert.equal(collected.collectionClaims, 1); assert.equal(collected.medals.length, 1);
  assert.equal(send('collect', { medalId: id }).collectionClaims, 1);
  assert.throws(() => send('collect', { medalId: collected.medalCatalog[1].id }), (e) => e.status === 409);
  assert.equal(store.patrolState('a').eventCount, 4);
});

test('extra discoveries prefer missing candidate medals while complete collections still accumulate journal progress', (t) => {
  const { db, store, send, complete } = fixture({ random: () => 0 }); t.after(() => db.close());
  send('start', { theme: 'rest' }); complete();
  const state = store.patrolState('a');
  assert.equal(state.medals.length, 3);
  assert.equal(new Set(state.medals.map((medal) => medal.id)).size, 3);
  assert.equal(state.eventCount, 8); assert.equal(state.journal.length, 8);
  assert.equal(state.lastResult.medal, null);
});

test('crossed milestones and the bridge persist once, and a replay keeps collections without redistributing facilities', (t) => {
  const { db, store, send, choose, complete } = fixture({ rollDie: () => 6 }); t.after(() => db.close());
  const habitatBefore = store.habitatState('a');
  send('start', { theme: 'habitat' }); send('roll'); choose(); send('roll');
  const habitat = store.habitatState('a');
  assert.deepEqual(habitat.inventory, ['rest-platform', 'woodland-bridge']);
  assert.equal(habitat.layout.bridge, false); // Bring it home and explicitly place it.
  assert.equal(habitat.revision, habitatBefore.revision + 1);
  assert.throws(() => store.habitatAction('a', 'layout', { requestId: randomUUID(), expectedRevision: habitatBefore.revision, facilityId: 'rest-platform', slotId: 'edge' }), (e) => e.status === 409);
  choose(); const firstRun = store.patrolState('a').runId;
  send('start', { theme: 'rest' }); complete();
  const replay = store.patrolState('a');
  assert.notEqual(replay.runId, firstRun);
  assert.equal(replay.chapters.length, 2); assert.equal(replay.journal.length, 4);
  assert.equal(store.habitatState('a').growth.filter((entry) => entry.id === 'woodland-bridge-unlocked').length, 1);
  assert.equal(store.habitatState('a').inventory.filter((entry) => entry === 'woodland-bridge').length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM game_rewards WHERE reward_key LIKE 'patrol-chapter-%'").get().n, 2);
  assert.equal(store.habitatState('b').inventory.includes('woodland-bridge'), false);
});

test('saved roll, pending choice, chosen result, route position and bridge recover after reopening the database', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'helpani-patrol-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'patrol.sqlite');
  const first = fixture({ rollDie: () => 6 }, path);
  first.send('start', { theme: 'habitat' }); const pending = first.send('roll'); first.db.close();
  const second = fixture({ rollDie: () => 6 }, path);
  assert.deepEqual(second.store.patrolState('a'), pending);
  second.choose(incorrectChoice(pending.pendingEvent)); const atEnd = second.send('roll'); second.db.close();
  const third = fixture({}, path);
  assert.deepEqual(third.store.patrolState('a'), atEnd);
  assert.equal(third.store.habitatState('a').inventory.includes('woodland-bridge'), true);
  const chosen = third.choose(); third.db.close();
  const fourth = fixture({}, path); t.after(() => fourth.db.close());
  assert.deepEqual(fourth.store.patrolState('a'), chosen);
  assert.equal(fourth.store.patrolState('a').completed, true);
  assert.equal(fourth.store.patrolState('a').pendingEvent, null);
});

test('game UUIDs cannot be reused across interfaces, and invalid mutations are rolled back', (t) => {
  const { db, store, send, body } = fixture(); t.after(() => db.close());
  const request = body({ theme: 'rest' }); store.patrolAction('a', 'start', request);
  assert.throws(() => store.habitatAction('a', 'layout', { ...request, facilityId: 'rest-platform', slotId: 'edge' }), (e) => e.status === 409);
  assert.equal(store.habitatState('a').layout.platform, null);
  const rolled = send('roll'), previous = store.patrolState('a');
  assert.throws(() => send('choose', { eventVisitId: rolled.pendingEvent.id, choiceId: 'invented' }), (e) => e.status === 400);
  assert.throws(() => send('choose', { eventVisitId: randomUUID(), choiceId: 'wait' }), (e) => e.status === 409);
  assert.throws(() => send('collect', { medalId: 'invented' }), (e) => e.status === 400);
  assert.deepEqual(store.patrolState('a'), previous);
});

for (const isCorrect of [true, false]) {
  test(`all six questions reveal sourced explanations only after a ${isCorrect ? 'correct' : 'wrong'} answer`, (t) => {
    const game = fixture(); t.after(() => game.db.close());
    assert.equal(questions.length, 6);
    game.send('start', { theme: 'rest' });
    const seen = new Set();
    for (let index = 0; index < questions.length; index++) {
      const pending = game.send('roll').pendingEvent;
      const question = questionFor(pending);
      assert.ok(question); assert.equal(pending.kind, 'quiz');
      assert.equal(seen.has(question.id), false, 'new knowledge should precede a repeated question');
      seen.add(question.id);
      assert.equal(pending.topic, question.topic);
      assert.equal(pending.choices.length, 3);
      assert.equal(Object.hasOwn(pending, 'correctChoiceId'), false);
      assert.equal(Object.hasOwn(pending, 'explanation'), false);
      assert.equal(Object.hasOwn(pending, 'source'), false);
      assert.equal(Object.hasOwn(pending, 'misconception'), false);
      assert.equal(Object.hasOwn(pending, 'misconceptions'), false);
      for (const choice of pending.choices) assert.deepEqual(Object.keys(choice).sort(), ['id', 'label']);
      const choiceId = isCorrect ? correctChoice(pending) : incorrectChoice(pending);
      const state = game.choose(choiceId), result = state.lastResult.quiz;
      assert.equal(result.questionId, question.id);
      assert.ok(result.question.includes(question.text));
      assert.equal(result.correct, isCorrect);
      assert.equal(result.firstMastered, isCorrect);
      assert.equal(result.misconception, isCorrect ? '' : question.misconceptions[choiceId]);
      if (!isCorrect) assert.ok(result.misconception.length > 0, 'the selected mistake needs an actionable explanation');
      assert.equal(result.selectedAnswer, question.choices.find((choice) => choice.id === choiceId).label);
      assert.equal(result.correctAnswer, question.choices.find((choice) => choice.id === question.correctChoiceId).label);
      assert.equal(result.explanation, question.explanation);
      assert.deepEqual(result.source, question.source);
      assert.match(result.source.url, /^https:\/\//);
      assert.equal(result.observationPrompt, question.observationPrompt);
      const knowledge = state.knowledge.find((entry) => entry.questionId === question.id);
      assert.equal(knowledge.title, question.title);
      assert.equal(knowledge.correct, isCorrect);
      assert.equal(knowledge.correctAnswer, result.correctAnswer);
      assert.equal(knowledge.explanation, result.explanation);
      assert.equal(Object.hasOwn(knowledge, 'selectedAnswer'), false, 'a wrong answer is not a knowledge conclusion');
      assert.equal(state.knowledge.length, index + 1);
    }
    const final = game.store.patrolState('a');
    assert.equal(seen.size, 6); assert.equal(final.knowledgeCatalogSize, 6);
    assert.equal(new Set(final.knowledge.map((entry) => entry.questionId)).size, 6);
    assert.equal(game.store.patrolState('b').knowledge.length, 0);
  });
}

test('themes lead with unseen relevant questions and a run prefers all six before repeating', (t) => {
  const firstQuestions = [];
  for (const theme of ['rest', 'habitat']) {
    const game = fixture(); t.after(() => game.db.close());
    game.send('start', { theme });
    const preferred = questions.filter((question) => question.themes.includes(theme));
    assert.ok(preferred.length > 0);
    const ids = [], correctPositions = [];
    for (let index = 0; index < 6; index++) {
      const event = game.send('roll').pendingEvent, question = questionFor(event);
      if (index < preferred.length) assert.ok(question.themes.includes(theme));
      if (index === 0) firstQuestions.push(question.id);
      ids.push(question.id); correctPositions.push(event.choices.findIndex((choice) => choice.id === question.correctChoiceId));
      game.choose();
    }
    assert.equal(new Set(ids).size, 6);
    assert.ok(correctPositions.some((position) => position !== 0), 'correct answers cannot all occupy the first button');
  }
  assert.notEqual(firstQuestions[0], firstQuestions[1], 'the two themes should lead with different knowledge');
});

test('revisiting a question upgrades known-correct once without duplicating its page or forgetting a past correct answer', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  game.send('start', { theme: 'rest' }); const event = game.send('roll').pendingEvent;
  const first = game.choose(incorrectChoice(event));
  assert.equal(first.lastResult.quiz.firstMastered, false);
  assert.equal(first.knowledge.find((entry) => entry.questionId === event.questionId).correct, false);
  const revisit = () => {
    for (let index = 0; index < 24; index++) {
      const state = game.store.patrolState('a');
      if (state.completed) game.send('start', { theme: 'rest' });
      const next = game.send('roll').pendingEvent;
      if (next.questionId === event.questionId) return next;
      game.choose();
    }
    assert.fail('a learned question never became available for review');
  };
  const again = revisit();
  const improved = game.choose(correctChoice(again));
  assert.equal(improved.lastResult.quiz.firstMastered, true);
  assert.equal(improved.knowledge.find((entry) => entry.questionId === event.questionId).correct, true);
  assert.equal(improved.knowledge.filter((entry) => entry.questionId === event.questionId).length, 1);
  const third = revisit(), stillKnown = game.choose(incorrectChoice(third));
  assert.equal(stillKnown.lastResult.quiz.firstMastered, false);
  assert.equal(stillKnown.knowledge.find((entry) => entry.questionId === event.questionId).correct, true);
  assert.equal(stillKnown.knowledge.length, 6);
  const fourth = revisit(), remembered = game.choose(correctChoice(fourth));
  assert.equal(remembered.lastResult.quiz.firstMastered, false, 'an already-mastered page must not earn another first mastery');
  assert.equal(remembered.knowledge.filter((entry) => entry.questionId === event.questionId).length, 1);
  assert.equal(remembered.journal.filter((entry) => entry.quiz?.questionId === event.questionId && entry.quiz.firstMastered).length, 1);
});

test('wrong answers at the terminal still complete chapters and retain the same one-time bridge', (t) => {
  const game = fixture({ rollDie: () => 6, random: () => 0 }); t.after(() => game.db.close());
  game.send('start', { theme: 'habitat' });
  game.choose(incorrectChoice(game.send('roll').pendingEvent));
  const landing = game.send('roll');
  assert.equal(landing.completed, true); assert.equal(landing.chapters.length, 2);
  const answered = game.choose(incorrectChoice(landing.pendingEvent));
  assert.equal(answered.lastResult.quiz.correct, false); assert.equal(answered.remaining, 6);
  assert.equal(answered.eventCount, 2); assert.equal(answered.pendingEvent, null);
  const habitat = game.store.habitatState('a');
  assert.equal(habitat.inventory.filter((id) => id === 'woodland-bridge').length, 1);
  assert.equal(habitat.growth.filter((entry) => entry.id === 'woodland-bridge-unlocked').length, 1);
});

test('reading a pre-quiz save supplies defaults without writing or changing its revision', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const old = game.store.patrolState('a');
  delete old.knowledge; delete old.knowledgeCatalogSize; delete old.equippedMedalId;
  game.db.prepare('UPDATE patrol_states SET state_json = ? WHERE session_id = ?').run(JSON.stringify(old), 'a');
  const record = game.db.prepare('SELECT revision, state_json FROM patrol_states WHERE session_id = ?').get('a');
  const state = game.store.patrolState('a');
  assert.deepEqual(state.knowledge, []); assert.equal(state.knowledgeCatalogSize, 6);
  assert.equal(state.equippedMedalId, null);
  assert.equal(state.revision, record.revision);
  assert.deepEqual(game.db.prepare('SELECT revision, state_json FROM patrol_states WHERE session_id = ?').get('a'), record);
});

test('a pending pre-quiz event still settles its original choices and keeps the old journal', (t) => {
  const game = fixture({ random: () => 0 }); t.after(() => game.db.close());
  game.send('start', { theme: 'rest' });
  const old = game.store.patrolState('a'), eventId = randomUUID();
  delete old.knowledge; delete old.knowledgeCatalogSize;
  old.pendingEvent = { id: eventId, type: 'canopy', title: '林缘的尾巴', text: '旧版待办情境', choices: [{ id: 'wait', label: '留在原地，安静观察' }, { id: 'follow', label: '沿既定小路，去林缘记录点' }] };
  old.journal = [{ id: randomUUID(), choiceId: 'follow', title: '旧版记录', text: '已经保存的旧故事', runId: old.runId }];
  old.eventCount = 1;
  game.db.prepare('UPDATE patrol_states SET state_json = ? WHERE session_id = ?').run(JSON.stringify(old), 'a');
  const state = game.choose('wait');
  assert.equal(state.pendingEvent, null); assert.equal(state.lastResult.eventVisitId, eventId);
  assert.equal(state.lastResult.title, '留给树梢的时间'); assert.equal(state.lastResult.observation, true);
  assert.equal(Object.hasOwn(state.lastResult, 'quiz'), false);
  assert.equal(state.journal[0].text, '已经保存的旧故事'); assert.equal(state.journal.length, 2);
  assert.equal(state.eventCount, 2); assert.deepEqual(state.knowledge, []);
  assert.equal(state.medals.length, 1);
});

test('medal rewards expose one usable photo accent per collectible', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const state = game.store.patrolState('a');
  assert.equal(state.equippedMedalId, null);
  assert.equal(state.medalCatalog.length, 3);
  assert.equal(new Set(state.medalCatalog.map((medal) => medal.id)).size, state.medalCatalog.length);
  for (const medal of state.medalCatalog) {
    assert.equal(typeof medal.description, 'string'); assert.ok(medal.description.length > 0);
    assert.equal(typeof medal.rewardLabel, 'string'); assert.ok(medal.rewardLabel.length > 0);
    assert.match(medal.art, /^\/assets\/medals\/[^/]+\.png$/);
    assert.ok(medal.photoAccent, 'every medal must explain a photo accent that can actually be equipped');
  }
});

test('equipping a photo reward validates ownership and invalid input without consuming progress', (t) => {
  const game = fixture(); t.after(() => game.db.close());
  const initial = game.store.patrolState('a');
  const existingId = initial.medalCatalog[0].id;
  assert.throws(() => game.send('equip', { medalId: existingId }), (error) => error.status === 409);
  for (const data of [{}, { medalId: 'invented' }, { medalId: 1 }, { medalId: [] }, { medalId: {} }, { medalId: '' }]) {
    assert.throws(() => game.send('equip', data), (error) => error.status === 400);
  }
  assert.deepEqual(game.store.patrolState('a'), initial);
  assert.equal(game.db.prepare('SELECT COUNT(*) AS n FROM game_operations').get().n, 0, 'rejected commands must roll back');
});

test('equipping and removing an owned medal preserve a pending question, earned collections and habitat', (t) => {
  const game = fixture({ random: () => 0 }); t.after(() => game.db.close());
  game.send('start', { theme: 'rest' }); game.send('roll');
  const earned = game.choose();
  const medalId = earned.medals[0].id;
  game.send('roll'); // Trying a photo reward must not settle or discard this pending question.
  const before = game.store.patrolState('a');
  const habitatBefore = game.store.habitatState('a');
  const petsBefore = game.db.prepare('SELECT * FROM town_pets ORDER BY session_id').all();
  const rewardsBefore = game.db.prepare('SELECT * FROM game_rewards ORDER BY session_id, reward_key').all();
  const equipped = game.send('equip', { medalId });
  assert.equal(equipped.equippedMedalId, medalId);
  assert.equal(equipped.revision, before.revision + 1);
  const { revision: beforeRevision, equippedMedalId: beforeAccent, ...beforeProgress } = before;
  const { revision: equippedRevision, equippedMedalId: equippedAccent, ...afterProgress } = equipped;
  assert.deepEqual(afterProgress, beforeProgress, 'equipping changes presentation preference, not quiz or patrol progression');
  assert.deepEqual(game.store.habitatState('a'), habitatBefore);
  assert.deepEqual(game.db.prepare('SELECT * FROM town_pets ORDER BY session_id').all(), petsBefore);
  assert.deepEqual(game.db.prepare('SELECT * FROM game_rewards ORDER BY session_id, reward_key').all(), rewardsBefore);
  assert.equal(game.store.patrolState('b').equippedMedalId, null, 'photo rewards stay within their owning session');

  assert.deepEqual(game.send('equip', { medalId }), equipped, 'equipping an already-active reward is a no-op');
  const removed = game.send('equip', { medalId: null });
  assert.equal(removed.equippedMedalId, null);
  assert.equal(removed.revision, equipped.revision + 1);
  const { revision: removedRevision, equippedMedalId: removedAccent, ...removedProgress } = removed;
  assert.deepEqual(removedProgress, beforeProgress);
  assert.deepEqual(game.send('equip', { medalId: null }), removed, 'removing an inactive reward is also a no-op');
  assert.deepEqual(game.store.habitatState('a'), habitatBefore);
  assert.deepEqual(game.db.prepare('SELECT * FROM game_rewards ORDER BY session_id, reward_key').all(), rewardsBefore);
});

test('lost equip responses and stale clients cannot re-equip an earlier selection or reuse its UUID', (t) => {
  const game = fixture({ random: () => 0 }); t.after(() => game.db.close());
  game.send('start', { theme: 'rest' }); game.send('roll');
  const medalId = game.choose().medals[0].id;
  const request = game.body({ medalId });
  const equipped = game.store.patrolAction('a', 'equip', request);
  assert.deepEqual(game.store.patrolAction('a', 'equip', request), equipped);
  assert.throws(() => game.store.patrolAction('a', 'equip', { ...request, medalId: null }), (error) => error.status === 409);
  assert.throws(() => game.store.patrolAction('a', 'equip', { ...request, requestId: randomUUID() }), (error) => error.status === 409 && error.state.equippedMedalId === medalId);
  const removed = game.send('equip', { medalId: null });
  assert.deepEqual(game.store.patrolAction('a', 'equip', request), removed, 'a delayed retry returns current state rather than restoring an old accent');
});

test('equipped medal and mastery survive reopening the database without granting another reward', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'helpani-reward-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'rewards.sqlite');
  const first = fixture({ random: () => 0 }, path);
  first.send('start', { theme: 'rest' }); first.send('roll');
  const answer = first.choose(), medalId = answer.medals[0].id;
  assert.equal(answer.lastResult.quiz.firstMastered, true);
  const saved = first.send('equip', { medalId });
  const rewardCount = first.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n;
  first.db.close();
  const reopened = fixture({}, path); t.after(() => reopened.db.close());
  assert.deepEqual(reopened.store.patrolState('a'), saved);
  assert.equal(reopened.store.patrolState('a').knowledge[0].correct, true);
  assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM game_rewards').get().n, rewardCount);
  assert.deepEqual(reopened.send('equip', { medalId }), saved);
});
