const STORAGE_KEY = 'cba-life-kanban-v2';
const THEME_KEY = 'cba-life-theme';
const VIEW_KEY = 'cba-life-view';
const RANGE_DAYS = { '30d': 30, '90d': 90, '1y': 365, '3y': 1095 };
const TRADINGVIEW_RANGE = {
  '30d': '1M',
  '90d': '3M',
  '1y': '12M',
  '3y': '60M',
  all: 'ALL',
};

const defaultState = {
  currentBoardId: 'board-1',
  boards: [
    { id: 'board-1', name: 'Stocks', columns: ['Todo', 'Doing', 'Done'], cards: [] },
    { id: 'board-2', name: 'Protein', columns: ['Todo', 'Doing', 'Done'], cards: [] },
    { id: 'board-3', name: 'Dog', columns: ['Todo', 'Doing', 'Done'], cards: [] },
    { id: 'board-4', name: 'Protein', columns: ['Todo', 'Doing', 'Done'], cards: [] },
    { id: 'board-5', name: 'Workout', columns: ['Todo', 'Doing', 'Done'], cards: [] },
    { id: 'board-6', name: 'Protein', columns: ['Todo', 'Doing', 'Done'], cards: [] },
  ],
};

let state = loadState();
let editing = null;
let currentColumn = null;
let stockSeries = [];
let lastTapCardId = null;
let lastTapAt = 0;
const DOUBLE_TAP_MS = 320;

