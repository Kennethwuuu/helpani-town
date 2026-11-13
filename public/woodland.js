import { WoodlandScene } from './woodland-scene.js?v=20261110-unified-care';
import { CompanionScene } from './companion-scene.js?v=20261110-unified-care';
import { careSpecies } from './care-species.js?v=20261110-unified-care';
import { openAlbum, savePhoto, listPhotos } from './woodland-album.js?v=20261110-unified-care';
import { mountPatrol } from './woodland-patrol.js?v=20261111-species-patrol';
import { paintPhotoMedal, photoMedalMetadata } from './medal-photo.js?v=20261111-species-patrol';

const host = document.querySelector('#woodland');
host.innerHTML = `
  <a class="wood-return" href="/#playroom">← 返回我的伙伴</a>
  <div class="wood-heading"><div><p class="eyebrow">THE LITTLE THINGS · 林间共同日记</p><h2 id="wood-title">伙伴的栖地生活<span>观察、照顾和留影，在同一处发生</span></h2></div><span class="wood-season" id="wood-season">初秋 · 清凉的傍晚<br><small>压缩游戏作息 · 虚拟场景</small></span></div>
  <div class="wood-card">
    <div class="wood-stage"><canvas id="wood-canvas" width="1600" height="1000" aria-label="小熊猫自主探索、攀爬和休息的林地，可拖动和缩放镜头" tabindex="0"></canvas><div class="wood-scene-caption"><span id="wood-place">竹影林 / 01</span><span id="wood-status" role="status">听，树叶在轻轻响。</span></div></div>
    <div id="wood-care-controls" class="wood-care-controls"><div id="wood-feed-controls"></div><button id="wood-touch">♡ 轻抚 / 打招呼</button><button id="wood-arrange">▤ 布置栖地</button></div><div id="wood-care-feedback" class="wood-care-feedback"></div><div class="wood-tools" aria-label="观察与摄影工具"><button id="wood-find">◎ 找找竹竹</button><button id="wood-zoom-out" aria-label="缩小镜头">−</button><button id="wood-zoom-in" aria-label="放大镜头">＋</button><button id="wood-reset">复位</button><button id="wood-pause" aria-pressed="false">暂停活动</button><button id="wood-camera" class="wood-primary">◉ 打开相机</button><button id="wood-camera-exit" hidden>退出相机</button><button id="wood-shutter" class="wood-primary" hidden>拍下这一刻</button></div>
  </div>
  <div id="wood-care-summary" class="wood-care-summary"></div>
  <div class="wood-notice" id="wood-notice" role="status" aria-live="polite">首次探望赠送一件休息平台。先看看它喜欢去哪儿，再选个角落。</div>
  <details class="wood-habitat-details" id="wood-habitat-details"><summary>栖地布置与共同观察</summary><div class="wood-panels">
    <section class="wood-panel"><p class="eyebrow">01 / 给生活一点新变化</p><h3>布置休息角落</h3><p class="wood-subtle" id="wood-inventory">正在整理设施…</p><div class="wood-facilities"><button id="wood-platform" aria-pressed="true">休息平台 · 已拥有</button><button id="wood-bridge" disabled>连接木道 · 巡护解锁</button></div><div id="wood-placement" hidden><p class="eyebrow">摆放预览</p><h3 id="wood-placement-title">给竹竹选个休息角落</h3><div class="wood-slots"><button data-slot="trunk"><strong>树干旁 · 高枝</strong><small>顺着树干攀上去，竹影映在身后。</small></button><button data-slot="edge"><strong>林缘边 · 低台</strong><small>沿落叶小路走近，留出开阔的侧影。</small></button><button data-slot="canopy" hidden><strong>连接两棵树</strong><small>新增树冠间的穿行路线和停留点。</small></button></div><p id="wood-placement-label" role="status">选择一个位置，比较半透明预览。</p><div class="wood-actions"><button id="wood-confirm" class="wood-primary" disabled>确认布置</button><button id="wood-cancel">取消预览</button></div></div><button id="wood-edit">选择设施 / 调整位置</button><p class="wood-progress" id="wood-layout-status"></p></section>
    <section class="wood-panel"><p class="eyebrow">02 / 把小发现留下来</p><h3>共同观察册 <span id="wood-observation-count">0</span></h3><ul id="wood-observations" class="wood-observations"></ul><p class="wood-source" id="wood-species-source">攀爬与休息习性参考 <a href="https://nationalzoo.si.edu/animals/red-panda" target="_blank" rel="noreferrer">史密森尼国家动物园</a>。竹竹与本轮故事均为虚构。</p><button id="wood-album">▧ 打开我的相册</button><p class="wood-subtle">照片保存在当前浏览器，可下载备份。</p></section>
  </div></details><section id="wood-patrol-host" hidden></section>
  <dialog id="wood-photo-dialog" class="wood-dialog" aria-labelledby="wood-photo-title"><div class="wood-dialog-heading"><div><p class="eyebrow">A MOMENT TO KEEP</p><h2 id="wood-photo-title">林间留影</h2></div><button id="wood-photo-close" aria-label="关闭照片">✕</button></div><img id="wood-photo-preview" alt="竹竹在玩家布置林地里的静态照片"><fieldset class="wood-photo-accent"><legend>把巡护勋章带进照片</legend><div id="wood-photo-accents"></div><p id="wood-photo-accent-note">获得的勋章可用作照片角标。</p></fieldset><label id="wood-crop-label">静态裁切 <input id="wood-crop" type="range" min="1" max="1.7" step="0.01" value="1"> <small>可拖动照片调整中心</small></label><p id="wood-photo-message" role="status"></p><div class="wood-actions"><button id="wood-photo-save" class="wood-primary">保存到相册</button><button id="wood-photo-download">下载 PNG</button><button id="wood-photo-retake">继续取景</button></div></dialog>
  <dialog id="wood-album-dialog" class="wood-dialog" aria-labelledby="wood-album-title"><div class="wood-dialog-heading"><div><p class="eyebrow">OUR FIELD NOTES</p><h2 id="wood-album-title">我的伙伴相册</h2></div><button id="wood-album-close" aria-label="关闭相册">✕</button></div><p class="wood-subtle">当前浏览器保存 · 清除网站数据会移除照片</p><div id="wood-album-grid"></div></dialog>`;
