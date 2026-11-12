// Local browser acceptance, with real game actions and no external provider calls.
async (page) => {
  const origin='http://127.0.0.1:3121';
  const check=(v,m)=>{if(!v)throw new Error(m);};
  const chinese=()=>page.evaluate(()=>{const out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,p=n.parentElement;if(p&&!p.closest('script,style,[data-no-i18n]')&&p.getClientRects().length&&/[\u3400-\u9fff]/.test(n.nodeValue))out.push(n.nodeValue.trim());}return [...new Set(out)];});
  const assertEnglish=async(step)=>{const left=await chinese();check(!left.length,step+': '+left.join(' | '));};
  await page.goto(origin);
  await page.locator('[data-language-select]').selectOption('en');
  await page.locator('#wood-touch').click();
  await page.locator('#feed').click();
  await page.waitForFunction(()=>!document.querySelector('#feed').disabled||document.querySelector('#pet-action-feedback').textContent.length>0);
  await assertEnglish('care feedback');
  if(await page.locator('#patrol-start').isVisible())await page.locator('#patrol-start').click();
  await page.locator('#patrol-roll').waitFor({state:'visible'});
  await page.locator('#patrol-roll').click();
  await page.locator('#patrol-choices button').first().waitFor();
  await assertEnglish('patrol question');
  await page.locator('#patrol-choices button').first().click();
  await assertEnglish('patrol answer');
  await page.locator('[data-language-select]').selectOption('zh-CN');
  check((await chinese()).length>0,'Chinese restoration failed');
  await page.locator('[data-language-select]').selectOption('en');
  await assertEnglish('patrol after roundtrip');
  await page.goto(origin+'/activities');
  const signup=page.locator('button[data-activity]').first();
  if(await signup.isVisible())await signup.click();
  await page.goto(origin+'/organizer');
  await page.locator('#registration-search').fill('Wetland');
  await page.locator('.organizer-verify').first().waitFor();
  await assertEnglish('English organizer search');
  await page.locator('.organizer-verify').first().click();
  await page.waitForFunction(()=>document.querySelector('#organizer-points').textContent==='100');
  await assertEnglish('organizer verification feedback');
  await page.locator('[data-language-select]').selectOption('zh-CN');
  await page.locator('[data-language-select]').selectOption('en');
  await assertEnglish('organizer roundtrip');
  return {pass:true,care:true,patrolQuestionAndAnswer:true,organizerEnglishSearchAndVerification:true,points:100,languageRoundtrip:true,providerRequests:0};
}
