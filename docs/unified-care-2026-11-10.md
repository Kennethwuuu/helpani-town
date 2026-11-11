# 三位伙伴 · 同页照顾、观察与留影

2026-11-10。按玩家要求，把生活场景和照护融合为首页同一张照顾卡片，并将小熊猫的核心玩法扩展到中华穿山甲与绿海龟。

## 已实现

- 首页领养后直接进入当前伙伴的栖地。原“试玩平台布置”入口撤下，旧 `/woodland` 链接归一至首页照顾区；未领养先选择伙伴。
- 喂粮、领免费粮、轻抚/打招呼、观察、摄影、相册和布置按钮都在场景旁。喂粮沿用原照护 API、每日限额和来信规则，成功后由当前 Canvas 动物回应；第一次打招呼继续记录熟悉进度。
- 三种动物都使用自主生活 Canvas。穿山甲探索、闻嗅、刨土、蜷缩与舒展；海龟游动、上浮与停留；小熊猫沿用已验收的探索、攀爬、平台与木道表现，保留已认可的头部造型。
- 三物种各有首访赠送的一件设施、两处位置、预览、取消、确认和免费调整。保存即记建设，首次实际使用另记观察；占用中调整等安全离开后生效。
- 摄影继续支持取景、隐藏界面、快门冻结、静态裁切、保存、重开与下载；每张照片记录拍摄时的物种、姿态和布局，角标使用对应动物名。旧照片缺少物种字段时仍按旧小熊猫照片读取。

| 伙伴 | 场景与首件设施 | 两个位置 |
| --- | --- | --- |
| 小熊猫 · 竹竹 | 竹影林，休息平台 | 树干高枝 / 林缘低台；原巡护木道继续可用 |
| 中华穿山甲 · 小松 | 蕨叶谷，落叶休息窝 | 树根遮阴 / 落叶坡 |
| 绿海龟 · 阿潮 | 潮汐湾，水下休息台 | 海草边 / 礁石旁 |