const $ = (id) => document.getElementById(id);
const placementHome = $('wood-placement').parentElement;
const woodlandCard = host.querySelector('.wood-card');
const carePanel = $('care-panel'), carePanelHome = carePanel.parentElement;
const careActions = carePanel.querySelector('.care-actions'), careFeedback = $('pet-action-feedback');
const careActionsAnchor = careActions.nextSibling, careFeedbackAnchor = careFeedback.nextSibling;
$('playroom').prepend(host);
woodlandCard.querySelector('.wood-tools').append($('wood-album'));
let activeSpecies = 'red-panda', sceneTarget = null, sceneGeneration = 0, patrolController = null;
const meta = () => careSpecies[activeSpecies];
const stateURL = (species = activeSpecies) => `/api/habitat/state?species=${encodeURIComponent(species)}`;
function attachCare(value) {
  if(value) { if(carePanel.parentElement!==$('wood-care-summary'))$('wood-care-summary').append(carePanel); if(careActions.parentElement!==$('wood-feed-controls'))$('wood-feed-controls').append(careActions); if(careFeedback.parentElement!==$('wood-care-feedback'))$('wood-care-feedback').append(careFeedback); }
  else { carePanelHome.append(carePanel); carePanel.insertBefore(careActions, careActionsAnchor?.parentNode === carePanel ? careActionsAnchor : $('pet-next')); carePanel.insertBefore(careFeedback, careFeedbackAnchor?.parentNode === carePanel ? careFeedbackAnchor : $('pet-next')); }
}
function configureSpecies() {
  const info=meta(); host.setAttribute('aria-label', `${info.animal}${info.name}的照顾与生活`);
  $('wood-title').replaceChildren(document.createTextNode(info.title)); const subtitle=document.createElement('span'); subtitle.textContent=info.subtitle; $('wood-title').append(subtitle);
  $('wood-season').replaceChildren(document.createTextNode(info.season),document.createElement('br'));const small=document.createElement('small');small.textContent='压缩游戏作息 · 虚拟场景';$('wood-season').append(small);
  $('wood-place').textContent=info.place; $('wood-find').textContent=`◎ 找找${info.name}`;
  $('wood-canvas').setAttribute('aria-label',`${info.animal}${info.name}自主活动的栖地，可拖动和缩放镜头`);
  $('wood-platform').textContent=`${info.facilityName} · 已拥有`;
  const buttons=[...document.querySelectorAll('[data-slot]')];info.slots.forEach((item,index)=>{buttons[index].dataset.slot=item.id;buttons[index].querySelector('strong').textContent=item.title;buttons[index].querySelector('small').textContent=item.description;});
  const source=$('wood-species-source');source.replaceChildren(document.createTextNode('习性资料：'));const link=document.createElement('a');link.textContent=info.source.title;link.href=info.source.url;link.target='_blank';link.rel='noreferrer';source.append(link,document.createTextNode('。角色、设施与互动为虚拟表现。'));
  $('wood-photo-title').textContent=`${info.place}留影`;
  $('wood-patrol-host').hidden=false;
  facility=info.facility; notice(info.firstVisit);
}

