// Species facts are paraphrased from the linked institutions. Route scenes,
// companions and souvenirs are fictional; answers never prescribe real care.
const hkPangolin = { title: '香港生物多样性资讯站 · 中华穿山甲', url: 'https://bih.gov.hk/en/fast-facts/iconic-species/index-id-15.html' };
const fwsPangolin = { title: '美国鱼类及野生动物管理局 · 穿山甲', url: 'https://www.fws.gov/international-affairs/pangolins' };
const noaaTurtle = { title: 'NOAA Fisheries · 绿海龟', url: 'https://www.fisheries.noaa.gov/species/green-turtle' };
const noaaTurtleFacts = { title: 'NOAA Fisheries · 海龟趣闻', url: 'https://www.fisheries.noaa.gov/national/outreach-and-education/fun-facts-about-terrific-sea-turtles' };
const fwsNesting = { title: '美国鱼类及野生动物管理局 · 守护海龟产卵季', url: 'https://www.fws.gov/press-release/2023-04/sea-turtles-need-help-during-nesting-season' };
const noaaViewing = { title: 'NOAA Fisheries · 海洋生物观察指南', url: 'https://www.fisheries.noaa.gov/topic/marine-life-viewing-guidelines' };

const pangolinMedals = [
  { id: 'pangolin-night-listener', title: '夜叶倾听者', description: '在蕨叶谷走完一段路，把留给小松的安静收进收藏。', rewardLabel: '月下蕨叶照片角标', photoAccent: '夜叶留念', art: '/assets/medals/pangolin-night-listener.svg' },
  { id: 'pangolin-soil-keeper', title: '松土守望者', description: '记住洞穴与泥土的联系，慢慢发现小松脚边的生活。', rewardLabel: '根间小窝照片角标', photoAccent: '根间手记', art: '/assets/medals/pangolin-soil-keeper.svg' },
  { id: 'pangolin-scale-reader', title: '鳞甲解密者', description: '从鳞片认识一位哺乳动物朋友，让每个新发现留下纪念。', rewardLabel: '暖金鳞片照片角标', photoAccent: '鳞甲新知', art: '/assets/medals/pangolin-scale-reader.svg' },
];
const turtleMedals = [
  { id: 'turtle-tide-listener', title: '潮声倾听者', description: '沿潮汐湾走完一段路，记住阿潮游动与换气的节奏。', rewardLabel: '浅湾浪花照片角标', photoAccent: '潮声留念', art: '/assets/medals/turtle-tide-listener.svg' },
  { id: 'turtle-seagrass-keeper', title: '海草守望者', description: '发现海草床和绿海龟的联系，把水下的一抹绿留在照片里。', rewardLabel: '海草摇曳照片角标', photoAccent: '海草手记', art: '/assets/medals/turtle-seagrass-keeper.svg' },
  { id: 'turtle-shore-watcher', title: '静岸守护者', description: '为海龟保留距离与安静，也为自己的观察留下一份纪念。', rewardLabel: '月下静岸照片角标', photoAccent: '静岸新知', art: '/assets/medals/turtle-shore-watcher.svg' },
];

