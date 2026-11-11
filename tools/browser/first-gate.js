async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
  await page.getByRole('button',{name:'取消预览',exact:true}).click();
  check(await page.evaluate(()=>helpaniWoodland.state().layout.platform===null),'cancel changed layout');
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'树干旁 · 高枝',exact:false}).click();
  await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.platform==='trunk');
  check(await page.evaluate(()=>helpaniWoodland.state().growth.length===1),'construction not immediate');
  await page.locator('#wood-canvas').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='platform-rest',{},{timeout:60000});
  await page.getByRole('button',{name:'暂停活动',exact:true}).click();
  await page.locator('#wood-canvas').screenshot({path:'output/playwright/platform-trunk.png'});
  console.log('HIGH PLATFORM',await page.evaluate(()=>({scene:helpaniWoodland.snapshot(),state:helpaniWoodland.state()})));
  await page.getByRole('button',{name:'休息平台 · 已拥有',exact:true}).click();
  await page.getByRole('button',{name:'林缘边 · 低台',exact:false}).click();
  await page.getByRole('button',{name:'确认布置',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.state().layout.platform==='edge');
  check(await page.evaluate(()=>helpaniWoodland.snapshot().layout.platform==='trunk'&&helpaniWoodland.state().layout.platform==='edge'&&helpaniWoodland.state().pending),'occupied platform moved immediately');
  const pending=await page.evaluate(()=>helpaniWoodland.state());
  await page.getByRole('button',{name:'继续活动',exact:true}).click();
  return {cancelPreservedLayout:true,highPlatformAutonomousUse:true,pendingOccupiedMove:pending};
}
