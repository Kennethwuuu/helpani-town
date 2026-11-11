async (page) => {
  const origin=page.url().split('/').slice(0,3).join('/'),context=page.context();
  const cdp=await context.newCDPSession(page);
  const check=(ok,message)=>{if(!ok)throw new Error(message);},results=[];
  const mobileOnly=await page.evaluate(()=>new URL(location.href).searchParams.has('mobileOnly'));const desktopOnly=await page.evaluate(()=>new URL(location.href).searchParams.has('desktopOnly')); 
  const definitions={pangolin:{slots:['root-den','leaf-bed'],behavior:'shelter-rest'},'sea-turtle':{slots:['seagrass','rock-shelf'],behavior:'ledge-rest'},'red-panda':{slots:['trunk','edge'],behavior:'platform-rest'}};
  for(const mobile of (mobileOnly?[true]:desktopOnly?[false]:[false,true]))for(const species of ['pangolin','sea-turtle','red-panda']){
    const tab=page,errors=[];await tab.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});tab.setDefaultTimeout(20000);const onError=e=>errors.push(e.message);tab.on('pageerror',onError);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:900,deviceScaleFactor:mobile?3:1,mobile});
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?5:1});
    await context.clearCookies();
    await tab.evaluate(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();const request=indexedDB.open('helpani-woodland-album',1);const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(db.objectStoreNames.contains('photos'))await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();});
    try{
      await tab.evaluate(url=>location.assign(url),origin+'/?qa='+species+'-'+mobile+'-'+Date.now());await tab.waitForFunction(()=>window.helpaniView?.state?.pet===null,{},{timeout:60000});
      const click=async selector=>{const target=tab.locator(selector);if(!mobile)return target.click();await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
      await click(`[data-adopt="${species}"]`);await tab.waitForFunction(expected=>window.helpaniWoodland?.ready()&&helpaniWoodland.species()===expected&&!document.querySelector('#feed').disabled,species);
      check(await tab.evaluate(()=>document.querySelector('#woodland').parentElement.id==='playroom'&&document.querySelector('#feed').closest('#wood-feed-controls')!==null),'Care controls are outside the habitat');
      check(!await tab.locator('#playroom>.play-scene').isVisible(),'Old illustration overlaps the habitat');
      const viewport=await tab.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,coarse:matchMedia('(pointer:coarse)').matches}));check(viewport.width===(mobile?390:1440),'Actual CSS viewport does not match test');
      const initialURL=tab.url();await click('#wood-touch');await tab.waitForFunction(()=>helpaniView.state.pet.encountered);
      await click('#feed');await tab.waitForFunction(()=>helpaniView.state.pet.feedCount===1);
      const care=await tab.evaluate(()=>({food:helpaniView.state.food,xp:helpaniView.state.xp,pet:helpaniView.state.pet,points:helpaniView.state.points,budget:helpaniView.state.budgetCents,payments:helpaniView.state.payments}));
      check(care.food===0&&care.xp===10&&care.pet.species===species,'Wrong care progress');
      const interaction=await tab.evaluate(()=>helpaniWoodland.snapshot().interaction);check(Boolean(interaction),'Feeding did not reach the active scene');
      await tab.locator('.wood-card').screenshot({path:`output/playwright/unified-care/${species}-${mobile?'mobile':'desktop'}.png`});
      const definition=definitions[species];await click('#wood-arrange');await click(`[data-slot="${definition.slots[0]}"]`);await click('#wood-confirm');
      await tab.waitForFunction(behavior=>helpaniWoodland.state().observations.some(item=>item.behavior===behavior),definition.behavior,{timeout:60000});
      check(await tab.evaluate(()=>helpaniWoodland.state().growth.length===1),'Construction did not grant exactly once');
      await click('#wood-camera');check(await tab.locator('#wood-canvas').isVisible(),'Camera mode hides its own scene');await click('#wood-find');await click('#wood-shutter');
      await tab.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled&&document.querySelector('#wood-photo-preview').complete);
      const hash=()=>tab.evaluate(async()=>{const buffer=await(await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');});
      const previewHash=await hash(),downloaded=tab.waitForEvent('download');await click('#wood-photo-download');await(await downloaded).saveAs(`output/playwright/unified-care/${species}-${mobile?'mobile':'desktop'}-photo.png`);
      await click('#wood-photo-save');await tab.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');
      await click('#wood-photo-close');await click('#wood-camera-exit');await click('#wood-arrange');await click(`[data-slot="${definition.slots[1]}"]`);await click('#wood-confirm');
      check(await tab.evaluate(()=>helpaniWoodland.state().growth.length===1),'Relocation duplicated construction');
      check(tab.url()===initialURL,'Core care action navigated away');
      await tab.evaluate(()=>{window.__reloadProof=true;location.reload();});await tab.waitForFunction(expected=>!window.__reloadProof&&window.helpaniWoodland?.ready()&&helpaniWoodland.species()===expected,species);
      check(await tab.evaluate(slot=>helpaniWoodland.state().layout.platform===slot,definition.slots[1]),'Relocated facility did not survive reload');
      const afterCare=await tab.evaluate(()=>({food:helpaniView.state.food,xp:helpaniView.state.xp,pet:helpaniView.state.pet,points:helpaniView.state.points,budget:helpaniView.state.budgetCents,payments:helpaniView.state.payments}));
      check(JSON.stringify(care)===JSON.stringify(afterCare),'Layout/photo/reload changed care or funds');
      await click('#wood-album');await tab.locator('#wood-album-grid button').first().click();await tab.waitForFunction(()=>document.querySelector('#wood-photo-preview').complete);
      const albumHash=await hash();check(albumHash===previewHash,'Photo changed after layout/animal activity');
      const records=await tab.evaluate(async()=>{const {listPhotos}=await import('/woodland-album.js?v=20261110-unified-care');return(await listPhotos()).map(p=>({species:p.species,snapshotSpecies:p.snapshot.species,platform:p.snapshot.layout.platform}));});
      check(records.length===1&&records[0].species===species&&records[0].snapshotSpecies===species&&records[0].platform===definition.slots[0],'Photo metadata mixed species or layouts');
      check(await tab.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Horizontal overflow');check(errors.length===0,errors.join(';'));
      results.push({species,mobile,viewport,sameCarePage:true,feedAndTouch:true,firstFacilityUsed:true,relocationUnique:true,layoutAndCareRestored:true,photoSpecies:records[0].species,previewHash,albumHash,pageErrors:errors});
    }finally{tab.off('pageerror',onError);}
  }
  await cdp.detach();
  return{passed:results.length,results,coverage:'Google Chrome desktop and touch emulation; not physical iOS'};
}
