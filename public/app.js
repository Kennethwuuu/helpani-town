const element = (id) => document.getElementById(id);
const money = (cents) => `US$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const routePages = { '/': 'town', '/woodland': 'town', '/stories': 'stories', '/activities': 'activities', '/support': 'support' };
const legacyRoutes = {
  '#story': '/stories', '#story-summary': '/stories', '#town-archive': '/stories',
  '#activities': '/activities', '#exchange': '/activities',
  '#project': '/support', '#project-update': '/support', '#records': '/support',
};

const pets = {
  'sea-turtle': {
    name: '阿潮',
    species: '绿海龟',
    image: '/tidepool.svg',
    background: '/tidepool-habitat.svg', sprite: '/tidepool-pet.svg',
    habitat: '潮汐湾 · 浅水观察区',
    reaction: '阿潮游了一个小圈，把鼻尖探出了水面。',
    greetings: ['阿潮吐出一串小泡泡。', '阿潮朝你摆了摆前鳍。'],
  },
  'red-panda': {
    name: '竹竹',
    species: '小熊猫',
    image: '/red-panda.svg',
    background: '/red-panda-habitat.svg', sprite: '/red-panda-pet.svg',
    habitat: '竹影林 · 林地树屋',
    reaction: '竹竹抱住竹枝，尾巴从木桥边垂了下来。',
    greetings: ['竹竹从枝叶里探出一对圆耳朵。', '竹竹把尾巴轻轻晃了两下。'],
  },
  pangolin: {
    name: '小松',
    species: '中华穿山甲',
    image: '/pangolin.svg',
    background: '/pangolin-habitat.svg', sprite: '/pangolin-pet.svg',
    habitat: '蕨叶谷 · 林下休息地',
    reaction: '小松从叶堆里钻了出来，轻轻甩掉背上的落叶。',
    greetings: ['小松从落叶里探出鼻尖。', '小松抖掉背上的一片小叶子。'],
  },
};
const chapterThresholds = [1, 3, 5, 6];
const speciesCount = Object.keys(pets).length;
const sceneAsset = (path) => `${path}?v=20261110-pet-scene`;
const idleBehaviors = {
  'sea-turtle': [
    { name: 'swim', label: '阿潮沿着浅湾慢慢游动。' },
    { name: 'surface', label: '阿潮探近水面，换一口气。' },
    { name: 'rest', label: '阿潮停在海草旁，歇一会儿。' },
  ],
  'red-panda': [
    { name: 'climb', label: '竹竹顺着树枝向上爬。' },
    { name: 'rest', label: '竹竹靠着树枝歇一会儿。' },
    { name: 'peek', label: '竹竹从枝叶后探出头来。' },
  ],
  pangolin: [
    { name: 'peek', label: '小松从洞口附近探了探鼻尖。' },
    { name: 'dig', label: '小松用前爪刨开松软的泥土。' },
    { name: 'retreat', label: '小松钻进洞里，又悄悄探出头。' },
  ],
};

const activities = {
  'park-cleanup': {
    category: '水鸟栖地 · 上海演示',
    title: '湿地净滩｜给水鸟留一片浅滩',
    description: '沿示例湿地步道清理遗落的塑料和鱼线，为觅食和停歇的水鸟留出空间。',
    details: '周六上午 · 约 60 分钟 · 栖湾自然小队（演示）',
  },
  'bird-safe-windows': {
    category: '鸟类友好社区 · 上海演示',
    title: '防鸟撞工作坊｜给玻璃贴上记号',
    description: '和邻居一起辨认容易反光的玻璃，并为示例社区公共窗面布置可见标记。',
    details: '周日下午 · 约 45 分钟 · 羽邻志愿组（演示）',
  },
};

const adoptionButtons = [...document.querySelectorAll('[data-adopt]')];
const controls = {
  checkIn: element('check-in'),
  feed: element('feed'),
  nextDay: element('demo-next-day'),
  claimMedal: element('claim-medal'),
  exchange: element('exchange'),
  allocate: element('allocate'),
  donate: element('donate'),
  supply: element('supply'),
};
const scene = element('pet-image').closest('.landscape');
const careFeedback = element('pet-action-feedback');
const petTouch = element('pet-touch');
const sceneFeed = element('scene-feed');
const mobileDock = element('mobile-dock');
const dragSnack = element('scene-drag-snack');
const activePage = showPage();
const woodlandVisit = location.pathname === '/woodland';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let current;
let busy = false;
let exchangeRequestId;
let petMotionTimer;
let choosingNext = activePage === 'town' && new URLSearchParams(location.search).get('choose') === 'next';
let greetingIndex = 0;
let greetingTimer;
let sceneNoticeTimer;
let snackDrag;
let suppressSnackClick = false;
let illustrationReplay = 0;
let behaviorTimer;
let behaviorStep = 0;
let behaviorVisible = false;
let activityPaused = false;
let arrivalTimer;
let medalTimer;
let townMutation = 0, townLoad = 0;
let sceneAssetsTarget = null, sceneAssetsGeneration = 0;

function feedback(message, tone = 'normal') {
  const notice = element('feedback');
  notice.dataset.tone = tone;
  notice.textContent = message;
  notice.hidden = !message;
}

function showPage() {
  const url = new URL(location.href);
  if (url.pathname === '/woodland') { url.pathname='/'; url.hash='playroom'; history.replaceState(null,'',url); }
  if (url.pathname === '/') {
    if (url.searchParams.has('payment')) {
      url.pathname = '/support';
      url.hash = 'records';
    } else {
      url.pathname = legacyRoutes[url.hash] ?? (url.hash.startsWith('#activity-') ? '/activities' : '/');
    }
    if (url.pathname !== '/') history.replaceState(null, '', url);
  }
  const page = routePages[url.pathname] ?? 'town';
  document.body.classList.toggle('woodland-visit', url.pathname === '/woodland');
  for (const section of document.querySelectorAll('[data-page]')) {
    section.hidden = section.dataset.page !== page;
  }
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
  }
  const title = { stories: '伙伴故事', activities: '保护活动', support: '救助与支持' }[page];
  if (title) document.title = `${title} · Helpani Town`;
  if (url.pathname === '/woodland') document.title = '探望竹竹 · 小熊猫林地';
  return page;
}

function closeNextAdoption() {
  if (!choosingNext) return;
  choosingNext = false;
  const url = new URL(location.href);
  url.searchParams.delete('choose');
  url.hash = 'playroom';
  history.replaceState(null, '', url);
}

function make(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function renderRecords(state) {
  const list = element('record-list');
  const records = state.payments.map((payment) => {
    const supply = payment.kind === 'supply';
    const completed = payment.status === 'completed';
    return {
      title: supply ? '遮光护理布 · 物资出资' : '海龟夜间观察站 · 捐助',
      detail: `${money(payment.amountCents)} · 沙箱测试资金`,
      fulfillment: supply && completed ? '物资待采购（演示）' : null,
      badge: completed ? '沙箱付款完成' : '沙箱付款处理中',
      completed,
    };
  });

  if (state.allocatedCents) {
    records.unshift({
      title: '海龟夜间观察站 · 赞助额度',
      detail: `${money(state.allocatedCents)} · 模拟预算，尚无拨付`,
      badge: '演示额度已预留',
      completed: false,
    });
  }
  if (state.foodExchanges) {
    records.push({
      title: '小镇补给站 · 照护粮兑换',
      detail: `累计使用 ${state.foodExchanges * 50} 公益积分 · 获得 ${state.foodExchanges} 份虚拟照护粮`,
      badge: '虚拟道具',
      completed: true,
    });
  }
  for (const [id, status] of Object.entries(state.activities)) {
    if (status === 'open') continue;
    const verified = status === 'verified';
    records.push({
      title: activities[id].title,
      detail: verified ? '演示组织方核验 · 获得 100 公益积分' : '上海样例活动 · 报名未发放积分',
      badge: verified ? '模拟核验完成' : '模拟报名',
      completed: verified,
    });
  }

  list.replaceChildren();
  if (!records.length) list.append(make('li', '还没有参与记录。', 'empty-record'));
  for (const record of records) {
    const row = make('li');
    const copy = make('div');
    copy.append(make('strong', record.title), make('p', record.detail));
    if (record.fulfillment) copy.append(make('p', record.fulfillment));
    row.append(copy, make('span', record.badge, record.completed ? 'tag tag-green' : 'tag tag-yellow'));
    list.append(row);
  }
}

function canAdoptNext(state) {
  return state.medals.includes(state.pet?.species) && state.medals.length < speciesCount;
}

function chapterList(species, unlocked) {
  return petStories[species].map(({ title, narrative, topic, fact, sources, art }, index) => {
    const locked = index >= unlocked;
    const row = make('li', null, locked ? 'chapter is-locked' : 'chapter');
    const number = `第 ${index + 1} 章`;
    row.append(make('p', locked ? `${number} · 待解锁` : `${number} · 虚拟来信`, 'chapter-kicker'), make('h3', title));
    if (locked) {
      row.append(make('p', `累计照护 ${chapterThresholds[index]} 次后解锁`, 'chapter-locked-copy'));
      return row;
    }
    const content = make('div', null, 'chapter-content');
    const artwork = make('div', null, 'chapter-art');
    const illustration = make('img', null, 'chapter-illustration');
    illustration.alt = art.alt;
    illustration.width = 720;
    illustration.height = 300;
    illustration.loading = 'lazy';
    illustration.decoding = 'async';
    illustration.src = art.src;
    const replay = make('button', '重播动图', 'chapter-replay');
    replay.type = 'button';
    replay.setAttribute('aria-label', `重播动图 · ${title}`);
    replay.addEventListener('click', () => {
      illustrationReplay += 1;
      illustration.src = `${art.src}?replay=${illustrationReplay}`;
    });
    artwork.append(illustration, replay);
    const notes = make('div', null, 'chapter-field-note');
    const links = make('div', null, 'chapter-sources');
    for (const { label, url } of sources) {
      const link = make('a', label, 'chapter-source');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.append(link);
    }
    notes.append(make('strong', `野外笔记 · ${topic}`), make('p', fact), links);
    content.append(make('p', narrative, 'chapter-story'), artwork, notes);
    row.append(content);
    return row;
  });
}

function renderStory(state, unlocked) {
  const { species } = state.pet;
  const total = petStories[species].length;
  const complete = unlocked === total;
  const earned = state.medals.includes(species);
  element('story-title').textContent = `${pets[species].name}的故事`;
  element('story-status').textContent = `已解锁 ${unlocked} / ${total} 章`;
  const copy = element('story-copy');
  const key = `${species}:${unlocked}`;
  if (copy.dataset.key !== key) {
    copy.replaceChildren(...chapterList(species, unlocked));
    [...copy.children].forEach((chapter, index) => {
      chapter.id = `chapter-${species}-${index + 1}`;
    });
    copy.dataset.key = key;
  }
  element('completion-panel').hidden = !complete;
  element('medal-celebration').hidden = !earned;
  element('medal-celebration-name').textContent = `${pets[species].species}保护勋章`;
  element('completion-title').textContent = earned ? `已获得${pets[species].species}保护勋章` : `${pets[species].name}的故事走到了终章`;
  element('completion-copy').textContent = earned
    ? state.medals.length === speciesCount ? '三枚保护勋章已集齐，三条故事都可以重读。' : '勋章和四章故事已收入勋章册。'
    : '读完四章，就能把这段故事收进守护勋章册。';
  controls.claimMedal.hidden = earned;
  controls.claimMedal.disabled = busy || !complete || earned;
  element('next-adoption-link').hidden = !canAdoptNext(state);
  element('archive-jump').hidden = !earned;
}

function renderArchive(medals) {
  element('town-archive').hidden = !medals.length;
  element('medal-count').textContent = `${medals.length} / ${speciesCount} 枚`;
  const list = element('archive-list');
  const key = medals.join(',');
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.replaceChildren(...medals.map((species) => {
    const pet = pets[species];
    const story = make('details', null, 'archive-story');
    story.dataset.species = species;
    const summary = make('summary');
    const emblem = make('span', '✦', 'archive-emblem');
    emblem.setAttribute('aria-hidden', 'true');
    const label = make('span', `${pet.species}保护勋章`);
    label.append(make('small', `重读${pet.name}的故事`));
    const chapters = make('ol', null, 'chapter-list');
    chapters.append(...chapterList(species, petStories[species].length));
    summary.append(emblem, label);
    story.append(summary, chapters);
    return story;
  }));
}

function renderOnboarding(state) {
  const pet = state.pet;
  const complete = Boolean(pet?.feedCount) || state.medals.length > 0;
  element('first-steps').hidden = complete;
  if (complete) return;
  const step = !pet ? 'adopt' : pet.encountered ? 'feed' : 'interact';
  const finished = { adopt: Boolean(pet), interact: Boolean(pet?.encountered), feed: false };
  for (const name of ['adopt', 'interact', 'feed']) {
    const item = element(`onboarding-${name}`);
    item.classList.toggle('is-done', finished[name]);
    item.classList.toggle('is-current', step === name);
    if (step === name) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  const action = element('onboarding-action');
  action.disabled = busy;
  action.dataset.step = step;
  const copy = element('onboarding-copy');
  if (step === 'adopt') {
    action.textContent = '去选一位伙伴';
    copy.textContent = '先选一只想认识的动物。领养后会得到一份虚拟照护粮。';
  } else if (step === 'interact') {
    action.textContent = `和${pets[pet.species].name}打个招呼`;
    copy.textContent = '轻点画面里的伙伴，看看它会有什么反应。';
  } else {
    action.textContent = '喂第一餐，收第一封信';
    copy.textContent = '用一份虚拟照护粮喂食，就能解锁故事第一章。';
    action.disabled = controls.feed.disabled;
  }
}

function finishArrival() {
  clearTimeout(arrivalTimer);
  scene.classList.remove('is-arriving');
  element('pet-arrival').hidden = true;
}

function celebrateArrival(state) {
  finishArrival();
  stopBehavior();
  element('pet-arrival-name').textContent = `${pets[state.pet.species].name}来啦`;
  element('pet-arrival').hidden = false;
  scene.getBoundingClientRect();
  scene.classList.add('is-arriving');
  arrivalTimer = setTimeout(() => {
    finishArrival();
    queueBehavior(1400);
  }, 1200);
}

function showLetterReward(state, chapter) {
  const { species } = state.pet;
  element('letter-reward-title').textContent = `${pets[species].name}寄来${chapter === 0 ? '第一封' : '一封新'}来信`;
  element('letter-reward-copy').textContent = `《${petStories[species][chapter].title}》已解锁。来信和野外笔记都保存在故事页。`;
  element('letter-reward-link').href = `/stories#chapter-${species}-${chapter + 1}`;
  const reward = element('letter-reward');
  reward.hidden = false;
  reward.classList.remove('is-revealed');
  reward.getBoundingClientRect();
  reward.classList.add('is-revealed');
}

