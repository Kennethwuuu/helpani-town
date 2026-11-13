// Run against an isolated local instance; all AI generation responses are simulated.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use an isolated local instance.');
  const layout = [];
  const language = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    for (const route of ['/', '/stories', '/activities', '/support', '/organizer', '/project-draft']) {
      await page.goto(origin + route);
      for (const locale of ['en', 'zh-CN']) {
        await page.evaluate(locale => window.HelpaniI18n.setLocale(locale), locale);
        await page.evaluate(() => document.fonts.ready);
        for (const width of [320, 390, 760, 768, 820, 900, 1000, 1001, 1200]) {
          await page.setViewportSize({ width, height: 900 });
          const size = await page.evaluate(() => ({
            viewport: innerWidth,
            document: document.documentElement.scrollWidth,
            header: document.querySelector('.header').scrollWidth,
          }));
          if (size.document > width + 1 || size.header > width + 1) throw new Error(`Overflow: ${route}, ${locale}, ${width}: ${JSON.stringify(size)}`);
          layout.push({ route, locale, ...size });
        }
      }
    }
    let audit;
    let pending = false;
    let release;
    await page.route('**/api/project-draft', async route => {
      if (route.request().method() === 'GET') {
        const response = await route.fetch();
        const data = await response.json();
        audit = data.budgetAudit;
        data.enabled = true;
        data.configuration = { configured: true };
        await route.fulfill({ response, json: data });
      } else {
        if (pending) await new Promise(resolve => { release = resolve; });
        await route.fulfill({ json: {
          summary: 'Simulated draft', budgetFlags: [],
          task: { title: 'Simulated task', instructions: 'Review simulated sources.', sourceIds: ['rescue-plan'] },
          generation: { provider: 'Simulated provider', model: 'no-real-model' }, budgetAudit: audit,
        } }).catch(() => {});
      }
    });
    try {
      for (const initial of ['en', 'zh-CN']) {
        for (const inFlight of [false, true]) {
          pending = inFlight;
          release = undefined;
          await page.goto(origin + '/project-draft');
          await page.evaluate(locale => window.HelpaniI18n.setLocale(locale), initial);
          await page.waitForFunction(() => !document.querySelector('#generate-draft').disabled);
          const sources = await page.locator('#draft-sources input:checked').count();
          await page.locator('#generate-draft').click();
          if (inFlight) await page.waitForFunction(() => document.querySelector('#draft-content').getAttribute('aria-busy') === 'true');
          else await page.waitForFunction(() => !document.querySelector('#draft-content').hidden);
          const alternate = initial === 'en' ? 'zh-CN' : 'en';
          for (const locale of [alternate, initial, alternate, initial]) {
            await page.evaluate(locale => window.HelpaniI18n.setLocale(locale), locale);
            const expected = locale === 'en'
              ? 'Language changed. Generate a new draft using the selected sources.'
              : '语言已切换。请依据保留的所选资料重新生成草稿。';
            await page.waitForFunction(expected => document.querySelector('#draft-status').textContent === expected, expected);
            const result = await page.evaluate(() => ({
              locale: window.HelpaniI18n.locale,
              status: document.querySelector('#draft-status').textContent,
              draftHidden: document.querySelector('#draft-content').hidden,
              selectedSources: document.querySelectorAll('#draft-sources input:checked').length,
              generateEnabled: !document.querySelector('#generate-draft').disabled,
            }));
            if (!result.draftHidden || result.selectedSources !== sources || !result.generateEnabled) throw new Error(`Language state incorrect: ${JSON.stringify(result)}`);
            language.push({ initial, inFlight, ...result });
          }
          release?.();
        }
      }
    } finally {
      release?.();
      await page.unroute('**/api/project-draft');
    }
    await page.goto(origin);
    await page.evaluate(() => window.HelpaniI18n.setLocale('en'));
    await page.setViewportSize({ width: 820, height: 900 });
    await page.screenshot({ path: 'output/playwright/edge-fixes-20261113/tablet-header-820-fixed.png' });
    if (errors.length) throw new Error(`Page errors: ${JSON.stringify(errors)}`);
    return { layout, language, errors, realModelCalls: 0 };
  } finally {
    page.off('pageerror', onError);
  }
}
