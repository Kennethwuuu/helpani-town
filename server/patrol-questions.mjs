// Educational facts are kept on the server. Pending events expose only the
// question and choices; explanations and answers are returned after settlement.
// Fictional patrol situations connect the facts to the virtual woodland.
const smithsonian = { title: '史密森尼国家动物园 · 小熊猫', url: 'https://nationalzoo.si.edu/animals/red-panda' };
const sanDiego = { title: '圣迭戈动物园 · 小熊猫', url: 'https://animals.sandiegozoo.org/animals/red-panda' };
const wwf = { title: '世界自然基金会 · 小熊猫栖地', url: 'https://www.worldwildlife.org/species/red-panda/' };

export const questions = [
  {
    id: 'tail-balance', topic: 'canopy', themes: ['rest'], title: '树枝上的大尾巴',
    text: '竹竹走上细细的枝杈，尾巴轻轻摆动。小熊猫长而蓬松的尾巴，在树上主要能帮什么忙？',
    choices: [{ id: 'a', label: '卷住枝条，用尾巴承受体重' }, { id: 'b', label: '帮助身体保持平衡' }, { id: 'c', label: '展开尾毛，像飞鼠一样滑翔' }],
    correctChoiceId: 'b',
    misconceptions: {
      a: '尾巴不能像手一样抓住枝条。抓稳树枝的是脚掌与爪，尾巴帮助身体保持平衡。',
      c: '小熊猫没有飞鼠的滑翔膜。蓬松的尾巴帮助平衡和保暖，不能让它滑翔。',
    },
    explanation: '小熊猫的长尾巴能帮助它在树上保持平衡，不能像手一样抓住树枝。休息时，它也会用蓬松的尾巴包裹身体，帮助保暖。',
    source: smithsonian,
    observationPrompt: '回到竹影林，看看竹竹攀爬、转身时，尾巴怎样配合身体移动。',
    candidates: ['canopy-listener', 'trail-finder'],
  },
  {
    id: 'dusk-activity', topic: 'tracks', themes: ['rest'], title: '傍晚的邀约',
    text: '林间的光线渐渐柔和。现实中的小熊猫通常更容易在什么时段活跃？',
    choices: [{ id: 'a', label: '清晨或傍晚，天气比较凉快时' }, { id: 'b', label: '正午日照最强、最温暖的时候' }, { id: 'c', label: '只在完全入夜后，白天绝不会活动' }],
    correctChoiceId: 'a',
    misconceptions: {
      b: '小熊猫更偏好凉爽环境，通常在清晨和傍晚更活跃；正午强烈日照并不是典型的活跃条件。',
      c: '“通常在晨昏更活跃”不等于只在深夜活动。个体和环境也会影响它的作息。',
    },
    explanation: '小熊猫通常在晨昏更活跃，也更偏好凉爽天气，并非其他时段完全不活动。个体和环境会影响作息；游戏采用压缩时间，答案不会命令竹竹立刻起身。',
    source: smithsonian,
    observationPrompt: '回到竹影林，等一等竹竹从枝杈休息到起身探索的完整过程。',
    candidates: ['trail-finder', 'canopy-listener'],
  },
  {
    id: 'bamboo-energy', topic: 'tracks', themes: ['rest'], title: '吃竹子的慢生活',
    text: '巡护手记写着：小熊猫花不少时间吃竹叶，也常常休息。两件事之间有什么联系？',
    choices: [{ id: 'a', label: '能像牛一样反刍，从竹子中获取充足能量' }, { id: 'b', label: '竹叶只是零食，主要靠水果获取能量' }, { id: 'c', label: '竹子能量有限又难消化，需要节省体力' }],
    correctChoiceId: 'c',
    misconceptions: {
      a: '小熊猫不能像牛一样反刍。它的消化系统对竹子利用有限，节省体力很重要。',
      b: '竹子是小熊猫的主要食物，水果并不是主要能量来源。取食与休息是适应这份菜单的一部分。',
    },
    explanation: '竹子是小熊猫的主要食物，却是低能量、难消化的食物。花时间取食和节省体力，都是适应这份菜单的办法；休息也是它们正常生活的一部分。',
    source: sanDiego,
    observationPrompt: '回到竹影林，观察探索与休息怎样交替，不用催促竹竹一直活动。',
    candidates: ['trail-finder', 'leaf-reader'],
  },
  {
    id: 'panda-family', topic: 'tracks', themes: ['rest'], title: '名字里的“熊猫”',
    text: '小熊猫和大熊猫都爱吃竹子，名字里也都有“熊猫”。它们的亲缘关系是怎样的？',
    choices: [{ id: 'a', label: '都属于熊科，只是体型和毛色不同' }, { id: 'b', label: '小熊猫有独立的小熊猫科，和大熊猫并非近亲' }, { id: 'c', label: '环纹长尾说明小熊猫属于浣熊科' }],
    correctChoiceId: 'b',
    misconceptions: {
      a: '名字里都有“熊猫”不代表同属熊科。小熊猫属于独立的小熊猫科。',
      c: '相似的环纹尾巴不足以判断亲缘。小熊猫目前归入独立的小熊猫科。',
    },
    explanation: '小熊猫归在独立的小熊猫科，和大熊猫并非近亲，也不属于浣熊科。名字、食谱或外形相似，都不能单独作为判断亲缘的依据。',
    source: smithsonian,
    observationPrompt: '回到竹影林，找找竹竹的环纹长尾、红褐色背毛和深色四肢，再拍一张自己的物种观察照。',
    candidates: ['leaf-reader', 'canopy-listener'],
  },
  {
    id: 'wildlife-watching', topic: 'tracks', themes: ['habitat'], title: '把距离留给它',
    text: '你在巡护小路外看见一只野生动物，想留下一张照片。怎样做更合适？',
    choices: [{ id: 'a', label: '留在安全距离，用变焦观察' }, { id: 'b', label: '放点食物，让它走到镜头前' }, { id: 'c', label: '模仿叫声，引它抬头靠近' }],
    correctChoiceId: 'a',
    misconceptions: {
      b: '用食物引诱会影响野生动物的正常行为。保持距离，用变焦留下照片更合适。',
      c: '模仿叫声引它靠近也会造成干扰。留在规定步道与安全距离观察即可。',
    },
    explanation: '观察野生动物时，应保持距离，用望远镜或相机变焦，而不是靠近、投喂或用声音引诱。遵守当地的距离和步道规定；如果动物因为你改变了行为，就应退开。',
    source: { title: '美国国家公园管理局 · 安全观察野生动物', url: 'https://www.nps.gov/subjects/watchingwildlife/7ways.htm' },
    observationPrompt: '回到虚拟林地，试试移动镜头和变焦，从自己的布置中找到一个不干扰动物的取景位置。',
    candidates: ['trail-finder', 'canopy-listener'],
  },
  {
    id: 'forest-links', topic: 'maintenance', themes: ['habitat'], title: '把林地连起来',
    text: '巡护地图上同时标着树木和林下竹丛。保护小熊猫的家园时，为什么不能只留下其中一种？',
    choices: [{ id: 'a', label: '只保留竹丛就够了，树木可以清走' }, { id: 'b', label: '只要树冠茂密，就不需要林下竹子' }, { id: 'c', label: '树木提供庇护，竹子提供主要食物，两者都重要' }],
    correctChoiceId: 'c',
    misconceptions: {
      a: '树木提供庇护和活动空间，竹丛提供主要食物；保留其中一种无法满足完整的栖地需求。',
      b: '茂密树冠不能替代作为主要食物的竹子。保护栖地需要关注树木与林下竹丛的联系。',
    },
    explanation: '树木和竹子都属于小熊猫家园的一部分，失去它们会让小熊猫失去食物与庇护。游戏中的连接木道增加了一条虚拟路线，不等同于现实中的栖地修复。',
    source: wwf,
    observationPrompt: '完成路线后把连接木道带回家，再观察竹竹怎样利用新增路线。',
    candidates: ['leaf-reader', 'trail-finder'],
  },
];