function celebrateMedal(state, previous) {
  const species = state.pet.species;
  if (previous.medals.includes(species) || !state.medals.includes(species)) return;
  const medal = element('medal-celebration');
  clearTimeout(medalTimer);
  medal.classList.remove('is-awarded');
  medal.getBoundingClientRect();
  medal.classList.add('is-awarded');
  medalTimer = setTimeout(() => medal.classList.remove('is-awarded'), 1600);
}

function loadPetScene(species) {
  if (sceneAssetsTarget === species) return;
  sceneAssetsTarget = species;
  const generation = ++sceneAssetsGeneration;
  const image = element('pet-image'), sprite = element('pet-sprite');
  const loading = element('pet-scene-loading');
  scene.dataset.ready = 'false';
  scene.classList.add('is-scene-loading');
  loading.hidden = false;
  element('pet-scene-loading-copy').textContent = `正在迎接${pets[species].name}，布置它的栖地…`;
  element('pet-scene-retry').hidden = true;
  image.src = sceneAsset(pets[species].background);
  sprite.src = sceneAsset(pets[species].sprite);
  // Swap the background and character together. A slow/failed image must not
  // leave the previous animal or the thumbnail illustration under a new sprite.
  Promise.all([image.decode(), sprite.decode()]).then(() => {
    if (generation !== sceneAssetsGeneration || current?.pet?.species !== species) return;
    scene.dataset.ready = 'true';
    scene.classList.remove('is-scene-loading');
    loading.hidden = true;
    render();
    queueBehavior(1400);
  }).catch(() => {
    if (generation !== sceneAssetsGeneration || current?.pet?.species !== species) return;
    element('pet-scene-loading-copy').textContent = `${pets[species].name}的栖地图片暂时未能加载，领养进度已保留。`;
    element('pet-scene-retry').hidden = false;
    render();
  });
}

