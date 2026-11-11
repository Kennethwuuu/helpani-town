async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.waitForFunction(()=>window.helpaniPatrol?.state()?.completed);
  const before=await page.evaluate(()=>({h:helpaniWoodland.state(),p:helpaniPatrol.state()}));
  await page.getByRole('button',{name:'再次巡护',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().position===0);
  for(let turn=0;turn<16;turn++){
    const state=await page.evaluate(()=>helpaniPatrol.state());
    if(state.completed&&!state.pendingEvent)break;
    if(state.pendingEvent){await page.locator('#patrol-choices button').nth(turn%2).click();await page.waitForFunction(()=>!helpaniPatrol.state().pendingEvent);}
    else{await page.getByRole('button',{name:'掷骰前进',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden);}
  }
  const after=await page.evaluate(()=>({h:helpaniWoodland.state(),p:helpaniPatrol.state()}));
  check(after.p.completed&&after.p.chapters.length===before.p.chapters.length,'revisit lost chapters');
  check(after.h.inventory.length===before.h.inventory.length&&after.h.growth.length===before.h.growth.length,'revisit reawarded growth or facility');
  const collect=page.locator('#patrol-collect button');if(await collect.count()){await collect.first().click();await page.waitForFunction(()=>helpaniPatrol.state().collectionClaims>0);}
  await page.setViewportSize({width:390,height:844});await page.locator('#wood-canvas').scrollIntoViewIfNeeded();
  const frameTiming=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let last=performance.now();function next(now){samples.push(now-last);last=now;if(samples.length<120)requestAnimationFrame(next);else{samples.sort((a,b)=>a-b);resolve({samples:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)]});}}requestAnimationFrame(next);}));
  return {revisitPreservedInventory:true,revisitNoGrowthReaward:true,directedCollection:await page.evaluate(()=>helpaniPatrol.state().collectionClaims),frameTiming};
}