穿山甲的动作设计参考 [香港生物多样性资讯站](https://bih.gov.hk/en/fast-facts/iconic-species/index-id-15.html)，海龟上浮与停留参考 [NOAA 海龟科普](https://www.fisheries.noaa.gov/national/outreach-and-education/fun-facts-about-terrific-sea-turtles)。场景时间经过压缩，设施、照护粮和轻抚反馈是虚拟表现，没有把它们作为现实接触或饲养方案。

## 数据与兼容

默认 `/api/habitat/*` 仍为小熊猫。GET 可带 `?species=…`，POST 使用 `body.species`；新物种使用独立的 `(session_id,species)` 表，原小熊猫表和已有布局原样保留。库存、版本、建设、观察与去重按物种隔离，操作 UUID 不能跨物种复用。

原有照护、公益积分、模拟预算和支付账本继续独立。布置、照片和互动不会增加公益积分或付款；喂食仍按原规则消耗一份粮、获得照护 XP。相册继续存于当前浏览器 IndexedDB，PNG 不上传服务端。

新资产位于 `public/companion-scene.js`，共享既有镜头、触摸和生命周期代码；旧 SVG 保留为缩略图和故事素材。写实毛发、完整物理、真实声场与专业骨骼模型未实现。

## 实际验证

QA 使用 `http://127.0.0.1:3116` 与 `/private/tmp/helpani-unified-care-20261110/qa/town.sqlite`，没有清空原玩家库。默认预览已重启加载新后端；源码备份在 `/private/tmp/helpani-unified-care-20261110/`，仓库仍无提交，没有重置已有改动。

自动检查 **59/59 通过**：新增 8 项多物种栖地测试，覆盖赠送、布局与版本隔离、首次使用、移动不重复、非法物种/设施、UUID 跨物种冲突、重开恢复和小熊猫旧存档；原照护、领养、活动、账本、问答与勋章摄影回归继续通过。

真实 Chrome 浏览器分别完成三物种 × **1440×900 桌面 / 390×844 手机触摸输入**，六组均通过：

| 流程 | 结果 |
| --- | --- |
| 同页照顾 | Canvas 与实际喂粮按钮位于 `#playroom`，无跳转；旧整图场景隐藏，物种与伙伴名一致 |
| 喂粮与互动 | 首次打招呼记录成功，喂粮消耗一份、XP +10，当前场景收到互动反馈 |
| 两处布置 | 首处实际使用并生成首次观察；改到第二位置仍只记一次建设，刷新恢复第二布局 |
| 摄影与旧照 | 1600×1000，移动设施并继续活动后重开相册，旧照片的布局、物种和姿态保持；预览/下载/相册 PNG SHA-256 完全一致 |
| 照护恢复与资金 | 刷新后粮、照护次数、XP 与物种一致；布置和拍照没有改动公益积分、模拟预算或付款 |
| 页面与手机 | 六组均无未处理页面异常，无横向溢出；手机采用可信 CDP 触摸，实际检查 CSS 宽度为 390，非 iOS Safari 真机 |
| 切换伙伴与旧照 | 从已获勋章的小熊猫切到穿山甲：小熊猫保留低台，穿山甲初始无布置，海龟不受影响；穿山甲布置并保存新照后，相册两张照片各保留自己的物种；旧小熊猫照片标题仍为“竹影林留影”，PNG SHA-256 完全不变 |

独立生产渲染器的四设施位置检查也通过：首次使用约 5–9 秒；占用中移动等待安全落点，确认只报一次；改变后续布局、活动与互动后，冻结照片像素差为零。这里是可重复逐帧验收，不是完整动物运动学或碰撞物理验证。

初次浏览器夹具遇到新 context 导航生命周期超时，HTTP 页面与脚本响应均正常。最终在已连接 QA 浏览器内切换独立测试会话，并显式检查应用就绪、页面重载标记与实际 CSS 视口；没有把首次夹具输出的窗口宽度当作手机结果。手机最终像素密度记录为 1–3，触摸媒体查询有效。

## 截图、照片与复跑

- [穿山甲桌面](../output/playwright/unified-care/pangolin-desktop.png) · [手机](../output/playwright/unified-care/pangolin-mobile.png) · [导出照片](../output/playwright/unified-care/pangolin-desktop-photo.png)。
- [海龟桌面](../output/playwright/unified-care/sea-turtle-desktop.png) · [手机](../output/playwright/unified-care/sea-turtle-mobile.png) · [导出照片](../output/playwright/unified-care/sea-turtle-desktop-photo.png)。
- [小熊猫桌面](../output/playwright/unified-care/red-panda-desktop.png) · [手机](../output/playwright/unified-care/red-panda-mobile.png)。
- [四设施姿态](../output/playwright/companion-scenes/facility-poses.png) · [独立渲染器结果](../output/playwright/companion-scenes/scene-results.json)。
- [六组浏览器结果与图片校验](../output/playwright/unified-care/browser-results.json) · [切换后回看旧照片](../output/playwright/unified-care/old-panda-photo-after-switch.png)。
- [浏览器流程脚本](../tools/browser/unified-care-gate.js) · [伙伴切换脚本](../tools/browser/care-species-switch-gate.js)。脚本仅用于独立 QA 地址，会清除其测试浏览器会话与相册；不要在玩家预览会话运行。

启动方式继续为 `npm ci && npm start`，测试用 `npm test`。

## 剩余内容

小熊猫保留原巡护、科普问答、知识册、插画勋章和木道。海龟与穿山甲本轮交付同页照顾、设施、观察和摄影，尚未扩展各自的巡护题库或章节奖励。iOS Safari 真机、更多设施、正式账号与跨设备相册也未实现或未验收。下一步先结合玩家对三种动作与同页操作的反馈打磨，再扩展物种专属内容。
