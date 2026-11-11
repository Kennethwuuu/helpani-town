async (page) => {
  await page.waitForFunction(()=>window.helpaniView?.state);
  await page.evaluate(async()=>{
    const post=async(path,body)=>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(await response.text());return response.json();};
    let state=await(await fetch('/api/state')).json();
    if(!state.pet)state=await post('/api/pet/adopt',{species:'sea-turtle',previousSpecies:null});
    while(state.pet.feedCount<6){
      if(state.pet.feedsToday>=2||(state.food<1&&!state.checkInAvailable))state=await post('/api/demo/next-day',{day:state.gameDay});
      if(state.food<1)state=await post('/api/pet/check-in',{day:state.gameDay});
      state=await post('/api/pet/feed',{species:'sea-turtle',slot:state.pet.feedsToday+1,day:state.gameDay});
    }
    if(!state.medals.includes('sea-turtle'))await post('/api/pet/medal',{species:'sea-turtle'});
  });
  const origin=page.url().split('/').slice(0,3).join('/');
  await page.goto(origin+'/?choose=next',{waitUntil:'domcontentloaded'});
  await page.locator('[data-adopt=pangolin]').waitFor();
  let release,received,finished,delayed=false;
  const hold=new Promise(resolve=>release=resolve),intercepted=new Promise(resolve=>received=resolve),settled=new Promise(resolve=>finished=resolve);
  await page.route('**/api/state',async route=>{if(delayed){await route.continue();return;}delayed=true;const old=await route.fetch();received();await hold;await route.fulfill({response:old});finished();});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await intercepted;
  await page.locator('[data-adopt=pangolin]').click();
  await page.waitForFunction(()=>document.querySelector('#pet-name').textContent==='小松');
  release();await settled;await page.unroute('**/api/state');await page.waitForTimeout(300);
  const result=await page.evaluate(async()=>({server:(await(await fetch('/api/state')).json()).pet.species,view:window.helpaniView.state.pet.species,label:document.querySelector('#pet-species').textContent,background:document.querySelector('#pet-image').getAttribute('src'),sprite:document.querySelector('#pet-sprite').getAttribute('src')}));
  await page.locator('#playroom').screenshot({path:'output/playwright/adoption-20261110/race-review.png'});
  if(result.server!==result.view)throw new Error('Stale GET overwrote newly adopted partner: '+JSON.stringify(result));
  return result;
}
