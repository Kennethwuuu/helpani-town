async (page) => {
  page.setDefaultTimeout(20000);
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:900});
  const original=await page.evaluate(async()=>await(await fetch('/api/state')).json());
  await page.getByRole('link',{name:'试玩平台布置 →',exact:true}).click();
  await page.waitForFunction(()=>window.helpaniWoodland?.state()&&!document.querySelector('#wood-placement').hidden);
  await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
  await page.getByRole('button',{name:'取消预览',exact:true}).click();
  check(await page.evaluate(()=>helpaniWoodland.state().layout.platform===null),'cancel changed saved layout');
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
  const start=await page.evaluate(()=>Date.now());
  await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.platform==='trunk');
  check(await page.evaluate(()=>helpaniWoodland.state().growth.length===1),'construction not immediate');
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='platform-rest'&&helpaniWoodland.state().observations.some(x=>x.behavior==='platform-rest'),{},{timeout:60000});
  const firstUseMs=await page.evaluate(s=>Date.now()-s,start);
  await page.locator('#wood-canvas').screenshot({path:'output/playwright/20261109/first-platform.png'});
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click();
  await page.getByRole('button',{name:'◎ 找找竹竹',exact:true}).click();
  await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);
  const previewHash=await page.evaluate(async()=>{const data=await(await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PNG',exact:true}).click();await(await download).saveAs('output/playwright/20261109/first-photo.png');
  await page.getByRole('button',{name:'保存到相册',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'退出相机',exact:true}).click();
  await page.getByRole('combobox',{name:'这次想找什么？'}).selectOption('habitat');
  await page.getByRole('button',{name:'出发巡护',exact:true}).click();await page.waitForFunction(()=>window.helpaniPatrol.state().runId);
  for(let operation=0;operation<16;operation++){
    const state=await page.evaluate(()=>helpaniPatrol.state());
    if(state.completed&&!state.pendingEvent)break;
    if(state.pendingEvent){await page.locator('#patrol-choices button').nth(operation%2).click();await page.waitForFunction(()=>!helpaniPatrol.state().pendingEvent);}
    else{await page.getByRole('button',{name:'掷骰前进',exact:true}).click();await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden);}
  }
  const patrol=await page.evaluate(()=>helpaniPatrol.state());
  check(patrol.completed&&patrol.chapters.length===2,'route did not complete');
  await page.getByRole('button',{name:'把收获带回家 / 布置木道',exact:true}).click();
  await page.getByRole('button',{name:'连接木道 · 已拥有',exact:true}).click();await page.getByRole('button',{name:'连接两棵树',exact:false}).click();await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.bridge);
  await page.waitForFunction(()=>helpaniWoodland.state().observations.some(x=>x.behavior==='bridge-cross'),{},{timeout:60000});
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click();await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);
  await page.getByRole('button',{name:'保存到相册',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'退出相机',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.helpaniPatrol?.state()?.completed&&helpaniWoodland.state().layout.bridge);
  await page.getByRole('button',{name:'▧ 打开我的相册',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#wood-album-grid button').length===2);
  await page.locator('#wood-album-grid button').last().click();await page.waitForFunction(()=>document.querySelector('#wood-photo-preview').complete);
  const albumHash=await page.evaluate(async()=>{const data=await(await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');});
  check(albumHash===previewHash,'reopened photo differs');
  await page.screenshot({path:'output/playwright/20261109/reopened-album.png'});
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'关闭相册',exact:true}).click();
  const final=await page.evaluate(async()=>({town:await(await fetch('/api/state')).json(),habitat:helpaniWoodland.state()}));
  check(JSON.stringify(final.town)===JSON.stringify(original),'new game changed original wallet/care');check(errors.length===0,'page errors: '+errors.join(','));
  return {firstUseMs,chapters:patrol.chapters.length,patrolEvents:patrol.eventCount,bridgeCrossed:true,photos:2,previewHash,albumHash,originalProgressUnchanged:true,pageErrors:errors};
}
