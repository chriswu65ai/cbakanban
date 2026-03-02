const STORAGE_KEY = 'cba-life-kanban-v2';
const THEME_KEY = 'cba-life-theme';
const VIEW_KEY = 'cba-life-view';

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

const els = {
  boardTabs: document.getElementById('boardTabs'),
  columns: document.getElementById('columns'),
  addCardBtn: document.getElementById('addCardBtn'),
  addColumnBtn: document.getElementById('addColumnBtn'),
  deleteColumnBtn: document.getElementById('deleteColumnBtn'),
  cardDialog: document.getElementById('cardDialog'),
  cardForm: document.getElementById('cardForm'),
  themeToggle: document.getElementById('themeToggle'),
  stockPrice: document.getElementById('stockPrice'),
  stockChange: document.getElementById('stockChange'),
  stockUpdated: document.getElementById('stockUpdated'),
  spark: document.getElementById('stockSparkline'),
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
  if (!currentColumn || !board.columns.includes(currentColumn)) {
    currentColumn = board.columns[0];
  }
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

  article.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.onchange = () => {
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
  const doneCol = board.columns[board.columns.length - 1];
  const todoCol = board.columns[0];
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return;
  card.column = doneCol;

  if (card.recurrence !== 'none') {
    const next = {
      ...structuredClone(card),
      id: crypto.randomUUID(),
      column: todoCol,
      checklist: card.checklist.map((i) => ({ ...i, done: false })),
      dueDate: nextDate(card.dueDate, card.recurrence),
    };
    board.cards.push(next);
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

function openDialog(card = null) {
  editing = card;
  els.cardForm.reset();
  if (card) {
    els.cardForm.title.value = card.title;
    els.cardForm.notes.value = card.notes;
    els.cardForm.dueDate.value = card.dueDate;
    els.cardForm.priority.value = card.priority;
    els.cardForm.recurrence.value = card.recurrence;
    els.cardForm.checklist.value = card.checklist.map((c) => c.text).join('\n');
  }
  els.cardDialog.showModal();
}

els.addCardBtn.onclick = () => openDialog();

els.addColumnBtn.onclick = () => {
  const board = getBoard();
  const name = prompt('New column name:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (board.columns.includes(trimmed)) return alert('A column with that name already exists.');
  board.columns.push(trimmed);
  currentColumn = trimmed;
  saveState();
  render();
};

els.deleteColumnBtn.onclick = () => {
  const board = getBoard();
  ensureCurrentColumn(board);
  if (board.columns.length <= 1) return alert('At least one section is required.');
  const section = currentColumn;
  if (!confirm(`Delete current section "${section}"?`)) return;
  const fallback = board.columns.find((c) => c !== section) || board.columns[0];
  board.cards.forEach((card) => {
    if (card.column === section) card.column = fallback;
  });
  board.columns = board.columns.filter((c) => c !== section);
  currentColumn = fallback;
  saveState();
  render();
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
    dueDate: String(form.get('dueDate') || ''),
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

async function fetchYahooJson(url) {
  const attempts = [
    () => fetch(url),
    () => fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`),
    () => fetch(`https://r.jina.ai/http://${url.replace('https://', '')}`),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Stock fetch failed');
}

async function refreshStock() {
  try {
    const [quoteJson, chartJson] = await Promise.all([
      fetchYahooJson('https://query1.finance.yahoo.com/v7/finance/quote?symbols=CBA.AX'),
      fetchYahooJson('https://query1.finance.yahoo.com/v8/finance/chart/CBA.AX?range=1mo&interval=1d'),
    ]);

    const quote = quoteJson.quoteResponse?.result?.[0];
    const chart = chartJson.chart?.result?.[0];
    const closes = chart?.indicators?.quote?.[0]?.close?.filter((v) => typeof v === 'number') || [];
    if (!quote || closes.length < 2) throw new Error('Missing stock data');

    const latest = quote.regularMarketPrice;
    const open30 = closes[0];
    const delta = latest - open30;
    const pct = (delta / open30) * 100;

    els.stockPrice.textContent = `A$${latest.toFixed(2)}`;
    els.stockChange.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${pct.toFixed(2)}%) • 30d`;
    els.stockChange.className = `stock-change ${delta >= 0 ? 'good' : 'bad'}`;
    els.stockUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    drawSparkline(closes);
  } catch {
    els.stockPrice.textContent = 'Unavailable';
    els.stockChange.textContent = 'Yahoo Finance data could not be loaded right now.';
    els.stockChange.className = 'stock-change';
    els.stockUpdated.textContent = 'Widget shown with fallback status; refresh in a moment.';
    clearSparkline();
  }
}

function clearSparkline() {
  const ctx = els.spark.getContext('2d');
  ctx.clearRect(0, 0, els.spark.width, els.spark.height);
}

function drawSparkline(values) {
  const ctx = els.spark.getContext('2d');
  const w = els.spark.width;
  const h = els.spark.height;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (w - 10) + 5;
    const y = h - ((v - min) / range) * (h - 12) - 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function render() {
  renderTabs();
  renderColumns();
}

loadTheme();
loadViewMode();
render();
refreshStock();
setInterval(refreshStock, 5 * 60 * 1000);
