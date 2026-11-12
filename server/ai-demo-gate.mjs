import { ProjectDraftError } from './project-ai.mjs';

function integerSetting(env, name, fallback, minimum) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) {
    throw new Error(`Invalid ${name}: expected an integer of at least ${minimum}.`);
  }
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`Invalid ${name}: expected an integer of at least ${minimum}.`);
  }
  return value;
}

function limitReached() {
  return new ProjectDraftError(503, '本次公开演示的 AI 额度已用完，请联系维护者。', 'AI_DEMO_LIMIT_REACHED');
}

/** Lifetime attempt budgets persist in SQLite; concurrent work is leased in this process. */
export function createAiDemoGate(db, env = process.env) {
  const maximum = integerSetting(env, 'AI_DEMO_MAX_REQUESTS', 0, 0);
  const sessionMaximum = integerSetting(env, 'AI_DEMO_SESSION_MAX_REQUESTS', 10, 1);
  const concurrentMaximum = integerSetting(env, 'AI_DEMO_MAX_CONCURRENT', 1, 1);

  if (maximum === 0) {
    return {
      async run(_sessionId, callback) { return callback(); },
      consumeAttempt() {},
    };
  }

  db.exec(`CREATE TABLE IF NOT EXISTS ai_demo_usage (
    scope TEXT NOT NULL CHECK (scope IN ('global', 'session')),
    subject TEXT NOT NULL,
    attempts INTEGER NOT NULL CHECK (attempts >= 0),
    PRIMARY KEY (scope, subject)
  )`);
  const read = db.prepare('SELECT attempts FROM ai_demo_usage WHERE scope = ? AND subject = ?');
  const increment = db.prepare(`INSERT INTO ai_demo_usage (scope, subject, attempts) VALUES (?, ?, 1)
    ON CONFLICT (scope, subject) DO UPDATE SET attempts = attempts + 1`);
  let active = 0;

  return {
    async run(_sessionId, callback) {
      if (active >= concurrentMaximum) {
        throw new ProjectDraftError(503, 'AI 正在处理其他演示请求，请稍后重试。', 'AI_DEMO_BUSY');
      }
      active += 1;
      try { return await callback(); }
      finally { active -= 1; }
    },

    consumeAttempt(sessionId) {
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new TypeError('AI demo requires a session ID.');
      }
      // No async work may occur inside this transaction. Each accepted upstream
      // attempt stays charged even if its network request or response later fails.
      db.exec('BEGIN IMMEDIATE');
      try {
        const globalUsed = read.get('global', '')?.attempts ?? 0;
        const sessionUsed = read.get('session', sessionId)?.attempts ?? 0;
        if (globalUsed >= maximum || sessionUsed >= sessionMaximum) throw limitReached();
        increment.run('global', '');
        increment.run('session', sessionId);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