function renderPet(state) {
  const isChoosing = choosingNext && canAdoptNext(state);
  const showAdoption = !state.pet || isChoosing;
  element('adoption-panel').hidden = !showAdoption;
  element('adopt-heading').textContent = isChoosing ? '下一位伙伴想选谁？' : '今天谁来住进小镇？';
  element('cancel-adoption').hidden = !isChoosing;
  element('care-panel').hidden = showAdoption;
  element('story').hidden = !state.pet;
  element('stories-empty').hidden = Boolean(state.pet);
  petTouch.hidden = showAdoption;
  sceneFeed.hidden = showAdoption;
  element('pangolin-den').hidden = showAdoption || state.pet?.species !== 'pangolin';
  element('pet-autonomy-toggle').hidden = showAdoption;
  element('pet-sprite').hidden = showAdoption;
  if (showAdoption) stopBehavior();
  adoptionButtons.forEach((button) => {
    const earned = state.medals.includes(button.dataset.adopt);
    button.disabled = busy || !showAdoption || earned;
    if (earned) button.querySelector('small').textContent = '已获保护勋章';
  });
  if (!state.pet) {
    sceneAssetsTarget = null; sceneAssetsGeneration += 1;
    finishArrival();
    delete scene.dataset.species;
    scene.dataset.ready = 'false';
    scene.classList.remove('is-scene-loading');
    element('pet-scene-loading').hidden = true;
    element('pet-image').src = sceneAsset('/tidepool-habitat.svg');
    element('pet-image').alt = '等待伙伴入住的虚拟栖地';
    element('pet-sprite').removeAttribute('src');
    element('pet-behavior-status').textContent = '';
    renderDailyLetter(state);
    return;
  }

  const { feedCount, feedsToday, species } = state.pet;
  const pet = pets[species];
  const chapters = petStories[species];
  const caredToday = Math.min(feedCount, feedsToday) > 0;
  petTouch.setAttribute('aria-label', `和${pet.name}打招呼`);
  element('pet-name').textContent = pet.name;
  element('pet-species').textContent = `${pet.species} · ${pet.habitat}`;
  if (scene.dataset.species !== species) {
    finishArrival();
    stopBehavior();
    behaviorStep = 0;
    greetingIndex = 0;
    element('scene-touch-notice').textContent = '';
    element('care-panel').classList.remove('is-greeted', 'is-fed', 'is-dawn');
    const image = element('pet-image');
    image.alt = `${pet.habitat}里的虚拟${pet.species}${pet.name}`;
    scene.dataset.species = species;
  }
  loadPetScene(species);
  petTouch.disabled = busy || scene.dataset.ready !== 'true';
  const autonomy = element('pet-autonomy-toggle');
  autonomy.disabled = reducedMotion.matches;
  autonomy.textContent = reducedMotion.matches ? '静态观察' : activityPaused ? '继续活动' : '暂停活动';
  autonomy.setAttribute('aria-pressed', String(activityPaused));
  if (!behaviorTimer && !showAdoption) queueBehavior(1400);

  const unlocked = chapterThresholds.filter((threshold) => feedCount >= threshold).length;
  element('pet-stage').textContent = state.medals.includes(species)
    ? '已获保护勋章'
    : ['刚到小镇', '开始熟悉', '信任加深', '故事接近尾声', '故事全解锁'][unlocked];
  element('pet-progress').max = chapterThresholds.at(-1);
  element('pet-progress').value = feedCount;
  element('pet-progress-copy').textContent = `成长手记 ${unlocked} / ${chapterThresholds.length} 篇 · 今日照护 ${feedsToday} / 2 次`;
  element('pet-message').textContent = feedCount === 0
    ? `${pet.name}刚到小镇，试着喂它一份照护粮。`
    : caredToday ? pet.reaction : `${pet.name}在熟悉的栖地等你回来。`;

  const next = chapterThresholds[unlocked];
  const nextStory = next ? `再照护 ${next - feedCount} 次就能读到《${chapters[unlocked].title}》。` : '四章故事已解锁。';
  element('pet-next').textContent = feedsToday >= 2 ? `今天的照护已完成。明天可领取免费照护粮。 ${nextStory}` : nextStory;
  element('story-jump').hidden = false;
  element('story-jump').textContent = next ? '打开伙伴故事' : '读终章与保护勋章';
  renderStory(state, unlocked);

  controls.checkIn.disabled = busy || !state.checkInAvailable;
  controls.checkIn.textContent = state.checkInAvailable ? '领取今日免费粮 ＋1' : '今日免费粮已领取';
  const habitatReady=activePage==='town'&&!showAdoption ? Boolean(window.helpaniWoodland?.ready()&&window.helpaniWoodland.species()===species) : scene.dataset.ready==='true';
  controls.feed.disabled = busy || !habitatReady || state.food < 1 || feedsToday >= 2;
  controls.feed.textContent = feedsToday >= 2 ? '今天已照护 2 次' : '喂它 1 份照护粮';
  renderTouchControls(state);
  controls.nextDay.disabled = busy;
  const [, month, day] = state.gameDay.split('-');
  element('demo-date').textContent = `演示第 ${state.demoDay} 天 · ${Number(month)} 月 ${Number(day)} 日`;
  element('demo-day-story').hidden = state.demoDay < 2 || feedCount <= feedsToday;
  controls.exchange.disabled = busy || state.points < 50;

  renderDailyLetter(state, pet, chapters[unlocked - 1]);
}

