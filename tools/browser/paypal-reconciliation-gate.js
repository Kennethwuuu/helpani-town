// Local-only frontend acceptance. All state and mutation responses are mocks.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use an isolated local fixture.');
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const session = await page.context().newCDPSession(page);
  const args = (await session.send('Browser.getBrowserCommandLine')).arguments;
  await session.detach();
  if (!args.some(value => value === '--headless' || value.startsWith('--headless='))) throw new Error('This gate requires a headless browser.');
  const profile = args.find(value => value.startsWith('--user-data-dir='))?.split('=').slice(1).join('=') || '';
  if (!/^(?:\/private)?\/(?:tmp|var\/folders)\//.test(profile)) throw new Error('Use a fresh temporary browser profile.');
  const check = (value, message) => { if (!value) throw new Error(message); };
  const pause = ms => page.waitForTimeout(ms);
  const completed = { kind: 'supply', amountCents: 800, status: 'completed' };
  const pending = { ...completed, status: 'pending' };
  const fixture = payments => ({
    gameDay: '2026-11-13', demoDay: 1, xp: 0, cared: false, activityVerified: false,
    points: 100, budgetCents: 1000, allocatedCents: 0, paypalEnabled: true, payments,
    pet: null, medals: [], food: 0, foodExchanges: 0, checkInAvailable: false,
    activities: { 'park-cleanup': 'open', 'bird-safe-windows': 'open' },
  });
  let state = fixture([pending]), reads = 0, failNext = false, holdNext = false, held, release;
  const errors = [], mutations = [], results = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const stateRoute = async route => {
    reads += 1;
    const captured = structuredClone(state);
    if (failNext) { failNext = false; await route.abort('failed'); return; }
    if (holdNext) {
      holdNext = false;
      held = true;
      await new Promise(resolve => { release = resolve; });
    }
    await route.fulfill({ json: captured });
  };
  const mutationRoute = async route => {
    mutations.push(new URL(route.request().url()).pathname);
    state = { ...state, points: 0, allocatedCents: 200, budgetCents: 800 };
    await route.fulfill({ json: state });
  };
  await page.route('**/api/state', stateRoute);
  await page.route('**/api/sponsor/allocate', mutationRoute);
  const ready = () => page.waitForFunction(() => window.helpaniView?.state?.payments?.length);
  const waitStatus = status => page.waitForFunction(status => window.helpaniView?.state?.payments?.[0]?.status === status, status, { timeout: 15000 });
  try {
    await page.goto(origin + '/support?payment=pending#records', { waitUntil: 'domcontentloaded' });
    await ready();
    await page.waitForFunction(() => document.querySelector('#payment-feedback').textContent.includes('1 pending'));
    check((await page.locator('#record-list').textContent()).includes('Sandbox payment pending'), 'Initial pending label missing.');
    state = fixture([completed]);
    await waitStatus('completed');
    await page.waitForFunction(() => document.querySelector('#payment-feedback').textContent.includes('1 completed'));
    check(!(await page.locator('#payment-feedback').textContent()).includes('pending'), 'Return feedback retained a stale pending summary.');
    check((await page.locator('#record-list').textContent()).includes('Supply awaiting purchase (demo)'), 'Completed supply must keep its fulfillment boundary.');
    const stoppedAt = reads;
    await pause(5500);
    check(reads === stoppedAt, 'Polling continued after the final status.');
    results.push('pending automatically becomes completed; summary updates; polling stops');

    state = fixture([pending]);
    await page.goto(origin + '/support?payment=pending#records', { waitUntil: 'domcontentloaded' });
    await waitStatus('pending');
    state = fixture(['completed', 'failed', 'refunded', 'partially_refunded'].map(status => ({ ...completed, status })));
    await page.waitForFunction(() => window.helpaniView?.state?.payments?.length === 4, null, { timeout: 15000 });
    const expected = ['Sandbox payment completed', 'Sandbox payment not completed', 'Sandbox payment refunded', 'Sandbox payment partially refunded'];
    await page.waitForFunction(expected => expected.every(label => document.querySelector('#record-list').textContent.includes(label)), expected);
    check(await page.locator('#record-list p').filter({ hasText: 'Supply awaiting purchase (demo)' }).count() === 1, 'Non-completed records must not claim procurement.');
    for (const locale of ['zh-CN', 'en', 'zh-CN', 'en']) {
      await page.locator('[data-language-select]').selectOption(locale);
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      if (locale === 'en') {
        await page.waitForFunction(() => document.querySelector('#payment-feedback').textContent.includes('1 partially refunded'));
        check(!/[\u3400-\u9fff]/.test(await page.locator('#record-list').textContent()), 'Terminal record translations mixed languages.');
        check(!/[\u3400-\u9fff]/.test(await page.locator('#payment-feedback').textContent()), 'Summary translations mixed languages.');
      } else {
        await page.waitForFunction(() => document.querySelector('#record-list').textContent.includes('沙箱付款部分退款'));
        check((await page.locator('#payment-feedback').textContent()).includes('部分退款 1 笔'), 'Chinese summary did not restore.');
      }
    }
    results.push('all final labels and mixed-status summaries translate both ways without false fulfillment');

    state = fixture([pending]);
    await page.goto(origin + '/support?payment=pending#records', { waitUntil: 'domcontentloaded' });
    await waitStatus('pending');
    const beforeFailure = reads;
    failNext = true;
    const failureDeadline = Date.now() + 15000;
    while (reads === beforeFailure && Date.now() < failureDeadline) await pause(100);
    check(reads > beforeFailure, 'The controlled failing poll did not start.');
    await pause(200);
    check((await page.locator('#record-list').textContent()).includes('Sandbox payment pending'), 'A background network failure erased the last ledger.');
    check(!(await page.locator('#record-list').textContent()).includes('Unable to load'), 'Background failure replaced known records with an error.');
    state = fixture([completed]);
    await waitStatus('completed');
    results.push('background read failure preserves records and retries automatically');

    state = fixture([pending]);
    await page.goto(origin + '/support?payment=pending#records', { waitUntil: 'domcontentloaded' });
    await waitStatus('pending');
    await page.evaluate(() => {
      window.__paypalGateHidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__paypalGateHidden });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenAt = reads;
    await pause(5500);
    check(reads === hiddenAt, 'Hidden page continued polling.');
    state = fixture([completed]);
    await page.evaluate(() => { window.__paypalGateHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await waitStatus('completed');
    results.push('visibility events pause polling and resume with a fresh ledger read');

    state = fixture([pending]);
    await page.goto(origin + '/stories', { waitUntil: 'domcontentloaded' });
    await ready();
    const storiesAt = reads;
    await pause(5500);
    check(reads === storiesAt, 'A page outside support polled payments.');
    results.push('other pages do not poll payment state');

    state = fixture([pending]);
    await page.goto(origin + '/support', { waitUntil: 'domcontentloaded' });
    await waitStatus('pending');
    held = false; holdNext = true;
    const deadline = Date.now() + 15000;
    while (!held && Date.now() < deadline) await pause(100);
    check(held, 'The controlled stale read did not start.');
    await page.locator('#allocate').click();
    await page.waitForFunction(() => window.helpaniView?.state?.allocatedCents === 200);
    release(); release = undefined;
    await pause(300);
    check(await page.evaluate(() => window.helpaniView.state.points === 0 && window.helpaniView.state.allocatedCents === 200), 'A stale payment poll overwrote a later player action.');
    state = { ...state, payments: [completed] };
    await waitStatus('completed');
    results.push('stale background read cannot roll back a later mutation');
    check(errors.length === 0, 'Browser JavaScript error: ' + errors.join('; '));
    check(mutations.every(path => path === '/api/sponsor/allocate') && mutations.length === 1, 'Unexpected mocked mutation.');
    return { pass: true, headless: true, isolatedLocalFixture: true, scenarios: results, stateReads: reads, mockedMutations: mutations, realPaymentRequests: 0, realAIRequests: 0, errors };
  } finally {
    release?.();
    await page.unroute('**/api/state', stateRoute);
    await page.unroute('**/api/sponsor/allocate', mutationRoute);
    page.off('pageerror', onError);
  }
}
