export const careSpecies = {
  'red-panda': {
    name:'竹竹', animal:'小熊猫', place:'竹影林', title:'竹竹的林地生活', subtitle:'爬上高枝，慢慢发现一个休息角落', season:'初秋 · 清凉的傍晚',
    facility:'rest-platform', facilityName:'休息平台', firstVisit:'首次照顾赠送一件休息平台。比较两个位置，再等竹竹自主使用。',
    slots:[{id:'trunk',title:'树干旁 · 高枝',description:'顺着树干攀上去，竹影映在身后。'},{id:'edge',title:'林缘边 · 低台',description:'沿落叶小路走近，留出开阔的侧影。'}],
    source:{title:'史密森尼国家动物园',url:'https://nationalzoo.si.edu/animals/red-panda'},
  },
  pangolin: {
    name:'小松', animal:'中华穿山甲', place:'蕨叶谷', title:'小松的林下生活', subtitle:'沿落叶探索，在安静的角落休息', season:'林间 · 温和的黄昏',
    facility:'leaf-nest', facilityName:'落叶休息窝', firstVisit:'首次照顾赠送一处落叶休息窝。选树根旁或落叶坡，看看小松怎样走近。',
    slots:[{id:'root-den',title:'树根旁 · 遮阴窝',description:'靠近树根的隐蔽角落，前景蕨叶形成安静构图。'},{id:'leaf-bed',title:'落叶坡 · 休息窝',description:'沿缓坡走近，留下探索与舒展的侧影。'}],
    source:{title:'香港生物多样性资讯站 · 中华穿山甲',url:'https://bih.gov.hk/en/fast-facts/iconic-species/index-id-15.html'},
  },
  'sea-turtle': {
    name:'阿潮', animal:'绿海龟', place:'潮汐湾', title:'阿潮的浅湾生活', subtitle:'穿过海草，上浮换气，再找一处落脚点', season:'浅湾 · 柔和的午后',
    facility:'rest-ledge', facilityName:'水下休息台', firstVisit:'首次照顾赠送一处水下休息台。选择海草边或礁石旁，观察阿潮的游动路线。',
    slots:[{id:'seagrass',title:'海草边 · 低台',description:'穿过摇动的海草，适合拍摄游动中的前鳍。'},{id:'rock-shelf',title:'礁石旁 · 石台',description:'顺着礁石转弯，在较开阔的位置停留。'}],
    source:{title:'NOAA Fisheries · 绿海龟',url:'https://www.fisheries.noaa.gov/species/green-turtle'},
  },
};
