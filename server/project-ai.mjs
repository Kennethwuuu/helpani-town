const defaultModel = 'claude-sonnet-4-6';
const timeoutMs = 45_000;

export const projectSources = Object.freeze([
  Object.freeze({
    id: 'rescue-plan',
    title: '夜间观察站计划 · 虚构资料',
    text: '潮汐湾野生动物救助站为海龟夜间恢复区准备遮光用品，以减少人造光干扰。项目演示筹资目标为 US$100。护理人员负责实际照护和设备安排。',
  }),
  Object.freeze({
    id: 'supply-register',
    title: '物资登记与预算 · 虚构资料',
    text: '11 月 6 日登记遮光护理布 8 件，每件 US$8，小计 US$64。其余 US$36 尚待分项和报价确认。当前进展为需求已登记，采购与签收记录均待更新。',
  }),
  Object.freeze({
    id: 'observation-notes',
    title: '观察区说明 · 虚构资料',
    text: '样例观察图显示两处亮光从观察区入口进入。小镇玩家可在虚拟地图上辨认亮光位置，再阅读观察记录。目前资料尚待补充照护结果。',
  }),
]);

export class ProjectDraftError extends Error {
  constructor(status, message, code = 'AI_UNAVAILABLE') {
    super(message);
    this.name = 'ProjectDraftError';
    this.status = status;
    this.code = code;
  }
}

function gatewayConfig() {
  const model = process.env.ASTRO_GATEWAY_MODEL?.trim()
    || process.env.MODEL_DEFAULT?.trim() || defaultModel;
  const key = process.env.ASTRO_GATEWAY_API_KEY?.trim();
  const gatewayUrl = process.env.ASTRO_GATEWAY_URL?.trim();
  if (!key || !gatewayUrl) return { model, issue: 'AI_NOT_CONFIGURED' };
  try {
    const base = new URL(gatewayUrl);
    if (base.protocol === 'https:' && base.pathname === '/'
      && !base.username && !base.password && !base.search && !base.hash) {
      return {
        endpoint: new URL('/v1/chat/completions', base),
        key,
        model,
        issue: null,
      };
    }
  } catch { /* Report a safe configuration code without the supplied URL. */ }
  return { model, issue: 'AI_CONFIGURATION_INVALID' };
}

export function projectAiStatus() {
  const { model, issue } = gatewayConfig();
  return { configured: issue === null, model, issue };
}

export function projectAiConfigured() {
  return projectAiStatus().configured;
}

function draftFormat(sourceIds) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'budgetFlags', 'task'],
    properties: {
      summary: { type: 'string', minLength: 1, maxLength: 480 },
      budgetFlags: {
        type: 'array', maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 160 },
      },
      task: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'instructions', 'sourceIds'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 100 },
          instructions: { type: 'string', minLength: 1, maxLength: 500 },
          sourceIds: {
            type: 'array', minItems: 1, maxItems: sourceIds.length, uniqueItems: true,
            items: { type: 'string', enum: sourceIds },
          },
        },
      },
    },
  };
}

function shortText(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit;
}

function validSourceIds(ids, allowedIds) {
  return Array.isArray(ids) && ids.length >= 1 && ids.length <= allowedIds.length
    && new Set(ids).size === ids.length && [...ids].every((id) => allowedIds.includes(id));
}

function selectedProjectSources(sourceIds) {
  if (!validSourceIds(sourceIds, projectSources.map(({ id }) => id))) {
    throw new ProjectDraftError(400, '请选择 1–3 条不同的项目资料。', 'AI_SOURCE_SELECTION_INVALID');
  }
  return projectSources.filter(({ id }) => sourceIds.includes(id));
}

// Structured facts mirror the selected, explicitly fictional records above. The model never supplies these amounts.
const budgetFacts = Object.freeze({
  'rescue-plan': Object.freeze({ targetCents: 10_000 }),
  'supply-register': Object.freeze({
    label: '遮光护理布', quantity: 8, unitCents: 800, statedUnallocatedCents: 3_600,
  }),
});

