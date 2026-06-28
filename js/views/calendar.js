// calendar.js — カレンダービュー
import { Store, EVENT_TYPE_COLORS, STEP_TYPE_LABELS } from '../store.js';
import { DateUtils } from '../utils/date.js';

// ===== 状態 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDate = null; // Date オブジェクト
let unsubscribe = null;

// イベントタイプの日本語ラベル
const EVENT_TYPE_LABELS = {
  es_deadline: 'ES締切',
  interview: '面接',
  briefing: '説明会',
  webtest: 'Webテスト',
  obog: 'OB/OG訪問',
  other: 'その他'
};

// ===== レンダリング =====
export function render(container) {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'calendar-container';

  // --- メインカレンダー ---
  const main = document.createElement('div');
  main.className = 'calendar-main';
  main.innerHTML = `
    <div class="calendar-nav">
      <span class="calendar-month-title" id="calendarMonthTitle"></span>
      <div class="calendar-nav-buttons">
        <button class="btn btn-outline btn-sm" id="calendarPrevBtn">◀ 前月</button>
        <button class="btn btn-outline btn-sm" id="calendarTodayBtn">今日</button>
        <button class="btn btn-outline btn-sm" id="calendarNextBtn">次月 ▶</button>
      </div>
    </div>
    <div class="calendar-grid" id="calendarGrid"></div>
  `;

  // --- サイドパネル ---
  const side = document.createElement('div');
  side.className = 'calendar-side';

  // 日付詳細パネル
  const detailPanel = document.createElement('div');
  detailPanel.className = 'calendar-day-detail';
  detailPanel.id = 'calendarDayDetail';

  // 凡例パネル
  const legendPanel = document.createElement('div');
  legendPanel.className = 'calendar-legend';
  legendPanel.innerHTML = buildLegendHTML();

  side.appendChild(detailPanel);
  side.appendChild(legendPanel);

  wrapper.appendChild(main);
  wrapper.appendChild(side);
  container.appendChild(wrapper);

  // 初回描画
  renderCalendar();
  renderDayDetail();
}

// ===== 初期化 =====
export function init() {
  // ナビゲーションボタン
  document.getElementById('calendarPrevBtn')?.addEventListener('click', handlePrev);
  document.getElementById('calendarNextBtn')?.addEventListener('click', handleNext);
  document.getElementById('calendarTodayBtn')?.addEventListener('click', handleToday);

  // グリッドのクリック（イベント委譲）
  document.getElementById('calendarGrid')?.addEventListener('click', handleGridClick);

  // データ変更の監視
  unsubscribe = Store.onDataChange(() => {
    renderCalendar();
    renderDayDetail();
  });
}

// ===== 破棄 =====
export function destroy() {
  document.getElementById('calendarPrevBtn')?.removeEventListener('click', handlePrev);
  document.getElementById('calendarNextBtn')?.removeEventListener('click', handleNext);
  document.getElementById('calendarTodayBtn')?.removeEventListener('click', handleToday);
  document.getElementById('calendarGrid')?.removeEventListener('click', handleGridClick);

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  selectedDate = null;
}

// ===== イベントハンドラ =====
function handlePrev() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
  renderDayDetail();
}

function handleNext() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
  renderDayDetail();
}

function handleToday() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  renderCalendar();
  renderDayDetail();
}

function handleGridClick(e) {
  // セルまたはイベントのクリックを検知
  const cell = e.target.closest('.calendar-cell');
  if (!cell) return;

  const dateStr = cell.dataset.date;
  if (!dateStr) return;

  selectedDate = new Date(dateStr);

  // 選択状態のUI更新
  document.querySelectorAll('.calendar-cell.selected').forEach(el => {
    el.classList.remove('selected');
  });
  cell.classList.add('selected');

  renderDayDetail();
}

