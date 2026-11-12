const byId = (id) => document.getElementById(id);
const grid = byId('registration-grid');
const refresh = byId('refresh-registrations');
const search = byId('registration-search');
const filter = byId('registration-filter');
const statusLabels = { signed_up: '待模拟核验', verified: '已模拟核验' };

let api;
let busy = false;

function showFeedback(message, tone = 'normal') {
  const feedback = byId('organizer-feedback');
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.dataset.tone = tone;
  byId('organizer-live').textContent = message;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  refresh.disabled = busy;
  for (const button of grid.querySelectorAll('.organizer-verify')) {
    button.setAttribute('aria-disabled', String(busy));
  }
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '暂时无法完成，请刷新后重试。');
  return data;
}

function render(data) {
  const rows = data.registrations;
  const verified = rows.filter(({ status }) => status === 'verified').length;
  byId('pending-count').textContent = rows.length - verified;
  byId('verified-count').textContent = verified;
  byId('organizer-points').textContent = data.points;
  byId('registration-empty').hidden = rows.length > 0;
  api.setGridOption('rowData', rows);
}

async function load() {
  if (busy) return;
  setBusy(true);
  showFeedback('');
  api.setGridOption('loading', true);
  try {
    render(await request('/api/organizer/registrations'));
  } catch {
    showFeedback('暂时无法读取报名，请刷新重试。', 'error');
  } finally {
    api.setGridOption('loading', false);
    setBusy(false);
  }
}

async function verify(registration) {
  if (busy) return;
  const { id, title } = registration;
  setBusy(true);
  showFeedback('');
  try {
    const data = await request('/api/organizer/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    render(data);
    showFeedback(`「${title}」已通过模拟核验。当前公益积分余额为 ${data.points} 分。`);
    const rowIndex = api.getRowNode(id)?.rowIndex;
    if (rowIndex == null) filter.focus();
    else api.setFocusedCell(rowIndex, 'status');
  } catch (error) {
    showFeedback(error.message || '暂时无法核验，请稍后重试。', 'error');
  } finally {
    setBusy(false);
  }
}

function renderStatus({ value }) {
  const badge = document.createElement('span');
  badge.className = value === 'verified' ? 'tag tag-green' : 'tag tag-yellow';
  badge.textContent = statusLabels[value];
  return badge;
}

function renderAction({ data }) {
  if (!data || data.status !== 'signed_up') return '—';

  const button = document.createElement('button');
  button.type = 'button';
  button.tabIndex = -1;
  button.className = 'button secondary organizer-verify';
  button.textContent = '模拟核验';
  button.setAttribute('aria-label', `模拟核验 ${data.title}`);
  button.setAttribute('aria-disabled', String(busy));
  button.addEventListener('click', () => verify(data));
  return button;
}

function handleActionKeyboard({ event }) {
  const cell = event.target.closest('[role="gridcell"]');
  const button = cell?.querySelector('.organizer-verify');
  if (!button) return false;

  if (event.key === 'Enter' || event.key === ' ') {
    if (event.target === cell) {
      event.preventDefault();
      button.click();
    }
    return true;
  }
  if (event.key === 'Tab' && !event.shiftKey && event.target === cell) {
    event.preventDefault();
    button.focus();
    return true;
  }
  if (event.key === 'Tab' && event.shiftKey && event.target === button) {
    event.preventDefault();
    cell.focus();
    return true;
  }
  return false;
}

function initialize() {
  const agGrid = window.agGrid;
  if (!agGrid?.createGrid) {
    showFeedback('报名表组件暂时无法加载。请刷新此页重试。', 'error');
    byId('grid-instructions').hidden = true;
    grid.hidden = true;
    return;
  }

  const theme = agGrid.themeQuartz.withParams({
    accentColor: '#255640',
    backgroundColor: '#fffdf5',
    borderColor: '#e1dfd0',
    browserColorScheme: 'light',
    fontFamily: 'inherit',
    foregroundColor: '#23372f',
    headerBackgroundColor: '#eaf0e2',
    oddRowBackgroundColor: '#f8f7ee',
    wrapperBorderRadius: 11,
  });

  api = agGrid.createGrid(grid, {
    theme,
    rowData: [],
    getRowId: ({ data }) => data.id,
    defaultColDef: { sortable: true, resizable: false },
    headerHeight: 40,
    rowHeight: 47,
    animateRows: false,
    columnDefs: [
      { field: 'title', headerName: '活动', flex: 2, minWidth: 170, tooltipValueGetter: ({ value }) => window.HelpaniI18n.t(value), getQuickFilterText: ({ value }) => window.HelpaniI18n.t(value) },
      { field: 'status', headerName: '核验状态', width: 200, cellClass: 'organizer-cell', cellRenderer: renderStatus, getQuickFilterText: () => '' },
      { field: 'points', headerName: '核验积分', width: 125, valueFormatter: ({ value }) => `+${value}`, getQuickFilterText: () => '' },
      {
        colId: 'verify',
        headerName: '操作',
        width: 175,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        cellClass: 'organizer-cell',
        cellRenderer: renderAction,
        cellRendererParams: { suppressMouseEventHandling: () => true },
        suppressKeyboardEvent: handleActionKeyboard,
      },
    ],
    localeText: {
      loadingOoo: '正在读取报名…',
      noRowsToShow: '还没有报名记录',
      noMatchingRows: '没有符合条件的报名',
    },
    isExternalFilterPresent: () => Boolean(filter.value),
    doesExternalFilterPass: ({ data }) => data.status === filter.value,
    onGridSizeChanged: ({ api: gridApi, clientWidth }) => {
      gridApi.setColumnsVisible(['points'], clientWidth >= 470);
    },
  });
  api.setGridAriaProperty('label', '活动报名表');
  api.setGridAriaProperty('describedby', 'grid-instructions');

  search.disabled = false;
  filter.disabled = false;
  search.addEventListener('input', () => api.setGridOption('quickFilterText', search.value));
  filter.addEventListener('change', () => api.onFilterChanged());
  refresh.addEventListener('click', load);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) load();
  });
  window.addEventListener('helpani:languagechange', () => {
    api.resetQuickFilter();
    api.setGridOption('quickFilterText', search.value);
    api.refreshHeader();
    api.refreshCells({ force: true });
  });
  load();
}

initialize();