const pangolinQuestions = [
  {
    id: 'pangolin-night-life', topic: 'tracks', themes: ['rest'], title: '落叶响起的时候',
    text: '蕨叶谷的手记留着一条夜间记录。现实中的中华穿山甲，通常在什么时候外出觅食？',
    choices: [{ id: 'a', label: '主要在夜间活动' }, { id: 'b', label: '主要在正午晒太阳时活动' }, { id: 'c', label: '全天不停活动，不需要休息' }],
    correctChoiceId: 'a',
    misconceptions: { b: '中华穿山甲通常夜间活动，白天多在洞穴休息。', c: '它也需要休息，通常在白天躲进洞穴。' },
    explanation: '中华穿山甲通常夜间外出觅食，白天在洞穴休息。游戏压缩了作息时间，方便观察小松的活动与停留。',
    source: hkPangolin, observationPrompt: '回到蕨叶谷，看看小松探索后怎样自主回到休息角落。',
    candidates: ['pangolin-night-listener', 'pangolin-soil-keeper'],
  },
  {
    id: 'pangolin-sticky-tongue', topic: 'tracks', themes: ['rest'], title: '藏在蚁巢里的菜单',
    text: '巡护员画了一窝蚂蚁和白蚁。穿山甲找到这样的食物后，主要用什么把小昆虫送进嘴里？',
    choices: [{ id: 'a', label: '用门牙把昆虫一只只咬住' }, { id: 'b', label: '用长而黏的舌头舔食' }, { id: 'c', label: '用尾巴卷起昆虫' }],
    correctChoiceId: 'b',
    misconceptions: { a: '穿山甲没有牙齿，取食依靠长而黏的舌头。', c: '尾巴不是取食工具，长而黏的舌头才会舔取昆虫。' },
    explanation: '穿山甲以蚂蚁、白蚁等昆虫为食，用爪打开巢穴，再用长而黏的舌头舔食。它们没有牙齿。',
    source: fwsPangolin, observationPrompt: '回到蕨叶谷，观察小松低头探索和前爪拨土的动作；游戏喂粮是虚拟互动。',
    candidates: ['pangolin-soil-keeper', 'pangolin-scale-reader'],
  },
  {
    id: 'pangolin-mammal', topic: 'canopy', themes: ['rest'], title: '鳞片下的身份',
    text: '小松背上有一层鳞片，像不像一位爬行动物？中华穿山甲实际上属于哪一类动物？',
    choices: [{ id: 'a', label: '爬行动物，和蜥蜴同一类' }, { id: 'b', label: '鱼类，因为身体有鳞片' }, { id: 'c', label: '哺乳动物，妈妈会用乳汁哺育幼崽' }],
    correctChoiceId: 'c',
    misconceptions: { a: '鳞片外形容易造成误会，穿山甲是会用乳汁哺育幼崽的哺乳动物。', b: '有鳞片不等于鱼类，穿山甲属于哺乳动物。' },
    explanation: '中华穿山甲是哺乳动物，鳞片间还有毛，妈妈用乳汁哺育幼崽。不能只靠鳞片判断动物类别。',
    source: hkPangolin, observationPrompt: '回到蕨叶谷，用镜头比较小松的鳞片轮廓、长吻和四肢。',
    candidates: ['pangolin-scale-reader', 'pangolin-night-listener'],
  },
  {
    id: 'pangolin-scales', topic: 'canopy', themes: ['rest'], title: '鳞甲的小秘密',
    text: '手记上画着一片鳞甲。穿山甲鳞片的主要材料，和我们身体的哪一部分相似？',
    choices: [{ id: 'a', label: '牙齿外层的牙釉质' }, { id: 'b', label: '指甲里的角蛋白' }, { id: 'c', label: '骨骼里的骨组织' }],
    correctChoiceId: 'b',
    misconceptions: { a: '穿山甲鳞片主要由角蛋白构成，和指甲的材料相似。', c: '鳞片不是露在外面的骨头，主要材料是角蛋白。' },
    explanation: '鳞片主要由角蛋白构成，和人的指甲材料相似。它们是身体的保护结构，不能防住盗猎和非法贸易。',
    source: hkPangolin, observationPrompt: '回到蕨叶谷，拍下小松背上层层相叠的鳞片，不用追着它转向。',
    candidates: ['pangolin-scale-reader', 'pangolin-soil-keeper'],
  },
  {
    id: 'pangolin-burrow', topic: 'maintenance', themes: ['habitat'], title: '树根旁的安静角落',
    text: '虚拟路线来到树根边。现实中的中华穿山甲，怎样准备白天休息的洞穴？',
    choices: [{ id: 'a', label: '用有力的前肢和爪挖掘' }, { id: 'b', label: '用牙齿啃出树洞' }, { id: 'c', label: '像鸟一样衔草编成悬空的巢' }],
    correctChoiceId: 'a',
    misconceptions: { b: '穿山甲没有牙齿，挖掘主要靠有力的前肢和爪。', c: '中华穿山甲常在地下洞穴休息，不会像鸟一样编织悬巢。' },
    explanation: '中华穿山甲会挖地下洞穴，白天在里面休息。穿山甲挖掘时使用强壮前肢和爪，尾巴与后肢帮助支撑和平衡。',
    source: fwsPangolin, observationPrompt: '回到蕨叶谷，为落叶休息窝比较树根旁和落叶间两个位置，再等小松自主使用。',
    candidates: ['pangolin-soil-keeper', 'pangolin-night-listener'],
  },
  {
    id: 'pangolin-curled-defense', topic: 'maintenance', themes: ['habitat'], title: '卷成一团的心情',
    text: '巡护手记画着一只蜷成球的穿山甲。野外的中华穿山甲受到惊吓时这样做，主要是为了什么？',
    choices: [{ id: 'a', label: '邀请人靠近摸摸它' }, { id: 'b', label: '为了滚下山坡，代替走路' }, { id: 'c', label: '把柔软部位藏起来，用鳞甲保护自己' }],
    correctChoiceId: 'c',
    misconceptions: { a: '受惊蜷起是防御反应，不是邀请触摸。', b: '蜷成球主要用于防御，不是平时的移动方式。' },
    explanation: '受惊的中华穿山甲会护住头部、蜷成球，把坚硬鳞片露在外面。观察应留出空间，不要为看见这个动作而惊吓它。',
    source: hkPangolin, observationPrompt: '回到虚拟蕨叶谷，等待小松自然停留。游戏中的轻抚与蜷卧不代表野外可以触摸穿山甲。',
    candidates: ['pangolin-night-listener', 'pangolin-scale-reader'],
  },
];

