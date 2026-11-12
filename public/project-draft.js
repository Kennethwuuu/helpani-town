const element = (id) => document.getElementById(id);
const form = element('draft-form');
const generate = element('generate-draft');
const status = element('draft-status');
const sourceList = element('draft-sources');
const sourceLegend = sourceList.querySelector('legend');
const sourceStatus = element('draft-source-status');
const configurationStatus = element('draft-config-status');
const retrySources = element('retry-sources');
const retryBudget = element('retry-budget');
const budgetStatus = element('budget-status');
const budgetContent = element('budget-content');
const content = element('draft-content');
const placeholder = element('draft-placeholder');
const titles = new Map();

let configured = false;
let loadingSources = false;
let generating = false;
let checkingBudget = false;
let budgetRequest = 0;
let generationRequest = 0;
let budgetController;
let generationController;

function selectedSources() {
  return [...sourceList.querySelectorAll('input[name="sources"]:checked')].map((input) => input.value);
}

function setStatus(node, message, error = false) {
  node.dataset.tone = error ? 'error' : 'normal';
  node.setAttribute('role', error ? 'alert' : 'status');
  node.textContent = message;
}

function syncControls() {
  const count = selectedSources().length;
  generate.disabled = loadingSources || generating || !configured || count === 0;
  generate.textContent = generating ? '正在生成草稿…' : '生成任务草稿';
  retrySources.disabled = loadingSources || generating;
  retryBudget.disabled = checkingBudget || loadingSources || count === 0;
  for (const input of sourceList.querySelectorAll('input')) input.disabled = loadingSources || generating;
  form.setAttribute('aria-busy', String(loadingSources));
  element('budget-audit').setAttribute('aria-busy', String(checkingBudget));
  element('draft-source-count').textContent = loadingSources ? '读取中' : `${count} 条已选`;
  content.setAttribute('aria-busy', String(generating));
}

function listItem(text, className) {
  const node = document.createElement('li');
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function sourceLink(id) {
  const link = document.createElement('a');
  link.href = `#source-${encodeURIComponent(id)}`;
  link.textContent = titles.get(id) || '所选资料';
  return link;
}

function sourceReferences(ids) {
  const paragraph = document.createElement('p');
  paragraph.className = 'draft-source-links';
  paragraph.append('依据');
  for (const id of ids) paragraph.append(sourceLink(id));
  return paragraph;
}

function money(cents) {
  if (!Number.isSafeInteger(cents)) return '待补充';
  return `US$${(cents / 100).toFixed(2)}`;
}

function clearDraft() {
  content.hidden = true;
  placeholder.hidden = false;
  for (const id of ['draft-summary', 'draft-title', 'draft-instructions', 'draft-generation', 'draft-inputs']) {
    element(id).textContent = '';
  }
  for (const id of ['draft-flags', 'draft-citations']) element(id).replaceChildren();
}

function clearBudget() {
  budgetContent.hidden = true;
  for (const id of ['budget-target', 'budget-itemized', 'budget-unallocated']) element(id).textContent = '待补充';
  element('budget-line-items').replaceChildren();
  element('budget-findings').replaceChildren();
  retryBudget.hidden = true;
}

function renderBudget(audit) {
  element('budget-target').textContent = money(audit.targetCents);
  element('budget-itemized').textContent = money(audit.itemizedCents);
  element('budget-unallocated').textContent = money(audit.unallocatedCents);
  const rows = audit.lineItems.map((line) => {
    const item = document.createElement('li');
    const heading = document.createElement('div');
    heading.className = 'budget-item-heading';
    const title = document.createElement('strong');
    const subtotal = document.createElement('strong');
    title.textContent = line.label;
    subtotal.textContent = money(line.subtotalCents);
    heading.append(title, subtotal);
    const equation = document.createElement('p');
    equation.className = 'budget-equation';
    equation.textContent = `${line.quantity} × ${money(line.unitCents)} = ${money(line.subtotalCents)}`;
    item.append(heading, equation);
    if (line.sourceIds.length) item.append(sourceReferences(line.sourceIds));
    return item;
  });
  element('budget-line-items').replaceChildren(...(rows.length ? rows : [listItem('所选资料未列出可计算的物资明细。', 'budget-empty')]));
  const findings = audit.findings.map((finding) => {
    const item = listItem(finding.message);
    if (finding.sourceIds.length) item.append(sourceReferences(finding.sourceIds));
    return item;
  });
  element('budget-findings').replaceChildren(...(findings.length ? findings : [listItem('没有发现额外待确认项，请继续核对原始记录。')]));
  budgetContent.hidden = false;
  retryBudget.hidden = true;
  setStatus(budgetStatus, `已核对 ${audit.sourceIds.length} 条所选资料，金额单位为美元。`);
}

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Request could not be completed');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

async function refreshBudget() {
  const request = ++budgetRequest;
  budgetController?.abort();
  const sourceIds = selectedSources();
  clearBudget();
  if (!sourceIds.length) {
    checkingBudget = false;
    setStatus(budgetStatus, '请至少选择一条资料，再查看预算。');
    syncControls();
    return;
  }
  const selection = sourceIds.join(',');
  const controller = new AbortController();
  budgetController = controller;
  const timeout = setTimeout(() => controller.abort(), 15_000);
  checkingBudget = true;
  setStatus(budgetStatus, '正在核对当前资料的预算…');
  syncControls();
  try {
    const response = await fetch('/api/project-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds, locale: window.HelpaniI18n.locale }),
      signal: controller.signal,
    });
    const audit = await readResponse(response);
    if (request !== budgetRequest || selectedSources().join(',') !== selection) return;
    renderBudget(audit);
  } catch {
    if (request !== budgetRequest || selectedSources().join(',') !== selection) return;
    setStatus(budgetStatus, '预算暂时无法核对。所选资料已保留，可以重试。', true);
    retryBudget.hidden = false;
  } finally {
    clearTimeout(timeout);
    if (request === budgetRequest) {
      checkingBudget = false;
      syncControls();
    }
  }
}

