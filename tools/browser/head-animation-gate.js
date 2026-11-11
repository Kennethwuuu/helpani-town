async (page) => {
  await page.goto('http://localhost:3000/woodland');
  await page.waitForFunction(()=>window.helpaniWoodland?.snapshot());
  const result=await page.evaluate(async()=>{
    const {WoodlandScene}=await import('/woodland-scene.js');
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
    const simulation=new WoodlandScene(canvas);simulation.setPaused(true);
    simulation.updateLayout({revision:1,layout:{platform:'trunk',bridge:false},appliedLayout:{platform:'trunk',bridge:false},layoutVersion:1,appliedVersion:1});
    const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1200;const ctx=sheet.getContext('2d');ctx.fillStyle='#f8f5e9';ctx.fillRect(0,0,1800,1200);
    const states=new Map();
    for(let i=0;i<3600;i++){
      simulation.time+=1/60;simulation.advance(1/60);
      const a=simulation.actor;
      const type=Math.abs(a.facing)<.5?'Turning':a.mode==='walk'?'Walking':a.mode==='climb'&&a.elapsed>1&&Math.abs(a.angle)>1?'Climbing':a.mode==='settle'&&a.posture>.4?'Lying down':a.mode==='platform-rest'?'Resting':a.mode==='rise'&&a.posture<.6?'Getting up':null;
      if(type&&!states.has(type))states.set(type,structuredClone(a));
      if(states.size===6)break;
    }
    // Check the actual renderer on either side of facing zero. We intercept its
    // head-local transform, so a parent-mirror regression is detected too.
    const centers=[];const original=simulation.drawHead;
    simulation.drawHead=function(context,actor,time){const t=context.getTransform();centers.push({x:t.e,y:t.f});return original.call(this,context,actor,time);};
    const crossing={...simulation.actor,x:800,y:500,angle:0,posture:0,mode:'walk',segment:{},facing:.001};
    simulation.drawAnimal(ctx,crossing,1);simulation.drawAnimal(ctx,{...crossing,facing:-.001},1);
    const seam=Math.hypot(centers[0].x-centers[1].x,centers[0].y-centers[1].y);
    if(seam>.2)throw new Error('Head still snaps across facing zero: '+seam);
    simulation.drawHead=original;ctx.fillStyle='#f8f5e9';ctx.fillRect(0,0,1800,1200);
    const entries=[...states];
    entries.forEach(([label,actor],i)=>{const x=(i%3)*600,y=Math.floor(i/3)*600;
      ctx.save();ctx.beginPath();ctx.rect(x,y,600,600);ctx.clip();ctx.translate(x+310,y+(label==='Climbing'?260:340));ctx.scale(label==='Climbing'?1.5:2,label==='Climbing'?1.5:2);
      simulation.drawAnimal(ctx,{...actor,x:0,y:0},2);ctx.restore();
      ctx.fillStyle='#35503b';ctx.font='23px sans-serif';ctx.fillText(label,x+24,y+560);ctx.strokeStyle='#dfdac8';ctx.strokeRect(x,y,600,600);
    });
    if(entries.length<6)throw new Error('Incomplete autonomous animation coverage: '+entries.map(x=>x[0]).join(','));
    const img=document.createElement('img');img.id='head-animation-sheet';img.src=sheet.toDataURL();img.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#f8f5e9;z-index:9999';document.body.append(img);
    simulation.destroy();
    return {autonomousStates:entries.map(x=>x[0]),headCenterShiftAcrossTurn:seam};
  });
  await page.setViewportSize({width:1500,height:1000});await page.locator('#head-animation-sheet').screenshot({path:'output/playwright/panda-head-full-animation.png'});
  await page.evaluate(()=>document.querySelector('#head-animation-sheet').remove());
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'◉ 打开相机',exact:true}).click();
  await page.waitForFunction(()=>helpaniWoodland.snapshot().mode==='walk',{},{timeout:60000});
  await page.getByRole('button',{name:'◎ 找找竹竹',exact:true}).click();
  await page.getByRole('button',{name:'放大镜头',exact:true}).click();
  await page.getByRole('button',{name:'拍下这一刻',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#wood-photo-download').disabled);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载 PNG',exact:true}).click();await(await download).saveAs('output/playwright/panda-head-fixed-gameplay.png');
  await page.getByRole('button',{name:'关闭照片',exact:true}).click();await page.getByRole('button',{name:'退出相机',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'◎ 找找竹竹',exact:true}).click();await page.locator('#wood-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/panda-head-fixed-mobile.png'});
  return {...result,desktopCameraExport:true,mobileRendered:true};
}
