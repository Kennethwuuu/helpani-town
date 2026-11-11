async (page) => {
  page.setDefaultTimeout(20000);
  const check=(value,message)=>{if(!value)throw new Error(message);};
  const correct={'tail-balance':'b','dusk-activity':'a','bamboo-energy':'c','panda-family':'b','wildlife-watching':'a','forest-links':'c'};
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>window.helpaniPatrol?.state());
  const beforeTown=await page.evaluate(async()=>await(await fetch('/api/state')).json());
  check(!(await page.evaluate(()=>helpaniPatrol.state().runId)),'Use a fresh browser session for quiz-gate');
  await page.getByRole('combobox',{name:'这次想找什么？'}).selectOption('rest');
  await page.getByRole('button',{name:'出发巡护',exact:true}).click();
  await page.waitForFunction(()=>helpaniPatrol.state().runId);
  const roll=async()=>{
    const next=page.locator('#patrol-next');
    if(await next.isVisible())await next.click();else await page.getByRole('button',{name:'掷骰前进',exact:true}).click();
    await page.waitForFunction(()=>helpaniPatrol.state().pendingEvent&&!document.querySelector('#patrol-event').hidden&&!document.querySelector('#patrol-choices button').disabled);
    return page.evaluate(()=>helpaniPatrol.state().pendingEvent);
  };
  let event=await roll();
  check(event.kind==='quiz'&&event.choices.length===3,'Expected three quiz choices');
  check(!('correctChoiceId' in event)&&!('explanation' in event)&&!('source' in event),'Pending event leaked the answer');
  const pendingBefore=JSON.stringify(event);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.helpaniPatrol?.state()?.pendingEvent);
  check(await page.evaluate(value=>JSON.stringify(helpaniPatrol.state().pendingEvent)===value,pendingBefore),'Reload replaced a pending question or its answer order');
  await page.locator('#patrol-event').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/quiz/desktop-question.png'});
  const answer=async(isCorrect)=>{
    const current=await page.evaluate(()=>helpaniPatrol.state().pendingEvent);
    const index=current.choices.findIndex(choice=>(choice.id===correct[current.questionId])===isCorrect);
    const request=page.waitForRequest(request=>request.url().endsWith('/api/patrol/choose')&&request.method()==='POST');
    await page.locator('#patrol-choices button').nth(index).click();
    const body=(await request).postDataJSON();
    await page.waitForFunction(()=>!helpaniPatrol.state().pendingEvent&&helpaniPatrol.state().lastResult?.quiz&&!document.querySelector('#patrol-result').hidden);
    const state=await page.evaluate(()=>helpaniPatrol.state());
    check(state.lastResult.quiz.correct===isCorrect,'Wrong answer verdict');
    check(await page.locator('#patrol-quiz-feedback').isVisible(),'Quiz explanation is hidden');
    check(await page.locator('#patrol-quiz-feedback .patrol-fact-answer').textContent()===state.lastResult.quiz.correctAnswer,'UI shows a different correct answer');
    check(await page.locator('#patrol-quiz-feedback .patrol-fact-source a').getAttribute('href')===state.lastResult.quiz.source.url,'Source link is missing or incorrect');
    check(await page.locator('#patrol-quiz-feedback .patrol-observation-prompt').isVisible(),'No observation connection');
    return {state,body};
  };
  const wrong=await answer(false);
  await page.locator('#patrol-result').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/quiz/desktop-wrong-answer.png'});
  const retried=await page.evaluate(async body=>{
    const post=async data=>{const response=await fetch('/api/patrol/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,state:await response.json()};};
    const same=await post(body),doubleClick=await post({...body,requestId:crypto.randomUUID()});
    return {same,doubleClick};
  },wrong.body);
  check(retried.same.status===200&&retried.doubleClick.status===200,'Retry was not idempotent');
  for(const response of [retried.same,retried.doubleClick])check(response.state.eventCount===wrong.state.eventCount&&response.state.knowledge.length===1&&response.state.medals.length===wrong.state.medals.length,'Duplicate answer changed rewards or knowledge');
  const conflict=await page.evaluate(async({body,other})=>{
    const response=await fetch('/api/patrol/choose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId:crypto.randomUUID(),choiceId:other})});return response.status;
  },{body:wrong.body,other:event.choices.find(choice=>choice.id!==wrong.body.choiceId).id});
  check(conflict===409,'A settled question accepted a different answer');
  event=await roll();check(event.questionId!==wrong.state.lastResult.quiz.questionId,'Repeated a learned question before new knowledge');
  const right=await answer(true);
  await page.locator('#patrol-result').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/quiz/desktop-correct-answer.png'});
  for(let index=0;index<8&&!((await page.evaluate(()=>helpaniPatrol.state())).completed);index++){await roll();await answer(index%2===0);}
  const completed=await page.evaluate(()=>helpaniPatrol.state());
  check(completed.completed&&!completed.pendingEvent&&completed.chapters.length===2,'Quiz route did not finish');
  const habitat=await page.evaluate(async()=>await(await fetch('/api/habitat/state')).json());
  check(habitat.inventory.filter(id=>id==='woodland-bridge').length===1,'Route failed to unlock exactly one bridge');
  await page.getByRole('button',{name:'把收获带回家 / 布置木道',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#wood-notice').textContent.startsWith('观察线索：'));
  check(await page.evaluate(()=>document.querySelector('#wood-notice').textContent.includes(helpaniPatrol.state().lastResult.quiz.observationPrompt)),'Returning home lost the observation clue');
  const learned=JSON.stringify(completed.knowledge);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.helpaniPatrol?.state()?.completed);
  check(await page.evaluate(value=>JSON.stringify(helpaniPatrol.state().knowledge)===value,learned),'Reload changed knowledge pages');
  await page.locator('.patrol-knowledge > summary').click();
  check(await page.locator('#patrol-knowledge-grid article').count()===completed.knowledge.length,'Knowledge pages did not render');
  await page.locator('.patrol-knowledge').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/quiz/desktop-knowledge.png'});
  const afterTown=await page.evaluate(async()=>await(await fetch('/api/state')).json());
  check(JSON.stringify(beforeTown)===JSON.stringify(afterTown),'Quiz changed care or wallet');
  check(errors.length===0,'Unhandled page errors: '+errors.join(', '));
  return {viewport:'1440x900',threeChoices:true,answerHiddenBeforeChoice:true,pendingQuestionAndOrderRestored:true,wrongAndCorrectFeedback:true,sourcedExplanation:true,repeatAnswerUnique:true,conflictingAnswerStatus:conflict,newQuestionPrioritized:true,chapters:completed.chapters.length,events:completed.eventCount,knowledgePages:completed.knowledge.length,bridgeUnique:true,observationClueReturnedHome:true,knowledgeReloaded:true,careAndWalletUnchanged:true,pageErrors:errors};
}
