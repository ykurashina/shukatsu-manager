// dashboard.js — ダッシュボードビュー

import { Store, STATUS_LABELS, STATUS_COLORS, CALENDAR_TYPE_COLORS, STEP_TYPE_LABELS, EVENT_CATEGORY_LABELS } from '../store.js';
import { DateUtils } from '../utils/date.js';
import { fetchNewsFromRSS } from '../utils/api.js';
import { openEventDetailModal } from './event-detail.js';

// カレンダー用ラベル統合（ステップ系 + イベント系）
var DASH_TYPE_LABELS = {};
var _sk;
for (_sk in STEP_TYPE_LABELS) {
  if (STEP_TYPE_LABELS.hasOwnProperty(_sk)) DASH_TYPE_LABELS[_sk] = STEP_TYPE_LABELS[_sk];
}
var _ek;
for (_ek in EVENT_CATEGORY_LABELS) {
  if (EVENT_CATEGORY_LABELS.hasOwnProperty(_ek)) DASH_TYPE_LABELS[_ek] = EVENT_CATEGORY_LABELS[_ek];
}
DASH_TYPE_LABELS['es_deadline'] = 'ES締切';

let _container = null;
let _unsubscribe = null;

/**
 * ダッシュボードをレンダリング
 */
export function render(container) {
  _container = container;
  _renderContent();
}

/**
 * イベントリスナー・データ監視の登録
 */
export function init() {
  // データ変更時に再レンダリング
  _unsubscribe = Store.onDataChange(() => {
    if (_container) {
      _renderContent();
    }
  });

  // 企業追加ボタン（空状態）のクリックハンドラ
  _attachEventListeners();
}

/**
 * クリーンアップ
 */
export function destroy() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
  _container = null;
}

// ============================================
//  内部関数
// ============================================

function _renderContent() {
  const companies = Store.getCompanies();
  const isEmpty = companies.length === 0;

  if (isEmpty) {
    _renderEmptyState();
  } else {
    _renderDashboard();
  }

  // Lucide アイコンを再描画
  if (window.lucide) window.lucide.createIcons();

  // イベントリスナーを再登録
  _attachEventListeners();
}

/**
 * 空状態の表示
 */
function _renderEmptyState() {
  _container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i data-lucide="building-2"></i>
      </div>
      <h2>まだ企業が登録されていません</h2>
      <p>企業を追加して、就活管理を始めましょう！</p>
      <a href="#companies" class="btn btn-primary" id="dashboard-add-company-btn">
        <i data-lucide="plus"></i>
        企業を追加する
      </a>
    </div>
  `;
}

/**
 * ダッシュボード本体の表示
 */
function _renderDashboard() {
  const stats = Store.getStats();
  const upcomingEvents = Store.getUpcomingEvents(7);
  const urgentActions = Store.getUrgentActions();

  _container.innerHTML = `
    <!-- KPIカード -->
    ${_renderKPIGrid(stats)}

    <!-- パネル -->
    <div class="dashboard-panels">
      ${_renderUpcomingEventsPanel(upcomingEvents)}
      ${_renderUrgentActionsPanel(urgentActions)}
    </div>

    <!-- ニュースフィード -->
    ${_renderNewsFeedPanel()}
  `;

  // ニュースの非同期読み込み
  _loadNewsFeed();
}

/**
 * KPIグリッドのHTML生成
 */
function _renderKPIGrid(stats) {
  return `
    <div class="dashboard-grid">
      <div class="kpi-card">
        <div class="kpi-icon total">
          <i data-lucide="building-2"></i>
        </div>
        <div class="kpi-info">
          <div class="kpi-label">登録企業数</div>
          <div class="kpi-value">${stats.total}</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon active">
          <i data-lucide="loader"></i>
        </div>
        <div class="kpi-info">
          <div class="kpi-label">選考中</div>
          <div class="kpi-value">${stats.active}</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon offers">
          <i data-lucide="trophy"></i>
        </div>
        <div class="kpi-info">
          <div class="kpi-label">内定</div>
          <div class="kpi-value">${stats.offers}</div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon events">
          <i data-lucide="calendar-clock"></i>
        </div>
        <div class="kpi-info">
          <div class="kpi-label">今週の予定</div>
          <div class="kpi-value">${stats.weeklyEvents}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 直近の予定パネルのHTML生成
 */
function _renderUpcomingEventsPanel(events) {
  const eventListHTML = events.length > 0
    ? '<div class="event-list">' + events.map(function(e, i) { return _renderEventItem(e, i); }).join('') + '</div>'
    : '<p class="panel-empty-message">直近7日間の予定はありません</p>';

  return `
    <div class="dashboard-panel">
      <div class="panel-header">
        <div class="panel-title">
          <i data-lucide="calendar-days"></i>
          直近の予定
        </div>
        <a href="#calendar" class="btn btn-ghost btn-sm">すべて見る</a>
      </div>
      ${eventListHTML}
    </div>
  `;
}

/**
 * イベントアイテム1件のHTML生成
 */
function _renderEventItem(event, index) {
  const daysUntil = DateUtils.daysUntil(event.date);
  const countdownLabel = DateUtils.daysUntilLabel(event.date);
  const dateLabel = DateUtils.formatShortDate(event.date);
  const typeLabel = DASH_TYPE_LABELS[event.type] || 'その他';
  const dotColor = event.color || CALENDAR_TYPE_COLORS[event.type] || '#94a3b8';

  // カウントダウンの色分け
  let countdownClass = 'countdown-later';
  if (daysUntil === 0) {
    countdownClass = 'countdown-today';
  } else if (daysUntil === 1) {
    countdownClass = 'countdown-tomorrow';
  } else if (daysUntil <= 3) {
    countdownClass = 'countdown-soon';
  }

  var idxAttr = (typeof index === 'number') ? ' data-event-index="' + index + '"' : '';

  return '<div class="event-item" data-company-id="' + (event.companyId || '') + '"' + idxAttr + ' style="cursor:pointer;">'
    + '<div class="event-dot" style="background-color: ' + dotColor + ';"></div>'
    + '<div class="event-info">'
    + '<div class="event-title">' + _escapeHTML(event.title) + '</div>'
    + '<div class="event-date">' + dateLabel + ' ・ ' + typeLabel + '</div>'
    + '</div>'
    + '<span class="event-countdown ' + countdownClass + '">' + countdownLabel + '</span>'
    + '</div>';
}

/**
 * 要アクションパネルのHTML生成
 */
function _renderUrgentActionsPanel(actions) {
  const actionListHTML = actions.length > 0
    ? actions.map(a => _renderActionItem(a)).join('')
    : `<p class="panel-empty-message">3日以内の緊急アクションはありません 🎉</p>`;

  return `
    <div class="dashboard-panel">
      <div class="panel-header">
        <div class="panel-title">
          <i data-lucide="alert-triangle"></i>
          要アクション
        </div>
      </div>
      ${actionListHTML}
    </div>
  `;
}

/**
 * アクションアイテム1件のHTML生成
 */
function _renderActionItem(action) {
  const countdownLabel = DateUtils.daysUntilLabel(action.date);
  const typeLabel = DASH_TYPE_LABELS[action.type] || 'その他';

  return `
    <div class="action-item" data-company-id="${action.companyId || ''}">
      <div class="action-item-icon">
        <i data-lucide="alert-circle"></i>
      </div>
      <div class="action-item-text">
        <strong>${_escapeHTML(action.title)}</strong>
        <br>
        <small>${typeLabel} ・ ${countdownLabel}</small>
      </div>
    </div>
  `;
}

/**
 * イベントリスナーを登録
 */
function _attachEventListeners() {
  if (!_container) return;

  // イベントアイテムのクリックで統一予定詳細モーダルを開く
  var upcomingEvents = Store.getUpcomingEvents(7);
  var eventItems = _container.querySelectorAll('.event-item[data-event-index]');
  for (var i = 0; i < eventItems.length; i++) {
    (function(item) {
      item.addEventListener('click', function() {
        var idx = parseInt(item.getAttribute('data-event-index'), 10);
        var calEvent = upcomingEvents[idx];
        if (calEvent) {
          openEventDetailModal(calEvent, {
            onDelete: function() { if (_container) _renderContent(); }
          });
        }
      });
    })(eventItems[i]);
  }

  // アクションアイテムのクリックで企業詳細へ遷移
  const actionItems = _container.querySelectorAll('.action-item[data-company-id]');
  actionItems.forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const companyId = item.dataset.companyId;
      if (companyId) {
        window.location.hash = 'companies?id=' + companyId;
      }
    });
  });

  // ニュース更新ボタンのイベント
  const refreshBtn = _container.querySelector('#news-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      _loadNewsFeed();
    });
  }
}

