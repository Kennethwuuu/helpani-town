async (page) => {
  await page.goto('http://localhost:3000/woodland?look=profile-mouth');
  await page.waitForFunction(()=>window.helpaniWoodland?.snapshot());
  return await page.evaluate(async()=>{
    const {WoodlandScene}=await import('/woodland-scene.js');
    const colors=new Set(['245,233,209','47,54,45','102,84,61']);
    const samples=[];
    for(const facing of [-1,-.75,-.3,0,.3,.75,1])for(const posture of [0,.6,1]){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=280;const ctx=canvas.getContext('2d');
      let outline;
      const fill=ctx.fill.bind(ctx);
      ctx.fill=(...args)=>{if(ctx.fillStyle instanceof CanvasGradient&&args[0] instanceof Path2D)outline={path:args[0],matrix:ctx.getTransform()};fill(...args);};
      ctx.translate(140,140);ctx.scale(3,3);
      WoodlandScene.prototype.drawHead.call({},ctx,{facing,posture,mode:'sniff',phase:0,segment:null},1);
      const mask=document.createElement('canvas');mask.width=mask.height=280;const mc=mask.getContext('2d');mc.setTransform(outline.matrix);mc.fillStyle='#fff';mc.fill(outline.path);
      const pixels=ctx.getImageData(0,0,280,280).data,face=mc.getImageData(0,0,280,280).data;let mouthPixels=0,outside=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>240&&colors.has(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`)){mouthPixels++;if(face[i+3]<128)outside++;}
      samples.push({facing,posture,mouthPixels,outside});
    }
    const totalOutside=samples.reduce((sum,s)=>sum+s.outside,0);
    if(totalOutside>0)throw new Error('Mouth pixels outside face: '+totalOutside);
    if(samples.some(sample=>sample.mouthPixels===0))throw new Error('Mouth drawing disappeared');
    return {poses:samples.length,totalOutside,samples};
  });
}