// ===== カレンダーグリッド描画 =====
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const titleEl = document.getElementById('calendarMonthTitle');
  if (!grid || !titleEl) return;

  // タイトル更新
  titleEl.textContent = `${currentYear}年${currentMonth + 1}月`;

  // グリッドをクリア
  grid.innerHTML = '';

  // 曜日ヘッダー
  const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    grid.appendChild(header);
  });

  // カレンダー日付の配列取得
  const calendarDays = DateUtils.getCalendarDays(currentYear, currentMonth);

  // イベント取得してマッピング
  const events = Store.getAllEvents();
  const eventMap = buildEventMap(events);

  // セル描画
  calendarDays.forEach(dayInfo => {
    const cell = document.createElement('div');
    const d = dayInfo.date;
    const dateKey = formatDateKey(d);

    cell.className = 'calendar-cell';
    cell.dataset.date = dateKey;

    // 当月外
    if (!dayInfo.isCurrentMonth) {
      cell.classList.add('other-month');
    }

    // 今日ハイライト
    if (DateUtils.isToday(d)) {
      cell.classList.add('today');
    }

    // 選択状態
    if (selectedDate && DateUtils.isSameDay(d, selectedDate)) {
      cell.classList.add('selected');
    }

    // 日付ラベル
    const dateLabel = document.createElement('div');
    dateLabel.className = 'calendar-date';
    dateLabel.textContent = d.getDate();
    cell.appendChild(dateLabel);

    // イベント表示
    const dayEvents = eventMap[dateKey] || [];
    const maxDisplay = 3;

    dayEvents.slice(0, maxDisplay).forEach(ev => {
      const eventEl = document.createElement('div');
      eventEl.className = 'calendar-event';
      eventEl.style.backgroundColor = ev.color || EVENT_TYPE_COLORS[ev.type] || '#94a3b8';
      eventEl.textContent = ev.title;
      eventEl.title = ev.title; // ツールチップ
      cell.appendChild(eventEl);
    });

    // +N件 表示
    if (dayEvents.length > maxDisplay) {
      const moreEl = document.createElement('div');
      moreEl.className = 'calendar-event-more';
      moreEl.textContent = `+${dayEvents.length - maxDisplay}件`;
      cell.appendChild(moreEl);
    }

    grid.appendChild(cell);
  });
}

// ===== サイドパネル: 日付詳細 =====
function renderDayDetail() {
  const panel = document.getElementById('calendarDayDetail');
  if (!panel) return;

  if (!selectedDate) {
    panel.innerHTML = `
      <div class="calendar-day-detail-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        日付を選択
      </div>
      <p style="font-size: var(--text-sm); color: var(--text-tertiary);">カレンダーの日付をクリックすると、その日の予定が表示されます。</p>
    `;
    return;
  }

  const dateStr = DateUtils.formatDate(selectedDate);
  const dateKey = formatDateKey(selectedDate);

  const events = Store.getAllEvents();
  const dayEvents = events.filter(ev => {
    const evDate = new Date(ev.date);
    return DateUtils.isSameDay(evDate, selectedDate);
  });

  let eventsHTML = '';

  if (dayEvents.length === 0) {
    eventsHTML = '<p style="font-size: var(--text-sm); color: var(--text-tertiary); padding: var(--sp-3) 0;">この日の予定はありません。</p>';
  } else {
    dayEvents.forEach(ev => {
      const color = ev.color || EVENT_TYPE_COLORS[ev.type] || '#94a3b8';
      const typeLabel = EVENT_TYPE_LABELS[ev.type] || 'その他';
      eventsHTML += `
        <div class="day-event-item" style="border-left-color: ${color};">
          <div class="day-event-item-content">
            <div class="day-event-item-title">${escapeHTML(ev.title)}</div>
            <div class="day-event-item-time">${typeLabel}</div>
          </div>
        </div>
      `;
    });
  }

  const todayLabel = DateUtils.isToday(selectedDate) ? ' （今日）' : '';

  panel.innerHTML = `
    <div class="calendar-day-detail-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      ${dateStr}${todayLabel}
    </div>
    <div id="dayEventsList">${eventsHTML}</div>
  `;
}

// ===== 凡例 =====
function buildLegendHTML() {
  const legendItems = [
    { type: 'es_deadline', label: 'ES締切', color: EVENT_TYPE_COLORS.es_deadline },
    { type: 'interview', label: '面接', color: EVENT_TYPE_COLORS.interview },
    { type: 'briefing', label: '説明会', color: EVENT_TYPE_COLORS.briefing },
    { type: 'webtest', label: 'Webテスト', color: EVENT_TYPE_COLORS.webtest },
    { type: 'obog', label: 'OB/OG訪問', color: EVENT_TYPE_COLORS.obog },
    { type: 'other', label: 'その他', color: EVENT_TYPE_COLORS.other },
  ];

  const itemsHTML = legendItems.map(item => `
    <div class="legend-item">
      <span class="legend-dot" style="background-color: ${item.color};"></span>
      ${item.label}
    </div>
  `).join('');

  return `
    <div class="legend-title">凡例</div>
    <div class="legend-items">${itemsHTML}</div>
  `;
}

// ===== ユーティリティ =====

/**
 * イベント配列を日付キーでグルーピング
 * @returns {Object<string, Array>}
 */
function buildEventMap(events) {
  const map = {};
  events.forEach(ev => {
    if (!ev.date) return;
    const d = new Date(ev.date);
    const key = formatDateKey(d);
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  });
  return map;
}

/**
 * DateオブジェクトをYYYY-MM-DDキーに変換
 */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * HTMLエスケープ
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
