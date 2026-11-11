async (page) => {
  const origin=page.url().split('/').slice(0,3).join('/');
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {CompanionScene}=await import('/companion-scene.js?review='+Date.now());
    const cases=[['pangolin','root-den','leaf-bed'],['pangolin','leaf-bed','root-den'],['sea-turtle','seagrass','rock-shelf'],['sea-turtle','rock-shelf','seagrass']];
    const reports=[],frames=[];
    for(const[species,slot,target]of cases){
      const c=document.createElement('canvas');c.width=1600;c.height=1000;
      const applies=[],observations=[],scene=new CompanionScene(c,{species,onLayoutApplied:v=>applies.push({version:v,node:scene.actor.node,mode:scene.actor.mode}),onObserve:o=>observations.push(o)});
      scene.setPaused(true);scene.random=()=>.25;
      scene.updateLayout({layoutVersion:1,appliedVersion:0,layout:{platform:slot,bridge:false}});
      const rest=species==='pangolin'?'shelter-rest':'ledge-rest';
      let useTime=null,maxStep=0;const modes=new Set();
      const advance=()=>{const before={x:scene.actor.x,y:scene.actor.y};scene.time+=1/60;scene.advance(1/60);maxStep=Math.max(maxStep,Math.hypot(before.x-scene.actor.x,before.y-scene.actor.y));modes.add(scene.actor.mode);};
      for(let i=0;i<60*45;i++){advance();if(scene.actor.mode===rest){useTime=scene.time;break;}}
      if(useTime===null)throw new Error(species+' '+slot+': facility not used within 45 seconds');
      const beforeInteraction={x:scene.actor.x,y:scene.actor.y};scene.interact('touch');advance();
      if(scene.effect.kind!=='touch'||scene.actor.x!==beforeInteraction.x||scene.actor.y!==beforeInteraction.y)throw new Error('Touch moved the animal from its facility');
      const frozen=scene.getFrame(),photo=scene.capture({watermark:false}),a=photo.getContext('2d').getImageData(0,0,1600,1000).data;
      frames.push({name:species+' / '+slot,frame:frozen,scene});
      scene.updateLayout({layoutVersion:2,appliedVersion:1,layout:{platform:target,bridge:false}});
      if(scene.layoutVersion!==1||scene.layout.platform!==slot)throw new Error('Occupied facility disappeared immediately');
      scene.updateLayout({layoutVersion:1,appliedVersion:1,layout:{platform:slot,bridge:false}});
      let appliedAt=null,nextUse=null;
      for(let i=0;i<60*160;i++){advance();if(scene.layoutVersion===2&&!appliedAt)appliedAt={time:scene.time,node:scene.actor.node,mode:scene.actor.mode};if(scene.layoutVersion===2&&scene.actor.mode===rest&&scene.actor.node===target&&!nextUse)nextUse=scene.time;}
      if(!appliedAt||!nextUse||appliedAt.node===slot)throw new Error(species+': unsafe or unreachable pending facility');
      if(applies.filter(x=>x.version===2).length!==1)throw new Error('Layout version was applied more than once');
      if(observations.filter(o=>o.behavior===rest&&o.layoutVersion===2).length!==1)throw new Error('First use callback duplicated or missing');
      const again=document.createElement('canvas');again.width=1600;again.height=1000;scene.paint(again,frozen,false,false);const b=again.getContext('2d').getImageData(0,0,1600,1000).data;let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
      if(changed)throw new Error('Frozen photograph changed after layout/activity: '+changed);
      scene.interact('feed');if(scene.snapshot().interaction!=='feed')throw new Error('Feed feedback is unavailable');
      if(maxStep>6)throw new Error('A navigation endpoint jumped by '+maxStep);
      const expected=species==='pangolin'?['walk','dig','curled-rest']:['swim','surface'];
      if(expected.some(mode=>!modes.has(mode)))throw new Error('Missing autonomous mode '+[...modes]);
      reports.push({species,slot,firstUseSeconds:useTime,pendingAppliedAt:appliedAt,nextUseSeconds:nextUse,applyVersion2Count:applies.filter(x=>x.version===2).length,firstUseVersion2Count:observations.filter(o=>o.behavior===rest&&o.layoutVersion===2).length,frozenPixelChanges:changed,maxFrameMove:maxStep,modes:[...modes],touchAndFeed:true});
    }
    const sheet=document.createElement('canvas');sheet.id='companion-review-sheet';sheet.width=1600;sheet.height=1100;sheet.style.cssText='position:absolute;inset:0;z-index:1000;width:1600px;height:1100px;background:#f7f4e8';const ctx=sheet.getContext('2d');ctx.fillStyle='#f7f4e8';ctx.fillRect(0,0,1600,1100);
    for(let i=0;i<frames.length;i++){const tile=document.createElement('canvas');tile.width=800;tile.height=500;frames[i].scene.paint(tile,frames[i].frame,false,false);ctx.drawImage(tile,(i%2)*800,Math.floor(i/2)*550);ctx.fillStyle='#34553d';ctx.font='19px sans-serif';ctx.fillText(frames[i].name,(i%2)*800+20,Math.floor(i/2)*550+530);}
    document.body.append(sheet);for(const{scene}of frames)scene.destroy();
    return{cases:reports,passed:reports.length};
  });
  await page.setViewportSize({width:1600,height:1100});await page.locator('#companion-review-sheet').screenshot({path:'output/playwright/companion-scenes/facility-poses.png'});
  await page.evaluate(()=>document.querySelector('#companion-review-sheet').remove());
  return result;
}
