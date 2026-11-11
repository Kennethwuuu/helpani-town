const element = (id) => document.getElementById(id);
const form = element('draft-form');
const generate = element('generate-draft');
const status = element('draft-status');
const sourceList = element('draft-sources');
const content = element('draft-content');
const placeholder = element('draft-placeholder');
const titles = new Map();
let provider = 'Astropods';
let configured = false;
let busy = false;

function selectedSources() {
  return new FormData(form).getAll('sources');
}

function updateButton() {
  generate.disabled = busy || !configured || selectedSources().length === 0;
}

function item(text) {
  const node = document.createElement('li');
  node.textContent = text;
  return node;
}

async function loadSources() {
  try {
    const response = await fetch('/api/project-draft');
    if (!response.ok) throw new Error('Sources unavailable');
    const { enabled, provider: draftProvider, sources } = await response.json();
    provider = draftProvider || provider;
    for (const source of sources) {
      titles.set(source.id, source.title);
      const label = document.createElement('label');
      label.id = `source-${source.id}`;
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
    configured = enabled;
    status.textContent = enabled ? `${provider} 已配置，可以用选中的资料生成草稿。` : `${provider} 待配置。配置完成后才可生成草稿。`;
    updateButton();
  } catch {
    status.textContent = '资料暂时无法读取，请刷新页面。';
  }
}

form.addEventListener('change', () => {
  content.hidden = true;
  placeholder.hidden = false;
  if (configured) status.textContent = selectedSources().length ? `可以用当前资料请求 ${provider} 生成新草稿。` : '请至少选择一条资料。';
  updateButton();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generate.disabled) return;
  const sourceIds = selectedSources();
  const inputs = [...sourceList.querySelectorAll('input')];
  busy = true;
  updateButton();
  inputs.forEach((input) => { input.disabled = true; });
  content.hidden = true;
  placeholder.hidden = false;
  status.textContent = `${provider} 正在生成草稿…`;
  try {
    const response = await fetch('/api/project-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceIds }),
    });
    const draft = await response.json();
    if (!response.ok) throw new Error(draft.error);
    element('draft-summary').textContent = draft.summary;
    element('draft-flags').replaceChildren(...(draft.budgetFlags.length
      ? draft.budgetFlags.map(item) : [item(`${provider} 未列出待确认项，请核对原始资料。`)]));
    element('draft-title').textContent = draft.task.title;
    element('draft-instructions').textContent = draft.task.instructions;
    element('draft-citations').replaceChildren(...draft.task.sourceIds.map((id) => {
      const link = document.createElement('a');
      link.href = `#source-${id}`;
      link.textContent = titles.get(id);
      const row = item('');
      row.append(link);
      return row;
    }));
    placeholder.hidden = true;
    content.hidden = false;
    status.textContent = `草稿由 ${provider} 生成，请核对引用。`;
  } catch (error) {
    status.textContent = error.message || '暂时无法生成草稿，请稍后重试。';
  } finally {
    busy = false;
    inputs.forEach((input) => { input.disabled = false; });
    updateButton();
  }
});

loadSources();