function renderTouchControls(state) {
  const isDone = state.pet.feedsToday >= 2;
  const canClaimFood = !isDone && state.food < 1 && state.checkInAvailable;
  sceneFeed.disabled = busy || scene.dataset.ready !== 'true' || (controls.feed.disabled && !canClaimFood);
  sceneFeed.dataset.action = canClaimFood ? 'check-in' : 'feed';
  const label = isDone ? '今日完成' : canClaimFood ? '领免费粮' : '拖粮喂食';
  element('scene-feed-label').textContent = label;
  element('scene-feed-count').textContent = canClaimFood ? '＋1 份' : `${state.food} 份`;
  sceneFeed.setAttribute('aria-label', canClaimFood || isDone ? label : `拖粮喂食，也可点按。剩余 ${state.food} 份照护粮`);
}

function playPetMotion(animation, duration) {
  if(window.helpaniWoodland?.ready()&&window.helpaniWoodland.species()===current?.pet?.species){window.dispatchEvent(new CustomEvent('helpani-care-interaction',{detail:{species:current.pet.species,kind:animation==='is-fed'?'feed':'greet',message:animation==='is-fed'?`${pets[current.pet.species].name}收到这份虚拟照护粮了。`:'新的一天，伙伴的生活继续。'}}));return;}
  finishArrival();
  stopBehavior();
  clearTimeout(greetingTimer);
  const panel = element('care-panel');
  clearTimeout(petMotionTimer);
  panel.classList.remove('is-fed', 'is-dawn', 'is-greeted');
  const bounds = scene.getBoundingClientRect();
  const center = bounds.top + bounds.height / 2;
  if (center < 0 || center > window.innerHeight - mobileDock.offsetHeight) {
    scene.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  panel.classList.add(animation);
  element('pet-behavior-status').textContent = animation === 'is-fed' ? `${pets[current.pet.species].name}正在吃虚拟照护粮。` : '新的一天，栖地慢慢亮起来。';
  petMotionTimer = setTimeout(() => {
    panel.classList.remove(animation);
    stopBehavior();
    queueBehavior();
  }, duration);
}

function canObserve() {
  return !document.body.classList.contains('has-care-habitat') && activePage === 'town' && current?.pet && behaviorVisible && !document.hidden
    && scene.dataset.ready === 'true' && !element('care-panel').hidden && !activityPaused && !reducedMotion.matches;
}

function stopBehavior() {
  clearTimeout(behaviorTimer);
  behaviorTimer = undefined;
  delete scene.dataset.behavior;
  if (!current?.pet) return;
  const sprite = element('pet-sprite');
  const normal = sceneAsset(pets[current.pet.species].sprite);
  if (sprite.getAttribute('src') !== normal) sprite.src = normal;
  element('pet-behavior-status').textContent = activityPaused ? '活动已暂停，可以慢慢观察。' : `${pets[current.pet.species].name}在栖地里歇一会儿。`;
}

function queueBehavior(delay = 2600) {
  clearTimeout(behaviorTimer);
  behaviorTimer = undefined;
  if (!canObserve()) return;
  behaviorTimer = setTimeout(() => {
    behaviorTimer = undefined;
    if (!canObserve()) return;
    if (busy || snackDrag || scene.classList.contains('is-arriving') || element('care-panel').matches('.is-fed, .is-dawn, .is-greeted')) {
      queueBehavior(1200);
      return;
    }
    const sequence = idleBehaviors[current.pet.species];
    const behavior = sequence[behaviorStep % sequence.length];
    behaviorStep += 1;
    startBehavior(behavior, 3400);
  }, delay);
}

function startBehavior({ name, label }, duration, onFinish) {
  stopBehavior();
  if (current.pet.species === 'pangolin' && (name === 'curl' || name === 'dig')) {
    element('pet-sprite').src = sceneAsset(`/pangolin-${name === 'curl' ? 'curled' : 'dig'}.svg`);
  }
  scene.getBoundingClientRect();
  scene.dataset.behavior = name;
  element('pet-behavior-status').textContent = label;
  behaviorTimer = setTimeout(() => {
    stopBehavior();
    if (onFinish) onFinish();
    else queueBehavior();
  }, duration);
}

function showSceneNotice(message) {
  const notice = element('scene-touch-notice');
  clearTimeout(sceneNoticeTimer);
  notice.textContent = message;
  sceneNoticeTimer = setTimeout(() => { notice.textContent = ''; }, 2400);
}

function greetPet() {
  const pet = pets[current?.pet?.species];
  if (!pet || petTouch.hidden || busy) return;
  if(window.helpaniWoodland?.ready()&&window.helpaniWoodland.species()===current.pet.species){
    const message={pangolin:'小松注意到你的陪伴，轻轻抬了抬头。','sea-turtle':'阿潮轻摆前鳍，留下一串小泡泡。','red-panda':'竹竹看了看你，尾巴轻轻晃动。'}[current.pet.species];
    const react=()=>{window.dispatchEvent(new CustomEvent('helpani-care-interaction',{detail:{species:current.pet.species,kind:'touch',message}}));careFeedback.textContent=message;careFeedback.hidden=false;};
    if(!current.pet.encountered)return update('/api/pet/touch',{payload:{species:current.pet.species},notice:careFeedback,success:message,onSuccess:react});
    react();return;
  }
  finishArrival();
  const panel = element('care-panel');
  if (panel.matches('.is-fed, .is-dawn')) return;
  if (scene.dataset.behavior === 'curl' || scene.dataset.behavior === 'uncurl') {
    showSceneNotice('给小松一点安静，它会慢慢舒展开。');
    return;
  }
  const firstTouch = !current.pet.encountered;
  const shy = current.pet.species === 'pangolin' && firstTouch;
  const message = shy ? '小松受惊蜷起身体，鳞片朝外。给它一点安静。' : pet.greetings[greetingIndex++ % pet.greetings.length];
  stopBehavior();
  clearTimeout(greetingTimer);
  if (shy) {
    startBehavior({ name: 'curl', label: '小松正蜷着身体，保护柔软的腹部。' }, 2200, () => {
      startBehavior({ name: 'uncurl', label: '周围安静下来，小松慢慢舒展开。' }, 1200);
    });
  } else {
    panel.classList.remove('is-greeted');
    petTouch.getBoundingClientRect();
    panel.classList.add('is-greeted');
    greetingTimer = setTimeout(() => {
      panel.classList.remove('is-greeted');
      queueBehavior();
    }, 1100);
  }
  showSceneNotice(message);
  if (firstTouch) update('/api/pet/touch', {
    payload: { species: current.pet.species },
    notice: element('scene-touch-notice'),
    success: message,
  });
}

function snackOverPet(event) {
  return petTouch.contains(document.elementFromPoint(event.clientX, event.clientY));
}

function endSnackDrag(event, cancelled = false) {
  if (event.pointerId !== snackDrag?.pointerId) return;
  const { moved, species, day } = snackDrag;
  snackDrag = undefined;
  dragSnack.hidden = true;
  scene.classList.remove('is-dragging', 'is-drop-ready');
  if (!moved || cancelled) return;
  suppressSnackClick = true;
  if (snackOverPet(event) && species === current.pet?.species && day === current.gameDay) {
    feedPet(sceneFeed);
  } else {
    showSceneNotice('把照护粮拖到伙伴身上，再松手。');
  }
}

function renderDailyLetter(state, pet, chapter) {
  const title = element('daily-letter-title');
  const copy = element('daily-letter-copy');
  const status = element('daily-letter-status');
  const link = element('daily-letter-link');

  if (!pet) {
    status.textContent = '等一位小镇伙伴';
    title.textContent = '第一封来信还在路上';
    copy.textContent = '选一只虚拟伙伴，第一次照护后就能收到它的来信。';
    link.textContent = '去领养';
    link.href = '/#adopt-heading';
    return;
  }

  const caredToday = Math.min(state.pet.feedsToday, state.pet.feedCount) > 0;
  const canFeed = !caredToday && state.pet.feedsToday < 2 && state.food > 0;
  const canCheckIn = !caredToday && !canFeed && state.checkInAvailable;
  status.textContent = caredToday ? '今日已照护' : '今日待照护';
  title.textContent = chapter ? `《${chapter.title}》` : `${pet.name}的第一封来信`;
  copy.textContent = chapter ? chapter.narrative : `喂${pet.name}一份照护粮，读读它刚到小镇时的故事。`;

  if (canFeed) {
    link.textContent = `去照护${pet.name}`;
    link.href = '/#feed';
  } else if (canCheckIn) {
    link.textContent = '去领今日免费粮';
    link.href = '/#check-in';
  } else {
    link.textContent = '打开成长手记';
    link.href = '/stories#story-summary';
  }
}

function renderActivities(state) {
  const list = element('activity-list');
  const statuses = Object.entries(state.activities);
  const signedUp = statuses.find(([, status]) => status === 'signed_up');
  const open = statuses.find(([, status]) => status === 'open');
  const next = signedUp ?? open;
  const link = element('daily-activity-link');
  link.textContent = '查看参与记录';
  if (signedUp) link.textContent = '查看已报名活动';
  else if (open) link.textContent = `看看${activities[open[0]].title.split('｜')[0]}`;
  link.href = next ? `/activities#activity-${next[0]}` : '/support#records';

  list.replaceChildren(...Object.entries(activities).map(([id, activity]) => {
    const status = state.activities[id];
    const card = make('article', null, 'activity-card');
    card.id = `activity-${id}`;
    card.tabIndex = -1;
    card.append(
      make('div', activity.category, 'activity-kicker'),
      make('h3', activity.title),
      make('p', activity.description),
      make('p', activity.details, 'activity-meta'),
    );
    const actions = make('div', null, 'activity-actions');
    const badge = status === 'verified' ? '核验完成 · ＋100 分' : status === 'signed_up' ? '已报名 · 待核验' : '核验后 ＋100 公益积分';
    actions.append(make('span', badge, status === 'verified' ? 'tag tag-green' : 'tag tag-yellow'));
    if (status === 'open') {
      const button = make('button', '模拟报名', 'button secondary');
      button.type = 'button';
      button.dataset.activity = id;
      button.disabled = busy;
      button.setAttribute('aria-label', `${button.textContent}：${activity.title}`);
      actions.append(button);
    } else if (status === 'signed_up') {
      const link = make('a', '打开组织方演示台', 'button secondary');
      link.href = '/organizer';
      link.dataset.activity = id;
      actions.append(link);
    }
    card.append(actions);
    return card;
  }));
}

function render() {
  const state = current;
  if (!state) return;
  element('food').textContent = state.food;
  element('xp').textContent = state.xp;
  element('points').textContent = state.points;
  element('activity-points').textContent = state.points;
  element('support-points').textContent = state.points;
  element('budget').textContent = money(state.budgetCents);

  renderPet(state);
  renderOnboarding(state);
  renderArchive(state.medals);
  renderActivities(state);
  renderRecords(state);

  controls.allocate.disabled = busy || state.points < 100 || state.budgetCents < 200 || Boolean(state.allocatedCents);
  controls.allocate.textContent = state.allocatedCents ? '演示额度已预留' : '用 100 分预留 US$2';
  controls.donate.disabled = busy || !state.paypalEnabled;
  controls.supply.disabled = busy || !state.paypalEnabled;
  document.querySelectorAll('.paypal-hint').forEach((hint) => {
    hint.textContent = state.paypalEnabled
      ? '收款方为沙箱测试账户。付款记录与项目送达状态独立。'
      : '当前实例尚未配置 PayPal 沙箱。';
  });
  window.helpaniView = { state, busy, visible: activePage === 'town' && Boolean(state.pet) && !(choosingNext && canAdoptNext(state)) };
  window.dispatchEvent(new CustomEvent('helpani-state', { detail: window.helpaniView }));
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || '暂时无法完成，请稍后重试。');
    error.status = response.status;
    throw error;
  }
  return data;
}

