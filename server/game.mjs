import { createHash, randomInt, randomUUID } from 'node:crypto';
import { questions } from './patrol-questions.mjs';
import { companionPatrols } from './companion-patrol.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const observationTitles = {
  'ground-explore': '林下的慢慢探索',
  climb: '沿着树干向上',
  'tree-rest': '枝杈上的休息',
  'platform-rest': '新休息角落的第一次使用',
  'bridge-cross': '从木道走向另一棵树',
};
const careHabitats = {
  pangolin: {
    facility: 'leaf-nest', slots: ['root-den', 'leaf-bed'],
    construction: 'leaf-nest-built', constructionLabel: '为小松布置了落叶休息窝',
    facilityBehavior: 'shelter-rest',
    observations: {
      'ground-explore': '落叶间的慢慢探索', dig: '松软泥土里的小发现',
      'shelter-rest': '落叶休息窝的第一次使用', 'curled-rest': '安心蜷起身体休息',
    },
  },
  'sea-turtle': {
    facility: 'rest-ledge', slots: ['seagrass', 'rock-shelf'],
    construction: 'rest-ledge-built', constructionLabel: '为阿潮布置了水下休息台',
    facilityBehavior: 'ledge-rest',
    observations: { swim: '浅湾里的自主游动', surface: '来到水面换一口气', 'ledge-rest': '水下休息台的第一次使用' },
  },
};
function habitatSpecies(value = 'red-panda') {
  if (typeof value !== 'string' || (value !== 'red-panda' && !Object.hasOwn(careHabitats, value))) {
    throw new GameError(400, '请选择小熊猫、中华穿山甲或绿海龟的栖地。');
  }
  return value;
}
const medalCatalog = [
  {
    id: 'canopy-listener', title: '树梢倾听者',
    description: '把树冠间的停顿与环纹尾巴，收进自己的林间日记。',
    rewardLabel: '树影主题照片角标', photoAccent: '树影留念',
    art: '/assets/medals/canopy-listener.png',
  },
  {
    id: 'leaf-reader', title: '林缘小匠',
    description: '记住树木与竹丛的联系，也为共同生活留下亲手布置的痕迹。',
    rewardLabel: '林缘手作照片角标', photoAccent: '林缘手作',
    art: '/assets/medals/leaf-reader.png',
  },
  {
    id: 'trail-finder', title: '雨后寻踪者',
    description: '循着落叶间的小线索，为每次新的发现留一张纪念照。',
    rewardLabel: '雨后寻踪照片角标', photoAccent: '雨后寻踪',
    art: '/assets/medals/trail-finder.png',
  },
];
const chapters = [
  { id: 'rest-habits', title: '第一章 · 树梢的安静', text: '沿途的见闻让你认出竹竹喜欢的高枝。给它一处能自主选择的休息角落，也给等待留一点时间。' },
  { id: 'woodland-connections', title: '第二章 · 连起来的林地', text: '你走完了林地路线，带回一段连接木道。回到竹影林，把两棵树连起来，看看竹竹会怎样走出一条新日常。' },
];
const eventDefinitions = {
  canopy: {
    title: '林缘的尾巴', text: '树冠间露出一截环纹尾巴。巡护员指了指远处的林缘记录点，你决定怎样继续？',
    choices: [
      { id: 'wait', label: '留在原地，安静观察', description: '记录树上休息的见闻，回栖地寻找一个摄影瞬间。' },
      { id: 'follow', label: '沿既定小路，去林缘记录点', description: '收集另一条路线线索，看看开阔林缘适合怎样布置。' },
    ],
    results: {
      wait: { title: '留给树梢的时间', text: '你记下了尾巴垂落的枝杈，没有惊扰它。回家可以看看竹竹在高处怎样安放身体。', observation: true, candidates: ['canopy-listener', 'trail-finder'] },
      follow: { title: '开阔处的另一种背景', text: '沿着既定小路，你记录了林缘的平台灵感。低一些的位置也能提供不同的到达路线与摄影背景。', observation: false, candidates: ['leaf-reader', 'trail-finder'] },
    },
  },
  maintenance: {
    title: '一处新的落脚点', text: '虚拟林地的维护手记里，夹着两张休息角落草图。你想先记下哪一种想法？',
    choices: [
      { id: 'wait', label: '记下树干旁的高位平台', description: '关注攀爬与接触面，寻找高枝休息的观察机会。' },
      { id: 'follow', label: '比较林缘低台和连接路线', description: '记下开阔构图与通路，带回一段布置灵感。' },
    ],
    results: {
      wait: { title: '脚掌下有稳稳的支撑', text: '你给草图补上树干、落脚点和阴影。回到林地，可以观察竹竹从攀爬过渡到休息的完整动作。', observation: true, candidates: ['leaf-reader', 'canopy-listener'] },
      follow: { title: '把角落连成生活空间', text: '你记下低台旁可以衔接的路线。完成这段巡护后，连接木道会成为可带回家布置的稳定收获。', observation: false, candidates: ['leaf-reader', 'trail-finder'] },
    },
  },
  tracks: {
    title: '雨后的林地手记', text: '小路边的湿叶留下几处浅浅的痕迹。这是虚构的巡护情境，你可以选择不同的记录方式。',
    choices: [
      { id: 'wait', label: '在既定观察点等待', description: '记录周围的动静，回家观察林下探索。' },
      { id: 'follow', label: '沿巡护小路整理环境记录', description: '比较落叶、树根和枝杈，收集路径故事。' },
    ],
    results: {
      wait: { title: '慢下来才看见的小事', text: '你把落叶和树根旁的停顿写进手记。回家后，试着等竹竹低头探索，再拍下它的侧影。', observation: true, candidates: ['trail-finder', 'canopy-listener'] },
      follow: { title: '一条适合慢慢走的路', text: '你留在既定巡护路线上，整理出一张环境草图。它提醒你：设施带来的变化，也可以是一段新的经过方式。', observation: false, candidates: ['trail-finder', 'leaf-reader'] },
    },
  },
};

