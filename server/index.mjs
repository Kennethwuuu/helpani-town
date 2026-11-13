import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { capturePayPalOrder, createPayPalOrder, paypalConfigured } from './paypal.mjs';
import { auditProjectBudget, generateProjectDraft, projectAiConfigured, projectAiStatus, ProjectDraftError, projectSources } from './project-ai.mjs';
import { createGameStore, GameError } from './game.mjs';
import { companionPatrols } from './companion-patrol.mjs';
import { createAiDemoGate } from './ai-demo-gate.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || 'localhost';
const origin = new URL(process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).origin;
const dbPath = process.env.DB_PATH || 'data/helpani.sqlite';
if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS town_events (
    session_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('care', 'verification', 'allocation')),
    PRIMARY KEY (session_id, kind)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS town_pets (
    session_id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('sea-turtle', 'red-panda', 'pangolin'))
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pet_medals (
    session_id TEXT NOT NULL REFERENCES town_pets (session_id),
    species TEXT NOT NULL CHECK (species IN ('sea-turtle', 'red-panda', 'pangolin')),
    feed_count INTEGER NOT NULL CHECK (feed_count >= 6),
    PRIMARY KEY (session_id, species)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pet_encounters (
    session_id TEXT NOT NULL REFERENCES town_pets (session_id),
    species TEXT NOT NULL CHECK (species IN ('sea-turtle', 'red-panda', 'pangolin')),
    PRIMARY KEY (session_id, species)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS demo_calendar (
    session_id TEXT PRIMARY KEY NOT NULL,
    day_offset INTEGER NOT NULL CHECK (day_offset >= 1)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pet_checkins (
    session_id TEXT NOT NULL REFERENCES town_pets (session_id),
    day TEXT NOT NULL,
    PRIMARY KEY (session_id, day)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pet_feeds (
    session_id TEXT NOT NULL REFERENCES town_pets (session_id),
    day TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
    PRIMARY KEY (session_id, day, slot)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS pet_exchanges (
    session_id TEXT NOT NULL REFERENCES town_pets (session_id),
    request_id TEXT NOT NULL,
    PRIMARY KEY (session_id, request_id)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS activity_registrations (
    session_id TEXT NOT NULL,
    activity_id TEXT NOT NULL CHECK (activity_id IN ('park-cleanup', 'bird-safe-windows')),
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    PRIMARY KEY (session_id, activity_id)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS paypal_orders (
    reference TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('donation', 'supply')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    provider_id TEXT UNIQUE NOT NULL,
    capture_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'completed'))
  ) STRICT;
`);

const aiDemoGate = createAiDemoGate(db);
const sponsor = { points: 100, allocationCents: 200, poolCents: 1000 };
const game = createGameStore(db);
const exchangeCost = 50;
const petSpecies = ['sea-turtle', 'red-panda', 'pangolin'];
const storyCompleteFeeds = 6;
const activityTitles = {
  'park-cleanup': '湿地净滩｜给水鸟留一片浅滩',
  'bird-safe-windows': '防鸟撞工作坊｜给玻璃贴上记号',
};
const activityIds = Object.keys(activityTitles);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const gameCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const gameDayPattern = /^\d{4}-\d{2}-\d{2}$/;
const donationAmounts = new Set([500, 1000, 2000]);
const supplyAmount = 800;
const townPage = ['../public/index.html', 'text/html; charset=utf-8'];
const assets = new Map([
  ['/', townPage],
  ['/woodland', townPage],
  ['/stories', townPage],
  ['/activities', townPage],
  ['/support', townPage],
  ['/styles.css', ['../public/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['../public/app.js', 'text/javascript; charset=utf-8']],
  ['/woodland.js', ['../public/woodland.js', 'text/javascript; charset=utf-8']],
  ['/woodland-scene.js', ['../public/woodland-scene.js', 'text/javascript; charset=utf-8']],
  ['/care-species.js', ['../public/care-species.js', 'text/javascript; charset=utf-8']],
  ['/companion-scene.js', ['../public/companion-scene.js', 'text/javascript; charset=utf-8']],
  ['/woodland-album.js', ['../public/woodland-album.js', 'text/javascript; charset=utf-8']],
  ['/woodland-patrol.js', ['../public/woodland-patrol.js', 'text/javascript; charset=utf-8']],
  ['/medal-photo.js', ['../public/medal-photo.js', 'text/javascript; charset=utf-8']],
  ['/woodland.css', ['../public/woodland.css', 'text/css; charset=utf-8']],
  ['/patrol-rewards.css', ['../public/patrol-rewards.css', 'text/css; charset=utf-8']],
  ['/photo-medals.css', ['../public/photo-medals.css', 'text/css; charset=utf-8']],
  ['/assets/medals/canopy-listener.png', ['../public/assets/medals/canopy-listener.png', 'image/png']],
  ['/assets/medals/leaf-reader.png', ['../public/assets/medals/leaf-reader.png', 'image/png']],
  ['/assets/medals/trail-finder.png', ['../public/assets/medals/trail-finder.png', 'image/png']],
  ['/pet-stories.js', ['../public/pet-stories.js', 'text/javascript; charset=utf-8']],
  ['/organizer', ['../public/organizer.html', 'text/html; charset=utf-8']],
  ['/organizer.js', ['../public/organizer.js', 'text/javascript; charset=utf-8']],
  ['/organizer.css', ['../public/organizer.css', 'text/css; charset=utf-8']],
  ['/project-draft', ['../public/project-draft.html', 'text/html; charset=utf-8']],
  ['/project-draft.js', ['../public/project-draft.js', 'text/javascript; charset=utf-8']],
  ['/project-draft.css', ['../public/project-draft.css', 'text/css; charset=utf-8']],
  ['/vendor/ag-grid-community.min.js', ['../node_modules/ag-grid-community/dist/ag-grid-community.min.js', 'text/javascript; charset=utf-8']],
]);
for (const { medalCatalog } of Object.values(companionPatrols)) {
  for (const { art } of medalCatalog) assets.set(art, [`../public${art}`, 'image/svg+xml']);
}

const selectEvents = db.prepare('SELECT kind FROM town_events WHERE session_id = ?');
const addEvent = db.prepare('INSERT OR IGNORE INTO town_events (session_id, kind) VALUES (?, ?)');
const addPet = db.prepare('INSERT OR IGNORE INTO town_pets (session_id, species) VALUES (?, ?)');
const changePet = db.prepare('UPDATE town_pets SET species = ? WHERE session_id = ?');
const selectMedals = db.prepare('SELECT species, feed_count AS feedCount FROM pet_medals WHERE session_id = ? ORDER BY rowid');
const addMedal = db.prepare('INSERT INTO pet_medals (session_id, species, feed_count) VALUES (?, ?, ?)');
const archivePet = db.prepare('UPDATE pet_medals SET feed_count = ? WHERE session_id = ? AND species = ?');
const findEncounter = db.prepare('SELECT 1 FROM pet_encounters WHERE session_id = ? AND species = ?');
const addEncounter = db.prepare('INSERT OR IGNORE INTO pet_encounters (session_id, species) VALUES (?, ?)');
const selectDemoOffset = db.prepare('SELECT day_offset FROM demo_calendar WHERE session_id = ?');
const advanceDemoOffset = db.prepare(`
  INSERT INTO demo_calendar (session_id, day_offset) VALUES (?, 1)
  ON CONFLICT (session_id) DO UPDATE SET day_offset = day_offset + 1
`);
const selectPet = db.prepare(`
  WITH request (session_id, day) AS (VALUES (?, ?))
  SELECT species,
    (SELECT COUNT(*) FROM pet_checkins WHERE session_id = request.session_id) AS checkIns,
    EXISTS (SELECT 1 FROM pet_checkins WHERE session_id = request.session_id AND day = request.day) AS checkedInToday,
    (SELECT COUNT(*) FROM pet_feeds WHERE session_id = request.session_id) AS feedCount,
    (SELECT COUNT(*) FROM pet_feeds WHERE session_id = request.session_id AND day = request.day) AS feedsToday,
    (SELECT COUNT(*) FROM pet_exchanges WHERE session_id = request.session_id) AS exchanges
  FROM request JOIN town_pets USING (session_id)
`);
const addCheckIn = db.prepare('INSERT OR IGNORE INTO pet_checkins (session_id, day) VALUES (?, ?)');
const addFeed = db.prepare('INSERT INTO pet_feeds (session_id, day, slot) VALUES (?, ?, ?)');
const findExchange = db.prepare('SELECT 1 FROM pet_exchanges WHERE session_id = ? AND request_id = ?');
const addExchange = db.prepare('INSERT INTO pet_exchanges (session_id, request_id) VALUES (?, ?)');
const selectRegistrations = db.prepare('SELECT activity_id AS id, verified FROM activity_registrations WHERE session_id = ?');
const addRegistration = db.prepare('INSERT OR IGNORE INTO activity_registrations (session_id, activity_id) VALUES (?, ?)');
const verifyRegistration = db.prepare('UPDATE activity_registrations SET verified = 1 WHERE session_id = ? AND activity_id = ?');
const selectPayments = db.prepare(`
  SELECT kind, amount_cents AS amountCents, status FROM paypal_orders
  WHERE session_id = ? AND status IN ('pending', 'completed') ORDER BY rowid DESC
`);
const addOrder = db.prepare(`
  INSERT INTO paypal_orders (reference, session_id, kind, amount_cents, provider_id)
  VALUES (?, ?, ?, ?, ?)
`);
const findOrder = db.prepare(`
  SELECT reference, amount_cents AS amountCents, status FROM paypal_orders
  WHERE provider_id = ? AND session_id = ?
`);
const saveCapture = db.prepare(`
  UPDATE paypal_orders SET status = ?, capture_id = ? WHERE provider_id = ? AND status != 'completed'
`);

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sessionCalendar(sessionId, baseDay = gameCalendar.format()) {
  const offset = selectDemoOffset.get(sessionId)?.day_offset ?? 0;
  if (offset === 0) return { gameDay: baseDay, demoDay: 1 };
  const date = new Date(`${baseDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return { gameDay: date.toISOString().slice(0, 10), demoDay: offset + 1 };
}

function state(sessionId, { gameDay, demoDay } = sessionCalendar(sessionId)) {
  const events = new Set(selectEvents.all(sessionId).map(({ kind }) => kind));
  const cared = events.has('care');
  const activities = Object.fromEntries(activityIds.map((id) => [id, 'open']));
  for (const { id, verified } of selectRegistrations.all(sessionId)) {
    activities[id] = verified ? 'verified' : 'signed_up';
  }
  if (events.has('verification')) activities['park-cleanup'] = 'verified';
  const verifiedCount = Object.values(activities).filter((status) => status === 'verified').length;
  const profile = selectPet.get(sessionId, gameDay);
  const earned = selectMedals.all(sessionId);
  const archived = earned.filter(({ species }) => species !== profile?.species);
  const archivedFeeds = archived.reduce((total, record) => total + record.feedCount, 0);
  const pet = profile ? {
    species: profile.species,
    feedCount: profile.feedCount - archivedFeeds,
    feedsToday: profile.feedsToday,
    encountered: Boolean(findEncounter.get(sessionId, profile.species)),
  } : null;
  const foodExchanges = profile?.exchanges ?? 0;
  const food = profile ? 1 + archived.length + profile.checkIns + foodExchanges - profile.feedCount : 0;
  const exchangedPoints = foodExchanges * exchangeCost;
  const allocatedCents = events.has('allocation') ? sponsor.allocationCents : 0;
  return {
    gameDay,
    demoDay,
    xp: (cared ? 20 : 0) + (profile?.feedCount ?? 0) * 10,
    cared,
    activityVerified: verifiedCount > 0,
    points: verifiedCount * sponsor.points - exchangedPoints - (allocatedCents ? sponsor.points : 0),
    budgetCents: sponsor.poolCents - allocatedCents,
    allocatedCents,
    paypalEnabled: paypalConfigured(),
    payments: selectPayments.all(sessionId),
    pet,
    medals: earned.map(({ species }) => species),
    food,
    foodExchanges,
    checkInAvailable: Boolean(profile && !profile.checkedInToday),
    activities,
  };
}

function updateTown(sessionId, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const baseDay = gameCalendar.format();
    const current = state(sessionId, sessionCalendar(sessionId, baseDay));
    const changed = action(current, current.gameDay);
    const updated = changed === false ? current : state(sessionId, sessionCalendar(sessionId, baseDay));
    db.exec('COMMIT');
    return updated;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function organizerState({ activities, points, gameDay, demoDay }) {
  const registrations = Object.entries(activities)
    .filter(([, status]) => status !== 'open')
    .map(([id, status]) => ({ id, title: activityTitles[id], status, points: sponsor.points }));
  return { registrations, points, gameDay, demoDay };
}

function validateRequestedDay(day) {
  const time = typeof day === 'string' && gameDayPattern.test(day) ? Date.parse(day) : NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== day) {
    throw new RequestError(400, '请提供有效的演示日期。');
  }
}

function rejectStaleDay(requestedDay, gameDay) {
  if (requestedDay === undefined) return;
  validateRequestedDay(requestedDay);
  if (requestedDay !== gameDay) throw new RequestError(409, '小镇日期已更新，请在新一天重新操作。');
}

function getSession(req, res) {
  const existing = req.headers.cookie?.match(/(?:^|;\s*)helpani_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (existing) return existing;
  const sessionId = randomBytes(32).toString('hex');
  const secure = origin.startsWith('https:') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `helpani_demo=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
  return sessionId;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function redirectPayment(res, result) {
  res.writeHead(303, { Location: `/support?payment=${result}#records`, 'Cache-Control': 'no-store' });
  res.end();
}

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new RequestError(415, '请提交 JSON 请求。');
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new RequestError(413, '请求内容过长。');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new RequestError(400, '请求内容有误。');
  }
}

function acceptsPost(req) {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return req.headers['sec-fetch-site'] !== 'cross-site';
  if (requestOrigin === origin) return true;
  const loopback = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  return loopback.includes(origin) && loopback.includes(requestOrigin);
}

function assetFor(path) {
  if (assets.has(path)) return assets.get(path);
  if (/^\/i18n(?:-(?:town|woodland|organizer))?\.js$/.test(path)) return [`../public${path}`, 'text/javascript; charset=utf-8'];
  if (path === '/i18n.css') return ['../public/i18n.css', 'text/css; charset=utf-8'];
  if (/^\/[a-zA-Z0-9_-]+\.svg$/.test(path)) return [`../public${path}`, 'image/svg+xml'];
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    const path = url.pathname;
    if (req.method === 'GET' && path === '/healthz') return json(res, 200, { status: 'ok' });
    const asset = req.method === 'GET' ? assetFor(path) : undefined;
    if (asset) {
      const [filename, mime] = asset;
      const body = readFileSync(new URL(filename, import.meta.url));
      res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' });
      return res.end(body);
    }

    if (req.method === 'POST' && !acceptsPost(req)) {
      throw new RequestError(403, '请从小镇页面发起操作。');
    }
    const sessionId = getSession(req, res);
    if (req.method === 'GET' && path === '/api/habitat/state') return json(res, 200, game.habitatState(sessionId, url.searchParams.has('species') ? url.searchParams.get('species') : undefined));
    if (req.method === 'POST' && /^\/api\/habitat\/(layout|apply|observe)$/.test(path)) {
      return json(res, 200, game.habitatAction(sessionId, path.split('/').at(-1), await readJson(req)));
    }
    if (req.method === 'GET' && path === '/api/patrol/state') return json(res, 200, game.patrolState(sessionId, url.searchParams.has('species') ? url.searchParams.get('species') : undefined));
    if (req.method === 'POST' && /^\/api\/patrol\/(start|roll|choose|collect|equip)$/.test(path)) {
      return json(res, 200, game.patrolAction(sessionId, path.split('/').at(-1), await readJson(req)));
    }
    if (req.method === 'GET' && path === '/api/state') return json(res, 200, state(sessionId));
    if (req.method === 'POST' && path === '/api/demo/next-day') {
      const { day } = (await readJson(req)) ?? {};
      validateRequestedDay(day);
      const updated = updateTown(sessionId, (current) => {
        if (day !== current.gameDay) return false;
        advanceDemoOffset.run(sessionId);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'GET' && path === '/api/organizer/registrations') {
      return json(res, 200, organizerState(state(sessionId)));
    }
    if (req.method === 'GET' && path === '/api/project-draft') {
      return json(res, 200, {
        enabled: projectAiConfigured(), provider: 'Astropods', sources: projectSources,
        configuration: projectAiStatus(), budgetAudit: auditProjectBudget(projectSources.map(({ id }) => id)),
      });
    }
    if (req.method === 'POST' && path === '/api/project-budget') {
      const { sourceIds } = (await readJson(req)) ?? {};
      return json(res, 200, auditProjectBudget(sourceIds));
    }
    if (req.method === 'POST' && path === '/api/project-draft') {
      const controller = new AbortController();
      // IncomingMessage.close also fires after a complete request body. The
      // response closes early only when the client abandons the pending draft.
      const cancelGeneration = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.once('close', cancelGeneration);
      try {
        const { sourceIds, locale = 'en' } = (await readJson(req)) ?? {};
        if (!['en', 'zh-CN'].includes(locale)) throw new RequestError(400, '请选择 English 或中文。');
        return json(res, 200, await aiDemoGate.run(sessionId, () => generateProjectDraft(sourceIds, {
          locale,
          signal: controller.signal,
          beforeGatewayRequest: () => aiDemoGate.consumeAttempt(sessionId),
        })));
      } finally {
        res.off('close', cancelGeneration);
      }
    }
    if (req.method === 'POST' && path === '/api/care') {
      addEvent.run(sessionId, 'care');
      return json(res, 200, state(sessionId));
    }
    if (req.method === 'POST' && path === '/api/pet/adopt') {
      const { species, previousSpecies } = (await readJson(req)) ?? {};
      if (species !== 'random' && !petSpecies.includes(species)) throw new RequestError(400, '请选择一位可领养的动物伙伴。');
      const updated = updateTown(sessionId, (current) => {
        const activeSpecies = current.pet?.species ?? null;
        if (previousSpecies !== undefined && previousSpecies !== activeSpecies) {
          throw new RequestError(409, '当前伙伴已更新，请重新查看后再领养。');
        }
        if (activeSpecies && previousSpecies === undefined) {
          // Older clients did not send the companion they were replacing. Only
          // a retry of the same selection can safely return the current animal.
          if (species === activeSpecies || species === 'random') return false;
          throw new RequestError(409, '当前已有另一位伙伴，请刷新后重新选择领养；本次选择尚未生效。');
        }
        if (activeSpecies && !current.medals.includes(activeSpecies)) {
          throw new RequestError(409, '领取当前伙伴的保护勋章后，即可迎接下一位伙伴。');
        }
        const available = petSpecies.filter((candidate) => !current.medals.includes(candidate));
        if (!available.length) throw new RequestError(409, '三位伙伴的故事已全部完成。');
        const selected = species === 'random' ? available[randomInt(available.length)] : species;
        if (!available.includes(selected)) throw new RequestError(409, '这位伙伴的故事已完成，可以在勋章册里重读。');
        if (activeSpecies) {
          archivePet.run(current.pet.feedCount, sessionId, activeSpecies);
          changePet.run(selected, sessionId);
        } else {
          addPet.run(sessionId, selected);
        }
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/pet/touch') {
      const { species } = (await readJson(req)) ?? {};
      const updated = updateTown(sessionId, (current) => {
        if (!current.pet || current.pet.species !== species) {
          throw new RequestError(409, '当前伙伴已更新，请重新查看后再互动。');
        }
        addEncounter.run(sessionId, species);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/pet/medal') {
      const { species } = (await readJson(req)) ?? {};
      if (!petSpecies.includes(species)) throw new RequestError(400, '请选择一位动物伙伴。');
      const updated = updateTown(sessionId, (current) => {
        if (current.medals.includes(species)) return false;
        if (current.pet?.species !== species || current.pet.feedCount < storyCompleteFeeds) {
          throw new RequestError(409, '解锁伙伴的故事终章后，即可领取保护勋章。');
        }
        addMedal.run(sessionId, species, current.pet.feedCount);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/pet/check-in') {
      const input = req.headers['content-type']?.split(';')[0].trim() === 'application/json' ? await readJson(req) : undefined;
      const updated = updateTown(sessionId, (current, day) => {
        rejectStaleDay(input?.day, day);
        if (!current.pet) throw new RequestError(409, '请先领养一位动物伙伴。');
        if (!current.checkInAvailable) return false;
        addCheckIn.run(sessionId, day);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/pet/feed') {
      const { slot, day: requestedDay, species } = (await readJson(req)) ?? {};
      if (slot !== 1 && slot !== 2) throw new RequestError(400, '请选择有效的今日喂养次数。');
      const updated = updateTown(sessionId, (current, day) => {
        rejectStaleDay(requestedDay, day);
        if (!current.pet) throw new RequestError(409, '请先领养一位动物伙伴。');
        if (species !== undefined && species !== current.pet.species) throw new RequestError(409, '当前伙伴已更新，请重新查看后再喂食。');
        if (slot <= current.pet.feedsToday) return false;
        if (slot !== current.pet.feedsToday + 1) throw new RequestError(409, '请按顺序完成今日喂养。');
        if (!current.food) throw new RequestError(409, '食物不足。可以签到领取或用公益积分兑换。');
        addFeed.run(sessionId, day, slot);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/pet/exchange') {
      const { requestId } = (await readJson(req)) ?? {};
      if (typeof requestId !== 'string' || !requestIdPattern.test(requestId)) {
        throw new RequestError(400, '食物兑换请求缺少有效的编号。');
      }
      const exchangeId = requestId.toLowerCase();
      const updated = updateTown(sessionId, (current) => {
        if (!current.pet) throw new RequestError(409, '请先领养一位动物伙伴。');
        if (findExchange.get(sessionId, exchangeId)) return false;
        if (current.points < exchangeCost) throw new RequestError(409, '公益积分不足，兑换食物需要 50 分。');
        addExchange.run(sessionId, exchangeId);
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && ['/api/activity/signup', '/api/activity/verify', '/api/organizer/verify'].includes(path)) {
      const { id } = (await readJson(req)) ?? {};
      if (!activityIds.includes(id)) throw new RequestError(400, '请选择有效的演示活动。');
      if (path === '/api/activity/signup') {
        addRegistration.run(sessionId, id);
        return json(res, 200, state(sessionId));
      }
      const updated = updateTown(sessionId, (current) => {
        if (current.activities[id] === 'verified') return false;
        if (current.activities[id] !== 'signed_up') throw new RequestError(409, '请先报名该演示活动。');
        verifyRegistration.run(sessionId, id);
      });
      return json(res, 200, path === '/api/organizer/verify' ? organizerState(updated) : updated);
    }
    if (req.method === 'POST' && path === '/api/sponsor/allocate') {
      const updated = updateTown(sessionId, (current) => {
        if (current.allocatedCents) return false;
        if (current.points < sponsor.points) throw new RequestError(409, '公益积分不足，预留赞助额度需要 100 分。');
        addEvent.run(sessionId, 'allocation');
      });
      return json(res, 200, updated);
    }
    if (req.method === 'POST' && path === '/api/paypal/order') {
      const input = await readJson(req);
      const { kind, amountCents } = input ?? {};
      const donation = kind === 'donation' && donationAmounts.has(amountCents);
      const supply = kind === 'supply' && (amountCents === undefined || amountCents === supplyAmount);
      if (!donation && !supply) throw new RequestError(400, '请选择有效的沙箱支持选项。');
      if (!paypalConfigured()) throw new RequestError(503, 'PayPal 沙箱尚未配置。');
      // Use the same origin for the initial session and the approval return, including local preview.
      const checkoutOrigin = req.headers.origin || origin;
      const cents = supply ? supplyAmount : amountCents;
      const reference = randomUUID();
      const order = await createPayPalOrder({ kind, amountCents: cents, reference, origin: checkoutOrigin });
      addOrder.run(reference, sessionId, kind, cents, order.id);
      return json(res, 201, { approvalUrl: order.approvalUrl });
    }
    if (req.method === 'GET' && path === '/api/paypal/return') {
      const id = url.searchParams.get('token');
      const order = id && findOrder.get(id, sessionId);
      if (!order) return redirectPayment(res, 'error');
      if (order.status === 'completed') return redirectPayment(res, 'completed');
      try {
        const capture = await capturePayPalOrder({ id, reference: order.reference, amountCents: order.amountCents });
        saveCapture.run(capture.status, capture.captureId ?? null, id);
        return redirectPayment(res, findOrder.get(id, sessionId).status);
      } catch (error) {
        console.error('PayPal Sandbox capture failed:', error.message);
        return redirectPayment(res, 'error');
      }
    }
    throw new RequestError(404, '这个页面还没有开放。');
  } catch (error) {
    const knownError = error instanceof RequestError || error instanceof ProjectDraftError || error instanceof GameError;
    const status = knownError ? error.status : error.code === 'ENOENT' ? 404 : 502;
    if (status >= 500 && !knownError) console.error('Request failed:', error.message);
    if (!res.destroyed && !res.headersSent) json(res, status, { error: knownError ? error.message : '暂时无法完成，请稍后重试。', ...(error instanceof ProjectDraftError && error.code ? { code: error.code } : {}), ...(error instanceof GameError && error.state ? { state: error.state } : {}) });
  }
});

server.listen(port, host, () => console.log(`Helpani Town running at ${origin}`));
