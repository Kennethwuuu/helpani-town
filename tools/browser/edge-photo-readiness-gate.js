// Run against an isolated local instance. Only patrol GET responses are mocked.
async (page) => {
  const origin = new URL(page.url()).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use an isolated local instance.');
  const check = (value, message) => { if (!value) throw new Error(message); };
  page.setDefaultTimeout(15000);
  let phase = 'initial load';
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
  const slow = deferred();
  let heldReadCount = 0;
  const turtlePath = '**/api/patrol/state?species=sea-turtle';
  const turtleFixture = await (await page.request.get(`${origin}/api/patrol/state?species=sea-turtle`)).json();
  const withMedal = async route => {
    const data = structuredClone(turtleFixture), medal = data.medalCatalog[0];
    data.medals = [{ ...medal, createdAt: new Date().toISOString() }];
    data.equippedMedalId = medal.id;
    heldReadCount += 1;
    await slow.promise;
    await route.fulfill({ json: data });
  };
  await page.route(turtlePath, withMedal);
  try {
    await page.context().clearCookies();
    await page.goto(origin, { waitUntil: 'commit' });
    await page.locator('[data-adopt="sea-turtle"]').click();
    await page.waitForFunction(() => window.helpaniWoodland?.ready() && !window.helpaniPatrol?.state());
    await page.locator('#wood-camera').click();
    check(await page.locator('#wood-shutter').isDisabled(), 'Slow patrol read must disable shutter.');
    check(/Loading patrol badges|正在读取巡护勋章/.test(await page.locator('#wood-shutter').textContent()), 'Disabled shutter must explain its loading state.');
    check(!(await page.locator('#wood-photo-dialog').evaluate(x => x.open)), 'No incomplete preview may open.');
    await page.screenshot({ path: 'output/playwright/edge-fixes-20261113/patrol-photo-loading.png' });
    slow.release();
    await page.waitForFunction(() => window.helpaniPatrol?.state()?.equippedMedalId && !document.querySelector('#wood-shutter').disabled);
    await page.locator('#wood-shutter').click();
    await page.waitForFunction(() => !document.querySelector('#wood-photo-save').disabled);
    const equipped = await page.evaluate(() => helpaniPatrol.state().equippedMedalId);
    const selected = await page.locator('#wood-photo-accents button[aria-pressed="true"]').textContent();
    check(!/No badge|不加角标/.test(selected), 'First photo after readiness must include the equipped medal.');
    await page.screenshot({ path: 'output/playwright/edge-fixes-20261113/patrol-photo-ready.png' });
    await page.locator('#wood-crop').fill('1.2');
    await page.waitForFunction(() => !document.querySelector('#wood-photo-save').disabled);
    const imageHash = () => page.evaluate(async () => {
      const bytes = await (await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    });
    const previewHash = await imageHash();
    await page.locator('#wood-photo-save').click();
    await page.waitForFunction(() => document.querySelector('#wood-photo-save').disabled && document.querySelector('#wood-crop-label').hidden);
    await page.locator('#wood-photo-close').click();
    await page.locator('#wood-camera-exit').click();
    await page.locator('#wood-album').click();
    await page.locator('#wood-album-grid button').first().click();
    await page.waitForFunction(() => document.querySelector('#wood-photo-preview').complete && document.querySelector('#wood-photo-preview').naturalWidth === 1600);
    check(await imageHash() === previewHash, 'Saved album image must preserve the medal and crop.');
    await page.locator('#wood-photo-close').click();
    await page.locator('#wood-album-close').click();

    // Failed initial reads keep the camera waiting, and online recovery unlocks it.
    phase = 'failed initial read';
    await page.unroute(turtlePath, withMedal);
    let fail = true;
    await page.route(turtlePath, async route => fail ? route.abort('failed') : withMedal(route));
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => window.helpaniWoodland?.ready() && !window.helpaniPatrol?.state() && /Unable to load patrol|暂时无法打开/.test(document.querySelector('#patrol-status').textContent));
    await page.locator('#wood-camera').click();
    check(await page.locator('#wood-shutter').isDisabled(), 'Failed initial read must keep shutter disabled.');
    fail = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => window.helpaniPatrol?.state()?.equippedMedalId && !document.querySelector('#wood-shutter').disabled);
    await page.locator('#wood-camera-exit').click();

    check(errors.length === 0, 'Unhandled browser error: ' + errors.join('; '));
    return { pass: true, loadingStateVisible: true, equippedMedalOnFirstPhoto: equipped, selectedLabel: selected, initialReadFailureRecovered: true, croppedAlbumImageMatchesPreview: true, savedAlbumHash: previewHash, heldPatrolReads: heldReadCount, providerRequests: 0 };
  } catch (error) {
    throw new Error(`${phase}: ${error.message}`);
  } finally {
    slow.release();
    await page.unroute(turtlePath);
    page.off('pageerror', onError);
  }
}
