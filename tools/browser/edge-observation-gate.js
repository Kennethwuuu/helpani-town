// Run against an isolated local instance; no provider calls or reward grants.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use an isolated local instance.');
  const check = (value, message) => { if (!value) throw new Error(message); };
  const failed = [], sent = [], errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  await page.context().clearCookies();
  await page.route('**/api/habitat/observe', async route => {
    failed.push(route.request().postDataJSON());
    await route.abort('failed');
  });
  try {
    await page.goto(origin);
    await page.locator('[data-adopt="sea-turtle"]').click();
    await page.waitForFunction(() => window.helpaniWoodland?.ready());
    await page.waitForFunction(() => window.helpaniWoodland?.snapshot().node === 'surface', null, { timeout: 30000 });
    await page.locator('#wood-pause').click();
    check(failed.some(x => x.behavior === 'swim' && x.layoutVersion === 0), 'Initial swim must fail under layout 0.');
    await page.locator('#wood-arrange').click();
    await page.locator('[data-slot="seagrass"]').click();
    await page.locator('#wood-confirm').click();
    await page.waitForFunction(() => helpaniWoodland.state().appliedVersion === 1);
    check(!(await page.evaluate(() => helpaniWoodland.state().observations.some(x => x.behavior === 'swim'))), 'Changing the layout must not invent a new swim.');
    await page.unroute('**/api/habitat/observe');
    await page.route('**/api/habitat/observe', async route => {
      sent.push(route.request().postDataJSON());
      await route.continue();
    });
    await page.locator('#wood-pause').click();
    await page.waitForFunction(() => helpaniWoodland.state().observations.some(x => x.behavior === 'ledge-rest'), null, { timeout: 35000 });
    await page.waitForFunction(() => helpaniWoodland.state().observations.some(x => x.behavior === 'swim'), null, { timeout: 25000 });
    const state = await page.evaluate(() => helpaniWoodland.state());
    check(sent.some(x => x.behavior === 'swim' && x.layoutVersion === 1), 'A new real swim must report under the applied layout.');
    check(!sent.some(x => x.behavior === 'swim' && x.layoutVersion === 0), 'Stale failed swim must not be relabelled or retried after its layout expires.');
    check(state.observations.filter(x => x.behavior === 'swim').length === 1, 'Swim must be recorded once.');
    check(state.growth.length === 1, 'Recovery must not duplicate construction.');
    check(errors.length === 0, 'Unhandled browser error: ' + errors.join('; '));
    return { pass: true, automaticRecoveryWithoutRefresh: true, freshBehaviorAfterLayout: true, observations: state.observations.map(x => x.behavior), failed: failed.map(x => ({ behavior: x.behavior, layoutVersion: x.layoutVersion })), sent: sent.map(x => ({ behavior: x.behavior, layoutVersion: x.layoutVersion })), providerRequests: 0 };
  } finally {
    await page.unroute('**/api/habitat/observe');
    page.off('pageerror', onError);
  }
}
