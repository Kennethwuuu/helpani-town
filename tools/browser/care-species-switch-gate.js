async (page) => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const before=await page.evaluate(async()=>{const {listPhotos}=await import('/woodland-album.js?v=20261110-unified-care');const photos=await listPhotos();const old=photos.find(x=>x.species==='red-panda');if(!old)throw new Error('Run the desktop care gate first');const buffer=await old.blob.arrayBuffer();return{hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join('')};});
  await page.evaluate(async()=>{
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
    const send=async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(await r.text());return r.json();};
    let state=await(await fetch('/api/state')).json();
    while(state.pet.feedCount<6){if(state.pet.feedsToday>=2||(state.food<1&&!state.checkInAvailable))state=await send('/api/demo/next-day',{day:state.gameDay});if(state.food<1)state=await send('/api/pet/check-in',{day:state.gameDay});state=await send('/api/pet/feed',{day:state.gameDay,slot:state.pet.feedsToday+1,species:'red-panda'});}
    await send('/api/pet/medal',{species:'red-panda'});window.__switchProof=true;location.assign('/?choose=next#playroom');
  });
  await page.waitForFunction(()=>!window.__switchProof&&window.helpaniView?.state?.pet?.species==='red-panda'&&!document.querySelector('#adoption-panel').hidden);
  await page.locator('[data-adopt=pangolin]').click();await page.waitForFunction(()=>window.helpaniWoodland?.ready()&&helpaniWoodland.species()==='pangolin');
  const separated=await page.evaluate(async()=>{const get=async species=>await(await fetch('/api/habitat/state?species='+species)).json();return{panda:(await get('red-panda')).layout.platform,pangolin:(await get('pangolin')).layout.platform,turtle:(await get('sea-turtle')).layout.platform};});
  check(separated.panda==='edge'&&separated.pangolin===null&&separated.turtle===null,'Switching companions reused another habitat');
  await page.locator('#wood-arrange').click();await page.locator('[data-slot=leaf-bed]').click();await page.locator('#wood-confirm').click();
  await page.waitForFunction(()=>helpaniWoodland.state().observations.some(x=>x.behavior==='shelter-rest'),{},{timeout:60000});
  await page.locator('#wood-camera').click();await page.locator('#wood-shutter').click();await page.waitForFunction(()=>!document.querySelector('#wood-photo-save').disabled);await page.locator('#wood-photo-save').click();await page.waitForFunction(()=>document.querySelector('#wood-photo-save').textContent==='已保存');
  await page.locator('#wood-photo-close').click();await page.locator('#wood-camera-exit').click();await page.locator('#wood-album').click();
  await page.waitForFunction(()=>document.querySelectorAll('#wood-album-grid button').length===2);
  check(await page.locator('#wood-album-grid button').count()===2,'Switching lost the old photo or duplicated the new one');
  const labels=await page.locator('#wood-album-grid button span').allTextContents();check(labels[0].includes('中华穿山甲')&&labels[1].includes('小熊猫'),'Album species labels are mixed');
  await page.locator('#wood-album-grid button').last().click();await page.waitForFunction(()=>document.querySelector('#wood-photo-preview').complete);
  const old=await page.evaluate(async()=>{const buffer=await(await fetch(document.querySelector('#wood-photo-preview').src)).arrayBuffer();return{hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(x=>x.toString(16).padStart(2,'0')).join(''),title:document.querySelector('#wood-photo-title').textContent};});
  check(old.hash===before.hash&&old.title==='竹影林留影','Old panda image/title changed to the active companion');
  await page.screenshot({path:'output/playwright/unified-care/old-panda-photo-after-switch.png'});
  return{companionSwitch:true,habitatsSeparated:separated,newPangolinFacilityUsed:true,albumPhotos:2,photoSpeciesLabels:labels,oldPandaPhotoPreserved:true,oldPhotoSHA256:old.hash,oldPhotoTitle:old.title};
}
