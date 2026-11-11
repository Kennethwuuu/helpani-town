async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.waitForFunction(()=>window.helpaniPatrol?.state());
  await page.getByRole('combobox',{name:'这次想找什么？'}).selectOption('habitat');
  await page.getByRole('button',{name:'出发巡护',exact:true}).click();
  await page.waitForFunction(()=>window.helpaniPatrol.state().runId);
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/patrol/roll')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'掷骰前进',exact:true}).click();
  const response=await responsePromise, rollBody=response.request().postDataJSON(), rolled=await response.json();
  await page.reload(); await page.waitForFunction(()=>window.helpaniPatrol?.state()?.pendingEvent);
  const recovered=await page.evaluate(()=>helpaniPatrol.state());
  check(recovered.position===rolled.position&&recovered.pendingEvent.id===rolled.pendingEvent.id,'moving refresh lost result');
  const retry=await page.evaluate(async body=>{const res=await fetch('/api/patrol/roll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,state:await res.json()};},rollBody);
  check(retry.status===200&&retry.state.remaining===rolled.remaining&&retry.state.position===rolled.position,'roll retry consumed twice');
  await page.locator('#patrol-event').scrollIntoViewIfNeeded(); await page.screenshot({path:'output/playwright/patrol-event-mobile.png'});
  const choosePromise=page.waitForResponse(r=>r.url().endsWith('/api/patrol/choose')&&r.request().method()==='POST');
  await page.locator('#patrol-choices button').first().click();const chosenResponse=await choosePromise,chooseBody=chosenResponse.request().postDataJSON(),chosen=await chosenResponse.json();
  const choiceRetry=await page.evaluate(async body=>{const res=await fetch('/api/patrol/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,state:await res.json()};},chooseBody);
  check(choiceRetry.status===200&&choiceRetry.state.eventCount===chosen.eventCount,'choice retry rewarded twice');
  await page.waitForFunction(()=>!document.querySelector('#patrol-roll').disabled||window.helpaniPatrol.state().completed);
  for(let turn=0;turn<8;turn++){
    const state=await page.evaluate(()=>helpaniPatrol.state());
    if(state.completed&&!state.pendingEvent)break;
    if(state.pendingEvent){await page.locator('#patrol-choices button').nth(turn%2).click();await page.waitForFunction(()=>!helpaniPatrol.state().pendingEvent);}
    else {await page.getByRole('button',{name:'掷骰前进',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden);}
  }
  const completed=await page.evaluate(()=>({patrol:helpaniPatrol.state(),habitat:helpaniWoodland.state()}));
  check(completed.patrol.completed&&completed.patrol.position===8&&completed.patrol.chapters.length===2,'route did not complete chapters');
  check(completed.habitat.inventory.filter(x=>x==='woodland-bridge').length===1,'bridge not awarded exactly once');
  check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'patrol mobile overflow');
  await page.setViewportSize({width:1440,height:900}); await page.locator('#wood-patrol-host').scrollIntoViewIfNeeded(); await page.screenshot({path:'output/playwright/patrol-completed-desktop.png'});
  await page.getByRole('button',{name:'把收获带回家 / 布置木道',exact:true}).click();
  await page.getByRole('button',{name:'连接木道 · 已拥有',exact:true}).click();await page.getByRole('button',{name:'连接两棵树',exact:false}).click();await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.bridge);
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='bridge',{},{timeout:60000});
  await page.getByRole('button',{name:'◎ 找找竹竹',exact:true}).click(); await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PNG',exact:true}).click();await(await downloadPromise).saveAs('output/playwright/竹竹-木道留影.png');
  await page.getByRole('button',{name:'保存到相册',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');await page.screenshot({path:'output/playwright/bridge-photo-desktop.png'});
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'退出相机',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().observations.some(x=>x.behavior==='bridge-cross'),{},{timeout:60000});
  await page.reload();await page.waitForFunction(()=>window.helpaniPatrol?.state()?.completed&&helpaniWoodland.state().layout.bridge);
  return {movingReloadRecovered:true,rollRetrySameResult:true,choiceRetryOneReward:true,completed,bridgeCrossObserved:true,reloadRetainedBridge:true};
}
