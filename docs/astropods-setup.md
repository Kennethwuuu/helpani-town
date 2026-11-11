# Astropods 接入步骤

## 1. 注册账号

从 [本次赛事的 Astropods 页面](https://paypalaihackathon.devpost.com/details/astropods) 进入注册，或在 [Astropods 官网](https://astropods.com/) 点击 Get started。完成账号注册和邮箱验证；如有团队/账户选择，使用自己的获准账户。

机构合作和数据权限仍待验证。Gateway 的技术访问与可用额度以所选账户实际状态为准。

## 2. 获得可用的网关配置

Helpani 的独立 Node 服务可以使用官方 **Create an AI Gateway account key** API 申请账户 Gateway 密钥。密钥创建通过已授权账户的 API 完成，无需 Docker，也无需先启动 agent 容器。按官方接口文档使用账户授权调用创建密钥接口，并将取得的 Gateway 密钥与平台提供的网关主机安全写入本机私有 `.env`。[账户 Gateway 密钥 API](https://docs.astropods.com/api-reference/astropods-api/ai-gateway/create-an-ai-gateway-account-key)

CLI 登录令牌用于 Astropods 平台的账户授权和管理 API；`ASTRO_GATEWAY_API_KEY` 使用新创建的 Gateway 密钥。创建响应、认证请求头及本机凭据文件都保持私有，不打印到聊天、录屏或公开日志。登录成功、存在余额或密钥创建成功各有自己的验证范围，实际模型生成仍以第 4 步的两组草稿操作结果为准。

首次使用 CLI 时，按 [CLI 安装说明](https://docs.astropods.com/cli) 安装并确认 `ast --version`，然后执行：

```bash
ast login
```

在打开的浏览器里完成账户授权，再按官方账户密钥 API 申请可供独立服务使用的密钥。使用平台提供的网关地址，不猜测主机，也不把 CLI 登录令牌填入模型密钥变量。

另一种可选方式是启用 Gateway 的 agent 项目。此 starter 的本地运行需要 Docker 安装并运行，适合希望使用 agent 容器注入配置的开发者。其规格声明 `models.default.provider: gateway`；在**与本项目分开的目录**执行：

```bash
ast project create helpani-gateway --model gateway
cd helpani-gateway
ast project start
```

Gateway 项目的运行环境会注入 `ASTRO_GATEWAY_URL`、`ASTRO_GATEWAY_API_KEY` 和所选模型的 `MODEL_DEFAULT`。容器 starter 是可选接入方式；Helpani 独立服务使用账户 Gateway 密钥时，直接进入第 3 步。具体 starter 运行步骤以当前 CLI 帮助和配置为准。[AI Gateway 官方说明](https://docs.astropods.com/ai-gateway) · [项目命令](https://docs.astropods.com/cli/project) · [完整入门](https://docs.astropods.com/get-started)

账户密钥接口拒绝访问时，核对当前账户的授权和接口要求，或联系官方支持。使用经过允许的网关配置，避免将整个 CLI 或容器环境输出到日志。

## 3. 配置 Helpani

将取得的配置直接填写到本机 `.env`，不要提交到 Git：

```dotenv
ASTRO_GATEWAY_URL=https://你的网关主机
ASTRO_GATEWAY_API_KEY=你的网关密钥
ASTRO_GATEWAY_MODEL=claude-sonnet-4-6
```

URL 只填写 HTTPS 主机，不附加 `/v1` 或 `/chat/completions`。服务端会追加 `/v1/chat/completions`。模型优先使用 `ASTRO_GATEWAY_MODEL`，其次是运行环境注入的 `MODEL_DEFAULT`，最后使用默认 `claude-sonnet-4-6`。[Chat Completions](https://docs.astropods.com/ai-gateway/chat) · [支持模型](https://docs.astropods.com/ai-gateway/models)

## 4. 本地检查与实际调用

```bash
npm run doctor
```

此命令只检查本地配置，不访问 PayPal 或 AI，也不证明凭据有效。网关未配置时，`/project-draft` 的资料和程序预算核对仍可使用，AI 生成按钮会保持不可用。

```bash
npm run check:ai
```

此命令执行**两次真实草稿操作**：完整三条资料和仅观察资料。每份草稿仅在 `AI_RESPONSE_INVALID` 时允许一次格式重试，两次尝试共享 45 秒期限，因此成功完成两组检查通常需要两次、最多四次网关请求；实际请求次数以本次记录为准。认证、限额和网络错误不自动重试。返回草稿中的 `generation.attempts` 为 1 或 2，表示该草稿使用的尝试次数。

结果写入被忽略的 `output/ai-smoke-latest.json`，终端只输出状态。通过结构检查后仍需人工核对摘要、预算建议及引用是否符合所选资料；不能把程序金额核对当作模型真实性或正式财务审核证明。新增有限重试的回归与浏览器验收须单独记录，不能沿用早先两次无重试 CLI 成功结果宣称通过。

配置好后重启 Helpani 服务，打开 `/project-draft` 进行页面联调。不要重置玩家数据库或相册。

## 5. 错误排查

| 错误码 | 下一步 |
| --- | --- |
| `AI_NOT_CONFIGURED` | 网关主机或密钥尚未填写。 |
| `AI_CONFIGURATION_INVALID` | 检查 HTTPS 主机格式，移除 `/v1`、查询参数和地址中的账号密码。 |
| `AI_AUTHENTICATION_FAILED` | 核对获准的 Gateway 密钥；CLI 登录令牌不能代替它。 |
| `AI_RATE_LIMITED` | 检查账户额度或频率限制，稍后再试。 |
| `AI_TIMEOUT` | 本次草稿操作用尽共享的 45 秒期限，可稍后重试。 |
| `AI_RESPONSE_INVALID` | 模型没有返回可用结构或引用；一次允许的格式重试后仍无有效结果则报错。原资料保留，可稍后重试并人工核对。 |
| `AI_UNAVAILABLE` | 检查网络、网关状态和模型权限。 |

[官方错误说明](https://docs.astropods.com/ai-gateway/limits)。未接通时如实保留待配置状态，不用固定示例冒充实际 AI 输出。
