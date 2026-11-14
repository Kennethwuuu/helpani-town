const statuses = new Set(['pending', 'completed', 'failed', 'refunded', 'partially_refunded']);
const terminal = new Set(['completed', 'failed', 'refunded', 'partially_refunded']);

function tableSQL(name) {
  return `CREATE TABLE ${name} (
    reference TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('donation', 'supply')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    provider_id TEXT UNIQUE NOT NULL,
    capture_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'created'
      CHECK (status IN ('created', 'pending', 'completed', 'failed', 'refunded', 'partially_refunded'))
  ) STRICT;`;
}

/** Payment state and retry times persist together; game rewards are never touched. */
export function createPayPalLedger(db, { now = Date.now, intervalMs = 60_000 } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) throw new Error('Invalid PayPal reconciliation interval.');
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  transaction(() => {
    const existing = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'paypal_orders'").get();
    if (!existing) db.exec(tableSQL('paypal_orders'));
    else if (!/['"]partially_refunded['"]/.test(existing.sql)) {
      // SQLite cannot extend a CHECK constraint with ALTER COLUMN. Copy every
      // existing field inside one transaction before changing the table name.
      const columns = db.prepare('PRAGMA table_info(paypal_orders)').all().map(row => row.name).sort();
      const expected = ['reference', 'session_id', 'kind', 'amount_cents', 'provider_id', 'capture_id', 'status'].sort();
      const custom = db.prepare("SELECT 1 FROM sqlite_master WHERE tbl_name = 'paypal_orders' AND type IN ('index', 'trigger') AND sql IS NOT NULL").get();
      if (JSON.stringify(columns) !== JSON.stringify(expected) || custom) {
        throw new Error('Unexpected PayPal ledger schema; automatic upgrade stopped without changing records.');
      }
      db.exec(`${tableSQL('paypal_orders_upgrade')}
        INSERT INTO paypal_orders_upgrade (rowid, reference, session_id, kind, amount_cents, provider_id, capture_id, status)
          SELECT rowid, reference, session_id, kind, amount_cents, provider_id, capture_id, status FROM paypal_orders;
        DROP TABLE paypal_orders;
        ALTER TABLE paypal_orders_upgrade RENAME TO paypal_orders;`);
    }
    db.exec(`CREATE TABLE IF NOT EXISTS paypal_reconciliations (
      provider_id TEXT PRIMARY KEY NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      next_check_at INTEGER NOT NULL DEFAULT 0 CHECK (next_check_at >= 0),
      last_checked_at INTEGER,
      last_error TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS paypal_reconciliations_due ON paypal_reconciliations(next_check_at);`);
  });

  const fields = 'reference, session_id AS sessionId, kind, amount_cents AS amountCents, provider_id AS id, capture_id AS captureId, status';
  const find = db.prepare(`SELECT ${fields} FROM paypal_orders WHERE provider_id = ?`);
  const findSession = db.prepare(`SELECT ${fields} FROM paypal_orders WHERE provider_id = ? AND session_id = ?`);
  const list = db.prepare(`SELECT kind, amount_cents AS amountCents, status FROM paypal_orders
    WHERE session_id = ? AND status != 'created' ORDER BY rowid DESC`);
  const create = db.prepare('INSERT INTO paypal_orders (reference, session_id, kind, amount_cents, provider_id) VALUES (?, ?, ?, ?, ?)');
  const save = db.prepare(`UPDATE paypal_orders SET status = ?, capture_id = ?
    WHERE provider_id = ? AND status IN ('created', 'pending') AND (capture_id IS NULL OR capture_id = ?)`);
  const reconcile = db.prepare(`UPDATE paypal_orders SET status = ?
    WHERE provider_id = ? AND status = 'pending' AND capture_id = ?`);
  const seed = db.prepare('INSERT OR IGNORE INTO paypal_reconciliations (provider_id, next_check_at) VALUES (?, ?)');
  const seedExisting = db.prepare(`INSERT OR IGNORE INTO paypal_reconciliations (provider_id)
    SELECT provider_id FROM paypal_orders WHERE status = 'pending' AND capture_id IS NOT NULL`);
  const remove = db.prepare('DELETE FROM paypal_reconciliations WHERE provider_id = ?');
  const prune = db.prepare(`DELETE FROM paypal_reconciliations WHERE NOT EXISTS (
    SELECT 1 FROM paypal_orders WHERE paypal_orders.provider_id = paypal_reconciliations.provider_id
      AND status = 'pending' AND capture_id IS NOT NULL)`);
  const due = db.prepare(`SELECT ${fields.split(', ').map(field => 'o.' + field).join(', ')}
    FROM paypal_orders o JOIN paypal_reconciliations r ON r.provider_id = o.provider_id
    WHERE o.status = 'pending' AND o.capture_id IS NOT NULL AND r.next_check_at <= ?
    ORDER BY r.next_check_at, o.rowid LIMIT ?`);
  const dueOrder = db.prepare(`SELECT ${fields.split(', ').map(field => 'o.' + field).join(', ')}
    FROM paypal_orders o JOIN paypal_reconciliations r ON r.provider_id = o.provider_id
    WHERE o.provider_id = ? AND o.status = 'pending' AND o.capture_id IS NOT NULL AND r.next_check_at <= ?`);
  const schedule = db.prepare('SELECT attempts FROM paypal_reconciliations WHERE provider_id = ?');
  const defer = db.prepare(`UPDATE paypal_reconciliations
    SET attempts = ?, next_check_at = ?, last_checked_at = ?, last_error = ? WHERE provider_id = ?`);

  function validateResult(result, captureId) {
    if (!statuses.has(result?.status) || typeof result.captureId !== 'string' || !result.captureId
      || (captureId && captureId !== result.captureId)) throw new Error('PayPal capture identity or status mismatch.');
  }
  function scheduleNext(order, error = null) {
    seed.run(order.id, 0);
    const attempts = schedule.get(order.id).attempts;
    const checkedAt = now();
    const delay = Math.min(3_600_000, intervalMs * 2 ** Math.min(attempts, 16));
    defer.run(attempts + 1, checkedAt + delay, checkedAt, error, order.id);
  }
  function prepareDue() {
    seedExisting.run();
    prune.run();
  }
  return {
    create: (reference, sessionId, kind, amountCents, id) => create.run(reference, sessionId, kind, amountCents, id),
    find: (id, sessionId) => sessionId === undefined ? find.get(id) : findSession.get(id, sessionId),
    list: sessionId => list.all(sessionId),
    saveCapture(id, result) {
      validateResult(result);
      return transaction(() => {
        const before = find.get(id);
        if (!before) throw new Error('PayPal order is not in the local ledger.');
        if (terminal.has(before.status)) return before;
        validateResult(result, before.captureId);
        save.run(result.status, result.captureId, id, result.captureId);
        const saved = find.get(id);
        if (saved.status === 'pending') seed.run(id, now() + intervalMs);
        else remove.run(id);
        return saved;
      });
    },
    due(limit = 5) {
      prepareDue();
      return due.all(now(), limit);
    },
    dueOrder(id) {
      prepareDue();
      return dueOrder.get(id, now());
    },
    finishCheck(order, result, error = null) {
      if (result) validateResult(result, order.captureId);
      return transaction(() => {
        const current = find.get(order.id);
        if (!current || terminal.has(current.status)) { remove.run(order.id); return current; }
        if (current.status !== 'pending' || current.captureId !== order.captureId) return current;
        if (result && result.status !== 'pending') {
          reconcile.run(result.status, order.id, order.captureId);
          remove.run(order.id);
        } else scheduleNext(order, error);
        return find.get(order.id);
      });
    },
  };
}