async function loadSources() {
  if (loadingSources || generating) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  loadingSources = true;
  configured = false;
  titles.clear();
  sourceList.replaceChildren(sourceLegend);
  retrySources.hidden = true;
  clearDraft();
  clearBudget();
  sourceStatus.hidden = false;
  sourceStatus.textContent = '正在读取项目资料…';
  configurationStatus.textContent = '正在读取 Astropods 配置状态…';
  setStatus(status, '正在读取资料…');
  syncControls();
  try {
    const response = await fetch('/api/project-draft', { signal: controller.signal });
    const data = await readResponse(response);
    for (const source of data.sources) {
      titles.set(source.id, source.title);
      const label = document.createElement('label');
      label.id = `source-${source.id}`;
      label.tabIndex = -1;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'sources';
      checkbox.value = source.id;
      checkbox.checked = true;
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = source.title;
      const description = document.createElement('span');
      description.textContent = source.text;
      copy.append(title, description);
      label.append(checkbox, copy);
      sourceList.append(label);
    }
    configured = data.configuration?.configured ?? data.enabled;
    sourceStatus.hidden = true;
    if (configured) {
      configurationStatus.textContent = 'Astropods 已配置。生成后请对照原始资料逐项核对。';
      setStatus(status, '可以用当前所选资料生成草稿。');
    } else {
      configurationStatus.textContent = data.configuration?.issue === 'AI_CONFIGURATION_INVALID'
        ? 'Astropods 配置需要调整。请联系演示维护者，资料预算核对仍可使用。'
        : 'Astropods 待配置。请联系演示维护者，资料预算核对仍可使用。';
      setStatus(status, '完成配置后刷新此页，即可尝试生成草稿。');
    }
    if (data.budgetAudit) renderBudget(data.budgetAudit);
    else await refreshBudget();
  } catch {
    configured = false;
    titles.clear();
    sourceList.replaceChildren(sourceLegend);
    clearBudget();
    sourceStatus.hidden = false;
    sourceStatus.textContent = '项目资料暂时无法读取。';
    configurationStatus.textContent = '资料读取后可检查 Astropods 配置状态。';
    setStatus(status, '资料暂时无法读取，请点击「重新读取资料」重试。', true);
    setStatus(budgetStatus, '项目资料读取后即可核对预算。');
    retrySources.hidden = false;
  } finally {
    clearTimeout(timeout);
    loadingSources = false;
    syncControls();
  }
}

