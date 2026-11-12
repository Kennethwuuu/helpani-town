// Playwright CLI run-code fixture. Local language acceptance; no provider requests.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):3121$/.test(origin)) throw new Error('Use the isolated language runtime on port 3121.');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const picker = () => page.locator('[data-language-select]');
  const audit = () => page.evaluate(() => {
    const chinese = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest('script,style,[data-no-i18n]') || !parent.getClientRects().length) continue;
      if (/[\u3400-\u9fff]/.test(node.nodeValue)) chinese.push(node.nodeValue.trim());
    }
    return { lang: document.documentElement.lang, chinese: [...new Set(chinese)], width: innerWidth, scroll: document.documentElement.scrollWidth };
  });
  const results = [];
  await page.goto(origin);
  check(await page.locator('html').getAttribute('lang') === 'en', 'Fresh browser must default to English');
  await picker().selectOption('zh-CN');
  await page.getByRole('heading', {name: '欢迎来到小镇。', exact: true}).waitFor();
  await page.reload();
  check(await picker().inputValue() === 'zh-CN', 'Chinese choice lost on reload');
  await page.goto(origin + '/support');
  check(await page.locator('html').getAttribute('lang') === 'zh-CN', 'Chinese choice lost across routes');
  await picker().selectOption('en');
  await page.goto(origin);
  if (await page.getByRole('button', {name: 'Green turtle Tide Bay', exact: true}).isVisible()) await page.getByRole('button', {name: 'Green turtle Tide Bay', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#pet-name')?.textContent.includes('Chao'));
  results.push({check:'English default and language persistence', pass:true});
  for (const width of [1200, 390, 320]) {
    await page.setViewportSize({width, height:844});
    for (const path of ['/', '/stories', '/activities', '/support', '/organizer', '/project-draft']) {
      await page.goto(origin + path);
      if (path === '/project-draft') await page.waitForFunction(() => document.querySelectorAll('input[name="sources"]').length === 3 && document.querySelector('#budget-audit').getAttribute('aria-busy') === 'false');
      if (path === '/organizer') await page.locator('#registration-search').waitFor({state:'visible'});
      const state = await audit();
      results.push({width,path,...state});
      check(state.chinese.length === 0, `Untranslated text at ${path}/${width}: ${state.chinese.join(' | ')}`);
      check(state.scroll <= width + 1, `Overflow at ${path}/${width}: ${state.scroll}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin);
  await page.screenshot({path:'output/playwright/language-en-care-390.png',fullPage:true});
  await picker().selectOption('zh-CN');
  check((await page.locator('#daily-project-meta').innerText()).includes('演示'), 'Copied daily metadata did not restore Chinese');
  await picker().selectOption('en');
  await page.goto(origin + '/project-draft');
  await page.waitForFunction(() => document.querySelectorAll('input[name="sources"]').length === 3);
  await page.locator('input[value="rescue-plan"]').uncheck();
  await page.locator('input[value="supply-register"]').uncheck();
  await page.waitForFunction(() => document.querySelector('#budget-audit').getAttribute('aria-busy') === 'false');
  const selected = await page.locator('input[name="sources"]:checked').count();
  await picker().selectOption('zh-CN');
  check(await page.locator('input[name="sources"]:checked').count() === selected, 'Switching language changed source choices');
  await picker().selectOption('en');
  check((await audit()).chinese.length === 0, 'Budget/source selection has untranslated content');
  await page.screenshot({path:'output/playwright/language-en-draft-390.png',fullPage:true});
  check(errors.length === 0, `Page errors: ${errors.join(' | ')}`);
  return {pass:true,checks:results,sourceSelectionPreserved:true,pageErrors:errors,realProviderRequests:0};
}
