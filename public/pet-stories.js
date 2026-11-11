const turtleGuide = { label: 'NOAA Fisheries · 绿海龟', url: 'https://www.fisheries.noaa.gov/species/green-turtle' };
const turtleActions = { label: 'NOAA Fisheries · 如何帮助海龟', url: 'https://www.fisheries.noaa.gov/feature-story/what-can-you-do-help-sea-turtles' };
const pandaGuide = { label: '史密森尼国家动物园 · 小熊猫', url: 'https://nationalzoo.si.edu/animals/red-panda' };
const pangolinGuide = { label: '香港生物多样性资讯站 · 中华穿山甲', url: 'https://bih.gov.hk/en/fast-facts/iconic-species/index-id-15.html' };
const pangolinPlan = { label: '香港渔农自然护理署 · 中华穿山甲物种行动计划', url: 'https://www.afcd.gov.hk/english/conservation/Con_hkbsap/bsap_implementation/files/Chinese_Pangolin_SAP_Dec2019.pdf' };

const petStories = {
  'sea-turtle': [
    {
      title: '第一次见面',
      art: { src: '/story-turtle-1.svg', alt: '退潮的浅湾里，阿潮从水草旁游过。' },
      narrative: '退潮时，阿潮从水草旁游过。你在观察窗上画了第一段蓝线，想知道这条小小的路线会通往哪里。',
      topic: '住在哪里',
      fact: '绿海龟生活在热带和亚热带海域。年幼个体会在外海生活一段时间，长大一些后常进入近岸浅水觅食，海草床是重要的觅食地。',
      sources: [turtleGuide],
    },
    {
      title: '海草床的秘密',
      art: { src: '/story-turtle-2.svg', alt: '阿潮低下头，游向海底摇摆的海草。' },
      narrative: '蓝线的下一站是一片在水里摇晃的草地。阿潮低头掠过叶尖，你给地图添上一站，写着「午饭在这里」。',
      topic: '吃什么',
      fact: '成年绿海龟主要吃海草和藻类。幼年的食谱通常更杂，可能也会吃小型海洋动物。游戏里的照护粮是虚拟道具，观察野生海龟时应保持距离。',
      sources: [turtleGuide, turtleActions],
    },
    {
      title: '寄给大海的信',
      art: { src: '/story-turtle-3.svg', alt: '摊开的海图上画着一条穿过海面的航线，旁边放着旧海滩照片。' },
      narrative: '观察室收到一张没有标地名的旧海滩照片。你把阿潮的蓝线延长到照片边，才发现一只海龟的地图可以大到一眼看不完。',
      topic: '怎样迁徙',
      fact: '绿海龟会在觅食地和繁殖地之间迁徙，有时相隔很远。雌龟会登上沙滩产卵，往往回到自己出生海滩所在的区域。',
      sources: [turtleGuide],
    },
    {
      title: '留一条黑暗的归路',
      art: { src: '/story-turtle-4.svg', alt: '远处屋灯暗下，幼龟沿着月光下的沙滩走向海浪。' },
      narrative: '小镇把面向沙滩的窗灯调暗，观察簿也翻到了最后一页。你在蓝线尽头画了一个小箭头，把剩下的海留给阿潮。',
      topic: '为什么需要保护',
      fact: '海龟可能被渔具误捕，海岸开发也会挤压产卵栖地。沙滩附近的人工灯光会让幼龟迷失方向。到访产卵海滩时，遵守当地指引，远观海龟并关闭或遮挡朝向海滩的灯光。',
      sources: [turtleGuide, turtleActions],
    },
  ],
  'red-panda': [
    {
      title: '树梢探头',
      art: { src: '/story-panda-1.svg', alt: '竹竹在山地森林的树枝上，从叶子后探出圆耳朵。' },
      narrative: '木桥旁的枝叶动了一下，竹竹露出一对圆耳朵。它沿着树枝走远，你在林地手记上记下第一段「空中小路」。',
      topic: '住在哪里',
      fact: '小熊猫栖息在有竹子生长的山地森林。它们善于攀爬，会在树上休息和躲避威胁，长尾巴能帮助它们在枝条间保持平衡。',
      sources: [pandaGuide],
    },
    {
      title: '竹叶午餐',
      art: { src: '/story-panda-2.svg', alt: '竹竹坐在竹丛里，用前爪抱住一枝竹叶。' },
      narrative: '第二段小路落进了竹丛。你隔着枝叶看见竹竹把一片竹叶拢进前爪，手记里从此多了一个午餐符号。',
      topic: '吃什么',
      fact: '竹叶和竹笋是小熊猫的重要食物。它们腕部有一块特化的骨头，像额外的拇指，能帮它们握住竹子。',
      sources: [pandaGuide],
    },
    {
      title: '长尾巴过桥',
      art: { src: '/story-panda-3.svg', alt: '黄昏里，竹竹独自走过两棵树之间的树枝。' },
      narrative: '黄昏时，竹竹沿树枝过了桥，却没有往小镇的热闹处走。你沿着它独自走过的方向画线，发现这片林子的边缘断开了。',
      topic: '怎样生活',
      fact: '野外的小熊猫通常独自活动，繁殖季是例外。它们会用气味留下领地信息，也会利用树枝和树干来移动。',
      sources: [pandaGuide],
    },
    {
      title: '把竹林接起来',
      art: { src: '/story-panda-4.svg', alt: '两片山林之间有一条相连的绿色林带。' },
      narrative: '你把两张分开的竹林地图拼在一起，在断开的地方留下一条绿线。竹竹消失在树冠里，手记末页只留下一句话「下一段路，要有树」。',
      topic: '为什么需要保护',
      fact: '森林被砍伐、开垦或切割后，小熊猫更难找到竹子和可躲避的地方，不同种群也更容易隔离。保护相连的山地森林能给它们留出活动空间。可以从了解和支持有公开记录的栖地保护项目做起。',
      sources: [pandaGuide],
    },
  ],
  pangolin: [
    {
      title: '落叶动了一下',
      art: { src: '/story-pangolin-1.svg', alt: '月光下，小松从落叶遮住的洞口探出鼻尖。' },
      narrative: '天刚黑，小松从落叶下探出鼻尖。你把观察簿翻到夜间那一页，记下第一次听见的窸窣声。',
      topic: '什么时候出门',
      fact: '中华穿山甲多在夜间活动，白天常躲在洞里休息。它主要生活在林地，会用有力的前爪挖洞。',
      sources: [pangolinGuide],
    },
    {
      title: '晚餐从哪来',
      art: { src: '/story-pangolin-2.svg', alt: '小松低下头，朽木旁的一串蚂蚁排成了队。' },
      narrative: '同一阵窸窣声停在一截朽木旁。你在手记上画下木头和几道蚁路，小松的晚餐原来藏在脚下。',
      topic: '吃什么',
      fact: '中华穿山甲主要吃蚂蚁和白蚁。它能用前爪拨开蚁巢，再用又长又黏的舌头把猎物卷进嘴里。',
      sources: [pangolinGuide, pangolinPlan],
    },
    {
      title: '洞口的月光',
      art: { src: '/story-pangolin-3.svg', alt: '断枝旁，小松把身体蜷成一团，鳞片朝外。' },
      narrative: '一根断枝在月光下折响，小松在原地蜷了起来。你退到小路另一侧，等了很久，才又听见它踩过落叶。',
      topic: '遇到危险怎么办',
      fact: '受到惊吓时，中华穿山甲会护住头部、把身体蜷成一团，让坚硬的鳞片朝外。它是哺乳动物，幼崽靠母乳长大。',
      sources: [pangolinGuide],
    },
    {
      title: '把洞口留给森林',
      art: { src: '/story-pangolin-4.svg', alt: '远处的夜林里只露出小松的身影，洞口藏在林中。' },
      narrative: '手记最后一页，你只留下树和月亮，没有画出洞口。夜里落叶又动了一下，这一回，你在远处听它走过。',
      topic: '为什么需要保护',
      fact: '蜷成一团能抵御一些捕食者，却挡不住人为捕捉。盗猎和贸易严重威胁中华穿山甲。可以拒绝购买穿山甲及其制品，发现疑似交易时向当地主管部门报告。',
      sources: [pangolinGuide, pangolinPlan],
    },
  ],
};