function generationError(error) {
  if (error.code === 'AI_NOT_CONFIGURED' || error.code === 'AI_CONFIGURATION_INVALID') {
    configured = false;
    configurationStatus.textContent = 'Astropods 连接需要维护者检查，资料预算核对仍可使用。';
    return '生成服务暂时不可用。请联系演示维护者后刷新页面。';
  }
  if (error.code === 'AI_SOURCE_SELECTION_INVALID' || error.status === 400) return '本次资料选择无法使用，请重新选择后再生成。';
  if (error.code === 'AI_DEMO_BUSY') return '另一份演示草稿正在生成，请稍后重试。所选资料已保留。';
  if (error.code === 'AI_DEMO_LIMIT_REACHED') return '本轮在线 AI 演示次数已用完，请联系演示维护者。仍可查看原始资料和预算核对。';
  if (error.code === 'AI_RATE_LIMITED' || error.status === 429) return '生成服务当前繁忙或额度受限，请稍后重试。所选资料已保留。';
  if (error.code === 'AI_TIMEOUT' || error.name === 'AbortError' || error.status === 504) return '本次生成等待较久，尚未取得草稿。请稍后重试。';
  if (error.code === 'AI_AUTHENTICATION_FAILED') return '生成服务的连接验证未通过，请联系演示维护者。所选资料已保留。';
  if (error.code === 'AI_RESPONSE_INVALID') return '本次返回的草稿不完整，尚无法使用。请重新生成，所选资料已保留。';
  return 'Astropods 暂时未返回可用草稿。所选资料已保留，请稍后重试。';
}

form.addEventListener('change', () => {
  generationRequest += 1;
  generationController?.abort();
  generating = false;
  clearDraft();
  const count = selectedSources().length;
  setStatus(status, !count ? '请至少选择一条资料。' : configured ? '资料选择已更新，可以生成新草稿。' : '资料选择已更新，预算核对仍可使用。');
  refreshBudget();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generate.disabled) return;
  const sourceIds = selectedSources();
  const selection = sourceIds.join(',');
  const request = ++generationRequest;
  const controller = new AbortController();
  generationController = controller;
  const timeout = setTimeout(() => controller.abort(), 55_000);
  generating = true;
  clearDraft();
  setStatus(status, 'Astropods 正在依据当前资料生成草稿…');
  syncControls();
  try {
    const response = await fetch('/api/project-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds, locale: window.HelpaniI18n.locale }),
      signal: controller.signal,
    });
    const draft = await readResponse(response);
    if (request !== generationRequest || selectedSources().join(',') !== selection) return;
    element('draft-summary').textContent = draft.summary;
    element('draft-flags').replaceChildren(...(draft.budgetFlags.length ? draft.budgetFlags.map((flag) => listItem(flag)) : [listItem('AI 未补充建议复核项，请继续对照资料预算和原文。')]));
    element('draft-title').textContent = draft.task.title;
    element('draft-instructions').textContent = draft.task.instructions;
    element('draft-citations').replaceChildren(...draft.task.sourceIds.map((id) => {
      const item = listItem('');
      item.append(sourceLink(id));
      return item;
    }));
    element('draft-generation').textContent = `${draft.generation.provider} · 本次请求模型 ${draft.generation.model}`;
    element('draft-review-label').textContent = '待人工核对';
    const inputs = element('draft-inputs');
    inputs.replaceChildren('本次采用的资料 ');
    for (const id of sourceIds) {
      inputs.append(sourceLink(id), ' ');
    }
    renderBudget(draft.budgetAudit);
    placeholder.hidden = true;
    content.hidden = false;
    setStatus(status, '草稿已生成。请核对资料、预算建议和任务引用。');
  } catch (error) {
    if (request !== generationRequest || selectedSources().join(',') !== selection) return;
    clearDraft();
    setStatus(status, generationError(error), true);
  } finally {
    clearTimeout(timeout);
    if (request === generationRequest) {
      generating = false;
      syncControls();
    }
  }
});

retrySources.addEventListener('click', loadSources);
retryBudget.addEventListener('click', refreshBudget);
window.addEventListener('helpani:languagechange', () => {
  const hadDraft = !content.hidden || generating;
  generationRequest += 1;
  generationController?.abort();
  generating = false;
  clearDraft();
  if (hadDraft) setStatus(status, window.HelpaniI18n.locale === 'en'
    ? 'Language changed. Generate a new draft in English using the selected sources.'
    : '语言已切换。请依据保留的所选资料重新生成中文草稿。');
  syncControls();
});
loadSources();