const els = {
  boardTabs: document.getElementById('boardTabs'),
  columns: document.getElementById('columns'),
  addCardBtn: document.getElementById('addCardBtn'),
  addBoardBtn: document.getElementById('addBoardBtn'),
  deleteBoardBtn: document.getElementById('deleteBoardBtn'),
  deleteCardBtn: document.getElementById('deleteCardBtn'),
  cardDialog: document.getElementById('cardDialog'),
  cardForm: document.getElementById('cardForm'),
  dueDay: document.getElementById('dueDay'),
  dueMonth: document.getElementById('dueMonth'),
  dueYear: document.getElementById('dueYear'),
  themeToggle: document.getElementById('themeToggle'),
  stockPrice: document.getElementById('stockPrice'),
  stockChange: document.getElementById('stockChange'),
  stockRange: document.getElementById('stockRange'),
  tradingViewWidget: document.getElementById('tradingViewWidget'),
  stockStatus: document.getElementById('stockStatus'),
  viewMode: document.getElementById('viewMode'),
  appRoot: document.getElementById('appRoot'),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getBoard() {
  return state.boards.find((b) => b.id === state.currentBoardId) || state.boards[0];
}

function ensureCurrentColumn(board) {
  if (!board.columns.length) board.columns.push('Todo');
  if (!currentColumn || !board.columns.includes(currentColumn)) currentColumn = board.columns[0];
}

function renderTabs() {
  const current = getBoard();
  els.boardTabs.innerHTML = '';
  state.boards.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${b.id === current.id ? 'active' : ''}`;
    btn.textContent = b.name;
    btn.onclick = () => {
      state.currentBoardId = b.id;
      currentColumn = null;
      saveState();
      render();
    };
    els.boardTabs.appendChild(btn);
  });
}

function renderColumns() {
  const board = getBoard();
  ensureCurrentColumn(board);
  els.columns.innerHTML = '';

  board.columns.forEach((column) => {
    const section = document.createElement('section');
    section.className = `column ${column === currentColumn ? 'current-section' : ''}`;
    section.dataset.column = column;
    section.onclick = () => {
      currentColumn = column;
      renderColumns();
    };
    section.ondragover = (e) => e.preventDefault();
    section.ondrop = (e) => {
      const cardId = e.dataTransfer.getData('text/plain');
      const card = board.cards.find((c) => c.id === cardId);
      if (!card) return;
      card.column = column;
      currentColumn = column;
      saveState();
      render();
    };

    const heading = document.createElement('h3');
    heading.textContent = column;
    section.appendChild(heading);

    board.cards.filter((c) => c.column === column).forEach((card) => {
      section.appendChild(renderCard(card, board));
    });

    els.columns.appendChild(section);
  });
}

function cycleCardColumn(board, card) {
  const hasTodo = board.columns.includes('Todo');
  const hasDoing = board.columns.includes('Doing');
  const hasDone = board.columns.includes('Done');
  if (!hasTodo || !hasDoing || !hasDone) return;

  if (card.column === 'Todo') card.column = 'Doing';
  else if (card.column === 'Doing') card.column = 'Done';
  else if (card.column === 'Done') card.column = 'Todo';
  else return;

  currentColumn = card.column;
  saveState();
  render();
}

function renderCard(card, board) {


  const article = document.createElement('article');
  article.className = 'card';
  article.draggable = true;
  article.ondragstart = (e) => e.dataTransfer.setData('text/plain', card.id);

  const doneChecklist = card.checklist.filter((i) => i.done).length;
  article.innerHTML = `
    <h4>${card.title}</h4>
    <div class="meta">Priority: ${card.priority} • Due: ${card.dueDate || '--'} • Recurrence: ${card.recurrence}</div>
    ${card.notes ? `<p>${card.notes}</p>` : ''}
    <ul class="checklist">
      ${card.checklist
        .map((item, idx) => `<li><input data-card="${card.id}" data-item="${idx}" type="checkbox" ${item.done ? 'checked' : ''}/> <span>${item.text}</span></li>`)
        .join('')}
    </ul>
    <div class="meta">Checklist: ${doneChecklist}/${card.checklist.length}</div>
    <div class="card-actions">
      <button data-edit="${card.id}" class="ghost-btn">Edit</button>
      <button data-done="${card.id}" class="primary-btn">Mark Done</button>
    </div>
  `;

  article.onclick = (e) => e.stopPropagation();

  article.onpointerup = (e) => {
    if (e.pointerType !== 'touch') return;
    if (e.target.closest('button, input, textarea, select, label')) return;

    const now = Date.now();
    const isDoubleTap = lastTapCardId === card.id && now - lastTapAt <= DOUBLE_TAP_MS;
    lastTapCardId = card.id;
    lastTapAt = now;

    if (isDoubleTap) {
      cycleCardColumn(board, card);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  article.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.onclick = (e) => e.stopPropagation();
    box.onchange = (e) => {
      e.stopPropagation();
      const c = board.cards.find((x) => x.id === box.dataset.card);
      c.checklist[Number(box.dataset.item)].done = box.checked;
      saveState();
      render();
    };
  });

  article.querySelector('[data-edit]').onclick = () => openDialog(card);
  article.querySelector('[data-done]').onclick = () => markDone(board, card.id);
  return article;
}

function markDone(board, cardId) {
  const doneCol = board.columns.includes('Done') ? 'Done' : board.columns[board.columns.length - 1];
  const todoCol = board.columns.includes('Todo') ? 'Todo' : board.columns[0];
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return;
  card.column = doneCol;

  if (card.recurrence !== 'none') {
    board.cards.push({
      ...structuredClone(card),
      id: crypto.randomUUID(),
      column: todoCol,
      checklist: card.checklist.map((i) => ({ ...i, done: false })),
      dueDate: nextDate(card.dueDate, card.recurrence),
    });
  }

  saveState();
  render();
}

function nextDate(currentDate, recurrence) {
  if (!currentDate) return '';
  const d = new Date(currentDate + 'T00:00:00');
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function populateDueDateSelects() {
  els.dueDay.innerHTML = '<option value="">Day</option>';
  for (let i = 1; i <= 31; i += 1) els.dueDay.innerHTML += `<option value="${String(i).padStart(2, '0')}">${i}</option>`;

  els.dueMonth.innerHTML = '<option value="">Month</option>';
  for (let i = 1; i <= 12; i += 1) els.dueMonth.innerHTML += `<option value="${String(i).padStart(2, '0')}">${i}</option>`;

  const year = new Date().getFullYear();
  els.dueYear.innerHTML = '<option value="">Year</option>';
  for (let y = year - 1; y <= year + 8; y += 1) els.dueYear.innerHTML += `<option value="${y}">${y}</option>`;
}

function setDueDateDropdown(dateStr) {
  if (!dateStr) {
    els.dueYear.value = '';
    els.dueMonth.value = '';
    els.dueDay.value = '';
    return;
  }
  const [year, month, day] = dateStr.split('-');
  els.dueYear.value = year || '';
  els.dueMonth.value = month || '';
  els.dueDay.value = day || '';
}

function getDueDateFromDropdown() {
  const year = els.dueYear.value;
  const month = els.dueMonth.value;
  const day = els.dueDay.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

function openDialog(card = null) {
  editing = card;
  els.cardForm.reset();
  setDueDateDropdown('');
  els.deleteCardBtn.classList.toggle('hidden', !card);
  if (card) {
    els.cardForm.title.value = card.title;
    els.cardForm.notes.value = card.notes;
    setDueDateDropdown(card.dueDate);
    els.cardForm.priority.value = card.priority;
    els.cardForm.recurrence.value = card.recurrence;
    els.cardForm.checklist.value = card.checklist.map((c) => c.text).join('\n');
  }
  els.cardDialog.showModal();
}

els.addCardBtn.onclick = () => openDialog();

els.addBoardBtn.onclick = () => {
  const current = getBoard();
  const name = prompt('New board name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const newBoard = {
    id: crypto.randomUUID(),
    name: trimmed,
    columns: [...current.columns],
    cards: [],
  };
  state.boards.push(newBoard);
  state.currentBoardId = newBoard.id;
  currentColumn = newBoard.columns[0] || null;
  saveState();
  render();
};

els.deleteBoardBtn.onclick = () => {
  if (state.boards.length <= 1) {
    alert('At least one board is required.');
    return;
  }
  const current = getBoard();
  if (!confirm(`Are you sure you want to delete current board "${current.name}"?`)) return;
  state.boards = state.boards.filter((b) => b.id !== current.id);
  state.currentBoardId = state.boards[0].id;
  currentColumn = null;
  saveState();
  render();
};

els.deleteCardBtn.onclick = () => {
  if (!editing) return;
  const board = getBoard();
  board.cards = board.cards.filter((c) => c.id !== editing.id);
  editing = null;
  saveState();
  render();
  els.cardDialog.close();
};

els.cardForm.onsubmit = (e) => {
  e.preventDefault();
  const board = getBoard();
  ensureCurrentColumn(board);
  const form = new FormData(els.cardForm);
  const payload = {
    id: editing?.id || crypto.randomUUID(),
    title: String(form.get('title') || ''),
    notes: String(form.get('notes') || ''),
    dueDate: getDueDateFromDropdown(),
    priority: String(form.get('priority') || 'Medium'),
    recurrence: String(form.get('recurrence') || 'none'),
    checklist: String(form.get('checklist') || '').split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false })),
    column: editing?.column || currentColumn,
  };

  if (editing) {
    const idx = board.cards.findIndex((c) => c.id === editing.id);
    board.cards[idx] = payload;
  } else {
    board.cards.push(payload);
  }

  editing = null;
  saveState();
  render();
  els.cardDialog.close();
};

document.getElementById('cancelDialog').onclick = () => {
  editing = null;
  els.cardDialog.close();
};

els.themeToggle.onclick = () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  loadTradingViewWidget();
};

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === 'dark') document.body.classList.add('dark');
}

function applyViewMode(mode) {
  els.appRoot.classList.remove('force-mobile', 'force-desktop');
  if (mode === 'mobile') els.appRoot.classList.add('force-mobile');
  if (mode === 'desktop') els.appRoot.classList.add('force-desktop');
}

els.viewMode.onchange = () => {
  const mode = els.viewMode.value;
  localStorage.setItem(VIEW_KEY, mode);
  applyViewMode(mode);
};

function loadViewMode() {
  const mode = localStorage.getItem(VIEW_KEY) || 'auto';
  els.viewMode.value = mode;
  applyViewMode(mode);
}

els.stockRange.onchange = () => {
  loadTradingViewWidget();
  drawStockSummary();
};

async function fetchCsv(url) {
  const attempts = [
    () => fetch(url),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`),
    () => fetch(`https://r.jina.ai/http://${url.replace('https://', '')}`),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to fetch stock data');
}

