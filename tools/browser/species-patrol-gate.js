// Run with playwright-cli run-code on the isolated QA server at port 3117.
// This gate intentionally clears ONLY that QA origin's session and photo data.
async (page) => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (!/^http:\/\/(localhost|127\.0\.0\.1):3117$/.test(origin)) throw new Error('Run this destructive QA fixture only against localhost:3117.');
  const flags = await page.evaluate(() => ({mobileOnly: new URL(location.href).searchParams.has('mobileOnly'), desktopOnly: new URL(location.href).searchParams.has('desktopOnly')}));
  const context = page.context(), cdp = await context.newCDPSession(page), results = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const definitions = {
    pangolin: {animal: '中华穿山甲', place: '蕨叶谷', slot: 'root-den', behavior: 'shelter-rest'},
    'sea-turtle': {animal: '绿海龟', place: '潮汐湾', slot: 'seagrass', behavior: 'ledge-rest'},
    'red-panda': {animal: '小熊猫', place: '竹影林', slot: 'trunk', behavior: 'platform-rest'},
  };
  const patrol = () => page.evaluate(() => helpaniPatrol.state());
  const closeDialogs = () => page.evaluate(() => { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); });
  const careLedger = () => page.evaluate(() => ({food: helpaniView.state.food, xp: helpaniView.state.xp, points: helpaniView.state.points, budget: helpaniView.state.budgetCents, payments: helpaniView.state.payments}));
  const previewHash = () => page.evaluate(async () => {
    const buffer = await (await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('');
  });
  let click;
  async function choosePending() {
    await closeDialogs();
    await page.locator('#patrol-event').waitFor({state: 'visible'});
    const before = await patrol(), pending = before.pendingEvent;
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/patrol/choose') && response.request().method() === 'POST');
    await click('#patrol-choices button:first-child');
    const response = await responsePromise, body = response.request().postDataJSON();
    check(response.ok(), 'Question settlement failed');
    await page.waitForFunction(id => !helpaniPatrol.state().pendingEvent && helpaniPatrol.state().lastResult?.eventVisitId === id, pending.id);
    await closeDialogs();
    const after = await patrol();
    check(after.eventCount === before.eventCount + 1 && after.lastResult.quiz && after.knowledge.length > 0, 'Answer did not produce a saved knowledge record');
    check(after.lastResult.quiz.source?.url.startsWith('https://'), 'Quiz explanation lacks a source');
    check(!after.lastResult.quiz.correct || after.knowledge.some(item => item.questionId === pending.questionId && item.correct), 'Correct answer did not mark mastery');
    check(after.lastResult.quiz.correct || Boolean(after.lastResult.quiz.misconception), 'Wrong answer lacks tailored feedback');
    const retry = await page.evaluate(async body => {
      const send = async value => { const response = await fetch('/api/patrol/choose', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)}); return {status: response.status, state: await response.json()}; };
      const sameRequest = await send(body), sameChoice = await send({...body, requestId: crypto.randomUUID()});
      return {sameRequest, sameChoice};
    }, body);
    for (const result of [retry.sameRequest, retry.sameChoice]) check(result.status === 200 && result.state.eventCount === after.eventCount && result.state.revision === after.revision && result.state.medals.length === after.medals.length, 'Repeated answer duplicated progress or rewards');
    const conflicting = await page.evaluate(async ({body, choices}) => {
      const response = await fetch('/api/patrol/choose', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...body, requestId: crypto.randomUUID(), choiceId: choices.find(choice => choice.id !== body.choiceId).id})});
      return response.status;
    }, {body, choices: pending.choices});
    check(conflicting === 409, 'A settled question accepted a conflicting choice');
    return {questionId: pending.questionId, correct: after.lastResult.quiz.correct, source: after.lastResult.quiz.source.url, retryUnique: true, conflictRejected: true};
  }
  async function animatedRoll() {
    await closeDialogs();
    await page.evaluate(() => {
      window.__patrolSteps = []; window.__patrolObserver?.disconnect();
      window.__patrolObserver = new MutationObserver(() => {
        const current = [...document.querySelectorAll('#patrol-nodes li')].findIndex(node => node.getAttribute('aria-current') === 'step');
        if (window.__patrolSteps.at(-1) !== current) window.__patrolSteps.push(current);
      });
      window.__patrolObserver.observe(document.querySelector('#patrol-nodes'), {subtree: true, attributes: true, attributeFilter: ['aria-current']});
    });
    await click('#patrol-roll');
    await page.locator('#patrol-event').waitFor({state: 'visible'});
    await closeDialogs();
    const state = await patrol(), observed = await page.evaluate(() => { window.__patrolObserver.disconnect(); return window.__patrolSteps; });
    check(state.lastRoll.die >= 1 && state.lastRoll.die <= 6, 'Die out of range');
    check(state.lastRoll.steps.every(step => observed.includes(step)), `Movement skipped a committed step: ${JSON.stringify({observed, roll: state.lastRoll})}`);
    check(state.position === Math.min(8, state.lastRoll.from + state.lastRoll.die), 'Wrong landing cell');
    return {die: state.lastRoll.die, steps: state.lastRoll.steps, observed};
  }
  try {
    for (const mobile of flags.mobileOnly ? [true] : flags.desktopOnly ? [false] : [false, true]) {
      for (const species of ['pangolin', 'sea-turtle', 'red-panda']) {
        const definition = definitions[species], errors = [], onError = error => errors.push(error.message);
        page.on('pageerror', onError); page.setDefaultTimeout(25000);
        await page.setViewportSize(mobile ? {width: 390, height: 844} : {width: 1440, height: 900});
        await cdp.send('Emulation.setDeviceMetricsOverride', {width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 3 : 1, mobile});
        await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: mobile, maxTouchPoints: mobile ? 5 : 1});
        click = async selector => {
          const target = page.locator(selector); if (!mobile) return target.click();
          await target.scrollIntoViewIfNeeded(); const box = await target.boundingBox(); check(Boolean(box), 'Touch target has no bounds: ' + selector);
          await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1}]});
          await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        };
        try {
          await closeDialogs(); await context.clearCookies();
          await page.evaluate(async () => {
            const {openAlbum} = await import('/woodland-album.js?v=20261110-unified-care'); const database = await openAlbum();
            await new Promise((resolve, reject) => {const transaction = database.transaction('photos', 'readwrite'); transaction.objectStore('photos').clear(); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);});
            window.__patrolNewSession = true;
          });
          await page.evaluate(url => location.assign(url), `${origin}/?qa=patrol-${species}-${mobile}-${Date.now()}`);
          await page.waitForFunction(() => !window.__patrolNewSession && window.helpaniView?.state?.pet === null, {}, {timeout: 60000});
          await click(`[data-adopt="${species}"]`);
          await page.waitForFunction(expected => window.helpaniWoodland?.ready() && helpaniWoodland.species() === expected && window.helpaniPatrol?.species === expected && helpaniPatrol.state(), species);
          check(await page.locator('#wood-patrol-host').isVisible(), 'Patrol hidden for ' + species);
          check(await page.locator('#wood-patrol-host').innerText().then(text => text.includes(definition.animal) && text.includes(definition.place)), 'Wrong species patrol copy');
          const viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight, dpr: devicePixelRatio, coarse: matchMedia('(pointer:coarse)').matches}));
          check(viewport.width === (mobile ? 390 : 1440), 'Wrong actual CSS viewport');
          const originalURL = page.url(), ledgerBefore = await careLedger();
          await click('#wood-arrange'); await click(`[data-slot="${definition.slot}"]`); await click('#wood-confirm');
          await page.locator('#patrol-theme').selectOption(mobile ? 'habitat' : 'rest'); await click('#patrol-start');
          await page.waitForFunction(() => helpaniPatrol.state().runId && !document.querySelector('#patrol-roll').disabled);
          const committedPromise = page.waitForResponse(response => response.url().endsWith('/api/patrol/roll') && response.request().method() === 'POST');
          await click('#patrol-roll'); const committed = await (await committedPromise).json();
          check(Boolean(committed.pendingEvent) && committed.remaining === 7, 'First roll was not atomically committed');
          await page.evaluate(() => {window.__patrolReload = true; location.reload();});
          await page.waitForFunction(expected => !window.__patrolReload && window.helpaniWoodland?.ready() && window.helpaniPatrol?.species === expected && helpaniPatrol.state()?.pendingEvent, species);
          const restored = await patrol();
          check(restored.pendingEvent.id === committed.pendingEvent.id && restored.lastRoll.id === committed.lastRoll.id && restored.position === committed.position && restored.remaining === committed.remaining, 'Reload during movement lost or consumed the pending roll');
          const answers = [await choosePending()], rolls = [];
          while (!(await patrol()).completed) {rolls.push(await animatedRoll()); answers.push(await choosePending());}
          const finished = await patrol();
          check(finished.chapters.length === 2 && finished.position === 8, 'Route did not unlock both chapters');
          const habitats = await page.evaluate(async () => Object.fromEntries(await Promise.all(['red-panda', 'pangolin', 'sea-turtle'].map(async species => [species, await (await fetch('/api/habitat/state?species=' + species)).json()]))));
          check(species === 'red-panda' ? habitats[species].inventory.includes('woodland-bridge') : !habitats[species].inventory.includes('woodland-bridge') && !habitats['red-panda'].inventory.includes('woodland-bridge'), 'Route granted another animal’s bridge');
          if (species !== 'red-panda') check(finished.medals.some(medal => medal.id === finished.medalCatalog[0].id), 'Completion did not guarantee its species souvenir');
          const otherSpecies = Object.keys(definitions).filter(value => value !== species);
          const otherPatrols = await page.evaluate(async species => Promise.all(species.map(async value => await (await fetch('/api/patrol/state?species=' + value)).json())), otherSpecies);
          check(otherPatrols.every(state => !state.runId && !state.knowledge.length && !state.medals.length), 'Patrol progress leaked to another species');
          await page.locator('#wood-patrol-host').screenshot({path: `output/playwright/species-patrol/${species}-${mobile ? 'mobile' : 'desktop'}-route.png`});
          // Panda's original route guarantees a bridge rather than a medal. If no
          // random medal appeared, use the public four-event collection path.
          while (!(await patrol()).medals.length && (await patrol()).eventCount < 4) {
            if ((await patrol()).completed) {await click('#patrol-start'); await page.waitForFunction(() => !helpaniPatrol.state().completed);}
            rolls.push(await animatedRoll()); answers.push(await choosePending());
          }
          if (!(await patrol()).medals.length) {
            const first = (await patrol()).medalCatalog[0].id;
            await click(`[data-medal-id="${first}"] .patrol-medal-action`); await page.waitForFunction(() => helpaniPatrol.state().medals.length > 0); await closeDialogs();
          }
          const owned = (await patrol()).medals[0]; await click(`[data-medal-preview="${owned.id}"]`); await click('#patrol-medal-use');
          await page.waitForFunction(() => document.querySelector('#wood-photo-dialog').open && !document.querySelector('#wood-photo-save').disabled && document.querySelector('#wood-photo-preview').complete);
          check((await patrol()).equippedMedalId === owned.id, 'Medal equipment was not saved');
          const pngHash = await previewHash(), downloadPromise = page.waitForEvent('download'); await click('#wood-photo-download');
          const download = await downloadPromise, downloadPath = `output/playwright/species-patrol/${species}-${mobile ? 'mobile' : 'desktop'}-photo.png`; await download.saveAs(downloadPath);
          // Read the actual downloaded stream rather than a second preview fetch.
          const stream = await download.createReadStream(), bytes = []; for await (const chunk of stream) for (const byte of chunk) bytes.push(byte);
          const downloadedHash = await page.evaluate(async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].map(value => value.toString(16).padStart(2, '0')).join(''), bytes);
          check(downloadedHash === pngHash, 'Downloaded PNG differs from the final preview');
          await page.locator('#wood-photo-dialog').screenshot({path: `output/playwright/species-patrol/${species}-${mobile ? 'mobile' : 'desktop'}-preview.png`});
          await click('#wood-photo-save'); await page.waitForFunction(() => document.querySelector('#wood-photo-save').textContent === '已保存');
          check(await page.locator('#wood-photo-save').isDisabled(), 'Repeated save remains enabled');
          await click('#wood-photo-close'); await click('#wood-camera-exit');
          await page.evaluate(() => {window.__patrolReload = true; location.reload();});
          await page.waitForFunction(expected => !window.__patrolReload && window.helpaniWoodland?.ready() && window.helpaniPatrol?.species === expected && helpaniPatrol.state(), species);
          check((await patrol()).equippedMedalId === owned.id && (await patrol()).chapters.length === 2, 'Reload lost completed chapters or equipped medal');
          await page.waitForFunction(behavior => helpaniWoodland.state().observations.some(item => item.behavior === behavior), definition.behavior, {timeout: 60000});
          await click('#wood-album'); await page.waitForFunction(() => document.querySelectorAll('#wood-album-grid button').length === 1); await click('#wood-album-grid button:first-child');
          await page.waitForFunction(() => document.querySelector('#wood-photo-preview').complete);
          const albumHash = await previewHash(), photoRecord = await page.evaluate(async () => {
            const {listPhotos} = await import('/woodland-album.js?v=20261110-unified-care'); const photo = (await listPhotos())[0];
            return {species: photo.species, medal: photo.medal, slot: photo.snapshot.layout.platform};
          });
          check(albumHash === pngHash && photoRecord.species === species && photoRecord.medal.id === owned.id && photoRecord.slot === definition.slot, 'Reopened album changed species, layout, medal, or PNG');
          check(JSON.stringify(await careLedger()) === JSON.stringify(ledgerBefore), 'Patrol or photography modified care, points, or funds');
          check(page.url() === originalURL, 'Patrol or photography navigated away from care');
          check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Horizontal overflow');
          check(errors.length === 0, errors.join('; '));
          results.push({species, mobile, viewport, movementReloadRestored: true, rolls, answers, chapters: finished.chapters.map(chapter => chapter.id), guaranteedSouvenir: species !== 'red-panda', patrolsSeparated: true, equippedMedal: owned.id, photo: {previewHash: pngHash, downloadedHash, albumHash, downloadPath}, facilityUsed: true, ledgersUnchanged: true, pageErrors: errors});
          await closeDialogs();
        } finally {page.off('pageerror', onError);}
      }
    }
    // The final case is a panda. Seed another species' pending event while its
    // controller is live, then switch through the actual adoption UI.
    const pandaBefore = await patrol();
    const pendingPangolin = await page.evaluate(async () => {
      const get = async () => await (await fetch('/api/patrol/state?species=pangolin')).json();
      const send = async (action, data = {}) => {const state = await get(), response = await fetch('/api/patrol/' + action, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({species: 'pangolin', expectedRevision: state.revision, requestId: crypto.randomUUID(), ...data})}); if (!response.ok) throw new Error(await response.text()); return response.json();};
      await send('start', {theme: 'rest'}); return send('roll');
    });
    check((await patrol()).runId === pandaBefore.runId, 'Other-species API call replaced the live controller');
    await page.evaluate(async () => {
      const send = async (path, body) => {const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); if (!response.ok) throw new Error(await response.text()); return response.json();};
      let state = await (await fetch('/api/state')).json();
      while (state.pet.feedCount < 6) {
        if (state.pet.feedsToday >= 2 || (state.food < 1 && !state.checkInAvailable)) state = await send('/api/demo/next-day', {day: state.gameDay});
        if (state.food < 1) state = await send('/api/pet/check-in', {day: state.gameDay});
        state = await send('/api/pet/feed', {day: state.gameDay, slot: state.pet.feedsToday + 1, species: 'red-panda'});
      }
      await send('/api/pet/medal', {species: 'red-panda'}); window.__patrolSwitch = true; location.assign('/?choose=next#playroom');
    });
    await page.waitForFunction(() => !window.__patrolSwitch && window.helpaniView?.state?.pet?.species === 'red-panda' && !document.querySelector('#adoption-panel').hidden);
    await click('[data-adopt="pangolin"]');
    await page.waitForFunction(() => window.helpaniWoodland?.ready() && helpaniWoodland.species() === 'pangolin' && window.helpaniPatrol?.species === 'pangolin' && helpaniPatrol.state()?.pendingEvent);
    const pangolinAfter = await patrol(), pandaAfter = await page.evaluate(async () => await (await fetch('/api/patrol/state?species=red-panda')).json());
    check(pangolinAfter.pendingEvent.id === pendingPangolin.pendingEvent.id && pangolinAfter.position === pendingPangolin.position, 'Species switch lost its own pending question');
    check(pandaAfter.runId === pandaBefore.runId && pandaAfter.eventCount === pandaBefore.eventCount && pandaAfter.equippedMedalId === pandaBefore.equippedMedalId, 'Species switch changed the previous patrol');
    check((await page.locator('#patrol-event-label').innerText()).includes('中华穿山甲'), 'Switched patrol still labels the panda');
    const photos = await page.evaluate(async () => {const {listPhotos} = await import('/woodland-album.js?v=20261110-unified-care'); return (await listPhotos()).map(photo => ({species: photo.species, medal: photo.medal?.id}));});
    check(photos.length === 1 && photos[0].species === 'red-panda' && photos[0].medal === pandaBefore.equippedMedalId, 'Species switch rewrote an old photo’s medal');
    return {passed: results.length, results, crossSpeciesSwitch: {pendingQuestionRestored: true, previousPatrolPreserved: true, oldPhotoPreserved: true}, coverage: 'Google Chrome desktop and trusted touch emulation; not physical iOS'};
  } finally {await cdp.detach();}
}