const turtleQuestions = [
  {
    id: 'turtle-air-breathing', topic: 'canopy', themes: ['rest'], title: '水面的一口气',
    text: '阿潮从水下慢慢游向水面。海龟长期生活在海里，为什么还要上来？',
    choices: [{ id: 'a', label: '用肺呼吸空气' }, { id: 'b', label: '用鳃在水面吸收氧气' }, { id: 'c', label: '只有幼年海龟需要呼吸' }],
    correctChoiceId: 'a',
    misconceptions: { b: '海龟没有鱼那样的鳃，它用肺呼吸。', c: '成年海龟也需要空气，仍要浮出水面换气。' },
    explanation: '海龟是用肺呼吸的爬行动物，需要到水面换气。活动和休息会影响换气间隔；游戏节奏不代表真实潜水时长。',
    source: noaaTurtleFacts, observationPrompt: '回到潮汐湾，等阿潮自主浮向水面，拍下抬头换气的瞬间。',
    candidates: ['turtle-tide-listener', 'turtle-shore-watcher'],
  },
  {
    id: 'turtle-seagrass-diet', topic: 'tracks', themes: ['rest'], title: '海草床的菜单',
    text: '浅湾的海草轻轻摇摆。成年绿海龟的主要食物，通常是哪一组？',
    choices: [{ id: 'a', label: '主要是鱼和虾' }, { id: 'b', label: '主要是海草和藻类' }, { id: 'c', label: '和所有海龟一样，主要是水母' }],
    correctChoiceId: 'b',
    misconceptions: { a: '绿海龟可能吃少量动物性食物，但成年后通常以海草和藻类为主。', c: '不同海龟的食谱并不相同，成年绿海龟通常以海草和藻类为主。' },
    explanation: '成年绿海龟主要吃海草和藻类，也可能吃少量动物性食物；幼体的食谱不同，并非所有海龟都以植物为主食。',
    source: noaaTurtle, observationPrompt: '回到潮汐湾，比较休息台放在海草旁或岩棚旁时，阿潮的游动背景。游戏喂粮是虚拟互动。',
    candidates: ['turtle-seagrass-keeper', 'turtle-tide-listener'],
  },
  {
    id: 'turtle-green-name', topic: 'tracks', themes: ['rest'], title: '名字里的那一抹绿',
    text: '阿潮的龟壳并不通体鲜绿。“绿海龟”这个名字，最初说的是哪里呈绿色？',
    choices: [{ id: 'a', label: '它的眼睛总是绿色' }, { id: 'b', label: '它的龟壳必须是鲜绿色' }, { id: 'c', label: '它体内脂肪的颜色' }],
    correctChoiceId: 'c',
    misconceptions: { a: '名称不是由眼睛颜色而来，而是来自脂肪的颜色。', b: '绿海龟的名称不指龟壳必须鲜绿，壳色可以有不同色调。' },
    explanation: '“绿海龟”得名于脂肪的颜色，不是龟壳颜色。辨认一种动物，不能只按名字想象它的外表。',
    source: noaaTurtle, observationPrompt: '回到潮汐湾，用相机看看阿潮壳面的纹路，再选一个自己的水下构图。',
    candidates: ['turtle-tide-listener', 'turtle-seagrass-keeper'],
  },
  {
    id: 'turtle-nesting-beach', topic: 'maintenance', themes: ['habitat'], title: '海与沙滩之间',
    text: '路线地图同时画着海草床和沙滩。成年雌海龟为什么需要从海里回到沙滩上？',
    choices: [{ id: 'a', label: '在沙滩挖巢产卵' }, { id: 'b', label: '在沙滩把龟壳脱下来换新' }, { id: 'c', label: '所有海龟每天都必须上岸睡觉' }],
    correctChoiceId: 'a',
    misconceptions: { b: '海龟不会把整个龟壳脱下换新，雌龟上岸的重要原因是产卵。', c: '海龟能在水下休息，并非每天都必须上岸。' },
    explanation: '成年雌海龟回到沙滩产卵，通常回到出生地附近的海滩。海上觅食地和岸上产卵地都属于它们的生活空间。',
    source: noaaTurtleFacts, observationPrompt: '回到虚拟潮汐湾，看看水面、海草和岩棚怎样连成阿潮的活动空间；场景暂未模拟产卵。',
    candidates: ['turtle-shore-watcher', 'turtle-seagrass-keeper'],
  },
  {
    id: 'turtle-dark-beach', topic: 'maintenance', themes: ['habitat'], title: '把夜色留给沙滩',
    text: '虚拟巡护队准备拍摄海龟产卵的海滩。为什么要避免让强光照向沙滩？',
    choices: [{ id: 'a', label: '因为强光会把海水变成淡水' }, { id: 'b', label: '因为人造光可能干扰成龟和幼龟的方向' }, { id: 'c', label: '因为海龟白天完全看不见' }],
    correctChoiceId: 'b',
    misconceptions: { a: '光线不会把海水变成淡水，问题在于它会干扰海龟辨别方向。', c: '这不是白天能否看见的问题，而是人造光可能干扰夜间的方向线索。' },
    explanation: '海滩上的人造光可能让海龟迷失方向，幼龟可能因此走离大海。守护产卵地需要保留夜间的黑暗与安静。',
    source: fwsNesting, observationPrompt: '回到潮汐湾，用虚拟相机取景。现实观察海龟时不要用闪光或强光追照。',
    candidates: ['turtle-shore-watcher', 'turtle-tide-listener'],
  },
  {
    id: 'turtle-respectful-watching', topic: 'canopy', themes: ['habitat'], title: '留下距离，也留下照片',
    text: '你在海边看见一只野生海龟，想多看一会儿。哪种做法更合适？',
    choices: [{ id: 'a', label: '游近一些，摸摸龟壳让它停住' }, { id: 'b', label: '用食物引它跟着镜头游' }, { id: 'c', label: '保持当地要求的距离，用变焦安静观察' }],
    correctChoiceId: 'c',
    misconceptions: { a: '靠近或触摸可能干扰海龟，不能为了拍照让它停住。', b: '用食物引诱会改变野生海龟的自然行为，应该留出距离观察。' },
    explanation: '观察野生海龟要保持距离，不追逐、不触摸或引诱互动，并遵守当地观察规定。游戏中的照顾动作只发生在虚拟场景。',
    source: noaaViewing, observationPrompt: '回到潮汐湾，试试平移和变焦，在不改变阿潮行为的情况下拍一张照片。',
    candidates: ['turtle-shore-watcher', 'turtle-seagrass-keeper'],
  },
];