/**
 * ニュースフィードパネルのHTML生成（初期はローディング表示）
 */
function _renderNewsFeedPanel() {
  return `
    <div class="dashboard-panel news-feed-panel">
      <div class="panel-header">
        <div class="panel-title">
          <i data-lucide="newspaper"></i>
          就活ニュース
        </div>
        <button class="btn btn-ghost btn-sm" id="news-refresh-btn">
          <i data-lucide="refresh-cw"></i> 更新
        </button>
      </div>
      <div id="news-feed-content" class="news-feed-content">
        <p class="panel-empty-message">ニュースを読み込み中...</p>
      </div>
    </div>
  `;
}

/**
 * ニュースフィードを非同期で読み込み・表示
 */
async function _loadNewsFeed() {
  const settings = Store.getSettings();
  const feedUrl = settings.rssFeedUrl;
  const container = document.getElementById('news-feed-content');
  const refreshBtn = document.getElementById('news-refresh-btn');

  if (!feedUrl || !container) {
    if (container) {
      container.innerHTML = '<p class="panel-empty-message">RSSフィードURLが設定されていません</p>';
    }
    return;
  }

  // 取得中はUIをローディング状態にする
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> 取得中...';
    if (window.lucide) window.lucide.createIcons();
  }
  container.innerHTML = '<p class="panel-empty-message">ニュースを読み込み中...</p>';

  try {
    const articles = await fetchNewsFromRSS(feedUrl, 5);

    if (articles.length === 0) {
      container.innerHTML = '<p class="panel-empty-message">ニュースが取得できませんでした</p>';
    } else {
      container.innerHTML = articles.map(article => `
      <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="news-item">
        <div class="news-item-body">
          <div class="news-item-title">${_escapeHTML(article.title)}</div>
          <div class="news-item-date">${article.pubDate ? new Date(article.pubDate).toLocaleDateString('ja-JP') : ''}</div>
        </div>
        <i data-lucide="external-link" class="news-item-icon"></i>
      </a>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
    }
  } catch (err) {
    container.innerHTML = '<p class="panel-empty-message">ニュースの読み込みに失敗しました</p>';
  } finally {
    // 取得完了後にボタンを元に戻す
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i data-lucide="refresh-cw"></i> 更新';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

/**
 * HTMLエスケープ
 */
function _escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
