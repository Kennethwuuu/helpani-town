# 三物种科普巡护 · 实现与验收

2026-11-11。三种动物都在首页照顾区提供摇骰问答，不另跳玩法页面。此前只有小熊猫有巡护；本轮补齐中华穿山甲和绿海龟。

## 已实现

| 伙伴 | 路线与主题 | 题目 | 完成路线的确定收获 |
| --- | --- | --- | --- |
| 竹竹 / 小熊猫 | 竹影林，认识小熊猫 / 森林与保护 | 原有 6 题 | 原有连接木道；回家预览确认后使用 |
| 小松 / 中华穿山甲 | 蕨叶谷，认识穿山甲 / 洞穴与保护 | 新增 6 题 | 夜叶倾听者纪念勋章 |
| 阿潮 / 绿海龟 | 潮汐湾，认识绿海龟 / 海草与海岸 | 新增 6 题 | 潮声倾听者纪念勋章 |

三种路线均为起点加 8 格、每轮 8 次免费骰子，服务端生成 1–6 点，玩家标记逐格移动。落点触发三选一问答，第 4、8 格各解锁一章。主题优先推荐未发现的相关知识；选项顺序轮换。答错仍然保留见闻，显示针对所选错误的解释；独立答对后标为已掌握。答案解释、资料链接和回家观察线索保存在知识册与手记。

每次作答有公开的 25% 额外发现机会，每累计 4 次见闻可选择未拥有的勋章。新伙伴各有 3 枚原创矢量勋章。首次完成路线确定保留目录第一枚纪念勋章；若此前已经随机发现同一枚，不复制发放。重访保留章节、知识和收藏，可继续补齐其他内容。

勋章可装备为照片角标。三个物种均支持预览、裁切、保存相册、下载和重开，使用同一张 1600×1000 PNG。旧照片保留当时的物种、布局、姿态与勋章，换伙伴或换装备不会改写旧照。

## 存档与兼容

- 原小熊猫 `patrol_states` 和缺省 API 保留；另两种使用 `care_patrol_states(session_id, species)`。`GET /api/patrol/state?species=…`，写操作携带 `species`、请求 UUID 和预期版本。
- 骰点、落点、剩余次数、待答题和里程碑在同一事务中提交。动画中刷新恢复已提交落点和同一个待答题，不再消耗机会。
- 同 UUID 重试、同一事件同选项的新 UUID 都不重复记录；已答事件换答案或旧版本并发请求返回 409。
- 每种动物单独保存知识、勋章与装备。完成穿山甲或海龟路线不会创建小熊猫木道，也不改变其他栖地库存。
- 前端换伙伴时销毁旧巡护控制器及事件监听；旧请求和旧移动动画不再改写新的界面。其他照顾入口继续可用。
- 虚拟巡护不增减照护 XP、公益积分、模拟预算或真实资金。真实支付仍按原 PayPal Sandbox 流程处理。

## 实际验证

`npm test` 最终 **73 / 73 通过**，包括新增 14 项物种巡护测试。覆盖全部 1–6 点、终点截断、跨里程碑、待答题重启恢复、响应丢失后的重试、并发掷骰、重复与冲突选择、重访和重复收藏、跨物种请求 UUID、装备及旧小熊猫兼容。原领养、喂食上限、故事、活动核验、兑换、赞助与支付配置提示 HTTP 回归通过。

运行中一度遇到本机启动或 HTTP 请求超时，未放宽断言或超时阈值。浏览器验收完成后使用原 `npm test` 全量重跑，最终无失败；临时抖动原因尚未定位。远端 PayPal 授权捕获与真实设备测试不包含在本轮结果中。

使用独立测试服务 `http://127.0.0.1:3117` 和 `/private/tmp/helpani-species-patrol-20261111/qa/town.sqlite`，没有清理玩家站点数据。使用 Playwright CLI 操作真实 Chrome；手机为触摸模拟，**不是 iOS 真机**。

| 实际浏览器用例 | CSS 尺寸 | 结果 |
| --- | --- | --- |
| 穿山甲桌面 | 1440×900 | 通过 |
| 海龟桌面 | 1440×900 | 通过 |
| 小熊猫桌面 | 1440×900 | 通过 |
| 穿山甲触摸手机 | 390×844 | 通过 |
| 海龟触摸手机 | 390×844 | 通过 |
| 小熊猫触摸手机 | 390×844 | 通过 |