export const companionPatrols = {
  pangolin: {
    questions: pangolinQuestions, medalCatalog: pangolinMedals,
    chapters: [
      { id: 'pangolin-hidden-day', title: '第一章 · 树根下的白天', text: '你认出落叶与松土之间的联系。给小松一个能自主选择的休息窝，也把停留的时间留给它。' },
      { id: 'pangolin-quiet-night', title: '第二章 · 留给夜叶的安静', text: '你走完蕨叶谷路线，收获夜叶倾听者纪念勋章。回家等小松探索或休息，再用月下蕨叶角标留一张照片。' },
    ],
    presentation: {
      title: '蕨叶谷巡护', animal: '中华穿山甲', name: '小松', place: '蕨叶谷', routeLabel: '8 格蕨叶路线',
      nodeNames: ['巡护站', '落叶径', '蚁巢记', '树根旁', '半程记', '蕨叶坡', '松土角', '归途', '夜叶留念'],
      themeLabels: { rest: '认识穿山甲', habitat: '洞穴与保护' },
      topicLabels: { canopy: '认识鳞甲朋友', maintenance: '洞穴与保护', tracks: '落叶间的生活' },
      completionText: '本轮完成，夜叶倾听者纪念勋章已保留。回家观察小松，再把新经历拍进照片。',
    },
  },
  'sea-turtle': {
    questions: turtleQuestions, medalCatalog: turtleMedals,
    chapters: [
      { id: 'turtle-shallow-bay', title: '第一章 · 海草间的呼吸', text: '你把阿潮的游动、换气和海草床连进同一本手记。水下休息，也可以是一段值得等待的日常。' },
      { id: 'turtle-quiet-shore', title: '第二章 · 把安静留给海岸', text: '你走完潮汐湾路线，收获潮声倾听者纪念勋章。回家看看阿潮的游姿，再用浅湾浪花角标为这次经历留念。' },
    ],
    presentation: {
      title: '潮汐湾巡护', animal: '绿海龟', name: '阿潮', place: '潮汐湾', routeLabel: '8 格潮汐路线',
      nodeNames: ['巡护站', '浅湾口', '换气点', '海草床', '半程记', '岩棚边', '沙滩望', '归途', '潮声留念'],
      themeLabels: { rest: '认识绿海龟', habitat: '海草与海岸' },
      topicLabels: { canopy: '海中的伙伴', maintenance: '海草与海岸', tracks: '认识绿海龟' },
      completionText: '本轮完成，潮声倾听者纪念勋章已保留。回家观察阿潮，再把新经历拍进照片。',
    },
  },
};
