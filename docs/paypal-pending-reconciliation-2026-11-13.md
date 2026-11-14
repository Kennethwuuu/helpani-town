# PayPal Sandbox pending 自动对账

本轮为已保存的处理中付款补上后台状态恢复。付款状态、模拟积分、赞助额度、动物照护与物资履约仍分别记录。

## 行为

- 服务启动后继续核对已有 `pending` 且有首次捕获编号的订单。无需买家重复打开原回跳地址。
- 后台只调用 PayPal Orders 查询接口；OAuth 令牌在有效期内缓存。不会自动创建订单、再次调用 `/capture`、退款或发起付款。
- 每次核对订单编号、资料引用、唯一 purchase unit、唯一 capture、首次保存的捕获编号、USD 币种和精确金额。只有验证通过且 PayPal 明确返回已完成，才显示付款完成。
- 捕获仍为 `PENDING` 时保留处理中。明确拒绝/失败显示付款未完成；已退款和部分退款分别显示。网络、认证、限流、结构或金额异常不会被推断为付款成功或付款失败，原记录保留待后续核对。
- 处理中订单的重复回跳改为只读检查。已完成、失败或退款的旧回跳只读取现有账本，不会再次捕获。
- 支持记录页可见且有处理中记录时，每 5 秒读取本地状态。离开页面、隐藏窗口或没有处理中记录时停止轮询；后台读取失败保留已显示的记录。此轮询不直接请求 PayPal。

## 调度和配置

默认起始间隔 60 秒；每轮最多处理 5 笔，所有后台和回跳触发的核对共用串行队列。同一订单的并发核对共用一次请求。持续处理中或查询失败会指数退避，最长每小时一次。重试时间和次数写入 SQLite，服务重启不会清零退避。

| 可选设置 | 默认值 | 说明 |
| --- | --- | --- |
| `PAYPAL_RECONCILE_ENABLED` | `true` | 已配置 Sandbox 凭据才运行；设为 `false` 或 `0` 暂停后台核对并保留任务。 |
| `PAYPAL_RECONCILE_INTERVAL_MS` | `60000` | 允许 1000–3600000；生产建议保留默认值，1000 仅用于隔离测试。 |

不需要新增凭据、外部队列、付费服务或 webhook 配置。继续保持单应用实例。

## 数据升级与回滚

首次启动会在一个 SQLite 事务中扩展旧 `paypal_orders.status` 约束，加入 `failed`、`refunded`、`partially_refunded`；保留所有原字段、隐藏 rowid、订单/捕获唯一约束，并新增 `paypal_reconciliations` 持久重试表。未识别的旧表列、额外索引或触发器会使升级停止，保留原数据。

正式发布前必须做一致的 SQLite 在线备份并验证 `quick_check`；运行中的 WAL 数据库不能只复制主文件。代码回滚保留升级后的数据库和累计额度。旧代码可继续读取原有 pending/completed 记录，但不能展示本轮新增的失败/退款状态；后台任务会随新版本进程退出而停止。不要用旧数据库备份覆盖发布后的新付款或玩家进度。

## 范围

- 自动核对只针对本地已经保存的 pending 捕获。没有买家授权或没有确认过捕获编号的 created 订单不会被自动捕获。
- 已确认的终态不再持续轮询。本功能不宣称跟踪付款完成之后新发生的退款或争议，也不代替 webhook。
- 付款完成只代表 Sandbox 测试付款，不表示物资采购、交付或救助成果已发生。
- 验证使用模拟 PayPal、临时数据库和无头浏览器；不为验收创建新的真实 Sandbox 付款。

## 官方接口依据

- [Orders API](https://developer.paypal.com/api/rest/integration/orders-api)
- [Capture 状态](https://developer.paypal.com/api/payments/v2/definitions/capture_status/)
- [限流与令牌缓存](https://developer.paypal.com/api/rest/reference/rate-limiting/)
- [请求幂等](https://developer.paypal.com/api/rest/reference/idempotency/)

## 验证

专项测试：`node --test tests/paypal.test.mjs tests/paypal-reconciliation.test.mjs tests/paypal-reconciliation-http.test.mjs`。

前端隔离复验脚本：`tools/browser/paypal-reconciliation-gate.js`。必须在本机使用全模拟响应和无头临时浏览器，结束后关闭会话；不要指向生产站点。

2026-11-14 验证结果：

- 独立副本全套 **160/160 通过**；其中新增网关 21 项、账本/调度 14 项、HTTP 7 项。原工作区首轮出现一项未改动勋章 PNG 的读取超时，保留首轮记录；独立本地副本复核未放宽断言。
- 无头浏览器 6 组模拟场景通过：终态自动显示、混合状态双向翻译、网络恢复、隐藏暂停、离页停止，以及旧读取不覆盖后续操作。JavaScript 错误 0，结束后浏览器进程 0。
- 这些验证均未调用真实模型或付款；PayPal 响应来自严格模拟，不将其描述为真实 Sandbox 联调。
