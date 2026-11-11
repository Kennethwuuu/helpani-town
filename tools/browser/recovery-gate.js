async (page) => {
  const origin=page.url().split('/').slice(0,3).join('/');
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const unhandled=[];page.on('pageerror',error=>unhandled.push(error.message));
  let blockAcknowledgements=true;
  const applyBodies=[];
  await page.route('**/api/habitat/apply',async route=>{applyBodies.push(route.request().postDataJSON());if(blockAcknowledgements)await route.abort('failed');else await route.continue();});
  await page.route('**/api/habitat/observe',route=>blockAcknowledgements?route.abort('failed'):route.continue());
  await page.goto(origin+'/woodland',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.helpaniWoodland?.state());
  const before=await page.evaluate(()=>helpaniWoodland.state());
  check(before.layoutVersion===0,'Use a fresh Playwright browser session for the recovery gate.');
  if(!before.layout.platform){
    await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
    await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
    await page.getByRole('button',{name:'确认布置',exact:true}).click();
  }
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='platform-rest',{},{timeout:60000});
  blockAcknowledgements=false;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(async()=>{const state=await(await fetch('/api/habitat/state')).json();return state.layoutVersion===state.appliedVersion&&state.observations.some(item=>item.behavior==='platform-rest');},{},{timeout:20000});
  await page.waitForFunction(()=>helpaniWoodland.state().observations.some(item=>item.behavior==='platform-rest')&&!helpaniWoodland.state().pending);
  const recovered=await page.evaluate(()=>helpaniWoodland.state());
  check(recovered.growth.filter(item=>item.id==='rest-platform-built').length===1,'recovery re-awarded construction');
  check(recovered.observations.filter(item=>item.behavior==='platform-rest').length===1,'recovery duplicated first use');
  check(applyBodies.length<2||new Set(applyBodies.slice(0,2).map(body=>body.requestId)).size===1,'transport retry changed its operation UUID');
  await page.unroute('**/api/habitat/apply');await page.unroute('**/api/habitat/observe');

  // The first response can be lost even though SQLite committed the application.
  const lostBodies=[];
  await page.route('**/api/habitat/apply',async route=>{lostBodies.push(route.request().postDataJSON());await route.fetch();await route.abort('failed');});
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  const next=recovered.layout.platform==='trunk'?'林缘边 · 低台':'树干旁 · 高枝';
  await page.getByRole('button',{name:next,exact:false}).click();await page.getByRole('button',{name:'确认布置',exact:true}).click();
  const appliedDeadline=Date.now()+60000;
  while(!lostBodies.length&&Date.now()<appliedDeadline)await page.waitForTimeout(100);
  await page.waitForFunction(async version=>{const state=await(await fetch('/api/habitat/state')).json();return state.layoutVersion===version&&state.appliedVersion===version;},recovered.layoutVersion+1,{timeout:20000});
  await page.waitForTimeout(250);
  check(lostBodies.length>=1,'lost response was not exercised');
  check(new Set(lostBodies.map(body=>body.requestId)).size===1,'acknowledgement retries used different UUIDs');
  await page.unroute('**/api/habitat/apply');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>!helpaniWoodland.state().pending);

  // The album is browser-local and stays usable while the network is unavailable.
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click();await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);
  await page.context().setOffline(true);
  await page.getByRole('button',{name:'保存到相册',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'退出相机',exact:true}).click();
  await page.getByRole('button',{name:'▧ 打开我的相册',exact:true}).click();await page.locator('#wood-album-grid button').first().click();
  check(await page.locator('#wood-photo-preview').isVisible(),'offline album lost its preview');
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'关闭相册',exact:true}).click();
  await page.context().setOffline(false);

  // A failed initial patrol read recovers without reloading the entire woodland.
  await page.route('**/api/patrol/state',route=>route.abort('failed'));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#patrol-status')?.textContent.includes('暂时无法打开'));
  await page.unroute('**/api/patrol/state');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>window.helpaniPatrol?.state());
  const patrol=await page.evaluate(()=>helpaniPatrol.state());
  if(!patrol.runId||patrol.completed&&!patrol.pendingEvent){await page.locator('#patrol-start').click();await page.waitForFunction(()=>helpaniPatrol.state().runId&&!helpaniPatrol.state().completed);}
  if(!(await page.evaluate(()=>helpaniPatrol.state().pendingEvent))){await page.getByRole('button',{name:'掷骰前进',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden);}
  const eventsBefore=await page.evaluate(()=>helpaniPatrol.state().eventCount);
  const choiceBodies=[];
  await page.route('**/api/patrol/choose',async route=>{choiceBodies.push(route.request().postDataJSON());await route.fetch();await route.abort('failed');});
  await page.locator('#patrol-choices button').first().click();await page.waitForFunction(()=>helpaniPatrol.state().eventCount>0&&!helpaniPatrol.state().pendingEvent);
  const afterChoice=await page.evaluate(()=>helpaniPatrol.state());
  check(afterChoice.eventCount===eventsBefore+1,'lost choice response awarded twice');
  check(choiceBodies.length===2&&new Set(choiceBodies.map(body=>body.requestId)).size===1,'choice transport retry changed UUID');
  await page.unroute('**/api/patrol/choose');
  // A saved patrol choice must not be reported as failed when its separate
  // habitat inventory read is unavailable, and returning home stays catchable.
  if(!afterChoice.completed){
    await page.getByRole('button',{name:'掷骰前进',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden);
    const count=await page.evaluate(()=>helpaniPatrol.state().eventCount);
    await page.route('**/api/habitat/state',route=>route.abort('failed'));
    await page.locator('#patrol-choices button').first().click();
    await page.waitForFunction(previous=>helpaniPatrol.state().eventCount===previous+1&&!helpaniPatrol.state().pendingEvent,count);
    await page.waitForFunction(()=>document.querySelector('#patrol-status').textContent.includes('见闻已保存，林地库存'));
    await page.locator('#patrol-home').click();await page.waitForFunction(()=>document.querySelector('#wood-notice').textContent.includes('库存会在恢复后同步'));
    await page.unroute('**/api/habitat/state');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  }
  // A second tab changes the layout while the first still holds an old revision.
  await page.locator('#wood-pause').click();await page.evaluate(()=>helpaniWoodland.refresh());
  const old=await page.evaluate(()=>helpaniWoodland.state()),other=await page.context().newPage();
  await other.goto(origin+'/api/habitat/state',{waitUntil:'domcontentloaded'});
  const changed=await other.evaluate(async()=>{const latest=await(await fetch('/api/habitat/state')).json();return await(await fetch('/api/habitat/layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:latest.revision,facilityId:'rest-platform',slotId:latest.layout.platform==='trunk'?'edge':'trunk'})})).json();});
  const conflict=await page.evaluate(async old=>{try{await helpaniWoodland.command('layout',{facilityId:'rest-platform',slotId:old.layout.platform});return{status:200};}catch(error){return{status:error.status,state:helpaniWoodland.state()};}},old);
  await other.close();
  check(conflict.status===409&&conflict.state.layoutVersion===changed.layoutVersion&&conflict.state.layout.platform===changed.layout.platform,'stale tab overwrote a newer layout');
  check(conflict.state.growth.filter(item=>item.id==='rest-platform-built').length===1,'stale tab duplicated construction');
  await page.locator('#wood-pause').click();
  check(!unhandled.length,'unhandled browser error: '+unhandled.join('; '));
  return {automaticApplyAndObservationRecovered:true,firstUseUnique:true,lostApplicationResponseRecovered:true,offlineAlbumUsable:true,initialPatrolReadRecovered:true,lostChoiceResponseRecovered:true,separateHabitatReadFailureHandled:true,staleTabRejected:true,latestLayoutRetained:true,growthUnique:true,choiceTransportAttempts:choiceBodies.length,unhandled};
}
