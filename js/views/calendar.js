// calendar.js — カレンダービュー
import { Store, CALENDAR_TYPE_COLORS, STEP_TYPE_OPTIONS, STEP_TYPE_LABELS, EVENT_CATEGORY_OPTIONS, EVENT_CATEGORY_LABELS, TRACK_TYPE_OPTIONS, TRACK_TYPE_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { DateUtils } from '../utils/date.js';

// ===== 状態 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDate = null; // Date オブジェクト
let unsubscribe = null;

// カレンダー用のタイプラベル統合（ステップ系 + イベント系）
var CAL_TYPE_LABELS = {};
var stKey;
for (stKey in STEP_TYPE_LABELS) {
  if (STEP_TYPE_LABELS.hasOwnProperty(stKey)) {
    CAL_TYPE_LABELS[stKey] = STEP_TYPE_LABELS[stKey];
  }
}
var evKey;
for (evKey in EVENT_CATEGORY_LABELS) {
  if (EVENT_CATEGORY_LABELS.hasOwnProperty(evKey)) {
    CAL_TYPE_LABELS[evKey] = EVENT_CATEGORY_LABELS[evKey];
  }
}
CAL_TYPE_LABELS['es_deadline'] = 'ES締切';

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
        <button class="btn btn-primary btn-sm" id="calendarAddBtn">＋ 予定を追加</button>
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
  document.getElementById('calendarAddBtn')?.addEventListener('click', function() { openCalendarAddModal(); });

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
      eventEl.style.backgroundColor = ev.color || CALENDAR_TYPE_COLORS[ev.type] || '#94a3b8';
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
      const color = ev.color || CALENDAR_TYPE_COLORS[ev.type] || '#94a3b8';
      const typeLabel = CAL_TYPE_LABELS[ev.type] || 'その他';
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
  var html = '<div class="legend-title">凡例</div><div class="legend-items">';
  // 選考ステップ（青・紫系）
  html += '<div class="legend-group-label">選考ステップ</div>';
  var stepTypes = ['es', 'webtest', 'gd', 'interview', 'intern_day', 'offer'];
  for (var i = 0; i < stepTypes.length; i++) {
    var t = stepTypes[i];
    html += '<div class="legend-item"><span class="legend-dot" style="background-color: '
      + (CALENDAR_TYPE_COLORS[t] || '#94a3b8') + ';"></span>' + (STEP_TYPE_LABELS[t] || t) + '</div>';
  }
  // 企業個別イベント（緑・ティール系）
  html += '<div class="legend-group-label">企業イベント</div>';
  var companyEvTypes = ['briefing', 'intern_open', 'obog'];
  for (var j = 0; j < companyEvTypes.length; j++) {
    var c = companyEvTypes[j];
    html += '<div class="legend-item"><span class="legend-dot" style="background-color: '
      + (CALENDAR_TYPE_COLORS[c] || '#94a3b8') + ';"></span>' + (EVENT_CATEGORY_LABELS[c] || c) + '</div>';
  }
  // 全体イベント（オレンジ系）
  html += '<div class="legend-group-label">全体イベント</div>';
  var globalEvTypes = ['joint_briefing', 'seminar'];
  for (var k = 0; k < globalEvTypes.length; k++) {
    var g = globalEvTypes[k];
    html += '<div class="legend-item"><span class="legend-dot" style="background-color: '
      + (CALENDAR_TYPE_COLORS[g] || '#94a3b8') + ';"></span>' + (EVENT_CATEGORY_LABELS[g] || g) + '</div>';
  }
  // その他
  html += '<div class="legend-item"><span class="legend-dot" style="background-color: '
    + (CALENDAR_TYPE_COLORS.other || '#94a3b8') + ';"></span>その他</div>';
  html += '</div>';
  return html;
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

// =========================================================
//  カレンダーからの予定追加モーダル
// =========================================================
function openCalendarAddModal() {
  var form = document.createElement('div');
  form.className = 'modal-form';

  // 初期日付（選択中の日付 or 今日）
  var defaultDate = '';
  if (selectedDate) {
    defaultDate = formatDateKey(selectedDate);
  } else {
    defaultDate = formatDateKey(new Date());
  }

  // ===== 予定タイプ選択（選考ステップ / 就活イベント） =====
  var typeGroup = document.createElement('div');
  typeGroup.className = 'form-group';
  typeGroup.innerHTML = '<label class="form-label">予定の種類 <span style="color:#ef4444;">*</span></label>'
    + '<select class="form-select" id="cal-add-type">'
    + '<option value="step">選考ステップ（面接・ES提出など）</option>'
    + '<option value="event">就活イベント（説明会・合説など）</option>'
    + '</select>';
  form.appendChild(typeGroup);

  // ===== 動的コンテンツ部 =====
  var dynamicArea = document.createElement('div');
  dynamicArea.id = 'cal-add-dynamic';
  form.appendChild(dynamicArea);

  // 企業一覧を取得
  var companies = Store.getCompanies();

  // ----- 選考ステップ用フォーム生成 -----
  function buildStepForm() {
    var html = '';

    // 企業選択
    var companyOpts = '<option value="">-- 企業を選択 --</option>';
    for (var i = 0; i < companies.length; i++) {
      companyOpts += '<option value="' + companies[i].id + '">' + escapeHTML(companies[i].name) + '</option>';
    }
    html += '<div class="form-group"><label class="form-label">企業 <span style="color:#ef4444;">*</span></label>'
      + '<select class="form-select" id="cal-step-company">' + companyOpts + '</select></div>';

    // トラック選択（企業選択後に動的表示）
    html += '<div class="form-group" id="cal-step-track-group" style="display:none;">'
      + '<label class="form-label">選考トラック <span style="color:#ef4444;">*</span></label>'
      + '<select class="form-select" id="cal-step-track"></select></div>';

    // 新規トラック作成エリア（非表示初期状態）
    html += '<div id="cal-new-track-area" style="display:none;">'
      + '<div class="form-group"><label class="form-label">選考区分</label>'
      + '<select class="form-select" id="cal-new-track-type">';
    for (var tt = 0; tt < TRACK_TYPE_OPTIONS.length; tt++) {
      html += '<option value="' + TRACK_TYPE_OPTIONS[tt] + '">' + escapeHTML(TRACK_TYPE_LABELS[TRACK_TYPE_OPTIONS[tt]] || TRACK_TYPE_OPTIONS[tt]) + '</option>';
    }
    html += '</select></div>'
      + '<div class="form-group"><label class="form-label">コース名 <span class="form-hint">（任意）</span></label>'
      + '<input type="text" class="form-input" id="cal-new-track-position" placeholder="例: クラウドSEコース"></div>'
      + '</div>';

    // ステップ種類
    var stepOpts = '<option value="">-- 選択 --</option>';
    for (var s = 0; s < STEP_TYPE_OPTIONS.length; s++) {
      stepOpts += '<option value="' + STEP_TYPE_OPTIONS[s] + '">' + escapeHTML(STEP_TYPE_LABELS[STEP_TYPE_OPTIONS[s]] || STEP_TYPE_OPTIONS[s]) + '</option>';
    }
    html += '<div class="form-group"><label class="form-label">ステップ種類 <span style="color:#ef4444;">*</span></label>'
      + '<select class="form-select" id="cal-step-type">' + stepOpts + '</select></div>';

    // ステップ名
    html += '<div class="form-group"><label class="form-label">ステップ名</label>'
      + '<input type="text" class="form-input" id="cal-step-name" placeholder="例: 一次面接"></div>';

    // 日付
    html += '<div class="form-group"><label class="form-label">日付</label>'
      + '<input type="date" class="form-input" id="cal-step-date" value="' + defaultDate + '"></div>';

    // 場所
    html += '<div class="form-group"><label class="form-label">場所</label>'
      + '<input type="text" class="form-input" id="cal-step-location" placeholder="例: 東京本社 / オンライン"></div>';

    return html;
  }

  // ----- 就活イベント用フォーム生成 -----
  function buildEventForm() {
    var html = '';

    // イベント種別（カレンダーでは全種別選択可能）
    var catOpts = '<option value="">-- 選択 --</option>';
    for (var e = 0; e < EVENT_CATEGORY_OPTIONS.length; e++) {
      catOpts += '<option value="' + EVENT_CATEGORY_OPTIONS[e] + '">' + escapeHTML(EVENT_CATEGORY_LABELS[EVENT_CATEGORY_OPTIONS[e]] || EVENT_CATEGORY_OPTIONS[e]) + '</option>';
    }
    html += '<div class="form-group"><label class="form-label">イベント種別 <span style="color:#ef4444;">*</span></label>'
      + '<select class="form-select" id="cal-event-category">' + catOpts + '</select></div>';

    // 企業指定
    var companyOpts = '<option value="">企業指定なし（合説・セミナー等）</option>';
    for (var i = 0; i < companies.length; i++) {
      companyOpts += '<option value="' + companies[i].id + '">' + escapeHTML(companies[i].name) + '</option>';
    }
    html += '<div class="form-group"><label class="form-label">企業</label>'
      + '<select class="form-select" id="cal-event-company">' + companyOpts + '</select></div>';

    // タイトル
    html += '<div class="form-group"><label class="form-label">タイトル</label>'
      + '<input type="text" class="form-input" id="cal-event-title" placeholder="例: 夏季合同説明会"></div>';

    // 日付
    html += '<div class="form-group"><label class="form-label">日付 <span style="color:#ef4444;">*</span></label>'
      + '<input type="date" class="form-input" id="cal-event-date" value="' + defaultDate + '"></div>';

    // 場所
    html += '<div class="form-group"><label class="form-label">場所</label>'
      + '<input type="text" class="form-input" id="cal-event-location" placeholder="例: 東京ビッグサイト / オンライン"></div>';

    // メモ
    html += '<div class="form-group"><label class="form-label">メモ</label>'
      + '<textarea class="form-textarea" id="cal-event-memo" rows="3" placeholder="メモ"></textarea></div>';

    return html;
  }

  // 初回: ステップフォームを表示
  dynamicArea.innerHTML = buildStepForm();

  // 予定タイプ切替
  function switchType() {
    var type = document.getElementById('cal-add-type').value;
    if (type === 'step') {
      dynamicArea.innerHTML = buildStepForm();
      bindStepEvents();
    } else {
      dynamicArea.innerHTML = buildEventForm();
    }
  }

  // ステップフォームの企業選択→トラック連動
  function bindStepEvents() {
    var companySelect = document.getElementById('cal-step-company');
    if (!companySelect) return;
    companySelect.addEventListener('change', function() {
      var companyId = companySelect.value;
      var trackGroup = document.getElementById('cal-step-track-group');
      var trackSelect = document.getElementById('cal-step-track');
      var newTrackArea = document.getElementById('cal-new-track-area');
      if (!companyId) {
        trackGroup.style.display = 'none';
        newTrackArea.style.display = 'none';
        return;
      }
      // トラック一覧を取得
      var tracks = Store.getTracks(companyId);
      var trackOpts = '';
      for (var i = 0; i < tracks.length; i++) {
        var label = (TRACK_TYPE_LABELS[tracks[i].type] || tracks[i].type || 'その他');
        if (tracks[i].position) label += ' (' + tracks[i].position + ')';
        trackOpts += '<option value="' + tracks[i].id + '">' + escapeHTML(label) + '</option>';
      }
      trackOpts += '<option value="__new__">＋ 新しい選考トラックを作成</option>';
      trackSelect.innerHTML = trackOpts;
      trackGroup.style.display = '';
      // 初期選択がnewなら新規エリア表示
      newTrackArea.style.display = (tracks.length === 0) ? '' : 'none';
      if (tracks.length === 0) {
        trackSelect.value = '__new__';
      }
      // トラック選択変更
      trackSelect.addEventListener('change', function() {
        newTrackArea.style.display = (trackSelect.value === '__new__') ? '' : 'none';
      });
    });
  }

  // 初回バインド
  setTimeout(function() {
    document.getElementById('cal-add-type').addEventListener('change', switchType);
    bindStepEvents();
  }, 50);

  Modal.open({
    title: '予定を追加',
    content: form,
    size: 'large',
    saveLabel: '追加',
    onSave: function() {
      var type = document.getElementById('cal-add-type').value;

      if (type === 'step') {
        // ===== 選考ステップ保存 =====
        var companyId = document.getElementById('cal-step-company').value;
        if (!companyId) { Toast.show('企業を選択してください', 'error'); return; }
        var stepType = document.getElementById('cal-step-type').value;
        if (!stepType) { Toast.show('ステップ種類を選択してください', 'error'); return; }
        var trackId = document.getElementById('cal-step-track').value;

        // 新規トラック作成
        if (trackId === '__new__') {
          var newTrackType = document.getElementById('cal-new-track-type').value;
          var newTrackPosition = (document.getElementById('cal-new-track-position').value || '').trim();
          var newTrack = Store.addTrack({
            companyId: companyId,
            type: newTrackType,
            position: newTrackPosition,
            memo: ''
          });
          trackId = newTrack.id;
        }

        Store.addStep({
          companyId: companyId,
          trackId: trackId,
          type: stepType,
          stepName: (document.getElementById('cal-step-name').value || '').trim(),
          scheduledDate: document.getElementById('cal-step-date').value || '',
          location: (document.getElementById('cal-step-location').value || '').trim(),
          result: 'pending',
          details: {}
        });

        Toast.show('選考ステップを追加しました', 'success');
      } else {
        // ===== 就活イベント保存 =====
        var category = document.getElementById('cal-event-category').value;
        if (!category) { Toast.show('イベント種別を選択してください', 'error'); return; }
        var eventDate = document.getElementById('cal-event-date').value;
        if (!eventDate) { Toast.show('日付を入力してください', 'error'); return; }
        var eventCompanyId = document.getElementById('cal-event-company').value || null;
        var eventCompanyName = '';
        if (eventCompanyId) {
          var comp = Store.getCompany(eventCompanyId);
          if (comp) eventCompanyName = comp.name;
        }

        Store.addEvent({
          companyId: eventCompanyId,
          category: category,
          title: (document.getElementById('cal-event-title').value || '').trim(),
          date: eventDate,
          location: (document.getElementById('cal-event-location').value || '').trim(),
          companyName: eventCompanyName,
          url: '',
          memo: (document.getElementById('cal-event-memo').value || '').trim()
        });

        Toast.show('イベントを追加しました', 'success');
      }

      Modal.close();
      renderCalendar();
      renderDayDetail();
    }
  });
}