六例均走完：领养正确伙伴 → 布置设施 → 摇骰 → 移动中刷新 → 恢复原题 → 答题 → 完成两章 → 装备勋章 → 拍照 → 实际下载与相册重开。逐格移动由 DOM 观察记录检查；每次答题额外重放相同请求及相同选择，确认不重复结算，冲突选择返回 409。三物种布局、巡护与资金隔离通过。设施首次自主使用有观察记录，页面无脚本错误或横向溢出。

额外通过实际“下一位伙伴”领养切换：小熊猫切到穿山甲后恢复预先保存的穿山甲待答题，小熊猫路线与照片勋章保持原样。

六张成片分别计算了最终预览 Blob、实际下载文件和重开相册 Blob 的 SHA-256，全部一致。数据与完整日志：

- [浏览器结果与照片哈希](../output/playwright/species-patrol/browser-results.json)
- [73 项测试完整日志](../output/playwright/species-patrol/test-results.txt)
- [可重跑浏览器脚本](../tools/browser/species-patrol-gate.js)（只允许 3117 测试站点，会清空该测试站点的会话和照片）
- [穿山甲桌面路线截图](../output/playwright/species-patrol/pangolin-desktop-route.png) / [手机路线截图](../output/playwright/species-patrol/pangolin-mobile-route.png)
- [海龟桌面路线截图](../output/playwright/species-patrol/sea-turtle-desktop-route.png) / [手机照片预览](../output/playwright/species-patrol/sea-turtle-mobile-preview.png)
- [穿山甲照片导出](../output/playwright/species-patrol/pangolin-desktop-photo.png) / [海龟照片导出](../output/playwright/species-patrol/sea-turtle-mobile-photo.png)

## 知识与资产来源

题目与解释在 [companion-patrol.mjs](../server/companion-patrol.mjs)，每题附机构链接，答案在结算前不发送给浏览器。

| 主题 | 核实资料 |
| --- | --- |
| 中华穿山甲夜行、鳞片、哺乳、受惊蜷起 | [香港生物多样性资讯站](https://bih.gov.hk/en/fast-facts/iconic-species/index-id-15.html) |
| 长黏舌、蚁与白蚁、前肢爪挖掘与洞穴 | [美国鱼类及野生动物管理局 · 穿山甲](https://www.fws.gov/international-affairs/pangolins) |
| 成年绿海龟食性、幼体差异与名称 | [NOAA · Green Turtle](https://www.fisheries.noaa.gov/species/green-turtle) |
| 肺呼吸、雌龟上岸产卵 | [NOAA · 海龟趣闻](https://www.fisheries.noaa.gov/national/outreach-and-education/fun-facts-about-terrific-sea-turtles) |
| 沙滩人造光干扰 | [USFWS · 海龟产卵季](https://www.fws.gov/press-release/2023-04/sea-turtles-need-help-during-nesting-season) |
| 保持距离、不追逐或触摸野生海龟 | [NOAA · 海洋动物观察指南](https://www.fisheries.noaa.gov/topic/marine-life-viewing-guidelines) |

2026-11-11 核对。题目采用中文转述，不下载或分发机构照片，不使用精确潜水时长或种群数字。巡护、伙伴、设施和勋章都是虚构游戏内容；轻抚与喂粮只发生在虚拟场景，不是野生动物互动指引。

六枚 360×360 SVG 为本工程原创正式运行资产，全部内联路径，没有远端图片或字体，已加入静态白名单并验证可进入 Canvas 导出。小熊猫原三枚 PNG 继续使用。

## 启动与后续

`npm ci && npm start`，打开 `http://localhost:3000/#playroom`，进入当前伙伴的照顾区后向下看巡护。默认服务已更新；原玩家数据库在迁移前另存一致性备份 `/private/tmp/helpani-species-patrol-20261111/player-before.sqlite`。源码备份分别在该目录的 `frontend/`、`backend/`。

剩余优先项：iOS Safari 真机触摸与长页面体验；根据玩家反馈扩充互动题型；为穿山甲和海龟设计能改变可达路线的功能设施解锁。本轮新伙伴的路线确定奖励是照片勋章，尚未增加新的功能设施。账号、跨设备相册和更多物种仍为后续范围。