function post(payload) {
  return payload === undefined ? { method: 'POST' } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

async function update(path, { payload, success, onSuccess, notice } = {}) {
  if (busy) return;
  const previous = current;
  townMutation += 1;
  busy = true;
  render();
  let message = '';
  let error = '';
  try {
    const next = await request(path, post(payload));
    if (path === '/api/pet/adopt' && payload.species !== 'random' && next.pet?.species !== payload.species) {
      const mismatch = new Error('领养结果与本次选择不一致，请刷新后重试；未确认新的领养。');
      mismatch.status = 409;
      throw mismatch;
    }
    current = next;
    message = typeof success === 'function' ? success(current, previous) : success;
  } catch (failure) {
    error = failure.message;
    if (failure.status === 409) {
      try { current = await request('/api/state'); } catch { /* Keep the last available state. */ }
    }
  } finally {
    busy = false;
    render();
    if (notice) {
      notice.textContent = error || message;
      notice.hidden = !(error || message);
      notice.dataset.tone = error ? 'error' : 'normal';
    } else {
      feedback(error || message, error ? 'error' : 'normal');
    }
    if (!error) onSuccess?.(current, previous);
  }
}

async function checkout(payload) {
  if (busy) return;
  busy = true;
  render();
  try {
    const { approvalUrl } = await request('/api/paypal/order', post(payload));
    const url = new URL(approvalUrl);
    const sandboxHost = url.hostname === 'www.sandbox.paypal.com' || url.hostname === 'sandbox.paypal.com';
    if (url.protocol !== 'https:' || !sandboxHost || url.port || url.username || url.password) {
      throw new Error('未取得有效的 PayPal 沙箱链接。');
    }
    window.location.assign(url.href);
  } catch (error) {
    feedback(error.message, 'error');
    busy = false;
    render();
  }
}

adoptionButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener('click', () => update('/api/pet/adopt', {
    payload: { species: button.dataset.adopt, previousSpecies: current.pet?.species ?? null },
    success: (state) => `欢迎${pets[state.pet.species].name}来到小镇，照护粮 ＋1。`,
    onSuccess: (state, previous) => {
      closeNextAdoption();
      element('letter-reward').hidden = true;
      for (const id of ['pet-action-feedback', 'demo-day-notice', 'medal-notice']) {
        element(id).textContent = '';
        element(id).hidden = true;
      }
      render();
      element('pet-name').focus({ preventScroll: true });
      element('playroom').scrollIntoView({ block: 'start', behavior: 'instant' });
      if (state.pet.species !== previous.pet?.species) celebrateArrival(state);
    },
  }));
});
element('cancel-adoption').addEventListener('click', () => {
  closeNextAdoption();
  render();
  element('pet-name').focus();
});
element('onboarding-action').addEventListener('click', (event) => {
  if (busy) return;
  const step = event.currentTarget.dataset.step;
  if (step === 'adopt') {
    element('adopt-heading').focus();
  } else {
    const inHabitat = window.helpaniWoodland?.ready();
    (inHabitat ? element('wood-canvas') : scene).scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const target = step === 'interact' ? (inHabitat ? element('wood-touch') : petTouch) : controls.feed;
    target.focus({ preventScroll: true });
    if (step === 'interact') greetPet();
    else feedPet(target);
  }
});
element('letter-reward-dismiss').addEventListener('click', () => {
  element('letter-reward').hidden = true;
  element('story-jump').focus({ preventScroll: true });
});
controls.claimMedal.addEventListener('click', () => update('/api/pet/medal', {
  payload: { species: current.pet.species },
  notice: element('medal-notice'),
  success: '勋章册已更新。',
  onSuccess: (state, previous) => {
    celebrateMedal(state, previous);
    element('completion-title').focus({ preventScroll: true });
  },
}));
function claimFood(trigger) {
  return update('/api/pet/check-in', {
    payload: { day: current.gameDay },
    notice: careFeedback,
    success: (state, previous) => state.food > previous.food
      ? '照护粮 ＋1 · 今天的免费粮已领取。'
      : '今天的免费粮已领取。',
    onSuccess: () => {
      const next = trigger === sceneFeed ? sceneFeed : controls.feed;
      if (!next.disabled) next.focus({ preventScroll: true });
    },
  });
}