let habitat, scene, enabled = false, loading, queue = Promise.resolve(), facility = 'rest-platform', slot = null;
let paused = false, cameraMode = false, photo, photoURL, sourceFrame, cropX = .5, cropY = .5;
const automaticOutbox = new Map();
const speciesOutboxes = new Map();
let automaticTimer, automaticFlushing = false, automaticNeedsRecovery = false;
const labels = { 'ground-explore': '落叶间的探索', climb: '沿树干向上', 'tree-rest': '树枝上的小憩', 'platform-rest': '第一次在新平台休息', 'bridge-cross': '树冠间的新路线', dig:'林下的刨土探索', 'curled-rest':'安静地蜷起身体', 'shelter-rest':'第一次使用落叶休息窝',swim:'海草间的游动',surface:'来到水面换气','ledge-rest':'第一次使用水下休息台' };
const notice = (message) => { $('wood-notice').textContent = message; };

async function fetchJSON(url, body) {
  const response = await fetch(url, body ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || '暂时无法保存，请重试。'); error.status = response.status; error.state = data.state; throw error; }
  return data;
}
function renderHabitat() {
  if (!habitat) return;
  scene?.updateLayout(habitat);
  $('wood-inventory').textContent = `${meta().facilityName} ×1${habitat.inventory.includes('woodland-bridge') ? ' · 连接木道 ×1' : ''} · 虚拟建设 ${habitat.growth.length} 项`;
  $('wood-bridge').hidden = activeSpecies !== 'red-panda';
  $('wood-bridge').disabled = !habitat.inventory.includes('woodland-bridge');
  $('wood-bridge').textContent = habitat.inventory.includes('woodland-bridge') ? '连接木道 · 已拥有' : '连接木道 · 巡护解锁';
  const position = meta().slots.find(item=>item.id===habitat.layout.platform)?.title || '尚未摆放';
  const locallyApplied = scene?.snapshot().layoutVersion === habitat.layoutVersion;
  $('wood-layout-status').textContent = habitat.layoutVersion !== habitat.appliedVersion ? (locallyApplied ? '布置已保存 · 生效记录正在同步，网络恢复后会自动补记。' : '布置已保存 · 等伙伴离开当前设施后生效，可安心离开。') : habitat.layout.platform ? `已保存 · ${position}${habitat.layout.bridge ? ' + 树冠木道' : ''}。移动已有设施不会重复获得成长。` : '设施尚未摆放。保存即记建设进度，实际使用再记观察。';
  $('wood-observation-count').textContent = habitat.observations.length;
  const list = $('wood-observations'); list.replaceChildren();
  if (!habitat.observations.length) { const li = document.createElement('li'); li.textContent = '安静观察，伙伴的新日常会记在这里。'; list.append(li); }
  for (const observation of habitat.observations) {
    const li = document.createElement('li'); const title = document.createElement('strong'); title.textContent = labels[observation.behavior] || observation.title || observation.behavior;
    const small = document.createElement('small'); small.textContent = `${new Date(observation.at || observation.createdAt || Date.now()).toLocaleDateString(window.HelpaniI18n.locale)} · 共同经历`; li.append(title, small); list.append(li);
  }
  if (locallyApplied && habitat.layoutVersion !== habitat.appliedVersion) enqueueAutomatic('apply', {layoutVersion: habitat.layoutVersion});
}
// Serialized commands retain their UUID across transport retries. Conflicts refresh without silently applying a stale player choice.
function command(action, data = {}, automatic = false, pending) {
  const species=activeSpecies,generation=sceneGeneration;
  const job = async () => {
    if (!habitat || generation!==sceneGeneration) return;
    const body = pending?.body || { ...data, species, requestId: crypto.randomUUID(), expectedRevision: habitat.revision };
    if (pending) pending.body = body;
    try {
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { result = await fetchJSON(`/api/habitat/${action}`, body); break; }
        catch (error) { if (error.status || attempt) throw error; }
      }
      if (generation!==sceneGeneration) return result;
      if (!habitat || result.revision >= habitat.revision) habitat = result; renderHabitat(); return result;
    } catch (error) {
      if (generation!==sceneGeneration) throw error;
      if (error.status === 409) {
        const latest = error.state || await fetchJSON(stateURL(species));
        if (latest.revision >= habitat.revision) habitat = latest;
        if (pending) pending.body = null; // Rejected versions need a new operation, unlike an unknown transport result.
        renderHabitat();
      }
      if (!automatic) notice(error.message);
      throw error;
    }
  };
  const result = queue.then(job); queue = result.catch(() => {}); return result;
}
// The renderer emits discoveries and safe layout applications once. Retain
// failed acknowledgements until the server confirms them; an online/focus event
// alone cannot make the renderer emit the same discovery a second time.
function enqueueAutomatic(action, data) {
  const key = action === 'apply' ? `apply:${activeSpecies}:${data.layoutVersion}` : `observe:${activeSpecies}:${data.behavior}:${data.layoutVersion}`;
  if (!automaticOutbox.has(key)) automaticOutbox.set(key, {action, data: {...data}, body: null});
  scheduleAutomatic(0);
}
function scheduleAutomatic(delay = 4000) {
  if (automaticTimer) {
    if (delay) return;
    clearTimeout(automaticTimer);
  }
  automaticTimer = setTimeout(() => { automaticTimer = null; flushAutomatic(); }, delay);
}
function automaticStatus(entry) {
  if (entry.action === 'apply') return entry.data.layoutVersion === habitat.layoutVersion && habitat.appliedVersion !== habitat.layoutVersion ? 'ready' : 'done';
  if (habitat.observations.some(item => item.behavior === entry.data.behavior)) return 'done';
  const version = entry.data.layoutVersion;
  if (version === habitat.appliedVersion) return 'ready';
  return version === habitat.layoutVersion ? 'waiting' : 'done';
}
async function flushAutomatic() {
  if (automaticFlushing || !habitat || !enabled || document.hidden || navigator.onLine === false) return;
  automaticFlushing = true;const generation=sceneGeneration;
  try {
    const entries = [...automaticOutbox].sort(([, a], [, b]) => Number(a.action !== 'apply') - Number(b.action !== 'apply'));
    for (const [key, entry] of entries) {
      if(generation!==sceneGeneration||!habitat)break;
      const status = automaticStatus(entry);
      if (status === 'done') { automaticOutbox.delete(key); continue; }
      if (status === 'waiting') continue;
      try { await command(entry.action, entry.data, true, entry); if(generation!==sceneGeneration)break;automaticOutbox.delete(key); }
      catch (error) {
        if(generation!==sceneGeneration)break;
        if (error.status === 409) { scheduleAutomatic(0); break; }
        if (error.status && error.status < 500) automaticOutbox.delete(key);
        else { automaticNeedsRecovery = true; notice('网络暂时不可用，已保存的布置保留；生效和观察记录会在恢复后自动补记。'); break; }
      }
    }
  } finally {
    automaticFlushing = false;
    if (automaticOutbox.size) scheduleAutomatic();
    else if (automaticNeedsRecovery) { automaticNeedsRecovery = false; notice('网络已恢复，栖地的生效和观察记录已同步。'); }
  }
}
async function refreshHabitat() {
  const generation=sceneGeneration; const latest = await fetchJSON(stateURL());
  if(generation!==sceneGeneration)return;
  if (!habitat || latest.revision >= habitat.revision) habitat = latest;
  renderHabitat(); scheduleAutomatic(0);
  return habitat;
}
async function recoverHabitat() {
  if (!enabled || document.hidden) return;
  if (!scene) { await activate(window.helpaniView); return; }
  try { await refreshHabitat(); } catch { /* Keep the visible scene and queued acknowledgements. */ }
  scheduleAutomatic(0);
}
async function activate(view) {
  const requested=view?.state?.pet?.species;
  enabled=Boolean(view?.visible && careSpecies[requested]); host.hidden=!enabled;
  document.body.classList.toggle('has-woodland',enabled);document.body.classList.toggle('has-care-habitat',enabled);
  attachCare(enabled);
  if(!enabled){scene?.setPaused(true);if(cameraMode)setCameraMode(false);return;}
  $('wood-touch').disabled=Boolean(view.busy);
  if(sceneTarget===requested && (scene||loading)){scene?.setPaused(paused);scheduleAutomatic(0);return;}
  speciesOutboxes.set(activeSpecies,new Map(automaticOutbox));
  const generation=++sceneGeneration;sceneTarget=requested;activeSpecies=requested;
  patrolController?.destroy();patrolController=null;$('wood-patrol-host').replaceChildren();scene?.destroy();scene=null;habitat=null;automaticOutbox.clear();for(const [key,value] of speciesOutboxes.get(requested)||[])automaticOutbox.set(key,value);clearTimeout(automaticTimer);automaticTimer=null;
  endPlacement();configureSpecies();syncPhotoReadiness();
  loading=(async()=>{
    try {
      const next=await fetchJSON(stateURL(requested)); if(generation!==sceneGeneration)return;habitat=next;
      const callbacks={species:requested,onStatus:label=>{if(generation===sceneGeneration)$('wood-status').textContent=label;},onLayoutApplied:layoutVersion=>{if(generation===sceneGeneration&&habitat.appliedVersion!==layoutVersion)enqueueAutomatic('apply',{layoutVersion});},onObserve:record=>{if(generation===sceneGeneration&&!habitat.observations.some(item=>item.behavior===record.behavior))enqueueAutomatic('observe',record);}};
      scene=requested==='red-panda'?new WoodlandScene($('wood-canvas'),callbacks):new CompanionScene($('wood-canvas'),callbacks);
      renderHabitat();scene.setPaused(!enabled||paused);
      if(!patrolController){const patrolHost=document.createElement('div');$('wood-patrol-host').replaceChildren(patrolHost);patrolController=mountPatrol(patrolHost,{species:requested,
        onReturn:async()=>{await refreshHabitat();host.scrollIntoView({block:'start',behavior:'smooth'});scene.focusAnimal();const clue=window.helpaniPatrol?.state()?.lastResult?.quiz?.observationPrompt;notice(clue?`观察线索：${clue}`:'巡护收获已带回栖地，选择新设施，再观察伙伴的回应。');},
        onUseMedal:async()=>{setCameraMode(true);capturePhoto();},
        onStateChange:()=>{if(generation===sceneGeneration)syncPhotoReadiness();},
      });}
      syncPhotoReadiness();
      $('wood-patrol-host').hidden=false;
      if(new URLSearchParams(location.search).get('place')==='platform')beginPlacement(meta().facility);
      window.dispatchEvent(new CustomEvent('helpani-woodland-ready'));
    }catch(error){if(generation===sceneGeneration){notice(`栖地暂时无法打开：${error.message} 返回页面后可重试。`);sceneTarget=null;}}
    finally{if(generation===sceneGeneration)loading=null;}
  })();await loading;
}
window.addEventListener('helpani-state', (event) => activate(event.detail));
if (window.helpaniView) activate(window.helpaniView);
window.addEventListener('focus', recoverHabitat);
window.addEventListener('online', recoverHabitat);
window.addEventListener('pageshow', recoverHabitat);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(automaticTimer); automaticTimer = null; }
  else recoverHabitat();
});
$('wood-touch').onclick=()=>window.helpaniCare?.greet();
$('wood-arrange').onclick=()=>beginPlacement(meta().facility);
window.addEventListener('helpani-care-interaction',event=>{if(enabled&&event.detail.species===activeSpecies){scene?.interact(event.detail.kind);scene?.focusAnimal();notice(event.detail.message||'伙伴注意到了你的陪伴。');}});
$('wood-find').onclick = () => scene?.focusAnimal();
$('wood-reset').onclick = () => scene?.resetCamera();
$('wood-zoom-in').onclick = () => scene?.zoomBy(1.15);
$('wood-zoom-out').onclick = () => scene?.zoomBy(1 / 1.15);
$('wood-pause').onclick = () => { paused = !paused; scene?.setPaused(paused); $('wood-pause').textContent = paused ? '继续活动' : '暂停活动'; $('wood-pause').setAttribute('aria-pressed', paused); };
function beginPlacement(selected) {
  if(!scene)return; $('wood-habitat-details').open=true; facility = selected; slot = null; $('wood-placement').hidden = false; $('wood-edit').hidden = true;
  woodlandCard.append($('wood-placement')); woodlandCard.classList.add('is-placing');
  $('wood-placement-title').textContent = selected === 'woodland-bridge' ? '连接两棵树' : `给${meta().name}选个休息角落`;
  scene?.resetCamera(); woodlandCard.scrollIntoView({block:'start',behavior:'instant'});
  document.querySelectorAll('[data-slot]').forEach((button) => { button.hidden = selected === 'woodland-bridge' ? button.dataset.slot !== 'canopy' : button.dataset.slot === 'canopy'; button.setAttribute('aria-pressed','false'); });
  $('wood-platform').setAttribute('aria-pressed', selected !== 'woodland-bridge'); $('wood-bridge').setAttribute('aria-pressed', selected === 'woodland-bridge');
  $('wood-confirm').disabled = true; scene?.setPreview(null); $('wood-placement-label').textContent = '选择一个位置，比较半透明预览。';
}
$('wood-edit').onclick = () => beginPlacement(facility);
$('wood-platform').onclick = () => beginPlacement(meta().facility);
$('wood-bridge').onclick = () => beginPlacement('woodland-bridge');
document.querySelectorAll('[data-slot]').forEach((button) => { button.onclick = () => { slot = button.dataset.slot; document.querySelectorAll('[data-slot]').forEach((other) => other.setAttribute('aria-pressed',other === button)); scene?.resetCamera(); scene?.setPreview(slot, facility); woodlandCard.scrollIntoView({block:'start',behavior:'instant'}); $('wood-confirm').disabled = false; $('wood-placement-label').textContent = `正在预览：${window.HelpaniI18n.sourceText(button.querySelector('strong'))}。确认后保存。`; }; });
function endPlacement() { slot = null; scene?.setPreview(null); $('wood-placement').hidden = true; $('wood-edit').hidden = false; woodlandCard.classList.remove('is-placing'); placementHome.insertBefore($('wood-placement'), $('wood-edit')); }
$('wood-cancel').onclick = endPlacement;
$('wood-confirm').onclick = async () => {
  if (!slot || $('wood-confirm').disabled) return;
  $('wood-confirm').disabled = true;
  try { await command('layout', {facilityId: facility, slotId: slot}); endPlacement(); notice(`布置已保存。建设进度已记录，${meta().name}会按自己的节奏来探索。`); }
  catch (error) { $('wood-confirm').disabled = !slot; $('wood-placement-label').textContent = `保存失败：${error.message} 可以重试。`; }
};
function setCameraMode(value) {
  cameraMode = value; document.body.classList.toggle('wood-camera-mode', value);
  $('wood-camera').hidden = value; $('wood-camera-exit').hidden = !value; $('wood-shutter').hidden = !value;
  if (value) { endPlacement(); host.scrollIntoView({block:'start',behavior:'instant'}); }
}
$('wood-camera').onclick = () => setCameraMode(true); $('wood-camera-exit').onclick = () => setCameraMode(false);
const photoDialog = $('wood-photo-dialog');
function syncPhotoReadiness() {
  const ready = Boolean(scene && patrolController?.state());
  $('wood-shutter').disabled = !ready;
  $('wood-shutter').textContent = ready ? '拍下这一刻' : '正在读取巡护勋章…';
}
syncPhotoReadiness();
function showBlob(blob) { if (photoURL) URL.revokeObjectURL(photoURL); photoURL = URL.createObjectURL(blob); $('wood-photo-preview').src = photoURL; }
let photoAccentBusy = false;
function currentEquippedMedal() {
  const patrol = window.helpaniPatrol?.state();
  if (window.helpaniPatrol?.species!==activeSpecies || !patrol?.medals.some((item) => item.id === patrol.equippedMedalId)) return null;
  return photoMedalMetadata(patrol.medalCatalog.find((item) => item.id === patrol.equippedMedalId));
}
function syncPhotoControls() {
  $('wood-photo-save').disabled = Boolean(!photo?.ready || photo.saved || photo.saving || photoAccentBusy);
  $('wood-photo-download').disabled = Boolean(!photo?.ready || photo.saving || photoAccentBusy);
  $('wood-crop').disabled = Boolean(photo?.saved || photo?.saving || photoAccentBusy);
}
function renderPhotoMedals() {
  document.querySelector('.wood-photo-accent').hidden=false;
  const container = $('wood-photo-accents'); container.replaceChildren();
  const patrol = window.helpaniPatrol?.state();
  const medals = (window.helpaniPatrol?.species===(photo?.species||'red-panda') ? patrol?.medalCatalog || [] : []).filter((item) => patrol.medals.some((owned) => owned.id === item.id));
  const choices = [null, ...medals];
  for (const medal of choices) {
    const button = document.createElement('button'); button.type = 'button';
    const selected = (photo?.medal?.id || null) === (medal?.id || null);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = Boolean(photo?.saved || photo?.saving || photoAccentBusy);
    if (medal) {
      const image = document.createElement('img'); image.src = medal.art; image.alt = ''; image.width = image.height = 44;
      button.append(image);
    }
    const label = document.createElement('span'); label.textContent = medal?.title || '不加角标'; button.append(label);
    button.onclick = () => choosePhotoMedal(medal?.id || null);
    container.append(button);
  }
  container.setAttribute('aria-busy', String(photoAccentBusy));
  $('wood-photo-accent-note').textContent = photo?.saved
    ? `已随照片保存 · ${photo.medal?.title || '无角标'}。旧照片保留拍摄时的样子。`
    : medals.length ? '角标会一起进入预览、相册和下载图片；选择也会用于下一次拍摄。' : '先去巡护获得一枚勋章，就能把它带进照片。';
}
async function choosePhotoMedal(medalId) {
  if (!photo || photo.species!==activeSpecies || photo.saved || photo.saving || photoAccentBusy || !sourceFrame) return;
  const target = photo;
  photoAccentBusy = true; syncPhotoControls(); renderPhotoMedals();
  try {
    const updated = await window.helpaniPatrol?.equipMedal(medalId);
    if (!updated) throw new Error('角标暂时未能更新，请重试。');
    if (photo !== target || !photoDialog.open) return;
    target.medal = currentEquippedMedal();
    requestCrop(); await cropPending;
    if (target.ready) $('wood-photo-message').textContent = target.medal ? `已应用「${target.medal.title}」，这枚林间记忆会随照片一起保存。` : '已移除角标，照片构图保留。';
  } catch (error) {
    if (photo === target) $('wood-photo-message').textContent = error.message;
  } finally {
    photoAccentBusy = false;
    // A pending request may outlive its preview; release controls on the
    // current photo without changing that photo's captured medal selection.
    if (photo) { syncPhotoControls(); renderPhotoMedals(); }
  }
}
async function buildCrop() {
  if (!sourceFrame) return;
  const generation = ++cropGeneration;
  const targetPhoto = photo, frame = sourceFrame;
  const zoom = Number($('wood-crop').value), width = frame.width / zoom, height = frame.height / zoom;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000; const ctx = canvas.getContext('2d');
  ctx.drawImage(frame, (frame.width - width) * cropX, (frame.height - height) * cropY, width, height, 0, 0, 1600, 1000);
  const gradient = ctx.createLinearGradient(0,870,0,1000); gradient.addColorStop(0,'#142f2600'); gradient.addColorStop(1,'#142f26dc'); ctx.fillStyle=gradient; ctx.fillRect(0,870,1600,130);
  ctx.fillStyle='#fff5dd'; ctx.font='500 24px sans-serif'; ctx.fillText(window.HelpaniI18n.t(`${careSpecies[targetPhoto.species||'red-panda'].animal} · ${careSpecies[targetPhoto.species||'red-panda'].name}`),48,954); ctx.font='21px sans-serif'; ctx.textAlign='right'; ctx.fillText(window.HelpaniI18n.t('小镇影像 · 虚拟场景'),1552,954);
  await paintPhotoMedal(ctx, targetPhoto.medal, 1600, 1000);
  const blob = await new Promise((resolve,reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片生成失败，请重试。')), 'image/png'));
  if (generation !== cropGeneration || photo !== targetPhoto) return;
  targetPhoto.blob = blob; targetPhoto.ready = true; showBlob(blob);
}
let cropGeneration = 0, cropPending = Promise.resolve();
function requestCrop() {
  if(photo?.saving || photo?.saved)return;
  const targetPhoto=photo; targetPhoto.ready=false; syncPhotoControls();
  const requestedGeneration=cropGeneration+1;
  cropPending=buildCrop().then(() => { if(photo===targetPhoto) syncPhotoControls(); })
    .catch((error) => { if(photo===targetPhoto && cropGeneration===requestedGeneration) { $('wood-photo-message').textContent=error.message; syncPhotoControls(); } });
}
function capturePhoto() {
  if (!scene || !patrolController?.state()) return;
  $('wood-photo-title').textContent=`${meta().place}留影`;
  $('wood-photo-preview').alt=`${meta().animal}${meta().name}在玩家布置中的静态照片`;
  sourceFrame = scene.capture({watermark:false}); photo = {id:crypto.randomUUID(),createdAt:new Date().toISOString(),snapshot:scene.snapshot(),species:activeSpecies,medal:currentEquippedMedal(),saved:false,ready:false};
  cropX=cropY=.5; $('wood-crop').disabled=false; $('wood-crop').value=1; $('wood-crop-label').hidden=false; $('wood-photo-retake').hidden=false; $('wood-photo-save').textContent='保存到相册'; $('wood-photo-message').textContent='快门已冻结这一刻。拖动与裁切只改变这张照片。';
  renderPhotoMedals(); requestCrop(); photoDialog.showModal();
}
$('wood-shutter').onclick = capturePhoto;
$('wood-crop').oninput = requestCrop;
let cropPointer;
$('wood-photo-preview').onpointerdown = (event) => { if (!sourceFrame || photo.saved || photo.saving || photoAccentBusy) return; event.preventDefault(); cropPointer={x:event.clientX,y:event.clientY}; event.target.setPointerCapture(event.pointerId); };
$('wood-photo-preview').onpointermove = (event) => { if (!cropPointer) return; cropX = Math.min(1,Math.max(0,cropX-(event.clientX-cropPointer.x)/250)); cropY = Math.min(1,Math.max(0,cropY-(event.clientY-cropPointer.y)/250)); cropPointer={x:event.clientX,y:event.clientY}; requestCrop(); };
$('wood-photo-preview').onpointerup = $('wood-photo-preview').onpointercancel = () => { cropPointer=null; };
$('wood-photo-save').onclick = async () => {
  const target=photo, pending=cropPending;
  if (!target || target.saved || target.saving || photoAccentBusy) return;
  target.saving=true; $('wood-crop').disabled=true; $('wood-photo-save').disabled=true;
  renderPhotoMedals();
  try {
    await pending;
    if (!target.blob || !target.ready) throw new Error('照片尚未生成，请重试或调整角标。');
    const persisted={id:target.id,createdAt:target.createdAt,snapshot:structuredClone(target.snapshot),blob:target.blob,species:target.species||'red-panda',medal:target.medal ? {...target.medal} : null};
    await savePhoto(persisted); target.blob=persisted.blob; target.saved=true;
    if (photo!==target) return;
    $('wood-photo-save').textContent='已保存'; $('wood-crop-label').hidden=true; sourceFrame=null;
    $('wood-photo-message').textContent='已保存到当前浏览器相册，可以下载留存。';
  } catch (error) {
    if (photo!==target) return;
    $('wood-photo-message').textContent=`保存失败，预览仍保留：${error.message}`; $('wood-photo-save').disabled=false;
  } finally { target.saving=false; if(photo===target) { syncPhotoControls(); renderPhotoMedals(); } }
};
$('wood-photo-download').onclick = async () => { await cropPending; if (!photo?.blob || !photo.ready || photoAccentBusy) return; const a=document.createElement('a'); a.href=photoURL; a.download=`Helpani-${window.HelpaniI18n.t(careSpecies[photo.species||'red-panda'].name)}-${photo.createdAt.replace(/[:.]/g,'-')}.png`; document.body.append(a); a.click(); a.remove(); };
$('wood-photo-close').onclick = () => photoDialog.close();
$('wood-photo-retake').onclick = () => photoDialog.close();
let albumGeneration=0;
$('wood-album-dialog').addEventListener('close',()=>{albumGeneration++;});
$('wood-album').onclick = async () => {
  const generation=++albumGeneration;
  const dialog=$('wood-album-dialog'), grid=$('wood-album-grid'); grid.replaceChildren(); dialog.showModal();
  try {
    await openAlbum(); const photos=await listPhotos(); if(generation!==albumGeneration || !dialog.open)return; if (!photos.length) { const p=document.createElement('p'); p.textContent='还没有照片。打开相机，留下第一个喜欢的瞬间。'; grid.append(p); }
    for (const saved of photos) { const button=document.createElement('button'), img=document.createElement('img'), label=document.createElement('span'); const url=URL.createObjectURL(saved.blob); img.src=url; img.alt=`${careSpecies[saved.species||'red-panda'].name}的栖地照片`; label.textContent=careSpecies[saved.species||'red-panda'].animal+' · '+new Date(saved.createdAt).toLocaleString(window.HelpaniI18n.locale)+(saved.medal?` · ${saved.medal.title}`:''); button.append(img,label); grid.append(button); button.onclick=() => { cropGeneration++; cropPending=Promise.resolve(); photo={...saved,saved:true,ready:true}; $('wood-photo-title').textContent=careSpecies[saved.species||'red-panda'].place+'留影'; $('wood-photo-preview').alt=careSpecies[saved.species||'red-panda'].animal+'的栖地照片'; sourceFrame=null; showBlob(saved.blob); $('wood-crop-label').hidden=true; $('wood-photo-retake').hidden=true; $('wood-photo-save').disabled=true; $('wood-photo-download').disabled=false; $('wood-photo-save').textContent='已保存'; $('wood-photo-message').textContent=window.HelpaniI18n.sourceText(label); renderPhotoMedals(); photoDialog.showModal(); }; dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true}); }
  } catch (error) { grid.textContent=`相册暂时无法读取：${error.message}`; }
};
$('wood-album-close').onclick = () => $('wood-album-dialog').close();
// An inspectable snapshot is useful for reproducible browser acceptance; it cannot grant game rewards.
window.helpaniHabitat = window.helpaniWoodland = { snapshot:()=>scene?.snapshot(), state:()=>structuredClone(habitat), species:()=>activeSpecies, ready:()=>enabled&&Boolean(scene), refresh:refreshHabitat, command, notice };
