// event-detail.js — 統一予定詳細モーダル（カレンダー・ダッシュボード共用）

import { Store, CALENDAR_TYPE_COLORS, STEP_TYPE_LABELS, EVENT_CATEGORY_LABELS, TRACK_TYPE_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { DateUtils } from '../utils/date.js';

function escapeHTML(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 統一予定詳細モーダルを開く
 * @param {Object} calEvent - Store.getAllEvents() が返すイベントオブジェクト
 * @param {Object} opts - オプション { onClose: function }
 */
export function openEventDetailModal(calEvent, opts) {
  if (!calEvent) return;
  opts = opts || {};

  var source = calEvent.source || '';
  var type = calEvent.type || 'other';
  var color = calEvent.color || CALENDAR_TYPE_COLORS[type] || '#94a3b8';

  // ラベル判定
  var typeLabel = STEP_TYPE_LABELS[type] || EVENT_CATEGORY_LABELS[type] || 'その他';

  // ソース種別ラベル
  var sourceLabel = '';
  if (source === 'step') sourceLabel = '選考ステップ';
  else if (source === 'event') sourceLabel = '就活イベント';
  else if (source === 'es') sourceLabel = 'ES締切';

  // 企業名取得
  var companyName = '';
  var company = null;
  if (calEvent.companyId) {
    company = Store.getCompany(calEvent.companyId);
    if (company) companyName = company.name;
  }

  // トラック情報（ステップの場合）
  var trackLabel = '';
  if (source === 'step' && calEvent.trackId) {
    var track = Store.getTrack(calEvent.trackId);
    if (track) {
      trackLabel = (TRACK_TYPE_LABELS[track.type] || track.type || '');
      if (track.position) trackLabel += ' (' + track.position + ')';
    }
  }

  // 詳細データ取得（ステップ or イベント）
  var stepData = null;
  var eventData = null;
  if (source === 'step') {
    stepData = Store.getStep(calEvent.id);
  } else if (source === 'event') {
    eventData = Store.getEvent(calEvent.id);
  }

  // ===== モーダルHTML構築 =====
  var html = '';

  // ヘッダーバッジ
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;">';
  html += '<span class="badge" style="background-color:' + color + '; color:#fff;">' + escapeHTML(typeLabel) + '</span>';
  if (sourceLabel) {
    html += '<span class="badge" style="background:var(--bg-alt); color:var(--text-secondary); border:1px solid var(--border);">' + escapeHTML(sourceLabel) + '</span>';
  }
  html += '</div>';

  // タイトル
  html += '<h3 style="margin:0 0 16px 0; font-size:var(--text-lg); font-weight:var(--fw-semibold);">' + escapeHTML(calEvent.title) + '</h3>';

  // 情報リスト
  html += '<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">';

  // 日付
  if (calEvent.date) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📅 日付</span>'
      + '<span>' + escapeHTML(DateUtils.formatDate(new Date(calEvent.date))) + '</span></div>';
  }

  // 企業名
  if (companyName) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">🏢 企業</span>'
      + '<span>' + escapeHTML(companyName) + '</span></div>';
  }

  // 選考トラック
  if (trackLabel) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📋 選考</span>'
      + '<span>' + escapeHTML(trackLabel) + '</span></div>';
  }

  // 場所（ステップ）
  if (stepData && stepData.location) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📍 場所</span>'
      + '<span>' + escapeHTML(stepData.location) + '</span></div>';
  }

  // 場所（イベント）
  if (eventData && eventData.location) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📍 場所</span>'
      + '<span>' + escapeHTML(eventData.location) + '</span></div>';
  }

  // 結果（ステップの場合）
  if (stepData && stepData.result && stepData.result !== 'pending') {
    var resultLabels = { passed: '通過', failed: '不合格' };
    var resultLabel = resultLabels[stepData.result] || stepData.result;
    var resultColor = stepData.result === 'passed' ? '#10b981' : '#ef4444';
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📊 結果</span>'
      + '<span class="badge" style="background-color:' + resultColor + '; color:#fff;">' + escapeHTML(resultLabel) + '</span></div>';
  }

  // 参加URL（イベント）
  if (eventData && eventData.url) {
    html += '<div style="display:flex; align-items:center; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">🔗 URL</span>'
      + '<a href="' + escapeHTML(eventData.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--primary);">' + escapeHTML(eventData.url) + '</a></div>';
  }

  // メモ（イベント）
  if (eventData && eventData.memo) {
    html += '<div style="display:flex; align-items:flex-start; gap:8px; font-size:var(--text-sm);">'
      + '<span style="color:var(--text-tertiary); min-width:80px;">📝 メモ</span>'
      + '<span style="white-space:pre-wrap;">' + escapeHTML(eventData.memo) + '</span></div>';
  }

  html += '</div>';

  // ===== アクションボタン =====
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; padding-top:12px; border-top:1px solid var(--border-light);">';

  // 企業詳細へ（企業に紐付く場合のみ）
  if (calEvent.companyId && company) {
    html += '<button class="btn btn-outline btn-sm" id="evt-detail-go-company">🏢 企業詳細を見る</button>';
  }

  // 編集（ステップ or イベント、ES締切は除外）
  if (source === 'step' || source === 'event') {
    html += '<button class="btn btn-outline btn-sm" id="evt-detail-edit">✏️ 編集</button>';
  }

  // 削除（ES締切は除外）
  if (source === 'step' || source === 'event') {
    html += '<button class="btn btn-outline btn-sm" id="evt-detail-delete" style="color:var(--error); border-color:var(--error);">🗑️ 削除</button>';
  }

  html += '</div>';

  // モーダルを表示
  var container = document.createElement('div');
  container.innerHTML = html;

  Modal.open({
    title: '予定の詳細',
    content: container,
    size: 'medium',
    hideFooter: true,
    onClose: function() {
      if (opts.onClose) opts.onClose();
    }
  });

  // ===== アクションボタンのイベントリスナー =====
  setTimeout(function() {
    // 企業詳細へ
    var goCompanyBtn = document.getElementById('evt-detail-go-company');
    if (goCompanyBtn) {
      goCompanyBtn.addEventListener('click', function() {
        Modal.close();
        setTimeout(function() {
          window.location.hash = 'companies?id=' + calEvent.companyId;
        }, 250);
      });
    }

    // 編集
    var editBtn = document.getElementById('evt-detail-edit');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        Modal.close();
        setTimeout(function() {
          if (source === 'step') {
            // 企業詳細画面のステップ編集モーダルへ遷移
            window.location.hash = 'companies?id=' + calEvent.companyId + '&editStep=' + calEvent.id;
          } else if (source === 'event') {
            // 企業詳細画面のイベント編集モーダルへ遷移
            if (calEvent.companyId) {
              window.location.hash = 'companies?id=' + calEvent.companyId + '&editEvent=' + calEvent.id;
            }
          }
        }, 250);
      });
    }

    // 削除
    var deleteBtn = document.getElementById('evt-detail-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        Modal.close();
        setTimeout(function() {
          Modal.confirm(
            'この予定「' + calEvent.title + '」を削除しますか？',
            function() {
              if (source === 'step') {
                Store.deleteStep(calEvent.id);
              } else if (source === 'event') {
                Store.deleteEvent(calEvent.id);
              }
              Toast.show('予定を削除しました', 'success');
              if (opts.onDelete) opts.onDelete();
            },
            '削除'
          );
        }, 250);
      });
    }
  }, 100);
}