function feedPet(trigger) {
  if (!current?.pet || busy || controls.feed.disabled) return;
  stopBehavior();
  const { species, feedsToday } = current.pet;
  const hadFocus = document.activeElement === trigger;
  return update('/api/pet/feed', {
    payload: { day: current.gameDay, slot: feedsToday + 1, species },
    notice: careFeedback,
    success: (state, previous) => {
      if (state.pet.feedCount <= previous.pet.feedCount) return '这次照护已记录。';
      const chapter = chapterThresholds.indexOf(state.pet.feedCount);
      const unlocked = chapter >= 0 ? ` 解锁《${petStories[state.pet.species][chapter].title}》。` : '';
      return `照护粮 −1 · 成长 ＋10 XP。${unlocked}`;
    },
    onSuccess: (state, previous) => {
      if (state.pet.feedCount > previous.pet.feedCount) {
        const chapter = chapterThresholds.indexOf(state.pet.feedCount);
        if (chapter >= 0) showLetterReward(state, chapter);
        playPetMotion('is-fed', 1800);
      }
      if (hadFocus && !trigger.disabled) trigger.focus({ preventScroll: true });
    },
  });
}

controls.checkIn.addEventListener('click', () => claimFood(controls.checkIn));
controls.feed.addEventListener('click', () => feedPet(controls.feed));
petTouch.addEventListener('click', greetPet);
sceneFeed.addEventListener('click', (event) => {
  if (suppressSnackClick && event.detail !== 0) {
    suppressSnackClick = false;
    return;
  }
  if (sceneFeed.dataset.action === 'check-in') claimFood(sceneFeed);
  else feedPet(sceneFeed);
});
sceneFeed.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || sceneFeed.disabled) return;
  suppressSnackClick = false;
  if (sceneFeed.dataset.action !== 'feed') return;
  stopBehavior();
  snackDrag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    species: current.pet.species,
    day: current.gameDay,
    moved: false,
  };
  sceneFeed.setPointerCapture(event.pointerId);
});
sceneFeed.addEventListener('pointermove', (event) => {
  if (event.pointerId !== snackDrag?.pointerId) return;
  if (!snackDrag.moved && Math.hypot(event.clientX - snackDrag.x, event.clientY - snackDrag.y) < 8) return;
  snackDrag.moved = true;
  const bounds = scene.getBoundingClientRect();
  dragSnack.style.left = `${event.clientX - bounds.left}px`;
  dragSnack.style.top = `${event.clientY - bounds.top}px`;
  dragSnack.hidden = false;
  scene.classList.add('is-dragging');
  scene.classList.toggle('is-drop-ready', snackOverPet(event));
});
sceneFeed.addEventListener('pointerup', (event) => endSnackDrag(event));
sceneFeed.addEventListener('pointercancel', (event) => endSnackDrag(event, true));
sceneFeed.addEventListener('lostpointercapture', (event) => endSnackDrag(event, true));
controls.nextDay.addEventListener('click', () => update('/api/demo/next-day', {
  payload: { day: current.gameDay },
  notice: element('demo-day-notice'),
  success: (state) => state.pet.feedCount > 0
    ? '新的一天到了！之前解锁的来信还在。'
    : '新的一天到了！可以开始今天的照护。',
  onSuccess: (state, previous) => {
    if (state.gameDay !== previous.gameDay) {
      careFeedback.textContent = '';
      careFeedback.hidden = true;
      playPetMotion('is-dawn', 1300);
    }
    controls.nextDay.focus({ preventScroll: true });
  },
}));
controls.exchange.addEventListener('click', () => {
  exchangeRequestId ??= crypto.randomUUID();
  update('/api/pet/exchange', {
    payload: { requestId: exchangeRequestId },
    notice: element('exchange-notice'),
    success: '已用 50 公益积分换取 1 份虚拟照护粮。',
    onSuccess: () => { exchangeRequestId = undefined; },
  });
});
element('activity-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-activity]');
  if (!button) return;
  const id = button.dataset.activity;
  update('/api/activity/signup', {
    payload: { id },
    notice: element('activity-notice'),
    success: '已模拟报名。打开组织方演示台确认出席后，积分才会到账。',
    onSuccess: () => {
      const nextButton = element('activity-list').querySelector(`[data-activity="${id}"]`);
      if (nextButton) nextButton.focus({ preventScroll: true });
    },
  });
});
controls.allocate.addEventListener('click', () => update('/api/sponsor/allocate', {
  notice: element('sponsor-notice'),
  success: '已预留 US$2 演示赞助额度。支持记录已更新。',
}));
controls.supply.addEventListener('click', () => checkout({ kind: 'supply' }));
element('daily-project-update').textContent = window.HelpaniI18n.sourceText(element('project-update-title'));
element('daily-project-meta').textContent = window.HelpaniI18n.sourceText(element('project-update-meta'));
element('daily-project-status').textContent = window.HelpaniI18n.sourceText(element('project-update-status'));
element('donation').addEventListener('submit', (event) => {
  event.preventDefault();
  const amountCents = Number(new FormData(event.currentTarget).get('amount'));
  checkout({ kind: 'donation', amountCents });
});

