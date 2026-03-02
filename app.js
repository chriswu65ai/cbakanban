const STORAGE_KEY = 'cba-life-kanban-v2';
const THEME_KEY = 'cba-life-theme';
const VIEW_KEY = 'cba-life-view';
const PROTECTED_SECTIONS = ['Todo', 'Doing', 'Done'];

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

const RANGE_DAYS = { '30d': 30, '90d': 90, '1y': 365, '3y': 1095 };

let state = loadState();
let editing = null;
let currentColumn = null;
let stockSeries = [];

const els = {
  boardTabs: document.getElementById('boardTabs'),
  columns: document.getElementById('columns'),
  addCardBtn: document.getElementById('addCardBtn'),
  addSectionBtn: document.getElementById('addSectionBtn'),
  deleteSectionBtn: document.getElementById('deleteSectionBtn'),
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
  stockSparkline: document.getElementById('stockSparkline'),
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

els.addSectionBtn.onclick = () => {
  const board = getBoard();
  const name = prompt('New section name (e.g. Stocks, Protein, Dog):');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (board.columns.includes(trimmed)) return alert('A section with that name already exists.');
  board.columns.push(trimmed);
  currentColumn = trimmed;
  saveState();
  render();
};

els.deleteSectionBtn.onclick = () => {
  const board = getBoard();
  ensureCurrentColumn(board);
  const section = currentColumn;
  if (PROTECTED_SECTIONS.includes(section)) {
    return alert('Todo, Doing, and Done are fixed sections and cannot be deleted.');
  }
  if (!confirm(`Are you sure you want to delete current section "${section}"?`)) return;
  const fallback = board.columns.includes('Todo') ? 'Todo' : board.columns[0];
  board.cards.forEach((card) => {
    if (card.column === section) card.column = fallback;
  });
  board.columns = board.columns.filter((c) => c !== section);
  currentColumn = fallback;
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
  drawStockForRange();
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

els.stockRange.onchange = () => drawStockForRange();

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
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Failed to fetch stock CSV');
}

function parseStooqCsv(text) {
  const rows = text.trim().split('\n').slice(1);
  return rows
    .map((line) => line.split(','))
    .filter((parts) => parts.length >= 5 && parts[4] !== 'N/D')
    .map((parts) => ({ date: parts[0], close: Number(parts[4]) }))
    .filter((row) => Number.isFinite(row.close))
    .reverse();
}

function getSeriesForRange(range) {
  if (!stockSeries.length) return [];
  if (range === 'all') return stockSeries;
  const count = RANGE_DAYS[range] || 30;
  return stockSeries.slice(-count);
}

function drawSparkline(values) {
  const canvas = els.stockSparkline;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const color = getComputedStyle(document.body).getPropertyValue('--cba-yellow').trim() || '#ffcc00';

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * (width - 10) + 5;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function drawStockForRange() {
  const range = els.stockRange.value;
  const series = getSeriesForRange(range);
  if (series.length < 2) {
    els.stockPrice.textContent = 'A$--';
    els.stockChange.textContent = 'Unavailable';
    els.stockChange.className = 'muted';
    drawSparkline([]);
    return;
  }

  const latest = series[series.length - 1].close;
  const start = series[0].close;
  const delta = latest - start;
  const pct = (delta / start) * 100;

  els.stockPrice.textContent = `A$${latest.toFixed(2)}`;
  els.stockChange.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${pct.toFixed(2)}%) · ${range}`;
  els.stockChange.className = pct >= 0 ? 'stock-up' : 'stock-down';
  drawSparkline(series.map((x) => x.close));
}

async function refreshStock() {
  try {
    const csv = await fetchCsv('https://stooq.com/q/d/l/?s=cba.au&i=d');
    stockSeries = parseStooqCsv(csv);
    drawStockForRange();
  } catch {
    stockSeries = [];
    drawStockForRange();
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
refreshStock();
setInterval(refreshStock, 5 * 60 * 1000);
