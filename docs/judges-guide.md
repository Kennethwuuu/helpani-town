# Helpani Town — Judge's Guide

Helpani Town connects a continuing virtual animal-care game with transparent ways to support wildlife projects. Players care for a green turtle, red panda, or Chinese pangolin, explore a species-specific learning trail, and choose whether to join an activity or support a project. Astropods helps an organizer turn selected project materials into a reviewable task draft. PayPal handles the Sandbox checkout.

All organizations, activity attendance checks, project updates, and sponsor budgets in this prototype are fictional. Animal care, food, photographs, and medals are virtual. PayPal transactions use test funds. Access to a developer tool establishes technical access; organization partnerships, data permissions, and real funding arrangements remain to be validated.

The delivery is still being prepared. The repository is currently private and an open-source LICENSE has not yet been supplied. Live Astropods generation, a clean-clone release check, and the final public video remain pending. The recorded validations below describe specific tested versions, rather than certifying every subsequent change.

From a clean clone with repository access, use Node.js **22.13 or newer** and npm. In the repository root, run the following commands. Keep the terminal running while using the app.

```bash
npm ci
cp .env.example .env
npm run doctor
npm start
```

Open [the local app](http://localhost:3000). The default `doctor` command checks local readiness without API calls. `npm start` loads the private `.env` file and creates `data/helpani.sqlite` on first use. Without payment or AI configuration, the game and simulated activities remain playable and the corresponding integration screens show a configuration message. Opening HTML files directly bypasses the HTTP server and its APIs.

Keep one browser and one origin throughout the walkthrough. The default origin is `http://localhost:3000`, matching `PUBLIC_ORIGIN` in `.env`. If you change the host or port, update `PORT`, `HOST`, and `PUBLIC_ORIGIN` together and open that exact URL. `localhost` and `127.0.0.1` have separate cookies and photo storage. The server keeps progress in SQLite under a 30-day demo-session cookie. Photos use this browser's IndexedDB and can be downloaded as PNGs. Formal accounts and cross-device restoration are future pilot work. A private window starts a separate demo session and sponsor budget.

For PayPal, create or select a **Sandbox** app in the PayPal Developer Dashboard, then privately set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Prepare a Sandbox personal buyer account to authorize checkout. Restart the server after configuration changes. The app creates and captures orders through its server, then shows the result on `/support`. A buyer can also cancel and return. Use the Sandbox app's credentials and keep credentials, access tokens, and buyer passwords out of the repository and recording. [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)

For Astropods, first obtain permitted gateway access through your account. The official workflow describes `models.default.provider: gateway` in an `astropods.yml` agent specification and uses `ast login` plus `ast project` to inject gateway variables into a local agent container. Existing provisioned access may supply an authorized gateway address and key for the Node service. Account access and that external-service path still need verification for this project; filling an `.env` field alone does not provision them. Start from the event's official resource page and the gateway setup instructions. [Astropods event resources](https://paypalaihackathon.devpost.com/details/astropods) · [Astropods AI Gateway setup](https://docs.astropods.com/ai-gateway)

Once access is provisioned, set these variables privately and restart the app.

| Variable | Meaning |
| --- | --- |
| `ASTRO_GATEWAY_URL` | The platform-provided HTTPS gateway **origin only**, such as `https://YOUR-GATEWAY-HOST`. Omit `/v1`, query parameters, and embedded credentials. The adapter adds `/v1/chat/completions`. |
| `ASTRO_GATEWAY_API_KEY` | The permitted gateway key. The CLI's platform-login OAuth token serves a different purpose. |
| `ASTRO_GATEWAY_MODEL` | Optional model override. A runtime-provided `MODEL_DEFAULT` can supply the selected gateway model; the fallback is `claude-haiku-4-5`. |

The explicit command below makes **two live draft requests** and can consume provider usage. Run it after gateway access is configured. The default `doctor` command does not perform these requests. A configured status alone confirms the local configuration shape; a successful live result is the integration check. [Chat Completions API](https://docs.astropods.com/ai-gateway/chat) · [Gateway errors and limits](https://docs.astropods.com/ai-gateway/limits)

```bash
npm run check:ai
```

For a short judging walkthrough, follow this sequence.

1. Open `/` and choose **绿海龟** (green turtle). Greet the virtual animal, then feed it once. The initial welcome gives one food, feeding consumes one food and adds 10 game XP. Open **故事** to see the first care chapter. The demo can advance the local game day with **切到次日（演示）**. Care chapters unlock at 1, 3, 5, and 6 feedings, with an explicit protection-medal claim after the final chapter.
2. Return to the care area and open the patrol. Pick a theme, roll the die, and answer one question. Read the explanation and source. Each species has its own eight-cell trail, six questions, knowledge collection, and rewards. The care chapters and patrol chapters have separate progress. Habitat placement and photography can be explored from the same care area.
3. Open `/activities` and select **模拟报名** for **湿地净滩**. Open **组织方演示台**, search for that activity, filter **待模拟核验**, and choose **模拟核验** on its row. Return to the player's activity page and refresh to see 100 charity points. This is a simulation of an organizer's approval.
4. Open `/support` and use **用 100 分预留 US$2**. The charity balance becomes zero and this session's fictional budget moves from USD 10 to USD 8. The record represents a simulated reservation awaiting a future real funding arrangement. An alternative use of the same charity-point balance is 50 points for one virtual care food.
5. From `/organizer`, open **救助资料 → 生成任务草稿**. At `/project-draft`, first select all three fictional sources and generate a draft. Review the source-derived budget figures separately from the model's suggestions. The budget target is USD 100; eight items at USD 8 total USD 64, with USD 36 still requiring detail and quotations. Then select only **观察区说明** and generate again. The result should stay within the two light sources and virtual observation described there, and show missing budget information. Open the citations and compare them with the selected material. Live execution of these two cases is still TODO.
6. In `/support`, expand **为指定物资出资** and choose the USD 8 Sandbox checkout for one shade-care cloth. After buyer authorization and server capture, return to the support record. **物资待采购（演示）** means the material awaits purchasing. Payment confirmation, shipping, receipt, and rescue outcomes have separate evidence and states.

The AI budget panel derives arithmetic from the selected source fields. The generated summary, review suggestions, and virtual task come from the model and require human review against the source text. Observation-only input has no supplied budget to calculate. Changing the selected sources clears the old draft. A failed generation keeps the source choices available for retry. Drafts are displayed for organizer review; publishing a generated task is a later workflow.

Use these labels to follow the Chinese UI during the English demonstration.

| Chinese UI label | English meaning |
| --- | --- |
| 小镇 / 故事 / 活动 / 支持 | Town / Stories / Activities / Support |
| 绿海龟 / 小熊猫 / 中华穿山甲 | Green turtle / Red panda / Chinese pangolin |
| 照护粮 / 成长 XP | Virtual care food / Game growth XP |
| 打招呼、轻抚 / 喂食 | Greet or gently interact / Feed the virtual animal |
| 领取今日免费粮 | Claim today's free virtual food |
| 切到次日（演示） | Advance the demo game day |
| 保护勋章 / 领养下一只伙伴 | Protection medal / Welcome the next companion |
| 布置栖地 / 确认 / 取消 | Arrange habitat / Confirm / Cancel |
| 巡护 / 掷骰 / 知识册 | Patrol / Roll the die / Knowledge collection |
| 拍照 / 相册 / 下载 | Take a photo / Photo album / Download |
| 公益积分 / 模拟报名 | Charity points / Simulate activity signup |
| 组织方演示台 / 待模拟核验 / 模拟核验 | Organizer demo / Awaiting simulated verification / Simulate verification |
| 用 50 公益积分换 1 份照护粮 | Exchange 50 charity points for one virtual care food |
| 用 100 分预留 US$2 / 演示额度已预留 | Reserve USD 2 using 100 points / Demo budget reserved |
| 救助任务草稿 / 选择资料 / 生成任务草稿 | Rescue task draft / Select sources / Generate draft |
| 资料摘要 / 预算待确认项 / 任务引用 | Source summary / Budget review suggestions / Task citations |
| PayPal 沙箱捐助 / 为指定物资出资 | PayPal Sandbox contribution / Fund a specified material |
| 前往 PayPal 沙箱 / 我的记录 | Continue to PayPal Sandbox / My records |
| 物资待采购（演示） / 尚未确认送达或救助成果 | Material awaiting purchase, simulated / Delivery and rescue outcomes await evidence |

The prototype records these quantities separately.

| Record | Source and meaning |
| --- | --- |
| Game XP, food, care stories | Virtual care actions and progression. Patrol and habitat discoveries have their own records. |
| Charity points | Simulated organizer-verified activity records. The player chooses between virtual food and a demo-budget reservation. |
| Sponsor reservation | A per-session fictional USD 10 pool with a USD 2 reservation. Sponsor-funded payouts and operating funding await partner validation. |
| PayPal Sandbox payment | A test order and server-confirmed capture. The supporter chooses a contribution or a specified-material purpose. |
| Fulfillment and rescue evidence | Organization-reported purchase, shipment, receipt, and outcome records. Current records are explicitly fictional examples. |

Recorded evidence available in the project includes a USD 5 Sandbox contribution with matching remote capture and local record, plus safe completed-callback replay. The later incremental run completed a USD 8 material contribution, cancellation and re-entry, and the AG Grid-to-player points workflow. The game UI test used Chrome touch emulation. These are specific recorded passes, while live Astropods generation and final delivery verification remain open. [USD 5 Sandbox evidence](paypal-sandbox-2026-11-11.md) · [USD 8, cancellation, and organizer UI evidence](qa-report-2026-11-11.md) · [Three-species gameplay evidence](species-patrol-2026-11-11.md)

Before delivery, complete the live AI checks and capture their source comparisons, check the release in a clean clone, publish an authorized public repository with an open-source LICENSE, and record a public English YouTube demo shorter than three minutes. Supply English translations for any additional submitted materials. Raw files referenced under `output/` are local QA artifacts and need a redacted delivery copy if used as public evidence. The final submission URL, repository URL, and video URL are TODO.