function parseStooqCsv(text) {
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .filter((parts) => parts.length >= 5 && parts[4] !== 'N/D')
    .map((parts) => ({ date: parts[0], close: Number(parts[4]) }))
    .filter((row) => Number.isFinite(row.close))
    .reverse();
}

function seriesForSelectedRange() {
  const selected = els.stockRange.value || '30d';
  if (!stockSeries.length) return [];
  if (selected === 'all') return stockSeries;
  return stockSeries.slice(-((RANGE_DAYS[selected] || 30) + 1));
}

function drawStockSummary() {
  const selected = els.stockRange.value || '30d';
  const series = seriesForSelectedRange();
  if (series.length < 2) {
    if (els.stockPrice) els.stockPrice.textContent = 'A$--';
    if (els.stockChange) {
      els.stockChange.textContent = '--';
      els.stockChange.className = 'muted';
    }
    if (els.stockStatus) els.stockStatus.textContent = `Range: ${selected}`;
    return;
  }

  const latest = series[series.length - 1].close;
  const start = series[0].close;
  const delta = latest - start;
  const pct = (delta / start) * 100;
  if (els.stockPrice) els.stockPrice.textContent = `A$${latest.toFixed(2)}`;
  if (els.stockChange) {
    els.stockChange.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${pct.toFixed(2)}%)`;
    els.stockChange.className = pct >= 0 ? 'stock-up' : 'stock-down';
  }
  if (els.stockStatus) els.stockStatus.textContent = `Range: ${selected}`;
}

async function refreshStockSummary() {
  try {
    const csv = await fetchCsv('https://stooq.com/q/d/l/?s=cba.au&i=d');
    stockSeries = parseStooqCsv(csv);
  } catch {
    stockSeries = [];
  }
  drawStockSummary();
}

function loadTradingViewWidget() {
  if (!els.tradingViewWidget) return;
  const selected = els.stockRange.value || '30d';
  const dateRange = TRADINGVIEW_RANGE[selected] || '1M';

  els.tradingViewWidget.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: 'ASX:CBA',
    width: '100%',
    height: 240,
    locale: 'en',
    dateRange,
    colorTheme: document.body.classList.contains('dark') ? 'dark' : 'light',
    trendLineColor: '#ffcc00',
    underLineColor: 'rgba(255, 204, 0, 0.2)',
    underLineBottomColor: 'rgba(255, 204, 0, 0.05)',
    isTransparent: true,
    autosize: true,
    chartOnly: false,
  });
  script.onerror = () => {
    if (els.stockStatus) {
      els.stockStatus.textContent = 'TradingView data failed to load. Please refresh.';
    }
  };

  els.tradingViewWidget.appendChild(script);
  if (els.stockStatus) {
    els.stockStatus.textContent = `Range: ${selected}`;
  }
}

function render() {
  renderTabs();
  renderColumns();
}


populateDueDateSelects();
loadTheme();
loadViewMode();
render();
loadTradingViewWidget();
refreshStockSummary();
setInterval(() => {
  loadTradingViewWidget();
  refreshStockSummary();
}, 5 * 60 * 1000);
