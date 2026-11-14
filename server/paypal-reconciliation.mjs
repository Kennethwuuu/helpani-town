import { paypalConfigured, readPayPalOrder } from './paypal.mjs';

export function paypalReconciliationSettings(env = process.env) {
  const flag = env.PAYPAL_RECONCILE_ENABLED ?? 'true';
  if (!['true', 'false', '1', '0'].includes(flag)) throw new Error('Invalid PAYPAL_RECONCILE_ENABLED.');
  const raw = env.PAYPAL_RECONCILE_INTERVAL_MS ?? '60000';
  if (!/^\d+$/.test(raw)) throw new Error('Invalid PAYPAL_RECONCILE_INTERVAL_MS.');
  const intervalMs = Number(raw);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000 || intervalMs > 3_600_000) {
    throw new Error('PAYPAL_RECONCILE_INTERVAL_MS must be between 1000 and 3600000.');
  }
  return { enabled: flag === 'true' || flag === '1', intervalMs };
}

/** One in-process worker; persisted due times survive restarts and provider errors. */
export function createPayPalReconciler({ ledger, intervalMs = 60_000, enabled = true,
  configured = paypalConfigured, readOrder = readPayPalOrder,
  warn = () => console.warn('PayPal Sandbox pending check deferred; the payment record is retained.'),
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer, running, started = false, stopped = false, generation = 0;
  let sequence = Promise.resolve();
  const inFlight = new Map();
  const controllers = new Set();

  function reconcileOrder(id) {
    if (inFlight.has(id)) return inFlight.get(id);
    if (!enabled || stopped || !configured()) return Promise.resolve(ledger.find(id));
    const requestedGeneration = generation;
    // Browser returns and the background scan share one serial read queue.
    // Starting on a microtask also registers the lease before a sync mock throws.
    const job = sequence.then(async () => {
      if (stopped || requestedGeneration !== generation || !configured()) return ledger.find(id);
      const order = ledger.dueOrder(id);
      if (!order) return ledger.find(id);
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const result = await readOrder({ ...order, signal: controller.signal });
        if (controller.signal.aborted) return ledger.find(id);
        return ledger.finishCheck(order, result);
      } catch {
        if (controller.signal.aborted) return ledger.find(id);
        const latest = ledger.finishCheck(order, null, 'PAYPAL_CHECK_FAILED');
        warn();
        return latest;
      } finally {
        controllers.delete(controller);
      }
    }).finally(() => { inFlight.delete(id); });
    inFlight.set(id, job);
    sequence = job.catch(() => {});
    return job;
  }
  function runOnce() {
    if (running) return running;
    if (!enabled || stopped || !configured()) return Promise.resolve();
    const requestedGeneration = generation;
    running = (async () => {
      for (const order of ledger.due(5)) {
        if (stopped || requestedGeneration !== generation || !configured()) break;
        await reconcileOrder(order.id);
      }
    })().finally(() => { running = null; });
    return running;
  }
  function schedule(expectedGeneration) {
    if (!started || expectedGeneration !== generation || timer !== undefined) return;
    timer = setTimer(async () => {
      if (!started || expectedGeneration !== generation) return;
      timer = undefined;
      try { await runOnce(); } catch { warn(); }
      finally { schedule(expectedGeneration); }
    }, intervalMs);
    timer?.unref?.();
  }
  return {
    runOnce,
    reconcileOrder,
    start() {
      if (started || !enabled || !configured()) return;
      stopped = false;
      started = true;
      const expectedGeneration = ++generation;
      // Existing pending rows are resumed without waiting for a buyer to return.
      void runOnce().catch(() => warn()).finally(() => schedule(expectedGeneration));
    },
    stop() {
      started = false;
      stopped = true;
      generation += 1;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
      for (const controller of controllers) controller.abort();
    },
  };
}
