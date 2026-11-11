// Playwright CLI run-code fixture. Isolated AI QA only; model responses below are explicit mocks.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):3119$/.test(origin)) throw new Error('Use the isolated AI QA origin on port 3119.');
  const check = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  const source = id => page.locator(`input[name="sources"][value="${id}"]`);
  const totals = () => page.locator('.budget-totals').innerText();
  const settled = () => page.waitForFunction(() => document.querySelector('#budget-audit').getAttribute('aria-busy') === 'false');
  const ready = () => page.waitForFunction(() => document.querySelectorAll('input[name="sources"]').length === 3);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/project-draft');
  await ready();
  check(await page.locator('#generate-draft').isDisabled(), 'Unconfigured gateway permits generation');
  check((await totals()).includes('US$100.00') && (await totals()).includes('US$64.00') && (await totals()).includes('US$36.00'), 'Initial local budget is incorrect');
  await page.screenshot({ path: 'output/playwright/ai-readiness/budget-mobile.png', fullPage: true });
  await source('rescue-plan').uncheck();
  await source('supply-register').uncheck();
  await settled();
  check(!(await totals()).includes('US$'), 'Observation-only input retained an old amount');
  check((await page.locator('#budget-findings').innerText()).includes('未提供'), 'Missing budget is not explained');
  await source('observation-notes').uncheck();
  check(await page.locator('#budget-content').isHidden(), 'Empty selection retained an audit');
  check(await page.locator('#generate-draft').isDisabled(), 'Empty selection permits generation');
  await source('rescue-plan').check();
  await source('supply-register').check();
  await source('observation-notes').check();
  await settled();
  await page.setViewportSize({ width: 320, height: 740 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px page overflows');
  await page.setViewportSize({ width: 390, height: 844 });
  results.push({ case: 'local-budget-without-gateway', mode: 'BROWSER_LOCAL_API', passed: true });

  let mode = 'success', modelRequests = 0;
  await page.route('**/api/project-draft', async route => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch();
      const data = await response.json();
      return route.fulfill({ response, json: { ...data, enabled: true, configuration: { configured: true, model: 'qa-model', issue: null } } });
    }
    modelRequests += 1;
    if (mode === 'rate-limit') return route.fulfill({ status: 503, json: { error: 'Mock upstream failure', code: 'AI_RATE_LIMITED' } });
    const { sourceIds } = route.request().postDataJSON();
    const audit = await page.request.post(origin + '/api/project-budget', { headers: { Origin: origin }, data: { sourceIds } });
    return route.fulfill({ json: {
      summary: '模拟响应：仅根据所选虚构资料整理。', budgetFlags: ['模拟建议：请人工核对缺项。'],
      task: { title: '模拟虚拟观察任务', instructions: '在虚拟地图辨认入口亮光。', sourceIds: [sourceIds.at(-1)] },
      budgetAudit: await audit.json(), generation: { provider: 'Astropods', model: 'qa-model' }, reviewRequired: true,
    } });
  });
  await page.reload();
  await ready();
  await page.locator('#generate-draft').click();
  await page.locator('#draft-content').waitFor({ state: 'visible' });
  check((await page.locator('#draft-generation').innerText()).includes('qa-model'), 'Generation provenance is missing');
  check((await page.locator('#draft-review-label').innerText()).includes('人工'), 'Review requirement is missing');
  await source('rescue-plan').uncheck();
  check(await page.locator('#draft-content').isHidden(), 'Source change kept stale AI content');
  await settled();
  mode = 'rate-limit';
  await page.locator('#generate-draft').click();
  await page.waitForFunction(() => /额度|频率/.test(document.querySelector('#draft-status').textContent));
  check(await page.locator('#draft-content').isHidden(), 'Failed generation kept old output');
  check(await source('supply-register').isChecked(), 'Failed generation lost selection');
  check(await page.locator('#generate-draft').isEnabled(), 'Retry remains disabled');
  mode = 'success';
  await source('supply-register').uncheck();
  await settled();
  await page.locator('#generate-draft').click();
  await page.locator('#draft-content').waitFor({ state: 'visible' });
  check(await page.locator('#draft-citations a').getAttribute('href') === '#source-observation-notes', 'Task citation does not point to the selected source');
  check(!(await totals()).includes('US$'), 'Retried observation-only generation reused old budget');
  check(modelRequests === 3, 'Unexpected duplicate generation requests');
  await page.evaluate(() => {
    const banner = document.createElement('p');
    banner.textContent = 'QA ONLY · 模拟 AI 响应，非真实模型联调';
    banner.style.cssText = 'padding:12px;background:#fff1b9;color:#553b0c;font-weight:bold';
    document.querySelector('main').prepend(banner);
  });
  await page.screenshot({ path: 'output/playwright/ai-readiness/mock-draft-mobile.png', fullPage: true });
  check(errors.length === 0, 'Unhandled browser errors: ' + errors.join('; '));
  results.push({ case: 'generation-provenance-selection-error-retry', mode: 'BROWSER_MOCK', passed: true, modelRequestsIntercepted: modelRequests });
  await page.unroute('**/api/project-draft');
  return { actualModelRequestsMade: 0, browser: 'Chrome mobile viewport; not physical Safari', results };
}
