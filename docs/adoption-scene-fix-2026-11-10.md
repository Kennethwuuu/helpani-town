# 领养物种错配与旧插画叠影修复

2026-11-10。用户报告首页选择穿山甲却显示海龟，以及海龟动画与含动物的旧插画重叠。本轮基于现有源码修复，没有回退最近的科普、勋章或摄影改动。

用户进一步确认当时名称为“小松 / 中华穿山甲”、画面却是海龟，因此其反馈定位为显示层错配；名称已切换而旧图像还在显示。下面的同步加载、无动物背景及资源版本处理针对这一问题。旧格式请求误报成功是排查中另行发现并修复的后端问题，不能据此声称用户当时的服务器存档是海龟。

## 发现与修复

1. **旧请求会误报领养成功。** 已有海龟时，旧格式 `{species:"pangolin"}` 没有提交 `previousSpecies`，服务端原先返回 200 和原海龟。这条错误已在独立 HTTP 测试复现。现在对不同固定物种返回明确的 409，前端也校验结果必须匹配所选物种；同物种和旧 random 重试继续保持幂等。正常的首次领养、已获勋章后的下一位领养及一次赠粮保留。
2. **场景默认图使用了含动物的旧整图。** `tidepool.svg` 内含静态海龟；它保留给领养缩略图，运行场景统一用无动物的 `*-habitat.svg` 加透明 `*-pet.svg`。三种动物的资产已逐层目视核对，不需要重画 SVG。未领养时不再给角色层设置默认海龟。
3. **背景与动物加载不同步。** 现在显式指定每个物种的背景和角色，并等待两图解码后一起显示。等待中隐藏旧图层；失败保留领养进度，显示重试入口，避免旧动物出现在新名字下或与新角色重叠。
4. **旧读取响应可能覆盖新操作。** 新增小镇读取代次和变更检查；返回页面时的旧 GET 不能覆盖刚完成的领养。浏览器已注入延迟旧海龟响应，在新领养穿山甲完成后再释放，页面与服务端仍保持穿山甲。
5. 首页脚本、样式和分层场景资源增加版本参数，刷新后加载新代码与新资源。

## 验证与数据保护

- `node --test --test-reporter=spec tests/*.test.mjs`：**51/51 通过**，包括新增 5 项领养专项、三物种原照护、巡护问答、平台、勋章摄影、活动与账本回归。
- QA 使用 `/private/tmp/helpani-adoption-20261110/qa.sqlite`，端口 3114。没有用测试操作修改玩家原库。默认预览服务已按现有数据库启动，没有清空或批量修改玩家的领养。
- 固定穿山甲首次领养实测返回 `pangolin`，右侧显示小松，背景/角色均为穿山甲；不会导航到另一个动物页。
- 延迟 GET 测试在已有海龟勋章后，从界面选择穿山甲；释放旧响应后，服务端与页面仍为 `pangolin`，背景为 `pangolin-habitat.svg`、角色为 `pangolin-pet.svg`。
- 三物种资产对照：原插画含一只，纯栖地无动物，透明角色一只，正常合成一只。绿海龟的旧整图仍可作缩略图，不再作运行背景。
- 真实 Chrome 浏览器三物种 × 桌面 1440×900 / 手机触摸仿真 390×844，共六种场景通过：所选物种、服务端、名字和版本化背景/角色均一致；刷新不换物种，无页面异常或正常资源 HTTP 错误。小熊猫正确启用 Canvas，旧插画场景隐藏。
- 海龟和穿山甲实际观察到自主动作，打招呼、首喂和刷新通过，粮/XP 不重复，公益积分、预算与支付未变化。截图已目视核对，画面各只有一只对应动物。
- 注入海龟角色图片加载失败后，整个旧画面隐藏并显示重试；恢复资源后重试成功，不重复发领养奖励。
- 针对用户确认的“小松名字＋错误图片”情形，独立测试刻意扣住穿山甲背景、让角色先完成解码。此时名字已为小松，但 `ready=false`、整个画板隐藏且加载提示可见；释放背景后才一起显示穿山甲背景与角色。没有把先到的角色叠到旧海龟图片上。

浏览器脚本：[领养恢复竞态](../tools/browser/adoption-race-review.js)、[三物种场景](../tools/browser/adoption-scene-gate.js)、[分层资产核对](../tools/browser/asset-layer-review.js)。浏览器测试使用独立会话；手机覆盖是 Chrome 触摸仿真，不能替代 iOS Safari 真机。

## 证据

- [分层资产对照](../output/playwright/asset-layer-review-20261110.png) · [核对结果](../output/playwright/asset-layer-review-20261110.json)。
- [旧状态回包后的穿山甲](../output/playwright/adoption-20261110/race-review.png) · [状态恢复结果](../output/playwright/adoption-20261110/race-results.json)。
- [穿山甲桌面](../output/playwright/adoption-20261110/pangolin-desktop.png) · [穿山甲手机](../output/playwright/adoption-20261110/pangolin-mobile.png)。
- [海龟桌面](../output/playwright/adoption-20261110/sea-turtle-desktop.png) · [海龟手机](../output/playwright/adoption-20261110/sea-turtle-mobile.png) · [加载失败重试](../output/playwright/adoption-20261110/turtle-loading-retry.png)。
- [背景延迟后正确显示穿山甲](../output/playwright/adoption-20261110/pangolin-after-delayed-background.png)。
- [六场景与加载故障测试结果](../output/playwright/adoption-20261110/scene-browser-results.json)。分层数量结论来自资源检查与目视核对，没有宣称进行像素分割计数。

运行方式继续为 `npm ci && npm start`，打开 `http://localhost:3000`。旧版页面需要刷新以载入本轮脚本。已保存的伙伴不会因修补源码被自动替换；测试证明的是正确选择、失败提示与恢复逻辑，没有宣称替用户修改了当前会话的动物。