async function load(restoreAnchor = false) {
  if (busy) return;
  const generation = ++townLoad, mutation = townMutation;
  try {
    const latest = await request('/api/state');
    if (busy || mutation !== townMutation || generation !== townLoad) return;
    current = latest;
    render();
    const url = new URL(window.location.href);
    if (restoreAnchor) {
      if (activePage === 'stories' && current.pet) element('story').open = true;
      const target = element(url.hash.slice(1));
      if (target?.getClientRects().length) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    const result = url.searchParams.get('payment');
    if (result) {
      const completed = current.payments.filter((payment) => payment.status === 'completed').length;
      const pending = current.payments.filter((payment) => payment.status === 'pending').length;
      const summary = [completed && `已完成 ${completed} 笔`, pending && `处理中 ${pending} 笔`].filter(Boolean);
      // The return URL cannot identify a payment in this state response; only summarize the server ledger.
      const confirmation = summary.length
        ? `当前 PayPal 沙箱付款记录：${summary.join('，')}。请查看下方明细。`
        : '暂未查到 PayPal 沙箱付款确认记录，请核对下方支持记录。';
      const messages = {
        completed: confirmation,
        pending: confirmation,
        cancelled: '已从 PayPal 沙箱返回。请查看下方支持记录，也可以重新发起测试。',
        error: '本次返回未能确认付款结果，请核对下方支持记录。',
      };
      if (Object.hasOwn(messages, result)) {
        const notice = element('payment-feedback');
        notice.textContent = messages[result];
        notice.dataset.tone = result === 'error' || (['completed', 'pending'].includes(result) && !summary.length) ? 'error' : 'normal';
        notice.hidden = false;
      }
      url.searchParams.delete('payment');
      history.replaceState(null, '', url);
    }
  } catch {
    if (mutation !== townMutation || generation !== townLoad) return;
    feedback('未能读取小镇，请刷新后重试。', 'error');
    element('record-list').replaceChildren(make('li', '暂时无法读取演示记录。', 'empty-record'));
  }
}

element('pet-scene-retry').addEventListener('click', () => {
  if (!current?.pet) return;
  sceneAssetsTarget = null;
  render();
});

element('pet-autonomy-toggle').addEventListener('click', () => {
  activityPaused = !activityPaused;
  stopBehavior();
  render();
});
const habitatObserver = new IntersectionObserver(([entry]) => {
  behaviorVisible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
  if (behaviorVisible) queueBehavior(1400);
  else stopBehavior();
}, { threshold: 0.2 });
habitatObserver.observe(scene);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    finishArrival();
    stopBehavior();
  } else queueBehavior(1400);
});
reducedMotion.addEventListener('change', () => {
  stopBehavior();
  if (current) render();
});
window.addEventListener('pagehide', () => {
  finishArrival();
  stopBehavior();
});
window.helpaniCare={greet:greetPet};
window.addEventListener('helpani-woodland-ready',()=>{if(current)render();});
load(true);
window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