export class GameError extends Error {
  constructor(status, message, state) {
    super(message);
    this.name = 'GameError';
    this.status = status;
    if (state) this.state = state;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Game-only persistence. No mutations touch care, points, sponsor, or payments. */
export function createGameStore(db, {
  now = () => new Date().toISOString(),
  rollDie = () => randomInt(1, 7),
  random = () => randomInt(0, 1_000_000) / 1_000_000,
} = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS habitat_states (
      session_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      state_json TEXT NOT NULL CHECK (json_valid(state_json))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS care_habitat_states (
      session_id TEXT NOT NULL,
      species TEXT NOT NULL CHECK (species IN ('pangolin', 'sea-turtle')),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      state_json TEXT NOT NULL CHECK (json_valid(state_json)),
      PRIMARY KEY (session_id, species)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS game_operations (
      session_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (session_id, request_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS game_rewards (
      session_id TEXT NOT NULL,
      reward_key TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (session_id, reward_key)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS care_patrol_states (
      session_id TEXT NOT NULL,
      species TEXT NOT NULL CHECK (species IN ('pangolin', 'sea-turtle')),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      state_json TEXT NOT NULL CHECK (json_valid(state_json)),
      PRIMARY KEY (session_id, species)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS patrol_states (
      session_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      state_json TEXT NOT NULL CHECK (json_valid(state_json))
    ) STRICT;
  `);
  const find = db.prepare('SELECT revision, state_json FROM habitat_states WHERE session_id = ?');
  const initialize = db.prepare('INSERT OR IGNORE INTO habitat_states (session_id, state_json) VALUES (?, ?)');
  const save = db.prepare('UPDATE habitat_states SET revision = ?, state_json = ? WHERE session_id = ?');
  const findCare = db.prepare('SELECT revision, state_json FROM care_habitat_states WHERE session_id = ? AND species = ?');
  const initializeCare = db.prepare('INSERT OR IGNORE INTO care_habitat_states (session_id, species, state_json) VALUES (?, ?, ?)');
  const saveCare = db.prepare('UPDATE care_habitat_states SET revision = ?, state_json = ? WHERE session_id = ? AND species = ?');
  const findOperation = db.prepare('SELECT action, fingerprint FROM game_operations WHERE session_id = ? AND request_id = ?');
  const addOperation = db.prepare('INSERT INTO game_operations (session_id, request_id, action, fingerprint, created_at) VALUES (?, ?, ?, ?, ?)');
  const addReward = db.prepare('INSERT OR IGNORE INTO game_rewards (session_id, reward_key, label, created_at) VALUES (?, ?, ?, ?)');
  const findPatrol = db.prepare('SELECT revision, state_json FROM patrol_states WHERE session_id = ?');
  const initializePatrol = db.prepare('INSERT OR IGNORE INTO patrol_states (session_id, state_json) VALUES (?, ?)');
  const savePatrol = db.prepare('UPDATE patrol_states SET revision = ?, state_json = ? WHERE session_id = ?');
  const findCarePatrol = db.prepare('SELECT revision, state_json FROM care_patrol_states WHERE session_id = ? AND species = ?');
  const initializeCarePatrol = db.prepare('INSERT OR IGNORE INTO care_patrol_states (session_id, species, state_json) VALUES (?, ?, ?)');
  const saveCarePatrol = db.prepare('UPDATE care_patrol_states SET revision = ?, state_json = ? WHERE session_id = ? AND species = ?');

  // Visiting Zhuzhu is independent of adoption. Every demo session can explore
  // this woodland without replacing its current companion or granting care XP.

  function load(sessionId, species = 'red-panda') {
    const record = species === 'red-panda' ? find.get(sessionId) : findCare.get(sessionId, species);
    const state = JSON.parse(record.state_json);
    state.revision = record.revision;
    state.pending = state.layoutVersion !== state.appliedVersion;
    return state;
  }

  function initializeHabitat(sessionId, species = 'red-panda') {
    const json = JSON.stringify({
      inventory: [species === 'red-panda' ? 'rest-platform' : careHabitats[species].facility],
      layout: { platform: null, bridge: false },
      appliedLayout: { platform: null, bridge: false },
      layoutVersion: 0,
      appliedVersion: 0,
      observations: [],
      growth: [],
    });
    if (species === 'red-panda') initialize.run(sessionId, json);
    else initializeCare.run(sessionId, species, json);
  }

  function habitatState(sessionId, requestedSpecies = 'red-panda') {
    const species = habitatSpecies(requestedSpecies);
    initializeHabitat(sessionId, species);
    return load(sessionId, species);
  }

  function grant(sessionId, state, id, label, species = 'red-panda') {
    const createdAt = now();
    const rewardKey = species === 'red-panda' ? id : `habitat:${species}:${id}`;
    if (addReward.run(sessionId, rewardKey, label, createdAt).changes) {
      state.growth.push({ id, label, createdAt });
    }
  }

  function layout(sessionId, state, body, species = 'red-panda') {
    const { facilityId, slotId } = body;
    if (species !== 'red-panda') {
      const definition = careHabitats[species];
      if (facilityId !== definition.facility) throw new GameError(400, '请选择当前伙伴可使用的设施。');
      if (!state.inventory.includes(facilityId)) throw new GameError(409, '尚未获得这项设施。', state);
      if (!definition.slots.includes(slotId)) throw new GameError(400, '请选择当前设施可到达的摆放位置。');
      if (state.layout.platform === slotId) return false;
      state.layout.platform = slotId;
      grant(sessionId, state, definition.construction, definition.constructionLabel, species);
      state.layoutVersion += 1;
      return true;
    }
    if (facilityId !== 'rest-platform' && facilityId !== 'woodland-bridge') {
      throw new GameError(400, '请选择有效设施。');
    }
    if (!state.inventory.includes(facilityId)) throw new GameError(409, '尚未获得这项设施。', state);
    if (facilityId === 'rest-platform') {
      if (!['trunk', 'edge'].includes(slotId)) throw new GameError(400, '平台只能放在树干高位或林缘低位。');
      if (state.layout.platform === slotId) return false;
      state.layout.platform = slotId;
      grant(sessionId, state, 'rest-platform-built', '为竹竹布置了新休息角落');
    } else {
      if (slotId !== 'canopy') throw new GameError(400, '木道需要连接两棵树的固定位置。');
      if (state.layout.bridge) return false;
      state.layout.bridge = true;
      grant(sessionId, state, 'woodland-bridge-built', '把巡护带回的木道放进林地');
    }
    state.layoutVersion += 1;
    return true;
  }

  function apply(state, body) {
    if (!Number.isSafeInteger(body.layoutVersion) || body.layoutVersion !== state.layoutVersion) {
      throw new GameError(409, '布置已更新，请重新读取后应用。', state);
    }
    if (state.appliedVersion === state.layoutVersion) return false;
    state.appliedLayout = { ...state.layout };
    state.appliedVersion = state.layoutVersion;
    return true;
  }

  function observe(state, body, species = 'red-panda') {
    const { behavior, layoutVersion, facilityId = null } = body;
    const definition = careHabitats[species];
    const titles = definition ? definition.observations : observationTitles;
    if (!Object.hasOwn(titles, behavior)) throw new GameError(400, '无法识别这项日常观察。');
    if (!Number.isSafeInteger(layoutVersion) || layoutVersion !== state.appliedVersion) {
      throw new GameError(409, '这次观察对应的布置已改变，请观察当前林地。', state);
    }
    let slotId = null;
    if (definition && behavior === definition.facilityBehavior) {
      if (facilityId !== definition.facility || !definition.slots.includes(state.appliedLayout.platform)) {
        throw new GameError(409, '当前设施生效并被使用后，才能记录这次观察。', state);
      }
      slotId = state.appliedLayout.platform;
    } else if (behavior === 'platform-rest') {
      if (facilityId !== 'rest-platform' || !state.appliedLayout.platform) {
        throw new GameError(409, '休息平台生效并被使用后，才能记录这次观察。', state);
      }
      slotId = state.appliedLayout.platform;
    } else if (behavior === 'bridge-cross') {
      if (facilityId !== 'woodland-bridge' || !state.appliedLayout.bridge) {
        throw new GameError(409, '连接木道生效后，才能记录穿行。', state);
      }
      slotId = 'canopy';
    } else if (facilityId !== null) {
      throw new GameError(400, '这项日常观察不对应设施。');
    }
    // Discovery belongs to a behavior/facility, not to each relocation or tab.
    const id = behavior;
    if (state.observations.some((record) => record.id === id)) return false;
    state.observations.push({ id, behavior, title: titles[behavior], facilityId, slotId, layoutVersion, createdAt: now() });
    return true;
  }

  function habitatAction(sessionId, action, body) {
    if (!['layout', 'apply', 'observe'].includes(action)) throw new GameError(404, '这项林地操作尚未开放。');
    if (!body || typeof body !== 'object' || Array.isArray(body) || !uuid.test(body.requestId)
      || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      throw new GameError(400, '请提交有效的操作编号和林地版本。');
    }
    const species = habitatSpecies(body.species);
    const fingerprint = createHash('sha256').update(canonical(body)).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      initializeHabitat(sessionId, species);
      const state = load(sessionId, species);
      const previous = findOperation.get(sessionId, body.requestId);
      const operation = species === 'red-panda' ? `habitat/${action}` : `habitat/${species}/${action}`;
      if (previous) {
        if (previous.action !== operation || previous.fingerprint !== fingerprint) {
          throw new GameError(409, '该操作编号已用于另一项操作，请重新尝试。', state);
        }
        db.exec('COMMIT');
        return state;
      }
      if (body.expectedRevision !== state.revision) {
        throw new GameError(409, '林地已在另一处更新，已为你读取最新布置。', state);
      }
      const changed = action === 'layout' ? layout(sessionId, state, body, species)
        : action === 'apply' ? apply(state, body) : observe(state, body, species);
      if (changed) {
        state.revision += 1;
        state.pending = state.layoutVersion !== state.appliedVersion;
        if (species === 'red-panda') save.run(state.revision, JSON.stringify(state), sessionId);
        else saveCare.run(state.revision, JSON.stringify(state), sessionId, species);
      }
      addOperation.run(sessionId, body.requestId, operation, fingerprint, now());
      db.exec('COMMIT');
      return state;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const patrolDefinition = (species) => species === 'red-panda' ? { questions, medalCatalog, chapters } : companionPatrols[species];

  function ensurePatrol(sessionId, species = 'red-panda') {
    const json = JSON.stringify({
      runId: null, theme: null, position: 0, remaining: 8, completed: false,
      lastRoll: null, pendingEvent: null, lastResult: null,
      chapters: [], medals: [], journal: [], eventCount: 0, collectionClaims: 0, knowledge: [], equippedMedalId: null,
    });
    if (species === 'red-panda') initializePatrol.run(sessionId, json);
    else initializeCarePatrol.run(sessionId, species, json);
  }

  function loadPatrol(sessionId, species = 'red-panda') {
    const record = species === 'red-panda' ? findPatrol.get(sessionId) : findCarePatrol.get(sessionId, species);
    const definition = patrolDefinition(species);
    const state = JSON.parse(record.state_json);
    // A read does not mutate old saves or invalidate in-flight versioned actions.
    const equippedMedalId = state.medals.some((entry) => entry.id === state.equippedMedalId)
      ? state.equippedMedalId : null;
    return { ...state, equippedMedalId, knowledge: state.knowledge || [], revision: record.revision,
      medalCatalog: definition.medalCatalog, collectionGoal: 4, knowledgeCatalogSize: definition.questions.length,
      ...(species === 'red-panda' ? {} : { species, presentation: definition.presentation }),
    };
  }

  function patrolState(sessionId, requestedSpecies = 'red-panda') {
    const species = habitatSpecies(requestedSpecies);
    ensurePatrol(sessionId, species);
    return loadPatrol(sessionId, species);
  }

  function startPatrol(state, body) {
    if (!['rest', 'habitat'].includes(body.theme)) throw new GameError(400, '请选择认识伙伴或栖地与保护作为巡护主题。');
    if (state.runId && (!state.completed || state.pendingEvent)) throw new GameError(409, '请先完成当前路线和待处理事件。', state);
    state.runId = randomUUID(); state.theme = body.theme; state.position = 0;
    state.remaining = 8; state.completed = false; state.lastRoll = null;
    state.pendingEvent = null; state.lastResult = null;
    return true;
  }

  function unlockMilestones(sessionId, state, from, to, species = 'red-panda') {
    const { chapters, medalCatalog } = patrolDefinition(species);
    for (const [index, milestone] of [4, 8].entries()) {
      if (from < milestone && to >= milestone && !state.chapters.some((entry) => entry.id === chapters[index].id)) {
        state.chapters.push({ ...chapters[index], createdAt: now() });
        addReward.run(sessionId, species === 'red-panda' ? `patrol-chapter-${milestone}` : `patrol:${species}:chapter-${milestone}`, chapters[index].title, now());
      }
    }
    if (to !== 8) return;
    if (species !== 'red-panda') {
      const medal = medalCatalog[0];
      awardMedal(state, medal.id, species);
      addReward.run(sessionId, `patrol:${species}:route-souvenir`, medal.title, now());
      return;
    }
    initializeHabitat(sessionId);
    const habitat = load(sessionId);
    if (!habitat.inventory.includes('woodland-bridge')) {
      habitat.inventory.push('woodland-bridge');
      grant(sessionId, habitat, 'woodland-bridge-unlocked', '完成林地巡护，带回连接木道');
      habitat.revision += 1;
      save.run(habitat.revision, JSON.stringify(habitat), sessionId);
    }
  }

  function rollPatrol(sessionId, state, species = 'red-panda') {
    if (!state.runId) throw new GameError(409, '请先选择主题，开始这次巡护。', state);
    if (state.pendingEvent) throw new GameError(409, '先为当前事件做一个选择，再继续掷骰。', state);
    if (state.completed || state.remaining <= 0) throw new GameError(409, '这次路线已完成，可以回家布置或主动再次巡护。', state);
    const die = rollDie();
    if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('Invalid injected patrol die');
    const from = state.position, to = Math.min(8, from + die);
    state.lastRoll = { id: randomUUID(), die, from, to, steps: Array.from({ length: to - from }, (_, index) => from + index + 1) };
    state.position = to; state.remaining -= 1; state.completed = to === 8;
    const definition = nextQuestion(state, species);
    const order = state.eventCount % definition.choices.length;
    const choices = [...definition.choices.slice(order), ...definition.choices.slice(0, order)];
    state.pendingEvent = {
      id: randomUUID(), kind: 'quiz', questionId: definition.id, topic: definition.topic,
      type: definition.topic, title: definition.title, text: definition.text,
      choices: choices.map(({id, label}) => ({id, label})),
    };
    state.lastResult = null;
    unlockMilestones(sessionId, state, from, to, species);
    return true;
  }

  function nextQuestion(state, species = 'red-panda') {
    const { questions } = patrolDefinition(species);
    const known = new Set(state.knowledge.map((entry) => entry.questionId));
    const visited = new Set(state.journal.filter((entry) => entry.runId === state.runId && entry.quiz).map((entry) => entry.quiz.questionId));
    const themed = (question) => question.themes.includes(state.theme);
    const pools = [
      questions.filter((question) => themed(question) && !known.has(question.id)),
      questions.filter((question) => !known.has(question.id)),
      questions.filter((question) => themed(question) && !visited.has(question.id)),
      questions.filter((question) => !visited.has(question.id)),
      questions.filter(themed),
      questions,
    ];
    const pool = pools.find((items) => items.length);
    return pool[state.eventCount % pool.length];
  }

  function awardMedal(state, id, species = 'red-panda') {
    const { medalCatalog } = patrolDefinition(species);
    if (state.medals.some((medal) => medal.id === id)) return null;
    const definition = medalCatalog.find((medal) => medal.id === id);
    if (!definition) return null;
    state.medals.push({ ...definition, createdAt: now() });
    return id;
  }

  function choosePatrol(state, body, species = 'red-panda') {
    const { questions, medalCatalog } = patrolDefinition(species);
    const event = state.pendingEvent;
    if (!event || body.eventVisitId !== event.id) throw new GameError(409, '这项事件已经处理或不属于当前巡护，请查看最新手记。', state);
    if (!event.choices.some((choice) => choice.id === body.choiceId)) throw new GameError(400, '请选择这次事件提供的行动。');
    let outcome, quiz;
    if (event.kind === 'quiz') {
      const definition = questions.find((question) => question.id === event.questionId);
      if (!definition) throw new GameError(409, '这条知识卡需要更新，请刷新巡护进度。', state);
      const correct = body.choiceId === definition.correctChoiceId;
      const learned = state.knowledge.find((entry) => entry.questionId === definition.id);
      quiz = {
        questionId: definition.id, question: event.text,
        selectedAnswer: event.choices.find((choice) => choice.id === body.choiceId).label,
        correctAnswer: definition.choices.find((choice) => choice.id === definition.correctChoiceId).label,
        correct, firstMastered: correct && !learned?.correct,
        misconception: correct ? '' : (definition.misconceptions?.[body.choiceId] || '再看看这条线索的解释，把观察留给下一次探望。'),
        explanation: definition.explanation, source: {...definition.source}, observationPrompt: definition.observationPrompt,
      };
      outcome = {
        title: `${correct ? '发现了' : '原来如此'} · ${definition.title}`,
        text: species === 'red-panda'
          ? '这条小知识已收入知识册。答对或答错都会留下见闻，不影响路线、木道或额外发现机会。'
          : '这条小知识已收入知识册。答对或答错都会留下见闻，不影响路线、完成纪念勋章或额外发现机会。',
        observation: true, candidates: definition.candidates,
      };
      if (learned) learned.correct = learned.correct || correct;
      else {
        const {selectedAnswer, ...fact} = quiz;
        state.knowledge.push({...fact, title: definition.title, firstSeenAt: now()});
      }
    } else {
      // Settling a pre-upgrade two-choice event must keep its original result.
      outcome = species === 'red-panda' ? eventDefinitions[event.type]?.results[body.choiceId] : null;
      if (!outcome) throw new GameError(400, '请选择这次事件提供的行动。');
    }
    let medal = null;
    if (random() < .25) {
      const candidate = outcome.candidates.find((id) => !state.medals.some((owned) => owned.id === id));
      if (candidate) medal = awardMedal(state, candidate, species);
    }
    const text = `${outcome.text}${medal ? ` 额外发现：${medalCatalog.find((entry) => entry.id === medal).title}。` : ' 这次见闻已计入累计观察，仍可用来定向收藏。'}`;
    const result = { eventVisitId: event.id, choiceId: body.choiceId, title: outcome.title, text, observation: outcome.observation, medal, ...(quiz ? {quiz} : {}) };
    state.lastResult = result;
    state.journal.push({ ...result, id: event.id, type: event.type, runId: state.runId, position: state.position, createdAt: now() });
    state.eventCount += 1;
    state.pendingEvent = null;
    return true;
  }

  function collectPatrol(state, body, species = 'red-panda') {
    const { medalCatalog } = patrolDefinition(species);
    if (!medalCatalog.some((medal) => medal.id === body.medalId)) throw new GameError(400, '请选择图鉴中的一枚勋章。');
    if (state.medals.some((medal) => medal.id === body.medalId)) return false;
    if (state.eventCount < (state.collectionClaims + 1) * 4) throw new GameError(409, '每累计四次事件，可定向收藏一枚尚未获得的勋章。', state);
    awardMedal(state, body.medalId, species);
    state.collectionClaims += 1;
    return true;
  }

  function equipMedal(state, body, species = 'red-panda') {
    const { medalCatalog } = patrolDefinition(species);
    if (body.medalId !== null && (typeof body.medalId !== 'string'
      || !medalCatalog.some((entry) => entry.id === body.medalId))) {
      throw new GameError(400, '请选择一枚当前伙伴的勋章，或选择不使用角标。');
    }
    if (body.medalId !== null && !state.medals.some((entry) => entry.id === body.medalId)) {
      throw new GameError(409, '获得这枚勋章后，即可使用它的照片角标。', state);
    }
    if (state.equippedMedalId === body.medalId) return false;
    state.equippedMedalId = body.medalId;
    return true;
  }

  function patrolAction(sessionId, action, body) {
    if (!['start', 'roll', 'choose', 'collect', 'equip'].includes(action)) throw new GameError(404, '这项巡护操作尚未开放。');
    if (!body || typeof body !== 'object' || Array.isArray(body) || !uuid.test(body.requestId)
      || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      throw new GameError(400, '请提交有效的操作编号和巡护版本。');
    }
    const species = habitatSpecies(body.species);
    const fingerprint = createHash('sha256').update(canonical(body)).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      ensurePatrol(sessionId, species);
      const state = loadPatrol(sessionId, species), operation = species === 'red-panda' ? `patrol/${action}` : `patrol/${species}/${action}`;
      const previous = findOperation.get(sessionId, body.requestId);
      if (previous) {
        if (previous.action !== operation || previous.fingerprint !== fingerprint) {
          throw new GameError(409, '该操作编号已用于另一项操作，请重新尝试。', state);
        }
        db.exec('COMMIT'); return state;
      }
      // A second click with a new UUID is still the same event choice, including after a lost response.
      const settled = action === 'choose' && state.journal.find((entry) => entry.id === body.eventVisitId);
      if (settled && settled.choiceId !== body.choiceId) throw new GameError(409, '这次事件已经选择了另一项行动，可在之后的巡护体验其他分支。', state);
      if (!settled && body.expectedRevision !== state.revision) throw new GameError(409, '巡护已在另一处更新，已为你读取最新进度。', state);
      const changed = settled ? false : action === 'start' ? startPatrol(state, body)
        : action === 'roll' ? rollPatrol(sessionId, state, species)
        : action === 'choose' ? choosePatrol(state, body, species)
        : action === 'collect' ? collectPatrol(state, body, species) : equipMedal(state, body, species);
      if (changed) {
        state.revision += 1;
        if (species === 'red-panda') savePatrol.run(state.revision, JSON.stringify(state), sessionId);
        else saveCarePatrol.run(state.revision, JSON.stringify(state), sessionId, species);
      }
      addOperation.run(sessionId, body.requestId, operation, fingerprint, now());
      db.exec('COMMIT'); return state;
    } catch (error) {
      db.exec('ROLLBACK'); throw error;
    }
  }

  return { habitatState, habitatAction, patrolState, patrolAction };
}
