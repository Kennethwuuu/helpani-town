async (page) => {
  await page.goto('http://localhost:3000/woodland');
  await page.waitForFunction(()=>window.helpaniWoodland?.snapshot());
  const sheet = await page.evaluate(async()=>{
    const {WoodlandScene}=await import('/woodland-scene.js');
    const poses=[
      ['Walking right',1,0,'walk',1],['Walking left',-1,0,'walk',1],['Facing forward',0,0,'walk',1],
      ['Turning right',.3,0,'walk',1],['Turning left',-.3,0,'walk',1],['Sniffing',1,0,'sniff',2],
      ['Settling',1,.6,'settle',2],['Eyes closing',1,.8,'settle',2],['Resting',1,1,'platform-rest',2],
      ['Posture 0.74',1,.74,'settle',2],['Posture 0.76',1,.76,'settle',2],['Resting left',-1,1,'platform-rest',2],
    ];
    const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1440;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#faf6ea';ctx.fillRect(0,0,canvas.width,canvas.height);
    poses.forEach(([label,facing,posture,mode,time],i)=>{
      const col=i%3,row=Math.floor(i/3),x=col*600,y=row*360;
      ctx.save();ctx.translate(x+300,y+228);ctx.scale(3.7,3.7);
      WoodlandScene.prototype.drawHead.call({},ctx,{facing,posture,mode,phase:1.2,segment:mode==='walk'?{}:null},time);
      ctx.restore();ctx.fillStyle='#3b5140';ctx.font='20px sans-serif';ctx.fillText(label,x+24,y+334);
      ctx.strokeStyle='#ddd9c9';ctx.strokeRect(x,y,600,360);
    });
    const image=document.createElement('img');image.id='head-review-sheet';image.src=canvas.toDataURL();image.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#faf6ea;z-index:9999';document.body.append(image);
    return {width:canvas.width,height:canvas.height};
  });
  await page.setViewportSize({width:1500,height:1200});
  await page.locator('#head-review-sheet').screenshot({path:'output/playwright/panda-head-poses.png'});
  await page.evaluate(()=>document.querySelector('#head-review-sheet').remove());
  return {headPoseSheet:sheet};
}
