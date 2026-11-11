async (page) => {
  await page.goto('http://localhost:3110/woodland');
  await page.waitForFunction(()=>window.helpaniWoodland?.snapshot());
  const report=await page.evaluate(async()=>{
    const {WoodlandScene}=await import('/woodland-scene.js?contact-review='+Date.now());
    const frames=[], details=[];
    const surface={start:{x:1043,y:844},end:{x:1124,y:756}};
    const footContacts=(scene,actor)=>{
      const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d');const foot=[];let lastEllipse;
      const ellipse=ctx.ellipse.bind(ctx),fill=ctx.fill.bind(ctx);
      ctx.ellipse=(...args)=>{lastEllipse={args,matrix:ctx.getTransform()};return ellipse(...args);};
      ctx.fill=(...args)=>{if(['#39392d','#34382f'].includes(ctx.fillStyle)&&lastEllipse)foot.push({...lastEllipse,color:ctx.fillStyle});return fill(...args);};
      scene.drawAnimal(ctx,actor,scene.time);
      const dx=surface.end.x-surface.start.x,dy=surface.end.y-surface.start.y,len=Math.hypot(dx,dy),n={x:-dy/len,y:dx/len};
      return foot.map(({args,matrix},i)=>{const [x,y,rx,ry,rotation=0]=args,front=i%2===1,far=i<2;const cycle=(((actor.phase+(front?0:Math.PI)+(far?Math.PI:0))/(2*Math.PI))%1+1)%1;const cx=matrix.a*x+matrix.c*y+matrix.e,cy=matrix.b*x+matrix.d*y+matrix.f;const cc=Math.cos(rotation),ss=Math.sin(rotation),radiusFor=n=>Math.hypot(rx*((matrix.a*cc+matrix.c*ss)*n.x+(matrix.b*cc+matrix.d*ss)*n.y),ry*((-matrix.a*ss+matrix.c*cc)*n.x+(-matrix.b*ss+matrix.d*cc)*n.y));const radius=radiusFor(n);const support=[{x:900,y:868.4146341463414},surface.start,surface.end,{x:1340,y:756}];let closest;for(let j=1;j<support.length;j++){const from=support[j-1],to=support[j],sx=to.x-from.x,sy=to.y-from.y,span=Math.hypot(sx,sy),along=Math.max(0,Math.min(1,((cx-from.x)*sx+(cy-from.y)*sy)/(span*span))),px=from.x+along*sx,py=from.y+along*sy,d=Math.hypot(cx-px,cy-py),sn={x:-sy/span,y:sx/span};const sr=radiusFor(sn);if(!closest||d<closest.distance)closest={distance:d,contact:(cx-px)*sn.x+(cy-py)*sn.y+sr};}return{leg:(far?'far-':'near-')+(front?'front':'hind'),stance:cycle<.63,contactDistance:(cx-surface.start.x)*n.x+(cy-surface.start.y)*n.y+radius,actualSupportContactDistance:closest.contact};});
    };
    for(const [name,layout] of [['edge',{platform:'edge',bridge:false}],['trunk',{platform:'trunk',bridge:false}],['bridge',{platform:'trunk',bridge:true}]]){
      const c=document.createElement('canvas');c.width=1600;c.height=1000;const seen=new Set(),applied=[],observed=[];
      const scene=new WoodlandScene(c,{onLayoutApplied:v=>applied.push(v),onObserve:o=>observed.push(o)});scene.setPaused(true);scene.random=()=>.25;
      scene.updateLayout({revision:1,layout,appliedLayout:layout,layoutVersion:1,appliedVersion:1});
      let firstPlatform=null;
      for(let frame=0;frame<60*220;frame++){
        scene.time+=1/60;scene.advance(1/60);const a=scene.actor,s=a.segment;
        if(a.mode==='platform-rest'&&firstPlatform===null)firstPlatform=scene.time;
        let key;
        if(s&&a.elapsed/s.duration>.47&&a.elapsed/s.duration<.54){
          if(s.kind==='ramp')key=s.end.y<s.start.y?'ramp-up':'ramp-down';
          if(s.kind==='bridge')key='bridge-mid';
          if(s.kind==='climb'&&s.end.y>s.start.y)key='climb-down';
          if(a.node==='landing'&&s.endId==='trunk')key='high-approach';
          if(a.node==='trunk'&&s.endId==='landing')key='high-exit';
          if(a.node==='rampTop'&&s.endId==='edge')key='ramp-to-deck';
          if(a.node==='edge'&&s.endId==='rampTop')key='deck-to-ramp';
        }
        if(key&&!seen.has(key)){
          seen.add(key);const actor=structuredClone(a),frameState=scene.getFrame();frameState.camera={x:Math.max(400,Math.min(1200,a.x)),y:Math.max(250,Math.min(750,a.y-100)),zoom:2};
          frames.push({name:name+' / '+key,frame:frameState,scene});
          if(['ramp-up','ramp-down','ramp-to-deck','deck-to-ramp'].includes(key))details.push({layout:name,key,root:{x:a.x,y:a.y},angle:a.angle,feet:footContacts(scene,actor)});
        }
      }
      details.push({layout:name,firstPlatformUse:firstPlatform,observations:observed.map(o=>o.behavior),modes:[...seen]});
    }
    const support=document.createElement('canvas');support.width=1600;support.height=1000;const supportCtx=support.getContext('2d');frames[0].scene.drawPlatform(supportCtx,'trunk');const pixels=supportCtx.getImageData(0,0,1600,1000).data;
    const missingSupport=[];for(let x=610;x<=682;x+=4)if(pixels[(526*1600+x)*4+3]<128)missingSupport.push(x);
    if(missingSupport.length)throw new Error('High platform has an unsupported access span');
    for(const detail of details){
      if(detail.feet&&detail.feet.some(f=>f.stance&&Math.abs(f.actualSupportContactDistance)>7))throw new Error('Planted ramp paw exceeds 7px contact tolerance: '+JSON.stringify(detail));
      if(detail.firstPlatformUse!==undefined&&!(detail.firstPlatformUse<60))throw new Error('New platform is not used within 60 seconds');
    }
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=Math.ceil(frames.length/2)*550;const sc=sheet.getContext('2d');sc.fillStyle='#faf7ec';sc.fillRect(0,0,sheet.width,sheet.height);
    for(let i=0;i<frames.length;i++){const {name,scene,frame}=frames[i],tile=document.createElement('canvas');tile.width=800;tile.height=500;scene.paint(tile,frame,false,false);sc.drawImage(tile,i%2*800,Math.floor(i/2)*550);sc.fillStyle='#34513c';sc.font='20px sans-serif';sc.fillText(name,i%2*800+20,Math.floor(i/2)*550+530);}
    const image=document.createElement('img');image.id='contact-review-sheet';image.src=sheet.toDataURL();image.style.cssText='position:absolute;inset:0;width:1600px;max-width:none;height:auto;z-index:99999;background:#faf7ec';document.body.append(image);
    for(let i=0;i<frames.length;i++){const element=document.createElement('canvas');element.width=800;element.height=500;element.id='contact-frame-'+i;element.dataset.name=frames[i].name;element.style.cssText='display:none;position:absolute;left:0;top:0;width:800px;height:500px;z-index:100000';frames[i].scene.paint(element,frames[i].frame,false,false);document.body.append(element);}
    for(const scene of new Set(frames.map(f=>f.scene)))scene.destroy();
    return{details,missingHighSupportAtY526:missingSupport,frameLabels:frames.map(f=>f.name),sheetHeight:sheet.height};
  });
  await page.setViewportSize({width:1600,height:1000});await page.locator('#contact-review-sheet').screenshot({path:'output/playwright/contact-after.png'});while(await page.locator('canvas[id^=contact-frame-]').count()){const canvas=page.locator('canvas[id^=contact-frame-]').first();await canvas.evaluate(node=>node.style.display='block');const name=await canvas.getAttribute('data-name');await canvas.screenshot({path:'output/playwright/contact-'+name.replaceAll(' / ','-')+'-after.png'});await canvas.evaluate(node=>node.remove());}await page.evaluate(()=>document.querySelector('#contact-review-sheet').remove());
  return report;
}
