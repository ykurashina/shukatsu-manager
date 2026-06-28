// kanban.js — カンバンボードビュー
import { Store, STATUS_OPTIONS, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '../store.js';
import { DateUtils } from '../utils/date.js';

// モジュール内部の状態
let _container = null;
let _unsubscribe = null;

/**
 * ステータスごとに企業をグルーピングする
 * @returns {Map<string, Array>} ステータスをキーとする企業配列のマップ
 */
function groupCompaniesByStatus() {
  const companies = Store.getCompanies();
  const grouped = new Map();
  for (const status of STATUS_OPTIONS) {
    grouped.set(status, []);
  }
  for (const company of companies) {
    const list = grouped.get(company.status);
    if (list) {
      list.push(company);
    } else {
      // 不明なステータスの場合は interested に入れる
      grouped.get('interested').push(company);
    }
  }
  return grouped;
}

/**
 * 志望度バッジ要素を生成
 */
function createPriorityBadge(priority) {
  const badge = document.createElement('span');
  badge.className = `badge-priority badge-priority-${(priority || 'b').toLowerCase()}`;
  badge.textContent = priority || '-';
  return badge;
}

/**
 * カンバンカード（企業1件分）を生成
 */
function createCard(company) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.dataset.companyId = company.id;

  // ヘッダー（企業名 + 志望度バッジ）
  const header = document.createElement('div');
  header.className = 'kanban-card-header';

  const name = document.createElement('span');
  name.className = 'kanban-card-name';
  name.textContent = company.name || '（無名）';
  name.title = company.name || '';

  header.appendChild(name);
  header.appendChild(createPriorityBadge(company.priority));

  // ボディ（業界）
  const body = document.createElement('div');
  body.className = 'kanban-card-body';
  if (company.industry) {
    body.textContent = company.industry;
  }

  // メタ（次の予定日）
  const meta = document.createElement('div');
  meta.className = 'kanban-card-meta';

  if (company.nextDate) {
    // カレンダーアイコン (SVG)
    const calIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    calIcon.setAttribute('viewBox', '0 0 24 24');
    calIcon.setAttribute('fill', 'none');
    calIcon.setAttribute('stroke', 'currentColor');
    calIcon.setAttribute('stroke-width', '2');
    calIcon.setAttribute('stroke-linecap', 'round');
    calIcon.setAttribute('stroke-linejoin', 'round');
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    path1.setAttribute('x', '3');
    path1.setAttribute('y', '4');
    path1.setAttribute('width', '18');
    path1.setAttribute('height', '18');
    path1.setAttribute('rx', '2');
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path2.setAttribute('x1', '16'); path2.setAttribute('y1', '2');
    path2.setAttribute('x2', '16'); path2.setAttribute('y2', '6');
    const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path3.setAttribute('x1', '8'); path3.setAttribute('y1', '2');
    path3.setAttribute('x2', '8'); path3.setAttribute('y2', '6');
    const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path4.setAttribute('x1', '3'); path4.setAttribute('y1', '10');
    path4.setAttribute('x2', '21'); path4.setAttribute('y2', '10');
    calIcon.appendChild(path1);
    calIcon.appendChild(path2);
    calIcon.appendChild(path3);
    calIcon.appendChild(path4);
    meta.appendChild(calIcon);

    const dateSpan = document.createElement('span');
    dateSpan.textContent = DateUtils.formatShortDate(company.nextDate);

    const daysLabel = DateUtils.daysUntilLabel(company.nextDate);
    if (daysLabel) {
      dateSpan.textContent += ` (${daysLabel})`;
    }
    meta.appendChild(dateSpan);
  }

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(meta);

  return card;
}

/**
 * 空メッセージを生成
 */
function createEmptyMessage() {
  const empty = document.createElement('div');
  empty.className = 'kanban-card-meta';
  empty.style.justifyContent = 'center';
  empty.style.padding = '16px 0';
  empty.textContent = '企業がありません';
  return empty;
}

/**
 * カンバンカラム1本を生成
 */
function createColumn(status, companies) {
  const column = document.createElement('div');
  column.className = 'kanban-column';
  column.dataset.status = status;

  // ヘッダー
  const header = document.createElement('div');
  header.className = 'kanban-column-header';

  const title = document.createElement('div');
  title.className = 'kanban-column-title';

  // ステータスカラーのドット
  const dot = document.createElement('span');
  dot.style.display = 'inline-block';
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = STATUS_COLORS[status] || '#94a3b8';

  const label = document.createElement('span');
  label.textContent = STATUS_LABELS[status] || status;

  title.appendChild(dot);
  title.appendChild(label);

  const count = document.createElement('span');
  count.className = 'kanban-column-count';
  count.textContent = companies.length;

  header.appendChild(title);
  header.appendChild(count);

  // ボディ
  const body = document.createElement('div');
  body.className = 'kanban-column-body';

  if (companies.length === 0) {
    body.appendChild(createEmptyMessage());
  } else {
    for (const company of companies) {
      body.appendChild(createCard(company));
    }
  }

  column.appendChild(header);
  column.appendChild(body);

  return column;
}

/**
 * カンバンボード全体を描画
 */
function renderBoard() {
  if (!_container) return;

  const grouped = groupCompaniesByStatus();

  // 既存のラッパーがあればクリア
  let wrapper = _container.querySelector('.kanban-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'kanban-wrapper';
    _container.appendChild(wrapper);
  }

  // ボードを生成
  const board = document.createElement('div');
  board.className = 'kanban-board';

  for (const status of STATUS_OPTIONS) {
    const companies = grouped.get(status) || [];
    board.appendChild(createColumn(status, companies));
  }

  // ラッパーの中身を差し替え
  wrapper.innerHTML = '';
  wrapper.appendChild(board);
}

/**
 * カードクリック時のハンドラ
 */
function handleCardClick(e) {
  const card = e.target.closest('.kanban-card');
  if (!card) return;

  const companyId = card.dataset.companyId;
  if (companyId) {
    // 企業詳細画面に遷移
    window.location.hash = `#companies?id=${companyId}`;
  }
}

// ============================================
//  パブリック API（render / init / destroy）
// ============================================

/**
 * ビューの描画
 */
export function render(container) {
  _container = container;
  _container.innerHTML = '';
  renderBoard();
}

/**
 * イベントリスナーの登録
 */
export function init() {
  // カードクリックイベント（イベント委譲）
  if (_container) {
    _container.addEventListener('click', handleCardClick);
  }

  // データ変更時に再描画
  _unsubscribe = Store.onDataChange(() => {
    renderBoard();
  });
}

/**
 * クリーンアップ
 */
export function destroy() {
  if (_container) {
    _container.removeEventListener('click', handleCardClick);
  }

  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }

  _container = null;
}
