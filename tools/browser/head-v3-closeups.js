async (page) => {
  await page.goto('http://localhost:3000/woodland?look=head-v3');
  await page.waitForFunction(()=>window.helpaniWoodland?.snapshot());
  const versionedRenderer=await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('woodland-scene.js?v=20261108-head-v3')));
  if(!versionedRenderer)throw new Error('Page did not load the revised renderer');
  await page.evaluate(async()=>{
    const {WoodlandScene}=await import('/woodland-scene.js?v=20261108-head-v3');
    const canvas=document.createElement('canvas');canvas.width=1320;canvas.height=410;const ctx=canvas.getContext('2d');ctx.fillStyle='#faf6ea';ctx.fillRect(0,0,1320,410);
    [[1,'侧脸'],[0,'正脸'],[-1,'另一侧']].forEach(([facing,label],i)=>{
      ctx.save();ctx.translate(i*440+220,230);ctx.scale(4.1,4.1);
      WoodlandScene.prototype.drawHead.call({},ctx,{facing,posture:0,mode:'sniff',phase:0,segment:null},0);ctx.restore();
      ctx.fillStyle='#38543e';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(label,i*440+220,380);
    });
    const img=document.createElement('img');img.id='head-v3-closeups';img.src=canvas.toDataURL();img.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#faf6ea;z-index:9999';document.body.append(img);
  });
  await page.setViewportSize({width:1320,height:410});await page.locator('#head-v3-closeups').screenshot({path:'output/playwright/panda-head-v3-closeups.png'});
  await page.evaluate(()=>document.querySelector('#head-v3-closeups').remove());
  return {newRendererLoaded:true,closeups:'output/playwright/panda-head-v3-closeups.png'};
}