function budgetMoney(cents) {
  return `US$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

export function auditProjectBudget(sourceIds) {
  const selected = selectedProjectSources(sourceIds).map(({ id }) => id);
  const plan = selected.includes('rescue-plan') ? budgetFacts['rescue-plan'] : null;
  const supply = selected.includes('supply-register') ? budgetFacts['supply-register'] : null;
  const targetCents = plan?.targetCents ?? null;
  const lineItems = supply ? [{
    label: supply.label,
    quantity: supply.quantity,
    unitCents: supply.unitCents,
    subtotalCents: supply.quantity * supply.unitCents,
    sourceIds: ['supply-register'],
  }] : [];
  const itemizedCents = lineItems.length ? lineItems.reduce((sum, item) => sum + item.subtotalCents, 0) : null;
  const unallocatedCents = targetCents !== null && itemizedCents !== null ? targetCents - itemizedCents : null;
  const findings = [];
  if (targetCents === null) findings.push({
    code: 'BUDGET_TARGET_MISSING',
    message: '所选资料未提供筹资目标，请补充目标金额。',
    sourceIds: [...selected],
  });
  if (itemizedCents === null) findings.push({
    code: 'BUDGET_LINE_ITEMS_MISSING',
    message: '所选资料未提供可核算的物资数量和单价，请补充分项预算。',
    sourceIds: [...selected],
  });
  if (unallocatedCents !== null && unallocatedCents > 0) findings.push({
    code: 'BUDGET_UNALLOCATED',
    message: `根据筹资目标和物资清单计算，${budgetMoney(unallocatedCents)} 尚未分项，需补充分项与报价。`,
    sourceIds: ['rescue-plan', 'supply-register'],
  });
  if (supply && targetCents === null) findings.push({
    code: 'BUDGET_SOURCE_REMAINDER_UNVERIFIED',
    message: `物资登记写明 ${budgetMoney(supply.statedUnallocatedCents)} 尚待分项与报价；缺少筹资目标，无法独立核对该差额。`,
    sourceIds: ['supply-register'],
  });
  return {
    currency: 'USD', targetCents, itemizedCents, unallocatedCents,
    lineItems, findings, sourceIds: selected,
  };
}

function invalidResponse() {
  return new ProjectDraftError(502, 'Astropods 返回的草稿格式或引用无效，请重试并核对资料。', 'AI_RESPONSE_INVALID');
}

export async function generateProjectDraft(sourceIds, { beforeGatewayRequest = () => {}, locale = 'en' } = {}) {
  const sources = selectedProjectSources(sourceIds);
  const budgetAudit = auditProjectBudget(sourceIds);
  const config = gatewayConfig();
  if (config.issue) {
    const message = config.issue === 'AI_NOT_CONFIGURED'
      ? '请先配置 Astropods AI Gateway 地址和账户密钥。'
      : 'Astropods 网关地址配置无效，请使用 HTTPS 主机地址。';
    throw new ProjectDraftError(503, message, config.issue);
  }

  const signal = AbortSignal.timeout(timeoutMs);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await beforeGatewayRequest();
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
        redirect: 'error',
        signal,
        body: JSON.stringify({
          model: config.model,
          stream: false,
          max_tokens: 1400,
          messages: [
            {
              role: 'system',
              content: `你为动物救助小镇整理简短草稿，本次项目资料均为虚构。${locale === 'zh-CN' ? '所有面向用户的文字使用简体中文。' : 'Write all user-facing strings in English, including summary, budgetFlags, task title and instructions. Translate source quotations faithfully into English. Keep source IDs unchanged.'}
唯一事实依据是用户消息中本次所选记录的 text。只采用这些记录明确写出的事实、计划和限定语，不引用未选资料，不用常识补齐项目细节。本提示中的术语与限制不是项目资料。
区分事实已发生、计划、记录待更新以及完全未提及。逐字保留这些状态的含义：“记录待更新”只说明记录待更新，不能据此判断实际步骤已完成或尚未执行。需求数量只表示需求，不能改写为已采购或已送达数量。未提及的信息保持缺失，摘要应完全省略，不自行补写相关步骤、状态或结论。
summary 只简短整理所选文字，保留虚构、样例、准备、待更新、待确认等原有范围。不要扩充项目的紧急程度、执行规模、部署、设备、动物照护或救助成果。
budgetFlags 只列所选文字能够支持的预算缺项。若所选记录没有任何金额、数量或单价，只简短说明“所选资料未提供预算信息”，不要发明费用类别、设备、采购需求或估价。也不要引入其他资料的金额或项目阶段。
task 只是一项可在当前网页内完成的虚拟阅读任务：阅读所选文字，定位其中已有的语句、位置描述或数量，或依据该文字作出选择。只使用原文已有的信息，不要求新增地图、坐标、强度、测量、评分、进度或完成指标。不得要求查看真实动物、执行物理照护、检查实际物资、核验采购签收、确认部署或观察救助结果。不要将原文提到的现实工作转换成玩家要执行的现实工作。
task.sourceIds 必须引用本次所选记录的原始 ID；任务中每个事实都要能在所引记录中找到。生成前逐句核对，删去没有文字依据的补充。
输出必须是可直接 JSON.parse 的合法 JSON 对象。字符串内引用资料标题或原句时使用单引号或正确转义的双引号。summary 最多 480 字符，每项 budgetFlags 最多 160 字符，task.title 最多 100 字符，task.instructions 最多 500 字符。不要使用 Markdown。只返回符合此 JSON Schema 的对象：${JSON.stringify(draftFormat(sourceIds))}`,
            },
            { role: 'user', content: JSON.stringify(sources) },
            ...(attempt === 0 ? [] : [{ role: 'user', content: `上一轮响应未通过 JSON 或字段校验。请重新依据相同所选资料生成更简短的合法 JSON，逐项核对 schema 和来源 ID。摘要不超过 480 字符，任务说明不超过 500 字符。${locale === 'zh-CN' ? '使用简体中文。' : 'All user-facing strings must be in English.'}` }]),
          ],
        }),
      });
      if (response.status === 401) {
        throw new ProjectDraftError(502, 'Astropods 身份验证失败，请检查网关账户密钥。', 'AI_AUTHENTICATION_FAILED');
      }
      if (response.status === 429) {
        throw new ProjectDraftError(503, 'Astropods 请求额度受限，请稍后重试或检查账户限额。', 'AI_RATE_LIMITED');
      }
      if (!response.ok) throw new ProjectDraftError(502, 'Astropods 暂时不可用，请检查网络或稍后重试。', 'AI_UNAVAILABLE');
      let data;
      try { data = await response.json(); }
      catch (error) {
        if (error instanceof SyntaxError) throw invalidResponse();
        throw error;
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length > 8_000
        || data?.choices?.[0]?.finish_reason === 'length') throw invalidResponse();
      const normalized = content.trim();
      const fence = normalized.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/);
      let draft;
      try { draft = JSON.parse(fence ? fence[1] : normalized); }
      catch { throw invalidResponse(); }
      const task = draft?.task;
      if (!shortText(draft?.summary, 480) || !Array.isArray(draft?.budgetFlags)
        || draft.budgetFlags.length > 4 || !draft.budgetFlags.every((flag) => shortText(flag, 160))
        || !shortText(task?.title, 100) || !shortText(task?.instructions, 500)
        || !validSourceIds(task?.sourceIds, sourceIds)) {
        throw invalidResponse();
      }
      return {
        summary: draft.summary.trim(),
        budgetFlags: draft.budgetFlags.map((flag) => flag.trim()),
        task: { title: task.title.trim(), instructions: task.instructions.trim(), sourceIds: task.sourceIds },
        budgetAudit,
        generation: { provider: 'Astropods', model: config.model, attempts: attempt + 1 },
        reviewRequired: true,
      };
    } catch (error) {
      if (error instanceof ProjectDraftError) {
        if (error.code === 'AI_RESPONSE_INVALID' && attempt === 0 && !signal.aborted) continue;
        throw error;
      }
      if (signal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new ProjectDraftError(504, 'Astropods 生成超时，请稍后重试。', 'AI_TIMEOUT');
      }
      throw new ProjectDraftError(502, 'Astropods 暂时不可用，请检查网络或稍后重试。', 'AI_UNAVAILABLE');
    }
  }
}
