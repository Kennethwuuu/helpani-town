async (page) => {
  const assets=[['海龟','tidepool'],['小熊猫旧插画','red-panda'],['穿山甲','pangolin']];
  await page.setViewportSize({width:1800,height:1000});
  const report=await page.evaluate(async(assets)=>{
    const layer=document.createElement('section');layer.id='asset-layer-review';layer.style.cssText='position:absolute;inset:0;z-index:999999;background:#faf8ee;padding:16px;font-family:sans-serif;color:#234d38;';
    const title=document.createElement('h1');title.textContent='原插画 / 无角色背景 / 独立角色 / 分层合成';title.style.cssText='font-size:24px;margin:5px 0 15px';layer.append(title);
    const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:12px;';layer.append(grid);document.body.append(layer);
    const rows=[];
    for(const [name,base] of assets){
      const load=async(path)=>{const img=new Image();img.src=path;await img.decode();return img;};
      const original=await load(`/${base}.svg`),habitat=await load(`/${base}-habitat.svg`),pet=await load(`/${base}-pet.svg`);
      const paths=[`/${base}.svg`,`/${base}-habitat.svg`,`/${base}-pet.svg`,'habitat + pet'];
      for(let column=0;column<4;column++){
        const card=document.createElement('article'),heading=document.createElement('p'),canvas=document.createElement('canvas');
        heading.textContent=`${name} · ${paths[column]}`;heading.style.cssText='font-size:13px;margin:0 0 5px';canvas.width=900;canvas.height=440;canvas.style.cssText='display:block;width:100%;aspect-ratio:900/440;border:1px solid #d1d5c4;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/20px 20px';
        const ctx=canvas.getContext('2d');
        const draw=(img)=>{const scale=Math.min(900/img.naturalWidth,440/img.naturalHeight);ctx.drawImage(img,0,(440-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);};
        if(column<3)draw([original,habitat,pet][column]);else{draw(habitat);draw(pet);}
        card.append(heading,canvas);grid.append(card);
      }
      rows.push({animal:name,original:`/${base}.svg`,background:`/${base}-habitat.svg`,sprite:`/${base}-pet.svg`,dimensions:[original.naturalWidth,original.naturalHeight],allDecoded:true});
    }
    return rows;
  },assets);
  await page.locator('#asset-layer-review').screenshot({path:'output/playwright/asset-layer-review-20261110.png'});
  return report;
}
