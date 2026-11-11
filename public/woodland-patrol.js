export function mountPatrol(host, { species = 'red-panda', onReturn, onUseMedal } = {}) {
  const panda = species === 'red-panda';
  const companion = species === 'pangolin' ? {animal:'中华穿山甲',name:'小松',place:'蕨叶谷',title:'蕨叶谷巡护',routeLabel:'8 格林下路线',nodeNames:['巡护站','落叶径','树根旁','泥土坡','半程记','蚁丘望','蕨叶湾','归途','安静角落'],themeLabels:{rest:'认识穿山甲',habitat:'林地与保护'},topicLabels:{canopy:'身体的秘密',maintenance:'林地与保护',tracks:'林下的生活'}}
    : species === 'sea-turtle' ? {animal:'绿海龟',name:'阿潮',place:'潮汐湾',title:'潮汐湾巡护',routeLabel:'8 格浅海路线',nodeNames:['巡护站','海草湾','浅礁旁','水面光','半程记','沙滩望','蓝水径','归途','潮汐留影'],themeLabels:{rest:'认识绿海龟',habitat:'海洋与保护'},topicLabels:{canopy:'身体的秘密',maintenance:'海洋与保护',tracks:'浅湾的生活'}}
    : {animal:'小熊猫',name:'竹竹',place:'林地',title:'竹影林巡护',routeLabel:'8 格林地路线',nodeNames:['巡护站','竹叶径','树冠望','林缘角','半程记','溪边影','落叶坡','归途','新木道'],themeLabels:{rest:'认识小熊猫',habitat:'森林与保护'},topicLabels:{canopy:'树上的生活',maintenance:'森林与栖地',tracks:'认识小熊猫'}};
  const completionText = panda ? '连接木道已放进设施库存。' : '路线纪念勋章已收入收藏，可带回家装饰照片。';
  let disposed = false;
  host.innerHTML = `<div class="wood-patrol-heading"><div><p class="eyebrow">03 / 每一段路，都有个小发现</p><h3>${companion.title}</h3><p>跟着线索猜一猜，认识${companion.name}和它生活的环境。</p></div><span class="wood-patrol-tag">${companion.routeLabel} · 免费试玩</span></div>
    <div class="wood-patrol-map" aria-label="起点与八格巡护路线"><svg viewBox="0 0 960 220" aria-hidden="true"><path d="M50 135Q150 30 265 110T485 105T705 110T910 85"/></svg><ol id="patrol-nodes"></ol></div>
    <div class="wood-patrol-controls"><label>这次想找什么？<select id="patrol-theme"><option value="rest">${companion.themeLabels.rest}</option><option value="habitat">${companion.themeLabels.habitat}</option></select></label><button id="patrol-start" class="wood-primary">出发巡护</button><div class="patrol-dice" id="patrol-dice" aria-label="尚未掷骰">⚄</div><button id="patrol-roll" class="wood-primary" hidden>掷骰前进</button><p id="patrol-position"></p></div>
    <p id="patrol-status" class="wood-progress" role="status" aria-live="polite"></p>
    <section id="patrol-event" class="patrol-event" hidden aria-labelledby="patrol-event-title"><p class="eyebrow" id="patrol-event-label">${companion.animal}问答</p><h4 id="patrol-event-title" tabindex="-1"></h4><p id="patrol-event-text"></p><div id="patrol-choices"></div><p class="patrol-question-note" id="patrol-question-note">凭直觉选一个，答案里还藏着新的观察线索。</p></section>
    <section id="patrol-result" class="patrol-result" hidden aria-labelledby="patrol-result-title"><h4 id="patrol-result-title" tabindex="-1"></h4><div id="patrol-quiz-feedback" hidden></div><p id="patrol-result-text"></p><div class="patrol-result-actions"><button id="patrol-next" class="wood-primary">继续巡护 · 掷骰</button><button id="patrol-home">回${companion.place}看看 / 拍照</button></div></section>
    <details class="patrol-knowledge"><summary>我的${companion.animal}知识册 <span id="patrol-knowledge-count">0 / 6</span></summary><p id="patrol-learning-progress">沿路认识的新知识，会连同解释与来源一起留在这里。</p><div id="patrol-knowledge-grid"></div></details>
    <div class="patrol-notebook"><section class="patrol-route-stories"><h4>路线故事</h4><div id="patrol-chapters"></div></section><section class="patrol-medal-section" aria-labelledby="patrol-medal-heading"><div class="patrol-collection-heading"><div><p class="eyebrow">把经历收进生活里</p><h4 id="patrol-medal-heading" tabindex="-1">巡护勋章 <span id="patrol-medal-count"></span></h4></div><span class="patrol-collection-caption">永久收藏 · 装饰照片</span></div><p class="wood-subtle">每次作答都有 25% 额外发现机会，答错也会留下知识和见闻。每累计 4 次见闻，可选择一枚未拥有的勋章。${panda?'路线完成就能带回木道。':'首次完成路线，确定获得一枚纪念勋章。'}</p><div id="patrol-collect" aria-live="polite"></div><div id="patrol-medals"></div></section></div>
    <details class="patrol-journal"><summary>翻开巡护手记 <span id="patrol-journal-count"></span></summary><ol id="patrol-journal"></ol></details><p class="wood-source">巡护所得均为虚拟故事、勋章与设施，不产生公益积分或资金。每轮 8 次免费机会，完成后可再次出发。</p>
    <dialog id="patrol-medal-dialog" class="wood-dialog patrol-medal-dialog" aria-labelledby="patrol-medal-dialog-title"><div class="patrol-medal-dialog-top"><p class="eyebrow" id="patrol-medal-dialog-kicker">林间收藏</p><button id="patrol-medal-close" aria-label="关闭勋章详情">关闭</button></div><img id="patrol-medal-dialog-art" class="patrol-medal-dialog-art" alt=""><p id="patrol-medal-dialog-count" class="patrol-medal-dialog-count"></p><h2 id="patrol-medal-dialog-title"></h2><p id="patrol-medal-dialog-description"></p><div class="patrol-medal-benefit"><span>与这枚勋章一起获得</span><strong id="patrol-medal-dialog-reward"></strong><p>拍下${companion.name}的日常，让这段经历留在照片里。</p></div><p id="patrol-medal-dialog-status" role="status" aria-live="polite"></p><div class="patrol-medal-dialog-actions"><button id="patrol-medal-use" class="wood-primary">立即试用 · 装饰照片</button><button id="patrol-medal-claim" class="wood-primary" hidden>领取这枚勋章</button><button id="patrol-medal-keep">收进勋章册</button></div></dialog>`;
  host.hidden = false; host.dataset.species = species;
  const $ = (id) => host.querySelector(`#${id}`);
  const nodeNames=companion.nodeNames;
  const nodeList=$('patrol-nodes');
  nodeNames.forEach((name,index)=>{const li=document.createElement('li'),marker=document.createElement('span'),label=document.createElement('small');marker.textContent=index===0?'⌂':String(index);label.textContent=name;li.append(marker,label);nodeList.append(li);});
  let state, busy=false, moving=false, displayPosition=0, recovering, readFailed=false;
  let lastQuizKey, liveMasteryEventId, selectedDialogMedal, dialogKind, dialogWorking=false, dialogGeneration=0, returnFocus;
  const shownRewardIds=new Set(), medalDialog=$('patrol-medal-dialog');
  async function read() {
    const response=await fetch(`/api/patrol/state?species=${encodeURIComponent(species)}`); const data=await response.json(); if(!response.ok)throw new Error(data.error); return data;
  }
  const message=(text)=>{if(!disposed)$('patrol-status').textContent=text;};
  function textElement(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}

  function addSource(parent,source){
    if(!source?.url)return;
    try{
      const url=new URL(source.url);if(url.protocol!=='https:')return;
      const paragraph=textElement('p','资料：');paragraph.className='patrol-fact-source';
      const link=textElement('a',`${source.title} ↗`);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';paragraph.append(link);parent.append(paragraph);
    }catch{/* Old journal entries may not have a source. */}
  }
  function renderQuiz(result){
    const target=$('patrol-quiz-feedback'),quiz=result?.quiz;target.hidden=!quiz;
    $('patrol-result').classList.toggle('has-quiz',Boolean(quiz));
    $('patrol-result').classList.toggle('is-correct',Boolean(quiz?.correct));
    $('patrol-result').classList.toggle('is-incorrect',Boolean(quiz&&!quiz.correct));
    if(!quiz){target.replaceChildren();lastQuizKey=undefined;return;}
    const knowledge=state.knowledge||[],mastered=knowledge.filter(item=>item.correct).length;
    const key=JSON.stringify([result.eventVisitId,quiz,knowledge.length,mastered,state.eventCount,state.collectionClaims,state.medals.length]);
    if(key===lastQuizKey)return;lastQuizKey=key;target.replaceChildren();
    target.append(textElement('span',quiz.correct?'✓ 答对了 · 这条线索猜中了':'这次还差一点 · 新发现已保留','patrol-verdict'));
    if(quiz.correct){const stamp=textElement('span',quiz.firstMastered?'首次掌握':'已掌握','patrol-mastery-stamp');if(quiz.firstMastered&&result.eventVisitId===liveMasteryEventId)stamp.classList.add('is-fresh');target.append(stamp);}
    target.append(textElement('p',quiz.correct?'你发现了这条线索里的秘密。':'没关系，这次的线索也记下来了。','patrol-feedback-lead'));
    if(!quiz.correct){target.append(textElement('p',`你的猜测：${quiz.selectedAnswer}`,'patrol-your-guess'));if(quiz.misconception)target.append(textElement('p',quiz.misconception,'patrol-misconception'));}
    target.append(textElement('small',quiz.correct?'你掌握的线索':'一起认识正确的线索','patrol-answer-label'),textElement('p',quiz.correctAnswer,'patrol-fact-answer'));
    const rewards=document.createElement('div');rewards.className='patrol-result-rewards';rewards.append(textElement('span','见闻 +1'),textElement('span',`已发现 ${knowledge.length} / ${state.knowledgeCatalogSize||6}`),textElement('span',`已掌握 ${mastered} / ${state.knowledgeCatalogSize||6}`));target.append(rewards);
    collectionSummary(target,true);
    const explanation=document.createElement('details');explanation.className='patrol-answer-explanation';explanation.append(textElement('summary','为什么是这样？查看解释与来源'),textElement('p',quiz.question,'patrol-original-question'),textElement('p',quiz.explanation));addSource(explanation,quiz.source);target.append(explanation);
    if(quiz.observationPrompt){const prompt=document.createElement('aside');prompt.className='patrol-observation-prompt';prompt.append(textElement('strong',quiz.correct?`把发现带回${companion.place}`:'带着线索再观察一次'),textElement('p',quiz.observationPrompt));target.append(prompt);}
  }
  function renderKnowledge(){
    const knowledge=state.knowledge||[],total=state.knowledgeCatalogSize||6;
    const mastered=knowledge.filter(item=>item.correct).length;
    $('patrol-knowledge-count').textContent=`${knowledge.length} / ${total} · 已掌握 ${mastered}`;
    $('patrol-learning-progress').textContent=knowledge.length?`已发现 ${knowledge.length} / ${total} 页 · 已掌握 ${mastered} / ${total} 页。待复习的线索仍会保留，后续独立猜中就能补上掌握章。`:'每一条新发现都会保留。独立猜中时，为这一页盖上掌握章。';
    const grid=$('patrol-knowledge-grid');grid.replaceChildren();
    for(const item of knowledge){const card=document.createElement('article');card.classList.toggle('is-mastered',Boolean(item.correct));card.append(textElement('span',item.correct?'✓ 已掌握':'新发现 · 待复习','patrol-knowledge-state'),textElement('h5',item.title||item.question),textElement('p',item.correctAnswer),textElement('p',item.explanation));addSource(card,item.source);grid.append(card);}
  }
  function collectionProgress(){
    const goal=Number.isSafeInteger(state.collectionGoal)&&state.collectionGoal>0?state.collectionGoal:4;
    const total=Math.max(0,state.eventCount||0),claims=Math.max(0,state.collectionClaims||0);
    return {goal,total,available:Math.max(0,Math.floor(total/goal)-claims),remaining:total%goal,needed:goal-total%goal};
  }
  function collectionSummary(parent,compact=false){
    const progress=collectionProgress(),complete=state.medals.length===state.medalCatalog.length;
    const wrap=document.createElement('div');wrap.className=`patrol-collection-progress${compact?' is-compact':''}`;
    wrap.append(textElement('strong',complete?'巡护勋章已集齐':progress.available?`可选择 ${Math.min(progress.available,state.medalCatalog.length-state.medals.length)} 枚新勋章`:`本次集章 ${progress.remaining} / ${progress.goal}`));
    const bar=document.createElement('progress');bar.max=progress.goal;bar.value=complete||progress.available?progress.goal:progress.remaining;bar.setAttribute('aria-label',complete?'勋章收藏已完成':`集章进度 ${bar.value} / ${progress.goal}`);wrap.append(bar);
    wrap.append(textElement('small',complete?'打开勋章，试试已经解锁的照片装饰。':progress.available?`领取名额已保留，另外还积累了 ${progress.remaining} / ${progress.goal} 次见闻。`:`再完成 ${progress.needed} 次见闻，即可选择一枚未拥有的勋章。`));parent.append(wrap);
  }
  const medalDefinition=(id)=>state?.medalCatalog?.find(item=>item.id===id);
  const ownedMedal=(id)=>state?.medals?.find(item=>item.id===id);
  function medalArt(medal){const image=document.createElement('img');image.src=medal.art||`/assets/medals/${medal.id}.png`;image.alt='';image.loading='lazy';image.decoding='async';return image;}
  function renderMedals(){
    $('patrol-medal-count').textContent=`${state.medals.length} / ${state.medalCatalog.length}`;
    const progress=collectionProgress(),grid=$('patrol-medals');grid.replaceChildren();$('patrol-collect').replaceChildren();collectionSummary($('patrol-collect'));
    for(const medal of state.medalCatalog){
      const owned=ownedMedal(medal.id),equipped=state.equippedMedalId===medal.id;
      const card=document.createElement('article');card.className=`patrol-medal-card ${owned?'is-owned':'is-locked'}${equipped?' is-equipped':''}`;card.dataset.medalId=medal.id;
      const preview=document.createElement('button');preview.className='patrol-medal-preview';preview.dataset.medalPreview=medal.id;preview.setAttribute('aria-label',`查看${medal.title}的图案与用途`);preview.append(medalArt(medal));preview.onclick=()=>showMedal(medal.id,'preview');
      const content=document.createElement('div');content.className='patrol-medal-card-content';content.append(textElement('span',equipped?'正在装饰照片':owned?'已收藏 · 永久保留':progress.available?'可以领取':'等待下一次发现','patrol-medal-state'),textElement('h5',medal.title),textElement('p',medal.description||`留住你与${companion.name}共同发现的故事。`,'patrol-medal-description'),textElement('p',`解锁：${medal.rewardLabel||'专属照片装饰'}`,'patrol-medal-unlock'));
      const action=textElement('button',owned?equipped?'查看 / 再去拍一张':'查看与试用':progress.available?`领取${medal.title}`:'预览图案与用途');action.className='patrol-medal-action';if(!owned&&progress.available)action.classList.add('wood-primary');action.disabled=busy;action.onclick=()=>!owned&&progress.available?submit('collect',{medalId:medal.id}):showMedal(medal.id,'preview');content.append(action);card.append(preview,content);grid.append(card);
    }
    if(medalDialog.open)updateMedalDialog();
  }
  function updateMedalDialog(){
    const medal=medalDefinition(selectedDialogMedal);if(!medal)return;
    const owned=ownedMedal(medal.id),progress=collectionProgress();
    $('patrol-medal-dialog-kicker').textContent=dialogKind==='reward'?'一段经历，成为你的收藏':owned?'我的巡护收藏':'下一枚，想选哪一段经历？';
    $('patrol-medal-dialog-title').textContent=medal.title;$('patrol-medal-dialog-description').textContent=medal.description||`留住你与${companion.name}共同发现的故事。`;$('patrol-medal-dialog-art').src=medal.art||`/assets/medals/${medal.id}.png`;
    $('patrol-medal-dialog-count').textContent=owned?`已收藏 ${state.medals.length} / ${state.medalCatalog.length} 枚 · 永久保留`:progress.available?'本次集章已完成，可以选择这枚勋章':`再完成 ${progress.needed} 次见闻，即可选择一枚新勋章`;
    $('patrol-medal-dialog-reward').textContent=medal.rewardLabel||'专属照片装饰';
    $('patrol-medal-use').hidden=!owned;$('patrol-medal-use').textContent=state.equippedMedalId===medal.id?'已装饰照片 · 再去拍一张':'立即试用 · 装饰照片';$('patrol-medal-use').disabled=busy||dialogWorking;
    $('patrol-medal-claim').hidden=Boolean(owned)||!progress.available;$('patrol-medal-claim').textContent=`领取${medal.title}`;$('patrol-medal-claim').disabled=busy||dialogWorking;
    $('patrol-medal-keep').textContent=dialogKind==='reward'?'收进勋章册':'返回巡护';
  }
  function showMedal(id,kind='preview'){
    if(disposed||!medalDefinition(id))return;if(!medalDialog.open)returnFocus=document.activeElement;
    selectedDialogMedal=id;dialogKind=kind;dialogGeneration+=1;$('patrol-medal-dialog-status').textContent='';medalDialog.classList.toggle('is-new-reward',kind==='reward');updateMedalDialog();if(!medalDialog.open)medalDialog.showModal();
  }
  function showNewMedal(id){if(!id||shownRewardIds.has(id))return;shownRewardIds.add(id);showMedal(id,'reward');}
  $('patrol-medal-close').onclick=$('patrol-medal-keep').onclick=()=>medalDialog.close();
  medalDialog.addEventListener('close',()=>{
    dialogGeneration+=1;dialogWorking=false;medalDialog.classList.remove('is-new-reward');
    const fallback=[...$('patrol-medals').querySelectorAll('[data-medal-preview]')].find(button=>button.dataset.medalPreview===selectedDialogMedal);
    if(!document.body.classList.contains('wood-camera-mode')&&!document.getElementById('wood-photo-dialog')?.open)(returnFocus?.isConnected?returnFocus:fallback||$('patrol-medal-heading')).focus({preventScroll:true});
  });
  $('patrol-medal-claim').onclick=()=>submit('collect',{medalId:selectedDialogMedal});
  $('patrol-medal-use').onclick=async()=>{
    if(busy||dialogWorking||!ownedMedal(selectedDialogMedal))return;
    const id=selectedDialogMedal,generation=dialogGeneration;dialogWorking=true;$('patrol-medal-dialog-status').textContent='正在把这段经历放进照片里…';updateMedalDialog();
    try{
      const equipped=await submit('equip',{medalId:id});if(!equipped)throw new Error('暂时没能保存照片装饰，请重试。勋章仍保留在收藏里。');
      if(!medalDialog.open||generation!==dialogGeneration)return;
      await onUseMedal?.(id);if(medalDialog.open&&generation===dialogGeneration)medalDialog.close();
    }catch(error){if(medalDialog.open&&generation===dialogGeneration)$('patrol-medal-dialog-status').textContent=error.message;}
    finally{dialogWorking=false;if(medalDialog.open)updateMedalDialog();}
  };
  function render() {
    if(disposed||!state)return;
    if(state.presentation){
      Object.assign(companion,state.presentation);
      host.querySelector('.wood-patrol-heading h3').textContent=companion.title;
      host.querySelector('.wood-patrol-tag').textContent=companion.routeLabel+' · 免费试玩';
      for(const option of $('patrol-theme').options)option.textContent=companion.themeLabels[option.value];
      [...nodeList.children].forEach((node,i)=>node.querySelector('small').textContent=companion.nodeNames[i]);
    }
    $('patrol-theme').disabled=busy||Boolean(state.runId&&!state.completed)||Boolean(state.pendingEvent);
    $('patrol-theme').value=state.theme||'rest';
    $('patrol-start').hidden=Boolean(state.runId&&!state.completed)||Boolean(state.pendingEvent); $('patrol-start').disabled=busy;
    $('patrol-start').textContent=state.completed?'再次巡护':'出发巡护';
    $('patrol-roll').hidden=!state.runId||state.completed; $('patrol-roll').disabled=busy||Boolean(state.pendingEvent);
    $('patrol-position').textContent=state.runId?`第 ${displayPosition} / 8 格 · 本轮剩余 ${state.remaining} 次`:'请选择一个巡护主题';
    if(state.lastRoll){$('patrol-dice').textContent=['','⚀','⚁','⚂','⚃','⚄','⚅'][state.lastRoll.die];$('patrol-dice').setAttribute('aria-label',`本次骰点 ${state.lastRoll.die}`);}
    [...nodeList.children].forEach((node,i)=>{node.classList.toggle('is-reached',i<displayPosition);node.classList.toggle('is-current',i===displayPosition);node.setAttribute('aria-current',i===displayPosition?'step':'false');});
    const event=state.pendingEvent; $('patrol-event').hidden=!event||moving;
    $('patrol-choices').replaceChildren();
    if(event){const quiz=event.kind==='quiz';$('patrol-event-title').textContent=event.title;$('patrol-event-text').textContent=event.text;
      $('patrol-event-label').textContent=quiz?`${companion.topicLabels[event.topic]||'林间小发现'} · ${companion.animal}问答`:'林间遇事 · 虚构游戏事件';
      $('patrol-question-note').hidden=false;$('patrol-question-note').textContent=quiz?'凭直觉选一个，答案里还藏着新的观察线索。':`先把上次的见闻收好，下一段路会遇到新的${companion.animal}问答。`;$('patrol-choices').classList.toggle('is-quiz',quiz);
      event.choices.forEach((choice,index)=>{const button=document.createElement('button');if(quiz){const letter=textElement('span',String.fromCharCode(65+index));letter.className='patrol-choice-letter';letter.setAttribute('aria-hidden','true');button.append(letter);}button.append(textElement('strong',choice.label));if(!quiz&&choice.description)button.append(textElement('small',choice.description));button.disabled=busy;button.onclick=()=>submit('choose',{eventVisitId:event.id,choiceId:choice.id});$('patrol-choices').append(button);});}
    const result=state.lastResult; $('patrol-result').hidden=!result||Boolean(event)||moving;
    renderQuiz(result);
    if(result){const discoveredMedal=medalDefinition(result.medal);$('patrol-result-title').textContent=result.title;$('patrol-result-text').textContent=result.quiz?(discoveredMedal?`额外发现「${discoveredMedal.title}」，已收进收藏，并解锁${discoveredMedal.rewardLabel||'照片装饰'}。`:'这次见闻已保留，继续向下一枚勋章前进。'):result.text+ (result.medal?' · 额外发现已收进勋章册。':'');}
    $('patrol-next').hidden=state.completed||Boolean(event);
    $('patrol-next').disabled=busy;
    $('patrol-home').disabled=busy;
    $('patrol-home').textContent=state.completed?(panda?'把收获带回家 / 布置木道':'把勋章带回家 / 拍照'):result?.quiz?result.quiz.correct?`带着发现回${companion.place}`:`回${companion.place}观察这条线索`:`回${companion.place}看看 / 拍照`;
    renderKnowledge();
    $('patrol-chapters').replaceChildren();
    if(!state.chapters.length)$('patrol-chapters').append(textElement('p','经过第 4、8 格，确定解锁两段故事。'));
    for(const chapter of state.chapters){const details=document.createElement('details');details.append(textElement('summary',chapter.title),textElement('p',chapter.text));$('patrol-chapters').append(details);}
    renderMedals();
    $('patrol-journal-count').textContent=`(${state.journal.length})`;$('patrol-journal').replaceChildren();
    for(const entry of [...state.journal].reverse()){const li=document.createElement('li');li.append(textElement('strong',entry.title));if(entry.quiz){li.append(textElement('p',`${entry.quiz.correct?'猜中了':'新的认识'} · ${entry.quiz.correctAnswer}`),textElement('p',entry.quiz.explanation));addSource(li,entry.quiz.source);}else li.append(textElement('p',entry.text));$('patrol-journal').append(li);}
  }
  async function recover() {
    if(disposed||busy||moving||document.hidden||recovering||!host.isConnected)return;
    recovering=(async()=>{
      try{
        const latest=await read();
        if(disposed||busy||moving)return;
        const changed=!state||latest.revision>state.revision;
        if(!state||latest.revision>=state.revision){state=latest;displayPosition=state.position;render();}
        if(readFailed||changed)message(state.pendingEvent?'已恢复巡护进度，请继续处理当前见闻。':'巡护进度已同步，可以继续。');
        readFailed=false;
      }catch{readFailed=true;message('网络暂时不可用，巡护进度保留，恢复后会自动读取。');}
      finally{recovering=null;}
    })();
    await recovering;
  }
  async function submit(action,data={}) {
    if(disposed||busy||!state)return false;busy=true;const previousMedals=new Set(state.medals.map(item=>item.id));let success=false,reward;render();
    const body={...data,species,requestId:crypto.randomUUID(),expectedRevision:state.revision};
    try{
      let next;
      for(let attempt=0;attempt<2;attempt++){
        try{const response=await fetch(`/api/patrol/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const output=await response.json();if(!response.ok){const error=new Error(output.error);error.status=response.status;error.state=output.state;throw error;}next=output;break;}
        catch(error){if(error.status||attempt)throw error;}
      }
      if(disposed)return false;
      state=next;
      success=true;
      if(action==='choose')liveMasteryEventId=state.lastResult?.eventVisitId;
      if(action==='choose'||action==='collect'||action==='roll')reward=state.medals.find(item=>!previousMedals.has(item.id))?.id;
      if(action==='roll'){
        moving=true;displayPosition=state.lastRoll.from;render();
        message(`掷出 ${state.lastRoll.die} 点，沿路线逐格前进…`);
        const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for(const position of state.lastRoll.steps){if(!reducedMotion)await new Promise(resolve=>setTimeout(resolve,360));if(disposed)return false;displayPosition=position;render();}
        moving=false;message(`掷出 ${state.lastRoll.die} 点，从第 ${state.lastRoll.from} 格走到第 ${state.lastRoll.to} 格${state.completed?`，路线完成！${completionText}再看看最后一个小发现。`:'，看看这里藏着什么小知识。'}`);
      }else {displayPosition=state.position;message(action==='start'?'巡护开始。掷一枚骰子，看看今天的小发现。':action==='collect'?'新的勋章已记入收藏，照片装饰也已解锁。':action==='equip'?state.equippedMedalId?'照片装饰已保存，下一张照片就能带上这段经历。':'照片将保留自然画面。':state.completed?`本轮完成，${completionText}`:`见闻已保存，可以继续巡护，或回${companion.place}观察。`);}
      if(action==='choose'||state.completed){try{await window.helpaniWoodland?.refresh();}catch{message('巡护见闻已保存，栖地库存会在网络恢复后同步。');}}
    }catch(error){
      if(disposed)return false;
      let restored=false;
      try{
        const latest=error.status===409&&error.state?error.state:await read();
        restored=latest.revision>state.revision;
        if(latest.revision>=state.revision){state=latest;displayPosition=state.position;moving=false;}
      }catch{readFailed=true;}
      message(restored?'操作结果已恢复，请按当前进度继续。':error.message+' 进度会保留，网络恢复后会自动读取。');
      if(medalDialog.open)$('patrol-medal-dialog-status').textContent=error.message;
    }
    finally{busy=false;if(disposed)return false;render();if(action==='roll'&&state.pendingEvent&&!readFailed){$('patrol-event').scrollIntoView({block:'nearest',behavior:'smooth'});$('patrol-event-title').focus({preventScroll:true});}else if(action==='choose'&&!state.pendingEvent){$('patrol-result').scrollIntoView({block:'nearest',behavior:'smooth'});$('patrol-result-title').focus({preventScroll:true});}}
    if(success&&reward)showNewMedal(reward);
    return success?structuredClone(state):false;
  }
  $('patrol-start').onclick=()=>submit('start',{theme:$('patrol-theme').value});
  $('patrol-roll').onclick=()=>submit('roll');
  $('patrol-next').onclick=()=>submit('roll');
  $('patrol-home').onclick=async()=>{try{await onReturn?.();}catch{document.getElementById('woodland')?.scrollIntoView({block:'start',behavior:'smooth'});message('网络暂时不可用，可以先观察栖地；设施库存会在恢复后同步。');window.helpaniWoodland?.notice('网络暂时不可用，可以先观察栖地；设施库存会在恢复后同步。');}};
  const visibilityChange=()=>{if(!document.hidden)recover();};
  window.addEventListener('online',recover);
  window.addEventListener('focus',recover);
  window.addEventListener('pageshow',recover);
  document.addEventListener('visibilitychange',visibilityChange);
  const controller={species,state:()=>state?structuredClone(state):null,equipMedal:(medalId)=>submit('equip',{medalId}),refresh:async()=>{await recover();return state?structuredClone(state):null;},destroy:()=>{
    disposed=true;dialogGeneration+=1;if(medalDialog.open)medalDialog.close();
    window.removeEventListener('online',recover);window.removeEventListener('focus',recover);window.removeEventListener('pageshow',recover);document.removeEventListener('visibilitychange',visibilityChange);
    if(window.helpaniPatrol===controller)delete window.helpaniPatrol;
  }};
  window.helpaniPatrol=controller;
  controller.ready=(async()=>{
    try{const latest=await read();if(disposed)return;state=latest;displayPosition=state.position;render();if(state.pendingEvent)message(`已恢复上次掷出 ${state.lastRoll.die} 点后的第 ${state.position} 格，请继续处理见闻。`);else if(state.completed)message(`已恢复完成的巡护。故事与收藏已保留，${completionText}`);}
    catch(error){if(disposed)return;readFailed=true;message(`巡护暂时无法打开：${error.message}，网络恢复后会自动读取。`);}
  })();
  return controller;
}
