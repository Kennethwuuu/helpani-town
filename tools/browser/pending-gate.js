async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
  await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.platform==='trunk');
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='platform-rest'&&helpaniWoodland.snapshot().layout.platform==='trunk',{},{timeout:60000});
  await page.getByRole('button',{name:'暂停活动',exact:true}).click();
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'林缘边 · 低台',exact:false}).click();
  await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.platform==='edge');
  const pending=await page.evaluate(()=>({scene:helpaniWoodland.snapshot(),state:helpaniWoodland.state()}));
  check(pending.scene.layout.platform==='trunk'&&pending.state.pending,'occupied platform disappeared');
  check(pending.state.growth.length===1,'growth duplicated');
  await page.reload(); await page.waitForFunction(()=>window.helpaniWoodland?.state()?.appliedLayout.platform==='edge');
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click(); await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);
  await page.evaluate(()=>{window.originalIDBTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(){throw new DOMException('验收模拟：存储空间不足','QuotaExceededError');};});
  await page.getByRole('button',{name:'保存到相册',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#wood-photo-message').textContent.includes('保存失败'));
  check(await page.locator('#wood-photo-preview').isVisible(),'failure lost preview');
  await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.originalIDBTransaction;});
  await page.getByRole('button',{name:'保存到相册',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');
  await page.getByRole('button',{name:'关闭照片',exact:true}).click(); await page.getByRole('button',{name:'退出相机',exact:true}).click();
  return {pendingOccupiedMove:pending,pendingReloadRecovered:true,storageFailureRetainedPreview:true,storageRetrySaved:true};
}
