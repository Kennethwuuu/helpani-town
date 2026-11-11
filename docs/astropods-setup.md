# Astropods 接入步骤

## 1. 注册账号

从 [本次赛事的 Astropods 页面](https://paypalaihackathon.devpost.com/details/astropods) 进入注册，或在 [Astropods 官网](https://astropods.com/) 点击 Get started。完成账号注册和邮箱验证；如有团队/账户选择，使用自己的获准账户。

本项目没有预设官方合作、免费额度或已经获得网关权限。额度与访问情况以该账户实际状态为准。

## 2. 获得可用的网关配置

官方推荐的方式是通过启用 Gateway 的 agent 项目注入配置，而非把 CLI 登录令牌当作模型 API Key。[AI Gateway 官方说明](https://docs.astropods.com/ai-gateway)

官方入门需要 Docker 安装并运行，以及 Astropods CLI。首次使用先按 [CLI 安装说明](https://docs.astropods.com/cli) 安装，再确认 `ast --version`。随后：

```bash
ast login
```

在打开的浏览器里完成账户授权。若需要创建官方 Gateway starter，在**与本项目分开的目录**执行：

```bash
ast project create helpani-gateway --model gateway
cd helpani-gateway
ast project start
```

以上是官方 starter 的流程，不会自动把它接成 Helpani 网页。不要在现有工程目录使用 `--force`，也不需要为了本地验收先运行付费部署。Gateway 项目的运行环境会注入 `ASTRO_GATEWAY_URL`、`ASTRO_GATEWAY_API_KEY` 和所选模型的 `MODEL_DEFAULT`。具体运行步骤以当前 CLI 帮助和 starter 配置为准。[项目命令](https://docs.astropods.com/cli/project) · [完整入门](https://docs.astropods.com/get-started)

如果账户或赛事支持提供了可直接用于本地应用的网关主机地址及网关密钥，可使用这组获准配置。没有找到网关凭据入口时，先核实账户权限或联系赛事支持，不要尝试用账户登录令牌代替，也不要将整个容器环境打印到聊天或录屏里。账户注册完成后，可以由开发协作继续处理本地 CLI/容器配置及所需两项变量的安全转存。

## 3. 配置 Helpani

将取得的配置直接填写到本机 `.env`，不要提交到 Git：

```dotenv
ASTRO_GATEWAY_URL=https://你的网关主机
ASTRO_GATEWAY_API_KEY=你的网关密钥
ASTRO_GATEWAY_MODEL=claude-haiku-4-5
```

URL 只填写 HTTPS 主机，不附加 `/v1` 或 `/chat/completions`。服务端会追加 `/v1/chat/completions`。模型优先使用 `ASTRO_GATEWAY_MODEL`，其次是运行环境注入的 `MODEL_DEFAULT`，最后使用默认 `claude-haiku-4-5`。[Chat Completions](https://docs.astropods.com/ai-gateway/chat) · [支持模型](https://docs.astropods.com/ai-gateway/models)

## 4. 本地检查与实际调用

```bash
npm run doctor
```

此命令只检查本地配置，不访问 PayPal 或 AI，也不证明凭据有效。网关未配置时，`/project-draft` 的资料和程序预算核对仍可使用，AI 生成按钮会保持不可用。

```bash
npm run check:ai
```

此命令会发出**两次实际模型请求**：完整三条资料和仅观察资料。结果写入被忽略的 `output/ai-smoke-latest.json`，终端只输出状态。通过结构检查后仍需人工核对摘要、预算建议及引用是否符合所选资料；不能把程序金额核对当作模型真实性或正式财务审核证明。

配置好后重启 Helpani 服务，打开 `/project-draft` 进行页面联调。不要重置玩家数据库或相册。

## 5. 错误排查

| 错误码 | 下一步 |
| --- | --- |
| `AI_NOT_CONFIGURED` | 网关主机或密钥尚未填写。 |
| `AI_CONFIGURATION_INVALID` | 检查 HTTPS 主机格式，移除 `/v1`、查询参数和地址中的账号密码。 |
| `AI_AUTHENTICATION_FAILED` | 核对获准的 Gateway 密钥；CLI 登录令牌不能代替它。 |
| `AI_RATE_LIMITED` | 检查账户额度或频率限制，稍后再试。 |
| `AI_TIMEOUT` | 本次请求超过 45 秒，可稍后重试。 |
| `AI_RESPONSE_INVALID` | 模型没有返回可用结构或引用，原资料保留，可重试并人工核对。 |
| `AI_UNAVAILABLE` | 检查网络、网关状态和模型权限。 |

[官方错误说明](https://docs.astropods.com/ai-gateway/limits)。未接通时如实保留待配置状态，不用固定示例冒充实际 AI 输出。
