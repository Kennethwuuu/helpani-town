# Helpani Town 动物救助小镇

[线上试玩](https://vibecreating.tech) · [English judge guide](docs/judges-guide.md) · [English demo script](docs/demo-script-en.md) · [Server deployment guide](docs/deploy-existing-server.md)

一个聚焦野生动物保护与救助的公益游戏原型。玩家选择或随机遇见一位虚拟动物伙伴，喂养并解锁成长手记，也可以浏览上海样例活动，体验报名、模拟核验和项目支持。项目、机构、活动、赞助预算及救助更新均为演示数据。

线上游戏和 Astropods 草稿已实际验证，应用重启后照护与 AI 计数保留；新域名的 US$5 PayPal Sandbox 付款已完成回跳，与远端订单、捕获及线上账本核对一致，重启后支付记录保留。部署版本、验证范围和剩余事项见 [线上部署记录](docs/vps-deployment-2026-11-12.md)。

本轮“小熊猫的新休息角落”以动物自主生活为核心：观察竹竹探索、攀爬和休息，选择平台位置，再拍下自己布置中的瞬间。生活、布置、摄影与巡护带回木道的闭环已实现并实际试玩。巡护包含 6 道科普问答、答案解释、资料来源和知识册，见 [问答实现与验收](docs/patrol-quiz-2026-11-09.md)。最新完成首次掌握反馈、针对错误的解释、插画勋章揭晓和可保存到照片的勋章角标，见 [奖励实现与试玩记录](docs/quiz-rewards-2026-11-09.md)。动作、恢复与摄影复测见 [2026-11-09 测试记录](docs/playtest-2026-11-09.md)，初次验收及头部造型修复见 [2026-11-08 试玩记录](docs/playtest-2026-11-08.md)。功能说明不代替验收记录。


11 月 10 日起，三位伙伴共用首页的**照顾场景**：喂粮、虚拟轻抚/打招呼、观察、布置、拍照和相册都在同一处。穿山甲与海龟新增独立 Canvas 生活场景，各有两处可使用的设施位置；存档和观察按物种分别保存。见 [统一照顾实现与验收](docs/unified-care-2026-11-10.md)。

11 月 11 日补齐三物种科普巡护：小熊猫、中华穿山甲和绿海龟各有 6 题、8 格路线、两段故事和独立知识册；穿山甲与海龟各新增 3 枚原创矢量勋章，首次完成路线确定获得纪念勋章，可装饰照片。小熊猫保持木道奖励。题目、待办、收藏和装备按物种保存，见 [三物种巡护实现与验收](docs/species-patrol-2026-11-11.md)。

[动物体验规格](docs/animal-life-experience.md) · [巡护探索规格](docs/patrol-exploration.md) · [产品路线](docs/product-plan.md) · [资产与资料说明](docs/assets.md)

11 月 10 日修复领养物种误报与旧插画叠影：不同固定物种的旧请求不再返回另一伙伴并报成功；背景和角色同步加载，旧整图只用于缩略图。详见 [修复与验证记录](docs/adoption-scene-fix-2026-11-10.md)。

## 本地运行

需要 Node.js 22.13 或更高版本。SQLite 随 Node 提供，`npm ci` 会安装组织方演示台使用的 AG Grid Community。当前交接版本在 `codex/ai-draft-readiness`，`main` 仍为较早版本；克隆私有仓库需要现有访问权限。

```bash
git clone --branch codex/ai-draft-readiness https://github.com/Kennethwuuu/helpani-town.git
cd helpani-town
npm ci
cp .env.example .env
npm run doctor
npm start
```

已有本地仓库时，在仓库目录执行 `git switch codex/ai-draft-readiness` 替代前两行，再继续安装；已有私有 `.env` 时保留其内容。默认不填 PayPal 和 AI 密钥也能体验动物照顾、巡护及模拟活动；沙箱支付和 AI 生成保持未配置状态，资料预算核对仍可使用。`doctor` 不调用外部服务。

在浏览器打开 `http://localhost:3000`。请先启动服务；直接预览 `public/*.html` 会跳到默认服务地址，游戏资源和 API 需要通过 HTTP 加载。首次运行会创建 `data/helpani.sqlite`。小镇、布局、观察、巡护、演示账本和沙箱付款记录使用 SQLite 保存，按当前浏览器的演示会话隔离；会话 Cookie 保留 30 天，没有正式账号或跨设备恢复。无痕窗口可体验新的演示会话，每个会话使用独立的模拟预算。

如果 3000 端口已有服务，占用不会被自动替换。选择空闲端口，并同时设置 `HOST`、`PORT`、`PUBLIC_ORIGIN`；需要独立数据时将 `DB_PATH` 指向尚不存在的新文件。例如：

```bash
HOST=127.0.0.1 PORT=3120 PUBLIC_ORIGIN=http://127.0.0.1:3120 DB_PATH=data/helpani-3120-new.sqlite npm start
```

此时打开 `http://127.0.0.1:3120`，继续使用相同地址。新数据库路径会保留原有数据文件；再次使用该路径则延续该数据库的记录。

照片使用 IndexedDB，仅保存在当前浏览器和当前网站地址下；刷新、重开后可回看，清除网站数据会移除照片，建议下载 PNG 备份。`localhost` 与 `127.0.0.1` 是不同网站地址，请用同一个地址继续试玩。

运行自动化检查：

```bash
npm test
```

测试使用独立临时数据库，不读取或更改 `data/helpani.sqlite`；HTTP 回归需要允许监听本机端口。浏览器试玩记录、复测脚本和截图在 [测试记录](docs/playtest-2026-11-09.md)。本轮修改前的源码快照及 SHA-256 清单保存在 `/private/tmp/helpani-baseline-20261107/`，该目录是本机临时备份，不随仓库分发。

后续验收与测试 Agent 交接见 [参赛前测试计划](docs/test-plan-2026-11-11.md)，包含优先级、隔离环境、真实服务与模拟测试、通过标准及报告模板。

## PayPal Sandbox

1. 在 [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) 创建或选择 Sandbox 应用，并准备 Sandbox 个人买家账号。
2. 将 `.env.example` 复制为 `.env`，填入 Sandbox 应用的 `PAYPAL_CLIENT_ID` 和 `PAYPAL_CLIENT_SECRET`，然后重启服务器。`.env` 已被 Git 忽略。浏览器访问地址要与 `PUBLIC_ORIGIN` 一致。
3. 在项目详情选择金额或认捐遮光护理布。跳转后用 Sandbox 买家账号授权，再返回小镇查看沙箱记录。

支付接口固定连接 PayPal Sandbox。服务端创建订单，并在用户授权返回后核对项目支持记录、币种、金额及 PayPal 捕获状态。没有沙箱凭据时，页面会显示配置提示，小镇玩法和模拟赞助仍可运行。物资选项表示对指定物资的沙箱出资，送达和救助结果由后续独立证据确认。

2026 年 11 月 11 日已跑通一笔 USD 5.00 沙箱捐助，远端订单及捕获均为 `COMPLETED`，并与本地账本核对一致。覆盖范围与待补项见 [PayPal Sandbox 联调记录](docs/paypal-sandbox-2026-11-11.md)。

随后完成 USD 8 指定物资付款、买家取消再发起，以及活动报名到核验积分和模拟赞助的界面验收，三项均通过；范围与原始证据见 [本轮增量测试报告](docs/qa-report-2026-11-11.md)。

可将 [Postman 集合](tools/postman/helpani.postman_collection.json) 和 [空白环境模板](tools/postman/helpani.postman_environment.json) 导入 Postman。前两个文件夹只调用本地服务，验证金额校验、报名核验和积分去重。第三个文件夹使用独立的 PayPal Sandbox 测试订单，按各请求的说明逐项发送。沙箱凭据只填在私有环境中，买家在浏览器授权后再确认捕获。要验证小镇订单回跳及账本更新，请通过小镇页面另走一次完整结账。 [PayPal 官方 Postman 指南](https://developer.paypal.com/api/rest/postman/)

## 试玩路线

1. **领养后直接照顾**：首页选择小熊猫、穿山甲或绿海龟，当前伙伴的 Canvas 栖地直接出现在照顾卡片内。原“试玩平台布置”入口已撤下，旧 `/woodland` 链接归一到首页照顾区；未领养时先选择伙伴。
2. **同页喂粮与互动**：场景旁可领免费粮、喂食和轻抚/打招呼，动作反馈在当前动物身边出现。每天免费粮及两次照护上限、来信和成长 XP 沿用原规则。互动明确属于虚拟场景，第一次打招呼仍记录熟悉进度。
3. **观察与布置**：点“布置栖地”，小熊猫选择高/低平台，穿山甲选择树根窝/落叶坡，海龟选择海草边/礁石旁的水下休息台。预览、确认、取消、移动和共同观察册在同一页面。保存即记建设，动物首次使用另记观察；移动不重复奖励，各物种布局独立。
4. **同页摄影**：打开相机隐藏照护界面，拖动、缩放、寻找伙伴并拍下这一刻。静态裁切、保存相册、重开与下载共用同一张 1600×1000 PNG，保留物种、伙伴名和虚拟场景标识。旧照片保持拍摄时的姿态、布局和物种。
5. **三物种巡护**：照顾区向下可见当前伙伴的八格巡护，选择认识伙伴或栖地保护主题，掷骰、答题并收进知识册；可查看解释、来源和回家观察线索。三种动物进度独立；小熊猫完结获木道，穿山甲和海龟首次完结确定保留一枚专属纪念勋章。勋章可装备进入预览、相册和下载。

三种原有领养、首喂故事、日限额、活动报名核验、兑换、赞助及支付提示继续可用。虚拟照护、栖地成长、公益积分和 PayPal Sandbox 付款继续分开记录。运行资产是风格化程序绘制场景，旧 SVG 保留为领养缩略图、故事和原型素材；写实毛发、完整物理与真实声场未实现，详见 [资产说明](docs/assets.md)。

## 救助任务草稿

先按 [Astropods 接入步骤](docs/astropods-setup.md) 注册，使用官方账户 Gateway key API 为独立 Node 服务创建获准的模型密钥，无需 Docker。Gateway agent starter 的运行环境注入是可选接入方式。CLI 登录令牌用于账户管理，不能当作模型密钥；参考 `.env.example` 将 Gateway 配置填入本机私有 `.env` 并重启小镇。 [账户密钥 API](https://docs.astropods.com/api-reference/astropods-api/ai-gateway/create-an-ai-gateway-account-key) · [赛事资源](https://paypalaihackathon.devpost.com/details/astropods) · [官方 Gateway 说明](https://docs.astropods.com/ai-gateway)

| 变量 | 值 |
| --- | --- |
| `ASTRO_GATEWAY_URL` | 平台提供的 HTTPS 网关主机地址。服务端会追加 `/v1/chat/completions`。 |
| `ASTRO_GATEWAY_API_KEY` | AI Gateway 账户密钥。保存在服务端私有配置中。 |
| `ASTRO_GATEWAY_MODEL` | 可选，其次使用运行环境的 `MODEL_DEFAULT`，最后默认 `claude-sonnet-4-6`。 |

从组织方演示台打开 `/project-draft`，勾选虚构资料。服务端独立计算预算：完整资料为目标 US$100、物资 US$64、未分项 US$36，仅观察资料为未知金额；程序核对不调用模型、不修改付款或积分。Astropods 生成摘要、预算待确认建议和虚拟学习任务草稿，显示模型、来源和人工复核标记。更换资料或请求失败会清除旧草稿；草稿不会自动发布，提出的虚拟地图等交互仍待实现。 [Astropods Chat Completions](https://docs.astropods.com/ai-gateway/chat) · [MVP 方案](docs/mvp.md)

```bash
npm run doctor    # 只检查本地运行与配置，不调用服务
npm run test:ai   # 新增 AI 单元与 HTTP 测试，不调用外部服务
npm run check:ai  # 两次真实草稿操作；每份至多一次格式重试，共至多四次网关请求
```

Sonnet 4.6 的两组 CLI 检查及最终浏览器验收已通过；浏览器两次草稿操作实际使用三次网关请求，18/18 AI 隔离回归通过，390×844 与 320px 宽度检查正常。仅 `AI_RESPONSE_INVALID` 自动重试一次，共享每份草稿 45 秒期限；认证、限额和网络错误不自动重试。`doctor` 不发 API 请求，配置标记和结构通过仍不能代替未来草稿的人工核对。失败历史和验收范围见 [真实 AI 证据](docs/astropods-live-2026-11-11.md)及 [开发记录](docs/ai-readiness-2026-11-11.md)。候选提交已通过[独立克隆与运行检查](docs/clean-clone-2026-11-11.md)；公开仓库、许可证、最终公开版本验收、评委真实服务访问安排和实际视频仍待完成；开发者私有密钥不会随项目分发。
