const defaultModel = 'claude-haiku-4-5';
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
  constructor(status, message) {
    super(message);
    this.name = 'ProjectDraftError';
    this.status = status;
  }
}

function gatewayConfig() {
  const key = process.env.ASTRO_GATEWAY_API_KEY?.trim();
  if (!key) return null;
  try {
    const base = new URL(process.env.ASTRO_GATEWAY_URL?.trim());
    if (base.protocol === 'https:' && base.pathname === '/'
      && !base.username && !base.password && !base.search && !base.hash) {
      return {
        endpoint: new URL('/v1/chat/completions', base),
        key,
        model: process.env.ASTRO_GATEWAY_MODEL?.trim() || defaultModel,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function projectAiConfigured() {
  return Boolean(gatewayConfig());
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

export async function generateProjectDraft(sourceIds) {
  if (!validSourceIds(sourceIds, projectSources.map(({ id }) => id))) {
    throw new ProjectDraftError(400, '请选择 1–3 条不同的项目资料。');
  }
  const config = gatewayConfig();
  if (!config) {
    throw new ProjectDraftError(503, '请先配置 Astropods AI Gateway 地址和账户密钥。');
  }

  const sources = projectSources.filter(({ id }) => sourceIds.includes(id));
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.model,
        stream: false,
        max_tokens: 1400,
        messages: [
          {
            role: 'system',
            content: `为动物救助小镇生成简短中文草稿。只依据所选虚构资料写摘要，保留来源记录的状态和范围。budgetFlags 写待确认的预算信息，资料不足时说明缺失。task 是虚拟小镇内的观察任务，引用所选资料的 ID。只返回符合此 JSON Schema 的对象，不要使用 Markdown：${JSON.stringify(draftFormat(sourceIds))}`,
          },
          { role: 'user', content: JSON.stringify(sources) },
        ],
      }),
    });
    if (!response.ok) throw new Error('Astropods request failed');
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length > 8_000) throw new Error('Invalid Astropods response');
    const draft = JSON.parse(content);
    const task = draft?.task;
    if (!shortText(draft?.summary, 480) || !Array.isArray(draft?.budgetFlags)
      || draft.budgetFlags.length > 4 || !draft.budgetFlags.every((flag) => shortText(flag, 160))
      || !shortText(task?.title, 100) || !shortText(task?.instructions, 500)
      || !validSourceIds(task?.sourceIds, sourceIds)) {
      throw new Error('Invalid project draft');
    }
    return {
      summary: draft.summary.trim(),
      budgetFlags: draft.budgetFlags.map((flag) => flag.trim()),
      task: { title: task.title.trim(), instructions: task.instructions.trim(), sourceIds: task.sourceIds },
    };
  } catch {
    throw new ProjectDraftError(502, 'Astropods 暂时未返回可用草稿，请检查配置或稍后重试。');
  }
}
