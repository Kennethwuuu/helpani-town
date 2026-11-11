# 科普巡护 · 实现与试玩

2026-11-09。根据玩家“原巡护比较无聊，可以加入动物科普问答”的反馈，将新落格的双分支描述改为情境问答。继续保留骰子移动、两章、勋章、木道和原有存档。

## 现在怎样玩

1. 选“认识小熊猫”或“森林与保护”，掷骰逐格前进。
2. 遇到三选一小问题，依据情境猜一猜。服务端在结算前不返回正确答案或解释。
3. 作答后看正确结论、解释、机构原文和“回林地找找看”的观察提示。答错会显示自己的猜测，再给出正确结论。
4. 可在结果卡直接继续掷骰，或把线索带回同一林地。提示不会命令竹竹表演，也不将虚拟相机变焦等同于现实观察距离。
5. 知识册累计六个独立知识页，带解释与来源可随时复习。先出主题内未学的题，再补其他未学内容；学完后尽量先出本轮未见的题，再轮换复习。选项顺序在生成待办时确定，刷新不会重新洗题。

每次题目访问只能结算一个答案，重复点击和重试不会多耗骰子或发奖。答错仍累计见闻，和答对有相同的 25% 额外发现机会；四次见闻定向收藏、经过 4/8 格的章节和完成路线的木道都保留。知识册记录“曾经答对”，后来猜错不会抹去已有状态。

## 六题与资料

题文、答案和解释在 [服务端题库](../server/patrol-questions.mjs)，前端只接收当前题目所需数据。虚构的是巡护场景，物种知识使用下列机构资料，2026-11-09 核对：

| 题目 | 来源 |
| --- | --- |
| 树枝上的大尾巴 | [史密森尼国家动物园](https://nationalzoo.si.edu/animals/red-panda) |
| 傍晚的邀约 | [史密森尼国家动物园](https://nationalzoo.si.edu/animals/red-panda) |
| 吃竹子的慢生活 | [圣迭戈动物园](https://animals.sandiegozoo.org/animals/red-panda) |
| 名字里的“熊猫” | [史密森尼国家动物园](https://nationalzoo.si.edu/animals/red-panda) |
| 把距离留给它 | [美国国家公园管理局观察指南](https://www.nps.gov/subjects/watchingwildlife/7ways.htm) |
| 把林地连起来 | [WWF 小熊猫栖地资料](https://www.worldwildlife.org/species/red-panda/) |

没有采用机构间口径不同的精确食谱比例、全球数量或寿命数字，没有把争议中的物种划分做成唯一答案。一般野生动物观察题强调遵守当地规定，不给所有物种套用统一距离。游戏木道是可使用的虚拟设施，不声称它代表完成现实栖地修复。

## 保存与兼容

- 沿用 SQLite、会话 Cookie、操作 UUID 与预期版本。新增知识字段存于独立巡护状态，不触及照护、公益积分、模拟预算或支付账本。
- 题目 ID、三个选项及顺序保存在待办；已答结果包含本次猜测、正确结论、解释、来源和观察线索；知识页按题 ID 去重，错误选项不成为知识结论。
- 没有知识字段的旧存档读取时补空列表，不修改数据库或版本。旧版双选待办仍可用原来的选择完成，下一次落格改用问答；旧故事与勋章保留。
- 保留原来的网络恢复逻辑。照片、布局和动物绘制未修改；资产仍为已有风格化虚拟场景。

## 实际验证

测试服务：`DB_PATH=/private/tmp/helpani-quiz-20261109/town.sqlite PORT=3112 HOST=127.0.0.1 PUBLIC_ORIGIN=http://127.0.0.1:3112 node server/index.mjs`。未清空原有玩家库，测试未调用远端支付或 AI。

`npm test` **39/39 通过**：11 项栖地、22 项巡护、6 项旧流程。新增 7 项问答专项覆盖六题正确/错误答案、先不泄题、主题与轮换、重复知识页与曾答对状态、末格答错仍解锁、旧存档读取和旧待办结算。巡护原有测试继续覆盖 1–6 骰点、路线边界、响应丢失、并发版本、幂等与重开数据库。主题整理后又单独复跑巡护 22/22 通过。

| 实际浏览器场景 | 结果 |
| --- | --- |
| 桌面 1440×900 | 三选一、故意答错与答对、正确结论/解释/来源、直接继续巡护，均可用 |
| 待答题刷新 | 题目 ID、题干、三个选项和顺序完全保留 |
| 重复与冲突作答 | 同 UUID 和新 UUID 重试均只结算一次；对同题改选另一答案返回 409，奖励与知识不重复 |
| 桌面一轮 | 四次问答，完成两章并取得一件木道；回林地显示当前观察线索；刷新知识册仍有四页 |
| 原有数据 | 桌面流程前后的 `/api/state` JSON 完全一致，照护和钱包没有被问答改变 |
| 手机触摸 | 393×659、DPR3、Chrome 触摸仿真：三选一、答错解释、来源、继续掷骰、答对、回林地与知识册重开均通过，无横向溢出 |
| 手机末格 | 最后故意答错，仍完成两章并取得一件木道；待办刷新不换题 |
| 服务重启与主题重访 | 同一 QA 库重启后保留四页知识；选择最终“森林与保护”主题，优先遇到尚未学过的野外观察与栖地两题，补齐六页，原有两章保留 |
| 页面异常 | 桌面和手机均无未处理的页面异常；桌面故障注入产生一次预期的 409 控制台网络记录 |

实际 browser 脚本：[桌面](../tools/browser/quiz-gate.js)、[手机](../tools/browser/quiz-mobile-gate.js)，使用 Playwright CLI `run-code --filename`，新建独立会话后运行。手机配置复用 [触摸仿真配置](../tools/browser/mobile-emulation.config.json)。

## 截图与录屏

- [桌面题目](../output/playwright/quiz/desktop-question.png) · [答错解释](../output/playwright/quiz/desktop-wrong-answer.png) · [答对解释](../output/playwright/quiz/desktop-correct-answer.png) · [知识册](../output/playwright/quiz/desktop-knowledge.png)。
- [手机题目](../output/playwright/quiz/mobile-question.png) · [手机解析](../output/playwright/quiz/mobile-answer-card.png) · [手机知识册](../output/playwright/quiz/mobile-knowledge.png)。
- [桌面试玩录屏](../output/playwright/quiz/desktop-quiz.webm) · [桌面结果 JSON](../output/playwright/quiz/desktop-results.json) · [手机结果 JSON](../output/playwright/quiz/mobile-results.json)。
- [重启后森林题目](../output/playwright/quiz/desktop-forest-question.png) · [六页知识册](../output/playwright/quiz/desktop-knowledge-complete.png) · [重访结果](../output/playwright/quiz/revisit-results.json)。

## 还没有证明的事

当前只有六题，没有题图、语音或更多物种。自动化已验证能玩与能恢复，但是否更有趣、选项难度是否合适、解释是否让玩家愿意回家观察，还需要实际玩家反馈。手机覆盖为 Chrome 触摸仿真，iOS Safari 真机仍未验收。后续先依据这轮反馈调整题目，再考虑观察图片题和更多内容。
