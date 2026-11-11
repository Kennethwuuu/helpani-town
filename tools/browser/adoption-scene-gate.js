async (page) => {
  const origin=page.url().split('/').slice(0,3).join('/');
  const browser=page.context().browser();
  const check=(value,message)=>{if(!value)throw new Error(message);};
  const definitions={
    pangolin:{name:'小松',background:'/pangolin-habitat.svg',sprite:'/pangolin-pet.svg'},
    'sea-turtle':{name:'阿潮',background:'/tidepool-habitat.svg',sprite:'/tidepool-pet.svg'},
    'red-panda':{name:'竹竹',background:'/red-panda-habitat.svg',sprite:'/red-panda-pet.svg'},
  };
  const results=[];
  for(const mobile of [false,true])for(const species of ['pangolin','sea-turtle','red-panda']){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:3}: {})});
    const tab=await context.newPage(),errors=[],failed=[];
    tab.on('pageerror',error=>errors.push(error.message));
    tab.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
    try{
      tab.setDefaultTimeout(20000);
      await tab.goto(origin+'/',{waitUntil:'domcontentloaded'});
      await tab.waitForFunction(()=>window.helpaniView?.state&&!document.querySelector('[data-adopt=pangolin]').disabled);
      const initial=await tab.evaluate(()=>({pet:helpaniView.state.pet,background:document.querySelector('#pet-image').getAttribute('src'),sprite:document.querySelector('#pet-sprite').getAttribute('src'),hidden:document.querySelector('#pet-sprite').hidden}));
      check(initial.pet===null&&initial.hidden&&initial.sprite===null,'Unadopted scene has a default character: '+JSON.stringify(initial));
      check(initial.background.startsWith('/tidepool-habitat.svg?'),'Unadopted scene uses the thumbnail with a baked turtle');
      const click=async selector=>mobile?await tab.locator(selector).tap():await tab.locator(selector).click();
      await click(`[data-adopt="${species}"]`);
      await tab.waitForFunction(expected=>window.helpaniView?.state.pet?.species===expected&&document.querySelector('.landscape').dataset.ready==='true',species);
      const scene=await tab.evaluate(async()=>({
        server:await(await fetch('/api/state')).json(),view:helpaniView.state.pet.species,
        name:document.querySelector('#pet-name').textContent,species:document.querySelector('.landscape').dataset.species,
        background:document.querySelector('#pet-image').getAttribute('src'),sprite:document.querySelector('#pet-sprite').getAttribute('src'),
        backgroundDecoded:document.querySelector('#pet-image').complete&&document.querySelector('#pet-image').naturalWidth>0,
        spriteDecoded:document.querySelector('#pet-sprite').complete&&document.querySelector('#pet-sprite').naturalWidth>0,
        loadingHidden:document.querySelector('#pet-scene-loading').hidden,
      }));
      const definition=definitions[species];
      check(scene.server.pet.species===species&&scene.view===species&&scene.species===species,'Adoption species mismatch: '+JSON.stringify(scene));
      check(scene.name===definition.name,'Wrong animal label');
      check(scene.background===definition.background+'?v=20261110-pet-scene'&&scene.sprite===definition.sprite+'?v=20261110-pet-scene','Wrong scene resources: '+JSON.stringify(scene));
      check(scene.backgroundDecoded&&scene.spriteDecoded&&scene.loadingHidden,'Scene shown without both decoded assets');
      let behavior=null,care=null;
      if(species==='red-panda'){
        await tab.waitForFunction(()=>window.helpaniWoodland?.snapshot());
        check(!await tab.locator('#playroom .play-scene').isVisible(),'Old panda illustration competes with the Canvas woodland');
        check(await tab.locator('#wood-canvas').isVisible(),'Panda woodland did not activate');
      }else{
        await tab.locator('#playroom').scrollIntoViewIfNeeded();
        await tab.waitForFunction(()=>Boolean(document.querySelector('.landscape').dataset.behavior),{},{timeout:18000});
        behavior=await tab.locator('.landscape').getAttribute('data-behavior');
        await click('#pet-autonomy-toggle');
        await tab.locator('#playroom').screenshot({path:`output/playwright/adoption-20261110/${species}-${mobile?'mobile':'desktop'}.png`});
        await click('#pet-touch');
        await tab.waitForFunction(()=>helpaniView.state.pet.encountered&&!document.querySelector('#feed').disabled);
        await click('#feed');
        await tab.waitForFunction(()=>helpaniView.state.pet.feedCount===1);
        care=await tab.evaluate(()=>({species:helpaniView.state.pet.species,food:helpaniView.state.food,xp:helpaniView.state.xp,feedCount:helpaniView.state.pet.feedCount,points:helpaniView.state.points,budget:helpaniView.state.budgetCents,payments:helpaniView.state.payments}));
        check(care.food===0&&care.xp===10&&care.feedCount===1&&care.points===0&&care.budget===1000&&care.payments.length===0,'First care changed the wrong progress: '+JSON.stringify(care));
      }
      const beforeReload=await tab.evaluate(()=>({pet:helpaniView.state.pet,food:helpaniView.state.food,xp:helpaniView.state.xp}));
      await tab.reload({waitUntil:'domcontentloaded'});
      await tab.waitForFunction(expected=>window.helpaniView?.state.pet?.species===expected&&document.querySelector('.landscape').dataset.ready==='true',species);
      const afterReload=await tab.evaluate(()=>({pet:helpaniView.state.pet,food:helpaniView.state.food,xp:helpaniView.state.xp}));
      check(JSON.stringify(beforeReload)===JSON.stringify(afterReload),'Reload duplicated care or changed species');
      check(await tab.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Page overflows horizontally');
      check(errors.length===0,'Unhandled page error: '+errors.join('; '));
      check(failed.length===0,'Unexpected HTTP errors: '+JSON.stringify(failed));
      results.push({species,mobile,viewport:mobile?'390x844':'1440x900',initialSceneAnimalFree:true,selectedSpeciesMatchesServerAndView:true,background:scene.background,sprite:scene.sprite,bothAssetsDecoded:true,behavior,care,reloadPreserved:true,noHorizontalOverflow:true,pageErrors:errors,httpErrors:failed});
    }finally{await context.close();}
  }
  // Keep the pangolin background pending while its sprite decodes first.
  const delayContext=await browser.newContext({viewport:{width:1440,height:900}}),delayTab=await delayContext.newPage();
  let releaseBackground,delayedRequests=0;
  const backgroundHold=new Promise(resolve=>releaseBackground=resolve);
  let delayedScene;
  try{
    await delayTab.route('**/pangolin-habitat.svg?*',async route=>{delayedRequests+=1;const response=await route.fetch();await backgroundHold;await route.fulfill({response});});
    await delayTab.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await delayTab.locator('[data-adopt="pangolin"]').click();
    await delayTab.waitForFunction(()=>document.querySelector('#pet-sprite').complete&&document.querySelector('#pet-sprite').naturalWidth>0);
    const pending=await delayTab.evaluate(()=>({name:document.querySelector('#pet-name').textContent,ready:document.querySelector('.landscape').dataset.ready,artboard:getComputedStyle(document.querySelector('.scene-artboard')).visibility,loadingVisible:!document.querySelector('#pet-scene-loading').hidden,spriteDecoded:document.querySelector('#pet-sprite').complete&&document.querySelector('#pet-sprite').naturalWidth>0,backgroundComplete:document.querySelector('#pet-image').complete}));
    check(delayedRequests>0&&pending.ready==='false'&&pending.artboard==='hidden'&&pending.loadingVisible&&pending.spriteDecoded&&!pending.backgroundComplete,'Delayed background showed a partial scene: '+JSON.stringify(pending));
    releaseBackground();
    await delayTab.waitForFunction(()=>document.querySelector('.landscape').dataset.ready==='true'&&document.querySelector('#pet-scene-loading').hidden);
    check(await delayTab.evaluate(()=>getComputedStyle(document.querySelector('.scene-artboard')).visibility==='visible'),'Decoded scene stayed hidden');
    delayedScene={pending,delayedRequests,atomicSwapAfterRelease:true};
  }finally{releaseBackground();await delayContext.close();}
  // Failed sprite loading must hide the whole old scene and offer a safe retry.
  const context=await browser.newContext({viewport:{width:1440,height:900}}),tab=await context.newPage();
  const errors=[];tab.on('pageerror',error=>errors.push(error.message));
  let failSprite=true;
  try{
    await tab.route('**/tidepool-pet.svg?*',route=>failSprite?route.abort('failed'):route.continue());
    await tab.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await tab.locator('[data-adopt="sea-turtle"]').click();
    await tab.locator('#pet-scene-retry').waitFor({state:'visible'});
    const failed=await tab.evaluate(()=>({species:helpaniView.state.pet.species,ready:document.querySelector('.landscape').dataset.ready,hidden:getComputedStyle(document.querySelector('.scene-artboard')).visibility,text:document.querySelector('#pet-scene-loading-copy').textContent}));
    check(failed.species==='sea-turtle'&&failed.ready==='false'&&failed.hidden==='hidden','Failed image left a partial animal scene visible');
    await tab.locator('#playroom').screenshot({path:'output/playwright/adoption-20261110/turtle-loading-retry.png'});
    failSprite=false;
    await tab.locator('#pet-scene-retry').click();
    await tab.waitForFunction(()=>document.querySelector('.landscape').dataset.ready==='true'&&document.querySelector('#pet-scene-loading').hidden);
    check(await tab.evaluate(()=>helpaniView.state.pet.species==='sea-turtle'&&helpaniView.state.food===1&&helpaniView.state.xp===0),'Retry changed adoption rewards');
    check(errors.length===0,'Loading retry caused an unhandled page error');
    return {baseURL:origin,normalCases:results,normalCasesPassed:results.length,delayedScene,failedSpriteSceneHidden:true,failedSpriteRetrySucceeded:true,retryRewardsUnchanged:true,retryPageErrors:errors,coverage:'Google Chrome desktop and mobile/touch emulation; not iOS Safari or a physical phone'};
  }finally{await context.close();}
}
