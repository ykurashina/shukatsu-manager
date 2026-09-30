// kanban.js — カンバンボードビュー
import { Store, STATUS_OPTIONS, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, TRACK_TYPE_LABELS } from '../store.js';
import { DateUtils } from '../utils/date.js';

// モジュール内部の状態
var _container = null;
var _unsubscribe = null;

// 終了ステータス
var FINISHED_STATUSES = ['offer', 'declined', 'rejected'];

/**
 * 企業の代表トラックを決定する
 * @param {Object} company
 * @returns {Object|null} { track, status } or null
 */
function getRepresentativeTrack(company) {
  var tracks = Store.getTracks(company.id);
  if (!tracks || tracks.length === 0) return null;

  var activeTracks = [];
  var finishedTracks = [];

  for (var i = 0; i < tracks.length; i++) {
    var t = tracks[i];
    if (FINISHED_STATUSES.indexOf(t.status) >= 0) {
      finishedTracks.push(t);
    } else {
      activeTracks.push(t);
    }
  }

  // 進行中トラックがあれば、updatedAtが最新のものを代表に
  if (activeTracks.length > 0) {
    activeTracks.sort(function(a, b) {
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    return { track: activeTracks[0], status: activeTracks[0].status };
  }

  // すべて終了済みの場合、updatedAtが最新のものを代表に
  if (finishedTracks.length > 0) {
    finishedTracks.sort(function(a, b) {
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    return { track: finishedTracks[0], status: finishedTracks[0].status };
  }

  return null;
}

/**
 * ステータスごとに企業をグルーピングする（代表トラック判定付き）
 * @returns {Map<string, Array>} ステータスをキーとする企業配列のマップ
 */
function groupCompaniesByStatus() {
  var companies = Store.getCompanies();
  var grouped = new Map();
  for (var si = 0; si < STATUS_OPTIONS.length; si++) {
    grouped.set(STATUS_OPTIONS[si], []);
  }

  for (var ci = 0; ci < companies.length; ci++) {
    var company = companies[ci];
    var rep = getRepresentativeTrack(company);

    // 代表トラックがあればそのステータスで配置、なければ interested
    var effectiveStatus = rep ? rep.status : 'interested';
    var repTrack = rep ? rep.track : null;

    // _kanbanTrack をアタッチ（カード表示用）
    company._kanbanTrack = repTrack;

    var list = grouped.get(effectiveStatus);
    if (list) {
      list.push(company);
    } else {
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
  var card = document.createElement('div');
  card.className = 'kanban-card';
  card.dataset.companyId = company.id;

  // ヘッダー（企業名 + 志望度バッジ）
  var header = document.createElement('div');
  header.className = 'kanban-card-header';

  var name = document.createElement('span');
  name.className = 'kanban-card-name';
  name.textContent = company.name || '（無名）';
  name.title = company.name || '';

  header.appendChild(name);
  header.appendChild(createPriorityBadge(company.priority));

  // トラック情報（代表トラックがある場合）
  var trackInfo = document.createElement('div');
  trackInfo.className = 'kanban-card-track';
  var repTrack = company._kanbanTrack;
  if (repTrack) {
    var trackTypeBadge = document.createElement('span');
    trackTypeBadge.className = 'badge-track-type';
    trackTypeBadge.textContent = TRACK_TYPE_LABELS[repTrack.type] || repTrack.type || '';
    trackInfo.appendChild(trackTypeBadge);
    if (repTrack.position) {
      var posSpan = document.createElement('span');
      posSpan.className = 'kanban-card-track-position';
      posSpan.textContent = repTrack.position;
      trackInfo.appendChild(posSpan);
    }
  }

  // ボディ（業界）
  var body = document.createElement('div');
  body.className = 'kanban-card-body';
  if (company.industry) {
    body.textContent = company.industry;
  }

  // メタ（次の予定日）
  var meta = document.createElement('div');
  meta.className = 'kanban-card-meta';

  if (company.nextDate) {
    // カレンダーアイコン (SVG)
    var calIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    calIcon.setAttribute('viewBox', '0 0 24 24');
    calIcon.setAttribute('fill', 'none');
    calIcon.setAttribute('stroke', 'currentColor');
    calIcon.setAttribute('stroke-width', '2');
    calIcon.setAttribute('stroke-linecap', 'round');
    calIcon.setAttribute('stroke-linejoin', 'round');
    var path1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    path1.setAttribute('x', '3');
    path1.setAttribute('y', '4');
    path1.setAttribute('width', '18');
    path1.setAttribute('height', '18');
    path1.setAttribute('rx', '2');
    var path2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path2.setAttribute('x1', '16'); path2.setAttribute('y1', '2');
    path2.setAttribute('x2', '16'); path2.setAttribute('y2', '6');
    var path3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path3.setAttribute('x1', '8'); path3.setAttribute('y1', '2');
    path3.setAttribute('x2', '8'); path3.setAttribute('y2', '6');
    var path4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path4.setAttribute('x1', '3'); path4.setAttribute('y1', '10');
    path4.setAttribute('x2', '21'); path4.setAttribute('y2', '10');
    calIcon.appendChild(path1);
    calIcon.appendChild(path2);
    calIcon.appendChild(path3);
    calIcon.appendChild(path4);
    meta.appendChild(calIcon);

    var dateSpan = document.createElement('span');
    dateSpan.textContent = DateUtils.formatShortDate(company.nextDate);

    var daysLabel = DateUtils.daysUntilLabel(company.nextDate);
    if (daysLabel) {
      dateSpan.textContent += ' (' + daysLabel + ')';
    }
    meta.appendChild(dateSpan);
  }

  card.appendChild(header);
  if (repTrack) card.appendChild(trackInfo);
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
  var card = e.target.closest('.kanban-card');
  if (!card) return;

  var companyId = card.dataset.companyId;
  if (companyId) {
    // 企業詳細画面に遷移
    window.location.hash = 'companies?id=' + companyId;
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
